import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { SetupToken, SetupTokenSchema } from './setup-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SetupToken.name, schema: SetupTokenSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'changeme-jwt-secret'),
      }),
    }),
    AuthModule,
  ],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
