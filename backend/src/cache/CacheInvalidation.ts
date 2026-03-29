import { EventEmitter } from 'events';
import { WinstonLogger } from '../utils/logger';
import { CacheConfig, InvalidationStrategy } from '../config/cache';
import { DistributedCache } from './DistributedCache';

export interface InvalidationRule {
  id: string;
  name: string;
  type: 'time-based' | 'event-driven' | 'dependency-based' | 'manual';
  pattern: string;
  conditions: InvalidationCondition[];
  priority: number;
  enabled: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

export interface InvalidationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

export interface InvalidationEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  source: string;
  processed: boolean;
  retryCount: number;
}

export interface InvalidationResult {
  ruleId: string;
  keysInvalidated: number;
  keysFailed: number;
  duration: number;
  error?: string;
}

export interface DependencyGraph {
  nodes: Map<string, CacheNode>;
  edges: Map<string, string[]>;
}

export interface CacheNode {
  key: string;
  dependencies: string[];
  ttl?: number;
  priority: number;
  lastAccessed: Date;
}

export class CacheInvalidation extends EventEmitter {
  private distributedCache: DistributedCache;
  private config: CacheConfig;
  private logger: WinstonLogger;
  private invalidationRules: Map<string, InvalidationRule>;
  private eventQueue: InvalidationEvent[];
  private dependencyGraph: DependencyGraph;
  private isProcessing: boolean = false;
  private processingTimer?: NodeJS.Timeout;

  constructor(distributedCache: DistributedCache, config: CacheConfig) {
    super();
    this.distributedCache = distributedCache;
    this.config = config;
    this.logger = new WinstonLogger();
    this.invalidationRules = new Map();
    this.eventQueue = [];
    this.dependencyGraph = { nodes: new Map(), edges: new Map() };
    
    this.initializeInvalidationStrategies();
    this.startEventProcessor();
  }

  /**
   * Initialize invalidation strategies from config
   */
  private async initializeInvalidationStrategies(): Promise<void> {
    try {
      for (const strategy of this.config.invalidation.strategies) {
        const rule: InvalidationRule = {
          id: this.generateRuleId(),
          name: strategy.name,
          type: strategy.type,
          pattern: this.buildPatternFromStrategy(strategy),
          conditions: this.buildConditionsFromStrategy(strategy),
          priority: this.getPriorityFromStrategy(strategy),
          enabled: true,
          createdAt: new Date()
        };
        
        this.invalidationRules.set(rule.id, rule);
        this.logger.info(`Initialized invalidation rule: ${strategy.name}`);
      }
      
      this.emit('strategiesInitialized', Array.from(this.invalidationRules.values()));
    } catch (error) {
      this.logger.error('Failed to initialize invalidation strategies', error);
      this.emit('error', error);
    }
  }

  /**
   * Add invalidation rule
   */
  addRule(rule: Omit<InvalidationRule, 'id' | 'createdAt'>): string {
    const id = this.generateRuleId();
    const fullRule: InvalidationRule = {
      ...rule,
      id,
      createdAt: new Date()
    };
    
    this.invalidationRules.set(id, fullRule);
    this.logger.info(`Added invalidation rule: ${rule.name}`);
    this.emit('ruleAdded', fullRule);
    
    return id;
  }

  /**
   * Remove invalidation rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.invalidationRules.delete(ruleId);
    
    if (removed) {
      this.logger.info(`Removed invalidation rule: ${ruleId}`);
      this.emit('ruleRemoved', ruleId);
    }
    
    return removed;
  }

  /**
   * Trigger invalidation event
   */
  async triggerInvalidation(eventType: string, data: any, source: string = 'manual'): Promise<void> {
    const event: InvalidationEvent = {
      id: this.generateEventId(),
      type: eventType,
      data,
      timestamp: new Date(),
      source,
      processed: false,
      retryCount: 0
    };
    
    this.eventQueue.push(event);
    this.logger.info(`Queued invalidation event: ${eventType}`, { source, data });
    this.emit('eventQueued', event);
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string, options?: { cascade?: boolean; priority?: number }): Promise<InvalidationResult> {
    const startTime = Date.now();
    
    try {
      const keys = await this.distributedCache.getStats();
      const matchingKeys = this.findMatchingKeys(pattern, keys);
      
      let keysInvalidated = 0;
      let keysFailed = 0;
      
      if (options?.cascade) {
        const dependentKeys = await this.getDependentKeys(matchingKeys);
        matchingKeys.push(...dependentKeys);
      }
      
      // Process in batches
      const batchSize = this.config.invalidation.batchSize;
      for (let i = 0; i < matchingKeys.length; i += batchSize) {
        const batch = matchingKeys.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(key => this.distributedCache.del(key))
        );
        
        keysInvalidated += results.filter(success => success).length;
        keysFailed += results.filter(success => !success).length;
      }
      
      const result: InvalidationResult = {
        ruleId: 'pattern_invalidation',
        keysInvalidated,
        keysFailed,
        duration: Date.now() - startTime
      };
      
      this.logger.info(`Pattern invalidation completed`, { pattern, keysInvalidated, keysFailed });
      this.emit('invalidationCompleted', result);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Pattern invalidation failed: ${pattern}`, error);
      return {
        ruleId: 'pattern_invalidation',
        keysInvalidated: 0,
        keysFailed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Invalidate cache by key
   */
  async invalidateByKey(key: string, cascade: boolean = false): Promise<InvalidationResult> {
    const startTime = Date.now();
    
    try {
      const keysToDelete = [key];
      
      if (cascade) {
        const dependentKeys = await this.getDependentKeys([key]);
        keysToDelete.push(...dependentKeys);
      }
      
      const results = await Promise.all(
        keysToDelete.map(k => this.distributedCache.del(k))
      );
      
      const keysInvalidated = results.filter(success => success).length;
      const keysFailed = results.filter(success => !success).length;
      
      const result: InvalidationResult = {
        ruleId: 'key_invalidation',
        keysInvalidated,
        keysFailed,
        duration: Date.now() - startTime
      };
      
      this.logger.info(`Key invalidation completed`, { key, cascade, keysInvalidated, keysFailed });
      this.emit('invalidationCompleted', result);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Key invalidation failed: ${key}`, error);
      return {
        ruleId: 'key_invalidation',
        keysInvalidated: 0,
        keysFailed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add dependency between cache keys
   */
  addDependency(key: string, dependency: string): void {
    if (!this.dependencyGraph.nodes.has(key)) {
      this.dependencyGraph.nodes.set(key, {
        key,
        dependencies: [],
        priority: 0,
        lastAccessed: new Date()
      });
    }
    
    if (!this.dependencyGraph.nodes.has(dependency)) {
      this.dependencyGraph.nodes.set(dependency, {
        key: dependency,
        dependencies: [],
        priority: 0,
        lastAccessed: new Date()
      });
    }
    
    const node = this.dependencyGraph.nodes.get(key)!;
    node.dependencies.push(dependency);
    
    if (!this.dependencyGraph.edges.has(key)) {
      this.dependencyGraph.edges.set(key, []);
    }
    
    this.dependencyGraph.edges.get(key)!.push(dependency);
    
    this.logger.debug(`Added dependency: ${key} -> ${dependency}`);
    this.emit('dependencyAdded', { key, dependency });
  }

  /**
   * Get invalidation statistics
   */
  getStatistics(): any {
    const rules = Array.from(this.invalidationRules.values());
    const enabledRules = rules.filter(rule => rule.enabled);
    const recentEvents = this.eventQueue
      .filter(event => Date.now() - event.timestamp.getTime() < 3600000) // Last hour
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return {
      totalRules: rules.length,
      enabledRules: enabledRules.length,
      queuedEvents: this.eventQueue.length,
      processedEvents: this.eventQueue.filter(e => e.processed).length,
      recentEvents: recentEvents.slice(0, 10),
      dependencyNodes: this.dependencyGraph.nodes.size,
      dependencyEdges: Array.from(this.dependencyGraph.edges.values())
        .reduce((sum, edges) => sum + edges.length, 0)
    };
  }

  /**
   * Get all invalidation rules
   */
  getRules(): InvalidationRule[] {
    return Array.from(this.invalidationRules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): InvalidationRule | null {
    return this.invalidationRules.get(ruleId) || null;
  }

  /**
   * Update rule
   */
  updateRule(ruleId: string, updates: Partial<InvalidationRule>): boolean {
    const rule = this.invalidationRules.get(ruleId);
    if (!rule) {
      return false;
    }
    
    const updatedRule = { ...rule, ...updates };
    this.invalidationRules.set(ruleId, updatedRule);
    
    this.logger.info(`Updated invalidation rule: ${ruleId}`);
    this.emit('ruleUpdated', updatedRule);
    
    return true;
  }

  /**
   * Clear all invalidation rules
   */
  clearRules(): void {
    this.invalidationRules.clear();
    this.dependencyGraph = { nodes: new Map(), edges: new Map() };
    
    this.logger.info('Cleared all invalidation rules');
    this.emit('rulesCleared');
  }

  // Private methods

  private startEventProcessor(): void {
    this.processingTimer = setInterval(async () => {
      if (!this.isProcessing && this.eventQueue.length > 0) {
        await this.processEventQueue();
      }
    }, this.config.invalidation.propagationDelay);
  }

  private async processEventQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const events = this.eventQueue.splice(0, this.config.invalidation.batchSize);
      
      for (const event of events) {
        await this.processInvalidationEvent(event);
      }
      
      this.emit('eventsProcessed', events);
      
    } catch (error) {
      this.logger.error('Failed to process event queue', error);
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processInvalidationEvent(event: InvalidationEvent): Promise<void> {
    try {
      const matchingRules = this.findMatchingRules(event);
      
      for (const rule of matchingRules) {
        if (rule.enabled) {
          await this.executeInvalidationRule(rule, event);
          rule.lastTriggered = new Date();
        }
      }
      
      event.processed = true;
      
    } catch (error) {
      event.retryCount++;
      
      if (event.retryCount < this.config.invalidation.maxRetries) {
        // Re-queue the event for retry
        this.eventQueue.push(event);
      } else {
        this.logger.error(`Failed to process invalidation event after ${event.retryCount} retries`, error);
        event.processed = true;
      }
    }
  }

  private findMatchingRules(event: InvalidationEvent): InvalidationRule[] {
    const matchingRules: InvalidationRule[] = [];
    
    for (const rule of this.invalidationRules.values()) {
      if (rule.enabled && this.matchesEvent(rule, event)) {
        matchingRules.push(rule);
      }
    }
    
    // Sort by priority (higher priority first)
    return matchingRules.sort((a, b) => b.priority - a.priority);
  }

  private matchesEvent(rule: InvalidationRule, event: InvalidationEvent): boolean {
    // Check if rule pattern matches event
    if (rule.type === 'event-driven' && rule.pattern) {
      const regex = new RegExp(rule.pattern);
      return regex.test(event.type);
    }
    
    // Check conditions
    if (rule.conditions.length > 0) {
      return rule.conditions.every(condition => this.evaluateCondition(condition, event));
    }
    
    return false;
  }

  private evaluateCondition(condition: InvalidationCondition, event: InvalidationEvent): boolean {
    const eventValue = this.getEventValue(condition.field, event);
    
    switch (condition.operator) {
      case 'equals':
        return eventValue === condition.value;
      case 'not_equals':
        return eventValue !== condition.value;
      case 'contains':
        return String(eventValue).includes(String(condition.value));
      case 'not_contains':
        return !String(eventValue).includes(String(condition.value));
      case 'greater_than':
        return Number(eventValue) > Number(condition.value);
      case 'less_than':
        return Number(eventValue) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(eventValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(eventValue);
      default:
        return false;
    }
  }

  private getEventValue(field: string, event: InvalidationEvent): any {
    switch (field) {
      case 'type':
        return event.type;
      case 'source':
        return event.source;
      case 'timestamp':
        return event.timestamp;
      case 'data':
        return event.data;
      default:
        return event.data[field];
    }
  }

  private async executeInvalidationRule(rule: InvalidationRule, event: InvalidationEvent): Promise<void> {
    switch (rule.type) {
      case 'time-based':
        await this.executeTimeBasedRule(rule, event);
        break;
      case 'event-driven':
        await this.executeEventDrivenRule(rule, event);
        break;
      case 'dependency-based':
        await this.executeDependencyBasedRule(rule, event);
        break;
      case 'manual':
        await this.executeManualRule(rule, event);
        break;
    }
  }

  private async executeTimeBasedRule(rule: InvalidationRule, event: InvalidationEvent): Promise<void> {
    // Time-based invalidation
    const ttl = rule.conditions.find(c => c.field === 'ttl')?.value;
    if (ttl) {
      // This would be handled by Redis TTL
      this.logger.debug(`Time-based rule executed: ${rule.name}`);
    }
  }

  private async executeEventDrivenRule(rule: InvalidationRule, event: InvalidationEvent): Promise<void> {
    // Event-driven invalidation
    const pattern = rule.pattern || event.type;
    await this.invalidateByPattern(pattern, { cascade: true });
    this.logger.debug(`Event-driven rule executed: ${rule.name}`, { eventType: event.type });
  }

  private async executeDependencyBasedRule(rule: InvalidationRule, event: InvalidationEvent): Promise<void> {
    // Dependency-based invalidation
    const affectedKeys = this.getAffectedDependencies(event.data);
    for (const key of affectedKeys) {
      await this.invalidateByKey(key, true);
    }
    this.logger.debug(`Dependency-based rule executed: ${rule.name}`, { affectedKeys });
  }

  private async executeManualRule(rule: InvalidationRule, event: InvalidationEvent): Promise<void> {
    // Manual invalidation
    const pattern = rule.pattern || '*';
    await this.invalidateByPattern(pattern);
    this.logger.debug(`Manual rule executed: ${rule.name}`);
  }

  private findMatchingKeys(pattern: string, keys: any): string[] {
    const regex = new RegExp(pattern);
    return Object.keys(keys).filter(key => regex.test(key));
  }

  private async getDependentKeys(keys: string[]): Promise<string[]> {
    const dependentKeys: string[] = [];
    
    for (const key of keys) {
      const dependencies = this.dependencyGraph.edges.get(key) || [];
      dependentKeys.push(...dependencies);
      
      // Recursively get transitive dependencies
      const transitiveDeps = await this.getTransitiveDependencies(dependencies, new Set());
      dependentKeys.push(...transitiveDeps);
    }
    
    return [...new Set(dependentKeys)];
  }

  private async getTransitiveDependencies(keys: string[], visited: Set<string>): Promise<string[]> {
    const transitive: string[] = [];
    
    for (const key of keys) {
      if (visited.has(key)) {
        continue;
      }
      
      visited.add(key);
      const dependencies = this.dependencyGraph.edges.get(key) || [];
      transitive.push(...dependencies);
      
      const childDeps = await this.getTransitiveDependencies(dependencies, visited);
      transitive.push(...childDeps);
    }
    
    return transitive;
  }

  private getAffectedDependencies(data: any): string[] {
    // Extract keys from event data that might affect dependencies
    const affectedKeys: string[] = [];
    
    if (data.key) {
      affectedKeys.push(data.key);
    }
    
    if (data.keys && Array.isArray(data.keys)) {
      affectedKeys.push(...data.keys);
    }
    
    return affectedKeys;
  }

  private buildPatternFromStrategy(strategy: InvalidationStrategy): string {
    if (strategy.config.events && strategy.config.events.length > 0) {
      return strategy.config.events.join('|');
    }
    return '*';
  }

  private buildConditionsFromStrategy(strategy: InvalidationStrategy): InvalidationCondition[] {
    const conditions: InvalidationCondition[] = [];
    
    if (strategy.config.ttl) {
      conditions.push({
        field: 'ttl',
        operator: 'equals',
        value: strategy.config.ttl
      });
    }
    
    return conditions;
  }

  private getPriorityFromStrategy(strategy: InvalidationStrategy): number {
    // Assign priority based on strategy type
    switch (strategy.type) {
      case 'time-based':
        return 1;
      case 'event-driven':
        return 2;
      case 'dependency-based':
        return 3;
      case 'manual':
        return 4;
      default:
        return 0;
    }
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
