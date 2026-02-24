import mongoose, { Schema, Document } from 'mongoose';

export interface IRenewal extends Document {
  proofId: number;
  initiatedAt: Date;
  completedAt?: Date;
  status: 'INITIATED' | 'COMPLETED' | 'FAILED';
  previousExpiresAt: Date;
  newExpiresAt: Date;
  method: 'MANUAL' | 'AUTO';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RenewalSchema: Schema = new Schema(
  {
    proofId: { type: Number, required: true, index: true },
    initiatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    status: { type: String, enum: ['INITIATED', 'COMPLETED', 'FAILED'], default: 'INITIATED' },
    previousExpiresAt: { type: Date, required: true },
    newExpiresAt: { type: Date, required: true },
    method: { type: String, enum: ['MANUAL', 'AUTO'], default: 'MANUAL' },
    notes: { type: String },
  },
  { timestamps: true }
);

RenewalSchema.index({ proofId: 1, initiatedAt: -1 });

export default mongoose.model<IRenewal>('Renewal', RenewalSchema);
