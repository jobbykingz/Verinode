import axios, { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Audit Event Types (matching backend)
 */
export enum AuditEventType {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTER = 'USER_REGISTER',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SYSTEM_STARTUP = 'SYSTEM_STARTUP',
  SYSTEM_SHUTDOWN = 'SYSTEM_SHUTDOWN',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
  SECURITY_BREACH = 'SECURITY_BREACH',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  BLOCKED_REQUEST = 'BLOCKED_REQUEST',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT',
  DATA_PURGE = 'DATA_PURGE',
  DATA_ARCHIVE = 'DATA_ARCHIVE',
  COMPLIANCE_CHECK = 'COMPLIANCE_CHECK',
  AUDIT_REPORT_GENERATED = 'AUDIT_REPORT_GENERATED',
  REGULATORY_FILING = 'REGULATORY_FILING',
  PROOF_CREATED = 'PROOF_CREATED',
  PROOF_VERIFIED = 'PROOF_VERIFIED',
  PROOF_REVOKED = 'PROOF_REVOKED',
  BATCH_OPERATION = 'BATCH_OPERATION',
  ROLE_CHANGE = 'ROLE_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_REACTIVATED = 'USER_REACTIVATED'
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AuditStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PENDING = 'pending',
  WARNING = 'warning'
}

export enum ComplianceFramework {
  SOX = 'SOX',
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  PCI_DSS = 'PCI-DSS',
  ISO_27001 = 'ISO-27001',
  NIST = 'NIST'
}

/**
 * Audit Log Interface
 */
export interface AuditLog {
  auditId: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  status: AuditStatus;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceUrl?: string;
  requestId?: string;
  correlationId?: string;
  method?: string;
  endpoint?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changedFields?: string[];
  metadata: Record<string, any>;
  checksum: string;
  previousHash?: string;
  blockchainHash?: string;
  blockchainTxId?: string;
  complianceFrameworks: string[];
  retentionPeriod: number;
  isArchived: boolean;
  archivedAt?: string;
  processed: boolean;
  processedAt?: string;
  alertTriggered: boolean;
  alertSentAt?: string;
  searchText?: string;
  tags: string[];
}

/**
 * Query Filters
 */
export interface AuditQueryFilters {
  fromDate?: string;
  toDate?: string;
  eventTypes?: AuditEventType[];
  severity?: AuditSeverity[];
  status?: AuditStatus[];
  userIds?: string[];
  sessionIds?: string[];
  resourceTypes?: string[];
  resourceIds?: string[];
  ipAddresses?: string[];
  requestIds?: string[];
  correlationIds?: string[];
  methods?: string[];
  endpoints?: string[];
  complianceFrameworks?: string[];
  tags?: string[];
  processed?: boolean;
  alertTriggered?: boolean;
  isArchived?: boolean;
  searchText?: string;
  hasDataChanges?: boolean;
  changedFields?: string[];
}

/**
 * Query Options
 */
export interface AuditQueryOptions {
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  fields?: string[];
  excludeFields?: string[];
  cache?: boolean;
  cacheTTL?: number;
  format?: 'json' | 'csv' | 'xml';
}

/**
 * Query Result
 */
export interface AuditQueryResult {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  executionTime: number;
  cached: boolean;
  aggregations?: Record<string, any>;
  query: {
    filters: AuditQueryFilters;
    options: AuditQueryOptions;
  };
}

/**
 * Analytics Data
 */
export interface AuditAnalytics {
  timeline: Array<{
    timestamp: string;
    count: number;
    severityBreakdown: Record<AuditSeverity, number>;
    eventTypeBreakdown: Record<string, number>;
  }>;
  summary: {
    totalEvents: number;
    uniqueUsers: number;
    uniqueResources: number;
    criticalEvents: number;
    securityEvents: number;
    complianceEvents: number;
  };
  topUsers: Array<{
    userId: string;
    eventCount: number;
    lastActivity: string;
  }>;
  topResources: Array<{
    resourceType: string;
    resourceId: string;
    eventCount: number;
    lastActivity: string;
  }>;
  topEventTypes: Array<{
    eventType: AuditEventType;
    count: number;
    percentage: number;
  }>;
  securityMetrics: {
    suspiciousActivity: number;
    blockedRequests: number;
    failedLogins: number;
    uniqueIPs: number;
    geoDistribution: Record<string, number>;
  };
}

/**
 * Service Statistics
 */
export interface ServiceStatistics {
  totalLogs: number;
  logsToday: number;
  logsThisHour: number;
  criticalEvents: number;
  securityEvents: number;
  complianceScore: number;
  storageUtilization: number;
  lastIntegrityCheck?: string;
  lastBackup?: string;
  alertsActive: number;
}

/**
 * Monitoring Alert
 */
export interface MonitoringAlert {
  id: string;
  type: 'security' | 'compliance' | 'performance' | 'integrity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
}

/**
 * Report Period
 */
export interface ReportPeriod {
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  startDate: string;
  endDate: string;
}

/**
 * Audit Service Configuration
 */
export interface AuditServiceConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  authToken?: string;
  onUnauthorized?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Frontend Audit Service
 * 
 * Provides a comprehensive API for interacting with the audit system:
 * - Search and query audit logs
 * - Get analytics and statistics
 * - Generate compliance reports
 * - Monitor real-time events
 * - Export data
 */
export class AuditService {
  private client: AxiosInstance;
  private config: AuditServiceConfig;
  private ws?: WebSocket;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: AuditServiceConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.authToken && { Authorization: `Bearer ${this.config.authToken}` })
      }
    });

    this.setupInterceptors();
  }

  /**
   * Search audit logs
   */
  async searchLogs(
    filters: AuditQueryFilters = {},
    options: AuditQueryOptions = {}
  ): Promise<AuditQueryResult> {
    try {
      const response = await this.client.post('/api/audit/search', {
        filters,
        options
      });

      return response.data;
    } catch (error) {
      this.handleError('Failed to search audit logs', error);
      throw error;
    }
  }

  /**
   * Get analytics data
   */
  async getAnalytics(
    filters: AuditQueryFilters = {},
    timeGrouping: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<AuditAnalytics> {
    try {
      const response = await this.client.post('/api/audit/analytics', {
        filters,
        timeGrouping
      });

      return response.data;
    } catch (error) {
      this.handleError('Failed to get analytics', error);
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<ServiceStatistics> {
    try {
      const response = await this.client.get('/api/audit/statistics');
      return response.data;
    } catch (error) {
      this.handleError('Failed to get statistics', error);
      throw error;
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<MonitoringAlert[]> {
    try {
      const response = await this.client.get('/api/audit/alerts');
      return response.data;
    } catch (error) {
      this.handleError('Failed to get alerts', error);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    try {
      await this.client.post(`/api/audit/alerts/${alertId}/resolve`, { resolvedBy });
    } catch (error) {
      this.handleError('Failed to resolve alert', error);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateReport(
    period: ReportPeriod,
    framework: ComplianceFramework,
    options: {
      format?: 'pdf' | 'json' | 'csv' | 'html';
      includeRawData?: boolean;
    } = {}
  ): Promise<Blob> {
    try {
      const response = await this.client.post('/api/audit/reports', {
        period,
        framework,
        ...options
      }, {
        responseType: 'blob'
      });

      return response.data;
    } catch (error) {
      this.handleError('Failed to generate report', error);
      throw error;
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs(
    filters: AuditQueryFilters = {},
    format: 'json' | 'csv' | 'xml' = 'json',
    options: {
      maxRecords?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<Blob> {
    try {
      const response = await this.client.post('/api/audit/export', {
        filters,
        format,
        ...options
      }, {
        responseType: 'blob'
      });

      return response.data;
    } catch (error) {
      this.handleError('Failed to export logs', error);
      throw error;
    }
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(options: {
    fromDate?: string;
    toDate?: string;
    sampleSize?: number;
  } = {}): Promise<{
    verified: number;
    failed: number;
    failedIds: string[];
  }> {
    try {
      const response = await this.client.post('/api/audit/verify-integrity', options);
      return response.data;
    } catch (error) {
      this.handleError('Failed to verify integrity', error);
      throw error;
    }
  }

  /**
   * Archive old audit logs
   */
  async archiveLogs(beforeDate: string): Promise<void> {
    try {
      await this.client.post('/api/audit/archive', { beforeDate });
    } catch (error) {
      this.handleError('Failed to archive logs', error);
      throw error;
    }
  }

  /**
   * Get query suggestions
   */
  async getQuerySuggestions(partial: string): Promise<string[]> {
    try {
      const response = await this.client.get(`/api/audit/suggestions?q=${encodeURIComponent(partial)}`);
      return response.data;
    } catch (error) {
      this.handleError('Failed to get query suggestions', error);
      return [];
    }
  }

  /**
   * Connect to real-time monitoring
   */
  connectRealTime(): void {
    if (this.ws) {
      this.ws.close();
    }

    const wsUrl = this.config.baseURL.replace('http', 'ws') + '/api/audit/realtime';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to audit real-time monitoring');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data.payload);
      } catch (error) {
        console.error('Failed to parse real-time message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from audit real-time monitoring');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connectRealTime(), 5000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  /**
   * Disconnect from real-time monitoring
   */
  disconnectRealTime(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Event emitter methods
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Setup axios interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add correlation ID for request tracking
        config.headers['X-Correlation-ID'] = this.generateCorrelationId();
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        // Handle retries
        if (error.config && !error.config.__retryCount && this.shouldRetry(error)) {
          error.config.__retryCount = 0;
        }

        if (error.config && error.config.__retryCount < (this.config.retries || 3)) {
          error.config.__retryCount++;
          await this.delay(this.config.retryDelay || 1000);
          return this.client.request(error.config);
        }

        // Handle unauthorized
        if (error.response?.status === 401 && this.config.onUnauthorized) {
          this.config.onUnauthorized();
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Helper methods
   */
  private handleError(message: string, error: any): void {
    console.error(message, error);
    if (this.config.onError) {
      this.config.onError(error instanceof Error ? error : new Error(message));
    }
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors or 5xx server errors
    return !error.response || (error.response.status >= 500 && error.response.status < 600);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility methods
   */
  static formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString();
  }

  static getSeverityColor(severity: AuditSeverity): string {
    const colors = {
      [AuditSeverity.LOW]: '#10b981',
      [AuditSeverity.MEDIUM]: '#3b82f6',
      [AuditSeverity.HIGH]: '#f59e0b',
      [AuditSeverity.CRITICAL]: '#ef4444'
    };
    return colors[severity] || '#64748b';
  }

  static getStatusColor(status: AuditStatus): string {
    const colors = {
      [AuditStatus.SUCCESS]: '#10b981',
      [AuditStatus.FAILURE]: '#ef4444',
      [AuditStatus.PENDING]: '#f59e0b',
      [AuditStatus.WARNING]: '#f97316'
    };
    return colors[status] || '#64748b';
  }

  static formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  static truncateText(text: string, maxLength: number = 50): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  static getEventTypeLabel(eventType: AuditEventType): string {
    return eventType.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  static getSeverityLabel(severity: AuditSeverity): string {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  }

  static getStatusLabel(status: AuditStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

// Create default instance
export const auditService = new AuditService({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'
});

export default auditService;
