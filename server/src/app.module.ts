import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BuildModule } from './build/build.module';
import { AuthModule } from './auth/auth.module';
import { MachinesModule } from './machines/machines.module';
import { SetupModule } from './setup/setup.module';
import { HealthController } from './health.controller';

/**
 * Root application module.
 *
 * Configures:
 * - **ConfigModule** (global) — loads `.env` file and exposes all variables
 *   via `ConfigService`. Set `isGlobal: true` so every feature module can
 *   inject `ConfigService` without importing `ConfigModule` again.
 * - **MongoDB** connection via the `MONGODB_URI` environment variable.
 *   Example: `mongodb://user:pass@host:27017/inventory`
 *   Defaults to `mongodb://localhost:27017/inventory` for local development.
 * - **AuthModule**  — user registration, login, JWT issuance.
 * - **BuildModule** — installer build trigger (SSE) and download endpoints.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,   // makes ConfigService available everywhere without re-importing
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/inventory'),
      }),
    }),
    AuthModule,
    BuildModule,
    MachinesModule,
    SetupModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
