import { EventEmitter } from 'events';
import { JobModel, IJob } from '../models/Job';

export interface FailureConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  deadLetterQueue: string;
  alertThreshold: number;
  enableNotifications: boolean;
}

export interface FailureEvent {
  jobId: string;
  queueName: string;
  jobType: string;
  error: string;
  attempts: number;
  timestamp: Date;
  willRetry: boolean;
}

/**
 * FailureHandler - Handles job failures with retry logic and recovery
 */
export class FailureHandler extends EventEmitter {
  private config: FailureConfig;
  private failureHistory: Map<string, FailureEvent[]> = new Map();
  private alertHandlers: Array<(event: FailureEvent) => Promise<void>> = [];

  constructor(config?: Partial<FailureConfig>) {
    super();
    
    this.config = {
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      exponentialBackoff: true,
      deadLetterQueue: 'dead-letter',
      alertThreshold: 5, // Alert after 5 consecutive failures
      enableNotifications: true,
      ...config,
    };
  }

  /**
   * Handle a job failure
   */
  async handleFailure(job: IJob, error: string): Promise<void> {
    const failureEvent: FailureEvent = {
      jobId: job.jobId,
      queueName: job.queueName,
      jobType: job.jobType,
      error,
      attempts: job.attempts + 1,
      timestamp: new Date(),
      willRetry: this.shouldRetry(job),
    };

    // Record failure
    this.recordFailure(failureEvent);

    // Check if should retry
    if (this.shouldRetry(job)) {
      await this.scheduleRetry(job, error);
      this.emit('retry:scheduled', { jobId: job.jobId, attempt: failureEvent.attempts });
    } else {
      // Move to dead letter queue
      await this.moveToDeadLetterQueue(job, error);
      this.emit('job:dead-letter', { jobId: job.jobId, error });
    }

    // Check alert threshold
    if (this.shouldAlert(job.queueName)) {
      await this.sendAlert(failureEvent);
    }

    this.emit('failure:handled', failureEvent);
  }

  /**
   * Determine if job should be retried
   */
  private shouldRetry(job: IJob): boolean {
    return job.attempts < this.config.maxRetries;
  }

  /**
   * Schedule a retry for the job
   */
  private async scheduleRetry(job: IJob, errorMessage: string): Promise<void> {
    const delay = this.calculateRetryDelay(job.attempts);
    const processAfter = new Date(Date.now() + delay);

    await JobModel.findOneAndUpdate(
      { jobId: job.jobId },
      {
        status: 'pending',
        lastError: errorMessage,
        processAfter,
        progress: 0
      }
    ).exec();

    console.log(`Job ${job.jobId} scheduled for retry in ${delay}ms`);
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  private calculateRetryDelay(attempt: number): number {
    if (this.config.exponentialBackoff) {
      // Exponential backoff: 1s, 2s, 4s, 8s, etc.
      return this.config.retryDelay * Math.pow(2, attempt);
    }
    
    // Fixed delay
    return this.config.retryDelay;
  }

  /**
   * Move job to dead letter queue
   */
  private async moveToDeadLetterQueue(job: IJob, error: string): Promise<void> {
    const deadLetterData = {
      jobId: `dlq_${job.jobId}`,
      originalJobId: job.jobId,
      queueName: job.queueName,
      jobType: job.jobType,
      data: job.data,
      error,
      attempts: job.attempts,
      failedAt: new Date(),
      metadata: {
        ...job.metadata,
        deathReason: 'max_retries_exceeded'
      }
    };

    // Create dead letter job
    await JobModel.create({
      ...deadLetterData,
      status: 'failed',
      priority: 0 // Lowest priority
    });

    // Update original job status
    await JobModel.findOneAndUpdate(
      { jobId: job.jobId },
      {
        status: 'failed',
        lastError: error,
        failedAt: new Date(),
        metadata: {
          ...job.metadata,
          movedToDeadLetter: true
        }
      }
    ).exec();

    console.log(`Job ${job.jobId} moved to dead letter queue`);
  }

  /**
   * Record failure in history
   */
  private recordFailure(event: FailureEvent): void {
    const history = this.failureHistory.get(event.queueName) || [];
    history.push(event);

    // Keep only last 100 failures per queue
    if (history.length > 100) {
      history.shift();
    }

    this.failureHistory.set(event.queueName, history);
  }

  /**
   * Check if alert should be sent
   */
  private shouldAlert(queueName: string): boolean {
    const history = this.failureHistory.get(queueName) || [];
    
    if (history.length < this.config.alertThreshold) {
      return false;
    }

    // Check recent failures (last 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentFailures = history.filter(
      event => event.timestamp.getTime() > fiveMinutesAgo
    );

    return recentFailures.length >= this.config.alertThreshold;
  }

  /**
   * Send alert notification
   */
  private async sendAlert(event: FailureEvent): Promise<void> {
    console.warn(`ALERT: High failure rate in queue ${event.queueName}`);
    
    this.emit('alert', {
      type: 'high_failure_rate',
      queueName: event.queueName,
      failureCount: this.failureHistory.get(event.queueName)?.length || 0,
      timestamp: new Date()
    });

    // Call custom alert handlers
    for (const handler of this.alertHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Alert handler failed:', error);
      }
    }
  }

  /**
   * Register an alert handler
   */
  registerAlertHandler(handler: (event: FailureEvent) => Promise<void>): void {
    this.alertHandlers.push(handler);
    console.log('Alert handler registered');
  }

  /**
   * Get failure statistics for a queue
   */
  getFailureStats(queueName: string): {
    totalFailures: number;
    recentFailures: number;
    commonErrors: Map<string, number>;
    avgAttemptsBeforeFailure: number;
  } {
    const history = this.failureHistory.get(queueName) || [];
    
    // Count recent failures (last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentFailures = history.filter(
      event => event.timestamp.getTime() > oneHourAgo
    );

    // Count common errors
    const errorCounts = new Map<string, number>();
    for (const event of history) {
      const count = errorCounts.get(event.error) || 0;
      errorCounts.set(event.error, count + 1);
    }

    // Calculate average attempts
    const avgAttempts = history.length > 0
      ? history.reduce((sum, event) => sum + event.attempts, 0) / history.length
      : 0;

    return {
      totalFailures: history.length,
      recentFailures: recentFailures.length,
      commonErrors: errorCounts,
      avgAttemptsBeforeFailure: avgAttempts
    };
  }

  /**
   * Get all failure histories
   */
  getAllFailureStats(): Map<string, any> {
    const stats = new Map<string, any>();
    
    for (const [queueName] of this.failureHistory) {
      stats.set(queueName, this.getFailureStats(queueName));
    }

    return stats;
  }

  /**
   * Clear failure history
   */
  clearFailureHistory(queueName?: string): void {
    if (queueName) {
      this.failureHistory.delete(queueName);
      console.log(`Cleared failure history for queue: ${queueName}`);
    } else {
      this.failureHistory.clear();
      console.log('Cleared all failure history');
    }

    this.emit('history:cleared', { queueName });
  }

  /**
   * Retry all failed jobs in a queue
   */
  async retryFailedJobs(queueName: string, maxJobs: number = 100): Promise<number> {
    const failedJobs = await JobModel.find({
      queueName,
      status: 'failed',
      attempts: { $lt: this.config.maxRetries }
    })
    .limit(maxJobs)
    .exec();

    let retryCount = 0;
    for (const job of failedJobs) {
      await JobModel.findOneAndUpdate(
        { jobId: job.jobId },
        {
          status: 'pending',
          lastError: undefined,
          processAfter: new Date() // Process immediately
        }
      ).exec();

      retryCount++;
    }

    console.log(`Retried ${retryCount} failed jobs in queue ${queueName}`);
    this.emit('jobs:retried', { queueName, count: retryCount });

    return retryCount;
  }

  /**
   * Get configuration
   */
  getConfig(): FailureConfig {
    return { ...this.config };
  }
}

export const failureHandler = new FailureHandler();
