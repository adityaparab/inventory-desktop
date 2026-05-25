import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/** Number of bcrypt salt rounds. 12 is a good balance of security vs. latency. */
const BCRYPT_ROUNDS = 12;

/**
 * Handles user account creation and authentication.
 *
 * Responsible for:
 * - Registering new users (hashing passwords, detecting duplicate usernames/emails).
 * - Authenticating existing users (case-insensitive username-or-email lookup, bcrypt comparison).
 * - Signing and returning JWT access tokens.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Creates a new user account and returns a signed JWT.
   *
   * Steps:
   * 1. Check for an existing user with the same (case-insensitive) username or email.
   * 2. Hash the password with bcrypt.
   * 3. Persist the new user document.
   * 4. Sign and return a JWT access token.
   *
   * @throws ConflictException if the username or email is already taken.
   */
  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const normalizedUsername = dto.username.toLowerCase();
    const normalizedEmail = dto.email.toLowerCase();

    const existing = await this.userModel
      .findOne({
        $or: [
          { username: normalizedUsername },
          { email: normalizedEmail },
        ],
      })
      .lean()
      .exec();

    if (existing) {
      if (existing.username === normalizedUsername) {
        throw new ConflictException(
          `The username "${dto.username}" is already taken. Please choose a different one.`,
        );
      }
      throw new ConflictException(
        `The email address "${dto.email}" is already registered. Please log in or use a different email.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.userModel.create({
      fullName: dto.fullName,
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
    });

    return this.signToken(user);
  }

  /**
   * Authenticates a user by username-or-email and password, returning a signed JWT.
   *
   * The lookup is case-insensitive: both the stored username/email and the
   * provided identifier are compared in lowercase.
   *
   * @throws UnauthorizedException if no matching user is found or the password is wrong.
   *   A deliberately vague error message is used to prevent user-enumeration attacks.
   */
  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const identifier = dto.usernameOrEmail.toLowerCase();

    const user = await this.userModel
      .findOne({
        $or: [{ username: identifier }, { email: identifier }],
      })
      .exec();

    if (!user) {
      throw new UnauthorizedException(
        'Invalid credentials. Please check your username/email and password.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException(
        'Invalid credentials. Please check your username/email and password.',
      );
    }

    return this.signToken(user);
  }

  /** Constructs and signs a JWT for the given user. */
  private signToken(user: UserDocument): { accessToken: string } {
    const payload = {
      sub: (user._id as { toString(): string }).toString(),
      username: user.username,
      email: user.email,
    };
    return { accessToken: this.jwtService.sign(payload) };
  }
}
