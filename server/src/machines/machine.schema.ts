import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MachineDocument = Machine & Document;

/**
 * Represents a registered end-user machine.
 *
 * Created by the automated setup script when it runs on a target machine.
 * The UUID is read from WMI (Win32_ComputerSystemProduct) and the name is
 * derived from the machine's hostname.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Machine {
  /** Hardware UUID obtained from Win32_ComputerSystemProduct.UUID */
  @Prop({ required: true })
  uuid: string;

  /** Human-readable name, e.g. "DESKTOP-ABC123's computer" */
  @Prop({ required: true })
  name: string;

  /** Owner of this registration entry. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  createdAt?: Date;
}

export const MachineSchema = SchemaFactory.createForClass(Machine);

// Unique compound index enforces the upsert contract at the DB level and
// covers all { userId } queries, so no separate userId index is needed.
MachineSchema.index({ userId: 1, uuid: 1 }, { unique: true });
