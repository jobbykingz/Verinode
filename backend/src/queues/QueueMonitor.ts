import { QueueJobModel } from '../models/QueueJob';
import { QueueMetricsModel, IQueueMetrics } from '../models/QueueMetrics';
import redis from '../config/redisConfig';
import { EventEmitter } from 'events';

export class QueueMonitor extends EventEmitter {
  private queueNames: string[];
  private metricsMap: Map<string, IQueueMetrics[]> = new Map();
  private maxHistory: number = 24 * 60; // 24 hours in minutes

  constructor(queueNames: string[]) {
    super();
    this.queueNames = queueNames;
    this.startMonitoring();
  }

  /**
   * Start periodic monitoring
   */
  startMonitoring(): void {
    setInterval(async () => {
      for (const queueName of this.queueNames) {
        await this.collectMetrics(queueName);
      }
    }, 60000); // Every minute
  }

  /**
   * Collect metrics for a single queue
   */
  async collectMetrics(queueName: string): Promise<IQueueMetrics> {
    const start = new Date(Date.now() - 60000); // Last minute

    // 1. Get job counts by status
    const counts = await QueueJobModel.aggregate([
      { $match: { queueName, updatedAt: { $gte: start } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusCounts: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      'dead-letter': 0,
    };

    counts.forEach((c) => {
      statusCounts[c._id] = c.count;
    });

    // 2. Get average processing time
    const stats = await QueueJobModel.aggregate([
      {
        $match: {
          queueName,
          status: 'completed',
          completedAt: { $gte: start },
        },
      },
      {
        $project: {
          processingTime: { $subtract: ['$completedAt', '$processedAt'] },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$processingTime' },
          maxTime: { $max: '$processingTime' },
          minTime: { $min: '$processingTime' },
          totalTime: { $sum: '$processingTime' },
        },
      },
    ]);

    const res = stats[0] || { avgTime: 0, maxTime: 0, minTime: 0, totalTime: 0 };

    // 3. Create metrics record
    const metrics = new QueueMetricsModel({
      queueName,
      totalJobs: statusCounts.pending + statusCounts.processing + statusCounts.completed + statusCounts.failed + statusCounts['dead-letter'],
      completedJobs: statusCounts.completed,
      failedJobs: statusCounts.failed,
      deadLetterJobs: statusCounts['dead-letter'],
      averageProcessingTime: res.avgTime,
      maxProcessingTime: res.maxTime,
      minProcessingTime: res.minTime,
      totalProcessingTime: res.totalTime,
      throughput: statusCounts.completed, // completed jobs per minute
      timestamp: new Date(),
    });

    await metrics.save();
    
    this.emit('metrics_collected', metrics);
    return metrics;
  }

  /**
   * Get real-time queue status (not persisted)
   */
  async getRealTimeStatus(queueName: string): Promise<any> {
    const queueKey = `queue:${queueName}`;
    const dlqKey = `queue:${queueName}:dlq`;

    const pendingCount = await redis.zcard(queueKey);
    const dlqCount = await redis.scard(dlqKey);
    
    // Status counts from Mongo
    const counts = await QueueJobModel.aggregate([
      { $match: { queueName } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const mongoCounts: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      'dead-letter': 0,
    };

    counts.forEach((c) => {
      mongoCounts[c._id] = c.count;
    });

    return {
      name: queueName,
      activeJobs: mongoCounts.processing,
      pendingJobs: pendingCount,
      dlqJobs: dlqCount,
      completedTotal: mongoCounts.completed,
      failedTotal: mongoCounts.failed,
    };
  }

  /**
   * Get all queue statuses
   */
  async getAllStatuses(): Promise<any[]> {
    const results = [];
    for (const name of this.queueNames) {
      results.push(await this.getRealTimeStatus(name));
    }
    return results;
  }

  /**
   * Get historical metrics for performance analytics
   */
  async getHistoricalMetrics(queueName: string, minutes: number = 60): Promise<IQueueMetrics[]> {
    const start = new Date(Date.now() - minutes * 60000);
    return await QueueMetricsModel.find({
      queueName,
      timestamp: { $gte: start },
    }).sort({ timestamp: 1 });
  }
}
