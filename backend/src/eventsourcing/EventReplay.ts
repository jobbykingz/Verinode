import { Event, IEvent } from '../models/Event';
import { Snapshot, ISnapshot } from '../models/Snapshot';
import { SnapshotManager } from './SnapshotManager';
import { EventEmitter } from 'events';
import mongoose from 'mongoose';

export interface ReplayOptions {
  aggregateId: string;
  aggregateType: string;
  fromSequence?: number;
  toSequence?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  useSnapshots?: boolean;
  batchSize?: number;
  maxEvents?: number;
  includeMetadata?: boolean;
}

export interface ReplayResult {
  aggregateId: string;
  aggregateType: string;
  finalState: Record<string, any>;
  eventsReplayed: number;
  snapshotsUsed: number;
  replayTime: number;
  fromSequence: number;
  toSequence: number;
  metadata: {
    snapshots: ISnapshot[];
    events: IEvent[];
    errors: any[];
  };
}

export interface TemporalQuery {
  aggregateId: string;
  aggregateType: string;
  atTimestamp: Date;
  atSequence?: number;
  includeEvents?: boolean;
}

export interface TemporalState {
  state: Record<string, any>;
  timestamp: Date;
  sequenceNumber: number;
  eventsUsed: IEvent[];
  snapshotUsed?: ISnapshot;
}

export interface ReplayMetrics {
  totalReplays: number;
  averageReplayTime: number;
  eventsProcessed: number;
  snapshotsUsed: number;
  errorRate: number;
  averageEventsPerReplay: number;
}

export class EventReplay extends EventEmitter {
  private snapshotManager: SnapshotManager;
  private metrics: ReplayMetrics;
  private isInitialized = false;

  constructor(snapshotManager: SnapshotManager) {
    super();
    this.snapshotManager = snapshotManager;
    
    this.metrics = {
      totalReplays: 0,
      averageReplayTime: 0,
      eventsProcessed: 0,
      snapshotsUsed: 0,
      errorRate: 0,
      averageEventsPerReplay: 0
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure snapshot manager is initialized
      if (!this.snapshotManager) {
        throw new Error('Snapshot manager not provided');
      }

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async replayEvents(options: ReplayOptions): Promise<ReplayResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: ReplayResult = {
      aggregateId: options.aggregateId,
      aggregateType: options.aggregateType,
      finalState: {},
      eventsReplayed: 0,
      snapshotsUsed: 0,
      replayTime: 0,
      fromSequence: options.fromSequence || 0,
      toSequence: options.toSequence || Number.MAX_SAFE_INTEGER,
      metadata: {
        snapshots: [],
        events: [],
        errors: []
      }
    };

    try {
      // Determine the starting point
      let currentState: Record<string, any> = {};
      let startSequence = options.fromSequence || 0;

      // Use snapshots if enabled
      if (options.useSnapshots !== false) {
        const snapshotResult = await this.findBestSnapshot(
          options.aggregateId,
          startSequence,
          options.toSequence
        );
        
        if (snapshotResult) {
          currentState = snapshotResult.data;
          startSequence = snapshotResult.fromSequence + 1;
          result.snapshotsUsed++;
          result.metadata.snapshots.push(snapshotResult.snapshot);
          this.metrics.snapshotsUsed++;
        }
      }

      // Get events to replay
      const events = await this.getEventsForReplay(options, startSequence);
      
      if (events.length === 0) {
        result.finalState = currentState;
        result.replayTime = Date.now() - startTime;
        this.updateMetrics(result, Date.now() - startTime);
        this.emit('replayCompleted', result);
        return result;
      }

      // Replay events
      for (const event of events) {
        try {
          currentState = await this.applyEvent(currentState, event);
          result.eventsReplayed++;
          result.metadata.events.push(event);
          this.metrics.eventsProcessed++;
          
          this.emit('eventReplayed', { event, state: currentState });
        } catch (error: unknown) {
          const eventIds = events.map((e: IEvent) => e.eventId);
          result.metadata.errors.push({
            error: error instanceof Error ? error.message : String(error)
          });
          this.emit('replayError', { event, error });
        }
      }

      result.finalState = currentState;
      result.replayTime = Date.now() - startTime;
      
      this.updateMetrics(result, result.replayTime);
      this.emit('replayCompleted', result);
      
      return result;
    } catch (error: any) {
      result.replayTime = Date.now() - startTime;
      result.metadata.errors.push({
        error: error instanceof Error ? error.message : String(error)
      });
      this.emit('error', error);
      throw error;
    }
  }

  async getStateAtTime(query: TemporalQuery): Promise<TemporalState> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Find the state at the specified time
      const events = await Event.find({
        aggregateId: query.aggregateId,
        aggregateType: query.aggregateType,
        createdAt: { $lte: query.atTimestamp }
      }).sort({ sequenceNumber: 1 });

      if (events.length === 0) {
        return {
          state: {},
          timestamp: query.atTimestamp,
          sequenceNumber: 0,
          eventsUsed: []
        };
      }

      // Use snapshots if available
      let currentState: Record<string, any> = {};
      let startSequence = 0;
      let snapshotUsed: ISnapshot | undefined;

      const snapshot = await Snapshot.findSnapshotAtSequence(
        query.aggregateId,
        events[events.length - 1].sequenceNumber
      );

      if (snapshot) {
        const restoreResult = await this.snapshotManager.restoreSnapshot({
          aggregateId: query.aggregateId,
          fromSnapshot: snapshot.snapshotId
        });
        
        currentState = restoreResult.data;
        startSequence = restoreResult.fromSequence + 1;
        snapshotUsed = snapshot;
      }

      // Replay events from the snapshot point
      const eventsToReplay = events.filter((e: IEvent) => e.sequenceNumber >= startSequence);
      
      for (const event of eventsToReplay) {
        currentState = await this.applyEvent(currentState, event);
      }

      const finalEvent = eventsToReplay[eventsToReplay.length - 1] || events[0];

      return {
        state: currentState,
        timestamp: query.atTimestamp,
        sequenceNumber: finalEvent.sequenceNumber,
        eventsUsed: query.includeEvents ? eventsToReplay : [],
        snapshotUsed
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getStateHistory(
    aggregateId: string,
    aggregateType: string,
    options: {
      fromTimestamp?: Date;
      toTimestamp?: Date;
      interval?: number; // in minutes
      maxPoints?: number;
    } = {}
  ): Promise<TemporalState[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const query: any = {
        aggregateId,
        aggregateType
      };

      if (options.fromTimestamp || options.toTimestamp) {
        query.createdAt = {};
        if (options.fromTimestamp) query.createdAt.$gte = options.fromTimestamp;
        if (options.toTimestamp) query.createdAt.$lte = options.toTimestamp;
      }

      const events = await Event.find(query).sort({ createdAt: 1 });
      const history: TemporalState[] = [];

      if (events.length === 0) {
        return history;
      }

      // Determine sample points
      const interval = options.interval || 60; // Default 1 hour
      const maxPoints = options.maxPoints || 100;
      const totalDuration = events[events.length - 1].createdAt.getTime() - events[0].createdAt.getTime();
      const sampleInterval = Math.max(interval * 60 * 1000, totalDuration / maxPoints);

      let currentState: Record<string, any> = {};
      let lastSampleTime = events[0].createdAt.getTime();

      for (const event of events) {
        currentState = await this.applyEvent(currentState, event);

        // Sample at intervals
        if (event.createdAt.getTime() - lastSampleTime >= sampleInterval) {
          history.push({
            state: { ...currentState },
            timestamp: event.createdAt,
            sequenceNumber: event.sequenceNumber,
            eventsUsed: [event]
          });
          lastSampleTime = event.createdAt.getTime();
        }
      }

      // Always include the final state
      const finalEvent = events[events.length - 1];
      history.push({
        state: { ...currentState },
        timestamp: finalEvent.createdAt,
        sequenceNumber: finalEvent.sequenceNumber,
        eventsUsed: [finalEvent]
      });

      return history;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async validateEventSequence(
    aggregateId: string,
    aggregateType: string
  ): Promise<{
    isValid: boolean;
    gaps: Array<{ from: number; to: number }>;
    duplicates: string[];
    totalEvents: number;
  }> {
    try {
      const events = await Event.findByAggregate(aggregateId);
      const gaps: Array<{ from: number; to: number }> = [];
      const duplicates: string[] = [];
      const eventIds = new Set<string>();

      let expectedSequence = 1;

      for (const event of events) {
        // Check for duplicates
        if (eventIds.has(event.eventId)) {
          duplicates.push(event.eventId);
        }
        eventIds.add(event.eventId);

        // Check for gaps
        if (event.sequenceNumber > expectedSequence) {
          gaps.push({
            from: expectedSequence,
            to: event.sequenceNumber - 1
          });
        }
        expectedSequence = event.sequenceNumber + 1;
      }

      return {
        isValid: gaps.length === 0 && duplicates.length === 0,
        gaps,
        duplicates,
        totalEvents: events.length
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async findBestSnapshot(
    aggregateId: string,
    fromSequence: number,
    toSequence?: number
  ): Promise<{ data: Record<string, any>; snapshot: ISnapshot; fromSequence: number } | null> {
    try {
      const targetSequence = toSequence || Number.MAX_SAFE_INTEGER;
      const snapshot = await Snapshot.findSnapshotAtSequence(aggregateId, targetSequence);

      if (!snapshot || snapshot.snapshotMetadata.sequenceNumber < fromSequence) {
        return null;
      }

      const restoreResult = await this.snapshotManager.restoreSnapshot({
        aggregateId,
        fromSnapshot: snapshot.snapshotId
      });

      return {
        data: restoreResult.data,
        snapshot: restoreResult.snapshot,
        fromSequence: restoreResult.fromSequence
      };
    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }

  private async getEventsForReplay(
    options: ReplayOptions,
    startSequence: number
  ): Promise<IEvent[]> {
    try {
      const query: any = {
        aggregateId: options.aggregateId,
        aggregateType: options.aggregateType,
        sequenceNumber: { $gte: startSequence }
      };

      if (options.toSequence && options.toSequence < Number.MAX_SAFE_INTEGER) {
        query.sequenceNumber.$lte = options.toSequence;
      }

      if (options.fromTimestamp || options.toTimestamp) {
        query.createdAt = {};
        if (options.fromTimestamp) query.createdAt.$gte = options.fromTimestamp;
        if (options.toTimestamp) query.createdAt.$lte = options.toTimestamp;
      }

      let dbQuery = Event.find(query).sort({ sequenceNumber: 1 });

      if (options.maxEvents) {
        dbQuery = dbQuery.limit(options.maxEvents);
      }

      if (options.batchSize) {
        dbQuery = dbQuery.limit(options.batchSize);
      }

      return await dbQuery.exec();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async applyEvent(
    currentState: Record<string, any>,
    event: IEvent
  ): Promise<Record<string, any>> {
    // This is a generic event application logic
    // In practice, this would be implemented based on specific aggregate types
    const newState = { ...currentState };

    try {
      switch (event.eventType) {
        case 'Created':
          return { ...event.eventData, _id: event.aggregateId };
        
        case 'Updated':
          return { ...newState, ...event.eventData };
        
        case 'Deleted':
          return { ...newState, deleted: true, deletedAt: event.createdAt };
        
        case 'StatusChanged':
          return { ...newState, status: event.eventData.status };
        
        default:
          // For unknown event types, merge the event data
          return { ...newState, ...event.eventData };
      }
    } catch (error) {
      this.emit('eventApplicationError', { event, error });
      throw error;
    }
  }

  private updateMetrics(result: ReplayResult, replayTime: number): void {
    this.metrics.totalReplays++;
    this.metrics.averageReplayTime = 
      (this.metrics.averageReplayTime * (this.metrics.totalReplays - 1) + replayTime) / 
      this.metrics.totalReplays;
    
    this.metrics.averageEventsPerReplay = 
      (this.metrics.averageEventsPerReplay * (this.metrics.totalReplays - 1) + result.eventsReplayed) / 
      this.metrics.totalReplays;

    if (result.metadata.errors.length > 0) {
      this.metrics.errorRate = 
        (this.metrics.errorRate * (this.metrics.totalReplays - 1) + 1) / 
        this.metrics.totalReplays;
    }
  }

  async getMetrics(): Promise<ReplayMetrics> {
    return { ...this.metrics };
  }

  async reset(): Promise<void> {
    this.metrics = {
      totalReplays: 0,
      averageReplayTime: 0,
      eventsProcessed: 0,
      snapshotsUsed: 0,
      errorRate: 0,
      averageEventsPerReplay: 0
    };
    this.emit('metricsReset');
  }

  async close(): Promise<void> {
    this.removeAllListeners();
    this.isInitialized = false;
    this.emit('closed');
  }
}

export default EventReplay;
