import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Mongoose document type for the BuildRecord entity.
 */
export type BuildRecordDocument = BuildRecord & Document;

/**
 * Possible lifecycle states for a build job.
 *
 * - `building`  — the build process has been started and is currently running
 * - `completed` — the build finished successfully and the output file is available
 * - `failed`    — the build process exited with a non-zero code or encountered an error
 */
export enum BuildStatus {
  BUILDING = 'building',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Persists metadata about a machine-specific installer build.
 *
 * Each record ties a machine UUID to a specific user and tracks the lifecycle
 * of a single build invocation. On successful completion the record stores the
 * absolute path of the generated installer on the server's file system, allowing
 * the download endpoint to locate and stream the file.
 *
 * DB design rationale:
 * - Compound index `{ userId, uuid }` covers the primary lookup pattern.
 * - `outputPath` is intentionally absent; the artifact path is fully
 *   reconstructable as `<buildOutputBase>/<username>/<outputFilename>` and
 *   storing an absolute container path would become stale across redeploys.
 * - `completedAt` is separate from `createdAt` so callers can measure duration.
 * - `{ userId, status }` secondary index covers the dashboard list query.
 *
 * File storage convention:
 *   `<buildOutputBase>/<username>/inventory_<uuid>.exe`
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class BuildRecord {
  /** The target machine UUID that was locked into the installer. */
  @Prop({ required: true })
  uuid: string;

  /** Reference to the User who triggered the build. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  /** Current lifecycle state of the build. */
  @Prop({ enum: BuildStatus, default: BuildStatus.BUILDING })
  status: BuildStatus;

  /** Basename of the installer file (e.g. `inventory_<uuid>.exe`). */
  @Prop({ default: null })
  outputFilename: string | null;

  /** Timestamp at which the build finished (success or failure). */
  @Prop({ default: null })
  completedAt: Date | null;

  /** Timestamp added by the schema's timestamps option when the record is created. */
  createdAt?: Date;
}

export const BuildRecordSchema = SchemaFactory.createForClass(BuildRecord);

// Primary lookup: owner + UUID (download and status endpoints).
BuildRecordSchema.index({ userId: 1, uuid: 1 });
// Secondary: owner + status (dashboard list, often filtered by status in the UI).
BuildRecordSchema.index({ userId: 1, status: 1 });
