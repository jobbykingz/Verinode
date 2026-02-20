const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Event identification
  eventId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Event details
  eventType: {
    type: String,
    required: true,
    enum: [
      'PROOF_ISSUED', 'PROOF_VERIFIED', 'PROOF_SHARED', 'PROOF_ENCRYPTED',
      'PRIVACY_SETTING_CHANGED', 'KEY_GENERATED', 'KEY_ROTATED',
      'ACCESS_REQUEST', 'CONSENT_GRANTED', 'CONSENT_REVOKED',
      'SELECTIVE_DISCLOSURE', 'ZK_PROOF_GENERATED', 'ZK_PROOF_VERIFIED',
      'USER_LOGIN', 'USER_LOGOUT', 'ROLE_CHANGED', 'PERMISSION_GRANTED',
      'PERMISSION_REVOKED', 'SYSTEM_CONFIGURATION', 'SECURITY_ALERT'
    ]
  },
  
  // Actor information
  actor: {
    type: {
      id: String,
      type: {
        type: String,
        enum: ['USER', 'SYSTEM', 'SERVICE', 'EXTERNAL'],
        default: 'USER'
      },
      name: String,
      ipAddress: String,
      userAgent: String
    },
    required: true
  },
  
  // Resource information
  resource: {
    type: {
      id: String,
      type: String,
      name: String
    }
  },
  
  // Action details
  action: {
    type: String,
    required: true
  },
  
  // Event data
  eventData: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Compliance metadata
  compliance: {
    gdprRelevant: {
      type: Boolean,
      default: false
    },
    hipaaRelevant: {
      type: Boolean,
      default: false
    },
    soxRelevant: {
      type: Boolean,
      default: false
    },
    pciRelevant: {
      type: Boolean,
      default: false
    },
    classification: {
      type: String,
      enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
      default: 'INTERNAL'
    }
  },
  
  // Digital signature for integrity
  digitalSignature: {
    signature: String,
    publicKey: String,
    signedAt: Date
  },
  
  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // Location information
  location: {
    type: {
      country: String,
      region: String,
      city: String
    }
  },
  
  // Session information
  sessionId: String,
  
  // Correlation ID for tracking related events
  correlationId: String,
  
  // Success/failure status
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILURE', 'PARTIAL'],
    default: 'SUCCESS'
  },
  
  // Error information (if applicable)
  error: {
    code: String,
    message: String,
    stackTrace: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ 'actor.id': 1 });
auditLogSchema.index({ 'resource.id': 1 });
auditLogSchema.index({ eventType: 1 });
auditLogSchema.index({ 'compliance.classification': 1 });
auditLogSchema.index({ correlationId: 1 });
auditLogSchema.index({ sessionId: 1 });

// Compound indexes for common queries
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ 'actor.id': 1, timestamp: -1 });
auditLogSchema.index({ 'compliance.gdprRelevant': 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);