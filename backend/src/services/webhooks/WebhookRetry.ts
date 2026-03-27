import { logger } from '../monitoringService';
import { WebhookQueue, WebhookJob } from './WebhookQueue';
import { EventEmitter } from 'events';

export interface RetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  jitterEnabled: boolean;
  retryableErrors: string[];
}

export interface RetryAttempt {
  attempt: number;
  delay: number;
  timestamp: Date;
  error?: string;
}

export interface DeadLetterJob extends WebhookJob {
  originalError?: string;
  retryAttempts: RetryAttempt[];
  deadLetterReason: string;
  movedAt: Date;
}

export class WebhookRetry extends EventEmitter {
  private queue: WebhookQueue;
  private deadLetterQueue: DeadLetterJob[] = [];
  private retryPolicies: Map<string, RetryPolicy> = new Map();

  constructor() {
    super();
    this.queue = new WebhookQueue();
    this.setupDefaultPolicies();
  }

  private setupDefaultPolicies(): void {
    const defaultPolicy: RetryPolicy = {
      maxRetries: 5,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 300000,
      jitterEnabled: true,
      retryableErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNREFUSED',
        'EHOSTUNREACH',
        'NETWORK_ERROR',
        'TIMEOUT',
        'RATE_LIMITED'
      ]
    };

    this.retryPolicies.set('default', defaultPolicy);

    const aggressivePolicy: RetryPolicy = {
      ...defaultPolicy,
      maxRetries: 10,
      initialDelay: 500,
      maxDelay: 600000
    };
    this.retryPolicies.set('aggressive', aggressivePolicy);

    const conservativePolicy: RetryPolicy = {
      ...defaultPolicy,
      maxRetries: 3,
      initialDelay: 2000,
      maxDelay: 120000
    };
    this.retryPolicies.set('conservative', conservativePolicy);
  }

  calculateDelay(attempt: number, policy: RetryPolicy): number {
    let delay = policy.initialDelay * Math.pow(policy.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, policy.maxDelay);

    if (policy.jitterEnabled) {
      delay = this.addJitter(delay);
    }

    return delay;
  }

  private addJitter(delay: number): number {
    const jitterFactor = 0.1;
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }

  isRetryableError(error: Error, policy: RetryPolicy): boolean {
    const errorMessage = error.message.toUpperCase();
    
    return policy.retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toUpperCase())
    );
  }

  async shouldRetry(job: WebhookJob, error: Error, policy: RetryPolicy): Promise<boolean> {
    if (job.attempt >= policy.maxRetries) {
      return false;
    }

    if (!this.isRetryableError(error, policy)) {
      return false;
    }

    return true;
  }

  async scheduleRetry(job: WebhookJob, error: Error, policyName: string = 'default'): Promise<void> {
    const policy = this.retryPolicies.get(policyName) || this.retryPolicies.get('default')!;
    
    if (!(await this.shouldRetry(job, error, policy))) {
      await this.moveToDeadLetterQueue(job, error);
      return;
    }

    const delay = this.calculateDelay(job.attempt, policy);
    const retryJob = { ...job, attempt: job.attempt + 1 };

    await this.queue.enqueueWithDelay(retryJob, delay);

    const retryAttempt: RetryAttempt = {
      attempt: job.attempt,
      delay,
      timestamp: new Date(),
      error: error.message
    };

    this.emit('retryScheduled', {
      jobId: job.id,
      attempt: job.attempt,
      delay,
      error: error.message
    });

    logger.info(`Webhook retry scheduled: ${job.id}`, {
      webhookId: job.webhookId,
      attempt: job.attempt,
      nextAttemptIn: delay,
      error: error.message
    });
  }

  async moveToDeadLetterQueue(job: WebhookJob, error: Error): Promise<void> {
    const deadLetterJob: DeadLetterJob = {
      ...job,
      originalError: error.message,
      retryAttempts: this.buildRetryAttempts(job),
      deadLetterReason: this.determineDeadLetterReason(job, error),
      movedAt: new Date()
    };

    this.deadLetterQueue.push(deadLetterJob);

    this.emit('deadLetterQueued', deadLetterJob);

    logger.error(`Webhook job moved to dead letter queue: ${job.id}`, {
      webhookId: job.webhookId,
      attempts: job.attempt,
      error: error.message,
      reason: deadLetterJob.deadLetterReason
    });
  }

  private buildRetryAttempts(job: WebhookJob): RetryAttempt[] {
    const attempts: RetryAttempt[] = [];
    
    for (let i = 1; i <= job.attempt; i++) {
      attempts.push({
        attempt: i,
        delay: 0,
        timestamp: new Date()
      });
    }

    return attempts;
  }

  private determineDeadLetterReason(job: WebhookJob, error: Error): string {
    if (job.attempt >= 5) {
      return 'MAX_RETRIES_EXCEEDED';
    }

    const nonRetryablePatterns = [
      'AUTHENTICATION_FAILED',
      'PERMISSION_DENIED',
      'INVALID_WEBHOOK_URL',
      'MALFORMED_RESPONSE',
      'SSL_ERROR',
      'CERTIFICATE_ERROR'
    ];

    const errorMessage = error.message.toUpperCase();
    
    for (const pattern of nonRetryablePatterns) {
      if (errorMessage.includes(pattern)) {
        return pattern;
      }
    }

    return 'UNKNOWN_ERROR';
  }

  async getDeadLetterJobs(limit: number = 50): Promise<DeadLetterJob[]> {
    return this.deadLetterQueue.slice(0, limit);
  }

  async retryDeadLetterJob(jobId: string, policyName: string = 'default'): Promise<void> {
    const jobIndex = this.deadLetterQueue.findIndex(job => job.id === jobId);
    
    if (jobIndex === -1) {
      throw new Error(`Dead letter job not found: ${jobId}`);
    }

    const deadLetterJob = this.deadLetterQueue.splice(jobIndex, 1)[0];
    const retryJob: WebhookJob = {
      ...deadLetterJob,
      attempt: 1,
      priority: 'high'
    };

    await this.queue.enqueue(retryJob);

    this.emit('deadLetterRetry', {
      jobId,
      originalAttempts: deadLetterJob.attempt,
      originalError: deadLetterJob.originalError
    });

    logger.info(`Dead letter job retry initiated: ${jobId}`, {
      webhookId: deadLetterJob.webhookId,
      originalAttempts: deadLetterJob.attempt
    });
  }

  async bulkRetryDeadLetterJobs(jobIds: string[], policyName: string = 'default'): Promise<void> {
    const results = await Promise.allSettled(
      jobIds.map(jobId => this.retryDeadLetterJob(jobId, policyName))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info(`Bulk dead letter retry completed`, {
      total: jobIds.length,
      successful,
      failed
    });

    this.emit('bulkDeadLetterRetry', {
      total: jobIds.length,
      successful,
      failed
    });
  }

  async clearDeadLetterQueue(): Promise<void> {
    const clearedCount = this.deadLetterQueue.length;
    this.deadLetterQueue = [];

    logger.info(`Dead letter queue cleared: ${clearedCount} jobs`);
    this.emit('deadLetterCleared', { clearedCount });
  }

  async getRetryStats(): Promise<any> {
    const totalDeadLetter = this.deadLetterQueue.length;
    const reasons = this.deadLetterQueue.reduce((acc, job) => {
      acc[job.deadLetterReason] = (acc[job.deadLetterReason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgAttempts = this.deadLetterQueue.length > 0 
      ? this.deadLetterQueue.reduce((sum, job) => sum + job.attempt, 0) / this.deadLetterQueue.length
      : 0;

    return {
      totalDeadLetter,
      averageAttempts: Math.round(avgAttempts * 100) / 100,
      failureReasons: reasons,
      oldestJob: this.deadLetterQueue.length > 0 
        ? Math.min(...this.deadLetterQueue.map(job => job.movedAt.getTime()))
        : null,
      newestJob: this.deadLetterQueue.length > 0
        ? Math.max(...this.deadLetterQueue.map(job => job.movedAt.getTime()))
        : null
    };
  }

  registerRetryPolicy(name: string, policy: RetryPolicy): void {
    this.retryPolicies.set(name, policy);
    logger.info(`Retry policy registered: ${name}`);
  }

  getRetryPolicy(name: string): RetryPolicy | undefined {
    return this.retryPolicies.get(name);
  }

  getAllRetryPolicies(): Record<string, RetryPolicy> {
    return Object.fromEntries(this.retryPolicies);
  }

  async updateRetryPolicy(name: string, policy: Partial<RetryPolicy>): Promise<void> {
    const existingPolicy = this.retryPolicies.get(name);
    if (!existingPolicy) {
      throw new Error(`Retry policy not found: ${name}`);
    }

    const updatedPolicy = { ...existingPolicy, ...policy };
    this.retryPolicies.set(name, updatedPolicy);

    logger.info(`Retry policy updated: ${name}`);
    this.emit('policyUpdated', { name, policy: updatedPolicy });
  }

  async deleteRetryPolicy(name: string): Promise<void> {
    if (name === 'default') {
      throw new Error('Cannot delete default retry policy');
    }

    const deleted = this.retryPolicies.delete(name);
    if (!deleted) {
      throw new Error(`Retry policy not found: ${name}`);
    }

    logger.info(`Retry policy deleted: ${name}`);
    this.emit('policyDeleted', { name });
  }

  async getJobRetryHistory(jobId: string): Promise<RetryAttempt[]> {
    const deadLetterJob = this.deadLetterQueue.find(job => job.id === jobId);
    
    if (deadLetterJob) {
      return deadLetterJob.retryAttempts;
    }

    return [];
  }

  async exportDeadLetterJobs(): Promise<DeadLetterJob[]> {
    return [...this.deadLetterQueue];
  }

  async importDeadLetterJobs(jobs: DeadLetterJob[]): Promise<void> {
    this.deadLetterQueue.push(...jobs);
    logger.info(`Imported ${jobs.length} dead letter jobs`);
  }
}
