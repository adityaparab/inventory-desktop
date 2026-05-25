import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Authentication endpoints.
 *
 * All successful responses return a short-lived JWT access token that must be
 * included as `Authorization: Bearer <token>` on all protected routes.
 *
 * Token lifetime is controlled by the `JWT_EXPIRES_IN` environment variable
 * (default: `7d`).
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account.
   *
   * Creates a new user with the provided fullName, username, email, and password.
   * The password is hashed with bcrypt before being stored — it is never persisted
   * in plain text.
   *
   * On success, returns a JWT access token that can be used immediately to access
   * protected endpoints (e.g. `generate/:uuid`, `download/:uuid`).
   *
   * @param dto - Registration payload containing user details.
   * @returns An object containing the signed JWT `accessToken`.
   */
  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account. Accepts fullName, a unique username, a unique email, ' +
      'and a password (min 8 chars). Returns a JWT `accessToken` on success. ' +
      'The token can be used immediately to call protected endpoints. ' +
      'Passwords are stored as bcrypt hashes — they are never logged or returned.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Account created. Returns a signed JWT access token.',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description:
            'JWT Bearer token. Include as `Authorization: Bearer <token>` on protected requests.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — one or more request body fields failed validation.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict — the username or email address is already registered.',
  })
  async register(@Body() dto: RegisterDto): Promise<{ accessToken: string }> {
    return this.authService.register(dto);
  }

  /**
   * Log in with username or email and password.
   *
   * Accepts either the user's `username` or `email` in the `usernameOrEmail` field.
   * The comparison is case-insensitive on both fields.
   *
   * On success, returns a JWT access token for use in subsequent requests.
   * A deliberately vague error message is returned on failure to prevent
   * user-enumeration attacks.
   *
   * @param dto - Login payload with `usernameOrEmail` and `password`.
   * @returns An object containing the signed JWT `accessToken`.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with username or email',
    description:
      'Authenticates an existing user. The `usernameOrEmail` field accepts either ' +
      'the registered username (e.g. `jane_doe`) or email address (e.g. `jane@example.com`). ' +
      'The comparison is case-insensitive. Returns a JWT `accessToken` on success.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Returns a signed JWT access token.',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description:
            'JWT Bearer token. Include as `Authorization: Bearer <token>` on protected requests.',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description:
      'Unauthorized — invalid username/email or password. A vague message is returned intentionally to prevent user-enumeration.',
  })
  async login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.authService.login(dto);
  }
}
