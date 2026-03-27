import { EventStore, EventStoreOptions } from '../../eventsourcing/EventStore';
import { EventStream, EventStreamOptions, EventStreamManager } from '../../eventsourcing/EventStream';
import { SnapshotManager, SnapshotOptions } from '../../eventsourcing/SnapshotManager';
import { EventReplay, ReplayOptions, TemporalQuery } from '../../eventsourcing/EventReplay';
import { Event, IEvent } from '../../models/Event';
import { Snapshot, ISnapshot } from '../../models/Snapshot';
import { EventEmitter } from 'events';

export interface EventSourcingServiceOptions {
  eventStore?: EventStoreOptions;
  snapshotManager?: SnapshotOptions;
  enableSnapshots?: boolean;
  enableEventStreams?: boolean;
  enableReplay?: boolean;
  autoSnapshotInterval?: number;
  maxEventRetention?: number; // in days
}

export interface AggregateState {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: Record<string, any>;
  lastUpdated: Date;
  eventCount: number;
}

export interface EventSourcingMetrics {
  eventStore: any;
  snapshotManager: any;
  eventReplay: any;
  totalAggregates: number;
  totalEvents: number;
  totalSnapshots: number;
  systemHealth: 'healthy' | 'degraded' | 'unhealthy';
}

export class EventSourcingService extends EventEmitter {
  private eventStore: EventStore;
  private snapshotManager: SnapshotManager;
  private eventReplay: EventReplay;
  private eventStreamManager: EventStreamManager;
  private options: Required<EventSourcingServiceOptions>;
  private aggregateStates: Map<string, AggregateState> = new Map();
  private isInitialized = false;

  constructor(options: EventSourcingServiceOptions = {}) {
    super();
    
    this.options = {
      eventStore: options.eventStore || {},
      snapshotManager: options.snapshotManager || {},
      enableSnapshots: options.enableSnapshots !== false,
      enableEventStreams: options.enableEventStreams !== false,
      enableReplay: options.enableReplay !== false,
      autoSnapshotInterval: options.autoSnapshotInterval || 100,
      maxEventRetention: options.maxEventRetention || 365
    };

    // Initialize components
    this.eventStore = new EventStore(this.options.eventStore);
    this.snapshotManager = new SnapshotManager(this.options.snapshotManager);
    this.eventReplay = new EventReplay(this.snapshotManager);
    this.eventStreamManager = new EventStreamManager();

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize all components
      await Promise.all([
        this.eventStore.initialize(),
        this.snapshotManager.initialize(),
        this.eventReplay.initialize()
      ]);

      // Start background tasks
      this.startBackgroundTasks();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async saveEvent(eventData: Partial<IEvent>): Promise<IEvent> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Validate event data
      this.validateEventData(eventData);

      // Save event
      const event = await this.eventStore.saveEvent(eventData);

      // Update aggregate state
      await this.updateAggregateState(event);

      // Check if snapshot should be created
      if (this.options.enableSnapshots) {
        await this.checkAndCreateSnapshot(event);
      }

      this.emit('eventSaved', event);
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

    try {
      // Validate all events
      eventsData.forEach(event => this.validateEventData(event));

      // Deduplicate events
      const deduplicatedEvents = await this.eventStore.deduplicateEvents(eventsData);

      // Save events
      const events = await this.eventStore.saveEvents(deduplicatedEvents);

      // Update aggregate states
      for (const event of events) {
        await this.updateAggregateState(event);
      }

      // Check if snapshot should be created for the last event
      if (this.options.enableSnapshots && events.length > 0) {
        const lastEvent = events[events.length - 1];
        await this.checkAndCreateSnapshot(lastEvent);
      }

      this.emit('eventsSaved', events);
      return events;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getAggregateState(
    aggregateId: string,
    aggregateType: string,
    atSequence?: number
  ): Promise<AggregateState> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Check cache first
      const cacheKey = `${aggregateType}:${aggregateId}`;
      if (!atSequence && this.aggregateStates.has(cacheKey)) {
        return this.aggregateStates.get(cacheKey)!;
      }

      // Replay events to get current state
      const replayOptions: ReplayOptions = {
        aggregateId,
        aggregateType,
        useSnapshots: this.options.enableSnapshots,
        toSequence: atSequence
      };

      const replayResult = await this.eventReplay.replayEvents(replayOptions);

      const state: AggregateState = {
        aggregateId,
        aggregateType,
        version: replayResult.toSequence,
        state: replayResult.finalState,
        lastUpdated: new Date(),
        eventCount: replayResult.eventsReplayed
      };

      // Cache the state if it's the current state
      if (!atSequence) {
        this.aggregateStates.set(cacheKey, state);
      }

      return state;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getStateAtTime(query: TemporalQuery): Promise<AggregateState> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const temporalState = await this.eventReplay.getStateAtTime(query);

      return {
        aggregateId: query.aggregateId,
        aggregateType: query.aggregateType,
        version: temporalState.sequenceNumber,
        state: temporalState.state,
        lastUpdated: temporalState.timestamp,
        eventCount: temporalState.eventsUsed.length
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getEventStream(options: EventStreamOptions): Promise<EventStream> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.options.enableEventStreams) {
      throw new Error('Event streams are disabled');
    }

    try {
      const stream = this.eventStreamManager.createStream(options);
      await stream.initialize();
      return stream;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async createSnapshot(
    aggregateId: string,
    aggregateType: string,
    force: boolean = false
  ): Promise<ISnapshot> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.options.enableSnapshots) {
      throw new Error('Snapshots are disabled');
    }

    try {
      // Get current state
      const currentState = await this.getAggregateState(aggregateId, aggregateType);

      // Check if snapshot should be created
      if (!force) {
        const shouldCreate = await this.snapshotManager.shouldCreateSnapshot(
          aggregateId,
          currentState.version
        );
        
        if (!shouldCreate) {
          throw new Error('Snapshot creation not needed at this time');
        }
      }

      // Create snapshot
      const snapshot = await this.snapshotManager.createSnapshot({
        aggregateId,
        aggregateType,
        data: currentState.state,
        sequenceNumber: currentState.version,
        tags: ['auto-generated']
      });

      this.emit('snapshotCreated', snapshot);
      return snapshot;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getEvents(
    aggregateId: string,
    aggregateType: string,
    options: {
      fromSequence?: number;
      toSequence?: number;
      limit?: number;
    } = {}
  ): Promise<IEvent[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return await this.eventStore.getEvents(aggregateId, options);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getSnapshots(
    aggregateId: string,
    options: {
      activeOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<ISnapshot[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.options.enableSnapshots) {
      return [];
    }

    try {
      return await this.snapshotManager.getSnapshots(aggregateId, options);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async validateAggregate(
    aggregateId: string,
    aggregateType: string
  ): Promise<{
    isValid: boolean;
    issues: string[];
    eventValidation: any;
    stateValidation: any;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const issues: string[] = [];

      // Validate event sequence
      const eventValidation = await this.eventReplay.validateEventSequence(
        aggregateId,
        aggregateType
      );

      if (!eventValidation.isValid) {
        issues.push(`Event sequence issues: ${eventValidation.gaps.length} gaps, ${eventValidation.duplicates.length} duplicates`);
      }

      // Validate state consistency
      const stateValidation = await this.validateStateConsistency(
        aggregateId,
        aggregateType
      );

      if (!stateValidation.isValid) {
        issues.push(...stateValidation.issues);
      }

      return {
        isValid: issues.length === 0,
        issues,
        eventValidation,
        stateValidation
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getMetrics(): Promise<EventSourcingMetrics> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const [eventStoreMetrics, snapshotManagerMetrics, eventReplayMetrics] = await Promise.all([
        this.eventStore.getMetrics(),
        this.snapshotManager.getMetrics(),
        this.eventReplay.getMetrics()
      ]);

      const totalEvents = eventStoreMetrics.totalEvents;
      const totalSnapshots = snapshotManagerMetrics.totalSnapshots;
      const totalAggregates = this.aggregateStates.size;

      // Determine system health
      let systemHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (eventStoreMetrics.errorRate > 0.05) {
        systemHealth = 'unhealthy';
      } else if (eventStoreMetrics.errorRate > 0.01 || snapshotManagerMetrics.restoreSuccessRate < 0.95) {
        systemHealth = 'degraded';
      }

      return {
        eventStore: eventStoreMetrics,
        snapshotManager: snapshotManagerMetrics,
        eventReplay: eventReplayMetrics,
        totalAggregates,
        totalEvents,
        totalSnapshots,
        systemHealth
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Cleanup expired events
      if (this.options.maxEventRetention) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.options.maxEventRetention);
        
        // This would need to be implemented based on specific retention policies
        this.emit('cleanupStarted', { cutoffDate });
      }

      // Cleanup expired snapshots
      if (this.options.enableSnapshots) {
        await this.snapshotManager.cleanupExpiredSnapshots();
      }

      this.emit('cleanupCompleted');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async updateAggregateState(event: IEvent): Promise<void> {
    const cacheKey = `${event.aggregateType}:${event.aggregateId}`;
    
    let currentState = this.aggregateStates.get(cacheKey);
    
    if (!currentState) {
      // Initialize state if not exists
      currentState = {
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        version: 0,
        state: {},
        lastUpdated: new Date(),
        eventCount: 0
      };
    }

    // Apply event to state
    currentState.state = await this.eventReplay['applyEvent'](currentState.state, event);
    currentState.version = event.sequenceNumber;
    currentState.lastUpdated = event.createdAt;
    currentState.eventCount++;

    // Update cache
    this.aggregateStates.set(cacheKey, currentState);
  }

  private async checkAndCreateSnapshot(event: IEvent): Promise<void> {
    try {
      const shouldCreate = await this.snapshotManager.shouldCreateSnapshot(
        event.aggregateId,
        event.sequenceNumber
      );

      if (shouldCreate) {
        const currentState = this.aggregateStates.get(`${event.aggregateType}:${event.aggregateId}`);
        
        if (currentState) {
          await this.snapshotManager.createSnapshot({
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            data: currentState.state,
            sequenceNumber: event.sequenceNumber,
            tags: ['auto-generated']
          });
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async validateStateConsistency(
    aggregateId: string,
    aggregateType: string
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Get current state from cache
      const cachedState = this.aggregateStates.get(`${aggregateType}:${aggregateId}`);
      
      if (!cachedState) {
        issues.push('No cached state found');
        return { isValid: false, issues };
      }

      // Replay events to get actual state
      const actualState = await this.getAggregateState(aggregateId, aggregateType);

      // Compare versions
      if (cachedState.version !== actualState.version) {
        issues.push(`Version mismatch: cached=${cachedState.version}, actual=${actualState.version}`);
      }

      // Compare event counts
      if (cachedState.eventCount !== actualState.eventCount) {
        issues.push(`Event count mismatch: cached=${cachedState.eventCount}, actual=${actualState.eventCount}`);
      }

      return { isValid: issues.length === 0, issues };
    } catch (error) {
      issues.push(`State validation error: ${error}`);
      return { isValid: false, issues };
    }
  }

  private validateEventData(eventData: Partial<IEvent>): void {
    if (!eventData.aggregateId) {
      throw new Error('Aggregate ID is required');
    }
    
    if (!eventData.aggregateType) {
      throw new Error('Aggregate type is required');
    }
    
    if (!eventData.eventType) {
      throw new Error('Event type is required');
    }
    
    if (!eventData.eventData) {
      throw new Error('Event data is required');
    }
  }

  private setupEventHandlers(): void {
    // Handle event store events
    this.eventStore.on('snapshotRequested', async (data) => {
      if (this.options.enableSnapshots) {
        try {
          await this.createSnapshot(data.aggregateId, data.aggregateType);
        } catch (error) {
          this.emit('error', error);
        }
      }
    });

    // Handle snapshot manager events
    this.snapshotManager.on('snapshotCreated', (snapshot) => {
      this.emit('snapshotCreated', snapshot);
    });

    // Handle event replay events
    this.eventReplay.on('replayCompleted', (result) => {
      this.emit('replayCompleted', result);
    });
  }

  private startBackgroundTasks(): void {
    // Start cleanup task (run daily)
    setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        this.emit('error', error);
      }
    }, 24 * 60 * 60 * 1000);

    // Start metrics collection (run hourly)
    setInterval(async () => {
      try {
        const metrics = await this.getMetrics();
        this.emit('metrics', metrics);
      } catch (error) {
        this.emit('error', error);
      }
    }, 60 * 60 * 1000);
  }

  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      await Promise.all([
        this.eventStore.close(),
        this.snapshotManager.close(),
        this.eventReplay.close(),
        this.eventStreamManager.destroyAllStreams()
      ]);

      this.aggregateStates.clear();
      this.removeAllListeners();
      this.isInitialized = false;
      this.emit('closed');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
}

export default EventSourcingService;
