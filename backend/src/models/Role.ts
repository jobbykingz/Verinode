import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  name: string;
  description: string;
  parentRole?: mongoose.Types.ObjectId;
  permissions: mongoose.Types.ObjectId[];
  isSystem: boolean; // Protect system roles from deletion
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  parentRole: { type: Schema.Types.ObjectId, ref: 'Role', default: null },
  permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
  isSystem: { type: Boolean, default: false }
}, {
  timestamps: true
});

export default mongoose.model<IRole>('Role', RoleSchema);
