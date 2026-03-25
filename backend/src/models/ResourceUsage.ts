import mongoose, { Schema, Document } from 'mongoose';
import { ResourceType } from './ResourceQuota.ts';

export interface IResourceUsage extends Document {
  tenant: mongoose.Types.ObjectId;
  resourceType: ResourceType;
  currentValue: number;
  lastUsedAt: Date;
  resetAt: Date; // Keep track of when the period ends
  history: Array<{ value: number; timestamp: Date }>; // Store for billing/analytics
  updatedAt: Date;
}

const ResourceUsageSchema: Schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  resourceType: { type: String, enum: Object.values(ResourceType), required: true },
  currentValue: { type: Number, default: 0, min: 0 },
  lastUsedAt: { type: Date, default: Date.now },
  resetAt: { type: Date, required: true },
  history: [{
    value: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// A tenant can only have one usage counter per resource type
ResourceUsageSchema.index({ tenant: 1, resourceType: 1 }, { unique: true });

export default mongoose.model<IResourceUsage>('ResourceUsage', ResourceUsageSchema);
