import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { redisService } from '../services/redisService';

export interface CacheConfig {
  enableCaching: boolean;
  defaultTTL: number;
  maxSize: number;
  strategy: 'LRU' | 'LFU' | 'FIFO' | 'TTL' | 'ADAPTIVE';
  enableRedis: boolean;
  redisKeyPrefix: string;
  enableCompression: boolean;
  compressionThreshold: number;
  enableEncryption: boolean;
  encryptionKey?: string;
  enableDistributedCache: boolean;
  enableCacheInvalidation: boolean;
  enableCacheWarming: boolean;
  enableCacheAnalytics: boolean;
  enableIntelligentCaching: boolean;
}

export interface CacheEntry {
  key: string;
  value: any;
  metadata: {
    createdAt: number;
    expiresAt: number;
    accessCount: number;
    lastAccessed: number;
    size: number;
    compressed: boolean;
    encrypted: boolean;
    version: string;
    tags: string[];
    etag?: string;
    lastModified?: number;
  };
}

export interface CachePolicy {
  key: string;
  ttl: number;
  strategy: 'LRU' | 'LFU' | 'FIFO' | 'TTL';
  maxSize?: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  tags: string[];
  invalidationRules: Array<{
    type: 'time' | 'event' | 'dependency' | 'manual';
    condition: any;
    action: 'invalidate' | 'refresh' | 'update';
  }>;
  warmingRules: Array<{
    type: 'scheduled' | 'event' | 'dependency';
    condition: any;
    action: 'preload' | 'refresh';
  }>;
}

export interface CacheResult {
  hit: boolean;
  key: string;
  value?: any;
  metadata?: CacheEntry['metadata'];
  source: 'memory' | 'redis' | 'distributed';
  responseTime: number;
}

export interface CacheMetrics {
  totalRequests: number;
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  invalidations: number;
  warmingOperations: number;
  compressionRatio: number;
  averageResponseTime: number;
  memoryUsage: number;
  redisUsage: number;
  distributedUsage: number;
  topKeys: Array<{
    key: string;
    hits: number;
    size: number;
  }>;
  byTag: Record<string, {
    hits: number;
    misses: number;
    size: number;
  }>;
}

export class AdvancedCacheService {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];
  private accessFrequency: Map<string, number> = new Map();
  private policies: Map<string, CachePolicy> = new Map();
  private metrics: CacheMetrics;
  private cleanupInterval: NodeJS.Timeout;
  private analyticsInterval: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      enableCaching: true,
      defaultTTL: 300000, // 5 minutes
      maxSize: 10000,
      strategy: 'LRU',
      enableRedis: true,
      redisKeyPrefix: 'gateway_cache:',
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      enableEncryption: false,
      enableDistributedCache: true,
      enableCacheInvalidation: true,
      enableCacheWarming: true,
      enableCacheAnalytics: true,
      enableIntelligentCaching: false,
      ...config,
    };

    this.initializeMetrics();
    this.startCleanupProcess();
    this.startAnalyticsProcess();
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      missRate: 0,
      evictions: 0,
      invalidations: 0,
      warmingOperations: 0,
      compressionRatio: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      redisUsage: 0,
      distributedUsage: 0,
      topKeys: [],
      byTag: {},
    };
  }

  private startCleanupProcess(): void {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000);
  }

  private startAnalyticsProcess(): void {
    if (!this.config.enableCacheAnalytics) return;

    // Update analytics every 5 minutes
    this.analyticsInterval = setInterval(() => {
      this.updateAnalytics();
    }, 300000);
  }

  public async get(key: string): Promise<CacheResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Try memory cache first
      const memoryResult = await this.getFromMemory(key);
      if (memoryResult.hit) {
        this.metrics.hits++;
        this.updateMetricsTime(startTime);
        return memoryResult;
      }

      // Try Redis cache
      if (this.config.enableRedis) {
        const redisResult = await this.getFromRedis(key);
        if (redisResult.hit) {
          this.metrics.hits++;
          
          // Store in memory cache for faster access
          await this.setInMemory(key, redisResult.value, redisResult.metadata);
          
          this.updateMetricsTime(startTime);
          return redisResult;
        }
      }

      // Try distributed cache
      if (this.config.enableDistributedCache) {
        const distributedResult = await this.getFromDistributed(key);
        if (distributedResult.hit) {
          this.metrics.hits++;
          
          // Store in memory and Redis for faster access
          await this.setInMemory(key, distributedResult.value, distributedResult.metadata);
          if (this.config.enableRedis) {
            await this.setInRedis(key, distributedResult.value, distributedResult.metadata);
          }
          
          this.updateMetricsTime(startTime);
          return distributedResult;
        }
      }

      // Cache miss
      this.metrics.misses++;
      this.updateMetricsTime(startTime);
      
      return {
        hit: false,
        key,
        source: 'memory',
        responseTime: Date.now() - startTime,
      };

    } catch (error) {
      logger.error('Cache get error:', error);
      this.metrics.misses++;
      this.updateMetricsTime(startTime);
      
      return {
        hit: false,
        key,
        source: 'memory',
        responseTime: Date.now() - startTime,
      };
    }
  }

  public async set(key: string, value: any, ttl?: number, metadata?: Partial<CacheEntry['metadata']>): Promise<boolean> {
    try {
      const policy = this.policies.get(key);
      const effectiveTTL = ttl || policy?.ttl || this.config.defaultTTL;
      
      const cacheMetadata: CacheEntry['metadata'] = {
        createdAt: Date.now(),
        expiresAt: Date.now() + effectiveTTL,
        accessCount: 0,
        lastAccessed: Date.now(),
        size: this.calculateSize(value),
        compressed: false,
        encrypted: false,
        version: '1.0',
        tags: policy?.tags || [],
        ...metadata,
      };

      // Process value (compression, encryption)
      let processedValue = value;
      let compressed = false;
      let encrypted = false;

      if (this.config.enableCompression && cacheMetadata.size > this.config.compressionThreshold) {
        processedValue = await this.compressValue(processedValue);
        cacheMetadata.compressed = true;
        compressed = true;
      }

      if (this.config.enableEncryption && this.config.encryptionKey) {
        processedValue = await this.encryptValue(processedValue);
        cacheMetadata.encrypted = true;
        encrypted = true;
      }

      // Store in memory cache
      await this.setInMemory(key, processedValue, cacheMetadata);

      // Store in Redis cache
      if (this.config.enableRedis) {
        await this.setInRedis(key, processedValue, cacheMetadata);
      }

      // Store in distributed cache
      if (this.config.enableDistributedCache) {
        await this.setInDistributed(key, processedValue, cacheMetadata);
      }

      return true;

    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  public async invalidate(key: string): Promise<boolean> {
    try {
      // Remove from memory cache
      this.memoryCache.delete(key);
      this.removeFromAccessOrder(key);
      this.accessFrequency.delete(key);

      // Remove from Redis cache
      if (this.config.enableRedis) {
        await redisService.del(`${this.config.redisKeyPrefix}${key}`);
      }

      // Remove from distributed cache
      if (this.config.enableDistributedCache) {
        await this.invalidateInDistributed(key);
      }

      this.metrics.invalidations++;
      return true;

    } catch (error) {
      logger.error('Cache invalidate error:', error);
      return false;
    }
  }

  public async invalidateByTag(tag: string): Promise<number> {
    let invalidatedCount = 0;

    try {
      // Invalidate from memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.metadata.tags.includes(tag)) {
          this.memoryCache.delete(key);
          this.removeFromAccessOrder(key);
          this.accessFrequency.delete(key);
          invalidatedCount++;
        }
      }

      // Invalidate from Redis cache
      if (this.config.enableRedis) {
        const redisKeys = await redisService.keys(`${this.config.redisKeyPrefix}*`);
        for (const redisKey of redisKeys) {
          const key = redisKey.replace(this.config.redisKeyPrefix, '');
          const entry = await this.getFromRedis(key);
          if (entry.hit && entry.metadata?.tags.includes(tag)) {
            await redisService.del(redisKey);
            invalidatedCount++;
          }
        }
      }

      this.metrics.invalidations += invalidatedCount;
      return invalidatedCount;

    } catch (error) {
      logger.error('Cache invalidate by tag error:', error);
      return 0;
    }
  }

  public async invalidateByPattern(pattern: string): Promise<number> {
    let invalidatedCount = 0;

    try {
      const regex = new RegExp(pattern);

      // Invalidate from memory cache
      for (const [key] of this.memoryCache.entries()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          this.removeFromAccessOrder(key);
          this.accessFrequency.delete(key);
          invalidatedCount++;
        }
      }

      // Invalidate from Redis cache
      if (this.config.enableRedis) {
        const redisKeys = await redisService.keys(`${this.config.redisKeyPrefix}*`);
        for (const redisKey of redisKeys) {
          const key = redisKey.replace(this.config.redisKeyPrefix, '');
          if (regex.test(key)) {
            await redisService.del(redisKey);
            invalidatedCount++;
          }
        }
      }

      this.metrics.invalidations += invalidatedCount;
      return invalidatedCount;

    } catch (error) {
      logger.error('Cache invalidate by pattern error:', error);
      return 0;
    }
  }

  private async getFromMemory(key: string): Promise<CacheResult> {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      return {
        hit: false,
        key,
        source: 'memory',
        responseTime: 0,
      };
    }

    // Check if expired
    if (Date.now() > entry.metadata.expiresAt) {
      this.memoryCache.delete(key);
      this.removeFromAccessOrder(key);
      this.accessFrequency.delete(key);
      
      return {
        hit: false,
        key,
        source: 'memory',
        responseTime: 0,
      };
    }

    // Update access information
    entry.metadata.accessCount++;
    entry.metadata.lastAccessed = Date.now();
    this.updateAccessOrder(key);
    this.updateAccessFrequency(key);

    // Process value (decompression, decryption)
    let value = entry.value;
    
    if (entry.metadata.encrypted) {
      value = await this.decryptValue(value);
    }
    
    if (entry.metadata.compressed) {
      value = await this.decompressValue(value);
    }

    return {
      hit: true,
      key,
      value,
      metadata: entry.metadata,
      source: 'memory',
      responseTime: 0,
    };
  }

  private async setInMemory(key: string, value: any, metadata: CacheEntry['metadata']): Promise<void> {
    // Check cache size limit
    if (this.memoryCache.size >= this.config.maxSize) {
      this.evictFromMemory();
    }

    const entry: CacheEntry = {
      key,
      value,
      metadata,
    };

    this.memoryCache.set(key, entry);
    this.updateAccessOrder(key);
    this.updateAccessFrequency(key);
  }

  private evictFromMemory(): void {
    switch (this.config.strategy) {
      case 'LRU':
        this.evictLRU();
        break;
      case 'LFU':
        this.evictLFU();
        break;
      case 'FIFO':
        this.evictFIFO();
        break;
      case 'TTL':
        this.evictTTL();
        break;
      case 'ADAPTIVE':
        this.evictAdaptive();
        break;
      default:
        this.evictLRU();
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder[0];
      this.memoryCache.delete(lruKey);
      this.removeFromAccessOrder(lruKey);
      this.accessFrequency.delete(lruKey);
      this.metrics.evictions++;
    }
  }

  private evictLFU(): void {
    let minFrequency = Infinity;
    let lfuKey = '';

    for (const [key, frequency] of this.accessFrequency.entries()) {
      if (frequency < minFrequency) {
        minFrequency = frequency;
        lfuKey = key;
      }
    }

    if (lfuKey) {
      this.memoryCache.delete(lfuKey);
      this.removeFromAccessOrder(lfuKey);
      this.accessFrequency.delete(lfuKey);
      this.metrics.evictions++;
    }
  }

  private evictFIFO(): void {
    const keys = Array.from(this.memoryCache.keys());
    if (keys.length > 0) {
      const oldestKey = keys[0];
      const oldestEntry = this.memoryCache.get(oldestKey);
      
      if (oldestEntry) {
        let oldestTime = oldestEntry.metadata.createdAt;
        let keyToRemove = oldestKey;

        for (const [key, entry] of this.memoryCache.entries()) {
          if (entry.metadata.createdAt < oldestTime) {
            oldestTime = entry.metadata.createdAt;
            keyToRemove = key;
          }
        }

        this.memoryCache.delete(keyToRemove);
        this.removeFromAccessOrder(keyToRemove);
        this.accessFrequency.delete(keyToRemove);
        this.metrics.evictions++;
      }
    }
  }

  private evictTTL(): void {
    let earliestExpiry = Infinity;
    let keyToRemove = '';

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.metadata.expiresAt < earliestExpiry) {
        earliestExpiry = entry.metadata.expiresAt;
        keyToRemove = key;
      }
    }

    if (keyToRemove) {
      this.memoryCache.delete(keyToRemove);
      this.removeFromAccessOrder(keyToRemove);
      this.accessFrequency.delete(keyToRemove);
      this.metrics.evictions++;
    }
  }

  private evictAdaptive(): void {
    // Adaptive eviction based on access patterns and size
    const scores = new Map<string, number>();

    for (const [key, entry] of this.memoryCache.entries()) {
      const age = Date.now() - entry.metadata.createdAt;
      const timeSinceAccess = Date.now() - entry.metadata.lastAccessed;
      const frequency = this.accessFrequency.get(key) || 0;
      const size = entry.metadata.size;

      // Calculate adaptive score (lower score = higher eviction priority)
      const score = (frequency * 1000) / (age * timeSinceAccess * size);
      scores.set(key, score);
    }

    // Find entry with lowest score
    let lowestScore = Infinity;
    let keyToRemove = '';

    for (const [key, score] of scores.entries()) {
      if (score < lowestScore) {
        lowestScore = score;
        keyToRemove = key;
      }
    }

    if (keyToRemove) {
      this.memoryCache.delete(keyToRemove);
      this.removeFromAccessOrder(keyToRemove);
      this.accessFrequency.delete(keyToRemove);
      this.metrics.evictions++;
    }
  }

  private async getFromRedis(key: string): Promise<CacheResult> {
    try {
      const redisKey = `${this.config.redisKeyPrefix}${key}`;
      const data = await redisService.get(redisKey);

      if (!data) {
        return {
          hit: false,
          key,
          source: 'redis',
          responseTime: 0,
        };
      }

      const parsed = JSON.parse(data);
      
      // Check if expired
      if (Date.now() > parsed.metadata.expiresAt) {
        await redisService.del(redisKey);
        return {
          hit: false,
          key,
          source: 'redis',
          responseTime: 0,
        };
      }

      // Process value (decompression, decryption)
      let value = parsed.value;
      
      if (parsed.metadata.encrypted) {
        value = await this.decryptValue(value);
      }
      
      if (parsed.metadata.compressed) {
        value = await this.decompressValue(value);
      }

      return {
        hit: true,
        key,
        value,
        metadata: parsed.metadata,
        source: 'redis',
        responseTime: 0,
      };

    } catch (error) {
      logger.error('Redis cache get error:', error);
      return {
        hit: false,
        key,
        source: 'redis',
        responseTime: 0,
      };
    }
  }

  private async setInRedis(key: string, value: any, metadata: CacheEntry['metadata']): Promise<void> {
    try {
      const redisKey = `${this.config.redisKeyPrefix}${key}`;
      const data = {
        key,
        value,
        metadata,
      };

      const ttl = Math.ceil((metadata.expiresAt - Date.now()) / 1000);
      await redisService.set(redisKey, JSON.stringify(data), ttl);

    } catch (error) {
      logger.error('Redis cache set error:', error);
    }
  }

  private async getFromDistributed(key: string): Promise<CacheResult> {
    // Placeholder for distributed cache implementation
    // In production, this would integrate with a distributed cache system
    return {
      hit: false,
      key,
      source: 'distributed',
      responseTime: 0,
    };
  }

  private async setInDistributed(key: string, value: any, metadata: CacheEntry['metadata']): Promise<void> {
    // Placeholder for distributed cache implementation
  }

  private async invalidateInDistributed(key: string): Promise<void> {
    // Placeholder for distributed cache implementation
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private updateAccessFrequency(key: string): void {
    const current = this.accessFrequency.get(key) || 0;
    this.accessFrequency.set(key, current + 1);
  }

  private calculateSize(value: any): number {
    return JSON.stringify(value).length;
  }

  private async compressValue(value: any): Promise<any> {
    // Placeholder for compression implementation
    // In production, use a compression library like gzip or brotli
    return value;
  }

  private async decompressValue(value: any): Promise<any> {
    // Placeholder for decompression implementation
    return value;
  }

  private async encryptValue(value: any): Promise<any> {
    // Placeholder for encryption implementation
    // In production, use a proper encryption library
    return value;
  }

  private async decryptValue(value: any): Promise<any> {
    // Placeholder for decryption implementation
    return value;
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.metadata.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.memoryCache.delete(key);
      this.removeFromAccessOrder(key);
      this.accessFrequency.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  private updateAnalytics(): void {
    // Update hit rate
    this.metrics.hitRate = this.metrics.totalRequests > 0 ? 
      (this.metrics.hits / this.metrics.totalRequests) : 0;
    this.metrics.missRate = 1 - this.metrics.hitRate;

    // Update memory usage
    this.metrics.memoryUsage = this.memoryCache.size;

    // Update top keys
    this.metrics.topKeys = Array.from(this.accessFrequency.entries())
      .map(([key, hits]) => ({
        key,
        hits,
        size: this.memoryCache.get(key)?.metadata.size || 0,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    // Update tag statistics
    this.metrics.byTag = {};
    for (const entry of this.memoryCache.values()) {
      for (const tag of entry.metadata.tags) {
        if (!this.metrics.byTag[tag]) {
          this.metrics.byTag[tag] = { hits: 0, misses: 0, size: 0 };
        }
        this.metrics.byTag[tag].hits += entry.metadata.accessCount;
        this.metrics.byTag[tag].size += entry.metadata.size;
      }
    }
  }

  private updateMetricsTime(startTime: number): void {
    const responseTime = Date.now() - startTime;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / this.metrics.totalRequests;
  }

  // Policy management
  public setPolicy(key: string, policy: CachePolicy): void {
    this.policies.set(key, policy);
    logger.info(`Cache policy set for key: ${key}`);
  }

  public removePolicy(key: string): void {
    if (this.policies.delete(key)) {
      logger.info(`Cache policy removed for key: ${key}`);
    }
  }

  public getPolicy(key: string): CachePolicy | undefined {
    return this.policies.get(key);
  }

  // Cache warming
  public async warmCache(keys: string[]): Promise<number> {
    let warmedCount = 0;

    for (const key of keys) {
      try {
        // Preload cache entry (implementation depends on your data source)
        // This is a placeholder - you would implement actual data loading
        warmedCount++;
        this.metrics.warmingOperations++;
      } catch (error) {
        logger.error(`Cache warming error for key ${key}:`, error);
      }
    }

    logger.info(`Cache warming completed: ${warmedCount}/${keys.length} entries`);
    return warmedCount;
  }

  // Metrics and monitoring
  public async getMetrics(): Promise<CacheMetrics> {
    return { ...this.metrics };
  }

  public async getCacheInfo(): Promise<any> {
    return {
      config: this.config,
      size: this.memoryCache.size,
      maxSize: this.config.maxSize,
      strategy: this.config.strategy,
      policies: this.policies.size,
      memoryUsage: this.metrics.memoryUsage,
      hitRate: this.metrics.hitRate,
      averageResponseTime: this.metrics.averageResponseTime,
    };
  }

  public async resetMetrics(): Promise<void> {
    this.initializeMetrics();
    logger.info('AdvancedCacheService metrics reset');
  }

  public clear(): void {
    this.memoryCache.clear();
    this.accessOrder = [];
    this.accessFrequency.clear();
    this.policies.clear();
    logger.info('AdvancedCacheService cache cleared');
  }

  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('AdvancedCacheService configuration updated');
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }
    
    this.clear();
    logger.info('AdvancedCacheService destroyed');
  }
}
