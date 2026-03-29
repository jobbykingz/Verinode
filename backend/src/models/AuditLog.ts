import mongoose, { Schema, Document } from 'mongoose';

export enum EventType {
  PROOF_ISSUED = 'PROOF_ISSUED',
  PROOF_VERIFIED = 'PROOF_VERIFIED',
  PROOF_SHARED = 'PROOF_SHARED',
  PROOF_ENCRYPTED = 'PROOF_ENCRYPTED',
  PRIVACY_SETTING_CHANGED = 'PRIVACY_SETTING_CHANGED',
  KEY_GENERATED = 'KEY_GENERATED',
  KEY_ROTATED = 'KEY_ROTATED',
  ACCESS_REQUEST = 'ACCESS_REQUEST',
  CONSENT_GRANTED = 'CONSENT_GRANTED',
  CONSENT_REVOKED = 'CONSENT_REVOKED',
  SELECTIVE_DISCLOSURE = 'SELECTIVE_DISCLOSURE',
  ZK_PROOF_GENERATED = 'ZK_PROOF_GENERATED',
  ZK_PROOF_VERIFIED = 'ZK_PROOF_VERIFIED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  ROLE_CHANGED = 'ROLE_CHANGED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  SYSTEM_CONFIGURATION = 'SYSTEM_CONFIGURATION',
  SECURITY_ALERT = 'SECURITY_ALERT',
  DATA_DELETE_REQUEST = 'DATA_DELETE_REQUEST',
  DATA_EXPORT_REQUEST = 'DATA_EXPORT_REQUEST'
}

export interface IAuditLog extends Document {
  eventId: string;
  eventType: EventType;
  actor: {
    id: string;
    type: 'USER' | 'SYSTEM' | 'SERVICE' | 'EXTERNAL';
    name?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  resource?: {
    id?: string;
    type?: string;
    name?: string;
  };
  action: string;
  eventData?: any;
  compliance: {
    gdprRelevant: boolean;
    hipaaRelevant: boolean;
    soxRelevant: boolean;
    pciRelevant: boolean;
    classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    isDeleted?: boolean;
    retentionUntil?: Date;
  };
  digitalSignature?: {
    signature: string;
    publicKey: string;
    signedAt: Date;
  };
  timestamp: Date;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  sessionId?: string;
  correlationId?: string;
  status: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  error?: {
    code?: string;
    message?: string;
    stackTrace?: string;
  };
  isImmutable: boolean;
}

const AuditLogSchema: Schema = new Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, enum: Object.values(EventType), required: true },
  actor: {
    id: { type: String, required: true },
    type: { type: String, enum: ['USER', 'SYSTEM', 'SERVICE', 'EXTERNAL'], default: 'USER' },
    name: String,
    ipAddress: String,
    userAgent: String
  },
  resource: {
    id: String,
    type: String,
    name: String
  },
  action: { type: String, required: true },
  eventData: Schema.Types.Mixed,
  compliance: {
    gdprRelevant: { type: Boolean, default: false },
    hipaaRelevant: { type: Boolean, default: false },
    soxRelevant: { type: Boolean, default: false },
    pciRelevant: { type: Boolean, default: false },
    classification: { type: String, enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'], default: 'INTERNAL' },
    isDeleted: { type: Boolean, default: false },
    retentionUntil: Date
  },
  digitalSignature: {
    signature: String,
    publicKey: String,
    signedAt: Date
  },
  timestamp: { type: Date, default: Date.now, required: true },
  location: {
    country: String,
    region: String,
    city: String
  },
  sessionId: String,
  correlationId: String,
  status: { type: String, enum: ['SUCCESS', 'FAILURE', 'PARTIAL'], default: 'SUCCESS' },
  error: {
    code: String,
    message: String,
    stackTrace: String
  },
  isImmutable: { type: Boolean, default: true }
}, {
  timestamps: true
});

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ 'actor.id': 1 });
AuditLogSchema.index({ eventType: 1 });
AuditLogSchema.index({ 'compliance.retentionUntil': 1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
