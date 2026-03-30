import mongoose, { Schema, Document } from 'mongoose';

export interface IJob extends Document {
  _id: any;
  jobId: string;
  queueName: string;
  jobType: string;
  data: any;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  lastAttemptAt?: Date;
  processAfter?: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  result?: any;
  progress: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema: Schema = new Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    queueName: { type: String, required: true, index: true },
    jobType: { type: String, required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    priority: { 
      type: Number, 
      default: 5, 
      min: 1, 
      max: 10,
      index: true 
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'paused', 'cancelled'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lastError: { type: String },
    lastAttemptAt: { type: Date },
    processAfter: { type: Date, index: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    cancelledAt: { type: Date },
    result: { type: Schema.Types.Mixed },
    progress: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 100
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

// Indexes for performance optimization
JobSchema.index({ status: 1, priority: -1, createdAt: 1 });
JobSchema.index({ status: 1, processAfter: 1 });
JobSchema.index({ queueName: 1, status: 1, priority: -1 });
JobSchema.index({ jobType: 1, status: 1 });

// Method to check if job is ready to process
JobSchema.methods.isReady = function(): boolean {
  return (
    this.status === 'pending' &&
    (!this.processAfter || this.processAfter <= new Date())
  );
};

// Method to mark job as failed
JobSchema.methods.markFailed = function(error: string): void {
  this.status = 'failed';
  this.lastError = error;
  this.failedAt = new Date();
  this.attempts += 1;
};

// Method to mark job as completed
JobSchema.methods.markCompleted = function(result?: any): void {
  this.status = 'completed';
  this.result = result;
  this.completedAt = new Date();
  this.progress = 100;
};

// Method to update progress
JobSchema.methods.updateProgress = function(progress: number): void {
  this.progress = Math.min(100, Math.max(0, progress));
};

export const JobModel = mongoose.model<IJob>('Job', JobSchema);
