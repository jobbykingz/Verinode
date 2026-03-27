import Redis from 'ioredis';
import { setTimeout } from 'timers/promises';
import { Event, EventHandler, EventBusConfig, RetryPolicy, EventProcessingStats } from './EventTypes';
import { WinstonLogger } from '../utils/logger';

export interface EventBusEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  eventPublished: (event: Event) => void;
}

export class EventBus {
  private redis: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private config: EventBusConfig;
  private logger: WinstonLogger;
  private handlers: Map<string, EventHandler[]> = new Map();
  private stats: EventProcessingStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    retried: 0,
    deadLettered: 0,
    averageProcessingTime: 0
  };
  private processingTimes: number[] = [];
  private isShuttingDown = false;
  private listeners: Map<keyof EventBusEvents, Function[]> = new Map();

  constructor(config: EventBusConfig) {
    this.config = config;
    this.logger = new WinstonLogger();
    
    // Initialize Redis clients
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
      keyPrefix: config.redis.keyPrefix || 'verinode:events:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.subscriber = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
      keyPrefix: config.redis.keyPrefix || 'verinode:events:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.publisher = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
      keyPrefix: config.redis.keyPrefix || 'verinode:events:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.setupErrorHandling();
    this.setupSubscriber();
  }

  on<K extends keyof EventBusEvents>(event: K, listener: EventBusEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  emit<K extends keyof EventBusEvents>(event: K, ...args: Parameters<EventBusEvents[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          this.logger.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.redis.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);
      
      this.logger.info('EventBus connected to Redis successfully');
      this.emit('connected');
    } catch (error) {
      this.logger.error('Failed to connect EventBus to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isShuttingDown = true;
    
    try {
      await Promise.all([
        this.redis.disconnect(),
        this.subscriber.disconnect(),
        this.publisher.disconnect()
      ]);
      
      this.logger.info('EventBus disconnected from Redis');
      this.emit('disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting EventBus:', error);
      throw error;
    }
  }

  async publish(event: Event): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('EventBus is shutting down, cannot publish events');
    }

    const startTime = Date.now();
    
    try {
      const channel = `events:${event.type}`;
      const eventPayload = JSON.stringify(event);
      
      // Publish to Redis
      await this.publisher.publish(channel, eventPayload);
      
      // Store in Redis for event sourcing
      await this.storeEvent(event);
      
      // Update stats
      this.updateStats(startTime, true);
      
      this.logger.debug('Event published successfully:', {
        eventId: event.id,
        type: event.type,
        channel
      });
      
      this.emit('eventPublished', event);
    } catch (error) {
      this.updateStats(startTime, false);
      this.logger.error('Failed to publish event:', {
        eventId: event.id,
        type: event.type,
        error
      });
      
      // Add to dead letter queue
      await this.addToDeadLetterQueue(event, error as Error);
      
      throw error;
    }
  }

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    
    this.handlers.get(eventType)!.push(handler);
    
    // Subscribe to Redis channel if not already subscribed
    const channel = `events:${eventType}`;
    this.subscriber.subscribe(channel);
    
    this.logger.debug('Handler subscribed to event type:', { eventType });
  }

  unsubscribe(eventType: string, handler?: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      return;
    }
    
    if (handler) {
      const handlers = this.handlers.get(eventType)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      
      // Unsubscribe from Redis if no more handlers
      if (handlers.length === 0) {
        this.subscriber.unsubscribe(`events:${eventType}`);
        this.handlers.delete(eventType);
      }
    } else {
      // Remove all handlers for this event type
      this.handlers.delete(eventType);
      this.subscriber.unsubscribe(`events:${eventType}`);
    }
    
    this.logger.debug('Handler unsubscribed from event type:', { eventType });
  }

  async publishBatch(events: Event[]): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('EventBus is shutting down, cannot publish events');
    }

    const pipeline = this.publisher.pipeline();
    const startTime = Date.now();
    
    try {
      for (const event of events) {
        const channel = `events:${event.type}`;
        const eventPayload = JSON.stringify(event);
        
        pipeline.publish(channel, eventPayload);
        await this.storeEvent(event);
      }
      
      await pipeline.exec();
      
      // Update stats for batch
      this.updateStats(startTime, true, events.length);
      
      this.logger.info('Batch of events published successfully:', {
        count: events.length,
        duration: Date.now() - startTime
      });
      
      events.forEach(event => this.emit('eventPublished', event));
    } catch (error) {
      this.updateStats(startTime, false, events.length);
      this.logger.error('Failed to publish batch of events:', {
        count: events.length,
        error
      });
      
      // Add all events to dead letter queue
      for (const event of events) {
        await this.addToDeadLetterQueue(event, error as Error);
      }
      
      throw error;
    }
  }

  async replayEvents(fromTimestamp?: Date, toTimestamp?: Date): Promise<Event[]> {
    try {
      const key = 'events:all';
      let events: Event[] = [];
      
      if (fromTimestamp || toTimestamp) {
        // Use Redis sorted set with timestamp as score for time-based queries
        const min = fromTimestamp ? fromTimestamp.getTime() : '-inf';
        const max = toTimestamp ? toTimestamp.getTime() : '+inf';
        
        const eventIds = await this.redis.zrangebyscore(key, min, max);
        
        for (const eventId of eventIds) {
          const eventData = await this.redis.hget('events:by_id', eventId);
          if (eventData) {
            events.push(JSON.parse(eventData));
          }
        }
      } else {
        // Get all events
        const eventIds = await this.redis.zrange(key, 0, -1);
        
        for (const eventId of eventIds) {
          const eventData = await this.redis.hget('events:by_id', eventId);
          if (eventData) {
            events.push(JSON.parse(eventData));
          }
        }
      }
      
      // Sort by timestamp
      events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      this.logger.info('Events replayed:', {
        count: events.length,
        fromTimestamp,
        toTimestamp
      });
      
      return events;
    } catch (error) {
      this.logger.error('Failed to replay events:', error);
      throw error;
    }
  }

  getStats(): EventProcessingStats {
    return { ...this.stats };
  }

  getHandlerCount(): number {
    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.length;
    }
    return total;
  }

  private setupErrorHandling(): void {
    this.redis.on('error', (error: Error) => {
      this.logger.error('Redis connection error:', error);
      this.emit('error', error);
    });

    this.subscriber.on('error', (error: Error) => {
      this.logger.error('Redis subscriber error:', error);
      this.emit('error', error);
    });

    this.publisher.on('error', (error: Error) => {
      this.logger.error('Redis publisher error:', error);
      this.emit('error', error);
    });
  }

  private setupSubscriber(): void {
    this.subscriber.on('message', async (channel: string, message: string) => {
      if (this.isShuttingDown) {
        return;
      }

      try {
        const eventType = channel.replace('events:', '');
        const event: Event = JSON.parse(message);
        
        const handlers = this.handlers.get(eventType);
        if (handlers && handlers.length > 0) {
          await this.processEvent(event, handlers);
        }
      } catch (error) {
        this.logger.error('Error processing event message:', {
          channel,
          message,
          error
        });
      }
    });
  }

  private async processEvent(event: Event, handlers: EventHandler[]): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Process all handlers in parallel
      await Promise.all(
        handlers.map(async (handler) => {
          try {
            await handler(event);
          } catch (error) {
            this.logger.error('Event handler failed:', {
              eventId: event.id,
              eventType: event.type,
              error
            });
            
            // Apply retry policy if configured
            if (event.retryCount && event.retryCount < (event.maxRetries || 3)) {
              await this.retryEvent(event, handler);
            } else {
              await this.addToDeadLetterQueue(event, error as Error);
            }
          }
        })
      );
      
      this.updateStats(startTime, true);
    } catch (error) {
      this.updateStats(startTime, false);
      throw error;
    }
  }

  private async retryEvent(event: Event, handler: EventHandler): Promise<void> {
    const retryCount = (event.retryCount || 0) + 1;
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff with max 30s
    
    this.logger.info('Retrying event:', {
      eventId: event.id,
      retryCount,
      delay
    });
    
    await setTimeout(delay);
    try {
      const retryEvent = { ...event, retryCount };
      await handler(retryEvent);
      this.stats.retried++;
    } catch (error) {
      if (retryCount >= (event.maxRetries || 3)) {
        await this.addToDeadLetterQueue(event, error as Error);
      } else {
        await this.retryEvent(event, handler);
      }
    }
  }

  private async storeEvent(event: Event): Promise<void> {
    try {
      const eventId = event.id;
      const eventData = JSON.stringify(event);
      const timestamp = event.timestamp.getTime();
      
      // Store in hash for direct lookup
      await this.redis.hset('events:by_id', eventId, eventData);
      
      // Add to sorted set for time-based queries
      await this.redis.zadd('events:all', timestamp, eventId);
      
      // Add to type-specific sorted set
      await this.redis.zadd(`events:${event.type}`, timestamp, eventId);
      
      // Set expiration for old events (optional)
      const ttl = 30 * 24 * 60 * 60; // 30 days
      await this.redis.expire('events:by_id', ttl);
      await this.redis.expire('events:all', ttl);
      await this.redis.expire(`events:${event.type}`, ttl);
    } catch (error) {
      this.logger.error('Failed to store event:', error);
      throw error;
    }
  }

  private async addToDeadLetterQueue(event: Event, error: Error): Promise<void> {
    try {
      const deadLetterEvent = {
        ...event,
        error: {
          message: error.message,
          stack: error.stack
        },
        failedAt: new Date()
      };
      
      await this.redis.lpush(
        'events:dead_letter_queue',
        JSON.stringify(deadLetterEvent)
      );
      
      // Trim the dead letter queue to prevent unlimited growth
      await this.redis.ltrim('events:dead_letter_queue', 0, this.config.deadLetterQueue.maxSize - 1);
      
      this.stats.deadLettered++;
      
      this.logger.warn('Event added to dead letter queue:', {
        eventId: event.id,
        eventType: event.type,
        error: error.message
      });
    } catch (dlqError) {
      this.logger.error('Failed to add event to dead letter queue:', dlqError);
    }
  }

  private updateStats(startTime: number, success: boolean, eventCount: number = 1): void {
    const processingTime = Date.now() - startTime;
    
    this.stats.totalProcessed += eventCount;
    
    if (success) {
      this.stats.successful += eventCount;
    } else {
      this.stats.failed += eventCount;
    }
    
    // Update average processing time
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift(); // Keep only last 1000 measurements
    }
    
    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    
    this.stats.lastProcessedAt = new Date();
  }
}

export default EventBus;
