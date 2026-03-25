import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password?: string; // Hashed password
  stellarAddress: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: false }, // Use false if only using Stellar-only auth later
  stellarAddress: { type: String, required: true, unique: true, index: true },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date }
}, {
  timestamps: true
});

export default mongoose.model<IUser>('User', UserSchema);
