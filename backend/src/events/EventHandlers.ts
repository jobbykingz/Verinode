import { Event, EventHandler, EventSubscription, RetryPolicy } from './EventTypes';
import { WinstonLogger } from '../utils/logger';

export class EventHandlersRegistry {
  private handlers: Map<string, EventSubscription[]> = new Map();
  private globalHandlers: EventHandler[] = [];
  private logger: WinstonLogger;

  constructor() {
    this.logger = new WinstonLogger();
  }

  register(eventType: string, handler: EventHandler, options?: {
    filter?: (event: Event) => boolean;
    retryPolicy?: RetryPolicy;
  }): void {
    const subscription: EventSubscription = {
      eventType,
      handler,
      filter: options?.filter,
      retryPolicy: options?.retryPolicy
    };

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    this.handlers.get(eventType)!.push(subscription);

    this.logger.info('Event handler registered:', {
      eventType,
      handlerName: handler.name || 'anonymous',
      hasFilter: !!options?.filter,
      hasRetryPolicy: !!options?.retryPolicy
    });
  }

  registerGlobal(handler: EventHandler): void {
    this.globalHandlers.push(handler);
    
    this.logger.info('Global event handler registered:', {
      handlerName: handler.name || 'anonymous'
    });
  }

  unregister(eventType: string, handler: EventHandler): boolean {
    const subscriptions = this.handlers.get(eventType);
    if (!subscriptions) {
      return false;
    }

    const index = subscriptions.findIndex(sub => sub.handler === handler);
    if (index > -1) {
      subscriptions.splice(index, 1);
      
      if (subscriptions.length === 0) {
        this.handlers.delete(eventType);
      }

      this.logger.info('Event handler unregistered:', {
        eventType,
        handlerName: handler.name || 'anonymous'
      });
      
      return true;
    }

    return false;
  }

  unregisterGlobal(handler: EventHandler): boolean {
    const index = this.globalHandlers.indexOf(handler);
    if (index > -1) {
      this.globalHandlers.splice(index, 1);
      
      this.logger.info('Global event handler unregistered:', {
        handlerName: handler.name || 'anonymous'
      });
      
      return true;
    }

    return false;
  }

  getHandlers(eventType: string): EventSubscription[] {
    return this.handlers.get(eventType) || [];
  }

  getGlobalHandlers(): EventHandler[] {
    return [...this.globalHandlers];
  }

  getAllEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  getHandlerCount(eventType?: string): number {
    if (eventType) {
      return this.handlers.get(eventType)?.length || 0;
    }
    
    let total = this.globalHandlers.length;
    for (const handlers of this.handlers.values()) {
      total += handlers.length;
    }
    
    return total;
  }

  clear(): void {
    const eventTypes = this.getAllEventTypes();
    const handlerCount = this.getHandlerCount();
    
    this.handlers.clear();
    this.globalHandlers = [];
    
    this.logger.info('All event handlers cleared:', {
      clearedEventTypes: eventTypes.length,
      clearedHandlers: handlerCount
    });
  }

  clearEventType(eventType: string): boolean {
    if (this.handlers.has(eventType)) {
      const count = this.handlers.get(eventType)!.length;
      this.handlers.delete(eventType);
      
      this.logger.info('Event type handlers cleared:', {
        eventType,
        clearedHandlers: count
      });
      
      return true;
    }
    
    return false;
  }

  async executeHandlers(event: Event): Promise<void> {
    const errors: Error[] = [];
    
    // Execute global handlers first
    for (const handler of this.globalHandlers) {
      try {
        await handler(event);
      } catch (error) {
        errors.push(error as Error);
        this.logger.error('Global event handler failed:', {
          eventId: event.id,
          eventType: event.type,
          handlerName: handler.name || 'anonymous',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Execute specific event type handlers
    const subscriptions = this.getHandlers(event.type);
    for (const subscription of subscriptions) {
      try {
        // Apply filter if present
        if (subscription.filter && !subscription.filter(event)) {
          continue;
        }

        // Apply retry policy if present
        if (subscription.retryPolicy) {
          await this.executeWithRetry(event, subscription.handler, subscription.retryPolicy);
        } else {
          await subscription.handler(event);
        }
      } catch (error) {
        errors.push(error as Error);
        this.logger.error('Event handler failed:', {
          eventId: event.id,
          eventType: event.type,
          handlerName: subscription.handler.name || 'anonymous',
          hasRetryPolicy: !!subscription.retryPolicy,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (errors.length > 0) {
      throw new Error(`Event processing failed with ${errors.length} errors: ${errors.map(e => e.message).join(', ')}`);
    }
  }

  private async executeWithRetry(event: Event, handler: EventHandler, retryPolicy: RetryPolicy): Promise<void> {
    let lastError: Error | null = null;
    const maxRetries = retryPolicy.maxRetries;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await handler(event);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (retryPolicy.retryableErrors) {
          const errorMessage = lastError.message;
          const isRetryable = retryPolicy.retryableErrors.some(retryableError => 
            errorMessage.includes(retryableError)
          );
          
          if (!isRetryable) {
            throw lastError; // Not retryable, throw immediately
          }
        }
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Calculate delay for next attempt
        const delay = Math.min(
          retryPolicy.backoffMs * Math.pow(2, attempt),
          retryPolicy.maxBackoffMs
        );
        
        this.logger.warn('Event handler retry scheduled:', {
          eventId: event.id,
          eventType: event.type,
          handlerName: handler.name || 'anonymous',
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          delay
        });
        
        // Wait before retry
        await new Promise(resolve => {
          const timeoutId = global.setTimeout(resolve, delay);
          return timeoutId;
        });
      }
    }
  }

  getRegistryStats(): {
    totalEventTypes: number;
    totalHandlers: number;
    globalHandlers: number;
    eventTypeStats: Array<{
      eventType: string;
      handlerCount: number;
      handlersWithFilters: number;
      handlersWithRetryPolicy: number;
    }>;
  } {
    const eventTypeStats = Array.from(this.handlers.entries()).map(([eventType, subscriptions]) => ({
      eventType,
      handlerCount: subscriptions.length,
      handlersWithFilters: subscriptions.filter(sub => !!sub.filter).length,
      handlersWithRetryPolicy: subscriptions.filter(sub => !!sub.retryPolicy).length
    }));

    return {
      totalEventTypes: this.handlers.size,
      totalHandlers: this.getHandlerCount(),
      globalHandlers: this.globalHandlers.length,
      eventTypeStats
    };
  }

  // Utility methods for common event patterns
  registerOnce(eventType: string, handler: EventHandler): void {
    let hasRun = false;
    
    const onceHandler: EventHandler = async (event: Event) => {
      if (hasRun) {
        return;
      }
      
      hasRun = true;
      await handler(event);
      
      // Unregister after execution
      this.unregister(eventType, onceHandler);
    };
    
    this.register(eventType, onceHandler);
  }

  registerWithTimeout(eventType: string, handler: EventHandler, timeoutMs: number): void {
    const timeoutHandler: EventHandler = async (event: Event) => {
      return Promise.race([
        handler(event),
        new Promise<never>((_, reject) => {
          global.setTimeout(() => reject(new Error(`Handler timeout after ${timeoutMs}ms`)), timeoutMs);
        })
      ]);
    };
    
    this.register(eventType, timeoutHandler);
  }

  registerBatch(eventType: string, handler: EventHandler, batchSize: number = 10, batchTimeoutMs: number = 1000): void {
    let eventBatch: Event[] = [];
    let batchTimer: any = null;
    
    const batchHandler: EventHandler = async (event: Event) => {
      eventBatch.push(event);
      
      // Process batch if it reaches the size limit
      if (eventBatch.length >= batchSize) {
        await processBatch();
      } else if (!batchTimer) {
        // Set timer to process batch after timeout
        batchTimer = global.setTimeout(processBatch, batchTimeoutMs);
      }
    };
    
    const processBatch = async () => {
      if (batchTimer) {
        global.clearTimeout(batchTimer);
        batchTimer = null;
      }
      
      if (eventBatch.length > 0) {
        const batch = [...eventBatch];
        eventBatch = [];
        
        // Create a batch event
        const batchEvent: Event = {
          ...eventBatch[0], // Use first event as template
          type: 'SYSTEM_METRIC' as any, // Use a valid event type
          payload: {
            metricName: `${eventType}_BATCH`,
            value: batch.length,
            unit: 'events',
            tags: {
              originalEventType: eventType,
              batchSize: batch.length.toString()
            },
            events: batch as any, // Add original events to payload
            batchTimestamp: new Date()
          }
        };
        
        await handler(batchEvent);
      }
    };
    
    this.register(eventType, batchHandler);
  }
}

export const eventHandlersRegistry = new EventHandlersRegistry();
