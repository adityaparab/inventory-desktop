import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Machine, MachineSchema } from './machine.schema';
import { MachinesController } from './machines.controller';
import { MachinesService } from './machines.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Machine.name, schema: MachineSchema }]),
    AuthModule,
  ],
  controllers: [MachinesController],
  providers: [MachinesService],
})
export class MachinesModule {}
