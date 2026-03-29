import { EventBusConfig, AlertRule } from '../events/EventTypes';

export const eventBusConfig: EventBusConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'verinode:events:'
  },
  deadLetterQueue: {
    maxSize: parseInt(process.env.EVENT_DLQ_MAX_SIZE || '10000'),
    ttl: parseInt(process.env.EVENT_DLQ_TTL || '604800000') // 7 days in ms
  },
  monitoring: {
    enabled: process.env.EVENT_MONITORING_ENABLED !== 'false',
    metricsInterval: parseInt(process.env.EVENT_METRICS_INTERVAL || '60000') // 1 minute
  }
};

export const eventStoreConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_EVENT_STORE_DB || '1'),
    keyPrefix: process.env.REDIS_EVENT_STORE_KEY_PREFIX || 'verinode:event_store:'
  },
  retention: {
    defaultDays: parseInt(process.env.EVENT_RETENTION_DAYS || '90'),
    cleanupIntervalHours: parseInt(process.env.EVENT_CLEANUP_INTERVAL_HOURS || '24')
  }
};

export const defaultAlertRules: AlertRule[] = [
  {
    id: 'high_error_rate',
    name: 'High Error Rate',
    condition: 'high_error_rate',
    threshold: 10, // 10% error rate
    timeWindow: 300000, // 5 minutes
    severity: 'high',
    enabled: true,
    notifications: ['email', 'slack']
  },
  {
    id: 'low_success_rate',
    name: 'Low Success Rate',
    condition: 'low_success_rate',
    threshold: 90, // 90% success rate minimum
    timeWindow: 300000, // 5 minutes
    severity: 'medium',
    enabled: true,
    notifications: ['email']
  },
  {
    id: 'high_event_volume',
    name: 'High Event Volume',
    condition: 'high_volume',
    threshold: 1000, // 1000 events per hour
    timeWindow: 3600000, // 1 hour
    severity: 'medium',
    enabled: true,
    notifications: ['slack']
  },
  {
    id: 'slow_processing',
    name: 'Slow Event Processing',
    condition: 'slow_processing',
    threshold: 5000, // 5000ms average processing time
    timeWindow: 300000, // 5 minutes
    severity: 'low',
    enabled: true,
    notifications: ['email']
  },
  {
    id: 'dead_letter_queue_full',
    name: 'Dead Letter Queue Full',
    condition: 'high_error_rate',
    threshold: 80, // 80% of DLQ capacity
    timeWindow: 60000, // 1 minute
    severity: 'critical',
    enabled: true,
    notifications: ['email', 'slack', 'pagerduty']
  }
];

export const eventProcessingConfig = {
  batchSize: parseInt(process.env.EVENT_BATCH_SIZE || '100'),
  batchTimeoutMs: parseInt(process.env.EVENT_BATCH_TIMEOUT || '1000'),
  maxConcurrentHandlers: parseInt(process.env.EVENT_MAX_CONCURRENT_HANDLERS || '10'),
  handlerTimeoutMs: parseInt(process.env.EVENT_HANDLER_TIMEOUT || '30000'),
  retryConfig: {
    maxRetries: parseInt(process.env.EVENT_MAX_RETRIES || '3'),
    baseDelayMs: parseInt(process.env.EVENT_RETRY_BASE_DELAY || '1000'),
    maxDelayMs: parseInt(process.env.EVENT_RETRY_MAX_DELAY || '30000'),
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR'
    ]
  }
};

export const eventSchemaConfig = {
  enabled: process.env.EVENT_SCHEMA_VALIDATION !== 'false',
  strictMode: process.env.EVENT_SCHEMA_STRICT === 'true',
  schemas: {
    // Proof Events
    PROOF_CREATED: {
      required: ['proofId', 'proofType', 'creator', 'commitment', 'verificationKey', 'publicInputs'],
      optional: ['description', 'expiresAt']
    },
    PROOF_VERIFIED: {
      required: ['proofId', 'verified', 'verificationTime', 'verificationAttempts'],
      optional: ['error', 'verifiedBy']
    },
    PROOF_UPDATED: {
      required: ['proofId', 'updates', 'updatedBy']
    },
    PROOF_DELETED: {
      required: ['proofId', 'deletedBy'],
      optional: ['reason']
    },
    
    // User Events
    USER_REGISTERED: {
      required: ['userId', 'email', 'registrationSource'],
      optional: ['username', 'ipAddress', 'userAgent', 'referrer']
    },
    USER_LOGGED_IN: {
      required: ['userId', 'loginMethod', 'sessionId'],
      optional: ['ipAddress', 'userAgent']
    },
    USER_UPDATED: {
      required: ['userId', 'updates', 'updatedBy']
    },
    USER_DEACTIVATED: {
      required: ['userId', 'deactivatedBy'],
      optional: ['reason']
    },
    
    // Authentication Events
    AUTH_TOKEN_GENERATED: {
      required: ['userId', 'tokenType', 'expiresIn'],
      optional: ['scope', 'ipAddress']
    },
    AUTH_TOKEN_REVOKED: {
      required: ['userId', 'tokenId', 'reason', 'revokedBy']
    },
    AUTH_FAILED: {
      required: ['reason', 'attemptCount'],
      optional: ['userId', 'ipAddress', 'userAgent']
    },
    PASSWORD_CHANGED: {
      required: ['userId', 'changedBy', 'method'],
      optional: ['ipAddress']
    },
    
    // System Events
    SYSTEM_ERROR: {
      required: ['error', 'component', 'severity'],
      optional: ['stack', 'context']
    },
    SYSTEM_METRIC: {
      required: ['metricName', 'value', 'unit'],
      optional: ['tags']
    }
  }
};

export const eventRoutingConfig = {
  // Route events to specific handlers based on patterns
  routes: [
    {
      pattern: /^PROOF_.*$/,
      handlers: ['proofHandler', 'auditHandler', 'metricsHandler'],
      priority: 'high'
    },
    {
      pattern: /^USER_.*$/,
      handlers: ['userHandler', 'analyticsHandler', 'notificationHandler'],
      priority: 'medium'
    },
    {
      pattern: /^AUTH_.*$/,
      handlers: ['authHandler', 'securityHandler', 'auditHandler'],
      priority: 'high'
    },
    {
      pattern: /^SYSTEM_.*$/,
      handlers: ['systemHandler', 'monitoringHandler'],
      priority: 'low'
    }
  ],
  
  // Default handlers for unmatched events
  defaultHandlers: ['defaultHandler', 'auditHandler']
};

export const eventSecurityConfig = {
  // Security settings for event processing
  maxEventSize: parseInt(process.env.EVENT_MAX_SIZE || '1048576'), // 1MB
  maxPayloadSize: parseInt(process.env.EVENT_MAX_PAYLOAD_SIZE || '524288'), // 512KB
  allowedSources: process.env.EVENT_ALLOWED_SOURCES?.split(',') || [
    'verinode-backend',
    'verinode-frontend',
    'verinode-api',
    'verinode-worker'
  ],
  blockedSources: process.env.EVENT_BLOCKED_SOURCES?.split(',') || [],
  rateLimiting: {
    enabled: process.env.EVENT_RATE_LIMITING !== 'false',
    windowMs: parseInt(process.env.EVENT_RATE_WINDOW_MS || '60000'), // 1 minute
    maxEvents: parseInt(process.env.EVENT_RATE_MAX_EVENTS || '1000')
  },
  encryption: {
    enabled: process.env.EVENT_ENCRYPTION === 'true',
    algorithm: process.env.EVENT_ENCRYPTION_ALGORITHM || 'aes-256-gcm',
    keyRotationHours: parseInt(process.env.EVENT_KEY_ROTATION_HOURS || '168') // 7 days
  }
};

export const eventMonitoringConfig = {
  // Monitoring and observability settings
  metrics: {
    enabled: process.env.EVENT_METRICS_ENABLED !== 'false',
    exportInterval: parseInt(process.env.EVENT_METRICS_EXPORT_INTERVAL || '60000'), // 1 minute
    retentionDays: parseInt(process.env.EVENT_METRICS_RETENTION_DAYS || '30'),
    exportFormat: process.env.EVENT_METRICS_FORMAT || 'prometheus'
  },
  
  tracing: {
    enabled: process.env.EVENT_TRACING_ENABLED !== 'false',
    sampleRate: parseFloat(process.env.EVENT_TRACING_SAMPLE_RATE || '0.1'), // 10%
    serviceName: process.env.EVENT_TRACING_SERVICE_NAME || 'verinode-events',
    jaegerEndpoint: process.env.EVENT_JAEGER_ENDPOINT
  },
  
  logging: {
    level: process.env.EVENT_LOG_LEVEL || 'info',
    structured: process.env.EVENT_STRUCTURED_LOGGING !== 'false',
    includePayloads: process.env.EVENT_LOG_PAYLOADS === 'true',
    maxPayloadSize: parseInt(process.env.EVENT_LOG_MAX_PAYLOAD_SIZE || '1024')
  }
};

export const eventPerformanceConfig = {
  // Performance optimization settings
  compression: {
    enabled: process.env.EVENT_COMPRESSION !== 'false',
    algorithm: process.env.EVENT_COMPRESSION_ALGORITHM || 'gzip',
    threshold: parseInt(process.env.EVENT_COMPRESSION_THRESHOLD || '1024') // 1KB
  },
  
  caching: {
    enabled: process.env.EVENT_CACHING !== 'false',
    ttl: parseInt(process.env.EVENT_CACHE_TTL || '300'), // 5 minutes
    maxSize: parseInt(process.env.EVENT_CACHE_MAX_SIZE || '10000')
  },
  
  pooling: {
    enabled: process.env.EVENT_POOLING !== 'false',
    minConnections: parseInt(process.env.EVENT_POOL_MIN_CONNECTIONS || '5'),
    maxConnections: parseInt(process.env.EVENT_POOL_MAX_CONNECTIONS || '20'),
    acquireTimeoutMs: parseInt(process.env.EVENT_POOL_ACQUIRE_TIMEOUT || '5000')
  }
};

// Environment-specific configurations
export const getEventConfig = (environment?: string) => {
  const env = environment || process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...eventBusConfig,
        deadLetterQueue: {
          ...eventBusConfig.deadLetterQueue,
          maxSize: 50000,
          ttl: 14 * 24 * 60 * 60 * 1000 // 14 days
        },
        monitoring: {
          ...eventBusConfig.monitoring,
          enabled: true,
          metricsInterval: 30000 // 30 seconds
        }
      };
      
    case 'staging':
      return {
        ...eventBusConfig,
        deadLetterQueue: {
          ...eventBusConfig.deadLetterQueue,
          maxSize: 20000,
          ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
        },
        monitoring: {
          ...eventBusConfig.monitoring,
          enabled: true,
          metricsInterval: 60000 // 1 minute
        }
      };
      
    case 'development':
    default:
      return {
        ...eventBusConfig,
        deadLetterQueue: {
          ...eventBusConfig.deadLetterQueue,
          maxSize: 1000,
          ttl: 24 * 60 * 60 * 1000 // 1 day
        },
        monitoring: {
          ...eventBusConfig.monitoring,
          enabled: true,
          metricsInterval: 120000 // 2 minutes
        }
      };
  }
};

export default {
  eventBusConfig,
  eventStoreConfig,
  defaultAlertRules,
  eventProcessingConfig,
  eventSchemaConfig,
  eventRoutingConfig,
  eventSecurityConfig,
  eventMonitoringConfig,
  eventPerformanceConfig,
  getEventConfig
};
