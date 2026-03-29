import { EventEmitter } from 'events';
import { WinstonLogger } from '../utils/logger';
import { 
  CachePattern, 
  AccessPattern, 
  CacheEvent,
  CacheInsight 
} from '../models/CachePattern';

export interface PatternAnalyzerConfig {
  analysisInterval: number;
  minDataPoints: number;
  anomalyThreshold: number;
  seasonalWindowSize: number;
  trendWindowSize: number;
  patternMinFrequency: number;
  insightRetentionPeriod: number;
}

export interface PatternMetrics {
  totalPatterns: number;
  seasonalPatterns: number;
  anomalousPatterns: number;
  trendPatterns: number;
  avgPatternStrength: number;
  patternDiversity: number;
  lastAnalysisTime: Date;
}

export interface AnomalyDetection {
  key: string;
  anomalyType: 'frequency' | 'timing' | 'sequence' | 'volume';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  timestamp: Date;
  confidence: number;
}

export interface SeasonalPattern {
  pattern: string;
  cycle: 'hourly' | 'daily' | 'weekly' | 'monthly';
  strength: number;
  peakTimes: number[];
  amplitude: number;
  phase: number;
  confidence: number;
}

export interface TrendAnalysis {
  key: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  strength: number;
  slope: number;
  correlation: number;
  forecast: {
    nextPeriod: number;
    confidence: number;
    upperBound: number;
    lowerBound: number;
  };
}

export class PatternAnalyzer extends EventEmitter {
  private config: PatternAnalyzerConfig;
  private logger: WinstonLogger;
  private patterns: Map<string, CachePattern>;
  private accessHistory: Map<string, CacheEvent[]>;
  private insights: CacheInsight[];
  private anomalies: AnomalyDetection[];
  private seasonalPatterns: Map<string, SeasonalPattern>;
  private trends: Map<string, TrendAnalysis>;
  private analysisTimer?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  constructor(config: PatternAnalyzerConfig) {
    super();
    this.config = config;
    this.logger = new WinstonLogger();
    this.patterns = new Map();
    this.accessHistory = new Map();
    this.insights = [];
    this.anomalies = [];
    this.seasonalPatterns = new Map();
    this.trends = new Map();
  }

  /**
   * Initialize the pattern analyzer
   */
  async initialize(): Promise<void> {
    try {
      this.startAnalysis();
      this.isInitialized = true;
      this.logger.info('Pattern Analyzer initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Pattern Analyzer', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Add cache event for analysis
   */
  addEvent(event: CacheEvent): void {
    const key = event.key;
    const history = this.accessHistory.get(key) || [];
    
    history.push(event);
    
    // Limit history size to prevent memory issues
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    this.accessHistory.set(key, history);
    
    // Update pattern if enough data
    if (history.length >= this.config.minDataPoints) {
      this.updatePattern(key, history);
    }
    
    this.emit('eventAdded', event);
  }

  /**
   * Get all detected patterns
   */
  getPatterns(): CachePattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get pattern for specific key
   */
  getPattern(key: string): CachePattern | undefined {
    return this.patterns.get(key);
  }

  /**
   * Get access patterns
   */
  getAccessPatterns(): AccessPattern[] {
    return Array.from(this.patterns.values()).map(pattern => ({
      pattern: pattern.pattern,
      frequency: pattern.frequency,
      hourlyDistribution: this.calculateHourlyDistribution(pattern.key),
      weeklyDistribution: this.calculateWeeklyDistribution(pattern.key),
      seasonalTrend: this.detectSeasonalTrend(pattern.key),
      correlation: this.calculateCorrelation(pattern.key),
      prediction: {
        nextAccess: pattern.accessTimes.length > 0 ? 
          new Date(pattern.accessTimes[pattern.accessTimes.length - 1].getTime() + 3600000) : 
          new Date(),
        confidence: pattern.confidence,
        probability: pattern.frequency / Math.max(1, this.getTotalAccessCount())
      }
    }));
  }

  /**
   * Get detected anomalies
   */
  getAnomalies(): AnomalyDetection[] {
    return [...this.anomalies];
  }

  /**
   * Get seasonal patterns
   */
  getSeasonalPatterns(): SeasonalPattern[] {
    return Array.from(this.seasonalPatterns.values());
  }

  /**
   * Get trend analysis
   */
  getTrends(): TrendAnalysis[] {
    return Array.from(this.trends.values());
  }

  /**
   * Get pattern insights
   */
  getInsights(): CacheInsight[] {
    return [...this.insights];
  }

  /**
   * Get pattern metrics
   */
  getMetrics(): PatternMetrics {
    const patterns = this.getPatterns();
    const seasonalCount = this.seasonalPatterns.size;
    const anomalousCount = this.anomalies.length;
    const trendCount = this.trends.size;
    
    const avgStrength = patterns.length > 0 ? 
      patterns.reduce((sum, pattern) => sum + pattern.confidence, 0) / patterns.length : 0;
    
    const diversity = this.calculatePatternDiversity(patterns);
    
    return {
      totalPatterns: patterns.length,
      seasonalPatterns: seasonalCount,
      anomalousPatterns: anomalousCount,
      trendPatterns: trendCount,
      avgPatternStrength: avgStrength,
      patternDiversity: diversity,
      lastAnalysisTime: new Date()
    };
  }

  /**
   * Manually trigger pattern analysis
   */
  async analyzePatterns(): Promise<void> {
    try {
      this.logger.info('Starting pattern analysis...');
      
      // Analyze all keys with sufficient data
      for (const [key, history] of this.accessHistory.entries()) {
        if (history.length >= this.config.minDataPoints) {
          await this.analyzeKey(key, history);
        }
      }
      
      // Detect anomalies
      this.detectAnomalies();
      
      // Generate insights
      this.generateInsights();
      
      // Clean old data
      this.cleanupOldData();
      
      this.emit('analysisCompleted', this.getMetrics());
      this.logger.info('Pattern analysis completed');

    } catch (error) {
      this.logger.error('Pattern analysis failed', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Shutdown the analyzer
   */
  shutdown(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
    }
    
    this.isInitialized = false;
    this.logger.info('Pattern Analyzer shutdown completed');
    this.emit('shutdown');
  }

  // Private methods

  private startAnalysis(): void {
    this.analysisTimer = setInterval(async () => {
      try {
        await this.analyzePatterns();
      } catch (error) {
        this.logger.error('Automatic pattern analysis failed', error);
      }
    }, this.config.analysisInterval * 1000);
  }

  private updatePattern(key: string, history: CacheEvent[]): void {
    const accessTimes = history
      .filter(event => event.type === 'hit')
      .map(event => event.timestamp);
    
    if (accessTimes.length < this.config.minDataPoints) {
      return;
    }
    
    const pattern: CachePattern = {
      id: `pattern_${key}`,
      key,
      pattern: this.extractPattern(key),
      frequency: accessTimes.length,
      accessTimes,
      avgResponseTime: this.calculateAvgResponseTime(history),
      size: this.calculateAverageSize(history),
      ttl: this.getAverageTTL(history),
      priority: this.calculatePriority(key, history),
      seasonal: this.isSeasonal(accessTimes),
      trend: this.detectTrend(accessTimes),
      confidence: this.calculateConfidence(accessTimes),
      lastUpdated: new Date()
    };
    
    this.patterns.set(key, pattern);
    this.emit('patternUpdated', pattern);
  }

  private async analyzeKey(key: string, history: CacheEvent[]): Promise<void> {
    // Analyze seasonal patterns
    const seasonalPattern = this.analyzeSeasonalPattern(key, history);
    if (seasonalPattern) {
      this.seasonalPatterns.set(key, seasonalPattern);
    }
    
    // Analyze trends
    const trend = this.analyzeTrend(key, history);
    if (trend) {
      this.trends.set(key, trend);
    }
    
    // Detect anomalies for this key
    const anomalies = this.detectKeyAnomalies(key, history);
    this.anomalies.push(...anomalies);
  }

  private analyzeSeasonalPattern(key: string, history: CacheEvent[]): SeasonalPattern | null {
    const accessTimes = history
      .filter(event => event.type === 'hit')
      .map(event => event.timestamp);
    
    if (accessTimes.length < 50) {
      return null;
    }
    
    // Detect different seasonal cycles
    const cycles: SeasonalPattern['cycle'][] = ['hourly', 'daily', 'weekly', 'monthly'];
    let bestPattern: SeasonalPattern | null = null;
    let maxStrength = 0;
    
    for (const cycle of cycles) {
      const pattern = this.detectCycle(accessTimes, cycle);
      if (pattern && pattern.strength > maxStrength) {
        bestPattern = pattern;
        maxStrength = pattern.strength;
      }
    }
    
    return bestPattern;
  }

  private detectCycle(accessTimes: Date[], cycle: SeasonalPattern['cycle']): SeasonalPattern | null {
    const bucketSize = this.getCycleBucketSize(cycle);
    const buckets = this.bucketAccessTimes(accessTimes, bucketSize);
    
    // Use FFT or autocorrelation to detect periodicity
    const periodicity = this.calculatePeriodicity(buckets);
    
    if (periodicity.strength < 0.3) {
      return null;
    }
    
    return {
      pattern: `${cycle}_pattern`,
      cycle,
      strength: periodicity.strength,
      peakTimes: periodicity.peakTimes,
      amplitude: periodicity.amplitude,
      phase: periodicity.phase,
      confidence: periodicity.confidence
    };
  }

  private getCycleBucketSize(cycle: SeasonalPattern['cycle']): number {
    switch (cycle) {
      case 'hourly': return 3600000; // 1 hour
      case 'daily': return 86400000; // 24 hours
      case 'weekly': return 604800000; // 7 days
      case 'monthly': return 2592000000; // 30 days
      default: return 3600000;
    }
  }

  private bucketAccessTimes(accessTimes: Date[], bucketSize: number): number[] {
    const buckets = new Map<number, number>();
    
    for (const time of accessTimes) {
      const bucket = Math.floor(time.getTime() / bucketSize);
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }
    
    return Array.from(buckets.values());
  }

  private calculatePeriodicity(buckets: number[]): {
    strength: number;
    peakTimes: number[];
    amplitude: number;
    phase: number;
    confidence: number;
  } {
    // Simplified periodicity calculation
    // In a real implementation, this would use FFT or autocorrelation
    
    const mean = buckets.reduce((sum, val) => sum + val, 0) / buckets.length;
    const variance = buckets.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / buckets.length;
    
    const amplitude = Math.sqrt(variance);
    const strength = amplitude / mean;
    
    const peakTimes: number[] = [];
    for (let i = 1; i < buckets.length - 1; i++) {
      if (buckets[i] > buckets[i - 1] && buckets[i] > buckets[i + 1]) {
        peakTimes.push(i);
      }
    }
    
    const confidence = Math.min(strength * 2, 1);
    const phase = peakTimes.length > 0 ? peakTimes[0] / buckets.length : 0;
    
    return {
      strength: Math.min(strength, 1),
      peakTimes,
      amplitude,
      phase,
      confidence
    };
  }

  private analyzeTrend(key: string, history: CacheEvent[]): TrendAnalysis | null {
    const accessTimes = history
      .filter(event => event.type === 'hit')
      .map(event => event.timestamp)
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (accessTimes.length < 20) {
      return null;
    }
    
    // Calculate access frequency over time
    const timeWindow = this.config.trendWindowSize * 1000;
    const frequencies = this.calculateSlidingWindowFrequencies(accessTimes, timeWindow);
    
    // Linear regression to detect trend
    const regression = this.linearRegression(frequencies);
    
    // Determine trend type
    let trend: TrendAnalysis['trend'];
    if (Math.abs(regression.slope) < 0.01) {
      trend = 'stable';
    } else if (regression.slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }
    
    // Check for volatility
    const volatility = this.calculateVolatility(frequencies);
    if (volatility > 0.5) {
      trend = 'volatile';
    }
    
    // Forecast next period
    const forecast = this.forecastNextPeriod(frequencies, regression);
    
    return {
      key,
      trend,
      strength: Math.abs(regression.slope),
      slope: regression.slope,
      correlation: regression.correlation,
      forecast
    };
  }

  private calculateSlidingWindowFrequencies(accessTimes: Date[], windowSize: number): number[] {
    const frequencies: number[] = [];
    const startTime = accessTimes[0].getTime();
    const endTime = accessTimes[accessTimes.length - 1].getTime();
    
    for (let windowStart = startTime; windowStart < endTime; windowStart += windowSize) {
      const windowEnd = windowStart + windowSize;
      const count = accessTimes.filter(time => 
        time.getTime() >= windowStart && time.getTime() < windowEnd
      ).length;
      
      frequencies.push(count);
    }
    
    return frequencies;
  }

  private linearRegression(values: number[]): {
    slope: number;
    intercept: number;
    correlation: number;
  } {
    const n = values.length;
    if (n < 2) {
      return { slope: 0, intercept: 0, correlation: 0 };
    }
    
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = values.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate correlation
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    const correlation = denominator !== 0 ? numerator / denominator : 0;
    
    return { slope, intercept, correlation };
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / mean;
  }

  private forecastNextPeriod(frequencies: number[], regression: any): TrendAnalysis['forecast'] {
    const nextX = frequencies.length;
    const nextValue = regression.slope * nextX + regression.intercept;
    
    // Calculate confidence bounds
    const residuals = frequencies.map((val, i) => val - (regression.slope * i + regression.intercept));
    const mse = residuals.reduce((sum, residual) => sum + residual * residual, 0) / residuals.length;
    const stdError = Math.sqrt(mse);
    
    const confidence = Math.max(0.5, Math.min(0.95, 1 - stdError / Math.abs(nextValue)));
    
    return {
      nextPeriod: Math.max(0, nextValue),
      confidence,
      upperBound: nextValue + 1.96 * stdError,
      lowerBound: Math.max(0, nextValue - 1.96 * stdError)
    };
  }

  private detectAnomalies(): void {
    this.anomalies = [];
    
    for (const [key, history] of this.accessHistory.entries()) {
      const keyAnomalies = this.detectKeyAnomalies(key, history);
      this.anomalies.push(...keyAnomalies);
    }
    
    this.emit('anomaliesDetected', this.anomalies);
  }

  private detectKeyAnomalies(key: string, history: CacheEvent[]): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];
    
    if (history.length < this.config.minDataPoints) {
      return anomalies;
    }
    
    // Frequency anomalies
    const frequencyAnomaly = this.detectFrequencyAnomaly(key, history);
    if (frequencyAnomaly) {
      anomalies.push(frequencyAnomaly);
    }
    
    // Timing anomalies
    const timingAnomaly = this.detectTimingAnomaly(key, history);
    if (timingAnomaly) {
      anomalies.push(timingAnomaly);
    }
    
    // Volume anomalies
    const volumeAnomaly = this.detectVolumeAnomaly(key, history);
    if (volumeAnomaly) {
      anomalies.push(volumeAnomaly);
    }
    
    return anomalies;
  }

  private detectFrequencyAnomaly(key: string, history: CacheEvent[]): AnomalyDetection | null {
    const recentAccesses = history.filter(event => 
      event.type === 'hit' && 
      Date.now() - event.timestamp.getTime() <= 3600000 // Last hour
    ).length;
    
    const historicalAverage = this.calculateHistoricalAverage(key, history, 3600000);
    const deviation = Math.abs(recentAccesses - historicalAverage) / historicalAverage;
    
    if (deviation > this.config.anomalyThreshold) {
      return {
        key,
        anomalyType: 'frequency',
        severity: this.getAnomalySeverity(deviation),
        description: `Access frequency deviation detected: ${recentAccesses} vs expected ${historicalAverage.toFixed(2)}`,
        expectedValue: historicalAverage,
        actualValue: recentAccesses,
        deviation,
        timestamp: new Date(),
        confidence: Math.min(deviation, 1)
      };
    }
    
    return null;
  }

  private detectTimingAnomaly(key: string, history: CacheEvent[]): AnomalyDetection | null {
    const accessTimes = history
      .filter(event => event.type === 'hit')
      .map(event => event.timestamp)
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (accessTimes.length < 10) {
      return null;
    }
    
    // Check for unusual gaps in access times
    const intervals = accessTimes.slice(1).map((time, i) => 
      time.getTime() - accessTimes[i].getTime()
    );
    
    const meanInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const stdInterval = Math.sqrt(
      intervals.reduce((sum, interval) => sum + Math.pow(interval - meanInterval, 2), 0) / intervals.length
    );
    
    // Check last interval
    const lastInterval = intervals[intervals.length - 1];
    const deviation = Math.abs(lastInterval - meanInterval) / stdInterval;
    
    if (deviation > this.config.anomalyThreshold) {
      return {
        key,
        anomalyType: 'timing',
        severity: this.getAnomalySeverity(deviation),
        description: `Unusual access timing detected: ${lastInterval}ms vs expected ${meanInterval.toFixed(2)}ms`,
        expectedValue: meanInterval,
        actualValue: lastInterval,
        deviation,
        timestamp: new Date(),
        confidence: Math.min(deviation / 3, 1)
      };
    }
    
    return null;
  }

  private detectVolumeAnomaly(key: string, history: CacheEvent[]): AnomalyDetection | null {
    const recentVolume = history
      .filter(event => Date.now() - event.timestamp.getTime() <= 3600000)
      .reduce((sum, event) => sum + (event.metadata.size || 0), 0);
    
    const historicalVolume = this.calculateHistoricalVolume(key, history, 3600000);
    const deviation = Math.abs(recentVolume - historicalVolume) / historicalVolume;
    
    if (deviation > this.config.anomalyThreshold) {
      return {
        key,
        anomalyType: 'volume',
        severity: this.getAnomalySeverity(deviation),
        description: `Data volume anomaly detected: ${recentVolume} bytes vs expected ${historicalVolume.toFixed(2)} bytes`,
        expectedValue: historicalVolume,
        actualValue: recentVolume,
        deviation,
        timestamp: new Date(),
        confidence: Math.min(deviation, 1)
      };
    }
    
    return null;
  }

  private getAnomalySeverity(deviation: number): AnomalyDetection['severity'] {
    if (deviation > 2.0) return 'critical';
    if (deviation > 1.5) return 'high';
    if (deviation > 1.0) return 'medium';
    return 'low';
  }

  private calculateHistoricalAverage(key: string, history: CacheEvent[], windowSize: number): number {
    const windows = this.getTimeWindows(history, windowSize);
    const frequencies = windows.map(window => 
      window.filter(event => event.type === 'hit').length
    );
    
    return frequencies.length > 0 ? 
      frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length : 0;
  }

  private calculateHistoricalVolume(key: string, history: CacheEvent[], windowSize: number): number {
    const windows = this.getTimeWindows(history, windowSize);
    const volumes = windows.map(window => 
      window.reduce((sum, event) => sum + (event.metadata.size || 0), 0)
    );
    
    return volumes.length > 0 ? 
      volumes.reduce((sum, volume) => sum + volume, 0) / volumes.length : 0;
  }

  private getTimeWindows(history: CacheEvent[], windowSize: number): CacheEvent[][] {
    if (history.length === 0) return [];
    
    const windows: CacheEvent[][] = [];
    const startTime = history[0].timestamp.getTime();
    const endTime = history[history.length - 1].timestamp.getTime();
    
    for (let windowStart = startTime; windowStart < endTime; windowStart += windowSize) {
      const windowEnd = windowStart + windowSize;
      const window = history.filter(event => 
        event.timestamp.getTime() >= windowStart && event.timestamp.getTime() < windowEnd
      );
      
      if (window.length > 0) {
        windows.push(window);
      }
    }
    
    return windows;
  }

  private generateInsights(): void {
    const insights: CacheInsight[] = [];
    
    // Pattern insights
    const patternInsights = this.generatePatternInsights();
    insights.push(...patternInsights);
    
    // Anomaly insights
    const anomalyInsights = this.generateAnomalyInsights();
    insights.push(...anomalyInsights);
    
    // Seasonal insights
    const seasonalInsights = this.generateSeasonalInsights();
    insights.push(...seasonalInsights);
    
    // Trend insights
    const trendInsights = this.generateTrendInsights();
    insights.push(...trendInsights);
    
    this.insights = insights;
    this.emit('insightsGenerated', insights);
  }

  private generatePatternInsights(): CacheInsight[] {
    const insights: CacheInsight[] = [];
    const patterns = this.getPatterns();
    
    // High-frequency patterns
    const highFrequencyPatterns = patterns.filter(p => p.frequency > 100);
    if (highFrequencyPatterns.length > 0) {
      insights.push({
        id: `insight_high_freq_${Date.now()}`,
        type: 'pattern',
        severity: 'info',
        title: 'High Frequency Access Patterns Detected',
        description: `Found ${highFrequencyPatterns.length} keys with access frequency > 100`,
        data: { patterns: highFrequencyPatterns.map(p => ({ key: p.key, frequency: p.frequency })) },
        recommendations: ['Consider increasing cache size for these keys', 'Monitor for potential hot spots'],
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    // Low confidence patterns
    const lowConfidencePatterns = patterns.filter(p => p.confidence < 0.3);
    if (lowConfidencePatterns.length > patterns.length * 0.3) {
      insights.push({
        id: `insight_low_conf_${Date.now()}`,
        type: 'pattern',
        severity: 'warning',
        title: 'Low Confidence Patterns',
        description: `${lowConfidencePatterns.length} patterns have low confidence scores`,
        data: { patterns: lowConfidencePatterns.map(p => ({ key: p.key, confidence: p.confidence })) },
        recommendations: ['Collect more data for these keys', 'Review pattern detection algorithm'],
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    return insights;
  }

  private generateAnomalyInsights(): CacheInsight[] {
    const insights: CacheInsight[] = [];
    
    // Critical anomalies
    const criticalAnomalies = this.anomalies.filter(a => a.severity === 'critical');
    if (criticalAnomalies.length > 0) {
      insights.push({
        id: `insight_critical_anomaly_${Date.now()}`,
        type: 'anomaly',
        severity: 'critical',
        title: 'Critical Anomalies Detected',
        description: `Found ${criticalAnomalies.length} critical anomalies requiring immediate attention`,
        data: { anomalies: criticalAnomalies },
        recommendations: ['Investigate affected keys immediately', 'Check for potential security issues'],
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    return insights;
  }

  private generateSeasonalInsights(): CacheInsight[] {
    const insights: CacheInsight[] = [];
    const seasonalPatterns = this.getSeasonalPatterns();
    
    // Strong seasonal patterns
    const strongSeasonalPatterns = seasonalPatterns.filter(p => p.strength > 0.7);
    if (strongSeasonalPatterns.length > 0) {
      insights.push({
        id: `insight_seasonal_${Date.now()}`,
        type: 'pattern',
        severity: 'info',
        title: 'Strong Seasonal Patterns',
        description: `Found ${strongSeasonalPatterns.length} keys with strong seasonal patterns`,
        data: { patterns: strongSeasonalPatterns },
        recommendations: ['Optimize cache warming based on seasonal patterns', 'Adjust TTLs for seasonal keys'],
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    return insights;
  }

  private generateTrendInsights(): CacheInsight[] {
    const insights: CacheInsight[] = [];
    const trends = this.getTrends();
    
    // Increasing trends
    const increasingTrends = trends.filter(t => t.trend === 'increasing' && t.strength > 0.5);
    if (increasingTrends.length > 0) {
      insights.push({
        id: `insight_increasing_${Date.now()}`,
        type: 'pattern',
        severity: 'warning',
        title: 'Increasing Access Trends',
        description: `${increasingTrends.length} keys show increasing access patterns`,
        data: { trends: increasingTrends },
        recommendations: ['Prepare for increased load', 'Consider scaling cache resources'],
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    return insights;
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.config.insightRetentionPeriod * 1000;
    
    // Clean old insights
    this.insights = this.insights.filter(insight => 
      insight.timestamp.getTime() > cutoffTime
    );
    
    // Clean old anomalies
    this.anomalies = this.anomalies.filter(anomaly => 
      anomaly.timestamp.getTime() > cutoffTime
    );
    
    // Limit pattern history
    for (const [key, history] of this.accessHistory.entries()) {
      if (history.length > 1000) {
        this.accessHistory.set(key, history.slice(-1000));
      }
    }
  }

  // Helper methods

  private extractPattern(key: string): string {
    if (key.includes(':')) {
      const parts = key.split(':');
      return parts.slice(0, -1).join(':') + ':*';
    }
    return key;
  }

  private calculateHourlyDistribution(key: string): number[] {
    const history = this.accessHistory.get(key) || [];
    const hourlyCounts = new Array(24).fill(0);
    
    for (const event of history) {
      if (event.type === 'hit') {
        const hour = event.timestamp.getHours();
        hourlyCounts[hour]++;
      }
    }
    
    const total = hourlyCounts.reduce((sum, count) => sum + count, 0);
    return total > 0 ? hourlyCounts.map(count => count / total) : hourlyCounts;
  }

  private calculateWeeklyDistribution(key: string): number[] {
    const history = this.accessHistory.get(key) || [];
    const weeklyCounts = new Array(7).fill(0);
    
    for (const event of history) {
      if (event.type === 'hit') {
        const dayOfWeek = event.timestamp.getDay();
        weeklyCounts[dayOfWeek]++;
      }
    }
    
    const total = weeklyCounts.reduce((sum, count) => sum + count, 0);
    return total > 0 ? weeklyCounts.map(count => count / total) : weeklyCounts;
  }

  private detectSeasonalTrend(key: string): 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none' {
    const seasonalPattern = this.seasonalPatterns.get(key);
    return seasonalPattern ? seasonalPattern.cycle : 'none';
  }

  private calculateCorrelation(key: string): number {
    const trend = this.trends.get(key);
    return trend ? Math.abs(trend.correlation) : 0;
  }

  private calculateAvgResponseTime(history: CacheEvent[]): number {
    const responseTimes = history
      .filter(event => event.metadata.responseTime)
      .map(event => event.metadata.responseTime!);
    
    return responseTimes.length > 0 ? 
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
  }

  private calculateAverageSize(history: CacheEvent[]): number {
    const sizes = history
      .filter(event => event.metadata.size)
      .map(event => event.metadata.size!);
    
    return sizes.length > 0 ? 
      sizes.reduce((sum, size) => sum + size, 0) / sizes.length : 0;
  }

  private getAverageTTL(history: CacheEvent[]): number {
    const ttls = history
      .filter(event => event.metadata.ttl)
      .map(event => event.metadata.ttl!);
    
    return ttls.length > 0 ? 
      ttls.reduce((sum, ttl) => sum + ttl, 0) / ttls.length : 3600;
  }

  private calculatePriority(key: string, history: CacheEvent[]): number {
    const frequency = history.filter(event => event.type === 'hit').length;
    const avgSize = this.calculateAverageSize(history);
    
    // Higher priority for frequently accessed and small items
    const priority = Math.min(10, Math.max(1, frequency / 10 + (1024 / Math.max(avgSize, 1))));
    return Math.round(priority);
  }

  private isSeasonal(accessTimes: Date[]): boolean {
    return this.seasonalPatterns.has(accessTimes[0].toString());
  }

  private detectTrend(accessTimes: Date[]): 'increasing' | 'decreasing' | 'stable' | 'volatile' {
    const trend = this.trends.get(accessTimes[0].toString());
    return trend ? trend.trend : 'stable';
  }

  private calculateConfidence(accessTimes: Date[]): number {
    if (accessTimes.length < 10) return 0.1;
    
    const seasonalPattern = this.seasonalPatterns.get(accessTimes[0].toString());
    const trend = this.trends.get(accessTimes[0].toString());
    
    let confidence = 0.5;
    
    if (seasonalPattern) {
      confidence += seasonalPattern.confidence * 0.3;
    }
    
    if (trend) {
      confidence += Math.abs(trend.correlation) * 0.2;
    }
    
    return Math.min(confidence, 1);
  }

  private getTotalAccessCount(): number {
    let total = 0;
    for (const history of this.accessHistory.values()) {
      total += history.filter(event => event.type === 'hit').length;
    }
    return total;
  }

  private calculatePatternDiversity(patterns: CachePattern[]): number {
    const uniquePatterns = new Set(patterns.map(p => p.pattern));
    return patterns.length > 0 ? uniquePatterns.size / patterns.length : 0;
  }
}
