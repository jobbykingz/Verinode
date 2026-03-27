import { Event, IEvent } from '../models/Event';
import { Snapshot, ISnapshot } from '../models/Snapshot';
import { EventEmitter } from 'events';
import { Readable, Transform, Writable } from 'stream';

export interface EventStreamOptions {
  aggregateId: string;
  aggregateType: string;
  fromVersion?: number;
  toVersion?: number;
  liveMode?: boolean;
  batchSize?: number;
  includeSnapshots?: boolean;
}

export interface StreamPosition {
  sequenceNumber: number;
  timestamp: Date;
  eventId?: string;
}

export interface EventStreamStats {
  totalEvents: number;
  totalSnapshots: number;
  currentPosition: StreamPosition;
  streamLength: number;
  eventsPerSecond: number;
  averageLatency: number;
}

export class EventStream extends EventEmitter {
  private options: Required<EventStreamOptions>;
  private currentPosition: StreamPosition;
  private isStreaming = false;
  private stream: Readable | null = null;
  private stats: EventStreamStats;
  private eventBuffer: IEvent[] = [];
  private snapshotBuffer: ISnapshot[] = [];

  constructor(options: EventStreamOptions) {
    super();
    
    this.options = {
      aggregateId: options.aggregateId,
      aggregateType: options.aggregateType,
      fromVersion: options.fromVersion || 0,
      toVersion: options.toVersion || Number.MAX_SAFE_INTEGER,
      liveMode: options.liveMode || false,
      batchSize: options.batchSize || 100,
      includeSnapshots: options.includeSnapshots !== false
    };

    this.currentPosition = {
      sequenceNumber: this.options.fromVersion,
      timestamp: new Date()
    };

    this.stats = {
      totalEvents: 0,
      totalSnapshots: 0,
      currentPosition: this.currentPosition,
      streamLength: 0,
      eventsPerSecond: 0,
      averageLatency: 0
    };
  }

  async initialize(): Promise<void> {
    try {
      // Get initial stream position
      const lastEvent = await Event.getLastEvent(this.options.aggregateId);
      if (lastEvent) {
        this.stats.streamLength = lastEvent.sequenceNumber;
        if (this.options.toVersion === Number.MAX_SAFE_INTEGER) {
          this.options.toVersion = lastEvent.sequenceNumber;
        }
      }

      // Load initial events if not in live mode
      if (!this.options.liveMode) {
        await this.loadInitialEvents();
      }

      this.emit('initialized', this.currentPosition);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  private async loadInitialEvents(): Promise<void> {
    try {
      const events = await Event.findByAggregate(
        this.options.aggregateId,
        {
          fromSequence: this.options.fromVersion,
          toSequence: this.options.toVersion,
          limit: this.options.batchSize
        }
      );

      this.eventBuffer = events;
      this.stats.totalEvents = events.length;

      if (this.options.includeSnapshots) {
        await this.loadRelevantSnapshots();
      }

      this.emit('eventsLoaded', events.length);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  private async loadRelevantSnapshots(): Promise<void> {
    try {
      const snapshots = await Snapshot.findByAggregate(
        this.options.aggregateId,
        { activeOnly: true }
      );

      this.snapshotBuffer = snapshots.filter((snapshot: ISnapshot) => 
        snapshot.snapshotMetadata.sequenceNumber >= this.options.fromVersion &&
        snapshot.snapshotMetadata.sequenceNumber <= this.options.toVersion
      );

      this.stats.totalSnapshots = this.snapshotBuffer.length;
      this.emit('snapshotsLoaded', this.snapshotBuffer.length);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isStreaming) {
      throw new Error('Stream is already running');
    }

    this.isStreaming = true;
    this.emit('started');

    try {
      if (this.options.liveMode) {
        await this.startLiveStream();
      } else {
        await this.startReplayStream();
      }
    } catch (error) {
      this.isStreaming = false;
      this.emit('error', error);
      throw error;
    }
  }

  private async startLiveStream(): Promise<void> {
    // Start from current position
    this.currentPosition.sequenceNumber = this.options.fromVersion;

    // Set up change stream listener
    const changeStream = Event.watch([
      {
        $match: {
          'fullDocument.aggregateId': this.options.aggregateId,
          'fullDocument.aggregateType': this.options.aggregateType,
          'fullDocument.sequenceNumber': { $gt: this.currentPosition.sequenceNumber }
        }
      }
    ]);

    changeStream.on('change', async (change: any) => {
      if (change.fullDocument) {
        const event = change.fullDocument as IEvent;
        await this.processEvent(event);
      }
    });

    changeStream.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.emit('liveStreamStarted');
  }

  private async startReplayStream(): Promise<void> {
    this.stream = new Readable({
      objectMode: true,
      read() {}
    });

    // Process buffered events first
    for (const event of this.eventBuffer) {
      if (event.sequenceNumber > this.options.toVersion) break;
      await this.processEvent(event);
    }

    // Clear buffer after processing
    this.eventBuffer = [];

    // Mark stream as complete
    this.stream.push(null);
    this.emit('replayCompleted');
  }

  private async processEvent(event: IEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Update current position
      this.currentPosition = {
        sequenceNumber: event.sequenceNumber,
        timestamp: event.createdAt,
        eventId: event.eventId
      };

      // Update stats
      this.stats.totalEvents++;
      this.updateLatency(startTime);

      // Emit event
      this.emit('event', event);
      this.emit('data', event);

      // Push to stream if available
      if (this.stream && !this.stream.destroyed) {
        this.stream.push(event);
      }

      // Check if we've reached the target version
      if (event.sequenceNumber >= this.options.toVersion) {
        await this.stop();
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  async pause(): Promise<void> {
    if (!this.isStreaming) {
      throw new Error('Stream is not running');
    }

    this.isStreaming = false;
    this.emit('paused');
  }

  async resume(): Promise<void> {
    if (this.isStreaming) {
      throw new Error('Stream is already running');
    }

    this.isStreaming = true;
    this.emit('resumed');

    if (this.options.liveMode) {
      await this.startLiveStream();
    }
  }

  async stop(): Promise<void> {
    if (!this.isStreaming) {
      return;
    }

    this.isStreaming = false;

    if (this.stream && !this.stream.destroyed) {
      this.stream.push(null);
      this.stream.destroy();
    }

    this.emit('stopped', this.currentPosition);
  }

  async seekToPosition(position: StreamPosition): Promise<void> {
    if (this.isStreaming) {
      await this.stop();
    }

    this.currentPosition = position;
    this.options.fromVersion = position.sequenceNumber;

    // Reload events from new position
    await this.loadInitialEvents();
    this.emit('positionChanged', position);
  }

  async seekToVersion(version: number): Promise<void> {
    const position: StreamPosition = {
      sequenceNumber: version,
      timestamp: new Date()
    };

    await this.seekToPosition(position);
  }

  async seekToTimestamp(timestamp: Date): Promise<void> {
    try {
      const event = await Event.findOne({
        aggregateId: this.options.aggregateId,
        createdAt: { $lte: timestamp }
      }).sort({ createdAt: -1 });

      if (event) {
        const position: StreamPosition = {
          sequenceNumber: event.sequenceNumber,
          timestamp: event.createdAt,
          eventId: event.eventId
        };
        await this.seekToPosition(position);
      } else {
        throw new Error(`No events found before timestamp: ${timestamp}`);
      }
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  getSnapshotAtPosition(sequenceNumber: number): ISnapshot | null {
    return this.snapshotBuffer
      .filter(snapshot => snapshot.snapshotMetadata.sequenceNumber <= sequenceNumber)
      .sort((a: ISnapshot, b: ISnapshot) => b.snapshotMetadata.sequenceNumber - a.snapshotMetadata.sequenceNumber)[0] || null;
  }

  getEventsFromPosition(position: StreamPosition): IEvent[] {
    return this.eventBuffer.filter(event => 
      event.sequenceNumber >= position.sequenceNumber
    );
  }

  createTransformStream<T>(
    transformFn: (event: IEvent) => T | Promise<T>
  ): Transform {
    return new Transform({
      objectMode: true,
      transform: async (event: IEvent, encoding, callback) => {
        try {
          const result = await transformFn(event);
          callback(null, result);
        } catch (error) {
          callback(error as Error);
        }
      }
    });
  }

  createFilterStream(
    filterFn: (event: IEvent) => boolean
  ): Transform {
    return new Transform({
      objectMode: true,
      transform: (event: IEvent, encoding, callback) => {
        if (filterFn(event)) {
          callback(null, event);
        } else {
          callback();
        }
      }
    });
  }

  createWritableStream(
    writeFn: (event: IEvent) => Promise<void>
  ): Writable {
    return new Writable({
      objectMode: true,
      write: async (event: IEvent, encoding, callback) => {
        try {
          await writeFn(event);
          callback();
        } catch (error) {
          callback(error as Error);
        }
      }
    });
  }

  pipe<T>(transform: Transform): EventStream {
    if (this.stream) {
      this.stream.pipe(transform);
    }
    return this;
  }

  async getStats(): Promise<EventStreamStats> {
    // Calculate events per second
    const timeWindow = 60 * 1000; // 1 minute
    const recentEvents = this.eventBuffer.filter(event =>
      Date.now() - event.createdAt.getTime() <= timeWindow
    );
    this.stats.eventsPerSecond = recentEvents.length / 60;

    return { ...this.stats };
  }

  private updateLatency(startTime: number): void {
    const latency = Date.now() - startTime;
    this.stats.averageLatency = 
      (this.stats.averageLatency * (this.stats.totalEvents - 1) + latency) / 
      this.stats.totalEvents;
  }

  getCurrentPosition(): StreamPosition {
    return { ...this.currentPosition };
  }

  getOptions(): Required<EventStreamOptions> {
    return { ...this.options };
  }

  isActive(): boolean {
    return this.isStreaming;
  }

  getEventCount(): number {
    return this.stats.totalEvents;
  }

  getSnapshotCount(): number {
    return this.stats.totalSnapshots;
  }

  async destroy(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
    this.eventBuffer = [];
    this.snapshotBuffer = [];
    this.emit('destroyed');
  }
}

export class EventStreamManager {
  private streams: Map<string, EventStream> = new Map();

  createStream(options: EventStreamOptions): EventStream {
    const streamKey = `${options.aggregateType}:${options.aggregateId}`;
    
    if (this.streams.has(streamKey)) {
      throw new Error(`Stream already exists for ${streamKey}`);
    }

    const stream = new EventStream(options);
    this.streams.set(streamKey, stream);

    stream.on('destroyed', () => {
      this.streams.delete(streamKey);
    });

    return stream;
  }

  getStream(aggregateType: string, aggregateId: string): EventStream | undefined {
    const streamKey = `${aggregateType}:${aggregateId}`;
    return this.streams.get(streamKey);
  }

  getAllStreams(): EventStream[] {
    return Array.from(this.streams.values());
  }

  async destroyAllStreams(): Promise<void> {
    const destroyPromises = Array.from(this.streams.values()).map(stream => 
      stream.destroy()
    );
    
    await Promise.all(destroyPromises);
    this.streams.clear();
  }

  getStreamCount(): number {
    return this.streams.size;
  }
}

export default EventStream;
