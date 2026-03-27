export interface BaseEvent {
  id: string;
  type: string;
  timestamp: Date;
  version: string;
  source: string;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, any>;
  retryCount?: number;
  maxRetries?: number;
}

export interface EventPayload {
  [key: string]: any;
}

// Proof Events
export interface ProofCreatedEvent extends BaseEvent {
  type: 'PROOF_CREATED';
  payload: {
    proofId: string;
    proofType: string;
    creator: string;
    commitment: string;
    verificationKey: string;
    publicInputs: any[];
    metadata?: {
      description?: string;
      expiresAt?: Date;
    };
  };
}

export interface ProofVerifiedEvent extends BaseEvent {
  type: 'PROOF_VERIFIED';
  payload: {
    proofId: string;
    verified: boolean;
    verificationTime: number;
    verificationAttempts: number;
    error?: string;
    verifiedBy?: string;
  };
}

export interface ProofUpdatedEvent extends BaseEvent {
  type: 'PROOF_UPDATED';
  payload: {
    proofId: string;
    updates: Partial<{
      proofType: string;
      commitment: string;
      verificationKey: string;
      publicInputs: any[];
      metadata: any;
    }>;
    updatedBy: string;
  };
}

export interface ProofDeletedEvent extends BaseEvent {
  type: 'PROOF_DELETED';
  payload: {
    proofId: string;
    deletedBy: string;
    reason?: string;
  };
}

// User Events
export interface UserRegisteredEvent extends BaseEvent {
  type: 'USER_REGISTERED';
  payload: {
    userId: string;
    email: string;
    username?: string;
    registrationSource: string;
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
    };
  };
}

export interface UserLoggedInEvent extends BaseEvent {
  type: 'USER_LOGGED_IN';
  payload: {
    userId: string;
    loginMethod: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId: string;
  };
}

export interface UserUpdatedEvent extends BaseEvent {
  type: 'USER_UPDATED';
  payload: {
    userId: string;
    updates: Partial<{
      email: string;
      username: string;
      profile: any;
      preferences: any;
    }>;
    updatedBy: string;
  };
}

export interface UserDeactivatedEvent extends BaseEvent {
  type: 'USER_DEACTIVATED';
  payload: {
    userId: string;
    deactivatedBy: string;
    reason?: string;
  };
}

// Authentication Events
export interface AuthTokenGeneratedEvent extends BaseEvent {
  type: 'AUTH_TOKEN_GENERATED';
  payload: {
    userId: string;
    tokenType: 'access' | 'refresh' | 'reset';
    expiresIn: number;
    scope?: string[];
    ipAddress?: string;
  };
}

export interface AuthTokenRevokedEvent extends BaseEvent {
  type: 'AUTH_TOKEN_REVOKED';
  payload: {
    userId: string;
    tokenId: string;
    reason: string;
    revokedBy: string;
  };
}

export interface AuthFailedEvent extends BaseEvent {
  type: 'AUTH_FAILED';
  payload: {
    userId?: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
    attemptCount: number;
  };
}

export interface PasswordChangedEvent extends BaseEvent {
  type: 'PASSWORD_CHANGED';
  payload: {
    userId: string;
    changedBy: string;
    ipAddress?: string;
    method: 'user' | 'admin' | 'reset';
  };
}

// System Events
export interface SystemErrorEvent extends BaseEvent {
  type: 'SYSTEM_ERROR';
  payload: {
    error: string;
    stack?: string;
    component: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    context?: Record<string, any>;
  };
}

export interface SystemMetricEvent extends BaseEvent {
  type: 'SYSTEM_METRIC';
  payload: {
    metricName: string;
    value: number;
    unit: string;
    tags?: Record<string, string>;
  };
}

// Union type for all events
export type Event = 
  | ProofCreatedEvent
  | ProofVerifiedEvent
  | ProofUpdatedEvent
  | ProofDeletedEvent
  | UserRegisteredEvent
  | UserLoggedInEvent
  | UserUpdatedEvent
  | UserDeactivatedEvent
  | AuthTokenGeneratedEvent
  | AuthTokenRevokedEvent
  | AuthFailedEvent
  | PasswordChangedEvent
  | SystemErrorEvent
  | SystemMetricEvent;

// Event Handler Types
export type EventHandler<T extends Event = Event> = (event: T) => Promise<void> | void;

export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  filter?: (event: Event) => boolean;
  retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
  retryableErrors?: string[];
}

// Event Store Types
export interface EventStoreRecord {
  id: string;
  event: Event;
  storedAt: Date;
  version: number;
  streamId?: string;
  streamVersion?: number;
}

export interface EventStream {
  id: string;
  version: number;
  events: Event[];
  metadata?: Record<string, any>;
}

// Event Bus Types
export interface EventBusConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  deadLetterQueue: {
    maxSize: number;
    ttl: number;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
  };
}

// Event Processing Types
export interface EventProcessingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  retried: number;
  deadLettered: number;
  averageProcessingTime: number;
  lastProcessedAt?: Date;
}

export interface EventFilter {
  eventTypes?: string[];
  source?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  metadata?: Record<string, any>;
}

// Event Replay Types
export interface ReplayOptions {
  fromTimestamp?: Date;
  toTimestamp?: Date;
  eventTypes?: string[];
  batchSize?: number;
  parallel?: boolean;
  dryRun?: boolean;
}

export interface ReplayResult {
  replayedEvents: number;
  successful: number;
  failed: number;
  errors: Array<{
    eventId: string;
    error: string;
  }>;
  duration: number;
}

// Event Monitoring Types
export interface EventMetrics {
  eventType: string;
  count: number;
  successRate: number;
  averageProcessingTime: number;
  errorRate: number;
  lastHour: number;
  lastDay: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  timeWindow: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notifications: string[];
}

export interface EventAlert {
  id: string;
  ruleId: string;
  eventType: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggeredAt: Date;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}
