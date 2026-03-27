import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisService } from '../redisService';
import { MonitoringService } from '../monitoringService';
import { ContractEvent, IContractEvent, EventType, EventSeverity } from '../../models/ContractEvent';
import { EventEmitter } from 'events';

export interface AnalyticsConfig {
  enableRealTimeAnalytics: boolean;
  enableHistoricalAnalytics: boolean;
  enablePredictiveAnalytics: boolean;
  analyticsRetentionDays: number;
  aggregationInterval: number;
  enableAnomalyDetection: boolean;
  anomalyThreshold: number;
}

export interface EventAnalytics {
  totalEvents: number;
  eventsByType: Record<EventType, number>;
  eventsBySeverity: Record<EventSeverity, number>;
  eventsByHour: Record<string, number>;
  eventsByDay: Record<string, number>;
  eventsByAddress: Record<string, number>;
  gasUsageStats: GasUsageAnalytics;
  processingStats: ProcessingAnalytics;
  errorStats: ErrorAnalytics;
  timestamp: Date;
}

export interface GasUsageAnalytics {
  totalGas: number;
  averageGas: number;
  medianGas: number;
  minGas: number;
  maxGas: number;
  gasByType: Record<EventType, number>;
  gasEfficiency: number;
  gasTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface ProcessingAnalytics {
  totalProcessed: number;
  processingRate: number; // events per second
  averageProcessingTime: number;
  successRate: number;
  failureRate: number;
  retryRate: number;
  bottleneckEvents: string[];
  processingBacklog: number;
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorRate: number;
  errorsByType: Record<string, number>;
  errorsByAddress: Record<string, number>;
  criticalErrors: number;
  errorTrend: 'increasing' | 'decreasing' | 'stable';
  mttr: number; // Mean time to recovery
}

export interface AnomalyDetection {
  anomalies: Anomaly[];
  anomalyScore: number;
  lastAnomalyAt?: Date;
  patterns: AnomalyPattern[];
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: EventSeverity;
  description: string;
  detectedAt: Date;
  affectedEvents: string[];
  metrics: Record<string, number>;
  resolved: boolean;
  resolvedAt?: Date;
}

export enum AnomalyType {
  SPIKE_IN_EVENTS = 'spike_in_events',
  UNUSUAL_GAS_USAGE = 'unusual_gas_usage',
  PROCESSING_DELAY = 'processing_delay',
  ERROR_RATE_INCREASE = 'error_rate_increase',
  ADDRESS_ANOMALY = 'address_anomaly',
  TOPIC_ANOMALY = 'topic_anomaly',
}

export interface AnomalyPattern {
  type: AnomalyType;
  frequency: number;
  averageSeverity: EventSeverity;
  commonTriggers: string[];
  lastOccurrence: Date;
}

export interface PredictiveAnalytics {
  forecast: EventForecast;
  riskAssessment: RiskAssessment;
  capacityPlanning: CapacityPlanning;
}

export interface EventForecast {
  nextHourEvents: number;
  nextDayEvents: number;
  nextWeekEvents: number;
  confidence: number;
  factors: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  recommendations: string[];
}

export interface RiskFactor {
  factor: string;
  impact: number;
  probability: number;
  severity: EventSeverity;
}

export interface CapacityPlanning {
  currentCapacity: number;
  projectedCapacity: number;
  capacityUtilization: number;
  scalingRecommendations: ScalingRecommendation[];
}

export interface ScalingRecommendation {
  resource: string;
  action: 'scale_up' | 'scale_down' | 'maintain';
  reason: string;
  priority: 'low' | 'medium' | 'high';
  estimatedImpact: string;
}

@Injectable()
export class EventAnalyticsService extends EventEmitter implements OnModuleInit {
  private readonly logger = new Logger(EventAnalyticsService.name);
  private readonly config: AnalyticsConfig;
  private analyticsCache: Map<string, EventAnalytics> = new Map();
  private anomalyHistory: Anomaly[] = [];
  private patterns: AnomalyPattern[] = [];
  private analyticsInterval?: NodeJS.Timeout;

  constructor(
    @InjectModel('ContractEvent') private eventModel: Model<IContractEvent>,
    private redisService: RedisService,
    private monitoringService: MonitoringService,
  ) {
    super();
    
    this.config = {
      enableRealTimeAnalytics: true,
      enableHistoricalAnalytics: true,
      enablePredictiveAnalytics: true,
      analyticsRetentionDays: 30,
      aggregationInterval: 300000, // 5 minutes
      enableAnomalyDetection: true,
      anomalyThreshold: 2.0, // 2 standard deviations
    };
  }

  async onModuleInit() {
    this.logger.log('Initializing Event Analytics Service');
    
    // Load historical analytics
    await this.loadHistoricalAnalytics();
    
    // Start real-time analytics
    if (this.config.enableRealTimeAnalytics) {
      this.startRealTimeAnalytics();
    }
    
    // Start anomaly detection
    if (this.config.enableAnomalyDetection) {
      this.startAnomalyDetection();
    }
    
    this.logger.log('Event Analytics Service initialized successfully');
  }

  /**
   * Get comprehensive event analytics
   */
  async getEventAnalytics(timeRange?: { from: Date; to: Date }): Promise<EventAnalytics> {
    const cacheKey = this.generateCacheKey(timeRange);
    
    // Check cache first
    const cached = this.analyticsCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }
    
    try {
      const analytics = await this.generateAnalytics(timeRange);
      
      // Cache results
      this.analyticsCache.set(cacheKey, analytics);
      
      return analytics;
      
    } catch (error) {
      this.logger.error('Failed to generate event analytics:', error);
      throw error;
    }
  }

  /**
   * Get gas usage analytics
   */
  async getGasUsageAnalytics(timeRange?: { from: Date; to: Date }): Promise<GasUsageAnalytics> {
    const matchStage = this.buildTimeRangeMatch(timeRange);
    
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalGas: { $sum: '$gasUsed' },
          averageGas: { $avg: '$gasUsed' },
          minGas: { $min: '$gasUsed' },
          maxGas: { $max: '$gasUsed' },
          medianGas: { $median: { input: '$gasUsed' } },
          gasByType: {
            $push: {
              eventType: '$eventType',
              gasUsed: '$gasUsed',
            },
          },
        },
      },
    ];
    
    const results = await this.eventModel.aggregate(pipeline).exec();
    const result = results[0] || {};
    
    // Process gas by type
    const gasByType: Record<EventType, number> = {} as any;
    if (result.gasByType) {
      for (const item of result.gasByType) {
        gasByType[item.eventType] = (gasByType[item.eventType] || 0) + item.gasUsed;
      }
    }
    
    // Calculate gas trend
    const gasTrend = await this.calculateGasTrend(timeRange);
    
    // Calculate gas efficiency
    const gasEfficiency = await this.calculateGasEfficiency(timeRange);
    
    return {
      totalGas: result.totalGas || 0,
      averageGas: result.averageGas || 0,
      medianGas: result.medianGas || 0,
      minGas: result.minGas || 0,
      maxGas: result.maxGas || 0,
      gasByType,
      gasEfficiency,
      gasTrend,
    };
  }

  /**
   * Get processing analytics
   */
  async getProcessingAnalytics(timeRange?: { from: Date; to: Date }): Promise<ProcessingAnalytics> {
    const matchStage = this.buildTimeRangeMatch(timeRange);
    
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          processedEvents: { $sum: { $cond: ['$processed', 1, 0] } },
          failedEvents: { $sum: { $cond: ['$permanentlyFailed', 1, 0] } },
          averageProcessingTime: { $avg: '$processingTime' },
          totalProcessingTime: { $sum: '$processingTime' },
          retryCount: { $sum: '$processingAttempts' },
        },
      },
    ];
    
    const results = await this.eventModel.aggregate(pipeline).exec();
    const result = results[0] || {};
    
    const totalEvents = result.totalEvents || 0;
    const processedEvents = result.processedEvents || 0;
    const failedEvents = result.failedEvents || 0;
    
    // Calculate rates
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const processingRate = timeRangeMs > 0 ? (processedEvents / timeRangeMs) * 1000 : 0;
    const successRate = totalEvents > 0 ? processedEvents / totalEvents : 0;
    const failureRate = totalEvents > 0 ? failedEvents / totalEvents : 0;
    const retryRate = totalEvents > 0 ? (result.retryCount || 0) / totalEvents : 0;
    
    // Get bottleneck events
    const bottleneckEvents = await this.getBottleneckEvents(timeRange);
    
    // Get processing backlog
    const processingBacklog = await this.getProcessingBacklog();
    
    return {
      totalProcessed: processedEvents,
      processingRate,
      averageProcessingTime: result.averageProcessingTime || 0,
      successRate,
      failureRate,
      retryRate,
      bottleneckEvents,
      processingBacklog,
    };
  }

  /**
   * Get error analytics
   */
  async getErrorAnalytics(timeRange?: { from: Date; to: Date }): Promise<ErrorAnalytics> {
    const matchStage = {
      ...this.buildTimeRangeMatch(timeRange),
      $or: [
        { permanentlyFailed: true },
        { lastError: { $exists: true } },
      ],
    };
    
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalErrors: { $sum: 1 },
          errorsByType: { $addToSet: '$lastError' },
          errorsByAddress: { $addToSet: '$emitter' },
          criticalErrors: {
            $sum: {
              $cond: [{ $eq: ['$severity', EventSeverity.CRITICAL] }, 1, 0],
            },
          },
          avgResolutionTime: { $avg: '$processingTime' },
        },
      },
    ];
    
    const results = await this.eventModel.aggregate(pipeline).exec();
    const result = results[0] || {};
    
    // Calculate error rate
    const totalEvents = await this.eventModel.countDocuments(this.buildTimeRangeMatch(timeRange));
    const errorRate = totalEvents > 0 ? (result.totalErrors || 0) / totalEvents : 0;
    
    // Process errors by type
    const errorsByType: Record<string, number> = {};
    if (result.errorsByType) {
      for (const error of result.errorsByType) {
        if (error) {
          errorsByType[error] = (errorsByType[error] || 0) + 1;
        }
      }
    }
    
    // Process errors by address
    const errorsByAddress: Record<string, number> = {};
    if (result.errorsByAddress) {
      for (const address of result.errorsByAddress) {
        errorsByAddress[address] = (errorsByAddress[address] || 0) + 1;
      }
    }
    
    // Calculate error trend
    const errorTrend = await this.calculateErrorTrend(timeRange);
    
    return {
      totalErrors: result.totalErrors || 0,
      errorRate,
      errorsByType,
      errorsByAddress,
      criticalErrors: result.criticalErrors || 0,
      errorTrend,
      mttr: result.avgResolutionTime || 0,
    };
  }

  /**
   * Detect anomalies in event patterns
   */
  async detectAnomalies(): Promise<AnomalyDetection> {
    const anomalies: Anomaly[] = [];
    
    try {
      // Detect event volume spikes
      const volumeAnomaly = await this.detectVolumeSpike();
      if (volumeAnomaly) anomalies.push(volumeAnomaly);
      
      // Detect unusual gas usage
      const gasAnomaly = await this.detectUnusualGasUsage();
      if (gasAnomaly) anomalies.push(gasAnomaly);
      
      // Detect processing delays
      const delayAnomaly = await this.detectProcessingDelay();
      if (delayAnomaly) anomalies.push(delayAnomaly);
      
      // Detect error rate increases
      const errorAnomaly = await this.detectErrorRateIncrease();
      if (errorAnomaly) anomalies.push(errorAnomaly);
      
      // Detect address anomalies
      const addressAnomaly = await this.detectAddressAnomaly();
      if (addressAnomaly) anomalies.push(addressAnomaly);
      
      // Update anomaly history
      this.anomalyHistory.push(...anomalies);
      
      // Update patterns
      this.updateAnomalyPatterns(anomalies);
      
      // Calculate anomaly score
      const anomalyScore = this.calculateAnomalyScore(anomalies);
      
      const detection: AnomalyDetection = {
        anomalies,
        anomalyScore,
        lastAnomalyAt: anomalies.length > 0 ? anomalies[0].detectedAt : undefined,
        patterns: this.patterns,
      };
      
      // Emit anomaly detection event
      if (anomalies.length > 0) {
        this.emit('anomaliesDetected', detection);
      }
      
      return detection;
      
    } catch (error) {
      this.logger.error('Failed to detect anomalies:', error);
      throw error;
    }
  }

  /**
   * Generate predictive analytics
   */
  async generatePredictiveAnalytics(): Promise<PredictiveAnalytics> {
    try {
      const forecast = await this.generateEventForecast();
      const riskAssessment = await this.generateRiskAssessment();
      const capacityPlanning = await this.generateCapacityPlanning();
      
      return {
        forecast,
        riskAssessment,
        capacityPlanning,
      };
      
    } catch (error) {
      this.logger.error('Failed to generate predictive analytics:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive analytics
   */
  private async generateAnalytics(timeRange?: { from: Date; to: Date }): Promise<EventAnalytics> {
    const [
      gasUsageStats,
      processingStats,
      errorStats,
    ] = await Promise.all([
      this.getGasUsageAnalytics(timeRange),
      this.getProcessingAnalytics(timeRange),
      this.getErrorAnalytics(timeRange),
    ]);
    
    // Get basic event counts
    const matchStage = this.buildTimeRangeMatch(timeRange);
    const totalEvents = await this.eventModel.countDocuments(matchStage);
    
    // Get events by type
    const eventsByType = await this.getEventsByType(timeRange);
    
    // Get events by severity
    const eventsBySeverity = await this.getEventsBySeverity(timeRange);
    
    // Get time-based distributions
    const eventsByHour = await this.getEventsByHour(timeRange);
    const eventsByDay = await this.getEventsByDay(timeRange);
    
    // Get events by address
    const eventsByAddress = await this.getEventsByAddress(timeRange);
    
    return {
      totalEvents,
      eventsByType,
      eventsBySeverity,
      eventsByHour,
      eventsByDay,
      eventsByAddress,
      gasUsageStats,
      processingStats,
      errorStats,
      timestamp: new Date(),
    };
  }

  /**
   * Helper methods for analytics generation
   */
  private async getEventsByType(timeRange?: { from: Date; to: Date }): Promise<Record<EventType, number>> {
    const pipeline = [
      { $match: this.buildTimeRangeMatch(timeRange) },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ];
    
    const results = await this.eventModel.aggregate(pipeline).exec();
    const eventsByType: Record<EventType, number> = {} as any;
    
    for (const result of results) {
      eventsByType[result._id] = result.count;
    }
    
    return eventsByType;
  }

  private async getEventsBySeverity(timeRange?: { from: Date; to: Date }): Promise<Record<EventSeverity, number>> {
    const pipeline = [
      { $match: this.buildTimeRangeMatch(timeRange) },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ];
    
    const results = await this.eventModel.aggregate(pipeline).exec();
    const eventsBySeverity: Record<EventSeverity, number> = {} as any;
    
    for (const result of results) {
      eventsBySeverity[result._id] = result.count;
    }
    
    return eventsBySeverity;
  }

  private async getEventsByHour(timeRange?: { from: Date; to: Date }): Promise<Record<string, number>> {
    const pipeline = [
      { $match: this.buildTimeRangeMatch(timeRange) },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];
    
    const results = await this.eventModel.aggregate(pipeline).exec();
    const eventsByHour: Record<string, number> = {};
    
    for (const result of results) {
      eventsByHour[result._id.toString()] = result.count;
    }
    
    return eventsByHour;
  }

  private async getEventsByDay(timeRange?: { from: Date; to: Date }): Promise<Record<string, number>> {
    const pipeline = [
      { $match: this.buildTimeRangeMatch(timeRange) },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];
    
    const results = await this.eventModel.aggregate(pipeline).exec();
    const eventsByDay: Record<string, number> = {};
    
    for (const result of results) {
      eventsByDay[result._id] = result.count;
    }
    
    return eventsByDay;
  }

  private async getEventsByAddress(timeRange?: { from: Date; to: Date }): Promise<Record<string, number>> {
    const pipeline = [
      { $match: this.buildTimeRangeMatch(timeRange) },
      { $group: { _id: '$emitter', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ];
    
    const results = await this.eventModel.aggregate(pipeline).exec();
    const eventsByAddress: Record<string, number> = {};
    
    for (const result of results) {
      eventsByAddress[result._id] = result.count;
    }
    
    return eventsByAddress;
  }

  /**
   * Anomaly detection methods
   */
  private async detectVolumeSpike(): Promise<Anomaly | null> {
    // Get recent event volume
    const recentVolume = await this.getRecentEventVolume(3600000); // Last hour
    const historicalAverage = await this.getHistoricalAverageVolume(3600000); // Historical hourly average
    
    const threshold = historicalAverage * this.config.anomalyThreshold;
    
    if (recentVolume > threshold) {
      return {
        id: this.generateAnomalyId(),
        type: AnomalyType.SPIKE_IN_EVENTS,
        severity: EventSeverity.HIGH,
        description: `Event volume spike detected: ${recentVolume} events (threshold: ${threshold})`,
        detectedAt: new Date(),
        affectedEvents: [],
        metrics: { recentVolume, historicalAverage, threshold },
        resolved: false,
      };
    }
    
    return null;
  }

  private async detectUnusualGasUsage(): Promise<Anomaly | null> {
    const recentGas = await this.getRecentAverageGas(3600000);
    const historicalAverage = await this.getHistoricalAverageGas(3600000);
    
    const threshold = historicalAverage * this.config.anomalyThreshold;
    
    if (recentGas > threshold) {
      return {
        id: this.generateAnomalyId(),
        type: AnomalyType.UNUSUAL_GAS_USAGE,
        severity: EventSeverity.MEDIUM,
        description: `Unusual gas usage detected: ${recentGas} gas (threshold: ${threshold})`,
        detectedAt: new Date(),
        affectedEvents: [],
        metrics: { recentGas, historicalAverage, threshold },
        resolved: false,
      };
    }
    
    return null;
  }

  private async detectProcessingDelay(): Promise<Anomaly | null> {
    const recentDelay = await this.getRecentProcessingDelay(3600000);
    const historicalAverage = await this.getHistoricalAverageDelay(3600000);
    
    const threshold = historicalAverage * this.config.anomalyThreshold;
    
    if (recentDelay > threshold) {
      return {
        id: this.generateAnomalyId(),
        type: AnomalyType.PROCESSING_DELAY,
        severity: EventSeverity.HIGH,
        description: `Processing delay detected: ${recentDelay}ms (threshold: ${threshold}ms)`,
        detectedAt: new Date(),
        affectedEvents: [],
        metrics: { recentDelay, historicalAverage, threshold },
        resolved: false,
      };
    }
    
    return null;
  }

  private async detectErrorRateIncrease(): Promise<Anomaly | null> {
    const recentErrorRate = await this.getRecentErrorRate(3600000);
    const historicalAverage = await this.getHistoricalAverageErrorRate(3600000);
    
    const threshold = historicalAverage * this.config.anomalyThreshold;
    
    if (recentErrorRate > threshold) {
      return {
        id: this.generateAnomalyId(),
        type: AnomalyType.ERROR_RATE_INCREASE,
        severity: EventSeverity.CRITICAL,
        description: `Error rate increase detected: ${(recentErrorRate * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`,
        detectedAt: new Date(),
        affectedEvents: [],
        metrics: { recentErrorRate, historicalAverage, threshold },
        resolved: false,
      };
    }
    
    return null;
  }

  private async detectAddressAnomaly(): Promise<Anomaly | null> {
    // Detect addresses with unusual activity patterns
    const addressActivity = await this.getAddressActivityAnalysis(3600000);
    
    for (const [address, activity] of Object.entries(addressActivity)) {
      const historicalAverage = await this.getHistoricalAddressAverage(address, 3600000);
      const threshold = historicalAverage * this.config.anomalyThreshold;
      
      if (activity > threshold) {
        return {
          id: this.generateAnomalyId(),
          type: AnomalyType.ADDRESS_ANOMALY,
          severity: EventSeverity.MEDIUM,
          description: `Unusual activity from address ${address}: ${activity} events (threshold: ${threshold})`,
          detectedAt: new Date(),
          affectedEvents: [],
          metrics: { address, activity, historicalAverage, threshold },
          resolved: false,
        };
      }
    }
    
    return null;
  }

  /**
   * Predictive analytics methods
   */
  private async generateEventForecast(): Promise<EventForecast> {
    // Use historical data to forecast future events
    const historicalData = await this.getHistoricalEventVolume(7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    // Simple linear regression for forecasting
    const trend = this.calculateTrend(historicalData);
    
    const nextHourEvents = Math.max(0, trend.slope * 1 + trend.intercept);
    const nextDayEvents = Math.max(0, trend.slope * 24 + trend.intercept);
    const nextWeekEvents = Math.max(0, trend.slope * 168 + trend.intercept);
    
    return {
      nextHourEvents: Math.round(nextHourEvents),
      nextDayEvents: Math.round(nextDayEvents),
      nextWeekEvents: Math.round(nextWeekEvents),
      confidence: trend.r2, // R-squared value as confidence
      factors: ['historical_trend', 'seasonal_patterns', 'recent_growth'],
    };
  }

  private async generateRiskAssessment(): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    
    // Analyze various risk factors
    const errorRate = await this.getRecentErrorRate(3600000);
    if (errorRate > 0.1) {
      factors.push({
        factor: 'high_error_rate',
        impact: 0.8,
        probability: errorRate,
        severity: EventSeverity.HIGH,
      });
    }
    
    const processingDelay = await this.getRecentProcessingDelay(3600000);
    if (processingDelay > 5000) {
      factors.push({
        factor: 'processing_delay',
        impact: 0.6,
        probability: processingDelay / 10000,
        severity: EventSeverity.MEDIUM,
      });
    }
    
    const anomalyScore = this.calculateAnomalyScore(this.anomalyHistory.slice(-10));
    if (anomalyScore > 0.5) {
      factors.push({
        factor: 'recent_anomalies',
        impact: 0.7,
        probability: anomalyScore,
        severity: EventSeverity.HIGH,
      });
    }
    
    const overallRisk = this.calculateOverallRisk(factors);
    const recommendations = this.generateRecommendations(factors);
    
    return {
      overallRisk,
      riskFactors: factors,
      recommendations,
    };
  }

  private async generateCapacityPlanning(): Promise<CapacityPlanning> {
    const currentCapacity = await this.getCurrentProcessingCapacity();
    const projectedLoad = await this.getProjectedLoad(3600000);
    const capacityUtilization = projectedLoad / currentCapacity;
    
    const scalingRecommendations: ScalingRecommendation[] = [];
    
    if (capacityUtilization > 0.8) {
      scalingRecommendations.push({
        resource: 'processing_workers',
        action: 'scale_up',
        reason: 'High capacity utilization',
        priority: 'high',
        estimatedImpact: '25% increase in throughput',
      });
    } else if (capacityUtilization < 0.3) {
      scalingRecommendations.push({
        resource: 'processing_workers',
        action: 'scale_down',
        reason: 'Low capacity utilization',
        priority: 'medium',
        estimatedImpact: '20% cost reduction',
      });
    }
    
    return {
      currentCapacity,
      projectedCapacity: currentCapacity * 1.2, // 20% buffer
      capacityUtilization,
      scalingRecommendations,
    };
  }

  /**
   * Utility methods
   */
  private buildTimeRangeMatch(timeRange?: { from: Date; to: Date }): any {
    if (!timeRange) return {};
    
    return {
      timestamp: {
        $gte: timeRange.from,
        $lte: timeRange.to,
      },
    };
  }

  private generateCacheKey(timeRange?: { from: Date; to: Date }): string {
    if (!timeRange) return 'analytics:all';
    return `analytics:${timeRange.from.getTime()}-${timeRange.to.getTime()}`;
  }

  private isCacheValid(analytics: EventAnalytics): boolean {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return Date.now() - analytics.timestamp.getTime() < maxAge;
  }

  private generateAnomalyId(): string {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateAnomalyScore(anomalies: Anomaly[]): number {
    if (anomalies.length === 0) return 0;
    
    const severityWeights = {
      [EventSeverity.LOW]: 0.25,
      [EventSeverity.MEDIUM]: 0.5,
      [EventSeverity.HIGH]: 0.75,
      [EventSeverity.CRITICAL]: 1.0,
    };
    
    const totalScore = anomalies.reduce((sum, anomaly) => {
      return sum + severityWeights[anomaly.severity];
    }, 0);
    
    return Math.min(1.0, totalScore / anomalies.length);
  }

  private calculateOverallRisk(factors: RiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    const totalRisk = factors.reduce((sum, factor) => {
      return sum + (factor.impact * factor.probability);
    }, 0);
    
    if (totalRisk < 0.3) return 'low';
    if (totalRisk < 0.6) return 'medium';
    if (totalRisk < 0.8) return 'high';
    return 'critical';
  }

  private generateRecommendations(factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];
    
    for (const factor of factors) {
      switch (factor.factor) {
        case 'high_error_rate':
          recommendations.push('Investigate and fix error sources');
          recommendations.push('Increase monitoring and alerting');
          break;
        case 'processing_delay':
          recommendations.push('Optimize processing pipeline');
          recommendations.push('Consider scaling processing resources');
          break;
        case 'recent_anomalies':
          recommendations.push('Review recent system changes');
          recommendations.push('Enhance anomaly detection');
          break;
      }
    }
    
    return recommendations;
  }

  private calculateTrend(data: number[]): { slope: number; intercept: number; r2: number } {
    // Simple linear regression implementation
    const n = data.length;
    const sumX = (n * (n - 1)) / 2; // Sum of 0, 1, 2, ..., n-1
    const sumY = data.reduce((sum, val) => sum + val, 0);
    const sumXY = data.reduce((sum, val, index) => sum + val * index, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = data.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssResidual = data.reduce((sum, val, index) => {
      const predicted = slope * index + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const r2 = 1 - (ssResidual / ssTotal);
    
    return { slope, intercept, r2 };
  }

  // Placeholder methods for data retrieval - these would be implemented with actual database queries
  private async getRecentEventVolume(timeMs: number): Promise<number> { return 100; }
  private async getHistoricalAverageVolume(timeMs: number): Promise<number> { return 50; }
  private async getRecentAverageGas(timeMs: number): Promise<number> { return 21000; }
  private async getHistoricalAverageGas(timeMs: number): Promise<number> { return 21000; }
  private async getRecentProcessingDelay(timeMs: number): Promise<number> { return 100; }
  private async getHistoricalAverageDelay(timeMs: number): Promise<number> { return 100; }
  private async getRecentErrorRate(timeMs: number): Promise<number> { return 0.05; }
  private async getHistoricalAverageErrorRate(timeMs: number): Promise<number> { return 0.05; }
  private async getAddressActivityAnalysis(timeMs: number): Promise<Record<string, number>> { return {}; }
  private async getHistoricalAddressAverage(address: string, timeMs: number): Promise<number> { return 10; }
  private async getHistoricalEventVolume(timeMs: number): Promise<number[]> { return [50, 55, 60, 58, 62]; }
  private async getCurrentProcessingCapacity(): Promise<number> { return 1000; }
  private async getProjectedLoad(timeMs: number): Promise<number> { return 800; }
  private async calculateGasTrend(timeRange?: { from: Date; to: Date }): Promise<any> { return 'stable'; }
  private async calculateGasEfficiency(timeRange?: { from: Date; to: Date }): Promise<number> { return 0.8; }
  private async getBottleneckEvents(timeRange?: { from: Date; to: Date }): Promise<string[]> { return []; }
  private async getProcessingBacklog(): Promise<number> { return 0; }
  private async calculateErrorTrend(timeRange?: { from: Date; to: Date }): Promise<any> { return 'stable'; }
  private getTimeRangeMs(timeRange?: { from: Date; to: Date }): number { return 3600000; }

  private async loadHistoricalAnalytics(): Promise<void> {
    // Load cached analytics from Redis
  }

  private startRealTimeAnalytics(): void {
    this.analyticsInterval = setInterval(async () => {
      try {
        const analytics = await this.getEventAnalytics();
        this.emit('analyticsUpdated', analytics);
      } catch (error) {
        this.logger.error('Real-time analytics failed:', error);
      }
    }, this.config.aggregationInterval);
  }

  private startAnomalyDetection(): void {
    setInterval(async () => {
      try {
        await this.detectAnomalies();
      } catch (error) {
        this.logger.error('Anomaly detection failed:', error);
      }
    }, 60000); // Run every minute
  }

  private updateAnomalyPatterns(anomalies: Anomaly[]): void {
    // Update anomaly patterns based on new anomalies
  }
}
