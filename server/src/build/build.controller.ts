import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  BadRequestException,
  NotFoundException,
  Sse,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BuildService } from './build.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

const UUID_PATTERN =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/**
 * Build endpoints — both protected by JWT authentication.
 *
 * All requests must include an `Authorization: Bearer <token>` header with a
 * valid token obtained from `POST /auth/login` or `POST /auth/register`.
 */
@ApiTags('Build')
@ApiBearerAuth()
@Controller()
export class BuildController {
  constructor(private readonly buildService: BuildService) {}

  /**
   * Lists build records owned by the authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Get('builds')
  @ApiOperation({
    summary: 'List build records for the authenticated user',
    description:
      'Returns the current user\'s submitted UUIDs and build statuses, newest first. ' +
      'The response includes a canDownload flag for completed artifacts without exposing server file paths.',
  })
  @ApiResponse({
    status: 200,
    description: 'Build records owned by the authenticated user.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '665f4e3e5f6a5e4d8c3b2a10' },
          uuid: { type: 'string', example: '4C4C4544-0046-4210-8031-CAC04F575931' },
          status: { type: 'string', enum: ['building', 'completed', 'failed'] },
          outputFilename: {
            type: 'string',
            nullable: true,
            example: 'inventory_4C4C4544-0046-4210-8031-CAC04F575931_setup.exe',
          },
          createdAt: { type: 'string', nullable: true, format: 'date-time' },
          completedAt: { type: 'string', nullable: true, format: 'date-time' },
          canDownload: { type: 'boolean', example: true },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT Bearer token.' })
  async listBuilds(@Request() req: { user: AuthenticatedUser }) {
    return this.buildService.listBuildsForUser(req.user.userId);
  }

  /**
   * Stream a machine-specific NSIS installer build via Server-Sent Events.
   *
   * Opens a persistent SSE connection and forwards real-time output from the
   * `build-installer.ps1` PowerShell script. The client should consume the
   * event stream until the connection closes.
   *
   * Each event carries a JSON payload with two fields:
   * - `type`    — one of `"log"` | `"stderr"` | `"complete"` | `"error"`
   * - `message` — human-readable description of the event
   *
   * On `complete`, the installer has been stored at
   * `<server-root>/builds/<username>/inventory_<uuid>_setup.exe` and the build
   * record in the database has been updated with the output path.
   *
   * The build artifact can then be retrieved via `GET /download/:uuid`.
   *
   * @param uuid    - Target machine UUID (from `wmic csproduct get UUID`).
   * @param req     - Express request carrying the authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Sse('generate/:uuid')
  @ApiOperation({
    summary: 'Generate a machine-specific NSIS installer (SSE stream)',
    description: `
Starts a build for the specified machine UUID and streams progress in real time
as a **Server-Sent Events** (SSE) connection.

### UUID
Obtain the target machine's UUID on Windows by running:
\`\`\`
wmic csproduct get UUID
\`\`\`

### SSE event payload shape
Each event contains a JSON object:
| Field     | Type   | Description |
|-----------|--------|-------------|
| \`type\`    | string | \`"log"\` — stdout line; \`"stderr"\` — stderr line; \`"complete"\` — success; \`"error"\` — failure |
| \`message\` | string | Human-readable message for the event |

### On success (\`type: "complete"\`)
The generated installer is copied to:
\`\`\`
<server-root>/builds/<username>/inventory_<uuid>_setup.exe
\`\`\`
A \`BuildRecord\` is created in the database with \`status: "completed"\` and the
absolute \`outputPath\` stored for the authenticated user.

The installer can then be downloaded via **\`GET /download/:uuid\`**.

### Authentication
Requires \`Authorization: Bearer <token>\` header.
`,
  })
  @ApiParam({
    name: 'uuid',
    description: 'Target machine UUID in the format XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
    example: '4C4C4544-0046-4210-8031-CAC04F575931',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream opened. Events will be emitted until the build completes or fails.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['log', 'stderr', 'complete', 'error'],
              description: 'Category of the event',
            },
            message: {
              type: 'string',
              description: 'Human-readable event message',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — UUID does not match the expected format.' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT Bearer token.' })
  @ApiResponse({ status: 409, description: 'Conflict — another build is already in progress on this server.' })
  generate(
    @Param('uuid') uuid: string,
    @Request() req: { user: AuthenticatedUser },
  ): Observable<{ data: Record<string, string> }> {
    if (!UUID_PATTERN.test(uuid)) {
      throw new BadRequestException(
        'Invalid UUID format. Expected: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
      );
    }
    return this.buildService.build(uuid, req.user.userId, req.user.username);
  }

  /**
   * Download the installer that was generated for a specific machine UUID.
   *
   * Looks up the most recent completed `BuildRecord` matching the authenticated
   * user and the provided UUID, then streams the `.exe` file as a download.
   *
   * The build must have been triggered by the same authenticated user via
   * `GET /generate/:uuid` and must have completed successfully before this
   * endpoint can serve the file.
   *
   * @param uuid    - Machine UUID whose installer should be downloaded.
   * @param req     - Express request carrying the authenticated user.
   * @param res     - Express response used to stream the file.
   */
  @UseGuards(JwtAuthGuard)
  @Get('download/:uuid')
  @ApiOperation({
    summary: 'Download the installer generated for a machine UUID',
    description: `
Streams the NSIS installer (\`.exe\`) file that was previously generated for
the given machine UUID by the **authenticated user**.

### Prerequisites
- The authenticated user must have previously called \`GET /generate/:uuid\`
  with the same UUID and the build must have completed with \`type: "complete"\`.
- The output file must still be present on the server's file system.

### Response
The file is served as \`application/octet-stream\` with a
\`Content-Disposition: attachment\` header so browsers prompt a download.
The default filename is \`inventory_<uuid>_setup.exe\`.

### Ownership enforcement
The database query filters by both \`userId\` **and** \`uuid\`, so a user cannot
download an installer generated by a different account even if they know the UUID.

### Authentication
Requires \`Authorization: Bearer <token>\` header.
`,
  })
  @ApiParam({
    name: 'uuid',
    description: 'Machine UUID whose generated installer should be downloaded',
    example: '4C4C4544-0046-4210-8031-CAC04F575931',
  })
  @ApiResponse({
    status: 200,
    description: 'Installer file streamed as application/octet-stream.',
    headers: {
      'Content-Disposition': {
        description: 'attachment; filename="inventory_<uuid>_setup.exe"',
        schema: { type: 'string' },
      },
      'Content-Type': {
        description: 'application/octet-stream',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — UUID does not match the expected format.' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT Bearer token.' })
  @ApiResponse({
    status: 404,
    description:
      'Not Found — no completed build exists for this UUID under the authenticated account, ' +
      'or the build is still in progress / failed.',
  })
  async download(
    @Param('uuid') uuid: string,
    @Request() req: { user: AuthenticatedUser },
    @Res() res: Response,
  ): Promise<void> {
    if (!UUID_PATTERN.test(uuid)) {
      throw new BadRequestException(
        'Invalid UUID format. Expected: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
      );
    }

    const record = await this.buildService.getCompletedBuild(
      uuid,
      req.user.userId,
    );

    if (!record?.outputFilename) {
      throw new NotFoundException(
        `No completed build found for UUID "${uuid}". ` +
          'Please trigger a build via GET /generate/:uuid first and wait for it to complete.',
      );
    }

    const filePath = this.buildService.resolveArtifactPath(
      req.user.username,
      record.outputFilename,
    );
    res.download(filePath, record.outputFilename);
  }

  /**
   * Deletes a build record and its artifact file.
   */
  @UseGuards(JwtAuthGuard)
  @Delete('builds/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a build record and its artifact file' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the build record to delete' })
  @ApiResponse({ status: 204, description: 'Record and artifact deleted.' })
  @ApiResponse({ status: 400, description: 'Bad Request — invalid record ID format.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not Found — record does not exist or belongs to another user.' })
  async deleteBuildRecord(
    @Param('id') id: string,
    @Request() req: { user: AuthenticatedUser },
  ): Promise<void> {
    if (!OBJECT_ID_PATTERN.test(id)) {
      throw new BadRequestException('Invalid build record ID format.');
    }
    await this.buildService.deleteBuild(id, req.user.userId, req.user.username);
  }
}
