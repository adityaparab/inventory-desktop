import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SetupTokenDocument = SetupToken & Document;

/**
 * A short-lived, single-use token bundled inside a generated setup script.
 *
 * Lifecycle:
 * 1. Created (via GET /setup/download) — valid for 24 h.
 * 2. Exchanged (via POST /setup/exchange) — returns a 2 h JWT; token is
 *    immediately marked `exchanged: true` so it cannot be replayed.
 * 3. Revoked (via POST /setup/revoke) — called by the setup script in its
 *    finally block on both success and failure.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class SetupToken {
  /** UUID v4 token value embedded in the setup script. */
  @Prop({ required: true, unique: true, index: true })
  token: string;

  /** User who downloaded the setup script. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  /** Absolute expiry timestamp (24 h after creation). */
  @Prop({ required: true })
  expiresAt: Date;

  /** True once the setup script exchanges this token for a JWT. */
  @Prop({ default: false })
  exchanged: boolean;

  /** True once the setup script's finally block calls POST /setup/revoke. */
  @Prop({ default: false })
  revoked: boolean;

  createdAt?: Date;
}

export const SetupTokenSchema = SchemaFactory.createForClass(SetupToken);

// TTL index: MongoDB automatically deletes expired token documents.
// expireAfterSeconds=0 means the document is removed as soon as expiresAt passes.
SetupTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Allows efficient per-user token lookups (audit, revoke-all-for-user).
SetupTokenSchema.index({ userId: 1 });
