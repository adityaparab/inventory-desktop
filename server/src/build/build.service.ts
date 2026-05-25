import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Observable } from 'rxjs';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  BuildRecord,
  BuildRecordDocument,
  BuildStatus,
} from './schemas/build-record.schema';
import { Machine, MachineDocument } from '../machines/machine.schema';

export interface BuildRecordSummary {
  id: string;
  uuid: string;
  machineName: string | null;
  status: BuildStatus;
  outputFilename: string | null;
  createdAt: Date | null;
  completedAt: Date | null;
  canDownload: boolean;
}

/**
 * Core build orchestration service.
 *
 * Responsibilities:
 * 1. Spawn the `build-installer.ps1` PowerShell script and stream its output
 *    as Server-Sent Events.
 * 2. Create a `BuildRecord` at the start of each build so the job is immediately
 *    visible in the database (status: `building`).
 * 3. On success, copy the generated installer from the Tauri bundle directory
 *    into a user-scoped directory (`<project-root>/builds/<username>/`) and
 *    update the record with the final path and status `completed`.
 * 4. On failure, mark the record as `failed`.
 * 5. Expose a `getCompletedBuild` helper used by the download endpoint.
 *
 * Output directory convention:
 *   `<project-root>/builds/<username>/inventory_<uuid>_setup.exe`
 *
 * The base directory can be overridden via the `BUILD_OUTPUT_DIR` environment
 * variable (default: `<project-root>/builds`).
 */
@Injectable()
export class BuildService {
  /** Guards against concurrent builds on the same server instance. */
  private isBuildRunning = false;

  /**
   * Resolved absolute path to the project root.
   * In the built container the compiled service lives at
   * `/app/server/dist/build/build.service.js`, so three levels up is `/app`.
   */
  private readonly projectRoot = path.resolve(__dirname, '../../..');

  /** Base directory under which per-user build output folders are created. */
  private readonly buildOutputBase: string;

  constructor(
    @InjectModel(BuildRecord.name)
    private readonly buildRecordModel: Model<BuildRecordDocument>,
    @InjectModel(Machine.name)
    private readonly machineModel: Model<MachineDocument>,
    config: ConfigService,
  ) {
    this.buildOutputBase =
      config.get<string>('BUILD_OUTPUT_DIR') ?? path.join(this.projectRoot, 'builds');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Triggers a machine-specific NSIS installer build and streams progress
   * as Server-Sent Events.
   *
   * Workflow:
   * 1. Throws `ConflictException` immediately if another build is running.
   * 2. Creates a `BuildRecord` (status: `building`) in the database.
   * 3. Spawns `build-installer.ps1` and forwards stdout/stderr as SSE events.
   * 4. On exit code 0:
   *    a. Copies the generated `.exe` to `<buildOutputBase>/<username>/`.
   *    b. Updates the `BuildRecord` with `status: completed` and `outputPath`.
   *    c. Emits a `complete` event.
   * 5. On non-zero exit: marks the record `failed` and emits an `error` event.
   * 6. Cleans up (kills the process) if the SSE client disconnects early.
   *
   * @param uuid     - Target machine UUID (already validated by the controller).
   * @param userId   - MongoDB ObjectId string of the authenticated user.
   * @param username - Username of the authenticated user (used as output subdirectory).
   */
  build(
    uuid: string,
    userId: string,
    username: string,
  ): Observable<{ data: Record<string, string> }> {
    if (this.isBuildRunning) {
      throw new ConflictException(
        'A build is already in progress. Please wait for it to finish before starting another.',
      );
    }

    return new Observable((subscriber) => {
      this.isBuildRunning = true;

      // Create the build record *before* spawning so any observer watching the
      // database immediately sees the job, even if the spawn itself is slow.
      const recordPromise = this.buildRecordModel.create({
        uuid,
        userId: new Types.ObjectId(userId),
        status: BuildStatus.BUILDING,
      });

      const scriptPath = path.join(this.projectRoot, 'build-installer.ps1');

      const proc = spawn(
        this.getPowerShellCommand(),
        this.getPowerShellArgs(scriptPath, uuid),
        { cwd: this.projectRoot },
      );

      const emit = (type: string, message: string) => {
        subscriber.next({ data: { type, message } });
      };

      const handleOutput = (chunk: Buffer, isStderr: boolean) => {
        const lines = chunk
          .toString()
          .split(/\r?\n/)
          .filter((l) => l.trim().length > 0);
        for (const line of lines) {
          emit(isStderr ? 'stderr' : 'log', line);
        }
      };

      proc.stdout.on('data', (chunk: Buffer) => handleOutput(chunk, false));
      proc.stderr.on('data', (chunk: Buffer) => handleOutput(chunk, true));

      proc.on('close', async (code) => {
        this.isBuildRunning = false;

        if (code === 0) {
          // Locate the installer that build-installer.ps1 produced.
          const sourcePath = this.getBuiltFilePath(uuid);
          const outputFilename = this.getOutputFilename(uuid);
          const destDir = path.join(this.buildOutputBase, username);
          const destPath = path.join(destDir, outputFilename);

          try {
            if (!fs.existsSync(sourcePath)) {
              throw new Error(`Expected installer was not found at ${sourcePath}`);
            }
            fs.mkdirSync(destDir, { recursive: true });
            fs.copyFileSync(sourcePath, destPath);
          } catch (copyErr) {
            const msg = `Build succeeded but the output file could not be stored: ${(copyErr as Error).message}`;
            emit('error', msg);
            try {
              const record = await recordPromise;
              await this.buildRecordModel
                .findByIdAndUpdate(record._id, {
                  status: BuildStatus.FAILED,
                  completedAt: new Date(),
                })
                .exec();
            } catch {
              // The stream already contains the user-facing build error.
            }
            subscriber.complete();
            return;
          }

          try {
            // Persist the build result before reporting completion so clients can
            // download immediately after receiving the complete event.
            const record = await recordPromise;
            await this.buildRecordModel
              .findByIdAndUpdate(record._id, {
                status: BuildStatus.COMPLETED,
                outputFilename,
                completedAt: new Date(),
              })
              .exec();
          } catch (persistErr) {
            emit(
              'error',
              `Build succeeded but the completed build record could not be saved: ${(persistErr as Error).message}`,
            );
            subscriber.complete();
            return;
          }

          emit(
            'complete',
            `Installer created successfully for machine UUID: ${uuid}. Stored at: ${destPath}`,
          );
        } else {
          try {
            const record = await recordPromise;
            await this.buildRecordModel
              .findByIdAndUpdate(record._id, {
                status: BuildStatus.FAILED,
                completedAt: new Date(),
              })
              .exec();
          } catch {
            // The stream still reports the process failure below.
          }
          emit('error', `Build failed with exit code ${code}`);
        }

        subscriber.complete();
      });

      proc.on('error', (err) => {
        this.isBuildRunning = false;
        recordPromise.then((record) => {
          this.buildRecordModel
            .findByIdAndUpdate(record._id, {
              status: BuildStatus.FAILED,
              completedAt: new Date(),
            })
            .exec()
            .catch(() => void 0);
        });
        emit('error', `Failed to start build process: ${err.message}`);
        subscriber.complete();
      });

      // Teardown: kill the child process if the SSE client disconnects.
      return () => {
        if (!proc.killed) {
          proc.kill('SIGTERM');
        }
        this.isBuildRunning = false;
      };
    });
  }

  /**
   * Retrieves the most recent `BuildRecord` with status `completed` for the
   * given UUID that belongs to the specified user. Used by the download endpoint
   * to locate the output file.
   *
   * @param uuid   - Machine UUID used during the build.
   * @param userId - MongoDB ObjectId string of the requesting user.
   * @returns The completed `BuildRecord`, or `null` if none exists.
   */
  async getCompletedBuild(
    uuid: string,
    userId: string,
  ): Promise<BuildRecordDocument | null> {
    return this.buildRecordModel
      .findOne({
        uuid,
        userId: new Types.ObjectId(userId),
        status: BuildStatus.COMPLETED,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Returns build records owned by the authenticated user, newest first. */
  async listBuildsForUser(userId: string): Promise<BuildRecordSummary[]> {
    const records = await this.buildRecordModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // Batch-load machine names for all unique UUIDs in one query.
    const uuids = [...new Set(records.map((r) => r.uuid))];
    const machines = await this.machineModel
      .find({ userId: new Types.ObjectId(userId), uuid: { $in: uuids } })
      .select('uuid name')
      .lean()
      .exec();
    const machineNameByUuid = new Map(machines.map((m) => [m.uuid, m.name]));

    return records.map((record) => ({
      id: record._id.toString(),
      uuid: record.uuid,
      machineName: machineNameByUuid.get(record.uuid) ?? null,
      status: record.status,
      outputFilename: record.outputFilename,
      createdAt: record.createdAt ?? null,
      completedAt: record.completedAt ?? null,
      canDownload:
        record.status === BuildStatus.COMPLETED && Boolean(record.outputFilename),
    }));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the absolute path where `build-installer.ps1` stores the finished
   * installer, based on the current platform.
   *
   * Linux/macOS (cross-compile via NSIS):
   *   `src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/inventory_<uuid>.exe`
   * Windows (native MSI via WiX):
   *   `src-tauri/target/release/bundle/msi/inventory_<uuid>.msi`
   */
  private getBuiltFilePath(uuid: string): string {
    if (process.platform === 'linux' || process.platform === 'darwin') {
      return path.join(
        this.projectRoot,
        'src-tauri',
        'target',
        'x86_64-pc-windows-gnu',
        'release',
        'bundle',
        'nsis',
        `inventory_${uuid}.exe`,
      );
    }
    return path.join(
      this.projectRoot,
      'src-tauri',
      'target',
      'release',
      'bundle',
      'msi',
      `inventory_${uuid}.msi`,
    );
  }

  /** Returns the installer filename used for storage and download. */
  private getOutputFilename(uuid: string): string {
    const ext = process.platform === 'linux' || process.platform === 'darwin' ? 'exe' : 'msi';
    return `inventory_${uuid}.${ext}`;
  }

  /**
   * Reconstructs the absolute path of a stored build artifact.
   * The path is deterministic: `<buildOutputBase>/<username>/<outputFilename>`.
   * This avoids persisting absolute container paths in the database.
   */
  resolveArtifactPath(username: string, outputFilename: string): string {
    return path.join(this.buildOutputBase, username, outputFilename);
  }

  /**
   * Deletes a build record and its associated artifact file from the file system.
   * Ownership is enforced — the record must belong to the requesting user.
   */
  async deleteBuild(id: string, userId: string, username: string): Promise<void> {
    const record = await this.buildRecordModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!record) {
      throw new NotFoundException(
        'Build record not found or you do not have permission to delete it.',
      );
    }

    if (record.outputFilename) {
      try {
        const filePath = this.resolveArtifactPath(username, record.outputFilename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Proceed with deleting the database record even if file removal fails.
      }
    }

    await this.buildRecordModel.findByIdAndDelete(id).exec();
  }

  private getPowerShellCommand(): string {
    return process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  }

  private getPowerShellArgs(scriptPath: string, uuid: string): string[] {
    const args = ['-NonInteractive', '-NoProfile'];

    if (process.platform === 'win32') {
      args.push('-ExecutionPolicy', 'Bypass');
    }

    return [...args, '-File', scriptPath, '-UUID', uuid];
  }
}
