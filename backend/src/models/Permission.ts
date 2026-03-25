import mongoose, { Schema, Document } from 'mongoose';

export interface IPermission extends Document {
  name: string;
  description: string;
  module: string; // e.g., 'proofs', 'users', 'rbac'
  action: string; // e.g., 'create', 'read', 'update', 'delete', 'verify'
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  module: { type: String, required: true },
  action: { type: String, required: true }
}, {
  timestamps: true
});

// Compound index for uniqueness of action per module
PermissionSchema.index({ module: 1, action: 1 }, { unique: true });

export default mongoose.model<IPermission>('Permission', PermissionSchema);
