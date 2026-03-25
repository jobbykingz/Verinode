import mongoose, { Schema, Document } from 'mongoose';

export interface IQueueJob extends Document {
  _id: any;
  id: string;
  queueName: string;
  data: any;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead-letter';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  processAfter?: Date;
  processedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QueueJobSchema: Schema = new Schema(
  {
    queueName: { type: String, required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    priority: { type: Number, default: 0, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'dead-letter'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lastError: { type: String },
    processAfter: { type: Date, index: true },
    processedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for performance
QueueJobSchema.index({ status: 1, priority: -1, createdAt: 1 });
QueueJobSchema.index({ status: 1, processAfter: 1 });

export const QueueJobModel = mongoose.model<IQueueJob>('QueueJob', QueueJobSchema);
