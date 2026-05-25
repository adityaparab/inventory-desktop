import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guards a route by requiring a valid JWT Bearer token in the
 * `Authorization` header.
 *
 * Usage:
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('protected-route')
 * someHandler(@Request() req) {
 *   // req.user is { userId, username, email }
 * }
 * ```
 *
 * Returns HTTP 401 Unauthorized if:
 * - No token is provided.
 * - The token signature is invalid or the token has expired.
 * - The user referenced by the token's `sub` claim no longer exists.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
