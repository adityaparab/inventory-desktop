import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Response, Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SetupService } from './setup.service';

class ExchangeTokenDto {
  @IsString()
  @IsNotEmpty()
  setupToken: string;
}

class RevokeTokenDto {
  @IsString()
  @IsNotEmpty()
  setupToken: string;
}

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  /**
   * Download a personalised Windows setup executable.
   *
   * Streams a self-contained .NET 8 / WinForms launcher EXE (pre-built on a
   * Windows CI runner and baked into the Docker image at build time) with a
   * per-user configuration footer appended to the end.  The footer contains
   * this server's URL and a single-use setup token.
   *
   * When the user runs the EXE on their Windows machine it will:
   *
   *   1. Read the appended footer to recover its API URL and setup token.
   *   2. Exchange the token for a short-lived JWT.
   *   3. Detect the machine UUID (via WMI) and hostname.
   *   4. Register the machine with the server.
  *   5. Trigger the machine-specific installer build and stream build events.
  *   6. Download the completed installer.
  *   7. Run the installer silently.
  *   8. Revoke the setup token in a `finally` block and delete the downloaded installer.
   */
  @UseGuards(JwtAuthGuard)
  @Get('download')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download personalised machine setup executable (.exe)' })
  @ApiResponse({
    status: 200,
    description: 'Self-contained Windows setup executable (machine-setup.exe).',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async downloadScript(
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
    @Res() res: Response,
  ): Promise<void> {
    const protocol = req.protocol || 'http';
    const host = req.get('host') ?? 'localhost:3000';
    const apiBaseUrl = `${protocol}://${host}`;

    const exeBuffer = await this.setupService.generateExe(
      req.user.userId,
      apiBaseUrl,
    );

    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="machine-setup.exe"',
    );
    res.send(exeBuffer);
  }

  /**
   * Exchange a setup token for a short-lived JWT.
   *
   * Called by the setup script immediately after it starts.  The token is
   * single-use: it is marked `exchanged` upon success and cannot be reused.
   * Returns a JWT with a 2-hour expiry that is accepted by all protected
   * endpoints (generate, download, machines, etc.).
   * 
   */
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a setup token for a short-lived JWT' })
  @ApiBody({ type: ExchangeTokenDto })
  @ApiResponse({
    status: 200,
    description: 'JWT access token (2 h expiry).',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token invalid, expired, or already used.' })
  async exchange(@Body() dto: ExchangeTokenDto) {
    return this.setupService.exchangeToken(dto.setupToken);
  }

  /**
   * Revoke a setup token.
   *
   * Called by the setup script's `finally` block on both success and failure.
   * Silently succeeds even if the token is unknown so the script never blocks
   * on revocation errors.
   */
  @Post('revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a setup token (called by setup script on exit)' })
  @ApiBody({ type: RevokeTokenDto })
  @ApiResponse({ status: 204, description: 'Token revoked (or silently ignored if unknown).' })
  async revoke(@Body() dto: RevokeTokenDto): Promise<void> {
    await this.setupService.revokeToken(dto.setupToken);
  }
}
