import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisService } from '../redisService';
import { MonitoringService } from '../monitoringService';
import { ICrossChainEvent } from '../models/CrossChainEvent';
import { ChainListener } from './ChainListener';
import { EventProcessor } from './EventProcessor';

export interface SyncMetrics {
  chainId: number;
  totalEvents: number;
  syncedEvents: number;
  failedEvents: number;
  avgSyncTime: number;
  lastSyncTimestamp: Date;
}

export interface SyncConfig {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  syncInterval: number;
  timeout: number;
}

@Injectable()
export class EventSyncService {
  private readonly logger = new Logger(EventSyncService.name);
  private readonly syncConfigs: Map<number, SyncConfig> = new Map();
  private readonly activeSyncs: Set<string> = new Set();
  private syncIntervals: Map<number, NodeJS.Timeout> = new Map();

  constructor(
    @InjectModel('CrossChainEvent') private eventModel: Model<ICrossChainEvent>,
    private redisService: RedisService,
    private monitoringService: MonitoringService,
    private chainListener: ChainListener,
    private eventProcessor: EventProcessor,
  ) {}

  async onModuleInit() {
    await this.initializeSyncConfigs();
    await this.startPeriodicSync();
  }

  async onModuleDestroy() {
    this.stopPeriodicSync();
  }

  private async initializeSyncConfigs() {
    // Load sync configurations from database or config
    const defaultConfig: SyncConfig = {
      maxRetries: 3,
      retryDelay: 5000,
      batchSize: 50,
      syncInterval: 30000, // 30 seconds
      timeout: 60000, // 1 minute
    };

    // Initialize configs for supported chains
    const supportedChains = await this.getSupportedChains();
    for (const chainId of supportedChains) {
      this.syncConfigs.set(chainId, { ...defaultConfig });
    }
  }

  private async getSupportedChains(): Promise<number[]> {
    // Get supported chains from configuration
    return [1, 56, 137, 43114]; // ETH, BSC, Polygon, Avalanche
  }

  private async startPeriodicSync() {
    for (const [chainId, config] of this.syncConfigs) {
      const interval = setInterval(async () => {
        try {
          await this.performSync(chainId);
        } catch (error) {
          this.logger.error(`Periodic sync failed for chain ${chainId}:`, error);
        }
      }, config.syncInterval);

      this.syncIntervals.set(chainId, interval);
    }
  }

  private stopPeriodicSync() {
    for (const interval of this.syncIntervals.values()) {
      clearInterval(interval);
    }
    this.syncIntervals.clear();
  }

  async performSync(chainId: number): Promise<void> {
    const syncKey = `sync:${chainId}`;
    if (this.activeSyncs.has(syncKey)) {
      this.logger.warn(`Sync already in progress for chain ${chainId}`);
      return;
    }

    this.activeSyncs.add(syncKey);
    const startTime = Date.now();

    try {
      const config = this.syncConfigs.get(chainId);
      if (!config) {
        throw new Error(`No sync config found for chain ${chainId}`);
      }

      // Get unsynced events
      const unsyncedEvents = await this.eventModel
        .findUnsynced(chainId)
        .limit(config.batchSize)
        .sort({ timestamp: 1 });

      if (unsyncedEvents.length === 0) {
        return;
      }

      this.logger.log(`Starting sync for ${unsyncedEvents.length} events on chain ${chainId}`);

      // Process events in parallel with concurrency control
      const syncPromises = unsyncedEvents.map(event =>
        this.syncEvent(event, config)
      );

      const results = await Promise.allSettled(syncPromises);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Update metrics
      await this.updateSyncMetrics(chainId, successful, failed, Date.now() - startTime);

      this.logger.log(`Sync completed for chain ${chainId}: ${successful} successful, ${failed} failed`);

    } catch (error) {
      this.logger.error(`Sync failed for chain ${chainId}:`, error);
      await this.monitoringService.recordMetric('sync.error', 1, { chainId: chainId.toString() });
    } finally {
      this.activeSyncs.delete(syncKey);
    }
  }

  private async syncEvent(event: ICrossChainEvent, config: SyncConfig): Promise<void> {
    const syncStart = Date.now();

    try {
      // Validate event
      await this.validateEvent(event);

      // Process event through the processor
      await this.eventProcessor.processEvent(event);

      // Mark as synced
      await event.markAsSynced();

      // Record success metric
      await this.monitoringService.recordMetric('sync.event.success', 1, {
        chainId: event.chainId.toString(),
        eventType: event.eventSignature
      });

      const syncTime = Date.now() - syncStart;
      await this.monitoringService.recordMetric('sync.event.duration', syncTime, {
        chainId: event.chainId.toString()
      });

    } catch (error) {
      this.logger.error(`Failed to sync event ${event.eventId}:`, error);

      // Increment retry attempts
      await event.incrementSyncAttempts(error.message);

      // Check if max retries exceeded
      if (event.syncAttempts >= config.maxRetries) {
        await this.handleFailedEvent(event);
      } else {
        // Schedule retry
        setTimeout(() => {
          this.performSync(event.chainId);
        }, config.retryDelay);
      }

      await this.monitoringService.recordMetric('sync.event.failure', 1, {
        chainId: event.chainId.toString(),
        error: error.message
      });

      throw error;
    }
  }

  private async validateEvent(event: ICrossChainEvent): Promise<void> {
    // Validate event signature
    if (!event.eventSignature || event.eventSignature.length === 0) {
      throw new Error('Invalid event signature');
    }

    // Validate chain ID
    const supportedChains = await this.getSupportedChains();
    if (!supportedChains.includes(event.chainId)) {
      throw new Error(`Unsupported chain ID: ${event.chainId}`);
    }

    // Validate timestamp (not too old or future)
    const now = new Date();
    const eventTime = new Date(event.timestamp);
    const timeDiff = Math.abs(now.getTime() - eventTime.getTime());

    if (timeDiff > 24 * 60 * 60 * 1000) { // 24 hours
      throw new Error('Event timestamp is too old or in the future');
    }

    // Additional security validations can be added here
  }

  private async handleFailedEvent(event: ICrossChainEvent): Promise<void> {
    this.logger.warn(`Event ${event.eventId} exceeded max retries, marking as permanently failed`);

    // Could implement dead letter queue or notification system here
    await this.monitoringService.recordMetric('sync.event.dead_letter', 1, {
      chainId: event.chainId.toString()
    });
  }

  private async updateSyncMetrics(
    chainId: number,
    successful: number,
    failed: number,
    totalTime: number
  ): Promise<void> {
    const metrics: SyncMetrics = {
      chainId,
      totalEvents: successful + failed,
      syncedEvents: successful,
      failedEvents: failed,
      avgSyncTime: totalTime / (successful + failed),
      lastSyncTimestamp: new Date(),
    };

    // Store metrics in Redis for quick access
    await this.redisService.set(
      `sync:metrics:${chainId}`,
      JSON.stringify(metrics),
      3600 // 1 hour TTL
    );

    // Record to monitoring service
    await this.monitoringService.recordMetric('sync.batch.success', successful, { chainId: chainId.toString() });
    await this.monitoringService.recordMetric('sync.batch.failure', failed, { chainId: chainId.toString() });
  }

  async getSyncMetrics(chainId: number): Promise<SyncMetrics | null> {
    const cached = await this.redisService.get(`sync:metrics:${chainId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database calculation
    const stats = await this.eventModel.getSyncStats(chainId);
    if (stats.length > 0) {
      const stat = stats[0];
      return {
        chainId,
        totalEvents: stat.total,
        syncedEvents: stat.synced,
        failedEvents: stat.failed,
        avgSyncTime: 0, // Would need to calculate from logs
        lastSyncTimestamp: new Date(),
      };
    }

    return null;
  }

  async forceSync(chainId: number): Promise<void> {
    this.logger.log(`Forcing sync for chain ${chainId}`);
    await this.performSync(chainId);
  }

  async pauseSync(chainId: number): Promise<void> {
    const interval = this.syncIntervals.get(chainId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(chainId);
      this.logger.log(`Paused sync for chain ${chainId}`);
    }
  }

  async resumeSync(chainId: number): Promise<void> {
    const config = this.syncConfigs.get(chainId);
    if (config) {
      const interval = setInterval(async () => {
        try {
          await this.performSync(chainId);
        } catch (error) {
          this.logger.error(`Periodic sync failed for chain ${chainId}:`, error);
        }
      }, config.syncInterval);

      this.syncIntervals.set(chainId, interval);
      this.logger.log(`Resumed sync for chain ${chainId}`);
    }
  }
}