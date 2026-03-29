import { Event, IEvent } from '../models/Event';
import { Snapshot, ISnapshot } from '../models/Snapshot';
import { EventEmitter } from 'events';
import mongoose from 'mongoose';

export interface EventStoreOptions {
  batchSize?: number;
  enableSnapshots?: boolean;
  snapshotInterval?: number;
  maxRetries?: number;
  enableCompression?: boolean;
}

export interface EventStoreMetrics {
  totalEvents: number;
  totalSnapshots: number;
  eventsPerSecond: number;
  averageEventSize: number;
  errorRate: number;
}

export class EventStore extends EventEmitter {
  private options: Required<EventStoreOptions>;
  private metrics: EventStoreMetrics;
  private isInitialized = false;

  constructor(options: EventStoreOptions = {}) {
    super();
    
    this.options = {
      batchSize: options.batchSize || 100,
      enableSnapshots: options.enableSnapshots !== false,
      snapshotInterval: options.snapshotInterval || 100,
      maxRetries: options.maxRetries || 3,
      enableCompression: options.enableCompression !== false
    };

    this.metrics = {
      totalEvents: 0,
      totalSnapshots: 0,
      eventsPerSecond: 0,
      averageEventSize: 0,
      errorRate: 0
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure database connection is ready
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database connection not established');
      }

      // Create indexes if they don't exist
      await this.ensureIndexes();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async ensureIndexes(): Promise<void> {
    // Events collection indexes
    await Event.createIndexes();
    
    // Snapshots collection indexes
    if (this.options.enableSnapshots) {
      await Snapshot.createIndexes();
    }
  }

  async saveEvent(eventData: Partial<IEvent>): Promise<IEvent> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate unique event ID if not provided
      if (!eventData.eventId) {
        eventData.eventId = this.generateEventId();
      }

      // Set timestamp if not provided
      if (!eventData.eventMetadata?.timestamp) {
        eventData.eventMetadata = {
          ...eventData.eventMetadata,
          timestamp: new Date(),
          version: eventData.eventMetadata?.version || 1
        };
      } else if (!eventData.eventMetadata.version) {
        eventData.eventMetadata.version = 1;
      }

      const event = new Event(eventData);
      await event.save();

      // Update metrics
      this.updateMetrics(event);

      // Emit events
      this.emit('eventSaved', event);
      this.emit('event', event);

      // Check if snapshot should be created
      if (this.options.enableSnapshots && 
          event.sequenceNumber % this.options.snapshotInterval === 0) {
        this.emit('snapshotRequested', {
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          sequenceNumber: event.sequenceNumber
        });
      }

      return event;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async saveEvents(eventsData: Partial<IEvent>[]): Promise<IEvent[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const savedEvents: IEvent[] = [];
    const batchSize = this.options.batchSize;

    try {
      for (let i = 0; i < eventsData.length; i += batchSize) {
        const batch = eventsData.slice(i, i + batchSize);
        
        // Process batch
        for (const eventData of batch) {
          if (!eventData.eventId) {
            eventData.eventId = this.generateEventId();
          }

          if (!eventData.eventMetadata?.timestamp) {
            eventData.eventMetadata = {
              ...eventData.eventMetadata,
              timestamp: new Date(),
              version: eventData.eventMetadata?.version || 1
            };
          } else if (!eventData.eventMetadata.version) {
            eventData.eventMetadata.version = 1;
          }

          const event = new Event(eventData);
          await event.save();
          savedEvents.push(event);
          
          this.updateMetrics(event);
          this.emit('eventSaved', event);
        }
      }

      this.emit('batchSaved', savedEvents);
      return savedEvents;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getEvents(
    aggregateId: string,
    options: {
      fromSequence?: number;
      toSequence?: number;
      limit?: number;
      includeProcessed?: boolean;
    } = {}
  ): Promise<IEvent[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const query: any = { aggregateId };
      
      if (options.fromSequence !== undefined || options.toSequence !== undefined) {
        query.sequenceNumber = {};
        if (options.fromSequence !== undefined) {
          query.sequenceNumber.$gte = options.fromSequence;
        }
        if (options.toSequence !== undefined) {
          query.sequenceNumber.$lte = options.toSequence;
        }
      }

      if (!options.includeProcessed) {
        query.isProcessed = false;
      }

      let dbQuery = Event.find(query).sort({ sequenceNumber: 1 });
      
      if (options.limit) {
        dbQuery = dbQuery.limit(options.limit);
      }

      const events = await dbQuery.exec();
      this.emit('eventsRetrieved', { aggregateId, count: events.length });
      
      return events;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getEvent(eventId: string): Promise<IEvent | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const event = await Event.findOne({ eventId });
      this.emit('eventRetrieved', { eventId, found: !!event });
      return event;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getEventsByType(
    eventType: string,
    options: {
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    } = {}
  ): Promise<IEvent[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const query: any = { eventType };
      
      if (options.fromDate || options.toDate) {
        query.createdAt = {};
        if (options.fromDate) query.createdAt.$gte = options.fromDate;
        if (options.toDate) query.createdAt.$lte = options.toDate;
      }

      let dbQuery = Event.find(query).sort({ createdAt: -1 });
      
      if (options.limit) {
        dbQuery = dbQuery.limit(options.limit);
      }

      const events = await dbQuery.exec();
      this.emit('eventsByTypeRetrieved', { eventType, count: events.length });
      
      return events;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getUnprocessedEvents(limit?: number): Promise<IEvent[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const events = await Event.findUnprocessed(limit);
      this.emit('unprocessedEventsRetrieved', { count: events.length });
      return events;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async markEventAsProcessed(eventId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const event = await Event.findOne({ eventId });
      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      await event.markAsProcessed();
      this.emit('eventProcessed', event);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async markEventAsFailed(eventId: string, error: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const event = await Event.findOne({ eventId });
      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      await event.markAsFailed(error);
      this.emit('eventProcessingFailed', { eventId, error });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getEventCount(aggregateId: string): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const count = await Event.getEventCount(aggregateId);
      this.emit('eventCountRetrieved', { aggregateId, count });
      return count;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getLastEvent(aggregateId: string): Promise<IEvent | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const event = await Event.getLastEvent(aggregateId);
      this.emit('lastEventRetrieved', { aggregateId, event: !!event });
      return event;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getEventsInTimeRange(
    fromDate: Date,
    toDate: Date,
    options: { limit?: number; eventTypes?: string[] } = {}
  ): Promise<IEvent[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const query: any = {
        createdAt: { $gte: fromDate, $lte: toDate }
      };

      if (options.eventTypes && options.eventTypes.length > 0) {
        query.eventType = { $in: options.eventTypes };
      }

      let dbQuery = Event.find(query).sort({ createdAt: 1 });
      
      if (options.limit) {
        dbQuery = dbQuery.limit(options.limit);
      }

      const events = await dbQuery.exec();
      this.emit('eventsInTimeRangeRetrieved', { 
        fromDate, 
        toDate, 
        count: events.length 
      });
      
      return events;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async deduplicateEvents(events: Partial<IEvent>[]): Promise<Partial<IEvent>[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const eventIds = events.map((e: Partial<IEvent>) => e.eventId).filter((id): id is string => Boolean(id));
      const existingEvents = await Event.find({ eventId: { $in: eventIds } });
      const existingIds = new Set(existingEvents.map((e: IEvent) => e.eventId));

      const deduplicated = events.filter(event => 
        !event.eventId || !existingIds.has(event.eventId)
      );

      this.emit('eventsDeduplicated', { 
        original: events.length, 
        deduplicated: deduplicated.length 
      });

      return deduplicated;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getMetrics(): Promise<EventStoreMetrics> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const totalEvents = await Event.countDocuments();
      const totalSnapshots = this.options.enableSnapshots ? 
        await Snapshot.countDocuments({ isActive: true }) : 0;

      // Calculate events per second (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentEvents = await Event.countDocuments({
        createdAt: { $gte: oneHourAgo }
      });
      const eventsPerSecond = recentEvents / 3600;

      // Calculate average event size
      const avgEventSize = await this.calculateAverageEventSize();

      // Calculate error rate
      const errorRate = await this.calculateErrorRate();

      this.metrics = {
        totalEvents,
        totalSnapshots,
        eventsPerSecond,
        averageEventSize: avgEventSize,
        errorRate
      };

      return this.metrics;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async calculateAverageEventSize(): Promise<number> {
    try {
      const pipeline = [
        { $match: { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
        { $group: { _id: null, avgSize: { $avg: { $strLenCP: { $toString: '$eventData' } } } } }
      ];
      
      const result = await Event.aggregate(pipeline);
      return result[0]?.avgSize || 0;
    } catch {
      return 0;
    }
  }

  private async calculateErrorRate(): Promise<number> {
    try {
      const total = await Event.countDocuments();
      const failed = await Event.countDocuments({ 
        isProcessed: false, 
        processingAttempts: { $gt: 0 } 
      });
      
      return total > 0 ? failed / total : 0;
    } catch {
      return 0;
    }
  }

  private updateMetrics(event: IEvent): void {
    this.metrics.totalEvents += 1;
    
    // Update average event size
    const eventSize = JSON.stringify(event.eventData).length;
    this.metrics.averageEventSize = 
      (this.metrics.averageEventSize * (this.metrics.totalEvents - 1) + eventSize) / 
      this.metrics.totalEvents;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async close(): Promise<void> {
    this.removeAllListeners();
    this.isInitialized = false;
    this.emit('closed');
  }
}

export default EventStore;
