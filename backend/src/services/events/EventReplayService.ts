import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisService } from '../redisService';
import { MonitoringService } from '../monitoringService';
import { ContractEvent, IContractEvent } from '../../models/ContractEvent';
import { ContractEventService } from './ContractEventService';
import { EventEmitter } from 'events';

export interface ReplayConfig {
  id: string;
  startBlock: number;
  endBlock: number;
  eventTypes?: string[];
  addresses?: string[];
  topics?: string[];
  filters?: Record<string, any>;
  batchSize: number;
  concurrency: number;
  enableNotifications: boolean;
  notificationWebhook?: string;
  dryRun: boolean;
}

export interface ReplaySession {
  id: string;
  config: ReplayConfig;
  status: ReplayStatus;
  progress: number;
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  startTime: Date;
  endTime?: Date;
  currentBlock?: number;
  errors: string[];
  metrics: ReplayMetrics;
}

export enum ReplayStatus {
  PENDING = 'Pending',
  RUNNING = 'Running',
  PAUSED = 'Paused',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
  CANCELLED = 'Cancelled',
}

export interface ReplayMetrics {
  eventsPerSecond: number;
  averageProcessingTime: number;
  totalProcessingTime: number;
  gasUsageStats: {
    total: number;
    average: number;
    min: number;
    max: number;
  };
  eventTypeDistribution: Record<string, number>;
  errorRate: number;
}

export interface ReplaySnapshot {
  sessionId: string;
  timestamp: Date;
  blockNumber: number;
  eventData: IContractEvent[];
  metadata: Record<string, any>;
}

@Injectable()
export class EventReplayService extends EventEmitter implements OnModuleInit {
  private readonly logger = new Logger(EventReplayService.name);
  private activeSessions: Map<string, ReplaySession> = new Map();
  private sessionHistory: Map<string, ReplaySession> = new Map();
  private snapshots: Map<string, ReplaySnapshot[]> = new Map();
  private processingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @InjectModel('ContractEvent') private eventModel: Model<IContractEvent>,
    private redisService: RedisService,
    private monitoringService: MonitoringService,
    private eventService: ContractEventService,
  ) {
    super();
  }

  async onModuleInit() {
    this.logger.log('Initializing Event Replay Service');
    
    // Load existing sessions from cache
    await this.loadSessionsFromCache();
    
    // Resume any interrupted sessions
    await this.resumeInterruptedSessions();
    
    this.logger.log('Event Replay Service initialized successfully');
  }

  /**
   * Create a new replay session
   */
  async createReplaySession(config: ReplayConfig): Promise<ReplaySession> {
    try {
      // Validate configuration
      this.validateReplayConfig(config);
      
      // Calculate total events to process
      const totalEvents = await this.calculateTotalEvents(config);
      
      const session: ReplaySession = {
        id: config.id,
        config,
        status: ReplayStatus.PENDING,
        progress: 0,
        totalEvents,
        processedEvents: 0,
        failedEvents: 0,
        startTime: new Date(),
        currentBlock: config.startBlock,
        errors: [],
        metrics: this.initializeMetrics(),
      };
      
      // Store session
      this.activeSessions.set(config.id, session);
      await this.saveSessionToCache(session);
      
      this.logger.log(`Created replay session: ${config.id}`);
      this.emit('sessionCreated', session);
      
      return session;
      
    } catch (error) {
      this.logger.error(`Failed to create replay session:`, error);
      throw error;
    }
  }

  /**
   * Start a replay session
   */
  async startReplay(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Replay session not found: ${sessionId}`);
    }
    
    if (session.status !== ReplayStatus.PENDING && session.status !== ReplayStatus.PAUSED) {
      throw new Error(`Cannot start session in status: ${session.status}`);
    }
    
    try {
      session.status = ReplayStatus.RUNNING;
      session.startTime = new Date();
      
      // Start processing
      await this.processReplaySession(session);
      
      this.logger.log(`Started replay session: ${sessionId}`);
      this.emit('sessionStarted', session);
      
    } catch (error) {
      session.status = ReplayStatus.FAILED;
      session.errors.push(error.message);
      this.logger.error(`Failed to start replay session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Pause a replay session
   */
  async pauseReplay(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Replay session not found: ${sessionId}`);
    }
    
    if (session.status !== ReplayStatus.RUNNING) {
      throw new Error(`Cannot pause session in status: ${session.status}`);
    }
    
    // Clear processing interval
    const interval = this.processingIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.processingIntervals.delete(sessionId);
    }
    
    session.status = ReplayStatus.PAUSED;
    await this.saveSessionToCache(session);
    
    this.logger.log(`Paused replay session: ${sessionId}`);
    this.emit('sessionPaused', session);
  }

  /**
   * Resume a paused replay session
   */
  async resumeReplay(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Replay session not found: ${sessionId}`);
    }
    
    if (session.status !== ReplayStatus.PAUSED) {
      throw new Error(`Cannot resume session in status: ${session.status}`);
    }
    
    session.status = ReplayStatus.RUNNING;
    await this.processReplaySession(session);
    
    this.logger.log(`Resumed replay session: ${sessionId}`);
    this.emit('sessionResumed', session);
  }

  /**
   * Cancel a replay session
   */
  async cancelReplay(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Replay session not found: ${sessionId}`);
    }
    
    // Clear processing interval
    const interval = this.processingIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.processingIntervals.delete(sessionId);
    }
    
    session.status = ReplayStatus.CANCELLED;
    session.endTime = new Date();
    
    // Move to history
    this.sessionHistory.set(sessionId, session);
    this.activeSessions.delete(sessionId);
    
    await this.saveSessionToCache(session);
    
    this.logger.log(`Cancelled replay session: ${sessionId}`);
    this.emit('sessionCancelled', session);
  }

  /**
   * Get replay session status
   */
  getSession(sessionId: string): ReplaySession | undefined {
    return this.activeSessions.get(sessionId) || this.sessionHistory.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ReplaySession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get session history
   */
  getSessionHistory(): ReplaySession[] {
    return Array.from(this.sessionHistory.values());
  }

  /**
   * Create a replay snapshot at current state
   */
  async createSnapshot(sessionId: string, metadata: Record<string, any> = {}): Promise<ReplaySnapshot> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Replay session not found: ${sessionId}`);
    }
    
    // Get current block events
    const currentBlock = session.currentBlock || session.config.startBlock;
    const eventData = await this.getEventsForBlock(currentBlock, session.config);
    
    const snapshot: ReplaySnapshot = {
      sessionId,
      timestamp: new Date(),
      blockNumber: currentBlock,
      eventData,
      metadata,
    };
    
    // Store snapshot
    if (!this.snapshots.has(sessionId)) {
      this.snapshots.set(sessionId, []);
    }
    this.snapshots.get(sessionId)!.push(snapshot);
    
    // Save to cache
    await this.saveSnapshotToCache(snapshot);
    
    this.logger.log(`Created snapshot for session ${sessionId} at block ${currentBlock}`);
    
    return snapshot;
  }

  /**
   * Restore from a snapshot
   */
  async restoreFromSnapshot(sessionId: string, blockNumber: number): Promise<void> {
    const snapshots = this.snapshots.get(sessionId) || [];
    const snapshot = snapshots.find(s => s.blockNumber === blockNumber);
    
    if (!snapshot) {
      throw new Error(`Snapshot not found for session ${sessionId} at block ${blockNumber}`);
    }
    
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Replay session not found: ${sessionId}`);
    }
    
    // Restore session state
    session.currentBlock = blockNumber;
    session.processedEvents = 0;
    session.failedEvents = 0;
    session.progress = 0;
    
    // Replay events from snapshot
    for (const event of snapshot.eventData) {
      try {
        await this.eventService.processEvent(event);
        session.processedEvents++;
      } catch (error) {
        session.failedEvents++;
        session.errors.push(`Failed to replay event ${event.eventId}: ${error.message}`);
      }
    }
    
    await this.saveSessionToCache(session);
    
    this.logger.log(`Restored session ${sessionId} from snapshot at block ${blockNumber}`);
    this.emit('sessionRestored', { session, snapshot });
  }

  /**
   * Process a replay session
   */
  private async processReplaySession(session: ReplaySession): Promise<void> {
    const interval = setInterval(async () => {
      try {
        if (session.status !== ReplayStatus.RUNNING) {
          clearInterval(interval);
          return;
        }
        
        // Process batch of events
        await this.processEventBatch(session);
        
        // Update progress
        session.progress = (session.processedEvents / session.totalEvents) * 100;
        
        // Update metrics
        this.updateSessionMetrics(session);
        
        // Check if completed
        if (session.currentBlock! >= session.config.endBlock) {
          await this.completeSession(session);
          clearInterval(interval);
          return;
        }
        
        // Save session state
        await this.saveSessionToCache(session);
        
        // Emit progress update
        this.emit('sessionProgress', session);
        
      } catch (error) {
        this.logger.error(`Error processing replay session ${session.id}:`, error);
        session.errors.push(error.message);
        
        if (session.errors.length > 10) {
          session.status = ReplayStatus.FAILED;
          clearInterval(interval);
          await this.completeSession(session);
        }
      }
    }, 1000); // Process every second
    
    this.processingIntervals.set(session.id, interval);
  }

  /**
   * Process a batch of events
   */
  private async processEventBatch(session: ReplaySession): Promise<void> {
    const currentBlock = session.currentBlock || session.config.startBlock;
    const events = await this.getEventsForBlock(currentBlock, session.config);
    
    if (events.length === 0) {
      session.currentBlock = currentBlock + 1;
      return;
    }
    
    const batchSize = Math.min(session.config.batchSize, events.length);
    const batch = events.slice(0, batchSize);
    
    for (const event of batch) {
      try {
        if (!session.config.dryRun) {
          await this.eventService.processEvent(event);
        }
        session.processedEvents++;
      } catch (error) {
        session.failedEvents++;
        session.errors.push(`Failed to process event ${event.eventId}: ${error.message}`);
      }
    }
    
    session.currentBlock = currentBlock + 1;
  }

  /**
   * Get events for a specific block
   */
  private async getEventsForBlock(blockNumber: number, config: ReplayConfig): Promise<IContractEvent[]> {
    const query: any = { blockNumber };
    
    if (config.eventTypes && config.eventTypes.length > 0) {
      query.eventType = { $in: config.eventTypes };
    }
    
    if (config.addresses && config.addresses.length > 0) {
      query.emitter = { $in: config.addresses };
    }
    
    if (config.topics && config.topics.length > 0) {
      query.topics = { $in: config.topics };
    }
    
    // Apply custom filters
    if (config.filters) {
      for (const [key, value] of Object.entries(config.filters)) {
        query[`data.${key}`] = value;
      }
    }
    
    return this.eventModel.find(query).sort({ logIndex: 1 }).exec();
  }

  /**
   * Calculate total events to process
   */
  private async calculateTotalEvents(config: ReplayConfig): Promise<number> {
    const query: any = {
      blockNumber: { $gte: config.startBlock, $lte: config.endBlock }
    };
    
    if (config.eventTypes && config.eventTypes.length > 0) {
      query.eventType = { $in: config.eventTypes };
    }
    
    if (config.addresses && config.addresses.length > 0) {
      query.emitter = { $in: config.addresses };
    }
    
    if (config.topics && config.topics.length > 0) {
      query.topics = { $in: config.topics };
    }
    
    return this.eventModel.countDocuments(query);
  }

  /**
   * Complete a replay session
   */
  private async completeSession(session: ReplaySession): Promise<void> {
    session.status = ReplayStatus.COMPLETED;
    session.endTime = new Date();
    session.progress = 100;
    
    // Move to history
    this.sessionHistory.set(session.id, session);
    this.activeSessions.delete(session.id);
    
    // Clear processing interval
    const interval = this.processingIntervals.get(session.id);
    if (interval) {
      clearInterval(interval);
      this.processingIntervals.delete(session.id);
    }
    
    await this.saveSessionToCache(session);
    
    this.logger.log(`Completed replay session: ${session.id}`);
    this.emit('sessionCompleted', session);
    
    // Send notification if configured
    if (session.config.enableNotifications && session.config.notificationWebhook) {
      await this.sendCompletionNotification(session);
    }
  }

  /**
   * Update session metrics
   */
  private updateSessionMetrics(session: ReplaySession): void {
    const elapsed = Date.now() - session.startTime.getTime();
    session.metrics.eventsPerSecond = session.processedEvents / (elapsed / 1000);
    session.metrics.totalProcessingTime = elapsed;
    session.metrics.averageProcessingTime = elapsed / session.processedEvents;
    session.metrics.errorRate = session.failedEvents / (session.processedEvents + session.failedEvents);
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): ReplayMetrics {
    return {
      eventsPerSecond: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      gasUsageStats: {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
      },
      eventTypeDistribution: {},
      errorRate: 0,
    };
  }

  /**
   * Validate replay configuration
   */
  private validateReplayConfig(config: ReplayConfig): void {
    if (config.startBlock >= config.endBlock) {
      throw new Error('Start block must be less than end block');
    }
    
    if (config.batchSize <= 0 || config.batchSize > 1000) {
      throw new Error('Batch size must be between 1 and 1000');
    }
    
    if (config.concurrency <= 0 || config.concurrency > 10) {
      throw new Error('Concurrency must be between 1 and 10');
    }
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(session: ReplaySession): Promise<void> {
    try {
      const payload = {
        sessionId: session.id,
        status: session.status,
        progress: session.progress,
        processedEvents: session.processedEvents,
        failedEvents: session.failedEvents,
        metrics: session.metrics,
        timestamp: new Date(),
      };
      
      await fetch(session.config.notificationWebhook!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      this.logger.log(`Sent completion notification for session: ${session.id}`);
      
    } catch (error) {
      this.logger.error(`Failed to send notification for session ${session.id}:`, error);
    }
  }

  /**
   * Save session to cache
   */
  private async saveSessionToCache(session: ReplaySession): Promise<void> {
    try {
      await this.redisService.set(
        `replay_session:${session.id}`,
        JSON.stringify(session),
        24 * 60 * 60 // 24 hours TTL
      );
    } catch (error) {
      this.logger.error(`Failed to save session to cache:`, error);
    }
  }

  /**
   * Save snapshot to cache
   */
  private async saveSnapshotToCache(snapshot: ReplaySnapshot): Promise<void> {
    try {
      await this.redisService.set(
        `replay_snapshot:${snapshot.sessionId}:${snapshot.blockNumber}`,
        JSON.stringify(snapshot),
        7 * 24 * 60 * 60 // 7 days TTL
      );
    } catch (error) {
      this.logger.error(`Failed to save snapshot to cache:`, error);
    }
  }

  /**
   * Load sessions from cache
   */
  private async loadSessionsFromCache(): Promise<void> {
    try {
      const keys = await this.redisService.keys('replay_session:*');
      
      for (const key of keys) {
        const cached = await this.redisService.get(key);
        if (cached) {
          const session = JSON.parse(cached) as ReplaySession;
          
          if (session.status === ReplayStatus.RUNNING || session.status === ReplayStatus.PAUSED) {
            this.activeSessions.set(session.id, session);
          } else {
            this.sessionHistory.set(session.id, session);
          }
        }
      }
      
      this.logger.log(`Loaded ${keys.length} sessions from cache`);
      
    } catch (error) {
      this.logger.error('Failed to load sessions from cache:', error);
    }
  }

  /**
   * Resume interrupted sessions
   */
  private async resumeInterruptedSessions(): Promise<void> {
    for (const session of this.activeSessions.values()) {
      if (session.status === ReplayStatus.RUNNING) {
        this.logger.warn(`Resuming interrupted session: ${session.id}`);
        await this.resumeReplay(session.id);
      }
    }
  }
}
