import { logger } from '../utils/logger';

export interface MonitoringConfig {
  enableMetrics: boolean;
  enableTracing: boolean;
  enableLogging: boolean;
  enableAlerting: boolean;
  enableAnalytics: boolean;
  metricsInterval: number;
  retentionPeriod: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
    cacheHitRate: number;
  };
  analytics: {
    enableRealTime: boolean;
    enableHistorical: boolean;
    enablePredictive: boolean;
    enableAnomalyDetection: boolean;
    enablePerformanceAnalysis: boolean;
    enableUserBehaviorAnalysis: boolean;
  };
}

export interface GatewayMetrics {
  timestamp: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    blocked: number;
    rateLimited: number;
    byMethod: Record<string, number>;
    byPath: Record<string, number>;
    byStatusCode: Record<string, number>;
  };
  responseTime: {
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  errors: {
    rate: number;
    count: number;
    byType: Record<string, number>;
    byEndpoint: Record<string, number>;
  };
  security: {
    violations: number;
    blockedRequests: number;
    riskScore: number;
    violationsByType: Record<string, number>;
    violationsByIP: Record<string, number>;
    violationsByUser: Record<string, number>;
  };
  rateLimit: {
    violations: number;
    blockedRequests: number;
    violationsByRule: Record<string, number>;
    violationsByIP: Record<string, number>;
  };
  cache: {
    hitRate: number;
    hits: number;
    misses: number;
    size: number;
    evictions: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    uptime: number;
  };
  transformations: {
    total: number;
    successful: number;
    failed: number;
    averageTime: number;
  };
  aggregations: {
    total: number;
    successful: number;
    failed: number;
    averageTime: number;
    active: number;
  };
  compositions: {
    total: number;
    successful: number;
    failed: number;
    averageTime: number;
    active: number;
  };
}

export interface Alert {
  id: string;
  type: 'error_rate' | 'response_time' | 'throughput' | 'memory' | 'cpu' | 'cache' | 'security' | 'rate_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata: {
    current: number;
    threshold: number;
    endpoint?: string;
    rule?: string;
    ip?: string;
  };
}

export interface AnalyticsData {
  timeRange: {
    start: number;
    end: number;
    interval: 'minute' | 'hour' | 'day' | 'week' | 'month';
  };
  metrics: GatewayMetrics[];
  trends: {
    requests: Array<{ timestamp: number; value: number }>;
    responseTime: Array<{ timestamp: number; value: number }>;
    errorRate: Array<{ timestamp: number; value: number }>;
    throughput: Array<{ timestamp: number; value: number }>;
  };
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
    averageResponseTime: number;
    errorRate: number;
  }>;
  topUsers: Array<{
    userId: string;
    requests: number;
    averageResponseTime: number;
    errorRate: number;
  }>;
  topIPs: Array<{
    ip: string;
    requests: number;
    averageResponseTime: number;
    violations: number;
  }>;
  anomalies: Array<{
    timestamp: number;
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    confidence: number;
  }>;
  predictions: {
    nextHourRequests: number;
    nextDayRequests: number;
    nextWeekRequests: number;
    errorRateTrend: 'increasing' | 'decreasing' | 'stable';
    performanceTrend: 'improving' | 'degrading' | 'stable';
  };
}

export class GatewayMonitoringService {
  private config: MonitoringConfig;
  private metrics: GatewayMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private activeAlerts: Set<string> = new Set();
  private metricsInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;
  private responseTimes: number[] = [];
  private requestCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enableMetrics: true,
      enableTracing: true,
      enableLogging: true,
      enableAlerting: true,
      enableAnalytics: true,
      metricsInterval: 30000, // 30 seconds
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      alertThresholds: {
        errorRate: 0.05, // 5%
        responseTime: 5000, // 5 seconds
        throughput: 100, // 100 req/s
        memoryUsage: 80, // 80%
        cpuUsage: 80, // 80%
        cacheHitRate: 0.5, // 50%
      },
      analytics: {
        enableRealTime: true,
        enableHistorical: true,
        enablePredictive: true,
        enableAnomalyDetection: true,
        enablePerformanceAnalysis: true,
        enableUserBehaviorAnalysis: true,
      },
      ...config,
    };

    this.startMetricsCollection();
    this.startCleanupProcess();
  }

  private startMetricsCollection(): void {
    if (!this.config.enableMetrics) return;

    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
  }

  private startCleanupProcess(): void {
    // Clean up old metrics every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);
  }

  public recordRequest(req: any, res: any, responseTime: number): void {
    if (!this.config.enableMetrics) return;

    const timestamp = Date.now();
    const path = req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    const success = statusCode >= 200 && statusCode < 400;

    // Update response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }

    // Update request counts
    const key = `${method}:${path}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);

    // Update error counts
    if (!success) {
      this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    }

    // Log if enabled
    if (this.config.enableLogging) {
      logger.info('Gateway request', {
        method,
        path,
        statusCode,
        responseTime,
        success,
        timestamp,
      });
    }
  }

  public recordError(type: string, error: any, metadata?: any): void {
    if (!this.config.enableMetrics) return;

    const timestamp = Date.now();
    
    if (this.config.enableLogging) {
      logger.error(`Gateway error: ${type}`, {
        error: error.message,
        stack: error.stack,
        metadata,
        timestamp,
      });
    }

    // Check for alert conditions
    if (this.config.enableAlerting) {
      this.checkErrorAlerts(type, metadata);
    }
  }

  public recordSecurityViolation(type: string, metadata: any): void {
    if (!this.config.enableMetrics) return;

    const timestamp = Date.now();
    
    if (this.config.enableLogging) {
      logger.warn(`Security violation: ${type}`, metadata);
    }

    // Check for security alerts
    if (this.config.enableAlerting) {
      this.checkSecurityAlerts(type, metadata);
    }
  }

  public recordRateLimitViolation(rule: string, metadata: any): void {
    if (!this.config.enableMetrics) return;

    const timestamp = Date.now();
    
    if (this.config.enableLogging) {
      logger.warn(`Rate limit violation: ${rule}`, metadata);
    }

    // Check for rate limit alerts
    if (this.config.enableAlerting) {
      this.checkRateLimitAlerts(rule, metadata);
    }
  }

  private collectMetrics(): void {
    const timestamp = Date.now();
    const currentMetrics = this.calculateCurrentMetrics(timestamp);
    
    this.metrics.push(currentMetrics);

    // Check alert thresholds
    if (this.config.enableAlerting) {
      this.checkAlertThresholds(currentMetrics);
    }

    // Detect anomalies
    if (this.config.analytics.enableAnomalyDetection) {
      this.detectAnomalies(currentMetrics);
    }
  }

  private calculateCurrentMetrics(timestamp: number): GatewayMetrics {
    const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

    const responseTimeStats = this.calculateResponseTimeStats();
    const throughput = this.calculateThroughput();

    return {
      timestamp,
      requests: {
        total: totalRequests,
        successful: totalRequests - totalErrors,
        failed: totalErrors,
        blocked: 0, // Would be tracked separately
        rateLimited: 0, // Would be tracked separately
        byMethod: this.groupByMethod(),
        byPath: this.groupByPath(),
        byStatusCode: {}, // Would be tracked separately
      },
      responseTime: responseTimeStats,
      throughput: throughput,
      errors: {
        rate: errorRate,
        count: totalErrors,
        byType: {}, // Would be tracked separately
        byEndpoint: Object.fromEntries(this.errorCounts),
      },
      security: {
        violations: 0, // Would be tracked separately
        blockedRequests: 0, // Would be tracked separately
        riskScore: 0, // Would be calculated separately
        violationsByType: {}, // Would be tracked separately
        violationsByIP: {}, // Would be tracked separately
        violationsByUser: {}, // Would be tracked separately
      },
      rateLimit: {
        violations: 0, // Would be tracked separately
        blockedRequests: 0, // Would be tracked separately
        violationsByRule: {}, // Would be tracked separately
        violationsByIP: {}, // Would be tracked separately
      },
      cache: {
        hitRate: 0, // Would be tracked separately
        hits: 0, // Would be tracked separately
        misses: 0, // Would be tracked separately
        size: 0, // Would be tracked separately
        evictions: 0, // Would be tracked separately
      },
      system: {
        memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100,
        cpuUsage: 0, // Would be calculated separately
        activeConnections: 0, // Would be tracked separately
        uptime: process.uptime(),
      },
      transformations: {
        total: 0, // Would be tracked separately
        successful: 0, // Would be tracked separately
        failed: 0, // Would be tracked separately
        averageTime: 0, // Would be tracked separately
      },
      aggregations: {
        total: 0, // Would be tracked separately
        successful: 0, // Would be tracked separately
        failed: 0, // Would be tracked separately
        averageTime: 0, // Would be tracked separately
        active: 0, // Would be tracked separately
      },
      compositions: {
        total: 0, // Would be tracked separately
        successful: 0, // Would be tracked separately
        failed: 0, // Would be tracked separately
        averageTime: 0, // Would be tracked separately
        active: 0, // Would be tracked separately
      },
    };
  }

  private calculateResponseTimeStats(): any {
    if (this.responseTimes.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      average: this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length,
      min: sorted[0],
      max: sorted[len - 1],
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
    };
  }

  private calculateThroughput(): any {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    // This is simplified - in production, track timestamps for each request
    const requestsPerMinute = this.responseTimes.length; // Simplified
    const requestsPerHour = requestsPerMinute * 60;
    const requestsPerSecond = requestsPerMinute / 60;

    return {
      requestsPerSecond,
      requestsPerMinute,
      requestsPerHour,
    };
  }

  private groupByMethod(): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const [key, count] of this.requestCounts.entries()) {
      const method = key.split(':')[0];
      grouped[method] = (grouped[method] || 0) + count;
    }

    return grouped;
  }

  private groupByPath(): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const [key, count] of this.requestCounts.entries()) {
      const path = key.split(':')[1];
      grouped[path] = (grouped[path] || 0) + count;
    }

    return grouped;
  }

  private checkAlertThresholds(metrics: GatewayMetrics): void {
    const thresholds = this.config.alertThresholds;

    // Check error rate
    if (metrics.errors.rate > thresholds.errorRate) {
      this.createAlert('error_rate', 'high', 'High Error Rate', 
        `Error rate ${(metrics.errors.rate * 100).toFixed(2)}% exceeds threshold ${(thresholds.errorRate * 100).toFixed(2)}%`,
        { current: metrics.errors.rate, threshold: thresholds.errorRate });
    }

    // Check response time
    if (metrics.responseTime.average > thresholds.responseTime) {
      this.createAlert('response_time', 'medium', 'High Response Time',
        `Average response time ${metrics.responseTime.average}ms exceeds threshold ${thresholds.responseTime}ms`,
        { current: metrics.responseTime.average, threshold: thresholds.responseTime });
    }

    // Check throughput
    if (metrics.throughput.requestsPerSecond < thresholds.throughput) {
      this.createAlert('throughput', 'medium', 'Low Throughput',
        `Throughput ${metrics.throughput.requestsPerSecond} req/s below threshold ${thresholds.throughput} req/s`,
        { current: metrics.throughput.requestsPerSecond, threshold: thresholds.throughput });
    }

    // Check memory usage
    if (metrics.system.memoryUsage > thresholds.memoryUsage) {
      this.createAlert('memory', 'high', 'High Memory Usage',
        `Memory usage ${metrics.system.memoryUsage.toFixed(2)}% exceeds threshold ${thresholds.memoryUsage}%`,
        { current: metrics.system.memoryUsage, threshold: thresholds.memoryUsage });
    }

    // Check cache hit rate
    if (metrics.cache.hitRate < thresholds.cacheHitRate) {
      this.createAlert('cache', 'low', 'Low Cache Hit Rate',
        `Cache hit rate ${(metrics.cache.hitRate * 100).toFixed(2)}% below threshold ${(thresholds.cacheHitRate * 100).toFixed(2)}%`,
        { current: metrics.cache.hitRate, threshold: thresholds.cacheHitRate });
    }
  }

  private checkErrorAlerts(type: string, metadata?: any): void {
    // Check for specific error patterns
    if (type === 'gateway_error') {
      this.createAlert('error_rate', 'medium', 'Gateway Error',
        `Gateway error occurred: ${metadata?.error || 'Unknown error'}`,
        { current: 1, threshold: 0, endpoint: metadata?.path });
    }
  }

  private checkSecurityAlerts(type: string, metadata: any): void {
    const severity = type === 'xss' || type === 'sql_injection' ? 'critical' : 'medium';
    
    this.createAlert('security', severity, `Security Violation: ${type}`,
      `Security violation detected: ${type}`,
      { 
        current: 1, 
        threshold: 0, 
        type, 
        ip: metadata?.ip, 
        endpoint: metadata?.endpoint 
      });
  }

  private checkRateLimitAlerts(rule: string, metadata: any): void {
    this.createAlert('rate_limit', 'medium', `Rate Limit Violation: ${rule}`,
      `Rate limit violation for rule: ${rule}`,
      { 
        current: 1, 
        threshold: 0, 
        rule, 
        ip: metadata?.ip 
      });
  }

  private createAlert(
    type: string, 
    severity: 'low' | 'medium' | 'high' | 'critical',
    title: string, 
    message: string, 
    metadata: any
  ): void {
    const alertId = `${type}_${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      type,
      severity,
      title,
      message,
      timestamp: Date.now(),
      resolved: false,
      metadata,
    };

    this.alerts.set(alertId, alert);
    this.activeAlerts.add(alertId);

    logger.warn(`Alert created: ${title}`, { alert });
  }

  private detectAnomalies(metrics: GatewayMetrics): void {
    // Simple anomaly detection - in production, use machine learning
    if (this.metrics.length < 10) return;

    const recentMetrics = this.metrics.slice(-10);
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime.average, 0) / recentMetrics.length;
    const avgErrorRate = recentMetrics.reduce((sum, m) => sum + m.errors.rate, 0) / recentMetrics.length;

    // Detect response time anomalies
    if (metrics.responseTime.average > avgResponseTime * 2) {
      logger.warn('Response time anomaly detected', {
        current: metrics.responseTime.average,
        average: avgResponseTime,
      });
    }

    // Detect error rate anomalies
    if (metrics.errors.rate > avgErrorRate * 2) {
      logger.warn('Error rate anomaly detected', {
        current: metrics.errors.rate,
        average: avgErrorRate,
      });
    }
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoffTime);
    
    // Clean up resolved alerts
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoffTime) {
        this.alerts.delete(alertId);
        this.activeAlerts.delete(alertId);
      }
    }
  }

  // Public API methods
  public async getMetrics(timeRange?: { start: number; end: number }): Promise<GatewayMetrics[]> {
    if (!timeRange) {
      return this.metrics;
    }

    return this.metrics.filter(metric => 
      metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
    );
  }

  public async getRealTimeMetrics(): Promise<GatewayMetrics | null> {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  public async getAlerts(activeOnly: boolean = false): Promise<Alert[]> {
    const alerts = Array.from(this.alerts.values());
    
    if (activeOnly) {
      return alerts.filter(alert => !alert.resolved);
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  public async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.activeAlerts.delete(alertId);
      
      logger.info(`Alert resolved: ${alert.title}`, { alert });
    }
  }

  public async getAnalytics(timeRange: { start: number; end: number }): Promise<AnalyticsData> {
    const filteredMetrics = this.metrics.filter(metric => 
      metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
    );

    return {
      timeRange: {
        ...timeRange,
        interval: 'minute', // Determine based on range
      },
      metrics: filteredMetrics,
      trends: this.calculateTrends(filteredMetrics),
      topEndpoints: this.getTopEndpoints(filteredMetrics),
      topUsers: [], // Would be tracked separately
      topIPs: [], // Would be tracked separately
      anomalies: this.detectAnomaliesInTimeRange(filteredMetrics),
      predictions: this.makePredictions(filteredMetrics),
    };
  }

  private calculateTrends(metrics: GatewayMetrics[]): any {
    return {
      requests: metrics.map(m => ({ timestamp: m.timestamp, value: m.requests.total })),
      responseTime: metrics.map(m => ({ timestamp: m.timestamp, value: m.responseTime.average })),
      errorRate: metrics.map(m => ({ timestamp: m.timestamp, value: m.errors.rate })),
      throughput: metrics.map(m => ({ timestamp: m.timestamp, value: m.throughput.requestsPerSecond })),
    };
  }

  private getTopEndpoints(metrics: GatewayMetrics[]): any[] {
    const endpointStats: Record<string, { requests: number; totalTime: number; errors: number }> = {};

    for (const metric of metrics) {
      for (const [path, count] of Object.entries(metric.requests.byPath)) {
        if (!endpointStats[path]) {
          endpointStats[path] = { requests: 0, totalTime: 0, errors: 0 };
        }
        endpointStats[path].requests += count;
        endpointStats[path].totalTime += metric.responseTime.average * count;
        endpointStats[path].errors += metric.errors.byEndpoint[path] || 0;
      }
    }

    return Object.entries(endpointStats)
      .map(([endpoint, stats]) => ({
        endpoint,
        requests: stats.requests,
        averageResponseTime: stats.totalTime / stats.requests,
        errorRate: stats.errors / stats.requests,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }

  private detectAnomaliesInTimeRange(metrics: GatewayMetrics[]): any[] {
    // Simplified anomaly detection
    const anomalies: any[] = [];

    if (metrics.length < 5) return anomalies;

    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime.average, 0) / metrics.length;
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errors.rate, 0) / metrics.length;

    for (const metric of metrics) {
      if (metric.responseTime.average > avgResponseTime * 3) {
        anomalies.push({
          timestamp: metric.timestamp,
          type: 'response_time',
          severity: 'high',
          description: 'Unusually high response time',
          confidence: 0.8,
        });
      }

      if (metric.errors.rate > avgErrorRate * 3) {
        anomalies.push({
          timestamp: metric.timestamp,
          type: 'error_rate',
          severity: 'high',
          description: 'Unusually high error rate',
          confidence: 0.9,
        });
      }
    }

    return anomalies;
  }

  private makePredictions(metrics: GatewayMetrics[]): any {
    if (metrics.length < 10) {
      return {
        nextHourRequests: 0,
        nextDayRequests: 0,
        nextWeekRequests: 0,
        errorRateTrend: 'stable',
        performanceTrend: 'stable',
      };
    }

    // Simple linear regression for predictions
    const recentMetrics = metrics.slice(-10);
    const requestRates = recentMetrics.map(m => m.throughput.requestsPerSecond);
    const errorRates = recentMetrics.map(m => m.errors.rate);
    const responseTimes = recentMetrics.map(m => m.responseTime.average);

    const avgRequestRate = requestRates.reduce((sum, rate) => sum + rate, 0) / requestRates.length;
    const avgErrorRate = errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length;
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    // Simple trend calculation
    const errorTrend = errorRates[errorRates.length - 1] > errorRates[0] ? 'increasing' : 
                      errorRates[errorRates.length - 1] < errorRates[0] ? 'decreasing' : 'stable';
    
    const performanceTrend = responseTimes[responseTimes.length - 1] > responseTimes[0] ? 'degrading' :
                           responseTimes[responseTimes.length - 1] < responseTimes[0] ? 'improving' : 'stable';

    return {
      nextHourRequests: Math.round(avgRequestRate * 3600),
      nextDayRequests: Math.round(avgRequestRate * 86400),
      nextWeekRequests: Math.round(avgRequestRate * 604800),
      errorRateTrend: errorTrend,
      performanceTrend: performanceTrend,
    };
  }

  public getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart metrics collection if interval changed
    if (newConfig.metricsInterval && this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.startMetricsCollection();
    }
    
    logger.info('GatewayMonitoringService configuration updated');
  }

  public destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    logger.info('GatewayMonitoringService destroyed');
  }
}
