import { AuditLog, IAuditLog, AuditEventType, AuditSeverity, AuditStatus } from '../models/AuditLog';
import mongoose from 'mongoose';
import winston from 'winston';

/**
 * Query Filters
 */
export interface AuditQueryFilters {
  // Time filters
  fromDate?: Date;
  toDate?: Date;
  dateRange?: {
    start: Date;
    end: Date;
  };
  
  // Event filters
  eventTypes?: AuditEventType[];
  severity?: AuditSeverity[];
  status?: AuditStatus[];
  
  // User filters
  userIds?: string[];
  sessionIds?: string[];
  
  // Resource filters
  resourceTypes?: string[];
  resourceIds?: string[];
  
  // Network filters
  ipAddresses?: string[];
  
  // Request filters
  requestIds?: string[];
  correlationIds?: string[];
  methods?: string[];
  endpoints?: string[];
  
  // Compliance filters
  complianceFrameworks?: string[];
  tags?: string[];
  
  // Processing filters
  processed?: boolean;
  alertTriggered?: boolean;
  isArchived?: boolean;
  
  // Text search
  searchText?: string;
  
  // Data change filters
  hasDataChanges?: boolean;
  changedFields?: string[];
}

/**
 * Query Options
 */
export interface AuditQueryOptions {
  // Pagination
  page?: number;
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  
  // Field selection
  fields?: string[];
  excludeFields?: string[];
  
  // Aggregation
  groupBy?: string[];
  aggregate?: {
    count?: boolean;
    sum?: string[];
    avg?: string[];
    min?: string[];
    max?: string[];
  };
  
  // Performance
  cache?: boolean;
  cacheTTL?: number;
  maxScan?: number;
  
  // Output format
  format?: 'json' | 'csv' | 'xml';
}

/**
 * Query Result
 */
export interface AuditQueryResult {
  data: IAuditLog[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  executionTime: number;
  cached: boolean;
  
  // Aggregation results
  aggregations?: {
    [key: string]: any;
  };
  
  // Query metadata
  query: {
    filters: AuditQueryFilters;
    options: AuditQueryOptions;
  };
}

/**
 * Analytics Result
 */
export interface AuditAnalyticsResult {
  // Time series data
  timeline: {
    timestamp: Date;
    count: number;
    severityBreakdown: Record<AuditSeverity, number>;
    eventTypeBreakdown: Record<string, number>;
  }[];
  
  // Summary statistics
  summary: {
    totalEvents: number;
    uniqueUsers: number;
    uniqueResources: number;
    criticalEvents: number;
    securityEvents: number;
    complianceEvents: number;
  };
  
  // Top metrics
  topUsers: Array<{
    userId: string;
    eventCount: number;
    lastActivity: Date;
  }>;
  
  topResources: Array<{
    resourceType: string;
    resourceId: string;
    eventCount: number;
    lastActivity: Date;
  }>;
  
  topEventTypes: Array<{
    eventType: AuditEventType;
    count: number;
    percentage: number;
  }>;
  
  // Security metrics
  securityMetrics: {
    suspiciousActivity: number;
    blockedRequests: number;
    failedLogins: number;
    uniqueIPs: number;
    geoDistribution: Record<string, number>;
  };
}

/**
 * Advanced Audit Query Service
 * 
 * Provides powerful search and filtering capabilities for audit logs:
 * - Complex filtering with multiple criteria
 * - Full-text search capabilities
 * - Aggregation and analytics
 * - Performance optimization with caching
 * - Export capabilities
 */
export class AuditQuery {
  private logger: winston.Logger;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/audit-query.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * Search audit logs with filters
   */
  async search(
    filters: AuditQueryFilters = {},
    options: AuditQueryOptions = {}
  ): Promise<AuditQueryResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(filters, options);
      if (options.cache && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < cached.ttl) {
          this.logger.debug('Query result retrieved from cache', { cacheKey });
          return {
            ...cached.data,
            cached: true,
            executionTime: Date.now() - startTime
          };
        }
      }

      // Build MongoDB query
      const query = this.buildQuery(filters);
      const mongoOptions = this.buildMongoOptions(options);

      // Execute query
      const [data, total] = await Promise.all([
        AuditLog.find(query, this.buildProjection(options), mongoOptions),
        this.countDocuments(query)
      ]);

      // Process results
      const result: AuditQueryResult = {
        data,
        total,
        page: options.page || 1,
        limit: options.limit || 50,
        hasMore: this.hasMore(data, options),
        executionTime: Date.now() - startTime,
        cached: false,
        query: { filters, options }
      };

      // Add aggregations if requested
      if (options.aggregate) {
        result.aggregations = await this.performAggregation(query, options.aggregate);
      }

      // Cache result if enabled
      if (options.cache) {
        const ttl = options.cacheTTL || 300000; // 5 minutes default
        this.cache.set(cacheKey, { data: result, timestamp: Date.now(), ttl });
      }

      this.logger.info('Query executed successfully', {
        total: result.total,
        executionTime: result.executionTime,
        cached: result.cached
      });

      return result;
    } catch (error) {
      this.logger.error('Query execution failed', { error, filters, options });
      throw error;
    }
  }

  /**
   * Get audit analytics
   */
  async getAnalytics(
    filters: AuditQueryFilters = {},
    timeGrouping: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<AuditAnalyticsResult> {
    try {
      const query = this.buildQuery(filters);
      
      // Time series aggregation
      const timeline = await this.getTimelineData(query, timeGrouping);
      
      // Summary statistics
      const summary = await this.getSummaryStats(query);
      
      // Top metrics
      const [topUsers, topResources, topEventTypes] = await Promise.all([
        this.getTopUsers(query),
        this.getTopResources(query),
        this.getTopEventTypes(query)
      ]);
      
      // Security metrics
      const securityMetrics = await this.getSecurityMetrics(query);

      const result: AuditAnalyticsResult = {
        timeline,
        summary,
        topUsers,
        topResources,
        topEventTypes,
        securityMetrics
      };

      this.logger.info('Analytics generated successfully', {
        totalEvents: summary.totalEvents,
        timeGrouping
      });

      return result;
    } catch (error) {
      this.logger.error('Analytics generation failed', { error, filters });
      throw error;
    }
  }

  /**
   * Full-text search
   */
  async fullTextSearch(
    searchText: string,
    options: {
      limit?: number;
      offset?: number;
      filters?: AuditQueryFilters;
    } = {}
  ): Promise<AuditQueryResult> {
    try {
      const query = this.buildQuery(options.filters || {});
      query.$text = { $search: searchText };

      const mongoOptions: any = {
        sort: { score: { $meta: 'textScore' }, timestamp: -1 },
        limit: options.limit || 50,
        skip: options.offset || 0
      };

      const data = await AuditLog.find(query, { score: { $meta: 'textScore' } }, mongoOptions);
      const total = await AuditLog.countDocuments(query);

      return {
        data,
        total,
        page: Math.floor((options.offset || 0) / (options.limit || 50)) + 1,
        limit: options.limit || 50,
        hasMore: (options.offset || 0) + data.length < total,
        executionTime: 0, // Would be measured in real implementation
        cached: false,
        query: { filters: options.filters || {}, options: {} }
      };
    } catch (error) {
      this.logger.error('Full-text search failed', { error, searchText });
      throw error;
    }
  }

  /**
   * Export audit logs
   */
  async export(
    filters: AuditQueryFilters = {},
    format: 'json' | 'csv' | 'xml' = 'json',
    options: {
      maxRecords?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<Buffer> {
    try {
      const query = this.buildQuery(filters);
      const limit = options.maxRecords || 10000;
      
      const data = await AuditLog
        .find(query)
        .limit(limit)
        .sort({ timestamp: -1 });

      let result: Buffer;

      switch (format) {
        case 'json':
          result = this.exportToJSON(data, options.includeMetadata);
          break;
        case 'csv':
          result = this.exportToCSV(data);
          break;
        case 'xml':
          result = this.exportToXML(data, options.includeMetadata);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      this.logger.info('Export completed', {
        format,
        recordCount: data.length,
        size: result.length
      });

      return result;
    } catch (error) {
      this.logger.error('Export failed', { error, format, filters });
      throw error;
    }
  }

  /**
   * Get query suggestions
   */
  async getQuerySuggestions(partial: string): Promise<string[]> {
    try {
      // This would typically use a search index or autocomplete service
      // For now, return basic suggestions based on event types and resource types
      const suggestions = [
        ...Object.values(AuditEventType),
        'User', 'Proof', 'BatchOperation', 'System', 'Security', 'Compliance'
      ].filter(item => 
        item.toLowerCase().includes(partial.toLowerCase())
      );

      return suggestions.slice(0, 10);
    } catch (error) {
      this.logger.error('Failed to get query suggestions', { error, partial });
      return [];
    }
  }

  /**
   * Validate query filters
   */
  validateFilters(filters: AuditQueryFilters): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate date range
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      errors.push('fromDate must be before toDate');
    }

    // Validate event types
    if (filters.eventTypes) {
      const validEventTypes = Object.values(AuditEventType);
      const invalidEventTypes = filters.eventTypes.filter(
        type => !validEventTypes.includes(type as AuditEventType)
      );
      if (invalidEventTypes.length > 0) {
        errors.push(`Invalid event types: ${invalidEventTypes.join(', ')}`);
      }
    }

    // Validate severity
    if (filters.severity) {
      const validSeverities = Object.values(AuditSeverity);
      const invalidSeverities = filters.severity.filter(
        severity => !validSeverities.includes(severity as AuditSeverity)
      );
      if (invalidSeverities.length > 0) {
        errors.push(`Invalid severities: ${invalidSeverities.join(', ')}`);
      }
    }

    // Validate status
    if (filters.status) {
      const validStatuses = Object.values(AuditStatus);
      const invalidStatuses = filters.status.filter(
        status => !validStatuses.includes(status as AuditStatus)
      );
      if (invalidStatuses.length > 0) {
        errors.push(`Invalid statuses: ${invalidStatuses.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Private helper methods
   */
  private buildQuery(filters: AuditQueryFilters): any {
    const query: any = {};

    // Time filters
    if (filters.fromDate || filters.toDate) {
      query.timestamp = {};
      if (filters.fromDate) query.timestamp.$gte = filters.fromDate;
      if (filters.toDate) query.timestamp.$lte = filters.toDate;
    }

    if (filters.dateRange) {
      query.timestamp = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    // Event filters
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      query.eventType = { $in: filters.eventTypes };
    }

    if (filters.severity && filters.severity.length > 0) {
      query.severity = { $in: filters.severity };
    }

    if (filters.status && filters.status.length > 0) {
      query.status = { $in: filters.status };
    }

    // User filters
    if (filters.userIds && filters.userIds.length > 0) {
      query.userId = { $in: filters.userIds };
    }

    if (filters.sessionIds && filters.sessionIds.length > 0) {
      query.sessionId = { $in: filters.sessionIds };
    }

    // Resource filters
    if (filters.resourceTypes && filters.resourceTypes.length > 0) {
      query.resourceType = { $in: filters.resourceTypes };
    }

    if (filters.resourceIds && filters.resourceIds.length > 0) {
      query.resourceId = { $in: filters.resourceIds };
    }

    // Network filters
    if (filters.ipAddresses && filters.ipAddresses.length > 0) {
      query.ipAddress = { $in: filters.ipAddresses };
    }

    // Request filters
    if (filters.requestIds && filters.requestIds.length > 0) {
      query.requestId = { $in: filters.requestIds };
    }

    if (filters.correlationIds && filters.correlationIds.length > 0) {
      query.correlationId = { $in: filters.correlationIds };
    }

    if (filters.methods && filters.methods.length > 0) {
      query.method = { $in: filters.methods };
    }

    if (filters.endpoints && filters.endpoints.length > 0) {
      query.endpoint = { $in: filters.endpoints };
    }

    // Compliance filters
    if (filters.complianceFrameworks && filters.complianceFrameworks.length > 0) {
      query.complianceFrameworks = { $in: filters.complianceFrameworks };
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    // Processing filters
    if (filters.processed !== undefined) {
      query.processed = filters.processed;
    }

    if (filters.alertTriggered !== undefined) {
      query.alertTriggered = filters.alertTriggered;
    }

    if (filters.isArchived !== undefined) {
      query.isArchived = filters.isArchived;
    }

    // Data change filters
    if (filters.hasDataChanges) {
      query.$or = [
        { oldValues: { $exists: true, $ne: null } },
        { newValues: { $exists: true, $ne: null } }
      ];
    }

    if (filters.changedFields && filters.changedFields.length > 0) {
      query.changedFields = { $in: filters.changedFields };
    }

    return query;
  }

  private buildMongoOptions(options: AuditQueryOptions): any {
    const mongoOptions: any = {};

    // Sorting
    if (options.sortBy) {
      const sortOrder = options.sortOrder || 'desc';
      mongoOptions.sort = { [options.sortBy]: sortOrder === 'desc' ? -1 : 1 };
    } else {
      mongoOptions.sort = { timestamp: -1 }; // Default sort
    }

    // Pagination
    if (options.offset) {
      mongoOptions.skip = options.offset;
    } else if (options.page && options.limit) {
      mongoOptions.skip = (options.page - 1) * options.limit;
    }

    if (options.limit) {
      mongoOptions.limit = options.limit;
    }

    // Performance
    if (options.maxScan) {
      mongoOptions.maxScan = options.maxScan;
    }

    return mongoOptions;
  }

  private buildProjection(options: AuditQueryOptions): any {
    if (options.fields && options.fields.length > 0) {
      const projection: any = {};
      options.fields.forEach(field => {
        projection[field] = 1;
      });
      return projection;
    }

    if (options.excludeFields && options.excludeFields.length > 0) {
      const projection: any = {};
      options.excludeFields.forEach(field => {
        projection[field] = 0;
      });
      return projection;
    }

    return {};
  }

  private async countDocuments(query: any): Promise<number> {
    return AuditLog.countDocuments(query);
  }

  private hasMore(data: IAuditLog[], options: AuditQueryOptions): boolean {
    const limit = options.limit || 50;
    return data.length === limit;
  }

  private async performAggregation(query: any, aggregate: any): Promise<any> {
    const pipeline: any[] = [{ $match: query }];

    if (aggregate.count) {
      pipeline.push({ $count: 'total' });
    }

    if (aggregate.sum || aggregate.avg || aggregate.min || aggregate.max) {
      const groupStage: any = { _id: null };
      
      if (aggregate.sum) {
        aggregate.sum.forEach((field: string) => {
          groupStage[`total_${field}`] = { $sum: `$${field}` };
        });
      }
      
      if (aggregate.avg) {
        aggregate.avg.forEach((field: string) => {
          groupStage[`avg_${field}`] = { $avg: `$${field}` };
        });
      }
      
      if (aggregate.min) {
        aggregate.min.forEach((field: string) => {
          groupStage[`min_${field}`] = { $min: `$${field}` };
        });
      }
      
      if (aggregate.max) {
        aggregate.max.forEach((field: string) => {
          groupStage[`max_${field}`] = { $max: `$${field}` };
        });
      }
      
      pipeline.push({ $group: groupStage });
    }

    const result = await AuditLog.aggregate(pipeline);
    return result[0] || {};
  }

  private async getTimelineData(query: any, grouping: string): Promise<any[]> {
    const groupFormat = this.getGroupFormat(grouping);
    
    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: '$timestamp'
            }
          },
          count: { $sum: 1 },
          severityBreakdown: {
            $push: '$severity'
          },
          eventTypeBreakdown: {
            $push: '$eventType'
          }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const results = await AuditLog.aggregate(pipeline);
    
    return results.map(result => ({
      timestamp: new Date(result._id),
      count: result.count,
      severityBreakdown: this.countOccurrences(result.severityBreakdown),
      eventTypeBreakdown: this.countOccurrences(result.eventTypeBreakdown)
    }));
  }

  private async getSummaryStats(query: any): Promise<any> {
    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueResources: { $addToSet: '$resourceId' },
          criticalEvents: {
            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
          },
          securityEvents: {
            $sum: {
              $cond: [
                { $in: ['$eventType', [
                  'SECURITY_BREACH', 'SUSPICIOUS_ACTIVITY', 'BLOCKED_REQUEST'
                ]] },
                1,
                0
              ]
            }
          },
          complianceEvents: {
            $sum: {
              $cond: [
                { $in: ['$eventType', [
                  'COMPLIANCE_CHECK', 'AUDIT_REPORT_GENERATED', 'REGULATORY_FILING'
                ]] },
                1,
                0
              ]
            }
          }
        }
      }
    ];

    const result = await AuditLog.aggregate(pipeline);
    const data = result[0] || {};

    return {
      totalEvents: data.totalEvents || 0,
      uniqueUsers: (data.uniqueUsers || []).length,
      uniqueResources: (data.uniqueResources || []).length,
      criticalEvents: data.criticalEvents || 0,
      securityEvents: data.securityEvents || 0,
      complianceEvents: data.complianceEvents || 0
    };
  }

  private async getTopUsers(query: any): Promise<any[]> {
    const pipeline = [
      { $match: { ...query, userId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$userId',
          eventCount: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { eventCount: -1 } },
      { $limit: 10 }
    ];

    const results = await AuditLog.aggregate(pipeline);
    
    return results.map(result => ({
      userId: result._id,
      eventCount: result.eventCount,
      lastActivity: result.lastActivity
    }));
  }

  private async getTopResources(query: any): Promise<any[]> {
    const pipeline = [
      { $match: { ...query, resourceId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: {
            resourceType: '$resourceType',
            resourceId: '$resourceId'
          },
          eventCount: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { eventCount: -1 } },
      { $limit: 10 }
    ];

    const results = await AuditLog.aggregate(pipeline);
    
    return results.map(result => ({
      resourceType: result._id.resourceType,
      resourceId: result._id.resourceId,
      eventCount: result.eventCount,
      lastActivity: result.lastActivity
    }));
  }

  private async getTopEventTypes(query: any): Promise<any[]> {
    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ];

    const results = await AuditLog.aggregate(pipeline);
    const total = results.reduce((sum, item) => sum + item.count, 0);
    
    return results.map(result => ({
      eventType: result._id,
      count: result.count,
      percentage: total > 0 ? (result.count / total) * 100 : 0
    }));
  }

  private async getSecurityMetrics(query: any): Promise<any> {
    const securityQuery = {
      ...query,
      eventType: { $in: [
        'SECURITY_BREACH', 'SUSPICIOUS_ACTIVITY', 'BLOCKED_REQUEST',
        'RATE_LIMIT_EXCEEDED', 'USER_LOGIN'
      ] }
    };

    const pipeline = [
      { $match: securityQuery },
      {
        $group: {
          _id: null,
          suspiciousActivity: {
            $sum: { $cond: [{ $eq: ['$eventType', 'SUSPICIOUS_ACTIVITY'] }, 1, 0] }
          },
          blockedRequests: {
            $sum: { $cond: [{ $eq: ['$eventType', 'BLOCKED_REQUEST'] }, 1, 0] }
          },
          failedLogins: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$eventType', 'USER_LOGIN'] },
                  { $eq: ['$status', 'failure'] }
                ]},
                1,
                0
              ]
            }
          },
          uniqueIPs: { $addToSet: '$ipAddress' }
        }
      }
    ];

    const result = await AuditLog.aggregate(pipeline);
    const data = result[0] || {};

    return {
      suspiciousActivity: data.suspiciousActivity || 0,
      blockedRequests: data.blockedRequests || 0,
      failedLogins: data.failedLogins || 0,
      uniqueIPs: (data.uniqueIPs || []).length,
      geoDistribution: {} // Would require IP geolocation service
    };
  }

  private getGroupFormat(grouping: string): string {
    const formats = {
      hour: '%Y-%m-%d %H:00:00',
      day: '%Y-%m-%d',
      week: '%Y-%U',
      month: '%Y-%m'
    };
    return formats[grouping] || formats.day;
  }

  private countOccurrences(arr: string[]): Record<string, number> {
    return arr.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
  }

  private generateCacheKey(filters: AuditQueryFilters, options: AuditQueryOptions): string {
    return `audit_query_${JSON.stringify({ filters, options })}`;
  }

  private exportToJSON(data: IAuditLog[], includeMetadata: boolean = true): Buffer {
    const exportData = {
      metadata: includeMetadata ? {
        exportedAt: new Date(),
        recordCount: data.length,
        version: '1.0'
      } : undefined,
      data: data.map(log => log.toJSON())
    };

    return Buffer.from(JSON.stringify(exportData, null, 2));
  }

  private exportToCSV(data: IAuditLog[]): Buffer {
    const headers = [
      'auditId', 'eventType', 'severity', 'status', 'timestamp',
      'userId', 'action', 'resourceType', 'resourceId', 'ipAddress',
      'userAgent', 'endpoint', 'method'
    ];

    const csvRows = [
      headers.join(','),
      ...data.map(log => [
        log.auditId,
        log.eventType,
        log.severity,
        log.status,
        log.timestamp.toISOString(),
        log.userId || '',
        log.action,
        log.resourceType,
        log.resourceId || '',
        log.ipAddress || '',
        log.userAgent || '',
        log.endpoint || '',
        log.method || ''
      ].map(field => `"${field}"`).join(','))
    ];

    return Buffer.from(csvRows.join('\n'));
  }

  private exportToXML(data: IAuditLog[], includeMetadata: boolean = true): Buffer {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<audit_logs>\n';

    if (includeMetadata) {
      xml += '  <metadata>\n';
      xml += `    <exported_at>${new Date().toISOString()}</exported_at>\n`;
      xml += `    <record_count>${data.length}</record_count>\n`;
      xml += `    <version>1.0</version>\n`;
      xml += '  </metadata>\n';
    }

    xml += '  <data>\n';
    data.forEach(log => {
      xml += '    <audit_log>\n';
      xml += `      <audit_id>${log.auditId}</audit_id>\n`;
      xml += `      <event_type>${log.eventType}</event_type>\n`;
      xml += `      <severity>${log.severity}</severity>\n`;
      xml += `      <status>${log.status}</status>\n`;
      xml += `      <timestamp>${log.timestamp.toISOString()}</timestamp>\n`;
      xml += `      <user_id>${log.userId || ''}</user_id>\n`;
      xml += `      <action>${log.action}</action>\n`;
      xml += `      <resource_type>${log.resourceType}</resource_type>\n`;
      xml += `      <resource_id>${log.resourceId || ''}</resource_id>\n`;
      xml += `      <ip_address>${log.ipAddress || ''}</ip_address>\n`;
      xml += `      <user_agent>${log.userAgent || ''}</user_agent>\n`;
      xml += `      <endpoint>${log.endpoint || ''}</endpoint>\n`;
      xml += `      <method>${log.method || ''}</method>\n`;
      xml += '    </audit_log>\n';
    });
    xml += '  </data>\n';
    xml += '</audit_logs>';

    return Buffer.from(xml);
  }
}

export default AuditQuery;
