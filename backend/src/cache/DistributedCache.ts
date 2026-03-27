import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { CacheConfig, RedisNode, RedisClusterOptions, CacheMetrics, CacheAnalytics } from '../config/cache';
import { WinstonLogger } from '../utils/logger';

export interface CacheItem {
  key: string;
  value: any;
  ttl: number;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  size: number;
  priority: string;
  tags?: string[];
}

export interface DistributedCacheOptions {
  keyPrefix?: string;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  serializationFormat?: 'json' | 'msgpack' | 'protobuf';
  retryAttempts?: number;
  retryDelay?: number;
}

export class DistributedCache extends EventEmitter {
  private redis: Redis | Redis.Cluster;
  private config: CacheConfig;
  private logger: WinstonLogger;
  private metrics: CacheMetrics;
  private isInitialized: boolean = false;
  private connectionPool: Map<string, Redis>;
  private keyPrefix: string;

  constructor(config: CacheConfig) {
    super();
    this.config = config;
    this.logger = new WinstonLogger();
    this.metrics = this.initializeMetrics();
    this.keyPrefix = config.redis.standalone.keyPrefix || '';
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      if (this.config.redis.cluster.enabled) {
        await this.initializeRedisCluster();
      } else {
        await this.initializeRedisStandalone();
      }
      
      this.isInitialized = true;
      this.logger.info('Distributed cache initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize distributed cache', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Initialize Redis cluster
   */
  private async initializeRedisCluster(): Promise<void> {
    const { nodes, options } = this.config.redis.cluster;
    
    this.redis = new Redis.Cluster(nodes, {
      redisOptions: options.redisOptions,
      maxRedirections: options.maxRedirections,
      retryDelayOnFailover: options.retryDelayOnFailover,
      enableReadyCheck: options.enableReadyCheck,
      scaleReads: options.scaleReads,
      ...this.config.redis.connection
    });

    this.setupRedisEventHandlers();
  }

  /**
   * Initialize standalone Redis
   */
  private async initializeRedisStandalone(): Promise<void> {
    const { host, port, password, db } = this.config.redis.standalone;
    
    this.redis = new Redis({
      host,
      port,
      password,
      db,
      maxRetriesPerRequest: this.config.redis.connection.maxRetriesPerRequest,
      retryDelayOnFailover: this.config.redis.connection.retryDelayOnFailover,
      enableOfflineQueue: this.config.redis.connection.enableOfflineQueue,
      lazyConnect: this.config.redis.connection.lazyConnect,
      keepAlive: this.config.redis.connection.keepAlive,
      connectTimeout: this.config.redis.connection.connectTimeout,
      commandTimeout: this.config.redis.connection.commandTimeout
    });

    this.setupRedisEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupRedisEventHandlers(): void {
    if (this.redis instanceof Redis.Cluster) {
      this.redis.on('connect', () => {
        this.logger.info('Redis cluster connected');
        this.emit('connected');
      });

      this.redis.on('error', (error) => {
        this.logger.error('Redis cluster error', error);
        this.metrics.errors++;
        this.emit('error', error);
      });

      this.redis.on('close', () => {
        this.logger.warn('Redis cluster connection closed');
        this.emit('disconnected');
      });

      this.redis.on('node error', (error, node) => {
        this.logger.error(`Redis cluster node error: ${node}`, error);
        this.metrics.errors++;
      });

    } else {
      this.redis.on('connect', () => {
        this.logger.info('Redis connected');
        this.emit('connected');
      });

      this.redis.on('error', (error) => {
        this.logger.error('Redis error', error);
        this.metrics.errors++;
        this.emit('error', error);
      });

      this.redis.on('close', () => {
        this.logger.warn('Redis connection closed');
        this.emit('disconnected');
      });

      this.redis.on('reconnecting', () => {
        this.logger.info('Redis reconnecting');
      });
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, ttl?: number, options?: DistributedCacheOptions): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        throw new Error('Cache not initialized');
      }

      const fullKey = this.getFullKey(key, options?.keyPrefix);
      const serializedValue = await this.serializeValue(value, options?.serializationFormat);
      const compressedValue = await this.compressValue(serializedValue, options?.enableCompression);
      const finalTTL = ttl || this.config.levels.l2.ttl;

      const result = await this.redis.setex(fullKey, finalTTL, compressedValue);
      
      if (result === 'OK') {
        this.metrics.sets++;
        this.updateMetrics();
        this.emit('set', { key, ttl: finalTTL });
      }

      this.metrics.avgResponseTime = (this.metrics.avgResponseTime + (Date.now() - startTime)) / 2;
      return result === 'OK';

    } catch (error) {
      this.logger.error(`Failed to set cache value for key: ${key}`, error);
      this.metrics.errors++;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get a value from cache
   */
  async get(key: string, options?: DistributedCacheOptions): Promise<any | null> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        throw new Error('Cache not initialized');
      }

      const fullKey = this.getFullKey(key, options?.keyPrefix);
      const compressedValue = await this.redis.get(fullKey);
      
      if (compressedValue === null) {
        this.metrics.misses++;
        this.updateMetrics();
        this.emit('miss', { key });
        return null;
      }

      const serializedValue = await this.decompressValue(compressedValue, options?.enableCompression);
      const value = await this.deserializeValue(serializedValue, options?.serializationFormat);
      
      this.metrics.hits++;
      this.metrics.avgResponseTime = (this.metrics.avgResponseTime + (Date.now() - startTime)) / 2;
      this.updateMetrics();
      this.emit('hit', { key });
      
      return value;

    } catch (error) {
      this.logger.error(`Failed to get cache value for key: ${key}`, error);
      this.metrics.errors++;
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string, options?: DistributedCacheOptions): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('Cache not initialized');
      }

      const fullKey = this.getFullKey(key, options?.keyPrefix);
      const result = await this.redis.del(fullKey);
      
      if (result > 0) {
        this.metrics.deletes++;
        this.updateMetrics();
        this.emit('delete', { key });
      }

      return result > 0;

    } catch (error) {
      this.logger.error(`Failed to delete cache value for key: ${key}`, error);
      this.metrics.errors++;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options?: DistributedCacheOptions): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('Cache not initialized');
      }

      const fullKey = this.getFullKey(key, options?.keyPrefix);
      const result = await this.redis.exists(fullKey);
      
      return result === 1;

    } catch (error) {
      this.logger.error(`Failed to check existence for key: ${key}`, error);
      this.metrics.errors++;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Set multiple values (mset)
   */
  async mset(keyValuePairs: Array<{key: string, value: any, ttl?: number}>, options?: DistributedCacheOptions): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('Cache not initialized');
      }

      const pipeline = this.redis.pipeline();
      
      for (const pair of keyValuePairs) {
        const fullKey = this.getFullKey(pair.key, options?.keyPrefix);
        const serializedValue = await this.serializeValue(pair.value, options?.serializationFormat);
        const compressedValue = await this.compressValue(serializedValue, options?.enableCompression);
        const finalTTL = pair.ttl || this.config.levels.l2.ttl;
        
        pipeline.setex(fullKey, finalTTL, compressedValue);
      }

      const results = await pipeline.exec();
      const success = results.every(([error]) => !error);
      
      if (success) {
        this.metrics.sets += keyValuePairs.length;
        this.updateMetrics();
        this.emit('mset', { count: keyValuePairs.length });
      }

      return success;

    } catch (error) {
      this.logger.error('Failed to set multiple cache values', error);
      this.metrics.errors++;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get multiple values (mget)
   */
  async mget(keys: string[], options?: DistributedCacheOptions): Promise<Array<{key: string, value: any | null}>> {
    try {
      if (!this.isInitialized) {
        throw new Error('Cache not initialized');
      }

      const fullKeys = keys.map(key => this.getFullKey(key, options?.keyPrefix));
      const compressedValues = await this.redis.mget(fullKeys);
      
      const results = await Promise.all(
        compressedValues.map(async (compressedValue, index) => {
          if (compressedValue === null) {
            this.metrics.misses++;
            return { key: keys[index], value: null };
          }

          const serializedValue = await this.decompressValue(compressedValue, options?.enableCompression);
          const value = await this.deserializeValue(serializedValue, options?.serializationFormat);
          
          this.metrics.hits++;
          return { key: keys[index], value };
        })
      );

      this.updateMetrics();
      this.emit('mget', { keys, results });
      
      return results;

    } catch (error) {
      this.logger.error('Failed to get multiple cache values', error);
      this.metrics.errors++;
      this.emit('error', error);
      return keys.map(key => ({ key, value: null }));
    }
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string, amount: number = 1, options?: DistributedCacheOptions): Promise<number | null> {
    try {
      if (!this.isInitialized) {
        throw new Error('Cache not initialized');
      }

      const fullKey = this.getFullKey(key, options?.keyPrefix);
      const result = await this.redis.incrby(fullKey, amount);
      
      this.emit('incr', { key, amount, result });
      
      return result;

    } catch (error) {
      this.logger.error(`Failed to increment key: ${key}`, error);
      this.metrics.errors++;
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error('Cache not initialized');
      }

      const info = await this.redis.info();
      const keyspace = await this.redis.info('keyspace');
      
      return {
        info: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        metrics: this.metrics,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error('Failed to get cache stats', error);
      this.metrics.errors++;
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  async clear(pattern?: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('Cache not initialized');
      }

      if (pattern) {
        const fullPattern = this.getFullKey(pattern);
        const keys = await this.redis.keys(fullPattern);
        
        if (keys.length > 0) {
          const result = await this.redis.del(...keys);
          this.metrics.deletes += keys.length;
          this.updateMetrics();
          this.emit('clear', { pattern, keysDeleted: keys.length });
          return result > 0;
        }
      } else {
        const result = await this.redis.flushdb();
        this.metrics.deletes += this.metrics.keyCount;
        this.updateMetrics();
        this.emit('clear', { pattern: '*', keysDeleted: this.metrics.keyCount });
        return result === 'OK';
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to clear cache', error);
      this.metrics.errors++;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get cache analytics
   */
  async getAnalytics(): Promise<CacheAnalytics> {
    try {
      const topKeys = await this.getTopKeys();
      const patterns = await this.getAccessPatterns();
      const errors = await this.getErrorPatterns();
      
      return {
        topKeys,
        patterns: {
          access: patterns,
          errors
        },
        performance: {
          avgHitRate: this.metrics.hitRate,
          avgResponseTime: this.metrics.avgResponseTime,
          peakMemoryUsage: this.metrics.memoryUsage,
          optimizationSuggestions: this.getOptimizationSuggestions()
        }
      };

    } catch (error) {
      this.logger.error('Failed to get cache analytics', error);
      throw error;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
        this.isInitialized = false;
        this.logger.info('Distributed cache disconnected');
        this.emit('disconnected');
      }
    } catch (error) {
      this.logger.error('Failed to disconnect distributed cache', error);
      throw error;
    }
  }

  // Private helper methods

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
      timestamp: new Date()
    };
  }

  private updateMetrics(): void {
    this.metrics.hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0;
    this.metrics.missRate = 1 - this.metrics.hitRate;
    this.metrics.timestamp = new Date();
  }

  private getFullKey(key: string, customPrefix?: string): string {
    const prefix = customPrefix || this.keyPrefix;
    return prefix ? `${prefix}${key}` : key;
  }

  private async serializeValue(value: any, format?: string): Promise<Buffer> {
    switch (format || this.config.performance.serializationFormat) {
      case 'msgpack':
        // Would use msgpack library
        return Buffer.from(JSON.stringify(value));
      case 'protobuf':
        // Would use protobuf library
        return Buffer.from(JSON.stringify(value));
      case 'avro':
        // Would use avro library
        return Buffer.from(JSON.stringify(value));
      default:
        return Buffer.from(JSON.stringify(value));
    }
  }

  private async deserializeValue(buffer: Buffer, format?: string): Promise<any> {
    const str = buffer.toString('utf8');
    switch (format || this.config.performance.serializationFormat) {
      case 'msgpack':
        // Would use msgpack library
        return JSON.parse(str);
      case 'protobuf':
        // Would use protobuf library
        return JSON.parse(str);
      case 'avro':
        // Would use avro library
        return JSON.parse(str);
      default:
        return JSON.parse(str);
    }
  }

  private async compressValue(buffer: Buffer, enabled?: boolean): Promise<Buffer> {
    if (!(enabled ?? this.config.levels.l1.compressionEnabled)) {
      return buffer;
    }

    if (buffer.length < this.config.levels.l1.compressionThreshold) {
      return buffer;
    }

    // Would use zlib or other compression library
    // For now, return original buffer
    return buffer;
  }

  private async decompressValue(buffer: Buffer, enabled?: boolean): Promise<Buffer> {
    if (!(enabled ?? this.config.levels.l1.compressionEnabled)) {
      return buffer;
    }

    // Would use zlib or other decompression library
    // For now, return original buffer
    return buffer;
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const parsed: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key.trim()] = value.trim();
      }
    }
    
    return parsed;
  }

  private async getTopKeys(): Promise<Array<{key: string, hits: number, size: number, ttl: number}>> {
    // This would require additional tracking logic
    // For now, return empty array
    return [];
  }

  private async getAccessPatterns(): Promise<Array<{pattern: string, frequency: number, avgResponseTime: number}>> {
    // This would require additional tracking logic
    // For now, return empty array
    return [];
  }

  private async getErrorPatterns(): Promise<Array<{type: string, count: number, lastOccurred: Date}>> {
    // This would require additional tracking logic
    // For now, return empty array
    return [];
  }

  private getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    
    if (this.metrics.hitRate < this.config.performance.hitRateThreshold) {
      suggestions.push('Consider increasing cache TTL or implementing cache warming');
    }
    
    if (this.metrics.avgResponseTime > this.config.performance.responseTimeThreshold) {
      suggestions.push('Consider optimizing serialization or enabling compression');
    }
    
    if (this.metrics.memoryUsage > 0.9) {
      suggestions.push('Consider increasing memory allocation or implementing eviction policies');
    }
    
    return suggestions;
  }
}
