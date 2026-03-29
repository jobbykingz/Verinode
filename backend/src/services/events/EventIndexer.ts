import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redisService';
import { MonitoringService } from '../monitoringService';
import { IContractEvent } from '../../models/ContractEvent';

export interface IndexConfig {
  enableTimeIndex: boolean;
  enableTypeIndex: boolean;
  enableAddressIndex: boolean;
  enableTopicIndex: boolean;
  enableCompositeIndex: boolean;
  indexBatchSize: number;
  indexUpdateInterval: number;
  maxIndexEntries: number;
}

export interface IndexEntry {
  key: string;
  value: string;
  timestamp: number;
  type: IndexType;
}

export enum IndexType {
  Time = 'time',
  Type = 'type',
  Address = 'address',
  Topic = 'topic',
  Composite = 'composite',
}

export interface IndexStats {
  totalEntries: number;
  entriesByType: Record<IndexType, number>;
  lastUpdated: Date;
  indexingTime: number;
  queryPerformance: {
    averageQueryTime: number;
    queriesPerSecond: number;
    cacheHitRate: number;
  };
}

export interface QueryResult {
  events: IContractEvent[];
  totalCount: number;
  hasMore: boolean;
  nextOffset?: number;
  queryTime: number;
}

export interface IndexQuery {
  eventTypes?: string[];
  addresses?: string[];
  topics?: string[];
  fromTime?: number;
  toTime?: number;
  fromBlock?: number;
  toBlock?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class EventIndexer implements OnModuleInit {
  private readonly logger = new Logger(EventIndexer.name);
  private readonly config: IndexConfig;
  private stats: IndexStats;
  private indexCache: Map<string, IndexEntry[]> = new Map();
  private queryCache: Map<string, QueryResult> = new Map();
  private indexingInProgress = false;

  constructor(
    private redisService: RedisService,
    private monitoringService: MonitoringService,
  ) {
    this.config = {
      enableTimeIndex: true,
      enableTypeIndex: true,
      enableAddressIndex: true,
      enableTopicIndex: true,
      enableCompositeIndex: true,
      indexBatchSize: 1000,
      indexUpdateInterval: 60000, // 1 minute
      maxIndexEntries: 100000,
    };

    this.stats = {
      totalEntries: 0,
      entriesByType: {
        [IndexType.Time]: 0,
        [IndexType.Type]: 0,
        [IndexType.Address]: 0,
        [IndexType.Topic]: 0,
        [IndexType.Composite]: 0,
      },
      lastUpdated: new Date(),
      indexingTime: 0,
      queryPerformance: {
        averageQueryTime: 0,
        queriesPerSecond: 0,
        cacheHitRate: 0,
      },
    };
  }

  async onModuleInit() {
    this.logger.log('Initializing Event Indexer');
    
    // Load existing indexes from cache
    await this.loadIndexesFromCache();
    
    // Start periodic index updates
    this.startIndexUpdates();
    
    // Start cache cleanup
    this.startCacheCleanup();
    
    this.logger.log('Event Indexer initialized successfully');
  }

  /**
   * Index a single event
   */
  async indexEvent(event: IContractEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      const indexEntries = this.createIndexEntries(event);
      
      // Add entries to indexes
      for (const entry of indexEntries) {
        await this.addToIndex(entry);
      }
      
      // Update statistics
      this.updateStats(indexEntries.length);
      
      this.logger.debug(`Indexed event: ${event.eventId}`);
      
    } catch (error) {
      this.logger.error(`Failed to index event ${event.eventId}:`, error);
      await this.monitoringService.recordMetric('event.indexing.error', 1, {
        eventId: event.eventId,
        error: error.message,
      });
      throw error;
    } finally {
      const indexingTime = Date.now() - startTime;
      await this.monitoringService.recordMetric('event.indexing.time', indexingTime);
    }
  }

  /**
   * Index multiple events in batch
   */
  async indexEvents(events: IContractEvent[]): Promise<void> {
    if (events.length === 0) return;
    
    const startTime = Date.now();
    
    try {
      const allIndexEntries: IndexEntry[] = [];
      
      for (const event of events) {
        const entries = this.createIndexEntries(event);
        allIndexEntries.push(...entries);
      }
      
      // Batch add to indexes
      await this.batchAddToIndex(allIndexEntries);
      
      // Update statistics
      this.updateStats(allIndexEntries.length);
      
      this.logger.log(`Indexed ${events.length} events in batch`);
      
    } catch (error) {
      this.logger.error('Batch indexing failed:', error);
      throw error;
    } finally {
      const indexingTime = Date.now() - startTime;
      await this.monitoringService.recordMetric('event.indexing.batch.time', indexingTime);
    }
  }

  /**
   * Query events using indexes
   */
  async queryEvents(query: IndexQuery): Promise<QueryResult> {
    const startTime = Date.now();
    const cacheKey = this.generateQueryCacheKey(query);
    
    try {
      // Check cache first
      const cached = this.queryCache.get(cacheKey);
      if (cached) {
        this.stats.queryPerformance.cacheHitRate = 
          (this.stats.queryPerformance.cacheHitRate + 1) / 2;
        return { ...cached, queryTime: Date.now() - startTime };
      }
      
      // Execute query using indexes
      const events = await this.executeQuery(query);
      const totalCount = events.length;
      
      // Apply pagination
      const limit = query.limit || 100;
      const offset = query.offset || 0;
      const paginatedEvents = events.slice(offset, offset + limit);
      const hasMore = offset + limit < totalCount;
      const nextOffset = hasMore ? offset + limit : undefined;
      
      const result: QueryResult = {
        events: paginatedEvents,
        totalCount,
        hasMore,
        nextOffset,
        queryTime: Date.now() - startTime,
      };
      
      // Cache result
      this.queryCache.set(cacheKey, result);
      
      // Update query performance metrics
      this.updateQueryPerformance(result.queryTime);
      
      return result;
      
    } catch (error) {
      this.logger.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Remove event from indexes
   */
  async removeFromIndex(event: IContractEvent): Promise<void> {
    try {
      const indexEntries = this.createIndexEntries(event);
      
      for (const entry of indexEntries) {
        await this.removeFromIndexEntry(entry);
      }
      
      this.logger.debug(`Removed event from index: ${event.eventId}`);
      
    } catch (error) {
      this.logger.error(`Failed to remove event from index ${event.eventId}:`, error);
      throw error;
    }
  }

  /**
   * Rebuild all indexes
   */
  async rebuildIndexes(events: IContractEvent[]): Promise<void> {
    this.logger.log('Starting index rebuild');
    
    try {
      // Clear existing indexes
      await this.clearAllIndexes();
      
      // Re-index all events
      await this.indexEvents(events);
      
      this.logger.log('Index rebuild completed');
      
    } catch (error) {
      this.logger.error('Index rebuild failed:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    return { ...this.stats };
  }

  /**
   * Create index entries for an event
   */
  private createIndexEntries(event: IContractEvent): IndexEntry[] {
    const entries: IndexEntry[] = [];
    const timestamp = event.timestamp.getTime();
    
    // Time index
    if (this.config.enableTimeIndex) {
      entries.push({
        key: `time:${Math.floor(timestamp / 3600000)}`, // Hourly buckets
        value: event.eventId,
        timestamp,
        type: IndexType.Time,
      });
    }
    
    // Type index
    if (this.config.enableTypeIndex) {
      entries.push({
        key: `type:${event.eventType}`,
        value: event.eventId,
        timestamp,
        type: IndexType.Type,
      });
    }
    
    // Address index
    if (this.config.enableAddressIndex) {
      entries.push({
        key: `address:${event.address}`,
        value: event.eventId,
        timestamp,
        type: IndexType.Address,
      });
    }
    
    // Topic indexes
    if (this.config.enableTopicIndex && event.topics) {
      for (const topic of event.topics) {
        entries.push({
          key: `topic:${topic}`,
          value: event.eventId,
          timestamp,
          type: IndexType.Topic,
        });
      }
    }
    
    // Composite indexes
    if (this.config.enableCompositeIndex) {
      // Type + Time composite
      entries.push({
        key: `composite:type_time:${event.eventType}:${Math.floor(timestamp / 3600000)}`,
        value: event.eventId,
        timestamp,
        type: IndexType.Composite,
      });
      
      // Address + Time composite
      entries.push({
        key: `composite:address_time:${event.address}:${Math.floor(timestamp / 3600000)}`,
        value: event.eventId,
        timestamp,
        type: IndexType.Composite,
      });
    }
    
    return entries;
  }

  /**
   * Add entry to index
   */
  private async addToIndex(entry: IndexEntry): Promise<void> {
    try {
      // Add to Redis index
      await this.redisService.sadd(entry.key, entry.value);
      
      // Set expiration for time-based indexes
      if (entry.type === IndexType.Time) {
        await this.redisService.expire(entry.key, 7 * 24 * 60 * 60); // 7 days
      }
      
      // Add to local cache
      if (!this.indexCache.has(entry.key)) {
        this.indexCache.set(entry.key, []);
      }
      this.indexCache.get(entry.key)!.push(entry);
      
    } catch (error) {
      this.logger.error(`Failed to add to index ${entry.key}:`, error);
      throw error;
    }
  }

  /**
   * Batch add entries to index
   */
  private async batchAddToIndex(entries: IndexEntry[]): Promise<void> {
    const batchedEntries = new Map<string, string[]>();
    
    // Group entries by key
    for (const entry of entries) {
      if (!batchedEntries.has(entry.key)) {
        batchedEntries.set(entry.key, []);
      }
      batchedEntries.get(entry.key)!.push(entry.value);
    }
    
    // Batch add to Redis
    const pipeline = this.redisService.pipeline();
    for (const [key, values] of batchedEntries) {
      pipeline.sadd(key, ...values);
      
      // Set expiration for time-based indexes
      if (key.startsWith('time:')) {
        pipeline.expire(key, 7 * 24 * 60 * 60);
      }
    }
    
    await pipeline.exec();
    
    // Update local cache
    for (const entry of entries) {
      if (!this.indexCache.has(entry.key)) {
        this.indexCache.set(entry.key, []);
      }
      this.indexCache.get(entry.key)!.push(entry);
    }
  }

  /**
   * Remove entry from index
   */
  private async removeFromIndexEntry(entry: IndexEntry): Promise<void> {
    try {
      await this.redisService.srem(entry.key, entry.value);
      
      // Update local cache
      const cached = this.indexCache.get(entry.key);
      if (cached) {
        const index = cached.findIndex(e => e.value === entry.value);
        if (index >= 0) {
          cached.splice(index, 1);
        }
      }
      
    } catch (error) {
      this.logger.error(`Failed to remove from index ${entry.key}:`, error);
      throw error;
    }
  }

  /**
   * Execute query using indexes
   */
  private async executeQuery(query: IndexQuery): Promise<IContractEvent[]> {
    const eventIds = new Set<string>();
    
    // Use most selective index first
    if (query.addresses && query.addresses.length > 0) {
      // Use address index
      for (const address of query.addresses) {
        const ids = await this.redisService.smembers(`address:${address}`);
        ids.forEach(id => eventIds.add(id));
      }
    } else if (query.eventTypes && query.eventTypes.length > 0) {
      // Use type index
      for (const eventType of query.eventTypes) {
        const ids = await this.redisService.smembers(`type:${eventType}`);
        ids.forEach(id => eventIds.add(id));
      }
    } else if (query.topics && query.topics.length > 0) {
      // Use topic index
      for (const topic of query.topics) {
        const ids = await this.redisService.smembers(`topic:${topic}`);
        ids.forEach(id => eventIds.add(id));
      }
    } else {
      // Use time index as fallback
      if (query.fromTime || query.toTime) {
        const timeKeys = this.generateTimeKeys(query.fromTime, query.toTime);
        for (const timeKey of timeKeys) {
          const ids = await this.redisService.smembers(timeKey);
          ids.forEach(id => eventIds.add(id));
        }
      }
    }
    
    // Convert set to array and fetch full event data
    const eventIdsArray = Array.from(eventIds);
    const events = await this.fetchEventsByIds(eventIdsArray);
    
    // Apply additional filters
    return this.applyAdditionalFilters(events, query);
  }

  /**
   * Generate time keys for time range query
   */
  private generateTimeKeys(fromTime?: number, toTime?: number): string[] {
    const keys: string[] = [];
    const now = Date.now();
    const from = fromTime || 0;
    const to = toTime || now;
    
    // Generate hourly keys
    for (let time = from; time <= to; time += 3600000) {
      keys.push(`time:${Math.floor(time / 3600000)}`);
    }
    
    return keys;
  }

  /**
   * Fetch events by IDs (placeholder - would integrate with database)
   */
  private async fetchEventsByIds(eventIds: string[]): Promise<IContractEvent[]> {
    // This would integrate with your database to fetch full event data
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Apply additional filters to events
   */
  private applyAdditionalFilters(events: IContractEvent[], query: IndexQuery): IContractEvent[] {
    let filtered = events;
    
    // Filter by block range
    if (query.fromBlock !== undefined || query.toBlock !== undefined) {
      filtered = filtered.filter(event => {
        const block = event.blockNumber || 0;
        const fromMatch = query.fromBlock === undefined || block >= query.fromBlock;
        const toMatch = query.toBlock === undefined || block <= query.toBlock;
        return fromMatch && toMatch;
      });
    }
    
    // Sort events
    if (query.sortBy) {
      filtered.sort((a, b) => {
        const aValue = (a as any)[query.sortBy!] || 0;
        const bValue = (b as any)[query.sortBy!] || 0;
        const order = query.sortOrder === 'desc' ? -1 : 1;
        return (aValue - bValue) * order;
      });
    }
    
    return filtered;
  }

  /**
   * Generate query cache key
   */
  private generateQueryCacheKey(query: IndexQuery): string {
    return JSON.stringify(query);
  }

  /**
   * Update statistics
   */
  private updateStats(entryCount: number): void {
    this.stats.totalEntries += entryCount;
    this.stats.lastUpdated = new Date();
    
    // Update entries by type (simplified)
    this.stats.entriesByType[IndexType.Time] += Math.ceil(entryCount / 4);
    this.stats.entriesByType[IndexType.Type] += Math.ceil(entryCount / 4);
    this.stats.entriesByType[IndexType.Address] += Math.ceil(entryCount / 4);
    this.stats.entriesByType[IndexType.Topic] += Math.ceil(entryCount / 8);
    this.stats.entriesByType[IndexType.Composite] += Math.ceil(entryCount / 8);
  }

  /**
   * Update query performance metrics
   */
  private updateQueryPerformance(queryTime: number): void {
    const current = this.stats.queryPerformance.averageQueryTime;
    this.stats.queryPerformance.averageQueryTime = (current + queryTime) / 2;
    this.stats.queryPerformance.queriesPerSecond = 1000 / queryTime;
  }

  /**
   * Start periodic index updates
   */
  private startIndexUpdates(): void {
    setInterval(async () => {
      if (!this.indexingInProgress) {
        await this.performIndexMaintenance();
      }
    }, this.config.indexUpdateInterval);
  }

  /**
   * Perform index maintenance
   */
  private async performIndexMaintenance(): Promise<void> {
    this.indexingInProgress = true;
    
    try {
      // Clean up expired entries
      await this.cleanupExpiredEntries();
      
      // Optimize index structure
      await this.optimizeIndexes();
      
      // Update statistics
      await this.recordIndexStats();
      
    } catch (error) {
      this.logger.error('Index maintenance failed:', error);
    } finally {
      this.indexingInProgress = false;
    }
  }

  /**
   * Clean up expired entries
   */
  private async cleanupExpiredEntries(): Promise<void> {
    // Clean up time-based indexes older than retention period
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    
    for (const [key, entries] of this.indexCache.entries()) {
      if (key.startsWith('time:')) {
        const timeKey = parseInt(key.split(':')[1]) * 3600000;
        if (timeKey < cutoffTime) {
          this.indexCache.delete(key);
          await this.redisService.del(key);
        }
      }
    }
  }

  /**
   * Optimize index structure
   */
  private async optimizeIndexes(): Promise<void> {
    // Implement index optimization logic
    // This could include consolidating sparse indexes, rebalancing, etc.
  }

  /**
   * Record index statistics to monitoring
   */
  private async recordIndexStats(): Promise<void> {
    await this.monitoringService.recordMetric('index.total_entries', this.stats.totalEntries);
    await this.monitoringService.recordMetric('index.query_time', this.stats.queryPerformance.averageQueryTime);
    await this.monitoringService.recordMetric('index.cache_hit_rate', this.stats.queryPerformance.cacheHitRate);
  }

  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
    }, 300000); // Every 5 minutes
  }

  /**
   * Clean up caches
   */
  private cleanupCache(): void {
    // Clean up query cache
    const now = Date.now();
    for (const [key, result] of this.queryCache.entries()) {
      // Remove results older than 5 minutes
      if (now - result.queryTime > 300000) {
        this.queryCache.delete(key);
      }
    }
    
    // Limit index cache size
    if (this.indexCache.size > this.config.maxIndexEntries) {
      const entries = Array.from(this.indexCache.entries());
      entries.sort((a, b) => a[1][0].timestamp - b[1][0].timestamp);
      
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - this.config.maxIndexEntries);
      for (const [key] of toRemove) {
        this.indexCache.delete(key);
      }
    }
  }

  /**
   * Load indexes from cache
   */
  private async loadIndexesFromCache(): Promise<void> {
    try {
      // Load index statistics
      const cachedStats = await this.redisService.get('index_stats');
      if (cachedStats) {
        Object.assign(this.stats, JSON.parse(cachedStats));
      }
      
      this.logger.log('Loaded indexes from cache');
    } catch (error) {
      this.logger.error('Failed to load indexes from cache:', error);
    }
  }

  /**
   * Clear all indexes
   */
  private async clearAllIndexes(): Promise<void> {
    this.indexCache.clear();
    this.queryCache.clear();
    
    // Clear Redis indexes
    const keys = await this.redisService.keys('*');
    if (keys.length > 0) {
      await this.redisService.del(...keys);
    }
    
    // Reset statistics
    this.stats = {
      totalEntries: 0,
      entriesByType: {
        [IndexType.Time]: 0,
        [IndexType.Type]: 0,
        [IndexType.Address]: 0,
        [IndexType.Topic]: 0,
        [IndexType.Composite]: 0,
      },
      lastUpdated: new Date(),
      indexingTime: 0,
      queryPerformance: {
        averageQueryTime: 0,
        queriesPerSecond: 0,
        cacheHitRate: 0,
      },
    };
  }
}
