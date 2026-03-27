import mongoose, { Schema, Document } from 'mongoose';

export interface ICollaborationSession extends Document {
  proofId: string;
  activeUsers: {
    userId: string;
    socketId: string;
    accessLevel: 'VIEW' | 'COMMENT' | 'EDIT';
    lastActive: Date;
  }[];
  documentState: any;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const CollaborationSessionSchema: Schema = new Schema({
  proofId: { type: String, required: true, unique: true, index: true },
  activeUsers: [{
    userId: { type: String, required: true },
    socketId: { type: String, required: true },
    accessLevel: { type: String, enum: ['VIEW', 'COMMENT', 'EDIT'], default: 'VIEW' },
    lastActive: { type: Date, default: Date.now }
  }],
  documentState: { type: Schema.Types.Mixed, default: {} },
  version: { type: Number, default: 1 }
}, {
  timestamps: true
});

// Auto-cleanup inactive users (e.g., missed disconnects)
CollaborationSessionSchema.methods.cleanupInactive = function(timeoutMs = 5 * 60 * 1000) {
  const cutoff = new Date(Date.now() - timeoutMs);
  this.activeUsers = this.activeUsers.filter((user: any) => user.lastActive > cutoff);
  return this.save();
};

export const CollaborationSession = mongoose.model<ICollaborationSession>('CollaborationSession', CollaborationSessionSchema);
export default CollaborationSession;