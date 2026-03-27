import { logger } from '../monitoringService';

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'exists' | 'not_exists';
  value: any;
  caseSensitive?: boolean;
}

export interface FilterRule {
  id: string;
  name: string;
  conditions: FilterCondition[];
  logic: 'AND' | 'OR';
  enabled: boolean;
  priority: number;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  retryPolicy: any;
  rateLimit: any;
  filters: {
    eventTypes: string[];
    payloadConditions: Record<string, any>;
  };
}

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: Date;
  payload: any;
  source: string;
}

export class WebhookFilter {
  private filterRules: Map<string, FilterRule> = new Map();
  private compiledFilters: Map<string, (event: WebhookEvent) => boolean> = new Map();

  constructor() {
    this.setupDefaultFilters();
  }

  private setupDefaultFilters(): void {
    const githubPushFilter: FilterRule = {
      id: 'github-push-only',
      name: 'GitHub Push Events Only',
      conditions: [
        { field: 'source', operator: 'equals', value: 'github' },
        { field: 'type', operator: 'equals', value: 'push' }
      ],
      logic: 'AND',
      enabled: true,
      priority: 1
    };

    const highValueEventsFilter: FilterRule = {
      id: 'high-value-events',
      name: 'High Value Events',
      conditions: [
        { field: 'payload.repository.stargazers_count', operator: 'greater_than', value: 100 },
        { field: 'type', operator: 'in', value: ['push', 'release', 'pull_request'] }
      ],
      logic: 'OR',
      enabled: false,
      priority: 2
    };

    this.filterRules.set(githubPushFilter.id, githubPushFilter);
    this.filterRules.set(highValueEventsFilter.id, highValueEventsFilter);

    this.compileAllFilters();
  }

  shouldDeliver(webhook: WebhookConfig, event: WebhookEvent): boolean {
    try {
      if (!webhook.active) {
        return false;
      }

      if (!this.matchesEventType(webhook, event)) {
        return false;
      }

      if (!this.matchesPayloadConditions(webhook, event)) {
        return false;
      }

      if (!this.matchesCustomFilters(webhook, event)) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in webhook filtering', {
        error: error.message,
        webhookId: webhook.id,
        eventId: event.id
      });
      return false;
    }
  }

  private matchesEventType(webhook: WebhookConfig, event: WebhookEvent): boolean {
    if (webhook.filters.eventTypes.length === 0) {
      return true;
    }

    return webhook.filters.eventTypes.includes(event.type);
  }

  private matchesPayloadConditions(webhook: WebhookConfig, event: WebhookEvent): boolean {
    const conditions = webhook.filters.payloadConditions;
    
    if (Object.keys(conditions).length === 0) {
      return true;
    }

    return Object.entries(conditions).every(([fieldPath, expectedValue]) => {
      const actualValue = this.getNestedValue(event.payload, fieldPath);
      return this.compareValues(actualValue, expectedValue, 'equals');
    });
  }

  private matchesCustomFilters(webhook: WebhookConfig, event: WebhookEvent): boolean {
    const enabledFilters = Array.from(this.filterRules.values())
      .filter(filter => filter.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const filter of enabledFilters) {
      const compiledFilter = this.compiledFilters.get(filter.id);
      if (compiledFilter && compiledFilter(event)) {
        logger.debug(`Event matched custom filter: ${filter.name}`, {
          eventId: event.id,
          filterId: filter.id
        });
        return true;
      }
    }

    return enabledFilters.length === 0;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private compareValues(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'contains':
        return typeof actual === 'string' && actual.includes(expected);
      case 'not_contains':
        return typeof actual === 'string' && !actual.includes(expected);
      case 'starts_with':
        return typeof actual === 'string' && actual.startsWith(expected);
      case 'ends_with':
        return typeof actual === 'string' && actual.endsWith(expected);
      case 'greater_than':
        return Number(actual) > Number(expected);
      case 'less_than':
        return Number(actual) < Number(expected);
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'not_exists':
        return actual === undefined || actual === null;
      default:
        return false;
    }
  }

  createFilterRule(rule: FilterRule): void {
    this.filterRules.set(rule.id, rule);
    this.compileFilter(rule);
    logger.info(`Filter rule created: ${rule.name}`, { ruleId: rule.id });
  }

  updateFilterRule(ruleId: string, updates: Partial<FilterRule>): void {
    const existingRule = this.filterRules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Filter rule not found: ${ruleId}`);
    }

    const updatedRule = { ...existingRule, ...updates };
    this.filterRules.set(ruleId, updatedRule);
    this.compileFilter(updatedRule);
    
    logger.info(`Filter rule updated: ${updatedRule.name}`, { ruleId });
  }

  deleteFilterRule(ruleId: string): void {
    const deleted = this.filterRules.delete(ruleId);
    if (deleted) {
      this.compiledFilters.delete(ruleId);
      logger.info(`Filter rule deleted: ${ruleId}`);
    }
  }

  getFilterRule(ruleId: string): FilterRule | undefined {
    return this.filterRules.get(ruleId);
  }

  getAllFilterRules(): FilterRule[] {
    return Array.from(this.filterRules.values());
  }

  enableFilterRule(ruleId: string): void {
    this.updateFilterRule(ruleId, { enabled: true });
  }

  disableFilterRule(ruleId: string): void {
    this.updateFilterRule(ruleId, { enabled: false });
  }

  private compileFilter(rule: FilterRule): void {
    const compiledFunction = this.createFilterFunction(rule);
    this.compiledFilters.set(rule.id, compiledFunction);
  }

  private compileAllFilters(): void {
    for (const rule of this.filterRules.values()) {
      this.compileFilter(rule);
    }
  }

  private createFilterFunction(rule: FilterRule): (event: WebhookEvent) => boolean {
    const conditionFunctions = rule.conditions.map(condition => 
      this.createConditionFunction(condition)
    );

    return (event: WebhookEvent): boolean => {
      if (rule.logic === 'AND') {
        return conditionFunctions.every(fn => fn(event));
      } else {
        return conditionFunctions.some(fn => fn(event));
      }
    };
  }

  private createConditionFunction(condition: FilterCondition): (event: WebhookEvent) => boolean {
    return (event: WebhookEvent): boolean => {
      let actualValue: any;

      if (condition.field.startsWith('payload.')) {
        actualValue = this.getNestedValue(event.payload, condition.field.substring(7));
      } else if (condition.field.startsWith('event.')) {
        actualValue = this.getNestedValue(event, condition.field.substring(6));
      } else {
        actualValue = this.getNestedValue(event, condition.field);
      }

      if (condition.caseSensitive === false && typeof actualValue === 'string' && typeof condition.value === 'string') {
        actualValue = actualValue.toLowerCase();
        condition.value = condition.value.toLowerCase();
      }

      return this.compareValues(actualValue, condition.value, condition.operator);
    };
  }

  testFilterRule(ruleId: string, testEvent: WebhookEvent): boolean {
    const compiledFilter = this.compiledFilters.get(ruleId);
    if (!compiledFilter) {
      throw new Error(`Compiled filter not found: ${ruleId}`);
    }

    return compiledFilter(testEvent);
  }

  getMatchingFilters(event: WebhookEvent): FilterRule[] {
    return Array.from(this.filterRules.values())
      .filter(rule => rule.enabled)
      .filter(rule => {
        const compiledFilter = this.compiledFilters.get(rule.id);
        return compiledFilter && compiledFilter(event);
      });
  }

  validateFilterRule(rule: FilterRule): string[] {
    const errors: string[] = [];

    if (!rule.id || rule.id.trim() === '') {
      errors.push('Filter rule ID is required');
    }

    if (!rule.name || rule.name.trim() === '') {
      errors.push('Filter rule name is required');
    }

    if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      errors.push('Filter rule must have at least one condition');
    }

    rule.conditions.forEach((condition, index) => {
      if (!condition.field || condition.field.trim() === '') {
        errors.push(`Condition ${index + 1}: field is required`);
      }

      if (!condition.operator || !this.isValidOperator(condition.operator)) {
        errors.push(`Condition ${index + 1}: invalid operator`);
      }

      if (condition.value === undefined && !['exists', 'not_exists'].includes(condition.operator)) {
        errors.push(`Condition ${index + 1}: value is required for operator ${condition.operator}`);
      }
    });

    if (!['AND', 'OR'].includes(rule.logic)) {
      errors.push('Filter rule logic must be AND or OR');
    }

    return errors;
  }

  private isValidOperator(operator: string): boolean {
    const validOperators = [
      'equals', 'not_equals', 'contains', 'not_contains',
      'starts_with', 'ends_with', 'greater_than', 'less_than',
      'in', 'not_in', 'exists', 'not_exists'
    ];

    return validOperators.includes(operator);
  }

  exportFilterRules(): FilterRule[] {
    return Array.from(this.filterRules.values());
  }

  importFilterRules(rules: FilterRule[]): void {
    for (const rule of rules) {
      const errors = this.validateFilterRule(rule);
      if (errors.length === 0) {
        this.filterRules.set(rule.id, rule);
        this.compileFilter(rule);
      } else {
        logger.warn(`Skipping invalid filter rule during import: ${rule.id}`, { errors });
      }
    }

    logger.info(`Imported ${rules.length} filter rules`);
  }

  getFilterStatistics(): any {
    const rules = Array.from(this.filterRules.values());
    
    return {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      disabledRules: rules.filter(r => !r.enabled).length,
      rulesByLogic: {
        AND: rules.filter(r => r.logic === 'AND').length,
        OR: rules.filter(r => r.logic === 'OR').length
      },
      averageConditionsPerRule: rules.length > 0 
        ? rules.reduce((sum, rule) => sum + rule.conditions.length, 0) / rules.length
        : 0
    };
  }

  async optimizeFilterPerformance(): Promise<void> {
    const rules = Array.from(this.filterRules.values());
    
    for (const rule of rules) {
      if (rule.conditions.length > 10) {
        logger.warn(`Filter rule ${rule.id} has many conditions (${rule.conditions.length}), consider optimization`);
      }

      const hasComplexConditions = rule.conditions.some(condition => 
        condition.operator === 'in' && Array.isArray(condition.value) && condition.value.length > 100
      );

      if (hasComplexConditions) {
        logger.warn(`Filter rule ${rule.id} has complex conditions that may impact performance`);
      }
    }

    logger.info('Filter performance optimization analysis completed');
  }
}
