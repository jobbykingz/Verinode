import mongoose, { Schema, Document } from 'mongoose';

export interface IUserRole extends Document {
  user: mongoose.Types.ObjectId;
  role: mongoose.Types.ObjectId;
  assignedAt: Date;
  assignedBy?: mongoose.Types.ObjectId;
}

const UserRoleSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: { createdAt: 'assignedAt', updatedAt: false }
});

// A user can have multiple roles, but not the same role twice
UserRoleSchema.index({ user: 1, role: 1 }, { unique: true });

export default mongoose.model<IUserRole>('UserRole', UserRoleSchema);
