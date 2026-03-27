import { logger } from '../monitoringService';
import { EventEmitter } from 'events';

export interface WebhookJob {
  id: string;
  webhookId: string;
  deliveryId: string;
  event: any;
  webhook: any;
  attempt: number;
  priority: 'high' | 'normal' | 'low';
  scheduledAt?: Date;
  createdAt: Date;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
}

export class WebhookQueue extends EventEmitter {
  private pendingQueue: WebhookJob[] = [];
  private processingQueue: Map<string, WebhookJob> = new Map();
  private deadLetterQueue: WebhookJob[] = [];
  private processing = false;
  private batchSize = 10;
  private maxConcurrency = 5;
  private currentConcurrency = 0;
  private pollInterval = 1000;

  constructor() {
    super();
    this.startProcessing();
  }

  async enqueue(job: Partial<WebhookJob>): Promise<string> {
    const fullJob: WebhookJob = {
      id: this.generateJobId(),
      webhookId: job.webhookId!,
      deliveryId: job.deliveryId!,
      event: job.event!,
      webhook: job.webhook!,
      attempt: job.attempt || 1,
      priority: job.priority || 'normal',
      createdAt: new Date(),
      ...job
    };

    this.insertJobByPriority(fullJob);
    this.emit('jobEnqueued', fullJob);
    
    logger.info(`Webhook job enqueued: ${fullJob.id}`, {
      webhookId: fullJob.webhookId,
      attempt: fullJob.attempt
    });

    return fullJob.id;
  }

  async enqueueWithDelay(job: Partial<WebhookJob>, delayMs: number): Promise<string> {
    const scheduledAt = new Date(Date.now() + delayMs);
    return this.enqueue({ ...job, scheduledAt });
  }

  private insertJobByPriority(job: WebhookJob): void {
    if (job.scheduledAt && job.scheduledAt > new Date()) {
      this.pendingQueue.push(job);
    } else {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      let insertIndex = this.pendingQueue.findIndex(j => 
        priorityOrder[j.priority] > priorityOrder[job.priority]
      );
      
      if (insertIndex === -1) {
        insertIndex = this.pendingQueue.length;
      }
      
      this.pendingQueue.splice(insertIndex, 0, job);
    }
  }

  private startProcessing(): void {
    setInterval(() => {
      if (!this.processing && this.currentConcurrency < this.maxConcurrency) {
        this.processBatch();
      }
    }, this.pollInterval);
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.currentConcurrency >= this.maxConcurrency) {
      return;
    }

    this.processing = true;
    
    try {
      const jobs = this.getReadyJobs();
      
      if (jobs.length === 0) {
        return;
      }

      this.currentConcurrency += jobs.length;
      
      await Promise.all(
        jobs.map(job => this.processJob(job))
      );
    } catch (error) {
      logger.error('Error processing webhook batch', { error });
    } finally {
      this.processing = false;
    }
  }

  private getReadyJobs(): WebhookJob[] {
    const now = new Date();
    const readyJobs = this.pendingQueue.filter(job => 
      !job.scheduledAt || job.scheduledAt <= now
    );

    const jobsToProcess = readyJobs.slice(0, this.batchSize);
    
    jobsToProcess.forEach(job => {
      const index = this.pendingQueue.indexOf(job);
      if (index > -1) {
        this.pendingQueue.splice(index, 1);
      }
      this.processingQueue.set(job.id, job);
    });

    return jobsToProcess;
  }

  private async processJob(job: WebhookJob): Promise<void> {
    try {
      this.emit('jobStarted', job);
      
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Webhook processing timeout'));
        }, 30000);

        this.emit('processWebhook', job, (error: Error | null, result?: any) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });

      this.processingQueue.delete(job.id);
      this.emit('jobCompleted', job, result);
      
      logger.info(`Webhook job completed: ${job.id}`, {
        webhookId: job.webhookId,
        attempt: job.attempt
      });
    } catch (error) {
      this.processingQueue.delete(job.id);
      this.emit('jobFailed', job, error);
      
      logger.error(`Webhook job failed: ${job.id}`, {
        webhookId: job.webhookId,
        attempt: job.attempt,
        error: error.message
      });
    } finally {
      this.currentConcurrency--;
    }
  }

  async moveToDeadLetterQueue(job: WebhookJob, error?: Error): Promise<void> {
    const deadLetterJob = { ...job };
    this.deadLetterQueue.push(deadLetterJob);
    
    this.processingQueue.delete(job.id);
    this.emit('jobDeadLetter', job, error);
    
    logger.error(`Webhook job moved to dead letter queue: ${job.id}`, {
      webhookId: job.webhookId,
      attempts: job.attempt,
      error: error?.message
    });
  }

  async retryDeadLetterJob(jobId: string): Promise<void> {
    const jobIndex = this.deadLetterQueue.findIndex(job => job.id === jobId);
    if (jobIndex === -1) {
      throw new Error(`Job not found in dead letter queue: ${jobId}`);
    }

    const job = this.deadLetterQueue.splice(jobIndex, 1)[0];
    job.attempt = 1;
    job.scheduledAt = undefined;
    
    await this.enqueue(job);
    logger.info(`Dead letter job retrying: ${jobId}`);
  }

  async getQueueStats(): Promise<QueueStats> {
    return {
      pending: this.pendingQueue.length,
      processing: this.processingQueue.size,
      completed: this.getCompletedCount(),
      failed: this.getFailedCount(),
      deadLetter: this.deadLetterQueue.length
    };
  }

  private getCompletedCount(): number {
    return 0;
  }

  private getFailedCount(): number {
    return 0;
  }

  async getPendingJobs(limit: number = 50): Promise<WebhookJob[]> {
    return this.pendingQueue.slice(0, limit);
  }

  async getProcessingJobs(): Promise<WebhookJob[]> {
    return Array.from(this.processingQueue.values());
  }

  async getDeadLetterJobs(limit: number = 50): Promise<WebhookJob[]> {
    return this.deadLetterQueue.slice(0, limit);
  }

  async clearQueue(): Promise<void> {
    this.pendingQueue = [];
    this.processingQueue.clear();
    this.deadLetterQueue = [];
    logger.info('Webhook queue cleared');
  }

  async pauseProcessing(): Promise<void> {
    this.processing = true;
    logger.info('Webhook queue processing paused');
  }

  async resumeProcessing(): Promise<void> {
    this.processing = false;
    logger.info('Webhook queue processing resumed');
  }

  async updateConcurrency(maxConcurrency: number): Promise<void> {
    this.maxConcurrency = maxConcurrency;
    logger.info(`Webhook queue concurrency updated: ${maxConcurrency}`);
  }

  async updateBatchSize(batchSize: number): Promise<void> {
    this.batchSize = batchSize;
    logger.info(`Webhook queue batch size updated: ${batchSize}`);
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getJobById(jobId: string): Promise<WebhookJob | null> {
    const pendingJob = this.pendingQueue.find(job => job.id === jobId);
    if (pendingJob) return pendingJob;

    const processingJob = this.processingQueue.get(jobId);
    if (processingJob) return processingJob;

    const deadLetterJob = this.deadLetterQueue.find(job => job.id === jobId);
    if (deadLetterJob) return deadLetterJob;

    return null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const pendingIndex = this.pendingQueue.findIndex(job => job.id === jobId);
    if (pendingIndex > -1) {
      this.pendingQueue.splice(pendingIndex, 1);
      this.emit('jobCancelled', { id: jobId });
      logger.info(`Webhook job cancelled: ${jobId}`);
      return true;
    }

    return false;
  }

  async prioritizeJob(jobId: string, priority: 'high' | 'normal' | 'low'): Promise<boolean> {
    const job = await this.getJobById(jobId);
    if (!job || job.priority === priority) {
      return false;
    }

    const pendingIndex = this.pendingQueue.findIndex(j => j.id === jobId);
    if (pendingIndex > -1) {
      this.pendingQueue.splice(pendingIndex, 1);
      job.priority = priority;
      this.insertJobByPriority(job);
      logger.info(`Webhook job prioritized: ${jobId} to ${priority}`);
      return true;
    }

    return false;
  }
}
