import Redis from 'ioredis';
import { Event, EventStoreRecord, EventStream, EventFilter, ReplayOptions, ReplayResult } from './EventTypes';
import { WinstonLogger } from '../utils/logger';

export class EventStore {
  private redis: Redis;
  private logger: WinstonLogger;
  private keyPrefix: string;

  constructor(redisConfig: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  }) {
    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db || 0,
      keyPrefix: redisConfig.keyPrefix || 'verinode:event_store:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    
    this.keyPrefix = redisConfig.keyPrefix || 'verinode:event_store:';
    this.logger = new WinstonLogger();
    
    this.setupErrorHandling();
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      this.logger.info('EventStore connected to Redis successfully');
    } catch (error) {
      this.logger.error('Failed to connect EventStore to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      this.logger.info('EventStore disconnected from Redis');
    } catch (error) {
      this.logger.error('Error disconnecting EventStore:', error);
      throw error;
    }
  }

  async storeEvent(event: Event, streamId?: string): Promise<EventStoreRecord> {
    try {
      const record: EventStoreRecord = {
        id: this.generateRecordId(),
        event,
        storedAt: new Date(),
        version: 1,
        streamId,
        streamVersion: streamId ? await this.getStreamVersion(streamId) + 1 : undefined
      };

      const recordKey = `records:${record.id}`;
      const eventData = JSON.stringify(record);

      // Store the record
      await this.redis.hset(recordKey, 'data', eventData);
      
      // Add to global timeline
      await this.redis.zadd('timeline', event.timestamp.getTime(), record.id);
      
      // Add to event type timeline
      await this.redis.zadd(`timeline:${event.type}`, event.timestamp.getTime(), record.id);
      
      // Add to stream timeline if streamId is provided
      if (streamId) {
        await this.redis.zadd(`stream:${streamId}`, record.streamVersion!, record.id);
        await this.redis.hset(`streams:${streamId}`, 'version', record.streamVersion!.toString());
      }

      // Set expiration for records (default 90 days)
      const ttl = 90 * 24 * 60 * 60;
      await this.redis.expire(recordKey, ttl);
      await this.redis.expire('timeline', ttl);
      await this.redis.expire(`timeline:${event.type}`, ttl);
      
      if (streamId) {
        await this.redis.expire(`stream:${streamId}`, ttl);
        await this.redis.expire(`streams:${streamId}`, ttl);
      }

      this.logger.debug('Event stored successfully:', {
        recordId: record.id,
        eventId: event.id,
        eventType: event.type,
        streamId
      });

      return record;
    } catch (error) {
      this.logger.error('Failed to store event:', {
        eventId: event.id,
        eventType: event.type,
        error
      });
      throw error;
    }
  }

  async getEvent(recordId: string): Promise<EventStoreRecord | null> {
    try {
      const eventData = await this.redis.hget(`records:${recordId}`, 'data');
      if (!eventData) {
        return null;
      }

      return JSON.parse(eventData);
    } catch (error) {
      this.logger.error('Failed to get event:', { recordId, error });
      return null;
    }
  }

  async getEvents(filter: EventFilter): Promise<EventStoreRecord[]> {
    try {
      let recordIds: string[] = [];

      if (filter.eventTypes && filter.eventTypes.length > 0) {
        // Get events from multiple event type timelines
        const promises = filter.eventTypes.map(eventType => 
          this.getEventsFromTimeline(`timeline:${eventType}`, filter)
        );
        const results = await Promise.all(promises);
        recordIds = [...new Set(results.flat())]; // Remove duplicates
      } else {
        // Get from global timeline
        recordIds = await this.getEventsFromTimeline('timeline', filter);
      }

      // Fetch full records
      const records: EventStoreRecord[] = [];
      for (const recordId of recordIds) {
        const record = await this.getEvent(recordId);
        if (record) {
          // Apply additional filters
          if (this.passesFilter(record, filter)) {
            records.push(record);
          }
        }
      }

      // Sort by timestamp
      records.sort((a, b) => a.event.timestamp.getTime() - b.event.timestamp.getTime());

      return records;
    } catch (error) {
      this.logger.error('Failed to get events:', { filter, error });
      throw error;
    }
  }

  async getStream(streamId: string): Promise<EventStream | null> {
    try {
      const streamData = await this.redis.hgetall(`streams:${streamId}`);
      if (!streamData || !streamData.version) {
        return null;
      }

      const version = parseInt(streamData.version);
      const recordIds = await this.redis.zrange(`stream:${streamId}`, 0, -1);
      
      const events: Event[] = [];
      for (const recordId of recordIds) {
        const record = await this.getEvent(recordId);
        if (record) {
          events.push(record.event);
        }
      }

      return {
        id: streamId,
        version,
        events,
        metadata: streamData.metadata ? JSON.parse(streamData.metadata) : undefined
      };
    } catch (error) {
      this.logger.error('Failed to get stream:', { streamId, error });
      return null;
    }
  }

  async replayEvents(options: ReplayOptions = {}): Promise<ReplayResult> {
    const startTime = Date.now();
    const replayedEvents: string[] = [];
    const errors: Array<{ eventId: string; error: string }> = [];
    let successful = 0;

    try {
      this.logger.info('Starting event replay:', options);

      const filter: EventFilter = {
        eventTypes: options.eventTypes,
        timeRange: {
          start: options.fromTimestamp || new Date(0),
          end: options.toTimestamp || new Date()
        }
      };

      const records = await this.getEvents(filter);
      
      if (options.dryRun) {
        this.logger.info('Dry run mode - would replay events:', {
          count: records.length
        });
        return {
          replayedEvents: records.map(r => r.event.id),
          successful: records.length,
          failed: 0,
          errors: [],
          duration: Date.now() - startTime
        };
      }

      const batchSize = options.batchSize || 100;
      
      if (options.parallel) {
        // Process in parallel
        const promises = records.map(async (record) => {
          try {
            await this.replaySingleEvent(record);
            replayedEvents.push(record.event.id);
            successful++;
          } catch (error) {
            errors.push({
              eventId: record.event.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        });
        
        await Promise.all(promises);
      } else {
        // Process sequentially
        for (const record of records) {
          try {
            await this.replaySingleEvent(record);
            replayedEvents.push(record.event.id);
            successful++;
          } catch (error) {
            errors.push({
              eventId: record.event.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      const result: ReplayResult = {
        replayedEvents,
        successful,
        failed: errors.length,
        errors,
        duration: Date.now() - startTime
      };

      this.logger.info('Event replay completed:', result);
      return result;
    } catch (error) {
      this.logger.error('Event replay failed:', error);
      throw error;
    }
  }

  async getEventStats(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySource: Record<string, number>;
    oldestEvent?: Date;
    newestEvent?: Date;
  }> {
    try {
      const totalEvents = await this.redis.zcard('timeline');
      
      // Get event types
      const eventTypeKeys = await this.redis.keys('timeline:*');
      const eventsByType: Record<string, number> = {};
      
      for (const key of eventTypeKeys) {
        const eventType = key.replace('timeline:', '');
        const count = await this.redis.zcard(key);
        eventsByType[eventType] = count;
      }

      // Get oldest and newest events
      const oldestResult = await this.redis.zrange('timeline', 0, 0);
      const newestResult = await this.redis.zrange('timeline', -1, -1);
      
      let oldestEvent: Date | undefined;
      let newestEvent: Date | undefined;
      
      if (oldestResult.length > 0) {
        const oldestRecord = await this.getEvent(oldestResult[0]);
        if (oldestRecord) {
          oldestEvent = oldestRecord.event.timestamp;
        }
      }
      
      if (newestResult.length > 0) {
        const newestRecord = await this.getEvent(newestResult[0]);
        if (newestRecord) {
          newestEvent = newestRecord.event.timestamp;
        }
      }

      // Get events by source (would need to scan records for this)
      const eventsBySource: Record<string, number> = {};
      const sampleSize = Math.min(1000, totalEvents);
      const sampleRecords = await this.redis.zrange('timeline', 0, sampleSize - 1);
      
      for (const recordId of sampleRecords) {
        const record = await this.getEvent(recordId);
        if (record) {
          const source = record.event.source;
          eventsBySource[source] = (eventsBySource[source] || 0) + 1;
        }
      }

      return {
        totalEvents,
        eventsByType,
        eventsBySource,
        oldestEvent,
        newestEvent
      };
    } catch (error) {
      this.logger.error('Failed to get event stats:', error);
      throw error;
    }
  }

  async cleanup(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffTimestamp = cutoffDate.getTime();
      
      // Get old record IDs
      const oldRecordIds = await this.redis.zrangebyscore('timeline', '-inf', cutoffTimestamp);
      
      let deletedCount = 0;
      
      for (const recordId of oldRecordIds) {
        try {
          // Delete record
          await this.redis.del(`records:${recordId}`);
          
          // Remove from all timelines
          await this.redis.zrem('timeline', recordId);
          
          // Get event type and remove from type-specific timeline
          const record = await this.getEvent(recordId);
          if (record) {
            await this.redis.zrem(`timeline:${record.event.type}`, recordId);
            
            // Remove from stream if applicable
            if (record.streamId) {
              await this.redis.zrem(`stream:${record.streamId}`, recordId);
            }
          }
          
          deletedCount++;
        } catch (error) {
          this.logger.error('Failed to cleanup record:', { recordId, error });
        }
      }

      this.logger.info('Event cleanup completed:', {
        deletedCount,
        olderThanDays,
        cutoffDate
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Event cleanup failed:', error);
      throw error;
    }
  }

  private async getEventsFromTimeline(timeline: string, filter: EventFilter): Promise<string[]> {
    let recordIds: string[] = [];

    if (filter.timeRange) {
      const min = filter.timeRange.start.getTime();
      const max = filter.timeRange.end.getTime();
      recordIds = await this.redis.zrangebyscore(timeline, min, max);
    } else {
      recordIds = await this.redis.zrange(timeline, 0, -1);
    }

    return recordIds;
  }

  private passesFilter(record: EventStoreRecord, filter: EventFilter): boolean {
    if (filter.source && record.event.source !== filter.source) {
      return false;
    }

    if (filter.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (record.event.metadata?.[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private async getStreamVersion(streamId: string): Promise<number> {
    try {
      const version = await this.redis.hget(`streams:${streamId}`, 'version');
      return version ? parseInt(version) : 0;
    } catch {
      return 0;
    }
  }

  private async replaySingleEvent(record: EventStoreRecord): Promise<void> {
    // This would emit the event to the current event bus
    // Implementation depends on how you want to handle replay
    this.logger.debug('Replaying event:', {
      eventId: record.event.id,
      eventType: record.event.type,
      timestamp: record.event.timestamp
    });
  }

  private generateRecordId(): string {
    return `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupErrorHandling(): void {
    this.redis.on('error', (error: Error) => {
      this.logger.error('EventStore Redis error:', error);
    });
  }
}

export const eventStore = new EventStore({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '1'),
  keyPrefix: 'verinode:event_store:'
});
