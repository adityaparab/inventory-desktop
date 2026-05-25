import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from './schemas/user.schema';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Authentication feature module.
 *
 * Provides:
 * - `POST /auth/register` — create a new user account
 * - `POST /auth/login`    — authenticate and receive a JWT
 *
 * Exports `JwtStrategy` and `PassportModule` so that other modules (e.g.
 * `BuildModule`) can use `JwtAuthGuard` without re-declaring the strategy.
 *
 * Configuration via environment variables:
 * - `JWT_SECRET`     — secret used to sign/verify tokens (required in production)
 * - `JWT_EXPIRES_IN` — token lifetime (default: `7d`)
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'changeme-jwt-secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
