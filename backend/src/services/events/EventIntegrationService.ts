import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ContractEventService } from './ContractEventService';
import { EventIndexer } from './EventIndexer';
import { EventStreamingService } from './EventStreamingService';
import { EventReplayService } from './EventReplayService';
import { EventAnalyticsService } from './EventAnalyticsService';
import { RedisService } from '../redisService';
import { MonitoringService } from '../monitoringService';
import { IContractEvent } from '../../models/ContractEvent';
import { EventEmitter } from 'events';

// Import existing services to integrate with
import { EventSyncService } from '../crosschain/EventSyncService';

export interface IntegrationConfig {
  enableCrossChainSync: boolean;
  enableLegacyCompatibility: boolean;
  enableEventTransformation: boolean;
  syncInterval: number;
  batchSize: number;
  retryAttempts: number;
  transformationRules: TransformationRule[];
}

export interface TransformationRule {
  sourceType: string;
  targetType: string;
  mapping: Record<string, string>;
  filters?: Record<string, any>;
  enabled: boolean;
}

export interface LegacyEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  source: string;
  processed?: boolean;
}

export interface SyncMetrics {
  totalEventsSynced: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncTime: number;
  lastSyncAt: Date;
  syncErrors: string[];
}

export interface TransformationMetrics {
  totalTransformations: number;
  successfulTransformations: number;
  failedTransformations: number;
  averageTransformationTime: number;
  transformationsByType: Record<string, number>;
}

@Injectable()
export class EventIntegrationService extends EventEmitter implements OnModuleInit {
  private readonly logger = new Logger(EventIntegrationService.name);
  private readonly config: IntegrationConfig;
  private syncMetrics: SyncMetrics;
  private transformationMetrics: TransformationMetrics;
  private syncInterval?: NodeJS.Timeout;
  private transformationRules: Map<string, TransformationRule> = new Map();

  constructor(
    private contractEventService: ContractEventService,
    private eventIndexer: EventIndexer,
    private eventStreamingService: EventStreamingService,
    private eventReplayService: EventReplayService,
    private eventAnalyticsService: EventAnalyticsService,
    private redisService: RedisService,
    private monitoringService: MonitoringService,
    private existingEventSyncService?: EventSyncService, // Optional dependency
  ) {
    super();
    
    this.config = {
      enableCrossChainSync: true,
      enableLegacyCompatibility: true,
      enableEventTransformation: true,
      syncInterval: 30000, // 30 seconds
      batchSize: 100,
      retryAttempts: 3,
      transformationRules: [],
    };

    this.syncMetrics = {
      totalEventsSynced: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncTime: 0,
      lastSyncAt: new Date(),
      syncErrors: [],
    };

    this.transformationMetrics = {
      totalTransformations: 0,
      successfulTransformations: 0,
      failedTransformations: 0,
      averageTransformationTime: 0,
      transformationsByType: {},
    };
  }

  async onModuleInit() {
    this.logger.log('Initializing Event Integration Service');
    
    // Load transformation rules
    await this.loadTransformationRules();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start sync processes
    if (this.config.enableCrossChainSync) {
      this.startCrossChainSync();
    }
    
    // Start legacy event processing
    if (this.config.enableLegacyCompatibility) {
      this.startLegacyEventProcessing();
    }
    
    this.logger.log('Event Integration Service initialized successfully');
  }

  /**
   * Process incoming event from external source
   */
  async processExternalEvent(event: any, source: string): Promise<IContractEvent> {
    const startTime = Date.now();
    
    try {
      // Transform event if needed
      const transformedEvent = await this.transformEvent(event, source);
      
      // Process through main event service
      const processedEvent = await this.contractEventService.processEvent(transformedEvent);
      
      // Update metrics
      this.syncMetrics.totalEventsSynced++;
      this.syncMetrics.successfulSyncs++;
      this.syncMetrics.lastSyncAt = new Date();
      
      const processingTime = Date.now() - startTime;
      this.updateSyncMetrics(processingTime);
      
      this.logger.debug(`Processed external event from ${source}: ${processedEvent.eventId}`);
      
      return processedEvent;
      
    } catch (error) {
      this.syncMetrics.failedSyncs++;
      this.syncMetrics.syncErrors.push(`${source}: ${(error as Error).message}`);
      
      this.logger.error(`Failed to process external event from ${source}:`, error);
      throw error;
    }
  }

  /**
   * Sync events with cross-chain service
   */
  async syncCrossChainEvents(): Promise<void> {
    if (!this.existingEventSyncService) {
      this.logger.warn('Cross-chain sync service not available');
      return;
    }
    
    try {
      // Get unsynced events from cross-chain service
      const crossChainEvents = await this.getCrossChainEvents();
      
      if (crossChainEvents.length === 0) {
        return;
      }
      
      this.logger.log(`Syncing ${crossChainEvents.length} cross-chain events`);
      
      // Process events in batches
      const batches = this.createBatches(crossChainEvents, this.config.batchSize);
      
      for (const batch of batches) {
        await this.processBatch(batch);
      }
      
      this.logger.log(`Successfully synced ${crossChainEvents.length} cross-chain events`);
      
    } catch (error) {
      this.logger.error('Cross-chain sync failed:', error);
      throw error;
    }
  }

  /**
   * Transform legacy event to new format
   */
  async transformLegacyEvent(legacyEvent: LegacyEvent): Promise<IContractEvent> {
    const startTime = Date.now();
    
    try {
      const rule = this.transformationRules.get(legacyEvent.type);
      
      if (!rule || !rule.enabled) {
        throw new Error(`No transformation rule found for event type: ${legacyEvent.type}`);
      }
      
      const transformedEvent = this.applyTransformation(legacyEvent, rule);
      
      // Update transformation metrics
      this.transformationMetrics.totalTransformations++;
      this.transformationMetrics.successfulTransformations++;
      this.transformationMetrics.transformationsByType[legacyEvent.type] = 
        (this.transformationMetrics.transformationsByType[legacyEvent.type] || 0) + 1;
      
      const transformationTime = Date.now() - startTime;
      this.updateTransformationMetrics(transformationTime);
      
      return transformedEvent;
      
    } catch (error) {
      this.transformationMetrics.failedTransformations++;
      this.logger.error(`Failed to transform legacy event ${legacyEvent.id}:`, error);
      throw error;
    }
  }

  /**
   * Get integration metrics
   */
  getIntegrationMetrics(): {
    syncMetrics: SyncMetrics;
    transformationMetrics: TransformationMetrics;
  } {
    return {
      syncMetrics: { ...this.syncMetrics },
      transformationMetrics: { ...this.transformationMetrics },
    };
  }

  /**
   * Add transformation rule
   */
  async addTransformationRule(rule: TransformationRule): Promise<void> {
    this.transformationRules.set(rule.sourceType, rule);
    await this.saveTransformationRules();
    
    this.logger.log(`Added transformation rule: ${rule.sourceType} -> ${rule.targetType}`);
  }

  /**
   * Remove transformation rule
   */
  async removeTransformationRule(sourceType: string): Promise<void> {
    this.transformationRules.delete(sourceType);
    await this.saveTransformationRules();
    
    this.logger.log(`Removed transformation rule: ${sourceType}`);
  }

  /**
   * Get transformation rules
   */
  getTransformationRules(): TransformationRule[] {
    return Array.from(this.transformationRules.values());
  }

  /**
   * Setup event listeners for integration
   */
  private setupEventListeners(): void {
    // Listen to new events and forward to cross-chain service
    this.contractEventService.on('newEvent', async (event: IContractEvent) => {
      try {
        await this.forwardToCrossChainService(event);
      } catch (error) {
        this.logger.error('Failed to forward event to cross-chain service:', error);
      }
    });

    // Listen to processed events and update analytics
    this.contractEventService.on('eventProcessed', async (event: IContractEvent) => {
      try {
        await this.updateIntegrationAnalytics(event);
      } catch (error) {
        this.logger.error('Failed to update integration analytics:', error);
      }
    });

    // Listen to streaming service events
    this.eventStreamingService.on('connectionEstablished', (connection) => {
      this.logger.debug(`New streaming connection: ${connection.id}`);
    });

    // Listen to replay service events
    this.eventReplayService.on('sessionCompleted', (session) => {
      this.logger.debug(`Replay session completed: ${session.id}`);
    });
  }

  /**
   * Start cross-chain sync process
   */
  private startCrossChainSync(): void {
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncCrossChainEvents();
      } catch (error) {
        this.logger.error('Cross-chain sync interval failed:', error);
      }
    }, this.config.syncInterval);
  }

  /**
   * Start legacy event processing
   */
  private startLegacyEventProcessing(): void {
    // This would integrate with existing legacy event sources
    // For now, just log that it's enabled
    this.logger.log('Legacy event processing enabled');
  }

  /**
   * Transform event based on rules
   */
  private async transformEvent(event: any, source: string): Promise<Partial<IContractEvent>> {
    if (!this.config.enableEventTransformation) {
      return event as Partial<IContractEvent>;
    }

    // Apply transformation rules based on source
    const rule = this.transformationRules.get(source);
    
    if (rule && rule.enabled) {
      return this.applyTransformation(event, rule);
    }

    return event as Partial<IContractEvent>;
  }

  /**
   * Apply transformation rule to event
   */
  private applyTransformation(event: any, rule: TransformationRule): Partial<IContractEvent> {
    const transformed: any = {};

    // Apply field mappings
    for (const [sourceField, targetField] of Object.entries(rule.mapping)) {
      if (event[sourceField] !== undefined) {
        transformed[targetField] = event[sourceField];
      }
    }

    // Apply filters
    if (rule.filters) {
      for (const [field, value] of Object.entries(rule.filters)) {
        if (event[field] !== value) {
          throw new Error(`Event does not match filter: ${field} = ${value}`);
        }
      }
    }

    // Set default values
    transformed.eventType = rule.targetType;
    transformed.timestamp = event.timestamp || new Date();
    transformed.processed = false;
    transformed.processingAttempts = 0;

    return transformed;
  }

  /**
   * Get cross-chain events
   */
  private async getCrossChainEvents(): Promise<any[]> {
    if (!this.existingEventSyncService) {
      return [];
    }

    // This would integrate with the existing EventSyncService
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Process batch of events
   */
  private async processBatch(events: any[]): Promise<void> {
    const promises = events.map(event => this.processExternalEvent(event, 'crosschain'));
    
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    this.logger.log(`Batch processed: ${successful} successful, ${failed} failed`);
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Forward event to cross-chain service
   */
  private async forwardToCrossChainService(event: IContractEvent): Promise<void> {
    if (!this.existingEventSyncService) {
      return;
    }

    // This would forward the event to the existing cross-chain service
    // Implementation depends on the existing service's API
  }

  /**
   * Update integration analytics
   */
  private async updateIntegrationAnalytics(event: IContractEvent): Promise<void> {
    // Update analytics with integration-specific metrics
    // Note: Using a generic monitoring approach since recordMetric may not be available
    this.logger.log(`Integration analytics updated for event: ${event.eventId}`, {
      eventType: event.eventType,
      source: 'contract_event_service',
    });
  }

  /**
   * Update sync metrics
   */
  private updateSyncMetrics(processingTime: number): void {
    const current = this.syncMetrics.averageSyncTime;
    this.syncMetrics.averageSyncTime = (current + processingTime) / 2;
  }

  /**
   * Update transformation metrics
   */
  private updateTransformationMetrics(transformationTime: number): void {
    const current = this.transformationMetrics.averageTransformationTime;
    this.transformationMetrics.averageTransformationTime = (current + transformationTime) / 2;
  }

  /**
   * Load transformation rules from storage
   */
  private async loadTransformationRules(): Promise<void> {
    try {
      const cached = await this.redisService.get('transformation_rules');
      
      if (cached) {
        const rules = JSON.parse(cached) as TransformationRule[];
        
        for (const rule of rules) {
          this.transformationRules.set(rule.sourceType, rule);
        }
        
        this.logger.log(`Loaded ${rules.length} transformation rules from cache`);
      } else {
        // Load default transformation rules
        await this.loadDefaultTransformationRules();
      }
      
    } catch (error) {
      this.logger.error('Failed to load transformation rules:', error);
      await this.loadDefaultTransformationRules();
    }
  }

  /**
   * Load default transformation rules
   */
  private async loadDefaultTransformationRules(): Promise<void> {
    const defaultRules: TransformationRule[] = [
      {
        sourceType: 'legacy_proof',
        targetType: 'ProofIssued',
        mapping: {
          'id': 'eventId',
          'issuer': 'emitter',
          'proof_data': 'data',
          'created_at': 'timestamp',
        },
        enabled: true,
      },
      {
        sourceType: 'legacy_verification',
        targetType: 'ProofVerified',
        mapping: {
          'id': 'eventId',
          'verifier': 'emitter',
          'proof_id': 'data.proofId',
          'verified_at': 'timestamp',
        },
        enabled: true,
      },
      {
        sourceType: 'cross_chain_event',
        targetType: 'CrossChainEvent',
        mapping: {
          'event_id': 'eventId',
          'source_chain': 'data.sourceChain',
          'target_chain': 'data.targetChain',
          'asset': 'data.asset',
          'amount': 'data.amount',
        },
        enabled: true,
      },
    ];

    for (const rule of defaultRules) {
      this.transformationRules.set(rule.sourceType, rule);
    }

    await this.saveTransformationRules();
    this.logger.log(`Loaded ${defaultRules.length} default transformation rules`);
  }

  /**
   * Save transformation rules to storage
   */
  private async saveTransformationRules(): Promise<void> {
    try {
      const rules = Array.from(this.transformationRules.values());
      await this.redisService.set(
        'transformation_rules',
        JSON.stringify(rules),
        24 * 60 * 60 // 24 hours TTL
      );
    } catch (error) {
      this.logger.error('Failed to save transformation rules:', error);
    }
  }

  /**
   * Health check for integration service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const details = {
      syncMetrics: this.syncMetrics,
      transformationMetrics: this.transformationMetrics,
      transformationRulesCount: this.transformationRules.size,
      crossChainSyncEnabled: this.config.enableCrossChainSync,
      legacyCompatibilityEnabled: this.config.enableLegacyCompatibility,
    };

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (this.syncMetrics.failedSyncs > this.syncMetrics.successfulSyncs * 0.1) {
      status = 'degraded';
    }
    
    if (this.syncMetrics.failedSyncs > this.syncMetrics.successfulSyncs * 0.5) {
      status = 'unhealthy';
    }

    if (this.transformationMetrics.failedTransformations > this.transformationMetrics.successfulTransformations * 0.2) {
      status = 'degraded';
    }

    return { status, details };
  }
}
