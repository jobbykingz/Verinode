import redis from '../config/redisConfig';
import { QueueJobModel, IQueueJob } from '../models/QueueJob';

export class DeadLetterQueue {
  private queueName: string;
  private key: string;

  constructor(queueName: string) {
    this.queueName = queueName;
    this.key = `queue:${queueName}:dlq`;
  }

  /**
   * Add a job to the dead letter queue
   */
  async addJob(jobId: string, error?: string): Promise<IQueueJob | null> {
    const job = await QueueJobModel.findByIdAndUpdate(
      jobId,
      {
        status: 'dead-letter',
        lastError: error,
        failedAt: new Date(),
      },
      { new: true }
    );

    if (job) {
      // Add to Redis Set (not ZSET unless we want retry scheduling)
      await redis.sadd(this.key, jobId);
    }

    return job;
  }

  /**
   * Re-queue a job from the DLQ
   */
  async requeue(jobId: string, priorityQueue: any): Promise<IQueueJob | null> {
    const job = await QueueJobModel.findById(jobId);
    if (!job || job.status !== 'dead-letter') return null;

    // Remove from DLQ
    await redis.srem(this.key, jobId);

    // Reset status and attempts
    job.status = 'pending';
    job.attempts = 0;
    await job.save();

    // Re-add to priority queue
    await priorityQueue.addJob(job.data, job.priority, job.maxAttempts);
    
    // We could delete the old record but we might want to keep the history
    // A better approach is to just re-queue the existing MongoDB document
    return job;
  }

  /**
   * Get DLQ size
   */
  async getSize(): Promise<number> {
    return await redis.scard(this.key);
  }

  /**
   * Get all jobs in the DLQ
   */
  async getAll(): Promise<string[]> {
    return await redis.smembers(this.key);
  }

  /**
   * Clear the DLQ
   */
  async clear(): Promise<void> {
    await redis.del(this.key);
  }
}
