/**
 * Search Performance Monitoring
 * Performance monitoring and optimization for the search system
 */

import { logger } from '../utils/logger';

export interface PerformanceMetrics {
  searchTime: number;
  indexTime: number;
  queryTime: number;
  scoringTime: number;
  totalTime: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  errorRate: number;
  requestCount: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'slow_query' | 'high_memory' | 'high_cpu' | 'cache_miss' | 'error_spike';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceReport {
  timeRange: string;
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  recommendations: string[];
  trends: PerformanceTrend[];
}

export interface PerformanceTrend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  change: number;
  significance: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  samplingRate: number;
  alertThresholds: {
    maxSearchTime: number;
    maxMemoryUsage: number;
    maxCpuUsage: number;
    minCacheHitRate: number;
    maxErrorRate: number;
  };
  retentionDays: number;
  reportInterval: number;
  enableAutoOptimization: boolean;
}

export class SearchPerformanceMonitor {
  private config: MonitoringConfig;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private startTime: Date = new Date();
  private lastReport: Date = new Date();

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      enabled: true,
      samplingRate: 1.0, // 100% sampling
      alertThresholds: {
        maxSearchTime: 2000, // 2 seconds
        maxMemoryUsage: 0.8, // 80%
        maxCpuUsage: 0.8, // 80%
        minCacheHitRate: 0.7, // 70%
        maxErrorRate: 0.05 // 5%
      },
      retentionDays: 30,
      reportInterval: 3600000, // 1 hour
      enableAutoOptimization: false,
      ...config
    };

    // Start periodic reporting
    this.startPeriodicReporting();
  }

  /**
   * Record search performance metrics
   */
  recordMetrics(metrics: Partial<PerformanceMetrics>): void {
    if (!this.config.enabled || Math.random() > this.config.samplingRate) {
      return;
    }

    const fullMetrics: PerformanceMetrics = {
      searchTime: metrics.searchTime || 0,
      indexTime: metrics.indexTime || 0,
      queryTime: metrics.queryTime || 0,
      scoringTime: metrics.scoringTime || 0,
      totalTime: metrics.totalTime || 0,
      memoryUsage: metrics.memoryUsage || 0,
      cpuUsage: metrics.cpuUsage || 0,
      cacheHitRate: metrics.cacheHitRate || 0,
      errorRate: metrics.errorRate || 0,
      requestCount: metrics.requestCount || 1
    };

    this.metrics.push(fullMetrics);

    // Check for performance alerts
    this.checkAlerts(fullMetrics);

    // Clean old metrics
    this.cleanOldMetrics();

    // Auto-optimize if enabled
    if (this.config.enableAutoOptimization) {
      this.performAutoOptimization(fullMetrics);
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    if (this.metrics.length === 0) {
      return this.getEmptyMetrics();
    }

    const recentMetrics = this.metrics.slice(-100); // Last 100 metrics
    return this.aggregateMetrics(recentMetrics);
  }

  /**
   * Get performance report
   */
  getPerformanceReport(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): PerformanceReport {
    const cutoff = this.getCutoffTime(timeRange);
    const relevantMetrics = this.metrics.filter(m => m.totalTime >= cutoff.getTime());

    const aggregatedMetrics = this.aggregateMetrics(relevantMetrics);
    const relevantAlerts = this.alerts.filter(a => a.timestamp >= cutoff && !a.resolved);
    const recommendations = this.generateRecommendations(aggregatedMetrics, relevantAlerts);
    const trends = this.calculateTrends(relevantMetrics);

    return {
      timeRange,
      metrics: aggregatedMetrics,
      alerts: relevantAlerts,
      recommendations,
      trends
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      logger.info(`Performance alert resolved: ${alert.message}`);
    }
  }

  /**
   * Get performance statistics
   */
  getStatistics(): {
    totalRequests: number;
    averageSearchTime: number;
    averageMemoryUsage: number;
    averageCpuUsage: number;
    cacheHitRate: number;
    errorRate: number;
    uptime: number;
    alertsCount: number;
  } {
    const metrics = this.getCurrentMetrics();
    const uptime = Date.now() - this.startTime.getTime();
    const alertsCount = this.getActiveAlerts().length;

    return {
      totalRequests: metrics.requestCount,
      averageSearchTime: metrics.searchTime,
      averageMemoryUsage: metrics.memoryUsage,
      averageCpuUsage: metrics.cpuUsage,
      cacheHitRate: metrics.cacheHitRate,
      errorRate: metrics.errorRate,
      uptime,
      alertsCount
    };
  }

  /**
   * Optimize search performance
   */
  async optimizePerformance(): Promise<string[]> {
    const optimizations: string[] = [];
    const metrics = this.getCurrentMetrics();

    // Check search time
    if (metrics.searchTime > this.config.alertThresholds.maxSearchTime) {
      optimizations.push('Consider optimizing search queries and adding proper indexes');
    }

    // Check memory usage
    if (metrics.memoryUsage > this.config.alertThresholds.maxMemoryUsage) {
      optimizations.push('High memory usage detected - consider increasing memory or optimizing data structures');
    }

    // Check cache hit rate
    if (metrics.cacheHitRate < this.config.alertThresholds.minCacheHitRate) {
      optimizations.push('Low cache hit rate - consider increasing cache size or adjusting cache strategy');
    }

    // Check error rate
    if (metrics.errorRate > this.config.alertThresholds.maxErrorRate) {
      optimizations.push('High error rate - investigate error logs and fix underlying issues');
    }

    return optimizations;
  }

  /**
   * Export performance data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      metrics: this.metrics,
      alerts: this.alerts,
      config: this.config,
      exportedAt: new Date()
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

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = [];
    this.startTime = new Date();
    logger.info('Performance metrics reset');
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Check search time
    if (metrics.searchTime > this.config.alertThresholds.maxSearchTime) {
      alerts.push({
        id: `slow_query_${Date.now()}`,
        type: 'slow_query',
        severity: this.getSeverity(metrics.searchTime, this.config.alertThresholds.maxSearchTime),
        message: `Slow search query detected: ${metrics.searchTime}ms`,
        value: metrics.searchTime,
        threshold: this.config.alertThresholds.maxSearchTime,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check memory usage
    if (metrics.memoryUsage > this.config.alertThresholds.maxMemoryUsage) {
      alerts.push({
        id: `high_memory_${Date.now()}`,
        type: 'high_memory',
        severity: this.getSeverity(metrics.memoryUsage, this.config.alertThresholds.maxMemoryUsage),
        message: `High memory usage: ${(metrics.memoryUsage * 100).toFixed(1)}%`,
        value: metrics.memoryUsage,
        threshold: this.config.alertThresholds.maxMemoryUsage,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check CPU usage
    if (metrics.cpuUsage > this.config.alertThresholds.maxCpuUsage) {
      alerts.push({
        id: `high_cpu_${Date.now()}`,
        type: 'high_cpu',
        severity: this.getSeverity(metrics.cpuUsage, this.config.alertThresholds.maxCpuUsage),
        message: `High CPU usage: ${(metrics.cpuUsage * 100).toFixed(1)}%`,
        value: metrics.cpuUsage,
        threshold: this.config.alertThresholds.maxCpuUsage,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check cache hit rate
    if (metrics.cacheHitRate < this.config.alertThresholds.minCacheHitRate) {
      alerts.push({
        id: `cache_miss_${Date.now()}`,
        type: 'cache_miss',
        severity: this.getSeverity(this.config.alertThresholds.minCacheHitRate - metrics.cacheHitRate, 0),
        message: `Low cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`,
        value: metrics.cacheHitRate,
        threshold: this.config.alertThresholds.minCacheHitRate,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check error rate
    if (metrics.errorRate > this.config.alertThresholds.maxErrorRate) {
      alerts.push({
        id: `error_spike_${Date.now()}`,
        type: 'error_spike',
        severity: this.getSeverity(metrics.errorRate, this.config.alertThresholds.maxErrorRate),
        message: `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        value: metrics.errorRate,
        threshold: this.config.alertThresholds.maxErrorRate,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Add new alerts
    this.alerts.push(...alerts);

    // Log alerts
    for (const alert of alerts) {
      logger.warn(`Performance alert: ${alert.message}`, {
        type: alert.type,
        severity: alert.severity,
        value: alert.value,
        threshold: alert.threshold
      });
    }
  }

  /**
   * Get alert severity based on value vs threshold
   */
  private getSeverity(value: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = value / threshold;
    
    if (ratio >= 2) return 'critical';
    if (ratio >= 1.5) return 'high';
    if (ratio >= 1.2) return 'medium';
    return 'low';
  }

  /**
   * Aggregate metrics
   */
  private aggregateMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    if (metrics.length === 0) {
      return this.getEmptyMetrics();
    }

    const total = metrics.reduce((sum, m) => sum + m.requestCount, 0);

    return {
      searchTime: this.weightedAverage(metrics, m => m.searchTime, m => m.requestCount) / total,
      indexTime: this.weightedAverage(metrics, m => m.indexTime, m => m.requestCount) / total,
      queryTime: this.weightedAverage(metrics, m => m.queryTime, m => m.requestCount) / total,
      scoringTime: this.weightedAverage(metrics, m => m.scoringTime, m => m.requestCount) / total,
      totalTime: this.weightedAverage(metrics, m => m.totalTime, m => m.requestCount) / total,
      memoryUsage: this.weightedAverage(metrics, m => m.memoryUsage, m => m.requestCount) / total,
      cpuUsage: this.weightedAverage(metrics, m => m.cpuUsage, m => m.requestCount) / total,
      cacheHitRate: this.weightedAverage(metrics, m => m.cacheHitRate, m => m.requestCount) / total,
      errorRate: this.weightedAverage(metrics, m => m.errorRate, m => m.requestCount) / total,
      requestCount: total
    };
  }

  /**
   * Calculate weighted average
   */
  private weightedAverage<T>(
    items: PerformanceMetrics[],
    getValue: (item: PerformanceMetrics) => T,
    getWeight: (item: PerformanceMetrics) => number
  ): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const item of items) {
      const weight = getWeight(item);
      const value = Number(getValue(item)) || 0;
      weightedSum += value * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: PerformanceMetrics, alerts: PerformanceAlert[]): string[] {
    const recommendations: string[] = [];

    // Based on metrics
    if (metrics.searchTime > 1000) {
      recommendations.push('Consider optimizing search queries and adding proper indexes');
    }

    if (metrics.cacheHitRate < 0.7) {
      recommendations.push('Increase cache size or adjust cache strategy to improve hit rate');
    }

    if (metrics.errorRate > 0.02) {
      recommendations.push('Investigate and fix the root cause of search errors');
    }

    if (metrics.memoryUsage > 0.7) {
      recommendations.push('Monitor memory usage and consider optimization or scaling');
    }

    // Based on alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('Address critical performance alerts immediately');
    }

    if (alerts.length > 10) {
      recommendations.push('Multiple performance issues detected - consider comprehensive optimization');
    }

    return recommendations;
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(metrics: PerformanceMetrics[]): PerformanceTrend[] {
    if (metrics.length < 10) {
      return [];
    }

    const trends: PerformanceTrend[] = [];
    const metricNames: (keyof PerformanceMetrics)[] = [
      'searchTime', 'memoryUsage', 'cpuUsage', 'cacheHitRate', 'errorRate'
    ];

    for (const metricName of metricNames) {
      const trend = this.calculateMetricTrend(metrics, metricName);
      if (trend) {
        trends.push(trend);
      }
    }

    return trends;
  }

  /**
   * Calculate trend for a specific metric
   */
  private calculateMetricTrend(metrics: PerformanceMetrics[], metricName: keyof PerformanceMetrics): PerformanceTrend | null {
    const values = metrics.map(m => m[metricName] as number);
    const midPoint = Math.floor(values.length / 2);
    
    const firstHalf = values.slice(0, midPoint);
    const secondHalf = values.slice(midPoint);

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const change = firstAvg > 0 ? (secondAvg - firstAvg) / firstAvg : 0;
    const significance = Math.abs(change);

    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (change > 0.05) direction = 'up';
    else if (change < -0.05) direction = 'down';

    return {
      metric: metricName,
      direction,
      change,
      significance
    };
  }

  /**
   * Perform auto-optimization
   */
  private performAutoOptimization(metrics: PerformanceMetrics): void {
    // Simple auto-optimization logic
    // In a real implementation, this would adjust search parameters dynamically
    
    if (metrics.searchTime > this.config.alertThresholds.maxSearchTime * 0.8) {
      logger.info('Auto-optimization: Reducing search complexity to improve performance');
      // This would trigger actual optimization logic
    }

    if (metrics.cacheHitRate < this.config.alertThresholds.minCacheHitRate * 0.8) {
      logger.info('Auto-optimization: Adjusting cache strategy to improve hit rate');
      // This would trigger cache optimization
    }
  }

  /**
   * Clean old metrics
   */
  private cleanOldMetrics(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.retentionDays);

    const beforeCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.totalTime >= cutoff.getTime());
    
    // Also clean old resolved alerts
    this.alerts = this.alerts.filter(a => 
      !a.resolved || a.resolvedAt! >= cutoff
    );

    if (this.metrics.length < beforeCount) {
      logger.debug(`Cleaned ${beforeCount - this.metrics.length} old performance metrics`);
    }
  }

  /**
   * Get cutoff time for time range
   */
  private getCutoffTime(timeRange: string): Date {
    const cutoff = new Date();
    
    switch (timeRange) {
      case 'hour':
        cutoff.setHours(cutoff.getHours() - 1);
        break;
      case 'day':
        cutoff.setDate(cutoff.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(cutoff.getMonth() - 1);
        break;
    }
    
    return cutoff;
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): PerformanceMetrics {
    return {
      searchTime: 0,
      indexTime: 0,
      queryTime: 0,
      scoringTime: 0,
      totalTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      cacheHitRate: 0,
      errorRate: 0,
      requestCount: 0
    };
  }

  /**
   * Convert data to CSV
   */
  private convertToCSV(data: any): string {
    const headers = [
      'timestamp', 'searchTime', 'indexTime', 'queryTime', 'scoringTime',
      'totalTime', 'memoryUsage', 'cpuUsage', 'cacheHitRate', 'errorRate', 'requestCount'
    ];

    const rows = data.metrics.map((m: PerformanceMetrics) => [
      new Date(m.totalTime).toISOString(),
      m.searchTime,
      m.indexTime,
      m.queryTime,
      m.scoringTime,
      m.totalTime,
      m.memoryUsage,
      m.cpuUsage,
      m.cacheHitRate,
      m.errorRate,
      m.requestCount
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Start periodic reporting
   */
  private startPeriodicReporting(): void {
    setInterval(() => {
      const report = this.getPerformanceReport('hour');
      
      // Log summary
      logger.info('Performance Report', {
        timeRange: report.timeRange,
        averageSearchTime: report.metrics.searchTime,
        cacheHitRate: report.metrics.cacheHitRate,
        errorRate: report.metrics.errorRate,
        alertsCount: report.alerts.length,
        recommendationsCount: report.recommendations.length
      });

      // Store report for historical analysis
      this.lastReport = new Date();
    }, this.config.reportInterval);
  }
}

export default SearchPerformanceMonitor;
