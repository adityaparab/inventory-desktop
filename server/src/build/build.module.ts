import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BuildController } from './build.controller';
import { BuildService } from './build.service';
import { BuildRecord, BuildRecordSchema } from './schemas/build-record.schema';
import { Machine, MachineSchema } from '../machines/machine.schema';
import { AuthModule } from '../auth/auth.module';

/**
 * Build feature module.
 *
 * Provides:
 * - `GET /generate/:uuid`  — stream installer build progress (SSE, JWT-protected)
 * - `GET /download/:uuid`  — download the generated installer (JWT-protected)
 *
 * Imports `AuthModule` to reuse the `JwtStrategy` and `PassportModule` required
 * by `JwtAuthGuard` without re-declaring them.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BuildRecord.name, schema: BuildRecordSchema },
      { name: Machine.name, schema: MachineSchema },
    ]),
    AuthModule,
  ],
  controllers: [BuildController],
  providers: [BuildService],
})
export class BuildModule {}
