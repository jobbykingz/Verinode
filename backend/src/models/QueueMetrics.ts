import mongoose, { Schema, Document } from 'mongoose';

export interface IQueueMetrics extends Document {
  queueName: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  deadLetterJobs: number;
  averageProcessingTime: number; // in milliseconds
  maxProcessingTime: number;
  minProcessingTime: number;
  totalProcessingTime: number;
  throughput: number; // jobs per minute
  timestamp: Date;
}

const QueueMetricsSchema: Schema = new Schema(
  {
    queueName: { type: String, required: true, index: true },
    totalJobs: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    failedJobs: { type: Number, default: 0 },
    deadLetterJobs: { type: Number, default: 0 },
    averageProcessingTime: { type: Number, default: 0 },
    maxProcessingTime: { type: Number, default: 0 },
    minProcessingTime: { type: Number, default: 0 },
    totalProcessingTime: { type: Number, default: 0 },
    throughput: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Index for time-based querying
QueueMetricsSchema.index({ queueName: 1, timestamp: -1 });

export const QueueMetricsModel = mongoose.model<IQueueMetrics>('QueueMetrics', QueueMetricsSchema);
