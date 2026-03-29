import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

/**
 * Audit Log Types
 */
export enum AuditEventType {
  // Authentication Events
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTER = 'USER_REGISTER',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  
  // CRUD Operations
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  
  // System Events
  SYSTEM_STARTUP = 'SYSTEM_STARTUP',
  SYSTEM_SHUTDOWN = 'SYSTEM_SHUTDOWN',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
  
  // Security Events
  SECURITY_BREACH = 'SECURITY_BREACH',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  BLOCKED_REQUEST = 'BLOCKED_REQUEST',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Data Events
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT',
  DATA_PURGE = 'DATA_PURGE',
  DATA_ARCHIVE = 'DATA_ARCHIVE',
  
  // Compliance Events
  COMPLIANCE_CHECK = 'COMPLIANCE_CHECK',
  AUDIT_REPORT_GENERATED = 'AUDIT_REPORT_GENERATED',
  REGULATORY_FILING = 'REGULATORY_FILING',
  
  // Business Events
  PROOF_CREATED = 'PROOF_CREATED',
  PROOF_VERIFIED = 'PROOF_VERIFIED',
  PROOF_REVOKED = 'PROOF_REVOKED',
  BATCH_OPERATION = 'BATCH_OPERATION',
  
  // Admin Events
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

/**
 * Audit Log Interface
 */
export interface IAuditLog extends Document {
  // Core audit fields
  auditId: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  status: AuditStatus;
  timestamp: Date;
  
  // User and session information
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  
  // Action details
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceUrl?: string;
  
  // Request details
  requestId?: string;
  correlationId?: string;
  method?: string;
  endpoint?: string;
  
  // Data changes
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changedFields?: string[];
  
  // Metadata and context
  metadata: {
    [key: string]: any;
    organizationId?: string;
    tenantId?: string;
    location?: string;
    device?: string;
    platform?: string;
  };
  
  // Security and integrity
  checksum: string;
  previousHash?: string;
  blockchainHash?: string;
  blockchainTxId?: string;
  
  // Compliance fields
  complianceFrameworks: string[];
  retentionPeriod: number;
  isArchived: boolean;
  archivedAt?: Date;
  
  // Processing fields
  processed: boolean;
  processedAt?: Date;
  alertTriggered: boolean;
  alertSentAt?: Date;
  
  // Indexes and search
  searchText?: string;
  tags: string[];
}

/**
 * Audit Log Schema
 */
const AuditLogSchema = new Schema<IAuditLog>({
  auditId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: Object.values(AuditEventType),
    index: true
  },
  severity: {
    type: String,
    required: true,
    enum: Object.values(AuditSeverity),
    index: true,
    default: AuditSeverity.MEDIUM
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(AuditStatus),
    index: true,
    default: AuditStatus.SUCCESS
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // User and session information
  userId: {
    type: String,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  userAgent: String,
  ipAddress: {
    type: String,
    index: true
  },
  
  // Action details
  action: {
    type: String,
    required: true,
    index: true
  },
  resourceType: {
    type: String,
    required: true,
    index: true
  },
  resourceId: {
    type: String,
    index: true
  },
  resourceUrl: String,
  
  // Request details
  requestId: {
    type: String,
    index: true
  },
  correlationId: {
    type: String,
    index: true
  },
  method: String,
  endpoint: String,
  
  // Data changes
  oldValues: {
    type: Schema.Types.Mixed
  },
  newValues: {
    type: Schema.Types.Mixed
  },
  changedFields: [String],
  
  // Metadata and context
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  
  // Security and integrity
  checksum: {
    type: String,
    required: true,
    index: true
  },
  previousHash: String,
  blockchainHash: String,
  blockchainTxId: String,
  
  // Compliance fields
  complianceFrameworks: [String],
  retentionPeriod: {
    type: Number,
    default: 2555 // 7 years in days
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  archivedAt: Date,
  
  // Processing fields
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  processedAt: Date,
  alertTriggered: {
    type: Boolean,
    default: false,
    index: true
  },
  alertSentAt: Date,
  
  // Indexes and search
  searchText: String,
  tags: [String]
}, {
  timestamps: true,
  collection: 'audit_logs'
});

// Compound indexes for optimal query performance
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ eventType: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });
AuditLogSchema.index({ status: 1, timestamp: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
AuditLogSchema.index({ ipAddress: 1, timestamp: -1 });
AuditLogSchema.index({ correlationId: 1 });
AuditLogSchema.index({ checksum: 1 });
AuditLogSchema.index({ blockchainHash: 1 });
AuditLogSchema.index({ isArchived: 1, timestamp: -1 });
AuditLogSchema.index({ alertTriggered: 1, timestamp: -1 });

// Text index for full-text search
AuditLogSchema.index({
  action: 'text',
  resourceType: 'text',
  searchText: 'text',
  'metadata.organizationId': 'text',
  tags: 'text'
});

// Pre-save middleware to generate checksum and maintain integrity
AuditLogSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate unique audit ID
    if (!this.auditId) {
      this.auditId = `audit_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    }
    
    // Generate search text for full-text search
    const searchComponents = [
      this.action,
      this.resourceType,
      this.resourceId || '',
      this.userId || '',
      this.ipAddress || '',
      ...(this.tags || [])
    ];
    this.searchText = searchComponents.join(' ').toLowerCase();
    
    // Calculate checksum
    const auditData = {
      auditId: this.auditId,
      eventType: this.eventType,
      timestamp: this.timestamp,
      userId: this.userId,
      action: this.action,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      oldValues: this.oldValues,
      newValues: this.newValues
    };
    
    this.checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(auditData))
      .digest('hex');
    
    // Get previous audit log for hash chaining
    const lastAudit = await this.constructor
      .findOne({})
      .sort({ timestamp: -1 })
      .limit(1);
    
    if (lastAudit) {
      this.previousHash = lastAudit.checksum;
    }
  }
  
  next();
});

// Static methods
AuditLogSchema.statics.findByUser = function(
  userId: string,
  options: { fromDate?: Date; toDate?: Date; limit?: number } = {}
) {
  const query: any = { userId };
  
  if (options.fromDate || options.toDate) {
    query.timestamp = {};
    if (options.fromDate) query.timestamp.$gte = options.fromDate;
    if (options.toDate) query.timestamp.$lte = options.toDate;
  }
  
  let dbQuery = this.find(query).sort({ timestamp: -1 });
  
  if (options.limit) {
    dbQuery = dbQuery.limit(options.limit);
  }
  
  return dbQuery;
};

AuditLogSchema.statics.findByEventType = function(
  eventType: AuditEventType,
  options: { fromDate?: Date; toDate?: Date; limit?: number } = {}
) {
  const query: any = { eventType };
  
  if (options.fromDate || options.toDate) {
    query.timestamp = {};
    if (options.fromDate) query.timestamp.$gte = options.fromDate;
    if (options.toDate) query.timestamp.$lte = options.toDate;
  }
  
  let dbQuery = this.find(query).sort({ timestamp: -1 });
  
  if (options.limit) {
    dbQuery = dbQuery.limit(options.limit);
  }
  
  return dbQuery;
};

AuditLogSchema.statics.findByResource = function(
  resourceType: string,
  resourceId: string,
  options: { limit?: number } = {}
) {
  const query = { resourceType, resourceId };
  
  let dbQuery = this.find(query).sort({ timestamp: -1 });
  
  if (options.limit) {
    dbQuery = dbQuery.limit(options.limit);
  }
  
  return dbQuery;
};

AuditLogSchema.statics.findSecurityEvents = function(
  options: { fromDate?: Date; toDate?: Date; severity?: AuditSeverity[]; limit?: number } = {}
) {
  const securityEventTypes = [
    AuditEventType.SECURITY_BREACH,
    AuditEventType.SUSPICIOUS_ACTIVITY,
    AuditEventType.BLOCKED_REQUEST,
    AuditEventType.RATE_LIMIT_EXCEEDED,
    AuditEventType.USER_LOGIN,
    AuditEventType.PASSWORD_CHANGE,
    AuditEventType.MFA_ENABLED,
    AuditEventType.MFA_DISABLED
  ];
  
  const query: any = { eventType: { $in: securityEventTypes } };
  
  if (options.fromDate || options.toDate) {
    query.timestamp = {};
    if (options.fromDate) query.timestamp.$gte = options.fromDate;
    if (options.toDate) query.timestamp.$lte = options.toDate;
  }
  
  if (options.severity && options.severity.length > 0) {
    query.severity = { $in: options.severity };
  }
  
  let dbQuery = this.find(query).sort({ timestamp: -1 });
  
  if (options.limit) {
    dbQuery = dbQuery.limit(options.limit);
  }
  
  return dbQuery;
};

AuditLogSchema.statics.searchAuditLogs = function(
  searchText: string,
  options: { limit?: number; offset?: number } = {}
) {
  const query = {
    $text: { $search: searchText }
  };
  
  let dbQuery = this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, timestamp: -1 });
  
  if (options.offset) {
    dbQuery = dbQuery.skip(options.offset);
  }
  
  if (options.limit) {
    dbQuery = dbQuery.limit(options.limit);
  }
  
  return dbQuery;
};

// Instance methods
AuditLogSchema.methods.verifyIntegrity = function() {
  const auditData = {
    auditId: this.auditId,
    eventType: this.eventType,
    timestamp: this.timestamp,
    userId: this.userId,
    action: this.action,
    resourceType: this.resourceType,
    resourceId: this.resourceId,
    oldValues: this.oldValues,
    newValues: this.newValues
  };
  
  const calculatedChecksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(auditData))
    .digest('hex');
  
  return this.checksum === calculatedChecksum;
};

AuditLogSchema.methods.markAsProcessed = function() {
  this.processed = true;
  this.processedAt = new Date();
  return this.save();
};

AuditLogSchema.methods.triggerAlert = function() {
  this.alertTriggered = true;
  this.alertSentAt = new Date();
  return this.save();
};

AuditLogSchema.methods.archive = function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

// Virtual for event age
AuditLogSchema.virtual('age').get(function() {
  return Date.now() - this.timestamp.getTime();
});

// Virtual for retention status
AuditLogSchema.virtual('isRetentionExpired').get(function() {
  if (!this.retentionPeriod) return false;
  const retentionDate = new Date(this.timestamp);
  retentionDate.setDate(retentionDate.getDate() + this.retentionPeriod);
  return new Date() > retentionDate;
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLog;
