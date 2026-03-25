import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  slug: string; // URL friendly identifier
  owner: mongoose.Types.ObjectId; // User ID
  isActive: boolean;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema: Schema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
  plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' }
}, {
  timestamps: true
});

export default mongoose.model<ITenant>('Tenant', TenantSchema);
