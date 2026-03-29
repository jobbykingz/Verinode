import { Request, Response } from 'express';
import { logger } from '../utils/logger';

export interface TransformationConfig {
  enableRequestTransformation: boolean;
  enableResponseTransformation: boolean;
  defaultFormat: 'json' | 'xml' | 'yaml';
}

export interface RequestTransformation {
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  path?: Record<string, string>;
  format?: 'json' | 'xml' | 'yaml';
  template?: string;
  script?: string;
}

export interface ResponseTransformation {
  headers?: Record<string, string>;
  body?: any;
  statusCode?: number;
  format?: 'json' | 'xml' | 'yaml';
  template?: string;
  script?: string;
  filters?: Array<{
    type: 'map' | 'filter' | 'reduce' | 'sort';
    field?: string;
    condition?: any;
    value?: any;
  }>;
}

export interface TransformationRule {
  id: string;
  name: string;
  description?: string;
  input: {
    type: 'json' | 'xml' | 'yaml' | 'text' | 'binary';
    schema?: any;
  };
  output: {
    type: 'json' | 'xml' | 'yaml' | 'text' | 'binary';
    schema?: any;
  };
  transformation: {
    type: 'mapping' | 'template' | 'script' | 'xslt';
    definition: any;
  };
  conditions?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'exists';
    value: any;
  }>;
}

export class RequestTransformer {
  private config: TransformationConfig;
  private transformationRules: Map<string, TransformationRule> = new Map();

  constructor(config: TransformationConfig) {
    this.config = config;
  }

  public addTransformationRule(rule: TransformationRule): void {
    this.transformationRules.set(rule.id, rule);
    logger.info(`Transformation rule added: ${rule.id}`);
  }

  public removeTransformationRule(ruleId: string): void {
    if (this.transformationRules.delete(ruleId)) {
      logger.info(`Transformation rule removed: ${ruleId}`);
    }
  }

  public getTransformationRule(ruleId: string): TransformationRule | undefined {
    return this.transformationRules.get(ruleId);
  }

  public async transformRequest(req: Request, transformation: RequestTransformation): Promise<Request> {
    if (!this.config.enableRequestTransformation) {
      return req;
    }

    try {
      // Clone the request to avoid modifying the original
      const transformedReq = { ...req } as any;

      // Transform headers
      if (transformation.headers) {
        transformedReq.headers = { ...req.headers, ...transformation.headers };
      }

      // Transform query parameters
      if (transformation.query) {
        transformedReq.query = { ...req.query, ...transformation.query };
      }

      // Transform path parameters
      if (transformation.path) {
        transformedReq.params = { ...req.params, ...transformation.path };
      }

      // Transform body
      if (transformation.body) {
        transformedReq.body = await this.transformBody(req.body, transformation.body);
      }

      // Format transformation
      if (transformation.format && transformation.format !== this.config.defaultFormat) {
        transformedReq.body = await this.transformFormat(
          transformedReq.body,
          this.config.defaultFormat,
          transformation.format
        );
      }

      // Template transformation
      if (transformation.template) {
        transformedReq.body = await this.applyTemplate(
          transformedReq.body,
          transformation.template,
          transformedReq
        );
      }

      // Script transformation
      if (transformation.script) {
        transformedReq.body = await this.executeScript(
          transformedReq.body,
          transformation.script,
          transformedReq
        );
      }

      return transformedReq;
    } catch (error) {
      logger.error('Request transformation error:', error);
      throw new Error(`Request transformation failed: ${error.message}`);
    }
  }

  public async transformResponse(response: any, transformation: ResponseTransformation): Promise<any> {
    if (!this.config.enableResponseTransformation) {
      return response;
    }

    try {
      const transformedResponse = { ...response };

      // Transform headers
      if (transformation.headers) {
        transformedResponse.headers = {
          ...response.headers,
          ...transformation.headers,
        };
      }

      // Transform status code
      if (transformation.statusCode) {
        transformedResponse.statusCode = transformation.statusCode;
      }

      // Transform body
      if (transformation.body) {
        transformedResponse.body = await this.transformBody(response.body, transformation.body);
      }

      // Apply filters
      if (transformation.filters) {
        transformedResponse.body = await this.applyFilters(
          transformedResponse.body,
          transformation.filters
        );
      }

      // Format transformation
      if (transformation.format && transformation.format !== this.config.defaultFormat) {
        transformedResponse.body = await this.transformFormat(
          transformedResponse.body,
          this.config.defaultFormat,
          transformation.format
        );
      }

      // Template transformation
      if (transformation.template) {
        transformedResponse.body = await this.applyTemplate(
          transformedResponse.body,
          transformation.template,
          { response }
        );
      }

      // Script transformation
      if (transformation.script) {
        transformedResponse.body = await this.executeScript(
          transformedResponse.body,
          transformation.script,
          { response }
        );
      }

      return transformedResponse;
    } catch (error) {
      logger.error('Response transformation error:', error);
      throw new Error(`Response transformation failed: ${error.message}`);
    }
  }

  private async transformBody(originalBody: any, transformation: any): Promise<any> {
    if (typeof transformation === 'object' && transformation !== null) {
      // Object mapping transformation
      return this.mapObject(originalBody, transformation);
    } else if (typeof transformation === 'string') {
      // Template string transformation
      return this.processTemplate(transformation, originalBody);
    } else {
      // Direct replacement
      return transformation;
    }
  }

  private mapObject(source: any, mapping: any): any {
    if (Array.isArray(mapping)) {
      return mapping.map(item => this.mapObject(source, item));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        // Reference to source field
        const sourceKey = value.substring(1);
        result[key] = this.getNestedValue(source, sourceKey);
      } else if (typeof value === 'object' && value !== null) {
        // Nested object mapping
        result[key] = this.mapObject(source, value);
      } else {
        // Static value
        result[key] = value;
      }
    }
    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private async transformFormat(data: any, fromFormat: string, toFormat: string): Promise<any> {
    switch (toFormat) {
      case 'json':
        return this.toJSON(data);
      case 'xml':
        return this.toXML(data);
      case 'yaml':
        return this.toYAML(data);
      default:
        return data;
    }
  }

  private toJSON(data: any): any {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        throw new Error(`Invalid JSON: ${error.message}`);
      }
    }
    return data;
  }

  private toXML(data: any): string {
    // Simple XML conversion - in production, use a proper XML library
    const xml = this.objectToXML(data, 'root');
    return `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
  }

  private objectToXML(obj: any, rootName: string): string {
    if (Array.isArray(obj)) {
      return obj.map(item => this.objectToXML(item, rootName.slice(0, -1))).join('');
    }

    if (typeof obj === 'object' && obj !== null) {
      const entries = Object.entries(obj)
        .map(([key, value]) => `<${key}>${this.objectToXML(value, key)}</${key}>`)
        .join('');
      return `<${rootName}>${entries}</${rootName}>`;
    }

    return `<${rootName}>${this.escapeXML(String(obj))}</${rootName}>`;
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private toYAML(data: any): string {
    // Simple YAML conversion - in production, use a proper YAML library
    return this.objectToYAML(data, 0);
  }

  private objectToYAML(obj: any, indent: number): string {
    const spaces = '  '.repeat(indent);

    if (Array.isArray(obj)) {
      return obj.map(item => `${spaces}- ${this.objectToYAML(item, indent + 1)}`).join('\n');
    }

    if (typeof obj === 'object' && obj !== null) {
      return Object.entries(obj)
        .map(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            return `${spaces}${key}:\n${this.objectToYAML(value, indent + 1)}`;
          }
          return `${spaces}${key}: ${value}`;
        })
        .join('\n');
    }

    return `${spaces}${obj}`;
  }

  private async applyTemplate(data: any, template: string, context: any): Promise<any> {
    try {
      // Simple template engine - in production, use a proper template engine
      const processedTemplate = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = this.getNestedValue({ ...context, data }, path.trim());
        return value !== undefined ? String(value) : match;
      });

      // Try to parse as JSON if it looks like JSON
      if (processedTemplate.trim().startsWith('{') || processedTemplate.trim().startsWith('[')) {
        return JSON.parse(processedTemplate);
      }

      return processedTemplate;
    } catch (error) {
      logger.error('Template application error:', error);
      return data;
    }
  }

  private async executeScript(data: any, script: string, context: any): Promise<any> {
    try {
      // WARNING: This is a simplified implementation for demonstration
      // In production, use a secure sandboxed JavaScript engine
      const func = new Function('data', 'context', 'logger', script);
      return func(data, context, logger);
    } catch (error) {
      logger.error('Script execution error:', error);
      return data;
    }
  }

  private async applyFilters(data: any, filters: any[]): Promise<any> {
    let result = data;

    for (const filter of filters) {
      switch (filter.type) {
        case 'map':
          result = this.applyMapFilter(result, filter);
          break;
        case 'filter':
          result = this.applyArrayFilter(result, filter);
          break;
        case 'reduce':
          result = this.applyReduceFilter(result, filter);
          break;
        case 'sort':
          result = this.applySortFilter(result, filter);
          break;
      }
    }

    return result;
  }

  private applyMapFilter(data: any, filter: any): any {
    if (!Array.isArray(data)) return data;

    return data.map(item => {
      if (filter.field) {
        return this.getNestedValue(item, filter.field);
      }
      if (filter.value !== undefined) {
        return filter.value;
      }
      return item;
    });
  }

  private applyArrayFilter(data: any, filter: any): any {
    if (!Array.isArray(data)) return data;

    return data.filter(item => {
      if (filter.field && filter.condition !== undefined) {
        const value = this.getNestedValue(item, filter.field);
        return this.evaluateCondition(value, filter.condition);
      }
      return true;
    });
  }

  private applyReduceFilter(data: any, filter: any): any {
    if (!Array.isArray(data)) return data;

    return data.reduce((acc, item) => {
      if (filter.field) {
        const value = this.getNestedValue(item, filter.field);
        return acc + (typeof value === 'number' ? value : 0);
      }
      return acc;
    }, filter.value || 0);
  }

  private applySortFilter(data: any, filter: any): any {
    if (!Array.isArray(data)) return data;

    return data.sort((a, b) => {
      if (filter.field) {
        const aValue = this.getNestedValue(a, filter.field);
        const bValue = this.getNestedValue(b, filter.field);
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue);
        }
        return aValue - bValue;
      }
      return 0;
    });
  }

  private evaluateCondition(value: any, condition: any): boolean {
    if (condition === null) return value === null;
    if (condition === undefined) return value === undefined;
    
    if (typeof condition === 'object' && condition !== null) {
      const { operator, operand } = condition;
      switch (operator) {
        case 'eq': return value === operand;
        case 'ne': return value !== operand;
        case 'gt': return value > operand;
        case 'lt': return value < operand;
        case 'gte': return value >= operand;
        case 'lte': return value <= operand;
        case 'in': return Array.isArray(operand) && operand.includes(value);
        case 'nin': return Array.isArray(operand) && !operand.includes(value);
        case 'exists': return operand ? value !== undefined : value === undefined;
      }
    }
    
    return value === condition;
  }

  private processTemplate(template: string, data: any): any {
    try {
      const processed = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = this.getNestedValue(data, path.trim());
        return value !== undefined ? String(value) : match;
      });

      // Try to parse as JSON
      if (processed.trim().startsWith('{') || processed.trim().startsWith('[')) {
        return JSON.parse(processed);
      }

      return processed;
    } catch (error) {
      logger.error('Template processing error:', error);
      return data;
    }
  }

  public async applyTransformationRule(
    data: any,
    ruleId: string,
    context?: any
  ): Promise<any> {
    const rule = this.transformationRules.get(ruleId);
    if (!rule) {
      throw new Error(`Transformation rule not found: ${ruleId}`);
    }

    // Check conditions
    if (rule.conditions && context) {
      const conditionsMet = rule.conditions.every(condition => {
        const value = this.getNestedValue(context, condition.field);
        return this.evaluateCondition(value, condition.value);
      });

      if (!conditionsMet) {
        return data; // Return original data if conditions are not met
      }
    }

    // Apply transformation based on type
    switch (rule.transformation.type) {
      case 'mapping':
        return this.mapObject(data, rule.transformation.definition);
      case 'template':
        return this.applyTemplate(data, rule.transformation.definition, context);
      case 'script':
        return this.executeScript(data, rule.transformation.definition, context);
      case 'xslt':
        // XSLT transformation would require additional libraries
        logger.warn('XSLT transformation not implemented');
        return data;
      default:
        return data;
    }
  }

  public getConfig(): TransformationConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<TransformationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('RequestTransformer configuration updated');
  }
}
