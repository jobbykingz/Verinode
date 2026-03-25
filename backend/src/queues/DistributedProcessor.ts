import { PriorityQueue } from './PriorityQueue';
import { DeadLetterQueue } from './DeadLetterQueue';
import { QueueJobModel, IQueueJob } from '../models/QueueJob';
import { EventEmitter } from 'events';

export class DistributedProcessor extends EventEmitter {
  private queueName: string;
  private priorityQueue: PriorityQueue;
  private dlq: DeadLetterQueue;
  private concurrency: number;
  private handler: (job: IQueueJob) => Promise<void>;
  private isProcessing: boolean = false;
  private activeJobs: Set<string> = new Set();
  private timer: NodeJS.Timeout | null = null;
  private timeout: number = 30000; // 30s default timeout
  private pollInterval: number = 100; // 100ms default poll

  constructor(
    queueName: string,
    handler: (job: IQueueJob) => Promise<void>,
    options: {
      concurrency?: number;
      timeout?: number;
      pollInterval?: number;
    } = {}
  ) {
    super();
    this.queueName = queueName;
    this.priorityQueue = new PriorityQueue(queueName);
    this.dlq = new DeadLetterQueue(queueName);
    this.handler = handler;
    this.concurrency = options.concurrency || 5;
    this.timeout = options.timeout || 30000;
    this.pollInterval = options.pollInterval || 100;
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.process();
    this.emit('started', { queue: this.queueName, concurrency: this.concurrency });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (!this.isProcessing) return;
    this.isProcessing = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.emit('stopped', { queue: this.queueName });
  }

  /**
   * Main processing loop
   */
  private async process(): Promise<void> {
    if (!this.isProcessing) return;

    // Check concurrency limit
    if (this.activeJobs.size >= this.concurrency) {
      this.timer = setTimeout(() => this.process(), this.pollInterval);
      return;
    }

    try {
      const job = await this.priorityQueue.pop();

      if (job) {
        this.activeJobs.add(job._id.toString());
        this.executeJob(job);
        
        // Try to get another job immediately if we have capacity
        if (this.activeJobs.size < this.concurrency) {
          setImmediate(() => this.process());
          return;
        }
      }
    } catch (error) {
      console.error(`Error in distributed processor for ${this.queueName}:`, error);
    }

    // Schedule next poll
    this.timer = setTimeout(() => this.process(), this.pollInterval);
  }

  /**
   * Run the handler on a single job
   */
  private async executeJob(job: IQueueJob): Promise<void> {
    const jobIdStr = job._id.toString();

    try {
      // Execute with timeout
      await Promise.race([
        this.handler(job),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Job execution timeout')), this.timeout)
        )
      ]);

      // Job completed successfully
      await QueueJobModel.findByIdAndUpdate(jobIdStr, {
        status: 'completed',
        completedAt: new Date(),
      });
      
      this.emit('completed', job);
    } catch (error) {
      const lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Job ${jobIdStr} failed:`, lastError);

      const updatedJob = await QueueJobModel.findByIdAndUpdate(
        jobIdStr,
        {
          $inc: { attempts: 1 },
          lastError,
          status: 'failed',
          failedAt: new Date(),
        },
        { new: true }
      );

      if (updatedJob) {
        if (updatedJob.attempts < updatedJob.maxAttempts) {
          // Re-queue for retry (could implement exponential backoff here)
          const backoffDelay = 1000 * Math.pow(2, updatedJob.attempts - 1);
          setTimeout(async () => {
            await this.priorityQueue.addJob(
              updatedJob.data, 
              updatedJob.priority, 
              updatedJob.maxAttempts
            );
          }, backoffDelay);
          
          this.emit('failed', { job: updatedJob, retryIn: backoffDelay });
        } else {
          // Send to DLQ
          await this.dlq.addJob(jobIdStr, lastError);
          this.emit('failed:dead-letter', updatedJob);
        }
      }
    } finally {
      this.activeJobs.delete(jobIdStr);
    }
  }

  /**
   * Set concurrency level (for auto-scaling)
   */
  setConcurrency(value: number): void {
    const old = this.concurrency;
    this.concurrency = value;
    if (this.concurrency > old && this.isProcessing) {
      // Trigger processing loop for extra capacity
      setImmediate(() => this.process());
    }
  }

  /**
   * Get processor stats
   */
  getStats(): any {
    return {
      queueName: this.queueName,
      concurrency: this.concurrency,
      activeJobs: this.activeJobs.size,
      isRunning: this.isProcessing,
    };
  }
}
