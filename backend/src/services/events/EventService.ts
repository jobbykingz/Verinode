import { EventBus } from '../../events/EventBus';
import { eventStore } from '../../events/EventStore';
import { eventHandlersRegistry } from '../../events/EventHandlers';
import { 
  Event, 
  EventHandler, 
  EventBusConfig, 
  RetryPolicy, 
  EventProcessingStats,
  EventFilter,
  ReplayOptions,
  ReplayResult,
  EventMetrics,
  AlertRule,
  EventAlert
} from '../../events/EventTypes';
import { WinstonLogger } from '../../utils/logger';

export class EventService {
  private eventBus: EventBus;
  private logger: WinstonLogger;
  private isInitialized = false;
  private metrics: Map<string, EventMetrics> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alertHistory: EventAlert[] = [];

  constructor(config?: EventBusConfig) {
    this.logger = new WinstonLogger();
    
    const defaultConfig: EventBusConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: 'verinode:events:'
      },
      deadLetterQueue: {
        maxSize: 10000,
        ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60000 // 1 minute
      }
    };

    this.eventBus = new EventBus(config || defaultConfig);
    this.setupEventBusListeners();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Connect to event bus and event store
      await Promise.all([
        this.eventBus.connect(),
        eventStore.connect()
      ]);

      // Start monitoring if enabled
      this.startMonitoring();

      this.isInitialized = true;
      this.logger.info('EventService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize EventService:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      await Promise.all([
        this.eventBus.disconnect(),
        eventStore.disconnect()
      ]);

      this.isInitialized = false;
      this.logger.info('EventService shutdown completed');
    } catch (error) {
      this.logger.error('Error during EventService shutdown:', error);
      throw error;
    }
  }

  async publishEvent(event: Event, streamId?: string): Promise<void> {
    this.ensureInitialized();

    try {
      // Validate event
      this.validateEvent(event);

      // Store in event store for audit trail
      await eventStore.storeEvent(event, streamId);

      // Publish to event bus
      await this.eventBus.publish(event);

      // Update metrics
      this.updateMetrics(event);

      this.logger.debug('Event published successfully:', {
        eventId: event.id,
        eventType: event.type,
        streamId
      });
    } catch (error) {
      this.logger.error('Failed to publish event:', {
        eventId: event.id,
        eventType: event.type,
        error
      });
      throw error;
    }
  }

  async publishEvents(events: Event[], streamId?: string): Promise<void> {
    this.ensureInitialized();

    try {
      // Validate all events
      for (const event of events) {
        this.validateEvent(event);
      }

      // Store in event store
      for (const event of events) {
        await eventStore.storeEvent(event, streamId);
      }

      // Publish batch to event bus
      await this.eventBus.publishBatch(events);

      // Update metrics
      events.forEach(event => this.updateMetrics(event));

      this.logger.info('Batch of events published successfully:', {
        count: events.length,
        streamId
      });
    } catch (error) {
      this.logger.error('Failed to publish batch of events:', {
        count: events.length,
        error
      });
      throw error;
    }
  }

  subscribe(eventType: string, handler: EventHandler, options?: {
    filter?: (event: Event) => boolean;
    retryPolicy?: RetryPolicy;
  }): void {
    this.ensureInitialized();

    // Register with handlers registry
    eventHandlersRegistry.register(eventType, handler, options);

    // Subscribe to event bus
    this.eventBus.subscribe(eventType, async (event: Event) => {
      try {
        await eventHandlersRegistry.executeHandlers(event);
      } catch (error) {
        this.logger.error('Error executing event handlers:', {
          eventId: event.id,
          eventType: event.type,
          error
        });
      }
    });

    this.logger.info('Event subscription created:', {
      eventType,
      handlerName: handler.name || 'anonymous',
      hasFilter: !!options?.filter,
      hasRetryPolicy: !!options?.retryPolicy
    });
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    this.ensureInitialized();

    // Unregister from handlers registry
    eventHandlersRegistry.unregister(eventType, handler);

    // Unsubscribe from event bus
    this.eventBus.unsubscribe(eventType, handler);

    this.logger.info('Event subscription removed:', {
      eventType,
      handlerName: handler.name || 'anonymous'
    });
  }

  async getEvents(filter: EventFilter): Promise<Event[]> {
    this.ensureInitialized();

    try {
      const records = await eventStore.getEvents(filter);
      return records.map(record => record.event);
    } catch (error) {
      this.logger.error('Failed to get events:', { filter, error });
      throw error;
    }
  }

  async replayEvents(options: ReplayOptions): Promise<ReplayResult> {
    this.ensureInitialized();

    try {
      const result = await eventStore.replayEvents(options);

      // If not dry run, publish replayed events
      if (!options.dryRun && result.successful > 0) {
        this.logger.info('Republishing replayed events:', {
          count: result.successful
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to replay events:', { options, error });
      throw error;
    }
  }

  getProcessingStats(): EventProcessingStats {
    this.ensureInitialized();
    return this.eventBus.getStats();
  }

  getEventMetrics(eventType?: string): EventMetrics[] {
    if (eventType) {
      const metrics = this.metrics.get(eventType);
      return metrics ? [metrics] : [];
    }

    return Array.from(this.metrics.values());
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.logger.info('Alert rule added:', { ruleId: rule.id, name: rule.name });
  }

  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      this.logger.info('Alert rule removed:', { ruleId });
    }
    return removed;
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  getAlertHistory(limit?: number): EventAlert[] {
    if (limit) {
      return this.alertHistory.slice(-limit);
    }
    return [...this.alertHistory];
  }

  async createEvent<T extends Event>(
    type: T['type'],
    payload: T['payload'],
    options?: {
      source?: string;
      correlationId?: string;
      causationId?: string;
      metadata?: Record<string, any>;
      maxRetries?: number;
    }
  ): Promise<T> {
    const event: Event = {
      id: this.generateEventId(),
      type,
      timestamp: new Date(),
      version: '1.0.0',
      source: options?.source || 'verinode-backend',
      correlationId: options?.correlationId,
      causationId: options?.causationId,
      metadata: options?.metadata,
      maxRetries: options?.maxRetries || 3,
      retryCount: 0,
      payload
    } as T;

    return event;
  }

  private validateEvent(event: Event): void {
    if (!event.id) {
      throw new Error('Event ID is required');
    }

    if (!event.type) {
      throw new Error('Event type is required');
    }

    if (!event.timestamp) {
      throw new Error('Event timestamp is required');
    }

    if (!event.version) {
      throw new Error('Event version is required');
    }

    if (!event.source) {
      throw new Error('Event source is required');
    }

    if (!event.payload) {
      throw new Error('Event payload is required');
    }
  }

  private updateMetrics(event: Event): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let metrics = this.metrics.get(event.type);
    if (!metrics) {
      metrics = {
        eventType: event.type,
        count: 0,
        successRate: 100,
        averageProcessingTime: 0,
        errorRate: 0,
        lastHour: 0,
        lastDay: 0
      };
      this.metrics.set(event.type, metrics);
    }

    metrics.count++;
    
    if (event.timestamp.getTime() > oneHourAgo) {
      metrics.lastHour++;
    }
    
    if (event.timestamp.getTime() > oneDayAgo) {
      metrics.lastDay++;
    }

    // Check alert rules
    this.checkAlertRules(event.type, metrics);
  }

  private checkAlertRules(eventType: string, metrics: EventMetrics): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) {
        continue;
      }

      let shouldAlert = false;
      let message = '';

      switch (rule.condition) {
        case 'high_error_rate':
          shouldAlert = metrics.errorRate > rule.threshold;
          message = `High error rate detected for ${eventType}: ${metrics.errorRate.toFixed(2)}%`;
          break;
        case 'low_success_rate':
          shouldAlert = metrics.successRate < rule.threshold;
          message = `Low success rate detected for ${eventType}: ${metrics.successRate.toFixed(2)}%`;
          break;
        case 'high_volume':
          shouldAlert = metrics.lastHour > rule.threshold;
          message = `High event volume detected for ${eventType}: ${metrics.lastHour} events in last hour`;
          break;
        case 'slow_processing':
          shouldAlert = metrics.averageProcessingTime > rule.threshold;
          message = `Slow processing detected for ${eventType}: ${metrics.averageProcessingTime.toFixed(2)}ms average`;
          break;
      }

      if (shouldAlert) {
        this.triggerAlert(rule, eventType, message);
      }
    }
  }

  private triggerAlert(rule: AlertRule, eventType: string, message: string): void {
    const alert: EventAlert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      eventType,
      message,
      severity: rule.severity,
      triggeredAt: new Date(),
      metadata: {
        ruleName: rule.name,
        threshold: rule.threshold
      }
    };

    this.alertHistory.push(alert);

    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    this.logger.warn('Event alert triggered:', alert);

    // Send notifications (implementation depends on notification system)
    this.sendAlertNotifications(alert, rule);
  }

  private sendAlertNotifications(alert: EventAlert, rule: AlertRule): void {
    // This would integrate with your notification system
    // For now, just log the alert
    this.logger.info('Alert notification sent:', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: alert.severity,
      message: alert.message,
      notifications: rule.notifications
    });
  }

  private setupEventBusListeners(): void {
    this.eventBus.on('error', (error: Error) => {
      this.logger.error('EventBus error:', error);
    });

    this.eventBus.on('eventPublished', (event: Event) => {
      this.logger.debug('Event published via EventBus:', {
        eventId: event.id,
        eventType: event.type
      });
    });
  }

  private startMonitoring(): void {
    // Start metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, 60000); // Every minute

    this.logger.info('Event monitoring started');
  }

  private collectMetrics(): void {
    try {
      const stats = this.eventBus.getStats();
      const registryStats = eventHandlersRegistry.getRegistryStats();

      this.logger.debug('Event metrics collected:', {
        processingStats: stats,
        registryStats
      });

      // Store system metric event
      this.createEvent('SYSTEM_METRIC', {
        metricName: 'event_processing_stats',
        value: stats.totalProcessed,
        unit: 'events',
        tags: {
          successful: stats.successful.toString(),
          failed: stats.failed.toString(),
          averageProcessingTime: stats.averageProcessingTime.toString()
        }
      }).then(event => {
        this.publishEvent(event).catch(error => {
          this.logger.error('Failed to publish metrics event:', error);
        });
      });
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('EventService is not initialized. Call initialize() first.');
    }
  }
}

export const eventService = new EventService();
