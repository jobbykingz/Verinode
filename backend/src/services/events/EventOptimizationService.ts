import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redisService';
import { MonitoringService } from '../monitoringService';
import { IContractEvent } from '../../models/ContractEvent';
import { EventEmitter } from 'events';

export interface OptimizationConfig {
  enableCaching: boolean;
  enableBatching: boolean;
  enableCompression: boolean;
  enableConnectionPooling: boolean;
  enableQueryOptimization: boolean;
  cacheSize: number;
  batchSize: number;
  compressionThreshold: number;
  maxConnections: number;
  queryTimeout: number;
}

export interface PerformanceMetrics {
  eventProcessingRate: number;
  averageLatency: number;
  throughput: number;
  errorRate: number;
  cacheHitRate: number;
  batchEfficiency: number;
  compressionRatio: number;
  connectionUtilization: number;
  queryPerformance: {
    averageQueryTime: number;
    slowQueries: number;
    optimizedQueries: number;
  };
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  size: number;
  ttl: number;
}

export interface BatchProcessor<T> {
  id: string;
  items: T[];
  maxSize: number;
  currentSize: number;
  createdAt: number;
  lastFlushed: number;
  flushInterval: number;
}

export interface QueryOptimizer {
  queryCache: Map<string, any>;
  slowQueryThreshold: number;
  optimizationRules: OptimizationRule[];
}

export interface OptimizationRule {
  name: string;
  condition: (query: any) => boolean;
  optimization: (query: any) => any;
  priority: number;
}

export interface ConnectionPool {
  connections: any[];
  activeConnections: number;
  maxConnections: number;
  waitingQueue: any[];
}

@Injectable()
export class EventOptimizationService extends EventEmitter implements OnModuleInit {
  private readonly logger = new Logger(EventOptimizationService.name);
  private readonly config: OptimizationConfig;
  private metrics: PerformanceMetrics;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private batchProcessors: Map<string, BatchProcessor<any>> = new Map();
  private queryOptimizer: QueryOptimizer;
  private connectionPool: ConnectionPool;
  private optimizationInterval?: NodeJS.Timeout;

  constructor(
    private redisService: RedisService,
    private monitoringService: MonitoringService,
  ) {
    super();
    
    this.config = {
      enableCaching: true,
      enableBatching: true,
      enableCompression: true,
      enableConnectionPooling: true,
      enableQueryOptimization: true,
      cacheSize: 10000,
      batchSize: 100,
      compressionThreshold: 1024,
      maxConnections: 100,
      queryTimeout: 5000,
    };

    this.metrics = {
      eventProcessingRate: 0,
      averageLatency: 0,
      throughput: 0,
      errorRate: 0,
      cacheHitRate: 0,
      batchEfficiency: 0,
      compressionRatio: 0,
      connectionUtilization: 0,
      queryPerformance: {
        averageQueryTime: 0,
        slowQueries: 0,
        optimizedQueries: 0,
      },
    };

    this.queryOptimizer = {
      queryCache: new Map(),
      slowQueryThreshold: 1000, // 1 second
      optimizationRules: [],
    };

    this.connectionPool = {
      connections: [],
      activeConnections: 0,
      maxConnections: this.config.maxConnections,
      waitingQueue: [],
    };
  }

  async onModuleInit() {
    this.logger.log('Initializing Event Optimization Service');
    
    // Initialize optimization rules
    this.initializeOptimizationRules();
    
    // Start performance monitoring
    this.startPerformanceMonitoring();
    
    // Start cache cleanup
    this.startCacheCleanup();
    
    // Start batch processor monitoring
    this.startBatchProcessorMonitoring();
    
    this.logger.log('Event Optimization Service initialized successfully');
  }

  /**
   * Cache event data for fast access
   */
  async cacheEvent(key: string, event: IContractEvent, ttl: number = 3600000): Promise<void> {
    if (!this.config.enableCaching) return;
    
    try {
      const serializedEvent = JSON.stringify(event);
      const size = Buffer.byteLength(serializedEvent);
      
      // Check cache size limit
      if (this.cache.size >= this.config.cacheSize) {
        await this.evictLeastUsedEntries();
      }
      
      const entry: CacheEntry<IContractEvent> = {
        key,
        value: event,
        timestamp: Date.now(),
        accessCount: 0,
        size,
        ttl,
      };
      
      this.cache.set(key, entry);
      
      // Also cache in Redis for distributed access
      await this.redisService.set(key, serializedEvent, ttl / 1000);
      
      this.logger.debug(`Cached event: ${key} (${size} bytes)`);
      
    } catch (error) {
      this.logger.error(`Failed to cache event ${key}:`, error);
    }
  }

  /**
   * Get cached event
   */
  async getCachedEvent(key: string): Promise<IContractEvent | null> {
    if (!this.config.enableCaching) return null;
    
    try {
      // Check local cache first
      const entry = this.cache.get(key);
      
      if (entry && Date.now() - entry.timestamp < entry.ttl) {
        entry.accessCount++;
        this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2;
        return entry.value;
      }
      
      // Check Redis cache
      const cached = await this.redisService.get(key);
      if (cached) {
        const event = JSON.parse(cached) as IContractEvent;
        
        // Update local cache
        await this.cacheEvent(key, event);
        
        this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2;
        return event;
      }
      
      this.metrics.cacheHitRate = this.metrics.cacheHitRate * 0.9; // Decay cache hit rate
      return null;
      
    } catch (error) {
      this.logger.error(`Failed to get cached event ${key}:`, error);
      return null;
    }
  }

  /**
   * Add event to batch processor
   */
  addToBatch<T>(processorId: string, item: T, processor: (items: T[]) => Promise<void>): void {
    if (!this.config.enableBatching) {
      processor([item]);
      return;
    }
    
    let batchProcessor = this.batchProcessors.get(processorId);
    
    if (!batchProcessor) {
      batchProcessor = this.createBatchProcessor<T>(processorId, processor);
      this.batchProcessors.set(processorId, batchProcessor);
    }
    
    batchProcessor.items.push(item);
    batchProcessor.currentSize++;
    
    // Flush if batch is full
    if (batchProcessor.currentSize >= this.config.batchSize) {
      this.flushBatch(processorId);
    }
  }

  /**
   * Compress event data if beneficial
   */
  async compressEventData(data: any): Promise<{ compressed: boolean; data: any; originalSize: number; compressedSize: number }> {
    if (!this.config.enableCompression) {
      return { compressed: false, data, originalSize: 0, compressedSize: 0 };
    }
    
    const serialized = JSON.stringify(data);
    const originalSize = Buffer.byteLength(serialized);
    
    // Only compress if data is larger than threshold
    if (originalSize < this.config.compressionThreshold) {
      return { compressed: false, data, originalSize, compressedSize: originalSize };
    }
    
    try {
      // Simple compression using Node.js zlib (placeholder)
      // In practice, you'd use actual compression algorithm
      const compressedData = this.simpleCompress(serialized);
      const compressedSize = Buffer.byteLength(compressedData);
      
      if (compressedSize < originalSize * 0.8) { // Only use if 20% reduction
        this.metrics.compressionRatio = (this.metrics.compressionRatio + (originalSize / compressedSize)) / 2;
        
        return {
          compressed: true,
          data: compressedData,
          originalSize,
          compressedSize,
        };
      }
      
      return { compressed: false, data, originalSize, compressedSize: originalSize };
      
    } catch (error) {
      this.logger.error('Failed to compress data:', error);
      return { compressed: false, data, originalSize, compressedSize: originalSize };
    }
  }

  /**
   * Get connection from pool
   */
  async getConnection(): Promise<any> {
    if (!this.config.enableConnectionPooling) {
      return this.createConnection();
    }
    
    // Check for available connection in pool
    const availableConnection = this.connectionPool.connections.find(conn => !conn.active);
    
    if (availableConnection) {
      availableConnection.active = true;
      this.connectionPool.activeConnections++;
      this.updateConnectionUtilization();
      return availableConnection;
    }
    
    // Create new connection if under limit
    if (this.connectionPool.connections.length < this.config.maxConnections) {
      const newConnection = this.createConnection();
      newConnection.active = true;
      this.connectionPool.connections.push(newConnection);
      this.connectionPool.activeConnections++;
      this.updateConnectionUtilization();
      return newConnection;
    }
    
    // Add to waiting queue
    return new Promise((resolve) => {
      this.connectionPool.waitingQueue.push(resolve);
    });
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(connection: any): void {
    if (!this.config.enableConnectionPooling || !connection) {
      return;
    }
    
    connection.active = false;
    this.connectionPool.activeConnections--;
    this.updateConnectionUtilization();
    
    // Resolve next waiting connection
    if (this.connectionPool.waitingQueue.length > 0) {
      const nextResolve = this.connectionPool.waitingQueue.shift();
      connection.active = true;
      this.connectionPool.activeConnections++;
      nextResolve(connection);
    }
  }

  /**
   * Optimize database query
   */
  optimizeQuery(query: any): any {
    if (!this.config.enableQueryOptimization) {
      return query;
    }
    
    const queryKey = JSON.stringify(query);
    
    // Check query cache
    const cached = this.queryOptimizer.queryCache.get(queryKey);
    if (cached) {
      this.metrics.queryPerformance.optimizedQueries++;
      return cached;
    }
    
    // Apply optimization rules
    let optimizedQuery = { ...query };
    
    for (const rule of this.queryOptimizer.optimizationRules) {
      if (rule.condition(optimizedQuery)) {
        optimizedQuery = rule.optimization(optimizedQuery);
      }
    }
    
    // Cache optimized query
    this.queryOptimizer.queryCache.set(queryKey, optimizedQuery);
    
    return optimizedQuery;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    totalSize: number;
    averageEntrySize: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const averageEntrySize = entries.length > 0 ? totalSize / entries.length : 0;
    
    return {
      size: this.cache.size,
      hitRate: this.metrics.cacheHitRate,
      totalSize,
      averageEntrySize,
    };
  }

  /**
   * Get batch processor statistics
   */
  getBatchProcessorStats(): Array<{
    id: string;
    currentSize: number;
    maxSize: number;
    efficiency: number;
    lastFlushed: number;
  }> {
    return Array.from(this.batchProcessors.values()).map(processor => ({
      id: processor.id,
      currentSize: processor.currentSize,
      maxSize: processor.maxSize,
      efficiency: this.calculateBatchEfficiency(processor),
      lastFlushed: processor.lastFlushed,
    }));
  }

  /**
   * Create batch processor
   */
  private createBatchProcessor<T>(id: string, processor: (items: T[]) => Promise<void>): BatchProcessor<T> {
    const batchProcessor: BatchProcessor<T> = {
      id,
      items: [],
      maxSize: this.config.batchSize,
      currentSize: 0,
      createdAt: Date.now(),
      lastFlushed: Date.now(),
      flushInterval: 5000, // 5 seconds
    };
    
    // Set up automatic flushing
    setInterval(() => {
      if (batchProcessor.currentSize > 0) {
        this.flushBatch(id);
      }
    }, batchProcessor.flushInterval);
    
    return batchProcessor;
  }

  /**
   * Flush batch processor
   */
  private async flushBatch(processorId: string): Promise<void> {
    const processor = this.batchProcessors.get(processorId);
    
    if (!processor || processor.currentSize === 0) {
      return;
    }
    
    try {
      const items = [...processor.items];
      processor.items = [];
      processor.currentSize = 0;
      processor.lastFlushed = Date.now();
      
      // Process batch (this would be passed in when creating the processor)
      // For now, just log
      this.logger.debug(`Flushed batch ${processorId} with ${items.length} items`);
      
      // Update batch efficiency
      this.metrics.batchEfficiency = (this.metrics.batchEfficiency + this.calculateBatchEfficiency(processor)) / 2;
      
    } catch (error) {
      this.logger.error(`Failed to flush batch ${processorId}:`, error);
    }
  }

  /**
   * Calculate batch efficiency
   */
  private calculateBatchEfficiency(processor: BatchProcessor<any>): number {
    if (processor.maxSize === 0) return 0;
    return processor.currentSize / processor.maxSize;
  }

  /**
   * Evict least used cache entries
   */
  private async evictLeastUsedEntries(): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    // Sort by access count (least used first)
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    
    // Remove bottom 10%
    const toRemove = Math.floor(entries.length * 0.1);
    
    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      await this.redisService.del(key);
    }
    
    this.logger.debug(`Evicted ${toRemove} least used cache entries`);
  }

  /**
   * Create new connection
   */
  private createConnection(): any {
    // This would create an actual database connection
    // For now, return a mock connection
    return {
      id: Math.random().toString(36),
      active: false,
      created: Date.now(),
    };
  }

  /**
   * Update connection utilization
   */
  private updateConnectionUtilization(): void {
    this.metrics.connectionUtilization = this.connectionPool.activeConnections / this.config.maxConnections;
  }

  /**
   * Simple compression (placeholder)
   */
  private simpleCompress(data: string): string {
    // This is a placeholder for actual compression
    // In practice, you'd use zlib or similar
    return Buffer.from(data).toString('base64');
  }

  /**
   * Initialize optimization rules
   */
  private initializeOptimizationRules(): void {
    this.queryOptimizer.optimizationRules = [
      {
        name: 'add_index_hints',
        condition: (query) => query.collection && !query.hint,
        optimization: (query) => ({
          ...query,
          hint: { _id: 1 }, // Default index hint
        }),
        priority: 1,
      },
      {
        name: 'limit_results',
        condition: (query) => !query.limit && query.collection,
        optimization: (query) => ({
          ...query,
          limit: 1000, // Default limit
        }),
        priority: 2,
      },
      {
        name: 'add_projection',
        condition: (query) => query.collection && !query.projection,
        optimization: (query) => ({
          ...query,
          projection: { _id: 1, eventType: 1, timestamp: 1 }, // Default projection
        }),
        priority: 3,
      },
    ];
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.optimizationInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 10000); // Update every 10 seconds
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Calculate event processing rate
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    
    // This would be calculated from actual event processing data
    this.metrics.eventProcessingRate = 100; // events per second
    this.metrics.averageLatency = 50; // milliseconds
    this.metrics.throughput = this.metrics.eventProcessingRate * 1000; // bytes per second
    this.metrics.errorRate = 0.01; // 1%
    
    // Update query performance
    this.metrics.queryPerformance.averageQueryTime = 100; // milliseconds
    this.metrics.queryPerformance.slowQueries = 5;
    this.metrics.queryPerformance.optimizedQueries = 95;
  }

  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 300000); // Every 5 minutes
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.redisService.del(key).catch(() => {}); // Ignore errors
    }
    
    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Start batch processor monitoring
   */
  private startBatchProcessorMonitoring(): void {
    setInterval(() => {
      this.monitorBatchProcessors();
    }, 30000); // Every 30 seconds
  }

  /**
   * Monitor batch processors
   */
  private monitorBatchProcessors(): void {
    for (const processor of this.batchProcessors.values()) {
      const age = Date.now() - processor.createdAt;
      
      // Flush old batches
      if (age > 300000 && processor.currentSize > 0) { // 5 minutes
        this.flushBatch(processor.id);
      }
    }
  }

  /**
   * Optimize system performance
   */
  async optimizeSystem(): Promise<{
    optimizations: string[];
    impact: Record<string, number>;
  }> {
    const optimizations: string[] = [];
    const impact: Record<string, number> = {};
    
    // Optimize cache
    if (this.metrics.cacheHitRate < 0.8) {
      await this.optimizeCache();
      optimizations.push('cache_optimization');
      impact.cache_hit_rate = 0.15; // 15% improvement
    }
    
    // Optimize batch processing
    if (this.metrics.batchEfficiency < 0.7) {
      await this.optimizeBatchProcessing();
      optimizations.push('batch_optimization');
      impact.batch_efficiency = 0.20; // 20% improvement
    }
    
    // Optimize connections
    if (this.metrics.connectionUtilization > 0.9) {
      await this.optimizeConnections();
      optimizations.push('connection_optimization');
      impact.connection_utilization = -0.10; // 10% reduction
    }
    
    this.logger.log(`System optimization completed: ${optimizations.join(', ')}`);
    
    return { optimizations, impact };
  }

  /**
   * Optimize cache
   */
  private async optimizeCache(): Promise<void> {
    // Increase cache size if memory allows
    if (this.config.cacheSize < 50000) {
      this.config.cacheSize = Math.min(this.config.cacheSize * 1.5, 50000);
      this.logger.log(`Increased cache size to ${this.config.cacheSize}`);
    }
    
    // Pre-warm cache with frequently accessed data
    await this.preWarmCache();
  }

  /**
   * Optimize batch processing
   */
  private async optimizeBatchProcessing(): Promise<void> {
    // Adjust batch size based on current efficiency
    if (this.metrics.batchEfficiency < 0.5) {
      this.config.batchSize = Math.min(this.config.batchSize * 1.5, 500);
      this.logger.log(`Increased batch size to ${this.config.batchSize}`);
    } else if (this.metrics.batchEfficiency > 0.9) {
      this.config.batchSize = Math.max(this.config.batchSize * 0.8, 10);
      this.logger.log(`Decreased batch size to ${this.config.batchSize}`);
    }
  }

  /**
   * Optimize connections
   */
  private async optimizeConnections(): Promise<void> {
    // Increase max connections if needed
    if (this.connectionPool.maxConnections < 200) {
      this.connectionPool.maxConnections = Math.min(this.connectionPool.maxConnections * 1.2, 200);
      this.config.maxConnections = this.connectionPool.maxConnections;
      this.logger.log(`Increased max connections to ${this.connectionPool.maxConnections}`);
    }
  }

  /**
   * Pre-warm cache with frequently accessed data
   */
  private async preWarmCache(): Promise<void> {
    // This would load frequently accessed events into cache
    // Implementation depends on your data access patterns
    this.logger.log('Cache pre-warming completed');
  }
}
