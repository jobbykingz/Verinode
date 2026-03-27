import { EventEmitter } from 'events';
import { WinstonLogger } from '../utils/logger';
import { 
  CacheAnalytics, 
  CacheInsight, 
  CacheOptimization,
  CachePattern,
  CachePrediction,
  CacheConfiguration
} from '../models/CachePattern';

export interface PerformanceMetrics {
  timestamp: Date;
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkIO: number;
  errorRate: number;
  throughput: number;
  evictionRate: number;
  predictionAccuracy: number;
  optimizationImpact: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'performance' | 'resource' | 'prediction' | 'optimization';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  threshold: number;
  trend: 'improving' | 'degrading' | 'stable';
  recommendations: string[];
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    overallScore: number;
    hitRateScore: number;
    responseTimeScore: number;
    resourceEfficiencyScore: number;
    predictionAccuracyScore: number;
    optimizationEffectivenessScore: number;
  };
  metrics: PerformanceMetrics[];
  alerts: PerformanceAlert[];
  insights: CacheInsight[];
  trends: {
    hitRate: TrendAnalysis;
    responseTime: TrendAnalysis;
    memoryUsage: TrendAnalysis;
    predictionAccuracy: TrendAnalysis;
  };
  recommendations: string[];
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  correlation: number;
  confidence: number;
  forecast: {
    nextPeriod: number;
    upperBound: number;
    lowerBound: number;
  };
}

export interface PerformanceThresholds {
  hitRate: { min: number; target: number; critical: number };
  responseTime: { max: number; target: number; critical: number };
  memoryUsage: { max: number; warning: number; critical: number };
  errorRate: { max: number; warning: number; critical: number };
  predictionAccuracy: { min: number; target: number; critical: number };
  throughput: { min: number; target: number; critical: number };
}

export interface PerformanceMonitoringConfig {
  monitoringInterval: number;
  metricsRetentionPeriod: number;
  alertCooldownPeriod: number;
  trendAnalysisWindow: number;
  forecastHorizon: number;
  thresholds: PerformanceThresholds;
  enableRealTimeAlerts: boolean;
  enableTrendAnalysis: boolean;
  enableForecasting: boolean;
}

export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitoringConfig;
  private logger: WinstonLogger;
  private metrics: PerformanceMetrics[];
  private alerts: PerformanceAlert[];
  private insights: CacheInsight[];
  private monitoringTimer?: NodeJS.Timeout;
  private alertCooldowns: Map<string, Date> = new Map();
  private isInitialized: boolean = false;

  constructor(config: PerformanceMonitoringConfig) {
    super();
    this.config = config;
    this.logger = new WinstonLogger();
    this.metrics = [];
    this.alerts = [];
    this.insights = [];
  }

  /**
   * Initialize the performance monitor
   */
  async initialize(): Promise<void> {
    try {
      this.startMonitoring();
      this.isInitialized = true;
      this.logger.info('Performance Monitor initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Performance Monitor', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Record performance metrics
   */
  recordMetrics(metrics: Partial<PerformanceMetrics>): void {
    const fullMetrics: PerformanceMetrics = {
      timestamp: new Date(),
      hitRate: metrics.hitRate || 0,
      missRate: metrics.missRate || 0,
      avgResponseTime: metrics.avgResponseTime || 0,
      memoryUsage: metrics.memoryUsage || 0,
      cpuUsage: metrics.cpuUsage || 0,
      networkIO: metrics.networkIO || 0,
      errorRate: metrics.errorRate || 0,
      throughput: metrics.throughput || 0,
      evictionRate: metrics.evictionRate || 0,
      predictionAccuracy: metrics.predictionAccuracy || 0,
      optimizationImpact: metrics.optimizationImpact || 0
    };

    this.metrics.push(fullMetrics);
    
    // Keep only metrics within retention period
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod * 1000;
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);
    
    // Check for alerts
    this.checkAlerts(fullMetrics);
    
    this.emit('metricsRecorded', fullMetrics);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? { ...this.metrics[this.metrics.length - 1] } : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(duration?: number): PerformanceMetrics[] {
    if (!duration) {
      return [...this.metrics];
    }
    
    const cutoffTime = Date.now() - duration * 1000;
    return this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);
  }

  /**
   * Get performance alerts
   */
  getAlerts(includeResolved: boolean = false): PerformanceAlert[] {
    return this.alerts.filter(alert => includeResolved || !alert.resolved);
  }

  /**
   * Get performance insights
   */
  getInsights(): CacheInsight[] {
    return [...this.insights];
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(periodHours: number = 24): PerformanceReport {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - periodHours * 3600000);
    
    const periodMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
    
    if (periodMetrics.length === 0) {
      return this.createEmptyReport(startTime, endTime);
    }
    
    // Calculate summary scores
    const summary = this.calculateSummaryScores(periodMetrics);
    
    // Analyze trends
    const trends = this.analyzeTrends(periodMetrics);
    
    // Generate insights
    const insights = this.generatePerformanceInsights(periodMetrics);
    
    // Get alerts for the period
    const periodAlerts = this.alerts.filter(alert => 
      alert.timestamp >= startTime && alert.timestamp <= endTime
    );
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, trends, periodAlerts);
    
    return {
      period: { start: startTime, end: endTime },
      summary,
      metrics: periodMetrics,
      alerts: periodAlerts,
      insights,
      trends,
      recommendations
    };
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      this.logger.info(`Alert acknowledged: ${alertId}`);
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      this.logger.info(`Alert resolved: ${alertId}`);
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get performance score
   */
  getPerformanceScore(): number {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) {
      return 0;
    }
    
    const weights = {
      hitRate: 0.3,
      responseTime: 0.25,
      memoryUsage: 0.2,
      predictionAccuracy: 0.15,
      errorRate: 0.1
    };
    
    const scores = {
      hitRate: this.normalizeScore(currentMetrics.hitRate, 0, 1, true),
      responseTime: this.normalizeScore(currentMetrics.avgResponseTime, 0, 1000, false),
      memoryUsage: this.normalizeScore(currentMetrics.memoryUsage, 0, 1, false),
      predictionAccuracy: this.normalizeScore(currentMetrics.predictionAccuracy, 0, 1, true),
      errorRate: this.normalizeScore(currentMetrics.errorRate, 0, 0.1, false)
    };
    
    const weightedScore = Object.entries(weights).reduce((sum, [metric, weight]) => 
      sum + scores[metric as keyof typeof scores] * weight, 0
    );
    
    return Math.round(weightedScore * 100);
  }

  /**
   * Shutdown the performance monitor
   */
  shutdown(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    
    this.isInitialized = false;
    this.logger.info('Performance Monitor shutdown completed');
    this.emit('shutdown');
  }

  // Private methods

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.performMonitoringCycle();
    }, this.config.monitoringInterval * 1000);
  }

  private performMonitoringCycle(): void {
    try {
      // Collect system metrics (simplified)
      const systemMetrics = this.collectSystemMetrics();
      
      // Record metrics
      this.recordMetrics(systemMetrics);
      
      // Clean up old alerts
      this.cleanupOldAlerts();
      
      // Generate periodic insights
      if (Date.now() % (this.config.monitoringInterval * 10) < this.config.monitoringInterval) {
        this.generatePeriodicInsights();
      }
      
    } catch (error) {
      this.logger.error('Performance monitoring cycle failed', error);
      this.emit('error', error);
    }
  }

  private collectSystemMetrics(): Partial<PerformanceMetrics> {
    // In a real implementation, this would collect actual system metrics
    // For now, return simulated data
    return {
      hitRate: 0.7 + Math.random() * 0.2,
      avgResponseTime: 50 + Math.random() * 100,
      memoryUsage: 0.5 + Math.random() * 0.3,
      cpuUsage: 0.3 + Math.random() * 0.4,
      errorRate: Math.random() * 0.05,
      throughput: 1000 + Math.random() * 500,
      predictionAccuracy: 0.6 + Math.random() * 0.3,
      optimizationImpact: Math.random() * 0.2
    };
  }

  private checkAlerts(metrics: PerformanceMetrics): void {
    const thresholds = this.config.thresholds;
    
    // Check hit rate
    this.checkMetricAlert(
      'hitRate',
      metrics.hitRate,
      thresholds.hitRate,
      true,
      'Cache Hit Rate',
      'Cache hit rate is below acceptable levels'
    );
    
    // Check response time
    this.checkMetricAlert(
      'responseTime',
      metrics.avgResponseTime,
      thresholds.responseTime,
      false,
      'Response Time',
      'Average response time is above acceptable levels'
    );
    
    // Check memory usage
    this.checkMetricAlert(
      'memoryUsage',
      metrics.memoryUsage,
      thresholds.memoryUsage,
      false,
      'Memory Usage',
      'Memory usage is above acceptable levels'
    );
    
    // Check error rate
    this.checkMetricAlert(
      'errorRate',
      metrics.errorRate,
      thresholds.errorRate,
      false,
      'Error Rate',
      'Error rate is above acceptable levels'
    );
    
    // Check prediction accuracy
    this.checkMetricAlert(
      'predictionAccuracy',
      metrics.predictionAccuracy,
      thresholds.predictionAccuracy,
      true,
      'Prediction Accuracy',
      'ML prediction accuracy is below acceptable levels'
    );
  }

  private checkMetricAlert(
    metricName: string,
    value: number,
    thresholds: { min?: number; max?: number; target: number; critical: number },
    higherIsBetter: boolean,
    title: string,
    description: string
  ): void {
    const alertKey = `${metricName}_alert`;
    
    // Check cooldown
    const lastAlert = this.alertCooldowns.get(alertKey);
    if (lastAlert && Date.now() - lastAlert.getTime() < this.config.alertCooldownPeriod * 1000) {
      return;
    }
    
    let severity: PerformanceAlert['severity'] | null = null;
    let threshold: number;
    
    if (higherIsBetter) {
      if (value < thresholds.critical) {
        severity = 'critical';
        threshold = thresholds.critical;
      } else if (value < thresholds.target) {
        severity = 'warning';
        threshold = thresholds.target;
      } else if (thresholds.min && value < thresholds.min) {
        severity = 'warning';
        threshold = thresholds.min;
      }
    } else {
      if (value > thresholds.critical) {
        severity = 'critical';
        threshold = thresholds.critical;
      } else if (value > thresholds.target) {
        severity = 'warning';
        threshold = thresholds.target;
      } else if (thresholds.max && value > thresholds.max) {
        severity = 'warning';
        threshold = thresholds.max;
      }
    }
    
    if (severity) {
      const alert: PerformanceAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'performance',
        severity,
        title,
        description: `${description}: ${value.toFixed(3)} (threshold: ${threshold})`,
        metric: metricName,
        currentValue: value,
        threshold,
        trend: this.calculateTrend(metricName),
        recommendations: this.generateAlertRecommendations(metricName, value, thresholds),
        timestamp: new Date(),
        acknowledged: false,
        resolved: false
      };
      
      this.alerts.push(alert);
      this.alertCooldowns.set(alertKey, new Date());
      
      this.emit('alert', alert);
      this.logger.warn(`Performance alert: ${title}`, { metric: metricName, value, threshold });
    }
  }

  private calculateTrend(metricName: string): TrendAnalysis['direction'] {
    const recentMetrics = this.metrics.slice(-10); // Last 10 data points
    if (recentMetrics.length < 3) {
      return 'stable';
    }
    
    const values = recentMetrics.map(m => m[metricName as keyof PerformanceMetrics] as number);
    const slope = this.calculateLinearTrend(values);
    
    if (Math.abs(slope) < 0.01) {
      return 'stable';
    } else if (slope > 0) {
      return 'increasing';
    } else {
      return 'decreasing';
    }
  }

  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  private generateAlertRecommendations(
    metricName: string,
    value: number,
    thresholds: { min?: number; max?: number; target: number; critical: number }
  ): string[] {
    const recommendations: string[] = [];
    
    switch (metricName) {
      case 'hitRate':
        recommendations.push('Consider enabling cache warming for frequently accessed items');
        recommendations.push('Review and optimize TTL settings');
        recommendations.push('Increase cache size if memory permits');
        break;
      
      case 'responseTime':
        recommendations.push('Optimize serialization and compression settings');
        recommendations.push('Consider using faster storage for hot items');
        recommendations.push('Review network configuration and latency');
        break;
      
      case 'memoryUsage':
        recommendations.push('Implement more aggressive eviction policies');
        recommendations.push('Enable compression for cached items');
        recommendations.push('Consider partitioning cache by access patterns');
        break;
      
      case 'errorRate':
        recommendations.push('Review error logs for common issues');
        recommendations.push('Implement circuit breakers for external dependencies');
        recommendations.push('Add retry logic for transient failures');
        break;
      
      case 'predictionAccuracy':
        recommendations.push('Retrain ML models with recent data');
        recommendations.push('Review feature engineering for predictions');
        recommendations.push('Consider ensemble methods for better accuracy');
        break;
    }
    
    return recommendations;
  }

  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - 24 * 3600000; // Keep alerts for 24 hours
    this.alerts = this.alerts.filter(alert => 
      alert.timestamp.getTime() > cutoffTime || !alert.resolved
    );
    
    // Clean up cooldowns
    for (const [key, time] of this.alertCooldowns.entries()) {
      if (Date.now() - time.getTime() > this.config.alertCooldownPeriod * 1000) {
        this.alertCooldowns.delete(key);
      }
    }
  }

  private generatePeriodicInsights(): void {
    const recentMetrics = this.metrics.slice(-60); // Last hour of metrics
    if (recentMetrics.length < 10) {
      return;
    }
    
    const insights: CacheInsight[] = [];
    
    // Performance trend insight
    const performanceTrend = this.calculateTrend('hitRate');
    if (performanceTrend === 'decreasing') {
      insights.push({
        id: `insight_performance_${Date.now()}`,
        type: 'pattern',
        severity: 'warning',
        title: 'Performance Trending Downward',
        description: 'Cache hit rate has been decreasing over the past hour',
        data: { trend: performanceTrend },
        recommendations: ['Investigate recent changes', 'Check for memory pressure', 'Review access patterns'],
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    // Resource efficiency insight
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
    if (avgMemoryUsage > 0.8) {
      insights.push({
        id: `insight_memory_${Date.now()}`,
        type: 'pattern',
        severity: 'warning',
        title: 'High Memory Usage',
        description: `Average memory usage is ${(avgMemoryUsage * 100).toFixed(1)}%`,
        data: { avgMemoryUsage },
        recommendations: ['Consider cache size optimization', 'Enable compression', 'Review eviction policies'],
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    this.insights.push(...insights);
    
    // Keep only recent insights
    const insightCutoff = Date.now() - 6 * 3600000; // Keep insights for 6 hours
    this.insights = this.insights.filter(insight => insight.timestamp.getTime() > insightCutoff);
  }

  private calculateSummaryScores(metrics: PerformanceMetrics[]): PerformanceReport['summary'] {
    if (metrics.length === 0) {
      return {
        overallScore: 0,
        hitRateScore: 0,
        responseTimeScore: 0,
        resourceEfficiencyScore: 0,
        predictionAccuracyScore: 0,
        optimizationEffectivenessScore: 0
      };
    }
    
    const avgMetrics = {
      hitRate: metrics.reduce((sum, m) => sum + m.hitRate, 0) / metrics.length,
      avgResponseTime: metrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / metrics.length,
      memoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length,
      predictionAccuracy: metrics.reduce((sum, m) => sum + m.predictionAccuracy, 0) / metrics.length,
      optimizationImpact: metrics.reduce((sum, m) => sum + m.optimizationImpact, 0) / metrics.length
    };
    
    return {
      overallScore: this.getPerformanceScore(),
      hitRateScore: Math.round(avgMetrics.hitRate * 100),
      responseTimeScore: Math.round(this.normalizeScore(avgMetrics.avgResponseTime, 0, 1000, false) * 100),
      resourceEfficiencyScore: Math.round(this.normalizeScore(avgMetrics.memoryUsage, 0, 1, false) * 100),
      predictionAccuracyScore: Math.round(avgMetrics.predictionAccuracy * 100),
      optimizationEffectivenessScore: Math.round(avgMetrics.optimizationImpact * 100)
    };
  }

  private analyzeTrends(metrics: PerformanceMetrics[]): PerformanceReport['trends'] {
    const analyzeMetric = (metricName: keyof PerformanceMetrics): TrendAnalysis => {
      const values = metrics.map(m => m[metricName] as number);
      const slope = this.calculateLinearTrend(values);
      
      // Calculate correlation
      const n = values.length;
      const x = Array.from({ length: n }, (_, i) => i);
      const correlation = this.calculateCorrelation(x, values);
      
      // Simple forecast
      const lastValue = values[values.length - 1];
      const forecastValue = lastValue + slope * this.config.forecastHorizon;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - lastValue, 2), 0) / values.length;
      const stdError = Math.sqrt(variance);
      
      return {
        direction: this.getTrendDirection(slope),
        slope,
        correlation,
        confidence: Math.min(Math.abs(correlation), 1),
        forecast: {
          nextPeriod: forecastValue,
          upperBound: forecastValue + 1.96 * stdError,
          lowerBound: Math.max(0, forecastValue - 1.96 * stdError)
        }
      };
    };
    
    return {
      hitRate: analyzeMetric('hitRate'),
      responseTime: analyzeMetric('avgResponseTime'),
      memoryUsage: analyzeMetric('memoryUsage'),
      predictionAccuracy: analyzeMetric('predictionAccuracy')
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private getTrendDirection(slope: number): TrendAnalysis['direction'] {
    if (Math.abs(slope) < 0.01) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  private generatePerformanceInsights(metrics: PerformanceMetrics[]): CacheInsight[] {
    const insights: CacheInsight[] = [];
    
    if (metrics.length < 10) return insights;
    
    const recentMetrics = metrics.slice(-10);
    const olderMetrics = metrics.slice(-20, -10);
    
    // Compare recent vs older performance
    const recentHitRate = recentMetrics.reduce((sum, m) => sum + m.hitRate, 0) / recentMetrics.length;
    const olderHitRate = olderMetrics.reduce((sum, m) => sum + m.hitRate, 0) / olderMetrics.length;
    
    const hitRateChange = recentHitRate - olderHitRate;
    
    if (hitRateChange < -0.1) {
      insights.push({
        id: `insight_hitrate_decline_${Date.now()}`,
        type: 'pattern',
        severity: 'warning',
        title: 'Hit Rate Declining',
        description: `Hit rate has decreased by ${(hitRateChange * 100).toFixed(1)}% recently`,
        data: { recentHitRate, olderHitRate, change: hitRateChange },
        recommendations: ['Investigate recent cache configuration changes', 'Check for memory pressure', 'Review access patterns'],
        timestamp: new Date(),
        acknowledged: false
      });
    } else if (hitRateChange > 0.1) {
      insights.push({
        id: `insight_hitrate_improvement_${Date.now()}`,
        type: 'pattern',
        severity: 'info',
        title: 'Hit Rate Improving',
        description: `Hit rate has improved by ${(hitRateChange * 100).toFixed(1)}% recently`,
        data: { recentHitRate, olderHitRate, change: hitRateChange },
        recommendations: ['Continue current optimization strategies', 'Monitor for sustained improvement'],
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    return insights;
  }

  private generateRecommendations(
    summary: PerformanceReport['summary'],
    trends: PerformanceReport['trends'],
    alerts: PerformanceAlert[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Based on scores
    if (summary.hitRateScore < 70) {
      recommendations.push('Improve cache hit rate through better warming strategies');
    }
    
    if (summary.responseTimeScore < 70) {
      recommendations.push('Optimize response times by reviewing serialization and network settings');
    }
    
    if (summary.resourceEfficiencyScore < 70) {
      recommendations.push('Improve resource efficiency through better memory management');
    }
    
    if (summary.predictionAccuracyScore < 70) {
      recommendations.push('Retrain ML models to improve prediction accuracy');
    }
    
    // Based on trends
    if (trends.hitRate.direction === 'decreasing' && trends.hitRate.correlation < -0.5) {
      recommendations.push('Investigate causes of declining hit rate trend');
    }
    
    if (trends.responseTime.direction === 'increasing' && trends.responseTime.correlation > 0.5) {
      recommendations.push('Address increasing response time trend');
    }
    
    // Based on alerts
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('Address critical performance alerts immediately');
    }
    
    return recommendations;
  }

  private createEmptyReport(startTime: Date, endTime: Date): PerformanceReport {
    return {
      period: { start: startTime, end: endTime },
      summary: {
        overallScore: 0,
        hitRateScore: 0,
        responseTimeScore: 0,
        resourceEfficiencyScore: 0,
        predictionAccuracyScore: 0,
        optimizationEffectivenessScore: 0
      },
      metrics: [],
      alerts: [],
      insights: [],
      trends: {
        hitRate: { direction: 'stable', slope: 0, correlation: 0, confidence: 0, forecast: { nextPeriod: 0, upperBound: 0, lowerBound: 0 } },
        responseTime: { direction: 'stable', slope: 0, correlation: 0, confidence: 0, forecast: { nextPeriod: 0, upperBound: 0, lowerBound: 0 } },
        memoryUsage: { direction: 'stable', slope: 0, correlation: 0, confidence: 0, forecast: { nextPeriod: 0, upperBound: 0, lowerBound: 0 } },
        predictionAccuracy: { direction: 'stable', slope: 0, correlation: 0, confidence: 0, forecast: { nextPeriod: 0, upperBound: 0, lowerBound: 0 } }
      },
      recommendations: ['No data available for the selected period']
    };
  }

  private normalizeScore(value: number, min: number, max: number, higherIsBetter: boolean): number {
    if (max === min) return 0.5;
    
    const normalized = (value - min) / (max - min);
    return higherIsBetter ? normalized : 1 - normalized;
  }
}
