import redis from '../config/redisConfig';
import { QueueJobModel, IQueueJob } from '../models/QueueJob';
import { EventEmitter } from 'events';

export class PriorityQueue extends EventEmitter {
  private queueName: string;
  private key: string;

  constructor(queueName: string) {
    super();
    this.queueName = queueName;
    this.key = `queue:${queueName}`;
  }

  /**
   * Add a job to the priority queue
   */
  async addJob(data: any, priority: number = 0, maxAttempts: number = 3): Promise<IQueueJob> {
    // 1. Create job in MongoDB for persistence
    const job = new QueueJobModel({
      queueName: this.queueName,
      data,
      priority,
      maxAttempts,
      status: 'pending',
    });

    await job.save();

    // 2. Add to Redis ZSET
    // Priority is the score, but we want higher priority to be handled first.
    // ZSET is sorted from low to high, so we'll use (currentTime - priority) or just -priority
    // if we want simple priority, or use a composite score.
    // Let's use priority as the score for simplicity, and use ZREVRANGE to get highest priority first.
    // But since many jobs might have the same priority, we need another factor to make it FIFO within same priority.
    // A better approach for Bull-like behavior: score = priority * 1e11 + (1e11 - Date.now() % 1e11)
    
    const score = priority * 1000000000000 + (2000000000000 - Date.now());
    await redis.zadd(this.key, score.toString(), job._id.toString());

    this.emit('jobAdded', job);
    return job;
  }

  /**
   * Peek at the highest priority job
   */
  async peek(): Promise<string | null> {
    const jobs = await redis.zrevrange(this.key, 0, 0);
    return jobs.length > 0 ? jobs[0] : null;
  }

  /**
   * Pop the highest priority job and mark it as processing
   */
  async pop(): Promise<IQueueJob | null> {
    const jobId = await redis.zrevrange(this.key, 0, 0);
    if (jobId.length === 0) return null;

    // Use a transaction or Lua script for atomicity in a production environment
    // For now, simplicity with check-and-remove
    const id = jobId[0];
    const removed = await redis.zrem(this.key, id);
    
    if (removed === 0) return null; // Another worker got it

    const job = await QueueJobModel.findByIdAndUpdate(
      id,
      { status: 'processing', processedAt: new Date() },
      { new: true }
    );

    if (job) {
      this.emit('jobStarted', job);
    }
    
    return job;
  }

  /**
   * Get queue length
   */
  async getLength(): Promise<number> {
    return await redis.zcard(this.key);
  }

  /**
   * Clear the queue
   */
  async clear(): Promise<void> {
    await redis.del(this.key);
  }
}
