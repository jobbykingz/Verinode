import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICrossChainEvent } from '../models/CrossChainEvent';
import { MonitoringService } from '../monitoringService';
import { RedisService } from '../redisService';

export interface ProcessingResult {
  success: boolean;
  eventId: string;
  chainId: number;
  processingTime: number;
  error?: string;
  relayedChains?: number[];
}

export interface EventFilter {
  chainId?: number;
  eventSignature?: string;
  contractAddress?: string;
  minBlockNumber?: number;
  maxBlockNumber?: number;
}

@Injectable()
export class EventProcessor {
  private readonly logger = new Logger(EventProcessor.name);
  private readonly processingQueue: Map<string, boolean> = new Map();
  private readonly eventFilters: EventFilter[] = [];

  constructor(
    @InjectModel('CrossChainEvent') private eventModel: Model<ICrossChainEvent>,
    private monitoringService: MonitoringService,
    private redisService: RedisService,
  ) {
    this.initializeFilters();
  }

  private initializeFilters() {
    // Initialize default event filters
    // These would typically be loaded from configuration
    this.eventFilters.push(
      {
        eventSignature: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer
      },
      {
        eventSignature: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925', // Approval
      },
      // Add more filters as needed
    );
  }

  async processEvent(event: ICrossChainEvent): Promise<ProcessingResult> {
    const startTime = Date.now();
    const processingKey = `processing:${event.eventId}`;

    // Prevent duplicate processing
    if (this.processingQueue.get(processingKey)) {
      throw new Error(`Event ${event.eventId} is already being processed`);
    }

    this.processingQueue.set(processingKey, true);

    try {
      this.logger.debug(`Processing event ${event.eventId} on chain ${event.chainId}`);

      // Validate event against filters
      if (!this.shouldProcessEvent(event)) {
        this.logger.debug(`Event ${event.eventId} filtered out`);
        return {
          success: true,
          eventId: event.eventId,
          chainId: event.chainId,
          processingTime: Date.now() - startTime,
        };
      }

      // Process the event
      const relayedChains = await this.processEventLogic(event);

      // Update event with relay information
      for (const chainId of relayedChains) {
        await event.addRelayedChain(chainId);
      }

      const processingTime = Date.now() - startTime;

      // Record metrics
      await this.monitoringService.recordMetric('processor.event.success', 1, {
        chainId: event.chainId.toString(),
        eventType: event.eventSignature,
      });

      await this.monitoringService.recordMetric('processor.event.duration', processingTime, {
        chainId: event.chainId.toString(),
      });

      this.logger.log(`Successfully processed event ${event.eventId} in ${processingTime}ms`);

      return {
        success: true,
        eventId: event.eventId,
        chainId: event.chainId,
        processingTime,
        relayedChains,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Failed to process event ${event.eventId}:`, error);

      await this.monitoringService.recordMetric('processor.event.failure', 1, {
        chainId: event.chainId.toString(),
        error: error.message,
      });

      return {
        success: false,
        eventId: event.eventId,
        chainId: event.chainId,
        processingTime,
        error: error.message,
      };

    } finally {
      this.processingQueue.delete(processingKey);
    }
  }

  private shouldProcessEvent(event: ICrossChainEvent): boolean {
    // Check against configured filters
    for (const filter of this.eventFilters) {
      let matches = true;

      if (filter.chainId && filter.chainId !== event.chainId) {
        matches = false;
      }

      if (filter.eventSignature && filter.eventSignature !== event.eventSignature) {
        matches = false;
      }

      if (filter.contractAddress && filter.contractAddress !== event.contractAddress) {
        matches = false;
      }

      if (filter.minBlockNumber && event.blockNumber < filter.minBlockNumber) {
        matches = false;
      }

      if (filter.maxBlockNumber && event.blockNumber > filter.maxBlockNumber) {
        matches = false;
      }

      if (matches) {
        return true;
      }
    }

    return false;
  }

  private async processEventLogic(event: ICrossChainEvent): Promise<number[]> {
    const relayedChains: number[] = [];

    try {
      // Determine which chains this event should be relayed to
      const targetChains = await this.determineTargetChains(event);

      for (const targetChainId of targetChains) {
        try {
          await this.relayEventToChain(event, targetChainId);
          relayedChains.push(targetChainId);

          await this.monitoringService.recordMetric('processor.relay.success', 1, {
            sourceChain: event.chainId.toString(),
            targetChain: targetChainId.toString(),
          });
        } catch (relayError) {
          this.logger.error(`Failed to relay event ${event.eventId} to chain ${targetChainId}:`, relayError);

          await this.monitoringService.recordMetric('processor.relay.failure', 1, {
            sourceChain: event.chainId.toString(),
            targetChain: targetChainId.toString(),
            error: relayError.message,
          });
        }
      }

      // Perform additional processing (e.g., state updates, notifications)
      await this.performAdditionalProcessing(event, relayedChains);

    } catch (error) {
      this.logger.error(`Event processing logic failed for ${event.eventId}:`, error);
      throw error;
    }

    return relayedChains;
  }

  private async determineTargetChains(event: ICrossChainEvent): Promise<number[]> {
    // Logic to determine which chains should receive this event
    // This could be based on event type, configuration, or smart contract logic

    const targetChains: number[] = [];

    // Example logic: relay Transfer events to all other chains
    if (event.eventSignature === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
      const allChains = [1, 56, 137, 43114]; // ETH, BSC, Polygon, Avalanche
      targetChains.push(...allChains.filter(chain => chain !== event.chainId));
    }

    // Add more sophisticated logic here based on your requirements

    return targetChains;
  }

  private async relayEventToChain(event: ICrossChainEvent, targetChainId: number): Promise<void> {
    // Implement the actual relay logic
    // This could involve calling smart contracts, sending transactions, or using bridges

    // For now, we'll simulate the relay process
    this.logger.debug(`Relaying event ${event.eventId} to chain ${targetChainId}`);

    // Simulate network delay and processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    // In a real implementation, you would:
    // 1. Prepare the relay transaction data
    // 2. Sign and send the transaction to the target chain
    // 3. Wait for confirmation
    // 4. Handle any relay-specific logic

    // Store relay information in Redis for tracking
    const relayKey = `relay:${event.eventId}:${targetChainId}`;
    await this.redisService.set(relayKey, JSON.stringify({
      status: 'completed',
      timestamp: new Date().toISOString(),
      sourceChain: event.chainId,
      targetChain: targetChainId,
    }), 86400); // 24 hours TTL
  }

  private async performAdditionalProcessing(event: ICrossChainEvent, relayedChains: number[]): Promise<void> {
    // Perform any additional processing after successful relay
    // This could include:
    // - Updating local state
    // - Sending notifications
    // - Triggering workflows
    // - Updating analytics

    // Example: Update event statistics
    const statsKey = `event:stats:${event.eventSignature}`;
    const currentStats = await this.redisService.get(statsKey);
    const stats = currentStats ? JSON.parse(currentStats) : {
      totalEvents: 0,
      relayedEvents: 0,
      totalRelays: 0,
    };

    stats.totalEvents += 1;
    stats.relayedEvents += relayedChains.length > 0 ? 1 : 0;
    stats.totalRelays += relayedChains.length;

    await this.redisService.set(statsKey, JSON.stringify(stats), 86400);

    // Send notification for high-value events
    if (this.isHighValueEvent(event)) {
      await this.sendNotification(event, relayedChains);
    }
  }

  private isHighValueEvent(event: ICrossChainEvent): boolean {
    // Determine if this event should trigger notifications
    // This could be based on event type, value, or other criteria

    // Example: Large transfers
    if (event.eventSignature === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
      // Check transfer value (would need to decode event data)
      // For now, just return false
      return false;
    }

    return false;
  }

  private async sendNotification(event: ICrossChainEvent, relayedChains: number[]): Promise<void> {
    // Implement notification logic
    // This could send emails, webhooks, or integrate with notification services

    this.logger.log(`Sending notification for high-value event ${event.eventId}`);

    // Example notification payload
    const notification = {
      type: 'HIGH_VALUE_EVENT',
      eventId: event.eventId,
      chainId: event.chainId,
      relayedChains,
      timestamp: new Date().toISOString(),
      // Add more relevant data
    };

    // In a real implementation, you would send this to a notification service
    // await this.notificationService.send(notification);
  }

  async processBatch(events: ICrossChainEvent[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    // Process events in parallel with concurrency control
    const concurrencyLimit = 10;
    for (let i = 0; i < events.length; i += concurrencyLimit) {
      const batch = events.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(event => this.processEvent(event));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  async getProcessingStats(): Promise<any> {
    // Return processing statistics
    const stats = {
      activeProcessing: this.processingQueue.size,
      totalFilters: this.eventFilters.length,
      // Add more stats as needed
    };

    return stats;
  }

  async addEventFilter(filter: EventFilter): Promise<void> {
    this.eventFilters.push(filter);
    this.logger.log('Added new event filter');
  }

  async removeEventFilter(index: number): Promise<void> {
    if (index >= 0 && index < this.eventFilters.length) {
      this.eventFilters.splice(index, 1);
      this.logger.log(`Removed event filter at index ${index}`);
    }
  }

  async getEventFilters(): Promise<EventFilter[]> {
    return [...this.eventFilters];
  }

  async replayEvent(eventId: string): Promise<ProcessingResult> {
    const event = await this.eventModel.findOne({ eventId });
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Reset sync status for replay
    event.synced = false;
    event.syncAttempts = 0;
    event.relayedToChains = [];
    await event.save();

    return this.processEvent(event);
  }

  async replayEventsByFilter(filter: EventFilter, limit = 100): Promise<ProcessingResult[]> {
    const query: any = {};

    if (filter.chainId) query.chainId = filter.chainId;
    if (filter.eventSignature) query.eventSignature = filter.eventSignature;
    if (filter.contractAddress) query.contractAddress = filter.contractAddress;
    if (filter.minBlockNumber || filter.maxBlockNumber) {
      query.blockNumber = {};
      if (filter.minBlockNumber) query.blockNumber.$gte = filter.minBlockNumber;
      if (filter.maxBlockNumber) query.blockNumber.$lte = filter.maxBlockNumber;
    }

    const events = await this.eventModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit);

    return this.processBatch(events);
  }
}