import mongoose, { Schema, Document } from 'mongoose';

export interface ITenantConfig extends Document {
  tenantId: string;
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };
  resources: {
    maxUsers: number;
    maxStorage: number; // in GB
    maxProofsPerMonth: number;
  };
  features: {
    [key: string]: boolean;
  };
}

const TenantConfigSchema: Schema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  branding: {
    logoUrl: String,
    primaryColor: { type: String, default: '#000000' },
    secondaryColor: { type: String, default: '#ffffff' },
    fontFamily: { type: String, default: 'Inter' }
  },
  resources: {
    maxUsers: { type: Number, default: 5 },
    maxStorage: { type: Number, default: 1 },
    maxProofsPerMonth: { type: Number, default: 100 }
  },
  features: { type: Map, of: Boolean, default: {} }
}, { timestamps: true });

export default mongoose.model<ITenantConfig>('TenantConfig', TenantConfigSchema);