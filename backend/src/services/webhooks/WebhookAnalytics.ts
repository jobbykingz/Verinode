import { logger } from '../monitoringService';
import { WebhookDelivery } from '../../models/WebhookDelivery';
import { WebhookEvent } from '../../models/WebhookEvent';
import { EventEmitter } from 'events';

export interface WebhookMetrics {
  webhookId: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  averageResponseTime: number;
  totalResponseTime: number;
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  deliveriesByHour: Record<string, number>;
  deliveriesByStatus: Record<string, number>;
  errorBreakdown: Record<string, number>;
}

export interface GlobalMetrics {
  totalWebhooks: number;
  activeWebhooks: number;
  totalDeliveries: number;
  totalEvents: number;
  overallSuccessRate: number;
  averageResponseTime: number;
  deliveriesByHour: Record<string, number>;
  topPerformingWebhooks: Array<{
    webhookId: string;
    successRate: number;
    totalDeliveries: number;
  }>;
  worstPerformingWebhooks: Array<{
    webhookId: string;
    successRate: number;
    totalDeliveries: number;
  }>;
  recentErrors: Array<{
    webhookId: string;
    error: string;
    timestamp: Date;
    statusCode?: number;
  }>;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export class WebhookAnalytics extends EventEmitter {
  private metricsCache: Map<string, WebhookMetrics> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor() {
    super();
    this.setupMetricsCollection();
  }

  private setupMetricsCollection(): void {
    setInterval(() => {
      this.updateMetricsCache();
    }, this.cacheTimeout);
  }

  async trackWebhookRegistration(webhookId: string): Promise<void> {
    logger.info(`Webhook registration tracked: ${webhookId}`);
    this.emit('webhookRegistered', { webhookId, timestamp: new Date() });
  }

  async trackWebhookUnregistration(webhookId: string): Promise<void> {
    this.metricsCache.delete(webhookId);
    logger.info(`Webhook unregistration tracked: ${webhookId}`);
    this.emit('webhookUnregistered', { webhookId, timestamp: new Date() });
  }

  async trackEventProcessing(eventId: string, processingTime: number): Promise<void> {
    logger.debug(`Event processing tracked: ${eventId}, ${processingTime}ms`);
    this.emit('eventProcessed', { eventId, processingTime, timestamp: new Date() });
  }

  async trackDelivery(webhookId: string, result: any): Promise<void> {
    const cachedMetrics = this.metricsCache.get(webhookId);
    if (cachedMetrics) {
      this.updateCachedMetrics(cachedMetrics, result);
    }

    this.emit('deliveryTracked', {
      webhookId,
      success: result.success,
      responseTime: result.responseTime,
      statusCode: result.statusCode,
      error: result.error,
      timestamp: new Date()
    });

    logger.debug(`Delivery tracked: ${webhookId}`, {
      success: result.success,
      responseTime: result.responseTime
    });
  }

  async trackRateLimitExceeded(webhookId: string): Promise<void> {
    this.emit('rateLimitExceeded', { webhookId, timestamp: new Date() });
    logger.warn(`Rate limit exceeded: ${webhookId}`);
  }

  private updateCachedMetrics(metrics: WebhookMetrics, result: any): void {
    metrics.totalDeliveries++;
    metrics.totalResponseTime += result.responseTime;
    metrics.averageResponseTime = metrics.totalResponseTime / metrics.totalDeliveries;

    if (result.success) {
      metrics.successfulDeliveries++;
      metrics.lastSuccessAt = new Date();
    } else {
      metrics.failedDeliveries++;
      metrics.lastFailureAt = new Date();
      
      if (result.error) {
        metrics.errorBreakdown[result.error] = (metrics.errorBreakdown[result.error] || 0) + 1;
      }
    }

    metrics.successRate = metrics.successfulDeliveries / metrics.totalDeliveries;
    metrics.lastDeliveryAt = new Date();

    const statusKey = result.success ? 'success' : 'failed';
    metrics.deliveriesByStatus[statusKey] = (metrics.deliveriesByStatus[statusKey] || 0) + 1;

    const hourKey = new Date().toISOString().slice(0, 13);
    metrics.deliveriesByHour[hourKey] = (metrics.deliveriesByHour[hourKey] || 0) + 1;
  }

  async getWebhookStats(webhookId: string, timeRange?: TimeRange): Promise<WebhookMetrics> {
    const cached = this.metricsCache.get(webhookId);
    if (cached && !timeRange) {
      return cached;
    }

    const matchQuery: any = { webhookId };
    if (timeRange) {
      matchQuery.createdAt = { $gte: timeRange.start, $lte: timeRange.end };
    }

    const deliveries = await WebhookDelivery.find(matchQuery);
    
    const metrics: WebhookMetrics = {
      webhookId,
      totalDeliveries: deliveries.length,
      successfulDeliveries: deliveries.filter(d => d.status === 'delivered').length,
      failedDeliveries: deliveries.filter(d => d.status === 'failed').length,
      successRate: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      deliveriesByHour: {},
      deliveriesByStatus: {},
      errorBreakdown: {}
    };

    if (metrics.totalDeliveries > 0) {
      metrics.successRate = metrics.successfulDeliveries / metrics.totalDeliveries;
      metrics.totalResponseTime = deliveries.reduce((sum, d) => sum + (d.responseTime || 0), 0);
      metrics.averageResponseTime = metrics.totalResponseTime / metrics.totalDeliveries;

      const lastDelivery = deliveries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      metrics.lastDeliveryAt = lastDelivery.createdAt;

      const lastSuccess = deliveries
        .filter(d => d.status === 'delivered')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      metrics.lastSuccessAt = lastSuccess?.createdAt;

      const lastFailure = deliveries
        .filter(d => d.status === 'failed')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      metrics.lastFailureAt = lastFailure?.createdAt;
    }

    deliveries.forEach(delivery => {
      const statusKey = delivery.status;
      metrics.deliveriesByStatus[statusKey] = (metrics.deliveriesByStatus[statusKey] || 0) + 1;

      if (delivery.error) {
        metrics.errorBreakdown[delivery.error] = (metrics.errorBreakdown[delivery.error] || 0) + 1;
      }

      const hourKey = delivery.createdAt.toISOString().slice(0, 13);
      metrics.deliveriesByHour[hourKey] = (metrics.deliveriesByHour[hourKey] || 0) + 1;
    });

    if (!timeRange) {
      this.metricsCache.set(webhookId, metrics);
    }

    return metrics;
  }

  async getGlobalMetrics(timeRange?: TimeRange): Promise<GlobalMetrics> {
    const matchQuery: any = {};
    if (timeRange) {
      matchQuery.createdAt = { $gte: timeRange.start, $lte: timeRange.end };
    }

    const [totalDeliveries, totalEvents, webhookStats] = await Promise.all([
      WebhookDelivery.countDocuments(matchQuery),
      WebhookEvent.countDocuments(matchQuery),
      this.getWebhookStatsForAll(timeRange)
    ]);

    const successfulDeliveries = await WebhookDelivery.countDocuments({
      ...matchQuery,
      status: 'delivered'
    });

    const overallSuccessRate = totalDeliveries > 0 ? successfulDeliveries / totalDeliveries : 0;
    const averageResponseTime = await this.calculateAverageResponseTime(matchQuery);

    const topPerforming = webhookStats
      .filter(w => w.totalDeliveries >= 10)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    const worstPerforming = webhookStats
      .filter(w => w.totalDeliveries >= 10)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 5);

    const recentErrors = await this.getRecentErrors(matchQuery);

    return {
      totalWebhooks: webhookStats.length,
      activeWebhooks: webhookStats.filter(w => w.totalDeliveries > 0).length,
      totalDeliveries,
      totalEvents,
      overallSuccessRate,
      averageResponseTime,
      deliveriesByHour: await this.getGlobalDeliveriesByHour(matchQuery),
      topPerformingWebhooks: topPerforming,
      worstPerformingWebhooks: worstPerforming,
      recentErrors
    };
  }

  private async getWebhookStatsForAll(timeRange?: TimeRange): Promise<WebhookMetrics[]> {
    const pipeline: any[] = [
      {
        $group: {
          _id: '$webhookId',
          totalDeliveries: { $sum: 1 },
          successfulDeliveries: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          failedDeliveries: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          totalResponseTime: { $sum: '$responseTime' },
          lastDeliveryAt: { $max: '$createdAt' },
          lastSuccessAt: {
            $max: {
              $cond: [{ $eq: ['$status', 'delivered'] }, '$createdAt', null]
            }
          },
          lastFailureAt: {
            $max: {
              $cond: [{ $eq: ['$status', 'failed'] }, '$createdAt', null]
            }
          }
        }
      }
    ];

    if (timeRange) {
      pipeline.unshift({
        $match: {
          createdAt: { $gte: timeRange.start, $lte: timeRange.end }
        }
      });
    }

    const results = await WebhookDelivery.aggregate(pipeline);

    return results.map(result => ({
      webhookId: result._id,
      totalDeliveries: result.totalDeliveries,
      successfulDeliveries: result.successfulDeliveries,
      failedDeliveries: result.failedDeliveries,
      successRate: result.totalDeliveries > 0 ? result.successfulDeliveries / result.totalDeliveries : 0,
      averageResponseTime: result.totalDeliveries > 0 ? result.totalResponseTime / result.totalDeliveries : 0,
      totalResponseTime: result.totalResponseTime,
      lastDeliveryAt: result.lastDeliveryAt,
      lastSuccessAt: result.lastSuccessAt,
      lastFailureAt: result.lastFailureAt,
      deliveriesByHour: {},
      deliveriesByStatus: {},
      errorBreakdown: {}
    }));
  }

  private async calculateAverageResponseTime(matchQuery: any): Promise<number> {
    const result = await WebhookDelivery.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' }
        }
      }
    ]);

    return result.length > 0 ? result[0].avgResponseTime || 0 : 0;
  }

  private async getGlobalDeliveriesByHour(matchQuery: any): Promise<Record<string, number>> {
    const result = await WebhookDelivery.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%dT%H', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
  }

  private async getRecentErrors(matchQuery: any, limit: number = 10): Promise<any[]> {
    return WebhookDelivery.find({
      ...matchQuery,
      status: 'failed',
      error: { $exists: true }
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('webhookId error statusCode createdAt')
      .lean();
  }

  async getPerformanceReport(timeRange: TimeRange): Promise<any> {
    const [globalMetrics, webhookMetrics] = await Promise.all([
      this.getGlobalMetrics(timeRange),
      this.getWebhookStatsForAll(timeRange)
    ]);

    const performanceTrends = await this.getPerformanceTrends(timeRange);
    const reliabilityMetrics = await this.getReliabilityMetrics(timeRange);

    return {
      summary: globalMetrics,
      webhookBreakdown: webhookMetrics,
      performanceTrends,
      reliabilityMetrics,
      recommendations: this.generateRecommendations(globalMetrics, webhookMetrics)
    };
  }

  private async getPerformanceTrends(timeRange: TimeRange): Promise<any> {
    const hourlyStats = await WebhookDelivery.aggregate([
      {
        $match: {
          createdAt: { $gte: timeRange.start, $lte: timeRange.end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%dT%H', date: '$createdAt' } },
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          avgResponseTime: { $avg: '$responseTime' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return hourlyStats.map(stat => ({
      hour: stat._id,
      total: stat.total,
      successful: stat.successful,
      successRate: stat.total > 0 ? stat.successful / stat.total : 0,
      averageResponseTime: stat.avgResponseTime || 0
    }));
  }

  private async getReliabilityMetrics(timeRange: TimeRange): Promise<any> {
    const [totalDeliveries, uniqueWebhooks] = await Promise.all([
      WebhookDelivery.countDocuments({
        createdAt: { $gte: timeRange.start, $lte: timeRange.end }
      }),
      WebhookDelivery.distinct('webhookId', {
        createdAt: { $gte: timeRange.start, $lte: timeRange.end }
      })
    ]);

    const uptime = await this.calculateUptime(timeRange);
    const errorRate = await this.calculateErrorRate(timeRange);

    return {
      uptime,
      errorRate,
      totalWebhooks: uniqueWebhooks.length,
      totalDeliveries,
      reliabilityScore: this.calculateReliabilityScore(uptime, errorRate)
    };
  }

  private async calculateUptime(timeRange: TimeRange): Promise<number> {
    const successfulDeliveries = await WebhookDelivery.countDocuments({
      createdAt: { $gte: timeRange.start, $lte: timeRange.end },
      status: 'delivered'
    });

    const totalDeliveries = await WebhookDelivery.countDocuments({
      createdAt: { $gte: timeRange.start, $lte: timeRange.end }
    });

    return totalDeliveries > 0 ? successfulDeliveries / totalDeliveries : 1;
  }

  private async calculateErrorRate(timeRange: TimeRange): Promise<number> {
    const failedDeliveries = await WebhookDelivery.countDocuments({
      createdAt: { $gte: timeRange.start, $lte: timeRange.end },
      status: 'failed'
    });

    const totalDeliveries = await WebhookDelivery.countDocuments({
      createdAt: { $gte: timeRange.start, $lte: timeRange.end }
    });

    return totalDeliveries > 0 ? failedDeliveries / totalDeliveries : 0;
  }

  private calculateReliabilityScore(uptime: number, errorRate: number): number {
    return (uptime * 0.7 + (1 - errorRate) * 0.3) * 100;
  }

  private generateRecommendations(globalMetrics: GlobalMetrics, webhookMetrics: WebhookMetrics[]): string[] {
    const recommendations: string[] = [];

    if (globalMetrics.overallSuccessRate < 0.95) {
      recommendations.push('Overall success rate is below 95%. Consider reviewing failing webhooks.');
    }

    if (globalMetrics.averageResponseTime > 5000) {
      recommendations.push('Average response time is high. Consider optimizing webhook endpoints.');
    }

    const worstWebhooks = webhookMetrics
      .filter(w => w.totalDeliveries >= 10)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 3);

    if (worstWebhooks.length > 0 && worstWebhooks[0].successRate < 0.9) {
      recommendations.push(`Webhook ${worstWebhooks[0].webhookId} has low success rate (${(worstWebhooks[0].successRate * 100).toFixed(1)}%).`);
    }

    const highErrorWebhooks = webhookMetrics.filter(w => Object.keys(w.errorBreakdown).length > 5);
    if (highErrorWebhooks.length > 0) {
      recommendations.push('Some webhooks have multiple error types. Consider reviewing webhook configurations.');
    }

    return recommendations;
  }

  private async updateMetricsCache(): Promise<void> {
    this.lastCacheUpdate = Date.now();
    this.emit('metricsCacheUpdated', { timestamp: new Date() });
  }

  async clearCache(): Promise<void> {
    this.metricsCache.clear();
    logger.info('Webhook analytics cache cleared');
  }

  async exportMetrics(webhookId?: string, timeRange?: TimeRange): Promise<any> {
    if (webhookId) {
      return this.getWebhookStats(webhookId, timeRange);
    }
    return this.getGlobalMetrics(timeRange);
  }
}
