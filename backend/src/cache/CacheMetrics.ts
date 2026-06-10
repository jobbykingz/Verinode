import { EventEmitter } from 'events';
import { WinstonLogger } from '../utils/logger';
import {
  CacheConfig,
  CacheMetrics as ICacheMetrics,
  CacheAnalytics,
  PerformanceAlert,
  OptimizationSuggestion,
} from '../config/cache';

export interface MetricCollection {
  timestamp: Date;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  errors: number;
  avgResponseTime: number;
  memoryUsage: number;
  keyCount: number;
  hitRate: number;
  missRate: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'hit_rate' | 'response_time' | 'memory_usage' | 'error_rate' | 'connection_count';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
}

export interface OptimizationSuggestion {
  type: 'cache_size' | 'ttl_adjustment' | 'compression' | 'serialization' | 'eviction_policy';
  priority: 'low' | 'medium' | 'high';
  description: string;
  expectedImprovement: string;
  implementation: string;
}

export interface CachePerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalRequests: number;
    hitRate: number;
    avgResponseTime: number;
    peakMemoryUsage: number;
    errorRate: number;
  };
  topKeys: Array<{
    key: string;
    hits: number;
    hitRate: number;
    avgResponseTime: number;
  }>;
  patterns: {
    hourlyAccess: Array<{ hour: number; hits: number; misses: number }>;
    keyPatterns: Array<{ pattern: string; frequency: number }>;
    errorPatterns: Array<{ type: string; count: number; lastOccurred: Date }>;
  };
  optimizations: OptimizationSuggestion[];
  alerts: PerformanceAlert[];
}

export class CacheMetrics extends EventEmitter {
  private config: CacheConfig;
  private logger: WinstonLogger;
  private metrics: MetricCollection[];
  private currentMetrics: CacheMetrics;
  private alerts: PerformanceAlert[];
  private keyAccessCounts: Map<string, number>;
  private keyResponseTimes: Map<string, number[]>;
  private collectionInterval?: NodeJS.Timeout;
  private analyticsInterval?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    super();
    this.config = config;
    this.logger = new WinstonLogger();
    this.metrics = [];
    this.currentMetrics = this.initializeMetrics();
    this.alerts = [];
    this.keyAccessCounts = new Map();
    this.keyResponseTimes = new Map();

    this.startMetricsCollection();
    this.startAnalyticsProcessing();
  }

  /**
   * Record cache hit
   */
  recordHit(key: string, responseTime: number): void {
    this.currentMetrics.hits++;
    this.currentMetrics.avgResponseTime = (this.currentMetrics.avgResponseTime + responseTime) / 2;

    this.updateKeyMetrics(key, responseTime);
    this.checkThresholds();
    this.emit('hit', { key, responseTime });
  }

  /**
   * Record cache miss
   */
  recordMiss(key: string): void {
    this.currentMetrics.misses++;
    this.updateKeyMetrics(key, 0);
    this.checkThresholds();
    this.emit('miss', { key });
  }

  /**
   * Record cache set
   */
  recordSet(key: string, size: number): void {
    this.currentMetrics.sets++;
    this.currentMetrics.keyCount++;
    this.emit('set', { key, size });
  }

  /**
   * Record cache delete
   */
  recordDelete(key: string): void {
    this.currentMetrics.deletes++;
    this.currentMetrics.keyCount--;
    this.keyAccessCounts.delete(key);
    this.keyResponseTimes.delete(key);
    this.emit('delete', { key });
  }

  /**
   * Record cache eviction
   */
  recordEviction(key: string): void {
    this.currentMetrics.evictions++;
    this.keyAccessCounts.delete(key);
    this.keyResponseTimes.delete(key);
    this.emit('eviction', { key });
  }

  /**
   * Record error
   */
  recordError(error: Error, operation: string): void {
    this.currentMetrics.errors++;
    this.logger.error(`Cache operation error: ${operation}`, error);
    this.emit('error', { error, operation });
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(usage: number): void {
    this.currentMetrics.memoryUsage = usage;
    this.checkThresholds();
    this.emit('memoryUsage', { usage });
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): CacheMetrics {
    this.updateDerivedMetrics();
    return { ...this.currentMetrics };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(duration?: number): MetricCollection[] {
    const now = Date.now();
    const cutoffTime = duration ? now - duration : now - 3600000; // Default 1 hour

    return this.metrics.filter((metric) => metric.timestamp.getTime() >= cutoffTime);
  }

  /**
   * Get performance analytics
   */
  getAnalytics(): CacheAnalytics {
    const topKeys = this.getTopKeys();
    const patterns = this.getAccessPatterns();
    const errors = this.getErrorPatterns();

    return {
      topKeys,
      patterns: {
        access: patterns,
        errors,
      },
      performance: {
        avgHitRate: this.calculateAverageHitRate(),
        avgResponseTime: this.calculateAverageResponseTime(),
        peakMemoryUsage: this.getPeakMemoryUsage(),
        optimizationSuggestions: this.generateOptimizationSuggestions(),
      },
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(periodHours: number = 24): CachePerformanceReport {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - periodHours * 3600000);

    const periodMetrics = this.metrics.filter(
      (metric) => metric.timestamp >= startTime && metric.timestamp <= endTime,
    );

    const summary = this.calculateSummary(periodMetrics);
    const topKeys = this.getTopKeys(periodMetrics);
    const patterns = this.getAccessPatterns(periodMetrics);
    const optimizations = this.generateOptimizationSuggestions(periodMetrics);
    const alerts = this.getRecentAlerts(periodHours);

    return {
      period: { start: startTime, end: endTime },
      summary,
      topKeys,
      patterns: {
        hourlyAccess: patterns.hourlyAccess,
        keyPatterns: patterns.keyPatterns,
        errorPatterns: patterns.errorPatterns,
      },
      optimizations,
      alerts,
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.logger.info(`Resolved alert: ${alertId}`);
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.metrics = [];
    this.keyAccessCounts.clear();
    this.keyResponseTimes.clear();
    this.logger.info('Cleared metrics history');
    this.emit('historyCleared');
  }

  /**
   * Export metrics data
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const data = {
      currentMetrics: this.currentMetrics,
      history: this.metrics,
      alerts: this.alerts,
      analytics: this.getAnalytics(),
      exportedAt: new Date().toISOString(),
    };

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  // Private methods

  private startMetricsCollection(): void {
    if (!this.config.performance.metricsEnabled) {
      return;
    }

    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoring.metricsInterval * 1000);
  }

  private startAnalyticsProcessing(): void {
    if (!this.config.performance.analyticsEnabled) {
      return;
    }

    this.analyticsInterval = setInterval(() => {
      this.processAnalytics();
    }, this.config.performance.optimizationInterval * 1000);
  }

  private collectMetrics(): void {
    this.updateDerivedMetrics();

    const collection: MetricCollection = {
      timestamp: new Date(),
      ...this.currentMetrics,
    };

    this.metrics.push(collection);

    // Keep only last 1000 entries to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    this.emit('metricsCollected', collection);
  }

  private processAnalytics(): void {
    const suggestions = this.generateOptimizationSuggestions();

    if (suggestions.length > 0) {
      this.emit('optimizationSuggestions', suggestions);
      this.logger.info(`Generated ${suggestions.length} optimization suggestions`);
    }
  }

  private updateDerivedMetrics(): void {
    const totalRequests = this.currentMetrics.hits + this.currentMetrics.misses;
    this.currentMetrics.hitRate = totalRequests > 0 ? this.currentMetrics.hits / totalRequests : 0;
    this.currentMetrics.missRate =
      totalRequests > 0 ? this.currentMetrics.misses / totalRequests : 0;
    this.currentMetrics.timestamp = new Date();
  }

  private updateKeyMetrics(key: string, responseTime: number): void {
    const currentCount = this.keyAccessCounts.get(key) || 0;
    this.keyAccessCounts.set(key, currentCount + 1);

    const currentTimes = this.keyResponseTimes.get(key) || [];
    currentTimes.push(responseTime);

    // Keep only last 100 response times per key
    if (currentTimes.length > 100) {
      currentTimes.splice(0, currentTimes.length - 100);
    }

    this.keyResponseTimes.set(key, currentTimes);
  }

  private checkThresholds(): void {
    const thresholds = this.config.monitoring.alerting.thresholds;

    // Check hit rate threshold
    if (this.currentMetrics.hitRate < thresholds.hitRate) {
      this.createAlert(
        'hit_rate',
        'warning',
        `Cache hit rate (${(this.currentMetrics.hitRate * 100).toFixed(2)}%) below threshold (${(thresholds.hitRate * 100).toFixed(2)}%)`,
        this.currentMetrics.hitRate,
        thresholds.hitRate,
      );
    }

    // Check response time threshold
    if (this.currentMetrics.avgResponseTime > thresholds.responseTime) {
      this.createAlert(
        'response_time',
        'warning',
        `Average response time (${this.currentMetrics.avgResponseTime.toFixed(2)}ms) above threshold (${thresholds.responseTime}ms)`,
        this.currentMetrics.avgResponseTime,
        thresholds.responseTime,
      );
    }

    // Check memory usage threshold
    if (this.currentMetrics.memoryUsage > thresholds.memoryUsage) {
      this.createAlert(
        'memory_usage',
        'critical',
        `Memory usage (${(this.currentMetrics.memoryUsage * 100).toFixed(2)}%) above threshold (${(thresholds.memoryUsage * 100).toFixed(2)}%)`,
        this.currentMetrics.memoryUsage,
        thresholds.memoryUsage,
      );
    }

    // Check error rate threshold
    const totalRequests = this.currentMetrics.hits + this.currentMetrics.misses;
    const errorRate = totalRequests > 0 ? this.currentMetrics.errors / totalRequests : 0;

    if (errorRate > thresholds.errorRate) {
      this.createAlert(
        'error_rate',
        'critical',
        `Error rate (${(errorRate * 100).toFixed(2)}%) above threshold (${(thresholds.errorRate * 100).toFixed(2)}%)`,
        errorRate,
        thresholds.errorRate,
      );
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number,
  ): void {
    // Check if similar alert already exists and is not resolved
    const existingAlert = this.alerts.find(
      (alert) =>
        alert.type === type &&
        alert.severity === severity &&
        !alert.resolved &&
        Date.now() - alert.timestamp.getTime() < 300000, // 5 minutes
    );

    if (existingAlert) {
      return; // Don't duplicate recent alerts
    }

    const alert: PerformanceAlert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.push(alert);
    this.logger.warn(`Cache performance alert: ${message}`, { type, severity, value, threshold });
    this.emit('alert', alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  private getTopKeys(
    periodMetrics?: MetricCollection[],
  ): Array<{ key: string; hits: number; hitRate: number; avgResponseTime: number }> {
    const metrics = periodMetrics || this.metrics;
    const keyStats = new Map<string, { hits: number; responseTimes: number[] }>();

    // Aggregate key statistics from metrics
    for (const metric of metrics) {
      // This would need to be enhanced to track per-key metrics
      // For now, use the current tracking maps
    }

    // Convert current tracking data to top keys format
    const topKeys = Array.from(this.keyAccessCounts.entries())
      .map(([key, count]) => {
        const responseTimes = this.keyResponseTimes.get(key) || [];
        const avgResponseTime =
          responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
            : 0;

        const totalAccess = Array.from(this.keyAccessCounts.values()).reduce(
          (sum, count) => sum + count,
          0,
        );

        return {
          key,
          hits: count,
          hitRate: totalAccess > 0 ? count / totalAccess : 0,
          avgResponseTime,
        };
      })
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    return topKeys;
  }

  private getAccessPatterns(periodMetrics?: MetricCollection[]): {
    hourlyAccess: Array<{ hour: number; hits: number; misses: number }>;
    keyPatterns: Array<{ pattern: string; frequency: number }>;
    errorPatterns: Array<{ type: string; count: number; lastOccurred: Date }>;
  } {
    const metrics = periodMetrics || this.metrics;

    // Hourly access patterns
    const hourlyAccess = Array.from({ length: 24 }, (_, hour) => {
      const hourMetrics = metrics.filter((metric) => metric.timestamp.getHours() === hour);

      const hits = hourMetrics.reduce((sum, metric) => sum + metric.hits, 0);
      const misses = hourMetrics.reduce((sum, metric) => sum + metric.misses, 0);

      return { hour, hits, misses };
    });

    // Key patterns (simplified)
    const keyPatterns = this.analyzeKeyPatterns();

    // Error patterns
    const errorPatterns = this.analyzeErrorPatterns(metrics);

    return {
      hourlyAccess,
      keyPatterns,
      errorPatterns,
    };
  }

  private analyzeKeyPatterns(): Array<{ pattern: string; frequency: number }> {
    const patterns = new Map<string, number>();

    for (const key of this.keyAccessCounts.keys()) {
      const pattern = this.extractPattern(key);
      const count = patterns.get(pattern) || 0;
      patterns.set(pattern, count + 1);
    }

    return Array.from(patterns.entries())
      .map(([pattern, frequency]) => ({ pattern, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  private analyzeErrorPatterns(
    metrics: MetricCollection[],
  ): Array<{ type: string; count: number; lastOccurred: Date }> {
    const errorPatterns = new Map<string, { count: number; lastOccurred: Date }>();

    for (const metric of metrics) {
      if (metric.errors > 0) {
        const existing = errorPatterns.get('general') || { count: 0, lastOccurred: new Date(0) };
        errorPatterns.set('general', {
          count: existing.count + metric.errors,
          lastOccurred:
            metric.timestamp > existing.lastOccurred ? metric.timestamp : existing.lastOccurred,
        });
      }
    }

    return Array.from(errorPatterns.entries()).map(([type, data]) => ({ type, ...data }));
  }

  private calculateSummary(metrics: MetricCollection[]): CachePerformanceReport['summary'] {
    const totalRequests = metrics.reduce((sum, metric) => sum + metric.hits + metric.misses, 0);
    const totalHits = metrics.reduce((sum, metric) => sum + metric.hits, 0);
    const avgResponseTime =
      metrics.reduce((sum, metric) => sum + metric.avgResponseTime, 0) / metrics.length;
    const peakMemoryUsage = Math.max(...metrics.map((metric) => metric.memoryUsage));
    const totalErrors = metrics.reduce((sum, metric) => sum + metric.errors, 0);

    return {
      totalRequests,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      avgResponseTime,
      peakMemoryUsage,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
    };
  }

  private calculateAverageHitRate(): number {
    if (this.metrics.length === 0) return 0;

    const totalRequests = this.metrics.reduce(
      (sum, metric) => sum + metric.hits + metric.misses,
      0,
    );
    const totalHits = this.metrics.reduce((sum, metric) => sum + metric.hits, 0);

    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  private calculateAverageResponseTime(): number {
    if (this.metrics.length === 0) return 0;

    return (
      this.metrics.reduce((sum, metric) => sum + metric.avgResponseTime, 0) / this.metrics.length
    );
  }

  private getPeakMemoryUsage(): number {
    return Math.max(...this.metrics.map((metric) => metric.memoryUsage));
  }

  private generateOptimizationSuggestions(
    periodMetrics?: MetricCollection[],
  ): OptimizationSuggestion[] {
    const metrics = periodMetrics || this.metrics;
    const suggestions: OptimizationSuggestion[] = [];

    // Hit rate optimization
    const avgHitRate = this.calculateAverageHitRate();
    if (avgHitRate < this.config.performance.hitRateThreshold) {
      suggestions.push({
        type: 'ttl_adjustment',
        priority: 'high',
        description: 'Low cache hit rate detected',
        expectedImprovement: 'Increase hit rate by 15-25%',
        implementation: 'Increase TTL for frequently accessed items or implement cache warming',
      });
    }

    // Response time optimization
    const avgResponseTime = this.calculateAverageResponseTime();
    if (avgResponseTime > this.config.performance.responseTimeThreshold) {
      suggestions.push({
        type: 'serialization',
        priority: 'medium',
        description: 'High average response time detected',
        expectedImprovement: 'Reduce response time by 20-30%',
        implementation: 'Enable compression or use more efficient serialization format',
      });
    }

    // Memory usage optimization
    const peakMemory = this.getPeakMemoryUsage();
    if (peakMemory > 0.8) {
      suggestions.push({
        type: 'cache_size',
        priority: 'high',
        description: 'High memory usage detected',
        expectedImprovement: 'Reduce memory usage by 20-30%',
        implementation: 'Implement more aggressive eviction policies or reduce cache size',
      });
    }

    return suggestions;
  }

  private getRecentAlerts(hours: number): PerformanceAlert[] {
    const cutoffTime = Date.now() - hours * 3600000;
    return this.alerts.filter((alert) => alert.timestamp.getTime() >= cutoffTime);
  }

  private extractPattern(key: string): string {
    // Simple pattern extraction - could be enhanced with more sophisticated logic
    if (key.includes(':')) {
      return key.split(':')[0] + ':*';
    }
    if (key.includes('_')) {
      return key.split('_')[0] + '_*';
    }
    return key;
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    const headers = Object.keys(data);
    const values = headers.map((header) => JSON.stringify(data[header]));

    return [headers.join(','), values.join(',')].join('\n');
  }

  private initializeMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      keyCount: 0,
      hitRate: 0,
      missRate: 0,
      timestamp: new Date(),
    };
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }

    this.logger.info('Cache metrics collection stopped');
    this.emit('stopped');
  }
}
