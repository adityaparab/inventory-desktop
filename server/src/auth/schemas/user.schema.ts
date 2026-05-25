import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Mongoose document type for the User entity.
 * Combines the User class with Mongoose's Document interface, giving access
 * to methods like `.save()`, `._id`, etc.
 */
export type UserDocument = User & Document;

/**
 * User entity stored in MongoDB.
 *
 * Fields:
 * - `fullName`     — display name of the user (not required to be unique)
 * - `username`     — unique, lowercase, alphanumeric identifier used for login
 *                    and as a namespace for generated build artifacts
 * - `email`        — unique, lowercase email address used for login
 * - `passwordHash` — bcrypt hash of the user's password (never stored in plain text)
 *
 * Timestamps (`createdAt`, `updatedAt`) are added automatically by Mongoose.
 */
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
