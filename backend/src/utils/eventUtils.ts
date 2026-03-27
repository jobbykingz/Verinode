import { Event, EventFilter, RetryPolicy } from '../events/EventTypes';
import { WinstonLogger } from './logger';

export class EventUtils {
  private static logger = new WinstonLogger();

  /**
   * Generate a unique event ID
   */
  static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a correlation ID for event tracing
   */
  static generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a causal chain between events
   */
  static createCausalChain(parentEvent: Event, childEvent: Event): void {
    childEvent.causationId = parentEvent.id;
    childEvent.correlationId = parentEvent.correlationId || parentEvent.id;
  }

  /**
   * Validate event structure
   */
  static validateEvent(event: Event): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!event.id) {
      errors.push('Event ID is required');
    }

    if (!event.type) {
      errors.push('Event type is required');
    }

    if (!event.timestamp) {
      errors.push('Event timestamp is required');
    } else if (!(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
      errors.push('Event timestamp must be a valid Date');
    }

    if (!event.version) {
      errors.push('Event version is required');
    }

    if (!event.source) {
      errors.push('Event source is required');
    }

    if (!event.payload) {
      errors.push('Event payload is required');
    }

    if (event.retryCount !== undefined && (typeof event.retryCount !== 'number' || event.retryCount < 0)) {
      errors.push('Event retry count must be a non-negative number');
    }

    if (event.maxRetries !== undefined && (typeof event.maxRetries !== 'number' || event.maxRetries < 0)) {
      errors.push('Event max retries must be a non-negative number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize event for logging (remove sensitive data)
   */
  static sanitizeEventForLogging(event: Event): Event {
    const sanitized = { ...event };

    // Remove sensitive fields from payload
    if (sanitized.payload) {
      sanitized.payload = this.sanitizeObject(sanitized.payload);
    }

    // Remove sensitive fields from metadata
    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeObject(sanitized.metadata);
    }

    return sanitized;
  }

  /**
   * Check if event matches filter criteria
   */
  static matchesFilter(event: Event, filter: EventFilter): boolean {
    // Check event types
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      if (!filter.eventTypes.includes(event.type)) {
        return false;
      }
    }

    // Check source
    if (filter.source && event.source !== filter.source) {
      return false;
    }

    // Check time range
    if (filter.timeRange) {
      const eventTime = event.timestamp.getTime();
      if (filter.timeRange.start && eventTime < filter.timeRange.start.getTime()) {
        return false;
      }
      if (filter.timeRange.end && eventTime > filter.timeRange.end.getTime()) {
        return false;
      }
    }

    // Check metadata
    if (filter.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (event.metadata?.[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Create a retry policy
   */
  static createRetryPolicy(options: {
    maxRetries?: number;
    backoffMs?: number;
    maxBackoffMs?: number;
    retryableErrors?: string[];
  }): RetryPolicy {
    return {
      maxRetries: options.maxRetries || 3,
      backoffMs: options.backoffMs || 1000,
      maxBackoffMs: options.maxBackoffMs || 30000,
      retryableErrors: options.retryableErrors || [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNREFUSED'
      ]
    };
  }

  /**
   * Calculate exponential backoff delay
   */
  static calculateBackoffDelay(attempt: number, baseDelay: number, maxDelay: number): number {
    const delay = baseDelay * Math.pow(2, attempt);
    return Math.min(delay, maxDelay);
  }

  /**
   * Extract event type from event name
   */
  static extractEventType(eventName: string): string {
    // Convert snake_case or camelCase to UPPER_CASE
    return eventName
      .replace(/([A-Z])/g, '_$1')
      .replace(/^_/, '')
      .toUpperCase();
  }

  /**
   * Create event type name from string
   */
  static createEventTypeName(baseName: string, action: string): string {
    const eventType = this.extractEventType(baseName);
    const actionType = this.extractEventType(action);
    return `${eventType}_${actionType}`;
  }

  /**
   * Calculate event hash for deduplication
   */
  static calculateEventHash(event: Event): string {
    const hashInput = {
      type: event.type,
      payload: event.payload,
      timestamp: event.timestamp.getTime(),
      source: event.source
    };

    const hashString = JSON.stringify(hashInput, Object.keys(hashInput).sort());
    return this.simpleHash(hashString);
  }

  /**
   * Check if events are duplicates
   */
  static areDuplicates(event1: Event, event2: Event, toleranceMs: number = 1000): boolean {
    if (event1.type !== event2.type) {
      return false;
    }

    if (event1.source !== event2.source) {
      return false;
    }

    const timeDiff = Math.abs(event1.timestamp.getTime() - event2.timestamp.getTime());
    if (timeDiff > toleranceMs) {
      return false;
    }

    const hash1 = this.calculateEventHash(event1);
    const hash2 = this.calculateEventHash(event2);

    return hash1 === hash2;
  }

  /**
   * Group events by correlation ID
   */
  static groupByCorrelation(events: Event[]): Map<string, Event[]> {
    const groups = new Map<string, Event[]>();

    for (const event of events) {
      const correlationId = event.correlationId || event.id;
      if (!groups.has(correlationId)) {
        groups.set(correlationId, []);
      }
      groups.get(correlationId)!.push(event);
    }

    return groups;
  }

  /**
   * Sort events chronologically
   */
  static sortEventsChronologically(events: Event[]): Event[] {
    return [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Create event summary
   */
  static createEventSummary(events: Event[]): {
    total: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    timeRange: { start?: Date; end?: Date };
    averageEventsPerMinute: number;
  } {
    if (events.length === 0) {
      return {
        total: 0,
        byType: {},
        bySource: {},
        timeRange: {},
        averageEventsPerMinute: 0
      };
    }

    const sortedEvents = this.sortEventsChronologically(events);
    const start = sortedEvents[0].timestamp;
    const end = sortedEvents[sortedEvents.length - 1].timestamp;
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const event of events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      bySource[event.source] = (bySource[event.source] || 0) + 1;
    }

    return {
      total: events.length,
      byType,
      bySource,
      timeRange: { start, end },
      averageEventsPerMinute: durationMinutes > 0 ? events.length / durationMinutes : 0
    };
  }

  /**
   * Create event schema validation
   */
  static createEventSchema(eventType: string, schema: any): void {
    // This would integrate with a validation library like Joi or Zod
    // For now, just store the schema for future use
    this.logger.info('Event schema created:', { eventType });
  }

  /**
   * Validate event against schema
   */
  static validateEventSchema(event: Event, schema: any): { isValid: boolean; errors: string[] } {
    // This would integrate with a validation library
    // For now, return true as a placeholder
    return { isValid: true, errors: [] };
  }

  /**
   * Create event batch for efficient processing
   */
  static createEventBatch(events: Event[], maxSize: number = 100, maxWaitMs: number = 1000): {
    batches: Event[][];
    remaining: Event[];
  } {
    const batches: Event[][] = [];
    const remaining = [...events];

    while (remaining.length > 0) {
      const batch = remaining.splice(0, maxSize);
      batches.push(batch);
    }

    return { batches, remaining: [] };
  }

  /**
   * Merge event metadata
   */
  static mergeMetadata(...metadataObjects: (Record<string, any> | undefined)[]): Record<string, any> {
    const merged: Record<string, any> = {};

    for (const metadata of metadataObjects) {
      if (metadata) {
        Object.assign(merged, metadata);
      }
    }

    return merged;
  }

  /**
   * Extract user context from event
   */
  static extractUserContext(event: Event): {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  } {
    const context: any = {};

    // Extract from metadata
    if (event.metadata) {
      context.userId = event.metadata.userId;
      context.sessionId = event.metadata.sessionId;
      context.ipAddress = event.metadata.ipAddress;
      context.userAgent = event.metadata.userAgent;
    }

    // Extract from payload for specific event types
    if (event.type.includes('USER') && event.payload) {
      context.userId = context.userId || (event.payload as any).userId;
    }

    return context;
  }

  /**
   * Create event metrics
   */
  static createEventMetrics(events: Event[]): {
    totalEvents: number;
    uniqueEventTypes: number;
    uniqueSources: number;
    averagePayloadSize: number;
    oldestEvent?: Date;
    newestEvent?: Date;
    eventsByHour: Record<string, number>;
  } {
    if (events.length === 0) {
      return {
        totalEvents: 0,
        uniqueEventTypes: 0,
        uniqueSources: 0,
        averagePayloadSize: 0,
        eventsByHour: {}
      };
    }

    const eventTypes = new Set<string>();
    const sources = new Set<string>();
    const eventsByHour: Record<string, number> = {};
    let totalPayloadSize = 0;

    let oldestEvent = events[0].timestamp;
    let newestEvent = events[0].timestamp;

    for (const event of events) {
      eventTypes.add(event.type);
      sources.add(event.source);

      const payloadSize = JSON.stringify(event.payload).length;
      totalPayloadSize += payloadSize;

      if (event.timestamp < oldestEvent) {
        oldestEvent = event.timestamp;
      }
      if (event.timestamp > newestEvent) {
        newestEvent = event.timestamp;
      }

      const hour = event.timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      eventsByHour[hour] = (eventsByHour[hour] || 0) + 1;
    }

    return {
      totalEvents: events.length,
      uniqueEventTypes: eventTypes.size,
      uniqueSources: sources.size,
      averagePayloadSize: totalPayloadSize / events.length,
      oldestEvent,
      newestEvent,
      eventsByHour
    };
  }

  private static sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
      'session',
      'credential'
    ];

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));

      if (isSensitive) {
        (sanitized as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        (sanitized as any)[key] = this.sanitizeObject(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }

    return sanitized;
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

export default EventUtils;
