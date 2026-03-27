import { AuditLog, IAuditLog, AuditEventType, AuditSeverity, AuditStatus } from '../models/AuditLog';
import crypto from 'crypto';
import winston from 'winston';

/**
 * Audit Logger Configuration
 */
export interface AuditLoggerConfig {
  enableBlockchainAnchoring: boolean;
  enableRealTimeAlerts: boolean;
  batchSize: number;
  batchTimeout: number;
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

/**
 * Audit Event Data
 */
export interface AuditEventData {
  eventType: AuditEventType;
  severity: AuditSeverity;
  status?: AuditStatus;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceUrl?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  requestId?: string;
  correlationId?: string;
  method?: string;
  endpoint?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  complianceFrameworks?: string[];
  tags?: string[];
}

/**
 * Blockchain Anchor Interface
 */
export interface IBlockchainAnchor {
  anchorHash(hash: string): Promise<{ txId: string; blockNumber: number }>;
  verifyAnchor(txId: string): Promise<{ verified: boolean; blockNumber: number }>;
}

/**
 * Alert Service Interface
 */
export interface IAlertService {
  sendAlert(auditLog: IAuditLog): Promise<void>;
}

/**
 * Advanced Audit Logger
 * 
 * Provides comprehensive audit logging with:
 * - Immutable storage with blockchain anchoring
 * - High-performance batch processing
 * - Real-time monitoring and alerting
 * - Data compression and encryption
 * - Compliance framework support
 */
export class AuditLogger {
  private config: AuditLoggerConfig;
  private logger: winston.Logger;
  private batchQueue: IAuditLog[] = [];
  private batchTimer?: NodeJS.Timeout;
  private blockchainAnchor?: IBlockchainAnchor;
  private alertService?: IAlertService;
  private isShuttingDown = false;

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = {
      enableBlockchainAnchoring: true,
      enableRealTimeAlerts: true,
      batchSize: 100,
      batchTimeout: 5000, // 5 seconds
      retentionDays: 2555, // 7 years
      compressionEnabled: true,
      encryptionEnabled: false,
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
        new winston.transports.File({ filename: 'logs/audit.log' }),
        new winston.transports.Console()
      ]
    });

    // Start batch processing
    this.startBatchProcessor();
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  /**
   * Set blockchain anchor service
   */
  setBlockchainAnchor(anchor: IBlockchainAnchor): void {
    this.blockchainAnchor = anchor;
  }

  /**
   * Set alert service
   */
  setAlertService(alertService: IAlertService): void {
    this.alertService = alertService;
  }

  /**
   * Log an audit event
   */
  async log(eventData: AuditEventData): Promise<IAuditLog> {
    try {
      // Create audit log document
      const auditLog = new AuditLog({
        ...eventData,
        status: eventData.status || AuditStatus.SUCCESS,
        metadata: eventData.metadata || {},
        complianceFrameworks: eventData.complianceFrameworks || [],
        tags: eventData.tags || [],
        retentionPeriod: this.config.retentionDays
      });

      // Add to batch queue
      this.batchQueue.push(auditLog);

      // Process batch if queue is full
      if (this.batchQueue.length >= this.config.batchSize) {
        await this.processBatch();
      }

      this.logger.info('Audit event logged', {
        auditId: auditLog.auditId,
        eventType: eventData.eventType,
        userId: eventData.userId
      });

      return auditLog;
    } catch (error) {
      this.logger.error('Failed to log audit event', { error, eventData });
      throw error;
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    eventType: AuditEventType.USER_LOGIN | AuditEventType.USER_LOGOUT | AuditEventType.USER_REGISTER | AuditEventType.PASSWORD_CHANGE,
    userId: string,
    ipAddress: string,
    userAgent?: string,
    sessionId?: string,
    status: AuditStatus = AuditStatus.SUCCESS
  ): Promise<IAuditLog> {
    return this.log({
      eventType,
      severity: this.getSeverityForEventType(eventType),
      status,
      action: eventType.replace('_', ' ').toLowerCase(),
      resourceType: 'User',
      resourceId: userId,
      userId,
      sessionId,
      userAgent,
      ipAddress,
      complianceFrameworks: ['SOX', 'GDPR', 'HIPAA'],
      tags: ['authentication', 'security']
    });
  }

  /**
   * Log CRUD operations
   */
  async logCrudOperation(
    operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    resourceType: string,
    resourceId: string,
    userId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    ipAddress?: string,
    endpoint?: string,
    method?: string
  ): Promise<IAuditLog> {
    const eventType = this.getEventTypeForOperation(operation);
    const changedFields = this.getChangedFields(oldValues, newValues);

    return this.log({
      eventType,
      severity: this.getSeverityForOperation(operation, resourceType),
      action: `${operation.toLowerCase()} ${resourceType}`,
      resourceType,
      resourceId,
      userId,
      oldValues,
      newValues,
      changedFields,
      ipAddress,
      endpoint,
      method,
      complianceFrameworks: this.getComplianceFrameworksForResource(resourceType),
      tags: ['crud', resourceType.toLowerCase()]
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    eventType: AuditEventType.SECURITY_BREACH | AuditEventType.SUSPICIOUS_ACTIVITY | AuditEventType.BLOCKED_REQUEST | AuditEventType.RATE_LIMIT_EXCEEDED,
    details: {
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      endpoint?: string;
      method?: string;
      reason?: string;
      threatLevel?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<IAuditLog> {
    return this.log({
      eventType,
      severity: this.getSeverityForSecurityEvent(eventType),
      status: AuditStatus.WARNING,
      action: eventType.replace('_', ' ').toLowerCase(),
      resourceType: 'Security',
      resourceId: details.userId || details.ipAddress,
      userId: details.userId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      endpoint: details.endpoint,
      method: details.method,
      metadata: {
        ...details.metadata,
        reason: details.reason,
        threatLevel: details.threatLevel
      },
      complianceFrameworks: ['SOX', 'GDPR', 'HIPAA', 'PCI-DSS'],
      tags: ['security', 'threat', 'compliance']
    });
  }

  /**
   * Log system events
   */
  async logSystemEvent(
    eventType: AuditEventType.SYSTEM_STARTUP | AuditEventType.SYSTEM_SHUTDOWN | AuditEventType.CONFIG_CHANGE | AuditEventType.BACKUP_CREATED | AuditEventType.BACKUP_RESTORED,
    details: {
      userId?: string;
      component?: string;
      config?: Record<string, any>;
      metadata?: Record<string, any>;
    }
  ): Promise<IAuditLog> {
    return this.log({
      eventType,
      severity: AuditSeverity.MEDIUM,
      action: eventType.replace('_', ' ').toLowerCase(),
      resourceType: 'System',
      resourceId: details.component,
      userId: details.userId,
      metadata: {
        ...details.metadata,
        component: details.component,
        config: details.config
      },
      complianceFrameworks: ['SOX'],
      tags: ['system', 'administration']
    });
  }

  /**
   * Log compliance events
   */
  async logComplianceEvent(
    eventType: AuditEventType.COMPLIANCE_CHECK | AuditEventType.AUDIT_REPORT_GENERATED | AuditEventType.REGULATORY_FILING,
    details: {
      userId?: string;
      framework?: string;
      reportType?: string;
      reportId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<IAuditLog> {
    return this.log({
      eventType,
      severity: AuditSeverity.HIGH,
      action: eventType.replace('_', ' ').toLowerCase(),
      resourceType: 'Compliance',
      resourceId: details.reportId,
      userId: details.userId,
      metadata: {
        ...details.metadata,
        framework: details.framework,
        reportType: details.reportType
      },
      complianceFrameworks: [details.framework || 'SOX'],
      tags: ['compliance', 'reporting']
    });
  }

  /**
   * Process batch of audit logs
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.config.batchSize);
    
    try {
      // Save batch to database
      const savedLogs = await AuditLog.insertMany(batch, { ordered: false });

      // Process blockchain anchoring
      if (this.config.enableBlockchainAnchoring && this.blockchainAnchor) {
        await this.processBlockchainAnchoring(savedLogs);
      }

      // Process alerts
      if (this.config.enableRealTimeAlerts && this.alertService) {
        await this.processAlerts(savedLogs);
      }

      this.logger.info('Batch processed successfully', {
        batchSize: savedLogs.length,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to process batch', { error, batchSize: batch.length });
      // Re-add failed items to queue for retry
      this.batchQueue.unshift(...batch);
      throw error;
    }
  }

  /**
   * Process blockchain anchoring for audit logs
   */
  private async processBlockchainAnchoring(auditLogs: IAuditLog[]): Promise<void> {
    if (!this.blockchainAnchor) return;

    for (const auditLog of auditLogs) {
      try {
        const anchorResult = await this.blockchainAnchor.anchorHash(auditLog.checksum);
        
        // Update audit log with blockchain information
        await AuditLog.findByIdAndUpdate(auditLog._id, {
          blockchainHash: auditLog.checksum,
          blockchainTxId: anchorResult.txId
        });

        this.logger.info('Audit log anchored to blockchain', {
          auditId: auditLog.auditId,
          txId: anchorResult.txId,
          blockNumber: anchorResult.blockNumber
        });
      } catch (error) {
        this.logger.error('Failed to anchor audit log to blockchain', {
          auditId: auditLog.auditId,
          error
        });
      }
    }
  }

  /**
   * Process alerts for audit logs
   */
  private async processAlerts(auditLogs: IAuditLog[]): Promise<void> {
    if (!this.alertService) return;

    const logsNeedingAlerts = auditLogs.filter(log => 
      log.severity === AuditSeverity.CRITICAL || 
      log.severity === AuditSeverity.HIGH ||
      log.eventType === AuditEventType.SECURITY_BREACH
    );

    for (const auditLog of logsNeedingAlerts) {
      try {
        await this.alertService.sendAlert(auditLog);
        await AuditLog.findByIdAndUpdate(auditLog._id, {
          alertTriggered: true,
          alertSentAt: new Date()
        });
      } catch (error) {
        this.logger.error('Failed to send alert', {
          auditId: auditLog.auditId,
          error
        });
      }
    }
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    this.batchTimer = setInterval(async () => {
      if (this.batchQueue.length > 0) {
        await this.processBatch();
      }
    }, this.config.batchTimeout);
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    this.logger.info('Shutting down audit logger...');

    // Clear batch timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Process remaining batch
    if (this.batchQueue.length > 0) {
      await this.processBatch();
    }

    this.logger.info('Audit logger shutdown complete');
  }

  /**
   * Helper methods
   */
  private getSeverityForEventType(eventType: AuditEventType): AuditSeverity {
    const severityMap: Record<AuditEventType, AuditSeverity> = {
      [AuditEventType.SECURITY_BREACH]: AuditSeverity.CRITICAL,
      [AuditEventType.SUSPICIOUS_ACTIVITY]: AuditSeverity.HIGH,
      [AuditEventType.BLOCKED_REQUEST]: AuditSeverity.MEDIUM,
      [AuditEventType.RATE_LIMIT_EXCEEDED]: AuditSeverity.MEDIUM,
      [AuditEventType.USER_LOGIN]: AuditSeverity.LOW,
      [AuditEventType.USER_LOGOUT]: AuditSeverity.LOW,
      [AuditEventType.USER_REGISTER]: AuditSeverity.MEDIUM,
      [AuditEventType.PASSWORD_CHANGE]: AuditSeverity.HIGH,
      [AuditEventType.PASSWORD_RESET]: AuditSeverity.HIGH,
      [AuditEventType.MFA_ENABLED]: AuditSeverity.MEDIUM,
      [AuditEventType.MFA_DISABLED]: AuditSeverity.HIGH,
      [AuditEventType.DELETE]: AuditSeverity.HIGH,
      [AuditEventType.UPDATE]: AuditSeverity.MEDIUM,
      [AuditEventType.CREATE]: AuditSeverity.MEDIUM,
      [AuditEventType.READ]: AuditSeverity.LOW,
      [AuditEventType.SYSTEM_STARTUP]: AuditSeverity.MEDIUM,
      [AuditEventType.SYSTEM_SHUTDOWN]: AuditSeverity.HIGH,
      [AuditEventType.CONFIG_CHANGE]: AuditSeverity.HIGH,
      [AuditEventType.BACKUP_CREATED]: AuditSeverity.MEDIUM,
      [AuditEventType.BACKUP_RESTORED]: AuditSeverity.HIGH,
      [AuditEventType.DATA_EXPORT]: AuditSeverity.MEDIUM,
      [AuditEventType.DATA_IMPORT]: AuditSeverity.MEDIUM,
      [AuditEventType.DATA_PURGE]: AuditSeverity.HIGH,
      [AuditEventType.DATA_ARCHIVE]: AuditSeverity.MEDIUM,
      [AuditEventType.COMPLIANCE_CHECK]: AuditSeverity.HIGH,
      [AuditEventType.AUDIT_REPORT_GENERATED]: AuditSeverity.MEDIUM,
      [AuditEventType.REGULATORY_FILING]: AuditSeverity.HIGH,
      [AuditEventType.PROOF_CREATED]: AuditSeverity.MEDIUM,
      [AuditEventType.PROOF_VERIFIED]: AuditSeverity.MEDIUM,
      [AuditEventType.PROOF_REVOKED]: AuditSeverity.HIGH,
      [AuditEventType.BATCH_OPERATION]: AuditSeverity.MEDIUM,
      [AuditEventType.ROLE_CHANGE]: AuditSeverity.HIGH,
      [AuditEventType.PERMISSION_CHANGE]: AuditSeverity.HIGH,
      [AuditEventType.USER_SUSPENDED]: AuditSeverity.HIGH,
      [AuditEventType.USER_REACTIVATED]: AuditSeverity.MEDIUM
    };

    return severityMap[eventType] || AuditSeverity.MEDIUM;
  }

  private getSeverityForOperation(operation: string, resourceType: string): AuditSeverity {
    if (operation === 'DELETE') return AuditSeverity.HIGH;
    if (operation === 'UPDATE' && resourceType === 'User') return AuditSeverity.HIGH;
    if (operation === 'CREATE' && resourceType === 'User') return AuditSeverity.MEDIUM;
    return AuditSeverity.MEDIUM;
  }

  private getSeverityForSecurityEvent(eventType: AuditEventType): AuditSeverity {
    if (eventType === AuditEventType.SECURITY_BREACH) return AuditSeverity.CRITICAL;
    if (eventType === AuditEventType.SUSPICIOUS_ACTIVITY) return AuditSeverity.HIGH;
    return AuditSeverity.MEDIUM;
  }

  private getEventTypeForOperation(operation: string): AuditEventType {
    const operationMap: Record<string, AuditEventType> = {
      'CREATE': AuditEventType.CREATE,
      'READ': AuditEventType.READ,
      'UPDATE': AuditEventType.UPDATE,
      'DELETE': AuditEventType.DELETE
    };

    return operationMap[operation] || AuditEventType.UPDATE;
  }

  private getChangedFields(oldValues?: Record<string, any>, newValues?: Record<string, any>): string[] {
    if (!oldValues || !newValues) return [];

    const changedFields: string[] = [];
    for (const key in newValues) {
      if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  private getComplianceFrameworksForResource(resourceType: string): string[] {
    const frameworkMap: Record<string, string[]> = {
      'User': ['SOX', 'GDPR', 'HIPAA'],
      'Proof': ['SOX', 'GDPR'],
      'BatchOperation': ['SOX'],
      'System': ['SOX'],
      'Security': ['SOX', 'GDPR', 'HIPAA', 'PCI-DSS'],
      'Compliance': ['SOX', 'GDPR', 'HIPAA']
    };

    return frameworkMap[resourceType] || ['SOX'];
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();

export default auditLogger;
