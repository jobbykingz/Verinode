import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisService } from '../redisService';
import { MonitoringService } from '../monitoringService';
import { ContractEvent, IContractEvent } from '../../models/ContractEvent';
import { EventIndexer } from './EventIndexer';
import { EventEmitter } from 'events';

export interface EventProcessingConfig {
  maxConcurrency: number;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  processingTimeout: number;
  enableRealTime: boolean;
  enableBatching: boolean;
}

export interface EventMetrics {
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  averageProcessingTime: number;
  eventsPerSecond: number;
  lastProcessedAt: Date;
}

export interface EventSubscription {
  id: string;
  address: string;
  eventTypes: string[];
  filters: Record<string, any>;
  webhookUrl?: string;
  isActive: boolean;
  createdAt: Date;
  lastProcessedAt?: Date;
}

export interface EventStream {
  id: string;
  clientId: string;
  filters: Record<string, any>;
  isActive: boolean;
  connectedAt: Date;
  lastActivityAt: Date;
}

@Injectable()
export class ContractEventService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContractEventService.name);
  private readonly config: EventProcessingConfig;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private activeStreams: Map<string, EventStream> = new Map();
  private processingQueue: IContractEvent[] = [];
  private isProcessing = false;
  private metrics: EventMetrics;
  private processingInterval?: NodeJS.Timeout;

  constructor(
    @InjectModel('ContractEvent') private eventModel: Model<IContractEvent>,
    private redisService: RedisService,
    private monitoringService: MonitoringService,
    private eventIndexer: EventIndexer,
  ) {
    super();
    this.config = {
      maxConcurrency: 10,
      batchSize: 100,
      retryAttempts: 3,
      retryDelay: 5000,
      processingTimeout: 30000,
      enableRealTime: true,
      enableBatching: true,
    };

    this.metrics = {
      totalEvents: 0,
      processedEvents: 0,
      failedEvents: 0,
      averageProcessingTime: 0,
      eventsPerSecond: 0,
      lastProcessedAt: new Date(),
    };
  }

  async onModuleInit() {
    this.logger.log('Initializing Contract Event Service');
    
    // Load existing subscriptions
    await this.loadSubscriptions();
    
    // Start processing queue
    this.startProcessing();
    
    // Initialize metrics collection
    this.startMetricsCollection();
    
    // Setup real-time event streaming
    if (this.config.enableRealTime) {
      this.setupRealTimeStreaming();
    }
    
    this.logger.log('Contract Event Service initialized successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Contract Event Service');
    
    // Stop processing
    this.stopProcessing();
    
    // Close all active streams
    this.closeAllStreams();
    
    // Save subscriptions
    await this.saveSubscriptions();
    
    this.logger.log('Contract Event Service shut down successfully');
  }

  /**
   * Process a new contract event
   */
  async processEvent(eventData: Partial<IContractEvent>): Promise<ContractEvent> {
    const startTime = Date.now();
    
    try {
      // Create event instance
      const event = new this.eventModel({
        ...eventData,
        timestamp: eventData.timestamp || new Date(),
        processed: false,
        processingAttempts: 0,
      });

      // Save event to database
      await event.save();

      // Add to processing queue
      this.processingQueue.push(event.toObject() as IContractEvent);

      // Index event for efficient querying
      await this.eventIndexer.indexEvent(event.toObject() as IContractEvent);

      // Update metrics
      this.metrics.totalEvents++;
      this.updateMetrics();

      // Emit event for real-time processing
      this.emit('newEvent', event.toObject());

      this.logger.debug(`Event queued for processing: ${event.eventId}`);
      
      return event.toObject() as ContractEvent;

    } catch (error) {
      this.logger.error(`Failed to process event:`, error);
      await this.monitoringService.recordMetric('event.processing.error', 1, {
        error: error.message,
      });
      throw error;
    } finally {
      const processingTime = Date.now() - startTime;
      await this.monitoringService.recordMetric('event.processing.time', processingTime);
    }
  }

  /**
   * Process events in batch
   */
  async processBatch(events: IContractEvent[]): Promise<void> {
    const startTime = Date.now();
    
    try {
      const results = await Promise.allSettled(
        events.map(event => this.processSingleEvent(event))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.metrics.processedEvents += successful;
      this.metrics.failedEvents += failed;
      this.metrics.lastProcessedAt = new Date();

      // Record batch processing metrics
      await this.monitoringService.recordMetric('event.batch.processed', successful);
      await this.monitoringService.recordMetric('event.batch.failed', failed);

      this.logger.log(`Batch processed: ${successful} successful, ${failed} failed`);

    } catch (error) {
      this.logger.error(`Batch processing failed:`, error);
      throw error;
    } finally {
      const processingTime = Date.now() - startTime;
      await this.monitoringService.recordMetric('event.batch.time', processingTime);
    }
  }

  /**
   * Process a single event
   */
  private async processSingleEvent(event: IContractEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check if event is already processed
      if (event.processed) {
        return;
      }

      // Apply event filters and subscriptions
      await this.applyEventFilters(event);

      // Mark event as processed
      await this.eventModel.findByIdAndUpdate(event._id, {
        processed: true,
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
      });

      // Emit processed event
      this.emit('eventProcessed', event);

    } catch (error) {
      this.logger.error(`Failed to process event ${event.eventId}:`, error);
      
      // Increment processing attempts
      await this.eventModel.findByIdAndUpdate(event._id, {
        $inc: { processingAttempts: 1 },
        lastError: error.message,
        lastErrorAt: new Date(),
      });

      // Retry if attempts remaining
      if (event.processingAttempts < this.config.retryAttempts) {
        setTimeout(() => {
          this.processingQueue.push(event);
        }, this.config.retryDelay);
      } else {
        // Mark as permanently failed
        await this.eventModel.findByIdAndUpdate(event._id, {
          processed: false,
          permanentlyFailed: true,
        });
      }

      throw error;
    }
  }

  /**
   * Apply event filters and trigger subscriptions
   */
  private async applyEventFilters(event: IContractEvent): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.isActive) continue;

      if (this.eventMatchesSubscription(event, subscription)) {
        await this.triggerSubscription(subscription, event);
      }
    }
  }

  /**
   * Check if event matches subscription criteria
   */
  private eventMatchesSubscription(event: IContractEvent, subscription: EventSubscription): boolean {
    // Check event type
    if (subscription.eventTypes.length > 0 && 
        !subscription.eventTypes.includes(event.eventType)) {
      return false;
    }

    // Check address
    if (subscription.address && event.address !== subscription.address) {
      return false;
    }

    // Check custom filters
    for (const [key, value] of Object.entries(subscription.filters)) {
      const eventValue = (event.data as any)?.[key];
      if (eventValue !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Trigger subscription with event data
   */
  private async triggerSubscription(subscription: EventSubscription, event: IContractEvent): Promise<void> {
    try {
      // Update subscription last processed time
      subscription.lastProcessedAt = new Date();
      this.subscriptions.set(subscription.id, subscription);

      // Send webhook if configured
      if (subscription.webhookUrl) {
        await this.sendWebhook(subscription.webhookUrl, event);
      }

      // Emit to real-time streams
      this.emitToStreams(subscription, event);

      // Record subscription trigger
      await this.monitoringService.recordMetric('event.subscription.triggered', 1, {
        subscriptionId: subscription.id,
        eventType: event.eventType,
      });

    } catch (error) {
      this.logger.error(`Failed to trigger subscription ${subscription.id}:`, error);
      await this.monitoringService.recordMetric('event.subscription.error', 1, {
        subscriptionId: subscription.id,
        error: error.message,
      });
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(webhookUrl: string, event: IContractEvent): Promise<void> {
    const payload = {
      event,
      timestamp: new Date(),
      type: 'contract_event',
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: this.config.processingTimeout,
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }

    this.logger.debug(`Webhook sent successfully to ${webhookUrl}`);
  }

  /**
   * Emit event to real-time streams
   */
  private emitToStreams(subscription: EventSubscription, event: IContractEvent): Promise<void> {
    const streamPromises: Promise<void>[] = [];

    for (const stream of this.activeStreams.values()) {
      if (!stream.isActive) continue;

      if (this.eventMatchesStreamFilters(event, stream)) {
        streamPromises.push(
          this.emitToStream(stream.id, event)
        );
      }
    }

    return Promise.allSettled(streamPromises).then(() => {});
  }

  /**
   * Check if event matches stream filters
   */
  private eventMatchesStreamFilters(event: IContractEvent, stream: EventStream): boolean {
    // Implement stream-specific filtering logic
    for (const [key, value] of Object.entries(stream.filters)) {
      const eventValue = (event.data as any)?.[key];
      if (eventValue !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Emit event to specific stream
   */
  private async emitToStream(streamId: string, event: IContractEvent): Promise<void> {
    this.emit('streamEvent', { streamId, event });
    
    // Update stream activity
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.lastActivityAt = new Date();
      this.activeStreams.set(streamId, stream);
    }
  }

  /**
   * Create event subscription
   */
  async createSubscription(
    address: string,
    eventTypes: string[],
    filters: Record<string, any>,
    webhookUrl?: string
  ): Promise<EventSubscription> {
    const subscription: EventSubscription = {
      id: this.generateId(),
      address,
      eventTypes,
      filters,
      webhookUrl,
      isActive: true,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscription.id, subscription);
    await this.saveSubscriptions();

    this.logger.log(`Created subscription: ${subscription.id}`);
    
    return subscription;
  }

  /**
   * Remove event subscription
   */
  async removeSubscription(subscriptionId: string): Promise<boolean> {
    const removed = this.subscriptions.delete(subscriptionId);
    
    if (removed) {
      await this.saveSubscriptions();
      this.logger.log(`Removed subscription: ${subscriptionId}`);
    }

    return removed;
  }

  /**
   * Create real-time event stream
   */
  createStream(clientId: string, filters: Record<string, any>): EventStream {
    const stream: EventStream = {
      id: this.generateId(),
      clientId,
      filters,
      isActive: true,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.activeStreams.set(stream.id, stream);
    
    this.logger.log(`Created stream: ${stream.id} for client: ${clientId}`);
    
    return stream;
  }

  /**
   * Close event stream
   */
  closeStream(streamId: string): boolean {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.isActive = false;
      this.activeStreams.delete(streamId);
      
      this.logger.log(`Closed stream: ${streamId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Query events with filters
   */
  async queryEvents(filters: Record<string, any>, options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ContractEvent[]> {
    const query: any = {};

    // Apply filters
    if (filters.eventType) {
      query.eventType = filters.eventType;
    }
    if (filters.address) {
      query.address = filters.address;
    }
    if (filters.fromBlock) {
      query.blockNumber = { $gte: filters.fromBlock };
    }
    if (filters.toBlock) {
      query.blockNumber = { $lte: filters.toBlock };
    }
    if (filters.fromTime) {
      query.timestamp = { $gte: new Date(filters.fromTime) };
    }
    if (filters.toTime) {
      query.timestamp = { $lte: new Date(filters.toTime) };
    }

    // Build query with options
    let queryBuilder = this.eventModel.find(query);

    if (options.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }
    if (options.offset) {
      queryBuilder = queryBuilder.skip(options.offset);
    }
    if (options.sortBy) {
      const sortOrder = options.sortOrder || 'desc';
      queryBuilder = queryBuilder.sort({ [options.sortBy]: sortOrder });
    }

    const events = await queryBuilder.exec();
    return events.map(event => event.toObject() as ContractEvent);
  }

  /**
   * Get event metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get active streams
   */
  getActiveStreams(): EventStream[] {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 1000); // Process every second
  }

  /**
   * Stop processing queue
   */
  private stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * Process events from queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batchSize = Math.min(this.config.batchSize, this.processingQueue.length);
      const batch = this.processingQueue.splice(0, batchSize);

      if (this.config.enableBatching && batch.length > 1) {
        await this.processBatch(batch);
      } else {
        await Promise.allSettled(
          batch.map(event => this.processSingleEvent(event))
        );
      }

    } catch (error) {
      this.logger.error('Queue processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Setup real-time streaming
   */
  private setupRealTimeStreaming(): void {
    this.logger.log('Setting up real-time event streaming');
    
    // Setup WebSocket or SSE connections here
    // This would integrate with your real-time infrastructure
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics();
      this.recordMetrics();
    }, 60000); // Update every minute
  }

  /**
   * Update metrics calculations
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeDiff = (now - this.metrics.lastProcessedAt.getTime()) / 1000;
    
    if (timeDiff > 0) {
      this.metrics.eventsPerSecond = this.metrics.processedEvents / timeDiff;
    }
  }

  /**
   * Record metrics to monitoring service
   */
  private async recordMetrics(): Promise<void> {
    await this.monitoringService.recordMetric('events.total', this.metrics.totalEvents);
    await this.monitoringService.recordMetric('events.processed', this.metrics.processedEvents);
    await this.monitoringService.recordMetric('events.failed', this.metrics.failedEvents);
    await this.monitoringService.recordMetric('events.per_second', this.metrics.eventsPerSecond);
  }

  /**
   * Load subscriptions from persistent storage
   */
  private async loadSubscriptions(): Promise<void> {
    try {
      const cached = await this.redisService.get('event_subscriptions');
      if (cached) {
        const subscriptions = JSON.parse(cached);
        subscriptions.forEach((sub: EventSubscription) => {
          this.subscriptions.set(sub.id, sub);
        });
        this.logger.log(`Loaded ${subscriptions.length} subscriptions from cache`);
      }
    } catch (error) {
      this.logger.error('Failed to load subscriptions:', error);
    }
  }

  /**
   * Save subscriptions to persistent storage
   */
  private async saveSubscriptions(): Promise<void> {
    try {
      const subscriptions = Array.from(this.subscriptions.values());
      await this.redisService.set(
        'event_subscriptions',
        JSON.stringify(subscriptions),
        3600 // 1 hour TTL
      );
    } catch (error) {
      this.logger.error('Failed to save subscriptions:', error);
    }
  }

  /**
   * Close all active streams
   */
  private closeAllStreams(): void {
    for (const streamId of this.activeStreams.keys()) {
      this.closeStream(streamId);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
