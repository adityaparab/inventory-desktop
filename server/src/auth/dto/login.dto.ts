import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Request body for the POST /auth/login endpoint.
 *
 * The `usernameOrEmail` field accepts either the user's unique username or their
 * registered email address — the server will match against both fields.
 */
export class LoginDto {
  /**
   * The user's username or email address.
   * The server performs a case-insensitive lookup against both the `username`
   * and `email` fields in the database, so either value is accepted.
   * @example "jane_doe"
   * @example "jane@example.com"
   */
  @ApiProperty({
    example: 'jane_doe',
    description:
      'Username or email address of the account. Case-insensitive. ' +
      'The server accepts either the username (e.g. "jane_doe") or the email (e.g. "jane@example.com").',
  })
  @IsString()
  usernameOrEmail: string;

  /**
   * The account's plain-text password (transmitted over HTTPS, never logged).
   * @example "SecureP@ss1"
   */
  @ApiProperty({
    example: 'SecureP@ss1',
    description: 'Plain-text password for the account.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;
}
