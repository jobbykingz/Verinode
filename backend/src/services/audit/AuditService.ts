import { Request, Response, NextFunction } from 'express';
import { AuditLogger, AuditEventData, IBlockchainAnchor, IAlertService } from '../audit/AuditLogger';
import { AuditStorage, AuditStorageConfig } from '../audit/AuditStorage';
import { AuditQuery, AuditQueryFilters, AuditQueryOptions, AuditAnalyticsResult } from '../audit/AuditQuery';
import { AuditReport, ComplianceFramework, ReportPeriod, AuditReportConfig } from '../audit/AuditReport';
import { AuditLog, IAuditLog, AuditEventType, AuditSeverity, AuditStatus } from '../models/AuditLog';
import winston from 'winston';
import { EventEmitter } from 'events';

/**
 * Service Configuration
 */
export interface AuditServiceConfig {
  logger?: Partial<AuditLoggerConfig>;
  storage?: AuditStorageConfig;
  report?: Partial<AuditReportConfig>;
  enableRealTimeMonitoring?: boolean;
  enableDataRetention?: boolean;
  retentionDays?: number;
  enableIntegrityChecks?: boolean;
  integrityCheckInterval?: number; // hours
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
  timestamp: Date;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
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
  lastIntegrityCheck?: Date;
  lastBackup?: Date;
  alertsActive: number;
}

/**
 * Main Audit Service
 * 
 * Provides a unified interface for all audit functionality:
 * - Centralized audit logging and management
 * - Real-time monitoring and alerting
 * - Query and analytics capabilities
 * - Compliance reporting
 * - Data retention and archiving
 * - Performance optimization
 */
export class AuditService extends EventEmitter {
  private config: AuditServiceConfig;
  private logger: winston.Logger;
  private auditLogger: AuditLogger;
  private auditStorage: AuditStorage;
  private auditQuery: AuditQuery;
  private auditReport: AuditReport;
  private isInitialized = false;
  private integrityCheckTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  private alerts: Map<string, MonitoringAlert> = new Map();

  constructor(config: AuditServiceConfig = {}) {
    super();
    
    this.config = {
      enableRealTimeMonitoring: true,
      enableDataRetention: true,
      retentionDays: 2555, // 7 years
      enableIntegrityChecks: true,
      integrityCheckInterval: 24, // hours
      ...config
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/audit-service.log' }),
        new winston.transports.Console()
      ]
    });

    // Initialize components
    this.auditLogger = new AuditLogger(this.config.logger);
    this.auditStorage = new AuditStorage(this.config.storage || {
      enableCompression: true,
      enableEncryption: false,
      archivePath: './archives',
      maxArchiveSize: 1000, // MB
      backupInterval: 24 // hours
    });
    this.auditQuery = new AuditQuery();
    this.auditReport = new AuditReport(this.config.report);

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Initialize the audit service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.logger.info('Initializing audit service...');

      // Initialize storage
      await this.auditStorage.initialize();

      // Start monitoring if enabled
      if (this.config.enableRealTimeMonitoring) {
        this.startMonitoring();
      }

      // Start integrity checks if enabled
      if (this.config.enableIntegrityChecks) {
        this.startIntegrityChecks();
      }

      // Start data retention if enabled
      if (this.config.enableDataRetention) {
        this.startDataRetention();
      }

      this.isInitialized = true;
      this.logger.info('Audit service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize audit service', { error });
      throw error;
    }
  }

  /**
   * Log an audit event
   */
  async logEvent(eventData: AuditEventData): Promise<IAuditLog> {
    try {
      const auditLog = await this.auditLogger.log(eventData);
      
      // Store in storage system
      await this.auditStorage.store(auditLog);

      // Emit event for real-time monitoring
      this.emit('auditEvent', auditLog);

      // Check for alerts
      await this.checkForAlerts(auditLog);

      return auditLog;
    } catch (error) {
      this.logger.error('Failed to log audit event', { error, eventData });
      throw error;
    }
  }

  /**
   * Search audit logs
   */
  async searchLogs(
    filters: AuditQueryFilters = {},
    options: AuditQueryOptions = {}
  ): Promise<any> {
    try {
      return await this.auditQuery.search(filters, options);
    } catch (error) {
      this.logger.error('Failed to search audit logs', { error, filters, options });
      throw error;
    }
  }

  /**
   * Get analytics data
   */
  async getAnalytics(
    filters: AuditQueryFilters = {},
    timeGrouping: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<AuditAnalyticsResult> {
    try {
      return await this.auditQuery.getAnalytics(filters, timeGrouping);
    } catch (error) {
      this.logger.error('Failed to get analytics', { error, filters });
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
  ): Promise<Buffer> {
    try {
      const reportData = await this.auditReport.generateReport(period, framework, options);
      const format = options.format || 'pdf';
      
      return await this.auditReport.exportReport(reportData, format);
    } catch (error) {
      this.logger.error('Failed to generate report', { error, period, framework });
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<ServiceStatistics> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

      const [
        totalLogs,
        logsToday,
        logsThisHour,
        criticalEvents,
        securityEvents,
        storageStats
      ] = await Promise.all([
        AuditLog.countDocuments(),
        AuditLog.countDocuments({ timestamp: { $gte: today } }),
        AuditLog.countDocuments({ timestamp: { $gte: thisHour } }),
        AuditLog.countDocuments({ severity: AuditSeverity.CRITICAL }),
        AuditLog.countDocuments({
          eventType: { $in: [
            AuditEventType.SECURITY_BREACH,
            AuditEventType.SUSPICIOUS_ACTIVITY,
            AuditEventType.BLOCKED_REQUEST
          ] }
        }),
        this.auditStorage.getStorageStats()
      ]);

      // Calculate compliance score (simplified)
      const complianceScore = await this.calculateComplianceScore();

      return {
        totalLogs,
        logsToday,
        logsThisHour,
        criticalEvents,
        securityEvents,
        complianceScore,
        storageUtilization: storageStats.totalSize > 0 ? 
          (storageStats.archivedSize / storageStats.totalSize) * 100 : 0,
        lastIntegrityCheck: storageStats.lastBackup,
        lastBackup: storageStats.lastBackup,
        alertsActive: this.getActiveAlertsCount()
      };
    } catch (error) {
      this.logger.error('Failed to get statistics', { error });
      throw error;
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolvedBy: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alertResolved', alert);
      this.logger.info('Alert resolved', { alertId, resolvedBy });
    }
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(options: {
    fromDate?: Date;
    toDate?: Date;
    sampleSize?: number;
  } = {}): Promise<{
    verified: number;
    failed: number;
    failedIds: string[];
  }> {
    try {
      const result = await this.auditStorage.verifyIntegrity(options);
      
      // Create alert if integrity failures detected
      if (result.failed > 0) {
        this.createAlert({
          type: 'integrity',
          severity: 'critical',
          title: 'Audit Log Integrity Check Failed',
          message: `${result.failed} audit logs failed integrity verification`,
          metadata: { failedIds: result.failedIds }
        });
      }

      this.logger.info('Integrity verification completed', result);
      return result;
    } catch (error) {
      this.logger.error('Failed to verify integrity', { error });
      throw error;
    }
  }

  /**
   * Archive old audit logs
   */
  async archiveLogs(beforeDate: Date): Promise<void> {
    try {
      const archiveMetadata = await this.auditStorage.archive(beforeDate);
      
      this.logger.info('Logs archived successfully', {
        archiveId: archiveMetadata.archiveId,
        recordCount: archiveMetadata.recordCount
      });

      this.emit('logsArchived', archiveMetadata);
    } catch (error) {
      this.logger.error('Failed to archive logs', { error });
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
  ): Promise<Buffer> {
    try {
      return await this.auditQuery.export(filters, format, options);
    } catch (error) {
      this.logger.error('Failed to export logs', { error, format });
      throw error;
    }
  }

  /**
   * Set blockchain anchor service
   */
  setBlockchainAnchor(anchor: IBlockchainAnchor): void {
    this.auditLogger.setBlockchainAnchor(anchor);
  }

  /**
   * Set alert service
   */
  setAlertService(alertService: IAlertService): void {
    this.auditLogger.setAlertService(alertService);
  }

  /**
   * Cleanup service resources
   */
  async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up audit service...');

      // Clear timers
      if (this.integrityCheckTimer) {
        clearInterval(this.integrityCheckTimer);
      }

      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
      }

      // Cleanup storage
      await this.auditStorage.cleanup();

      this.isInitialized = false;
      this.logger.info('Audit service cleanup completed');
      this.emit('cleanup');
    } catch (error) {
      this.logger.error('Failed to cleanup audit service', { error });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private setupEventListeners(): void {
    this.on('auditEvent', (auditLog: IAuditLog) => {
      // Handle real-time monitoring
      if (this.config.enableRealTimeMonitoring) {
        this.handleRealTimeEvent(auditLog);
      }
    });

    this.on('alertCreated', (alert: MonitoringAlert) => {
      this.logger.warn('Alert created', { alertId: alert.id, type: alert.type });
    });

    this.on('alertResolved', (alert: MonitoringAlert) => {
      this.logger.info('Alert resolved', { alertId: alert.id });
    });
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      try {
        await this.performMonitoringChecks();
      } catch (error) {
        this.logger.error('Monitoring check failed', { error });
      }
    }, 60000); // Check every minute
  }

  private startIntegrityChecks(): void {
    const intervalMs = (this.config.integrityCheckInterval || 24) * 60 * 60 * 1000;
    
    this.integrityCheckTimer = setInterval(async () => {
      try {
        await this.verifyIntegrity({ sampleSize: 1000 });
      } catch (error) {
        this.logger.error('Scheduled integrity check failed', { error });
      }
    }, intervalMs);
  }

  private startDataRetention(): void {
    // Run daily at 2 AM
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);
    
    const msUntilTomorrow = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.performDataRetention();
      // Schedule daily run
      setInterval(() => this.performDataRetention(), 24 * 60 * 60 * 1000);
    }, msUntilTomorrow);
  }

  private async performMonitoringChecks(): Promise<void> {
    // Check for unusual activity patterns
    const recentLogs = await this.auditQuery.search({
      fromDate: new Date(Date.now() - 60 * 60 * 1000) // Last hour
    }, { limit: 1000 });

    // Alert on high volume of security events
    const securityEvents = recentLogs.data.filter(log => 
      [
        AuditEventType.SECURITY_BREACH,
        AuditEventType.SUSPICIOUS_ACTIVITY,
        AuditEventType.BLOCKED_REQUEST
      ].includes(log.eventType)
    );

    if (securityEvents.length > 10) {
      this.createAlert({
        type: 'security',
        severity: 'high',
        title: 'High Security Event Volume',
        message: `${securityEvents.length} security events detected in the last hour`,
        metadata: { eventCount: securityEvents.length }
      });
    }

    // Check for critical events
    const criticalEvents = recentLogs.data.filter(log => 
      log.severity === AuditSeverity.CRITICAL
    );

    if (criticalEvents.length > 0) {
      this.createAlert({
        type: 'security',
        severity: 'critical',
        title: 'Critical Security Events Detected',
        message: `${criticalEvents.length} critical events in the last hour`,
        metadata: { eventIds: criticalEvents.map(log => log.auditId) }
      });
    }
  }

  private async performDataRetention(): Promise<void> {
    if (!this.config.enableDataRetention || !this.config.retentionDays) return;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      await this.archiveLogs(cutoffDate);
      this.logger.info('Data retention completed', { cutoffDate });
    } catch (error) {
      this.logger.error('Data retention failed', { error });
    }
  }

  private handleRealTimeEvent(auditLog: IAuditLog): void {
    // Real-time event processing
    if (auditLog.severity === AuditSeverity.CRITICAL) {
      this.createAlert({
        type: 'security',
        severity: 'critical',
        title: 'Critical Security Event',
        message: `Critical event: ${auditLog.eventType}`,
        metadata: { auditId: auditLog.auditId }
      });
    }
  }

  private async checkForAlerts(auditLog: IAuditLog): Promise<void> {
    // Check for alert conditions
    if (auditLog.severity === AuditSeverity.CRITICAL) {
      this.createAlert({
        type: 'security',
        severity: 'critical',
        title: 'Critical Security Event',
        message: `Critical event detected: ${auditLog.eventType}`,
        metadata: { auditId: auditLog.auditId }
      });
    }

    if (auditLog.eventType === AuditEventType.SECURITY_BREACH) {
      this.createAlert({
        type: 'security',
        severity: 'critical',
        title: 'Security Breach Detected',
        message: 'Security breach event detected',
        metadata: { auditId: auditLog.auditId }
      });
    }
  }

  private createAlert(alertData: Omit<MonitoringAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: MonitoringAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alertData
    };

    this.alerts.set(alert.id, alert);
    this.emit('alertCreated', alert);
  }

  private getActiveAlertsCount(): number {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved).length;
  }

  private async calculateComplianceScore(): Promise<number> {
    try {
      // Simplified compliance score calculation
      const totalLogs = await AuditLog.countDocuments();
      const criticalEvents = await AuditLog.countDocuments({ 
        severity: AuditSeverity.CRITICAL 
      });
      const securityEvents = await AuditLog.countDocuments({
        eventType: { $in: [
          AuditEventType.SECURITY_BREACH,
          AuditEventType.SUSPICIOUS_ACTIVITY
        ] }
      });

      let score = 100;
      score = Math.max(0, score - (criticalEvents * 5));
      score = Math.max(0, score - (securityEvents * 2));

      return score;
    } catch (error) {
      this.logger.error('Failed to calculate compliance score', { error });
      return 0;
    }
  }
}

// Create singleton instance
export const auditService = new AuditService();

export default auditService;
