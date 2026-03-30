import { EventEmitter } from 'events';
import { JobManager, jobManager } from './JobManager';
import { JobModel, IJob } from '../models/Job';

export interface ProcessorConfig {
  concurrency: number;
  pollInterval: number;
  maxJobsPerCycle: number;
  enablePriority: boolean;
}

export interface ProcessingStats {
  totalProcessed: number;
  successfulJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
  lastProcessedAt: Date | null;
}

/**
 * QueueProcessor - Processes jobs from queues with priority handling
 */
export class QueueProcessor extends EventEmitter {
  private config: ProcessorConfig;
  private jobManager: JobManager;
  private isRunning: boolean = false;
  private processingLoop: NodeJS.Timeout | null = null;
  private activeProcessors: Map<string, Promise<void>> = new Map();
  private stats: Map<string, ProcessingStats> = new Map();

  constructor(jobManagerInstance?: JobManager, config?: Partial<ProcessorConfig>) {
    super();
    
    this.jobManager = jobManagerInstance || jobManager;
    this.config = {
      concurrency: 5,
      pollInterval: 1000, // 1 second
      maxJobsPerCycle: 10,
      enablePriority: true,
      ...config,
    };
  }

  /**
   * Start the queue processor
   */
  start(): void {
    if (this.isRunning) {
      console.log('Queue processor is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Queue processor started with concurrency: ${this.config.concurrency}`);
    this.emit('started');

    // Start processing loop
    this.processingLoop = setInterval(() => {
      this.processQueues();
    }, this.config.pollInterval);
  }

  /**
   * Stop the queue processor
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.processingLoop) {
      clearInterval(this.processingLoop);
      this.processingLoop = null;
    }

    console.log('Queue processor stopped');
    this.emit('stopped');
  }

  /**
   * Process all queues
   */
  private async processQueues(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Get all unique queue names
      const queues = await JobModel.distinct('queueName', {
        status: { $in: ['pending', 'processing'] }
      }).exec();

      // Process each queue
      for (const queueName of queues) {
        await this.processQueue(queueName);
      }
    } catch (error) {
      console.error('Error in queue processing loop:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process a specific queue
   */
  private async processQueue(queueName: string): Promise<void> {
    if (this.activeProcessors.size >= this.config.concurrency) {
      return; // At capacity
    }

    try {
      // Get next jobs from queue
      const jobs = await this.getNextJobs(queueName);

      for (const job of jobs) {
        if (this.activeProcessors.size >= this.config.concurrency) {
          break; // At capacity
        }

        // Start processing job
        this.processJob(job);
      }
    } catch (error) {
      console.error(`Error processing queue ${queueName}:`, error);
      this.emit('queue:error', { queueName, error });
    }
  }

  /**
   * Get next jobs from queue
   */
  private async getNextJobs(queueName: string): Promise<IJob[]> {
    const query: any = {
      queueName,
      status: 'pending',
      $or: [
        { processAfter: { $lte: new Date() } },
        { processAfter: null }
      ]
    };

    const sortOptions: any = {};
    
    if (this.config.enablePriority) {
      sortOptions.priority = -1; // Higher priority first
    }
    sortOptions.createdAt = 1; // Older jobs first

    return JobModel.find(query)
      .sort(sortOptions)
      .limit(this.config.maxJobsPerCycle)
      .exec();
  }

  /**
   * Process a single job
   */
  private async processJob(job: IJob): Promise<void> {
    const jobId = job.jobId;
    const startTime = Date.now();

    try {
      // Mark job as processing
      await this.jobManager.markJobAsProcessing(jobId);
      this.emit('job:start', { jobId, jobType: job.jobType });

      // Get handler for job type
      const handler = this.jobManager.getHandler(job.jobType);
      
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.jobType}`);
      }

      // Execute job handler
      const result = await handler(job);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Mark job as completed
      await this.jobManager.markJobAsCompleted(jobId, result);
      this.updateStats(job.queueName, { success: true, processingTime });
      
      this.emit('job:complete', { 
        jobId, 
        result,
        processingTime 
      });

      console.log(`Job completed: ${jobId} in ${processingTime}ms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const processingTime = Date.now() - startTime;

      // Mark job as failed (will handle retry logic)
      await this.jobManager.markJobAsFailed(jobId, errorMessage);
      this.updateStats(job.queueName, { success: false, processingTime });

      this.emit('job:error', { 
        jobId, 
        error: errorMessage,
        attempts: job.attempts + 1
      });

      console.error(`Job failed: ${jobId} - ${errorMessage}`);
    } finally {
      this.activeProcessors.delete(jobId);
    }
  }

  /**
   * Update processing statistics
   */
  private updateStats(
    queueName: string,
    data: { success: boolean; processingTime: number }
  ): void {
    const stats = this.stats.get(queueName) || {
      totalProcessed: 0,
      successfulJobs: 0,
      failedJobs: 0,
      avgProcessingTime: 0,
      lastProcessedAt: null,
    };

    stats.totalProcessed++;
    stats.lastProcessedAt = new Date();

    if (data.success) {
      stats.successfulJobs++;
    } else {
      stats.failedJobs++;
    }

    // Update average processing time
    const totalJobs = stats.totalProcessed;
    const oldAvg = stats.avgProcessingTime;
    stats.avgProcessingTime = ((oldAvg * (totalJobs - 1)) + data.processingTime) / totalJobs;

    this.stats.set(queueName, stats);
  }

  /**
   * Get processing statistics
   */
  getStats(queueName?: string): ProcessingStats | Map<string, ProcessingStats> {
    if (queueName) {
      return this.stats.get(queueName) || {
        totalProcessed: 0,
        successfulJobs: 0,
        failedJobs: 0,
        avgProcessingTime: 0,
        lastProcessedAt: null,
      };
    }

    return new Map(this.stats);
  }

  /**
   * Get active job count
   */
  getActiveJobCount(): number {
    return this.activeProcessors.size;
  }

  /**
   * Check if processor is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const queueProcessor = new QueueProcessor();
