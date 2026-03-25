import mongoose, { Schema, Document } from 'mongoose';

export enum ResourceType {
  PROOFS = 'proofs',
  STORAGE_MB = 'storage_mb',
  API_CALLS = 'api_calls',
  USERS = 'users'
}

export enum QuotaPeriod {
  DAILY = 'daily',
  MONTHLY = 'monthly',
  PERPETUAL = 'perpetual'
}

export interface IResourceQuota extends Document {
  tenant: mongoose.Types.ObjectId;
  resourceType: ResourceType;
  limit: number;
  period: QuotaPeriod;
  description?: string;
  isSoftLimit: boolean; // Allow usage past the limit with warnings?
  isActive: boolean;
  overriddenAt?: Date;
  overriddenBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceQuotaSchema: Schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  resourceType: { type: String, enum: Object.values(ResourceType), required: true },
  limit: { type: Number, default: 0, min: 0 },
  period: { type: String, enum: Object.values(QuotaPeriod), default: QuotaPeriod.MONTHLY },
  description: { type: String },
  isSoftLimit: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  overriddenBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// A tenant can only have one quota define for a specific resource type
ResourceQuotaSchema.index({ tenant: 1, resourceType: 1 }, { unique: true });

export default mongoose.model<IResourceQuota>('ResourceQuota', ResourceQuotaSchema);
