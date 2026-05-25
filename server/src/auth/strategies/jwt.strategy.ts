import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

/**
 * Shape of the decoded JWT payload.
 *
 * - `sub`      — MongoDB ObjectId string of the authenticated user (standard JWT subject claim)
 * - `username` — the user's unique username, embedded to avoid an extra DB lookup on every request
 * - `email`    — the user's email, embedded for the same reason
 */
export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
}

/**
 * The object attached to `request.user` after successful JWT validation.
 * Available in all controllers that use `JwtAuthGuard`.
 */
export interface AuthenticatedUser {
  userId: string;
  username: string;
  email: string;
}

/**
 * Passport strategy that validates incoming Bearer JWT tokens.
 *
 * Configured to:
 * - Extract the token from the `Authorization: Bearer <token>` header.
 * - Reject expired tokens.
 * - Verify the signature against `JWT_SECRET` (falls back to a default in
 *   development; **always set JWT_SECRET in production**).
 * - Re-validate that the subject user still exists in the database (allows
 *   account deletion to immediately revoke all existing tokens).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'changeme-jwt-secret'),
    });
  }

  /**
   * Called by Passport after the JWT signature is verified.
   * Returns the `AuthenticatedUser` object that will be attached to `request.user`.
   * Throws `UnauthorizedException` if the user no longer exists in the database.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.userModel.findById(payload.sub).lean().exec();
    if (!user) {
      throw new UnauthorizedException(
        'The account associated with this token no longer exists.',
      );
    }
    return { userId: payload.sub, username: payload.username, email: payload.email };
  }
}
