import { EventEmitter } from 'events';

export interface QueueJob {
  id: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface QueueConfig {
  concurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

export class QueueService extends EventEmitter {
  private queues: Map<string, QueueJob[]> = new Map();
  private processing: Map<string, Set<string>> = new Map();
  private configs: Map<string, QueueConfig> = new Map();
  private handlers: Map<string, (job: QueueJob) => Promise<void>> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.startProcessing();
  }

  /**
   * Register a queue with configuration
   */
  registerQueue(name: string, config: QueueConfig = {}): void {
    if (!this.queues.has(name)) {
      this.queues.set(name, []);
      this.processing.set(name, new Set());
      this.configs.set(name, {
        concurrency: 5,
        retryAttempts: 3,
        retryDelay: 1000,
        timeout: 30000,
        ...config
      });
    }
  }

  /**
   * Add a job to a queue
   */
  async addJob(
    queueName: string,
    data: any,
    options: {
      priority?: number;
      attempts?: number;
      backoff?: { type: string; delay: number };
    } = {}
  ): Promise<string> {
    this.registerQueue(queueName);

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: QueueJob = {
      id: jobId,
      data,
      priority: options.priority || 3,
      attempts: 0,
      maxAttempts: options.attempts || 3,
      createdAt: new Date()
    };

    const queue = this.queues.get(queueName)!;
    queue.push(job);
    
    // Sort by priority
    queue.sort((a, b) => a.priority - b.priority);

    this.emit('job:added', { queue: queueName, job });

    return jobId;
  }

  /**
   * Remove a job from a queue
   */
  async removeJob(queueName: string, jobId?: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    if (jobId) {
      const index = queue.findIndex(j => j.id === jobId);
      if (index > -1) {
        queue.splice(index, 1);
        return true;
      }
    } else {
      // Clear all jobs
      queue.length = 0;
      return true;
    }

    return false;
  }

  /**
   * Register a job handler for a queue
   */
  registerHandler(queueName: string, handler: (job: QueueJob) => Promise<void>): void {
    this.handlers.set(queueName, handler);
  }

  /**
   * Get queue status
   */
  getQueueStatus(queueName: string): {
    pending: number;
    processing: number;
    total: number;
  } | null {
    const queue = this.queues.get(queueName);
    const processing = this.processing.get(queueName);

    if (!queue || !processing) return null;

    return {
      pending: queue.length,
      processing: processing.size,
      total: queue.length + processing.size
    };
  }

  /**
   * Get all queue statuses
   */
  getAllQueueStatuses(): Record<string, { pending: number; processing: number; total: number }> {
    const statuses: Record<string, { pending: number; processing: number; total: number }> = {};
    
    for (const [name] of this.queues) {
      statuses[name] = this.getQueueStatus(name)!;
    }

    return statuses;
  }

  /**
   * Pause a queue
   */
  pauseQueue(queueName: string): void {
    const interval = this.intervals.get(queueName);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(queueName);
    }
  }

  /**
   * Resume a queue
   */
  resumeQueue(queueName: string): void {
    this.startQueueProcessing(queueName);
  }

  /**
   * Start processing all queues
   */
  private startProcessing(): void {
    // Process queues every 100ms
    setInterval(() => {
      for (const [queueName] of this.queues) {
        this.processQueue(queueName);
      }
    }, 100);
  }

  /**
   * Start processing a specific queue
   */
  private startQueueProcessing(queueName: string): void {
    if (this.intervals.has(queueName)) return;

    const interval = setInterval(() => {
      this.processQueue(queueName);
    }, 100);

    this.intervals.set(queueName, interval);
  }

  /**
   * Process jobs in a queue
   */
  private async processQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    const processing = this.processing.get(queueName);
    const config = this.configs.get(queueName);
    const handler = this.handlers.get(queueName);

    if (!queue || !processing || !config) return;

    // Check concurrency limit
    if (processing.size >= config.concurrency!) return;

    // Get next job
    const job = queue.shift();
    if (!job) return;

    // Check if handler exists
    if (!handler) {
      // Put job back if no handler
      queue.unshift(job);
      return;
    }

    // Mark as processing
    processing.add(job.id);
    job.processedAt = new Date();
    job.attempts++;

    this.emit('job:started', { queue: queueName, job });

    try {
      // Process with timeout
      await this.processWithTimeout(handler, job, config.timeout!);
      
      job.completedAt = new Date();
      processing.delete(job.id);
      
      this.emit('job:completed', { queue: queueName, job });
    } catch (error) {
      job.failedAt = new Date();
      job.error = error instanceof Error ? error.message : 'Unknown error';
      
      processing.delete(job.id);

      // Retry if attempts remain
      if (job.attempts < job.maxAttempts) {
        const delay = config.retryDelay! * Math.pow(2, job.attempts - 1); // Exponential backoff
        setTimeout(() => {
          queue.push(job);
        }, delay);
        
        this.emit('job:retrying', { queue: queueName, job, delay });
      } else {
        this.emit('job:failed', { queue: queueName, job, error });
      }
    }
  }

  /**
   * Process job with timeout
   */
  private processWithTimeout(
    handler: (job: QueueJob) => Promise<void>,
    job: QueueJob,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Job ${job.id} timed out after ${timeout}ms`));
      }, timeout);

      handler(job)
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Clean up completed jobs older than specified age
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    
    for (const [, queue] of this.queues) {
      // Remove old completed/failed jobs from memory
      // In production, you'd archive these to a database
    }
  }
}

export const queueService = new QueueService();
