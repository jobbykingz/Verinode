import mongoose, { Schema, Document } from 'mongoose';

export interface IProofExpiration extends Document {
  proofId: number;
  expiresAt: Date;
  gracePeriodMs: number;
  remindersMs: number[];
  status: 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'RENEWED';
  lastReminderIndex?: number;
  renewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProofExpirationSchema: Schema = new Schema(
  {
    proofId: { type: Number, required: true, index: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    gracePeriodMs: { type: Number, default: 0 },
    remindersMs: { type: [Number], default: [] },
    status: {
      type: String,
      enum: ['ACTIVE', 'GRACE', 'EXPIRED', 'RENEWED'],
      default: 'ACTIVE',
      index: true,
    },
    lastReminderIndex: { type: Number },
    renewedAt: { type: Date },
  },
  { timestamps: true }
);

ProofExpirationSchema.index({ expiresAt: 1 });

export default mongoose.model<IProofExpiration>('ProofExpiration', ProofExpirationSchema);
