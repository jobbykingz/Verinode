use soroban_sdk::{contracttype, Address, Bytes, Env, String, Vec, Map, Symbol, u64, i64};

/// Event types supported in the system
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EventType {
    ProofIssued,
    ProofVerified,
    ProofUpdated,
    BatchOperation,
    SystemEvent,
    CrossChainEvent,
    GovernanceEvent,
    TreasuryEvent,
}

/// Event severity levels
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EventSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Event schema version for compatibility
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventSchema {
    pub version: u32,
    pub schema_hash: Bytes,
    pub created_at: u64,
    pub is_active: bool,
}

/// Structured event format
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StructuredEvent {
    pub event_id: Bytes,
    pub event_type: EventType,
    pub emitter: Address,
    pub timestamp: u64,
    pub block_number: u64,
    pub transaction_hash: Bytes,
    pub log_index: u32,
    pub severity: EventSeverity,
    pub schema_version: u32,
    pub data: Map<Symbol, Bytes>,
    pub indexed_data: Map<Symbol, Bytes>,
    pub topics: Vec<Symbol>,
    pub gas_used: u64,
    pub status: EventStatus,
}

/// Event processing status
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EventStatus {
    Pending,
    Processed,
    Failed,
    Reverted,
}

/// Event batch for gas optimization
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventBatch {
    pub batch_id: Bytes,
    pub events: Vec<StructuredEvent>,
    pub batch_timestamp: u64,
    pub batch_gas_used: u64,
    pub batch_status: BatchStatus,
    pub retry_count: u32,
}

/// Batch processing status
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BatchStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    PartiallyCompleted,
}

/// Event subscription filter
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventFilter {
    pub filter_id: Bytes,
    pub subscriber: Address,
    pub event_types: Vec<EventType>,
    pub emitters: Vec<Address>,
    pub topics: Vec<Symbol>,
    pub severity_range: (EventSeverity, EventSeverity),
    pub time_range: (u64, u64),
    pub data_filters: Map<Symbol, Bytes>,
    pub is_active: bool,
    pub created_at: u64,
}

/// Event subscription
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventSubscription {
    pub subscription_id: Bytes,
    pub filter: EventFilter,
    pub webhook_url: Option<String>,
    pub notification_preferences: NotificationPreferences,
    pub last_processed_event: Option<Bytes>,
    pub created_at: u64,
    pub updated_at: u64,
}

/// Notification preferences for subscriptions
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NotificationPreferences {
    pub real_time_notifications: bool,
    pub batch_notifications: bool,
    pub batch_size: u32,
    pub notification_channels: Vec<Symbol>,
    pub retry_policy: RetryPolicy,
}

/// Retry policy for failed notifications
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RetryPolicy {
    pub max_retries: u32,
    pub retry_delay: u64,
    pub backoff_multiplier: u32,
    pub max_delay: u64,
}

/// Event analytics data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventAnalytics {
    pub total_events: u64,
    pub events_by_type: Map<EventType, u64>,
    pub events_by_severity: Map<EventSeverity, u64>,
    pub events_by_emitter: Map<Address, u64>,
    pub average_gas_per_event: u64,
    pub failed_events: u64,
    pub processing_time_avg: u64,
    pub last_analyzed: u64,
}

/// Event replay configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReplayConfig {
    pub replay_id: Bytes,
    pub start_block: u64,
    pub end_block: u64,
    pub event_types: Vec<EventType>,
    pub filters: Vec<EventFilter>,
    pub replay_status: ReplayStatus,
    pub progress: u32,
    pub created_at: u64,
}

/// Replay status tracking
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReplayStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

/// Storage keys for structured events
#[contracttype]
pub enum EventStorageKey {
    Event(Bytes),
    EventBatch(Bytes),
    EventFilter(Bytes),
    EventSubscription(Bytes),
    EventSchema(u32),
    EventAnalytics,
    ReplayConfig(Bytes),
    EventCounter,
    BatchCounter,
    SubscriptionCounter,
    FilterCounter,
}

/// Event system configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventSystemConfig {
    pub max_batch_size: u32,
    pub max_events_per_block: u32,
    pub default_gas_limit: u64,
    pub retention_period: u64,
    pub max_subscriptions_per_address: u32,
    pub max_filters_per_subscription: u32,
    pub analytics_update_interval: u64,
    pub replay_enabled: bool,
}

impl StructuredEvent {
    /// Create a new structured event
    pub fn new(
        env: &Env,
        event_type: EventType,
        emitter: Address,
        data: Map<Symbol, Bytes>,
        indexed_data: Map<Symbol, Bytes>,
    ) -> Self {
        let event_id = env.crypto().sha256(&{
            let mut bytes = Vec::new(env);
            bytes.push_back(emitter.clone());
            bytes.push_back(env.ledger().timestamp().to_be_bytes());
            bytes.push_back(env.ledger().sequence().to_be_bytes());
            bytes
        });

        Self {
            event_id,
            event_type,
            emitter,
            timestamp: env.ledger().timestamp(),
            block_number: env.ledger().sequence(),
            transaction_hash: Bytes::new(env), // Will be set during emission
            log_index: 0, // Will be set during emission
            severity: EventSeverity::Medium,
            schema_version: 1,
            data,
            indexed_data,
            topics: Vec::new(env),
            gas_used: 0,
            status: EventStatus::Pending,
        }
    }

    /// Add a topic to the event
    pub fn add_topic(&mut self, topic: Symbol) {
        self.topics.push_back(topic);
    }

    /// Set event severity
    pub fn set_severity(&mut self, severity: EventSeverity) {
        self.severity = severity;
    }

    /// Mark event as processed
    pub fn mark_processed(&mut self) {
        self.status = EventStatus::Processed;
    }

    /// Mark event as failed
    pub fn mark_failed(&mut self) {
        self.status = EventStatus::Failed;
    }

    /// Get event signature for filtering
    pub fn get_signature(&self) -> Bytes {
        let env = self.event_id.env();
        let mut signature_data = Vec::new(env);
        signature_data.push_back(self.event_type.clone().into());
        signature_data.push_back(self.emitter.clone());
        signature_data.push_back(self.schema_version.to_be_bytes());
        env.crypto().sha256(&signature_data)
    }
}

impl EventBatch {
    /// Create a new event batch
    pub fn new(env: &Env, batch_id: Bytes) -> Self {
        Self {
            batch_id,
            events: Vec::new(env),
            batch_timestamp: env.ledger().timestamp(),
            batch_gas_used: 0,
            batch_status: BatchStatus::Pending,
            retry_count: 0,
        }
    }

    /// Add an event to the batch
    pub fn add_event(&mut self, event: StructuredEvent) {
        self.events.push_back(event);
    }

    /// Calculate total gas used by the batch
    pub fn calculate_gas_used(&mut self) {
        self.batch_gas_used = self.events.iter().map(|e| e.gas_used).sum();
    }

    /// Mark batch as completed
    pub fn mark_completed(&mut self) {
        self.batch_status = BatchStatus::Completed;
    }

    /// Mark batch as failed
    pub fn mark_failed(&mut self) {
        self.batch_status = BatchStatus::Failed;
        self.retry_count += 1;
    }
}

impl EventFilter {
    /// Create a new event filter
    pub fn new(env: &Env, filter_id: Bytes, subscriber: Address) -> Self {
        Self {
            filter_id,
            subscriber,
            event_types: Vec::new(env),
            emitters: Vec::new(env),
            topics: Vec::new(env),
            severity_range: (EventSeverity::Low, EventSeverity::Critical),
            time_range: (0, u64::MAX),
            data_filters: Map::new(env),
            is_active: true,
            created_at: env.ledger().timestamp(),
        }
    }

    /// Add event type filter
    pub fn add_event_type(&mut self, event_type: EventType) {
        self.event_types.push_back(event_type);
    }

    /// Add emitter filter
    pub fn add_emitter(&mut self, emitter: Address) {
        self.emitters.push_back(emitter);
    }

    /// Add topic filter
    pub fn add_topic(&mut self, topic: Symbol) {
        self.topics.push_back(topic);
    }

    /// Check if an event matches this filter
    pub fn matches(&self, event: &StructuredEvent) -> bool {
        // Check event type
        if !self.event_types.is_empty() && !self.event_types.contains(&event.event_type) {
            return false;
        }

        // Check emitter
        if !self.emitters.is_empty() && !self.emitters.contains(&event.emitter) {
            return false;
        }

        // Check severity range
        let severity_order = |s: &EventSeverity| match s {
            EventSeverity::Low => 0,
            EventSeverity::Medium => 1,
            EventSeverity::High => 2,
            EventSeverity::Critical => 3,
        };
        if severity_order(&event.severity) < severity_order(&self.severity_range.0) ||
           severity_order(&event.severity) > severity_order(&self.severity_range.1) {
            return false;
        }

        // Check time range
        if event.timestamp < self.time_range.0 || event.timestamp > self.time_range.1 {
            return false;
        }

        // Check topics
        if !self.topics.is_empty() {
            let has_matching_topic = self.topics.iter().any(|topic| {
                event.topics.contains(topic)
            });
            if !has_matching_topic {
                return false;
            }
        }

        // Check data filters
        for (key, value) in self.data_filters.iter() {
            if let Some(event_value) = event.data.get(key) {
                if event_value != value {
                    return false;
                }
            } else {
                return false;
            }
        }

        true
    }
}

impl Default for EventSystemConfig {
    fn default() -> Self {
        Self {
            max_batch_size: 100,
            max_events_per_block: 50,
            default_gas_limit: 500000,
            retention_period: 30 * 24 * 60 * 60, // 30 days
            max_subscriptions_per_address: 10,
            max_filters_per_subscription: 5,
            analytics_update_interval: 3600, // 1 hour
            replay_enabled: true,
        }
    }
}
