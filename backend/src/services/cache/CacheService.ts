import { EventEmitter } from 'events';
import { DistributedCache } from '../cache/DistributedCache';
import { CacheWarmer } from '../cache/CacheWarmer';
import { CacheInvalidation } from '../cache/CacheInvalidation';
import { CacheMetrics } from '../cache/CacheMetrics';
import { defaultCacheConfig, CacheConfig } from '../config/cache';
import { WinstonLogger } from '../utils/logger';

export interface CacheServiceOptions {
  config?: Partial<CacheConfig>;
  enableWarming?: boolean;
  enableInvalidation?: boolean;
  enableMetrics?: boolean;
}

export interface CacheServiceStats {
  uptime: number;
  totalRequests: number;
  hitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  activeConnections: number;
  lastOptimization: Date;
}

export class CacheService extends EventEmitter {
  private distributedCache: DistributedCache;
  private cacheWarmer: CacheWarmer;
  private cacheInvalidation: CacheInvalidation;
  private cacheMetrics: CacheMetrics;
  private config: CacheConfig;
  private logger: WinstonLogger;
  private isInitialized: boolean = false;
  private startTime: Date = new Date();

  constructor(options: CacheServiceOptions = {}) {
    super();
    this.config = { ...defaultCacheConfig, ...options.config };
    this.logger = new WinstonLogger();
    
    this.initializeServices();
  }

  /**
   * Initialize all cache services
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize distributed cache
      this.distributedCache = new DistributedCache(this.config);
      
      // Initialize cache warmer
      this.cacheWarmer = new CacheWarmer(this.distributedCache, this.config);
      
      // Initialize cache invalidation
      this.cacheInvalidation = new CacheInvalidation(this.distributedCache, this.config);
      
      // Initialize cache metrics
      this.cacheMetrics = new CacheMetrics(this.config);
      
      // Setup event handlers
      this.setupEventHandlers();
      
      this.isInitialized = true;
      this.logger.info('Cache service initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize cache service', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start the cache service
   */
  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initializeServices();
      }

      this.logger.info('Starting cache service');
      
      // Start cache warming
      if (this.config.warming.enabled) {
        await this.cacheWarmer.start();
      }
      
      // Start metrics collection
      if (this.config.performance.metricsEnabled) {
        // Metrics collection starts automatically in CacheMetrics constructor
      }
      
      this.emit('started');
      
    } catch (error) {
      this.logger.error('Failed to start cache service', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the cache service
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping cache service');
      
      // Stop cache warming
      if (this.cacheWarmer) {
        await this.cacheWarmer.stop();
      }
      
      // Stop metrics collection
      if (this.cacheMetrics) {
        this.cacheMetrics.stop();
      }
      
      // Disconnect distributed cache
      if (this.distributedCache) {
        await this.distributedCache.disconnect();
      }
      
      this.isInitialized = false;
      this.emit('stopped');
      
    } catch (error) {
      this.logger.error('Failed to stop cache service', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const value = await this.distributedCache.get(key);
      
      if (value !== null) {
        this.cacheMetrics.recordHit(key, Date.now() - startTime);
      } else {
        this.cacheMetrics.recordMiss(key);
      }
      
      return value;
      
    } catch (error) {
      this.cacheMetrics.recordError(error, 'get');
      this.logger.error(`Cache get error for key: ${key}`, error);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const success = await this.distributedCache.set(key, value, ttl);
      
      if (success) {
        this.cacheMetrics.recordSet(key, this.estimateSize(value));
        this.cacheMetrics.recordMemoryUsage(this.getMemoryUsage());
      }
      
      const responseTime = Date.now() - startTime;
      this.cacheMetrics.recordHit(key, responseTime); // Record as hit for set operation
      
      return success;
      
    } catch (error) {
      this.cacheMetrics.recordError(error, 'set');
      this.logger.error(`Cache set error for key: ${key}`, error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      const success = await this.distributedCache.del(key);
      
      if (success) {
        this.cacheMetrics.recordDelete(key);
      }
      
      return success;
      
    } catch (error) {
      this.cacheMetrics.recordError(error, 'delete');
      this.logger.error(`Cache delete error for key: ${key}`, error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      return await this.distributedCache.exists(key);
    } catch (error) {
      this.cacheMetrics.recordError(error, 'exists');
      this.logger.error(`Cache exists error for key: ${key}`, error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get multiple values
   */
  async mget<T = any>(keys: string[]): Promise<Array<{key: string, value: T | null}>> {
    const startTime = Date.now();
    
    try {
      const results = await this.distributedCache.mget<T>(keys);
      
      // Record metrics for each key
      for (const result of results) {
        if (result.value !== null) {
          this.cacheMetrics.recordHit(result.key, Date.now() - startTime);
        } else {
          this.cacheMetrics.recordMiss(result.key);
        }
      }
      
      return results;
      
    } catch (error) {
      this.cacheMetrics.recordError(error, 'mget');
      this.logger.error('Cache mget error', error);
      this.emit('error', error);
      return keys.map(key => ({ key, value: null }));
    }
  }

  /**
   * Set multiple values
   */
  async mset<T = any>(keyValuePairs: Array<{key: string, value: T, ttl?: number}>): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const success = await this.distributedCache.mset(keyValuePairs);
      
      if (success) {
        for (const pair of keyValuePairs) {
          this.cacheMetrics.recordSet(pair.key, this.estimateSize(pair.value));
        }
        this.cacheMetrics.recordMemoryUsage(this.getMemoryUsage());
      }
      
      return success;
      
    } catch (error) {
      this.cacheMetrics.recordError(error, 'mset');
      this.logger.error('Cache mset error', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Increment numeric value
   */
  async incr(key: string, amount: number = 1): Promise<number | null> {
    try {
      const result = await this.distributedCache.incr(key, amount);
      
      // Record as hit since increment is a read-modify operation
      this.cacheMetrics.recordHit(key, 0);
      
      return result;
      
    } catch (error) {
      this.cacheMetrics.recordError(error, 'incr');
      this.logger.error(`Cache incr error for key: ${key}`, error);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  async clear(pattern?: string): Promise<boolean> {
    try {
      const success = await this.distributedCache.clear(pattern);
      
      if (success) {
        this.logger.info(`Cache cleared with pattern: ${pattern || '*'}`);
        this.emit('cleared', { pattern });
      }
      
      return success;
      
    } catch (error) {
      this.cacheMetrics.recordError(error, 'clear');
      this.logger.error('Cache clear error', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheServiceStats> {
    try {
      const redisStats = await this.distributedCache.getStats();
      const metrics = this.cacheMetrics.getCurrentMetrics();
      const uptime = Date.now() - this.startTime.getTime();
      
      return {
        uptime,
        totalRequests: metrics.hits + metrics.misses,
        hitRate: metrics.hitRate,
        avgResponseTime: metrics.avgResponseTime,
        memoryUsage: metrics.memoryUsage,
        activeConnections: redisStats.info?.connected_clients || 0,
        lastOptimization: new Date()
      };
      
    } catch (error) {
      this.cacheMetrics.recordError(error, 'getStats');
      this.logger.error('Failed to get cache stats', error);
      this.emit('error', error);
      
      return {
        uptime: 0,
        totalRequests: 0,
        hitRate: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
        activeConnections: 0,
        lastOptimization: new Date()
      };
    }
  }

  /**
   * Get performance analytics
   */
  async getAnalytics(): Promise<any> {
    try {
      return this.cacheMetrics.getAnalytics();
    } catch (error) {
      this.cacheMetrics.recordError(error, 'getAnalytics');
      this.logger.error('Failed to get analytics', error);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Get performance report
   */
  async getPerformanceReport(periodHours: number = 24): Promise<any> {
    try {
      return this.cacheMetrics.getPerformanceReport(periodHours);
    } catch (error) {
      this.cacheMetrics.recordError(error, 'getPerformanceReport');
      this.logger.error('Failed to get performance report', error);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Warm cache with specific data
   */
  async warmCache(dataSources: string[]): Promise<void> {
    try {
      if (!this.config.warming.enabled) {
        this.logger.warn('Cache warming is disabled');
        return;
      }

      const strategies = this.config.warming.strategies.filter(strategy => 
        dataSources.includes(strategy.config.dataSources[0])
      );

      if (strategies.length > 0) {
        const results = await this.cacheWarmer.warmMultiple(strategies);
        this.logger.info(`Cache warming completed`, { 
          dataSources, 
          results: results.map(r => ({
            strategy: r.jobId,
            keysWarmed: r.keysWarmed,
            duration: r.duration
          }))
        });
        this.emit('warmed', { dataSources, results });
      }
      
    } catch (error) {
      this.logger.error('Failed to warm cache', error);
      this.emit('error', error);
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(pattern: string, cascade: boolean = false): Promise<void> {
    try {
      if (!this.config.invalidation.enabled) {
        this.logger.warn('Cache invalidation is disabled');
        return;
      }

      const result = await this.cacheInvalidation.invalidateByPattern(pattern, { cascade });
      
      this.logger.info('Cache invalidation completed', { pattern, cascade, result });
      this.emit('invalidated', { pattern, cascade, result });
      
    } catch (error) {
      this.logger.error('Failed to invalidate cache', error);
      this.emit('error', error);
    }
  }

  /**
   * Add invalidation rule
   */
  addInvalidationRule(rule: any): string {
    try {
      const ruleId = this.cacheInvalidation.addRule(rule);
      this.logger.info(`Added invalidation rule: ${rule.name}`);
      this.emit('ruleAdded', { ruleId, rule });
      return ruleId;
    } catch (error) {
      this.logger.error('Failed to add invalidation rule', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Export cache data
   */
  async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const analytics = await this.getAnalytics();
      const stats = await this.getStats();
      
      const data = {
        timestamp: new Date().toISOString(),
        stats,
        analytics,
        config: this.config
      };

      switch (format) {
        case 'json':
          return JSON.stringify(data, null, 2);
        case 'csv':
          return this.convertToCSV(data);
        default:
          return JSON.stringify(data, null, 2);
      }
      
    } catch (error) {
      this.logger.error('Failed to export cache data', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{ name: string; status: 'pass' | 'fail'; message?: string }>;
    timestamp: Date;
  }> {
    const checks = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Check distributed cache connection
      const stats = await this.getStats();
      const cacheCheck = {
        name: 'distributed_cache',
        status: stats.activeConnections > 0 ? 'pass' : 'fail',
        message: stats.activeConnections > 0 ? 'Connected' : 'No active connections'
      };
      checks.push(cacheCheck);

      // Check hit rate
      const hitRateCheck = {
        name: 'hit_rate',
        status: stats.hitRate >= this.config.performance.hitRateThreshold ? 'pass' : 'fail',
        message: `Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`
      };
      checks.push(hitRateCheck);

      // Check response time
      const responseTimeCheck = {
        name: 'response_time',
        status: stats.avgResponseTime <= this.config.performance.responseTimeThreshold ? 'pass' : 'fail',
        message: `Avg response time: ${stats.avgResponseTime.toFixed(2)}ms`
      };
      checks.push(responseTimeCheck);

      // Check memory usage
      const memoryCheck = {
        name: 'memory_usage',
        status: stats.memoryUsage <= 0.9 ? 'pass' : 'fail', // 90% threshold
        message: `Memory usage: ${(stats.memoryUsage * 100).toFixed(2)}%`
      };
      checks.push(memoryCheck);

      // Determine overall status
      const failedChecks = checks.filter(check => check.status === 'fail');
      if (failedChecks.length >= 2) {
        overallStatus = 'unhealthy';
      } else if (failedChecks.length >= 1) {
        overallStatus = 'degraded';
      }

    } catch (error) {
      this.logger.error('Health check failed', error);
      overallStatus = 'unhealthy';
      checks.push({
        name: 'health_check',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date()
    };
  }

  // Private helper methods

  private setupEventHandlers(): void {
    // Forward events from sub-services
    this.distributedCache.on('connected', () => this.emit('connected'));
    this.distributedCache.on('disconnected', () => this.emit('disconnected'));
    this.distributedCache.on('error', (error) => this.emit('error', error));
    
    this.cacheWarmer.on('started', () => this.emit('warmingStarted'));
    this.cacheWarmer.on('stopped', () => this.emit('warmingStopped'));
    this.cacheWarmer.on('jobCompleted', (job) => this.emit('warmingJobCompleted', job));
    this.cacheWarmer.on('error', (error) => this.emit('error', error));
    
    this.cacheInvalidation.on('invalidationCompleted', (result) => this.emit('invalidationCompleted', result));
    this.cacheInvalidation.on('ruleAdded', (rule) => this.emit('invalidationRuleAdded', rule));
    this.cacheInvalidation.on('error', (error) => this.emit('error', error));
    
    this.cacheMetrics.on('alert', (alert) => this.emit('alert', alert));
    this.cacheMetrics.on('optimizationSuggestions', (suggestions) => this.emit('optimizationSuggestions', suggestions));
    this.cacheMetrics.on('error', (error) => this.emit('error', error));
  }

  private estimateSize(value: any): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(value).length * 2; // Approximation
  }

  private getMemoryUsage(): number {
    // This would get actual memory usage from Redis
    // For now, return a placeholder
    return 0.5; // 50% usage
  }

  private convertToCSV(data: any): string {
    const headers = Object.keys(data);
    const values = headers.map(header => JSON.stringify(data[header]));
    
    return [headers.join(','), values.join(',')].join('\n');
  }
}
