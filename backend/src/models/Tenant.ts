import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  subdomain: string;
  ownerId: string;
  status: 'active' | 'suspended' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema: Schema = new Schema({
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },
  status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'pending' }
}, { timestamps: true });

export default mongoose.model<ITenant>('Tenant', TenantSchema);