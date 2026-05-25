import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Request body for the POST /auth/register endpoint.
 *
 * All string fields are trimmed and validated server-side.
 * The password is never persisted in plain text — it is hashed with bcrypt
 * before being stored in the database.
 */
export class RegisterDto {
  /**
   * The user's full display name.
   * Does not need to be unique; used only for display purposes.
   * @example "Jane Doe"
   */
  @ApiProperty({
    example: 'Jane Doe',
    description: 'Full display name of the user. Not required to be unique.',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'fullName must be at least 2 characters' })
  @MaxLength(100, { message: 'fullName must not exceed 100 characters' })
  fullName: string;

  /**
   * Unique alphanumeric username used for login and as a namespace for
   * generated build artifacts on the server file system.
   * Only letters, digits, and underscores are allowed.
   * Stored as lowercase.
   * @example "jane_doe"
   */
  @ApiProperty({
    example: 'jane_doe',
    description:
      'Unique username (letters, digits, underscores only). Used for login and as the output directory namespace for builds.',
    minLength: 3,
    maxLength: 30,
    pattern: '^[a-zA-Z0-9_]+$',
  })
  @IsString()
  @MinLength(3, { message: 'username must be at least 3 characters' })
  @MaxLength(30, { message: 'username must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username can only contain letters, digits, and underscores',
  })
  username: string;

  /**
   * Valid email address used for login and notifications.
   * Stored as lowercase. Must be unique across all users.
   * @example "jane@example.com"
   */
  @ApiProperty({
    example: 'jane@example.com',
    description:
      'Valid email address. Used for login. Must be unique across all accounts.',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  /**
   * Plain-text password (transmitted over HTTPS, never logged or persisted).
   * Must be at least 8 characters long.
   * The server stores only a bcrypt hash of this value.
   * @example "SecureP@ss1"
   */
  @ApiProperty({
    example: 'SecureP@ss1',
    description: 'Password for the account. Minimum 8 characters. Stored as a bcrypt hash.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;
}
