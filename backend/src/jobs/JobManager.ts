import { EventEmitter } from 'events';
import { JobModel, IJob } from '../models/Job';

export interface JobConfig {
  queueName: string;
  jobType: string;
  data: any;
  priority?: number;
  maxAttempts?: number;
  delay?: number;
  metadata?: Record<string, any>;
}

export interface JobStats {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
  jobsPerMinute: number;
}

/**
 * JobManager - Manages job lifecycle and operations
 */
export class JobManager extends EventEmitter {
  private jobHandlers: Map<string, (job: IJob) => Promise<any>> = new Map();
  private activeJobs: Map<string, IJob> = new Map();
  private stats: Map<string, JobStats> = new Map();

  constructor() {
    super();
  }

  /**
   * Create and enqueue a new job
   */
  async createJob(config: JobConfig): Promise<string> {
    const jobId = this.generateJobId();
    
    const jobData: any = {
      jobId,
      queueName: config.queueName,
      jobType: config.jobType,
      data: config.data,
      priority: config.priority || 5,
      maxAttempts: config.maxAttempts || 3,
      metadata: config.metadata || {},
    };

    // Add delay if specified
    if (config.delay) {
      jobData.processAfter = new Date(Date.now() + config.delay);
    }

    const job = await JobModel.create(jobData);
    
    console.log(`Job created: ${jobId} in queue ${config.queueName}`);
    this.emit('job:created', { jobId, queue: config.queueName });

    return jobId;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<IJob | null> {
    return JobModel.findOne({ jobId }).exec();
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(queueName: string, status: string, limit: number = 100): Promise<IJob[]> {
    return JobModel.find({ queueName, status })
      .limit(limit)
      .sort({ priority: -1, createdAt: 1 })
      .exec();
  }

  /**
   * Get next ready job from queue
   */
  async getNextJob(queueName: string): Promise<IJob | null> {
    const job = await JobModel.findOne({
      queueName,
      status: 'pending',
      $or: [
        { processAfter: { $lte: new Date() } },
        { processAfter: null }
      ]
    })
    .sort({ priority: -1, createdAt: 1 })
    .exec();

    return job;
  }

  /**
   * Mark job as processing
   */
  async markJobAsProcessing(jobId: string): Promise<void> {
    await JobModel.findOneAndUpdate(
      { jobId },
      {
        status: 'processing',
        startedAt: new Date(),
        attempts: { $inc: 1 }
      }
    ).exec();

    const job = await this.getJob(jobId);
    if (job) {
      this.activeJobs.set(jobId, job);
    }

    this.emit('job:processing', { jobId });
  }

  /**
   * Mark job as completed
   */
  async markJobAsCompleted(jobId: string, result?: any): Promise<void> {
    await JobModel.findOneAndUpdate(
      { jobId },
      {
        status: 'completed',
        result,
        completedAt: new Date(),
        progress: 100
      }
    ).exec();

    this.activeJobs.delete(jobId);
    this.emit('job:completed', { jobId, result });
  }

  /**
   * Mark job as failed
   */
  async markJobAsFailed(jobId: string, error: string): Promise<void> {
    const job = await this.getJob(jobId);
    
    if (!job) return;

    const shouldRetry = job.attempts < job.maxAttempts;

    if (shouldRetry) {
      // Schedule retry with exponential backoff
      const delay = Math.pow(2, job.attempts) * 1000; // Exponential backoff
      const processAfter = new Date(Date.now() + delay);

      await JobModel.findOneAndUpdate(
        { jobId },
        {
          status: 'pending',
          lastError: error,
          lastAttemptAt: new Date(),
          processAfter,
          progress: 0
        }
      ).exec();

      this.emit('job:retry', { jobId, attempt: job.attempts + 1, delay });
    } else {
      await JobModel.findOneAndUpdate(
        { jobId },
        {
          status: 'failed',
          lastError: error,
          failedAt: new Date(),
          lastAttemptAt: new Date()
        }
      ).exec();

      this.activeJobs.delete(jobId);
      this.emit('job:failed', { jobId, error });
    }
  }

  /**
   * Pause a job
   */
  async pauseJob(jobId: string): Promise<void> {
    await JobModel.findOneAndUpdate(
      { jobId },
      { status: 'paused' }
    ).exec();

    this.emit('job:paused', { jobId });
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: string): Promise<void> {
    await JobModel.findOneAndUpdate(
      { jobId },
      { status: 'pending' }
    ).exec();

    this.emit('job:resumed', { jobId });
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string, reason?: string): Promise<void> {
    await JobModel.findOneAndUpdate(
      { jobId },
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        metadata: { ...(await this.getJob(jobId))?.metadata, cancelReason: reason }
      }
    ).exec();

    this.activeJobs.delete(jobId);
    this.emit('job:cancelled', { jobId, reason });
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId: string, progress: number): Promise<void> {
    await JobModel.findOneAndUpdate(
      { jobId },
      { progress: Math.min(100, Math.max(0, progress)) }
    ).exec();

    const job = await this.getJob(jobId);
    if (job) {
      this.emit('job:progress', { jobId, progress });
    }
  }

  /**
   * Register a job handler
   */
  registerHandler(jobType: string, handler: (job: IJob) => Promise<any>): void {
    this.jobHandlers.set(jobType, handler);
    console.log(`Handler registered for job type: ${jobType}`);
  }

  /**
   * Get job handler
   */
  getHandler(jobType: string): ((job: IJob) => Promise<any>) | undefined {
    return this.jobHandlers.get(jobType);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<JobStats> {
    const totalJobs = await JobModel.countDocuments({ queueName });
    const pendingJobs = await JobModel.countDocuments({ queueName, status: 'pending' });
    const processingJobs = await JobModel.countDocuments({ queueName, status: 'processing' });
    const completedJobs = await JobModel.countDocuments({ queueName, status: 'completed' });
    const failedJobs = await JobModel.countDocuments({ queueName, status: 'failed' });

    // Calculate average processing time (simplified)
    const recentCompleted = await JobModel.find({
      queueName,
      status: 'completed',
      completedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    }).exec();

    let avgProcessingTime = 0;
    if (recentCompleted.length > 0) {
      const totalProcessingTime = recentCompleted.reduce((acc: number, job: IJob) => {
        const startTime = job.startedAt?.getTime() || job.createdAt.getTime();
        const endTime = job.completedAt?.getTime() || Date.now();
        return acc + (endTime - startTime);
      }, 0);

      avgProcessingTime = totalProcessingTime / recentCompleted.length;
    }

    return {
      totalJobs,
      pendingJobs,
      processingJobs,
      completedJobs,
      failedJobs,
      avgProcessingTime,
      jobsPerMinute: completedJobs / 60 // Simplified
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<Map<string, JobStats>> {
    const queues = await JobModel.distinct('queueName').exec();
    const stats = new Map<string, JobStats>();

    for (const queueName of queues) {
      stats.set(queueName, await this.getQueueStats(queueName));
    }

    return stats;
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAge);
    
    const result = await JobModel.deleteMany({
      status: { $in: ['completed', 'failed'] },
      updatedAt: { $lt: cutoff }
    }).exec();

    console.log(`Cleaned up ${result.deletedCount} old jobs`);
    this.emit('jobs:cleaned', { count: result.deletedCount });

    return result.deletedCount;
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active jobs
   */
  getActiveJobs(): Map<string, IJob> {
    return new Map(this.activeJobs);
  }
}

export const jobManager = new JobManager();
