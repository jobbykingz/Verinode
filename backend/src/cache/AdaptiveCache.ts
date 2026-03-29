import { EventEmitter } from 'events';
import { WinstonLogger } from '../utils/logger';
import { 
  CachePattern, 
  CachePrediction, 
  CacheStrategy, 
  CacheEvictionPolicy,
  CacheConfiguration,
  CacheEvent,
  CacheOptimization
} from '../models/CachePattern';
import { MLCachePredictor } from './MLCachePredictor';
import { PatternAnalyzer } from './PatternAnalyzer';

export interface AdaptiveCacheConfig {
  initialSize: number;
  minSize: number;
  maxSize: number;
  targetHitRate: number;
  targetResponseTime: number;
  memoryThreshold: number;
  adaptationInterval: number;
  evictionPolicy: CacheEvictionPolicy['algorithm'];
  predictionWeight: number;
  patternWeight: number;
  performanceWeight: number;
}

export interface CacheItem {
  key: string;
  value: any;
  size: number;
  ttl: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  priority: number;
  prediction: CachePrediction;
  pattern?: CachePattern;
  metadata: {
    responseTime?: number;
    evictionReason?: string;
    adaptationCount: number;
  };
}

export interface CacheMetrics {
  size: number;
  itemCount: number;
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  evictionRate: number;
  adaptationCount: number;
  lastAdaptation: Date;
}

export interface AdaptationResult {
  type: 'size' | 'policy' | 'ttl' | 'priority';
  action: string;
  oldValue: any;
  newValue: any;
  reason: string;
  impact: {
    expectedHitRateChange: number;
    expectedMemoryChange: number;
    expectedResponseTimeChange: number;
  };
  timestamp: Date;
}

export class AdaptiveCache extends EventEmitter {
  private config: AdaptiveCacheConfig;
  private logger: WinstonLogger;
  private predictor: MLCachePredictor;
  private analyzer: PatternAnalyzer;
  private cache: Map<string, CacheItem>;
  private metrics: CacheMetrics;
  private configuration: CacheConfiguration;
  private adaptationHistory: AdaptationResult[];
  private adaptationTimer?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  constructor(
    config: AdaptiveCacheConfig,
    predictor: MLCachePredictor,
    analyzer: PatternAnalyzer
  ) {
    super();
    this.config = config;
    this.logger = new WinstonLogger();
    this.predictor = predictor;
    this.analyzer = analyzer;
    this.cache = new Map();
    this.metrics = this.initializeMetrics();
    this.configuration = this.initializeConfiguration();
    this.adaptationHistory = [];
  }

  /**
   * Initialize the adaptive cache
   */
  async initialize(): Promise<void> {
    try {
      this.startAdaptation();
      this.isInitialized = true;
      this.logger.info('Adaptive Cache initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Adaptive Cache', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<any | null> {
    const startTime = Date.now();
    
    try {
      const item = this.cache.get(key);
      
      if (!item) {
        this.recordMiss(key, Date.now() - startTime);
        return null;
      }
      
      // Check if item is expired
      if (this.isExpired(item)) {
        this.cache.delete(key);
        this.recordEviction(key, 'expired');
        this.recordMiss(key, Date.now() - startTime);
        return null;
      }
      
      // Update access information
      item.lastAccessed = new Date();
      item.accessCount++;
      
      // Record hit
      this.recordHit(key, Date.now() - startTime);
      
      // Emit access event for pattern analysis
      this.emitAccessEvent('hit', key, item);
      
      return item.value;

    } catch (error) {
      this.logger.error(`Failed to get cache value for key: ${key}`, error);
      this.recordError();
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      // Get prediction for this key
      const prediction = await this.predictor.predictAccess(key);
      
      // Get pattern for this key
      const pattern = this.analyzer.getPattern(key);
      
      // Calculate item size (simplified)
      const size = this.calculateSize(value);
      
      // Check if we need to make space
      await this.ensureCapacity(size);
      
      // Determine optimal TTL
      const optimalTTL = ttl || this.calculateOptimalTTL(prediction, pattern);
      
      // Determine priority
      const priority = this.calculatePriority(prediction, pattern, size);
      
      const item: CacheItem = {
        key,
        value,
        size,
        ttl: optimalTTL,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        priority,
        prediction,
        pattern,
        metadata: {
          adaptationCount: 0
        }
      };
      
      this.cache.set(key, item);
      this.recordSet(key, size);
      
      // Emit access event for pattern analysis
      this.emitAccessEvent('set', key, item);
      
      return true;

    } catch (error) {
      this.logger.error(`Failed to set cache value for key: ${key}`, error);
      this.recordError();
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      const deleted = this.cache.delete(key);
      
      if (deleted) {
        this.recordDelete(key);
        this.emitAccessEvent('delete', key);
      }
      
      return deleted;

    } catch (error) {
      this.logger.error(`Failed to delete cache value for key: ${key}`, error);
      this.recordError();
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const item = this.cache.get(key);
      
      if (!item) {
        return false;
      }
      
      if (this.isExpired(item)) {
        this.cache.delete(key);
        this.recordEviction(key, 'expired');
        return false;
      }
      
      return true;

    } catch (error) {
      this.logger.error(`Failed to check existence for key: ${key}`, error);
      this.recordError();
      return false;
    }
  }

  /**
   * Clear cache
   */
  async clear(): Promise<void> {
    try {
      const itemCount = this.cache.size;
      this.cache.clear();
      
      this.recordClear(itemCount);
      this.logger.info(`Cleared cache with ${itemCount} items`);
      this.emit('cleared', { itemCount });

    } catch (error) {
      this.logger.error('Failed to clear cache', error);
      this.recordError();
      throw error;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get cache configuration
   */
  getConfiguration(): CacheConfiguration {
    return { ...this.configuration };
  }

  /**
   * Get adaptation history
   */
  getAdaptationHistory(): AdaptationResult[] {
    return [...this.adaptationHistory];
  }

  /**
   * Manually trigger adaptation
   */
  async adapt(): Promise<AdaptationResult[]> {
    try {
      this.logger.info('Starting manual cache adaptation...');
      
      const results: AdaptationResult[] = [];
      
      // Analyze current performance
      const performance = this.analyzePerformance();
      
      // Size adaptation
      const sizeAdaptation = this.adaptSize(performance);
      if (sizeAdaptation) {
        results.push(sizeAdaptation);
      }
      
      // Eviction policy adaptation
      const policyAdaptation = this.adaptEvictionPolicy(performance);
      if (policyAdaptation) {
        results.push(policyAdaptation);
      }
      
      // TTL adaptation
      const ttlAdaptation = this.adaptTTL(performance);
      if (ttlAdaptation) {
        results.push(ttlAdaptation);
      }
      
      // Priority adaptation
      const priorityAdaptation = this.adaptPriority(performance);
      if (priorityAdaptation) {
        results.push(priorityAdaptation);
      }
      
      // Apply adaptations
      await this.applyAdaptations(results);
      
      this.adaptationHistory.push(...results);
      this.metrics.adaptationCount += results.length;
      this.metrics.lastAdaptation = new Date();
      
      this.emit('adapted', results);
      this.logger.info(`Cache adaptation completed with ${results.length} changes`);
      
      return results;

    } catch (error) {
      this.logger.error('Cache adaptation failed', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Warm up cache based on predictions
   */
  async warmup(keys?: string[]): Promise<void> {
    try {
      this.logger.info('Starting cache warmup...');
      
      const targetKeys = keys || this.getWarmupCandidates();
      const warmupPromises = targetKeys.map(async (key) => {
        try {
          const prediction = await this.predictor.predictAccess(key);
          
          if (prediction.probability > 0.7 && prediction.strategy === 'prefetch') {
            // In a real implementation, this would fetch the actual data
            // For now, we'll just simulate the warmup
            await this.set(key, { warmed: true, timestamp: Date.now() }, prediction.recommendedTTL);
          }
        } catch (error) {
          this.logger.warn(`Failed to warmup key: ${key}`, error);
        }
      });
      
      await Promise.all(warmupPromises);
      
      this.logger.info(`Cache warmup completed for ${targetKeys.length} keys`);
      this.emit('warmed', { keys: targetKeys.length });

    } catch (error) {
      this.logger.error('Cache warmup failed', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Shutdown the adaptive cache
   */
  async shutdown(): Promise<void> {
    try {
      if (this.adaptationTimer) {
        clearInterval(this.adaptationTimer);
      }
      
      this.cache.clear();
      this.isInitialized = false;
      
      this.logger.info('Adaptive Cache shutdown completed');
      this.emit('shutdown');

    } catch (error) {
      this.logger.error('Failed to shutdown Adaptive Cache', error);
      throw error;
    }
  }

  // Private methods

  private startAdaptation(): void {
    this.adaptationTimer = setInterval(async () => {
      try {
        await this.adapt();
      } catch (error) {
        this.logger.error('Automatic adaptation failed', error);
      }
    }, this.config.adaptationInterval * 1000);
  }

  private initializeMetrics(): CacheMetrics {
    return {
      size: 0,
      itemCount: 0,
      hitRate: 0,
      missRate: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      evictionRate: 0,
      adaptationCount: 0,
      lastAdaptation: new Date()
    };
  }

  private initializeConfiguration(): CacheConfiguration {
    return {
      maxSize: this.config.maxSize,
      currentSize: this.config.initialSize,
      hitRateThreshold: this.config.targetHitRate,
      responseTimeThreshold: this.config.targetResponseTime,
      memoryThreshold: this.config.memoryThreshold,
      evictionPolicy: {
        name: this.config.evictionPolicy,
        algorithm: this.config.evictionPolicy,
        parameters: {},
        performance: {
          evictionRate: 0,
          hitRateAfterEviction: 0,
          memoryRecovery: 0
        }
      },
      warmupEnabled: true,
      predictionEnabled: true,
      optimizationEnabled: true,
      abTestingEnabled: false
    };
  }

  private calculateSize(value: any): number {
    // Simplified size calculation
    // In a real implementation, this would use more sophisticated methods
    return JSON.stringify(value).length * 2; // Rough estimate in bytes
  }

  private async ensureCapacity(requiredSize: number): Promise<void> {
    const currentSize = this.getCurrentSize();
    const availableSize = this.configuration.currentSize - currentSize;
    
    if (availableSize >= requiredSize) {
      return;
    }
    
    const spaceNeeded = requiredSize - availableSize;
    const itemsToEvict = await this.selectItemsForEviction(spaceNeeded);
    
    for (const item of itemsToEvict) {
      this.cache.delete(item.key);
      this.recordEviction(item.key, 'capacity');
    }
  }

  private async selectItemsForEviction(spaceNeeded: number): Promise<CacheItem[]> {
    const items = Array.from(this.cache.values());
    
    // Sort by eviction priority (lowest first)
    items.sort((a, b) => {
      const scoreA = this.calculateEvictionScore(a);
      const scoreB = this.calculateEvictionScore(b);
      return scoreA - scoreB;
    });
    
    const selected: CacheItem[] = [];
    let freedSpace = 0;
    
    for (const item of items) {
      selected.push(item);
      freedSpace += item.size;
      
      if (freedSpace >= spaceNeeded) {
        break;
      }
    }
    
    return selected;
  }

  private calculateEvictionScore(item: CacheItem): number {
    // Lower score = higher eviction priority
    let score = item.priority * 10;
    
    // Factor in access frequency
    score += item.accessCount * 2;
    
    // Factor in recency
    const age = Date.now() - item.lastAccessed.getTime();
    score -= age / (1000 * 60); // Subtract points for recent access
    
    // Factor in prediction
    score += item.prediction.probability * 5;
    
    // Factor in size (smaller items get lower score)
    score -= item.size / 1024;
    
    return score;
  }

  private calculateOptimalTTL(prediction: CachePrediction, pattern?: CachePattern): number {
    let ttl = prediction.recommendedTTL;
    
    // Adjust based on pattern
    if (pattern) {
      if (pattern.seasonal) {
        ttl *= 1.2; // Longer TTL for seasonal patterns
      }
      
      if (pattern.trend === 'increasing') {
        ttl *= 1.1; // Slightly longer for increasing trends
      } else if (pattern.trend === 'decreasing') {
        ttl *= 0.8; // Shorter for decreasing trends
      }
    }
    
    // Adjust based on confidence
    ttl *= (0.5 + prediction.confidence);
    
    // Ensure TTL is within reasonable bounds
    return Math.max(300, Math.min(ttl, 86400));
  }

  private calculatePriority(prediction: CachePrediction, pattern?: CachePattern, size: number = 0): number {
    let priority = prediction.recommendedPriority;
    
    // Adjust based on pattern
    if (pattern && pattern.frequency > 50) {
      priority += 2;
    }
    
    // Adjust based on size (smaller items get higher priority)
    if (size < 1024) {
      priority += 1;
    } else if (size > 10240) {
      priority -= 1;
    }
    
    // Ensure priority is within bounds
    return Math.max(1, Math.min(priority, 10));
  }

  private isExpired(item: CacheItem): boolean {
    const age = Date.now() - item.createdAt.getTime();
    return age > item.ttl * 1000;
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const item of this.cache.values()) {
      totalSize += item.size;
    }
    return totalSize;
  }

  private getWarmupCandidates(): string[] {
    const items = Array.from(this.cache.values());
    
    // Sort by prediction probability and access frequency
    items.sort((a, b) => {
      const scoreA = a.prediction.probability * a.accessCount;
      const scoreB = b.prediction.probability * b.accessCount;
      return scoreB - scoreA;
    });
    
    // Return top candidates
    return items.slice(0, Math.min(100, items.length)).map(item => item.key);
  }

  private analyzePerformance(): any {
    const metrics = this.getMetrics();
    
    return {
      hitRate: metrics.hitRate,
      responseTime: metrics.avgResponseTime,
      memoryUsage: metrics.memoryUsage,
      evictionRate: metrics.evictionRate,
      itemCount: metrics.itemCount,
      adaptationFrequency: metrics.adaptationCount
    };
  }

  private adaptSize(performance: any): AdaptationResult | null {
    const currentSize = this.configuration.currentSize;
    const targetHitRate = this.config.targetHitRate;
    const memoryThreshold = this.config.memoryThreshold;
    
    let newSize = currentSize;
    let reason = '';
    
    // Increase size if hit rate is low and memory is available
    if (performance.hitRate < targetHitRate * 0.8 && performance.memoryUsage < memoryThreshold * 0.8) {
      newSize = Math.min(currentSize * 1.2, this.config.maxSize);
      reason = 'Low hit rate with available memory';
    }
    // Decrease size if memory usage is high and hit rate is good
    else if (performance.memoryUsage > memoryThreshold && performance.hitRate > targetHitRate) {
      newSize = Math.max(currentSize * 0.8, this.config.minSize);
      reason = 'High memory usage with good hit rate';
    }
    
    if (newSize !== currentSize) {
      return {
        type: 'size',
        action: 'resize',
        oldValue: currentSize,
        newValue: newSize,
        reason,
        impact: {
          expectedHitRateChange: newSize > currentSize ? 0.1 : -0.05,
          expectedMemoryChange: (newSize - currentSize) / currentSize,
          expectedResponseTimeChange: newSize > currentSize ? -0.02 : 0.01
        },
        timestamp: new Date()
      };
    }
    
    return null;
  }

  private adaptEvictionPolicy(performance: any): AdaptationResult | null {
    const currentPolicy = this.configuration.evictionPolicy.algorithm;
    let newPolicy = currentPolicy;
    let reason = '';
    
    // Simple policy adaptation logic
    if (performance.hitRate < this.config.targetHitRate * 0.7) {
      // Try more sophisticated policies for low hit rate
      if (currentPolicy === 'lru') {
        newPolicy = 'lfu';
        reason = 'Low hit rate, trying LFU policy';
      } else if (currentPolicy === 'lfu') {
        newPolicy = 'arc';
        reason = 'LFU not effective, trying ARC policy';
      }
    } else if (performance.evictionRate > 0.3) {
      // Try simpler policies for high eviction rate
      if (currentPolicy === 'arc') {
        newPolicy = 'lfu';
        reason = 'High eviction rate, trying LFU policy';
      } else if (currentPolicy === 'lfu') {
        newPolicy = 'lru';
        reason = 'LFU causing high eviction, trying LRU policy';
      }
    }
    
    if (newPolicy !== currentPolicy) {
      return {
        type: 'policy',
        action: 'change_policy',
        oldValue: currentPolicy,
        newValue: newPolicy,
        reason,
        impact: {
          expectedHitRateChange: 0.05,
          expectedMemoryChange: 0,
          expectedResponseTimeChange: -0.01
        },
        timestamp: new Date()
      };
    }
    
    return null;
  }

  private adaptTTL(performance: any): AdaptationResult | null {
    // This would adjust TTL policies for existing items
    // For now, return null as this is complex to implement
    return null;
  }

  private adaptPriority(performance: any): AdaptationResult | null {
    // This would adjust priority calculations
    // For now, return null as this is complex to implement
    return null;
  }

  private async applyAdaptations(adaptations: AdaptationResult[]): Promise<void> {
    for (const adaptation of adaptations) {
      switch (adaptation.type) {
        case 'size':
          this.configuration.currentSize = adaptation.newValue;
          break;
        case 'policy':
          this.configuration.evictionPolicy.algorithm = adaptation.newValue;
          break;
        case 'ttl':
          // Apply TTL changes to existing items
          break;
        case 'priority':
          // Apply priority changes to existing items
          break;
      }
    }
  }

  private emitAccessEvent(type: CacheEvent['type'], key: string, item?: CacheItem): void {
    const event: CacheEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      key,
      timestamp: new Date(),
      metadata: item ? {
        size: item.size,
        ttl: item.ttl,
        responseTime: item.metadata.responseTime,
        strategy: item.prediction.strategy
      } : {}
    };
    
    this.analyzer.addEvent(event);
    this.predictor.recordAccess(event);
  }

  private recordHit(key: string, responseTime: number): void {
    // Update metrics
    this.metrics.hitRate = (this.metrics.hitRate + 1) / (this.metrics.hitRate + this.metrics.missRate + 1);
    this.metrics.avgResponseTime = (this.metrics.avgResponseTime + responseTime) / 2;
    
    // Update item response time
    const item = this.cache.get(key);
    if (item) {
      item.metadata.responseTime = responseTime;
    }
  }

  private recordMiss(key: string, responseTime: number): void {
    // Update metrics
    this.metrics.missRate = (this.metrics.missRate + 1) / (this.metrics.hitRate + this.metrics.missRate + 1);
    this.metrics.avgResponseTime = (this.metrics.avgResponseTime + responseTime) / 2;
  }

  private recordSet(key: string, size: number): void {
    this.metrics.itemCount = this.cache.size;
    this.metrics.memoryUsage = this.getCurrentSize();
  }

  private recordDelete(key: string): void {
    this.metrics.itemCount = this.cache.size;
    this.metrics.memoryUsage = this.getCurrentSize();
  }

  private recordEviction(key: string, reason: string): void {
    this.metrics.evictionRate = this.metrics.evictionRate + 1;
    this.metrics.itemCount = this.cache.size;
    this.metrics.memoryUsage = this.getCurrentSize();
  }

  private recordClear(itemCount: number): void {
    this.metrics.itemCount = 0;
    this.metrics.memoryUsage = 0;
    this.metrics.evictionRate += itemCount;
  }

  private recordError(): void {
    // Record error metrics
  }

  private updateMetrics(): void {
    this.metrics.itemCount = this.cache.size;
    this.metrics.memoryUsage = this.getCurrentSize();
    this.metrics.size = this.configuration.currentSize;
  }
}
