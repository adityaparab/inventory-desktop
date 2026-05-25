import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Machine, MachineDocument } from './machine.schema';

export interface MachineSummary {
  id: string;
  uuid: string;
  name: string;
  createdAt: Date | null;
}

/**
 * Handles machine registration.
 *
 * Uses an upsert so that re-running the setup script on the same machine
 * updates the name rather than creating a duplicate entry.
 */
@Injectable()
export class MachinesService {
  constructor(
    @InjectModel(Machine.name)
    private readonly machineModel: Model<MachineDocument>,
  ) {}

  /**
   * Registers or updates a machine entry for the given user.
   * If the user already has a record for this UUID the name is updated in place.
   */
  async registerMachine(
    userId: string,
    uuid: string,
    name: string,
  ): Promise<MachineSummary> {
    const machine = await this.machineModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId), uuid },
        { $set: { name } },
        { upsert: true, new: true },
      )
      .exec();

    return {
      id: machine._id.toString(),
      uuid: machine.uuid,
      name: machine.name,
      createdAt: machine.createdAt ?? null,
    };
  }

  /** Returns all machines registered by the given user, newest first. */
  async listMachinesForUser(userId: string): Promise<MachineSummary[]> {
    const machines = await this.machineModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return machines.map((m) => ({
      id: m._id.toString(),
      uuid: m.uuid,
      name: m.name,
      createdAt: m.createdAt ?? null,
    }));
  }
}
