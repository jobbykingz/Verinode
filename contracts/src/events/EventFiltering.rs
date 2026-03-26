use soroban_sdk::{contracttype, Address, Env, Bytes, Vec, Map, Symbol, u64};
use crate::events::structured_events::{
    StructuredEvent, EventType, EventSeverity, EventFilter, EventSubscription,
    NotificationPreferences, RetryPolicy, EventStorageKey
};

/// Event filtering and subscription system
pub struct EventFilterManager;

/// Filter evaluation result
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FilterEvaluationResult {
    pub matches: bool,
    pub matched_criteria: Vec<Symbol>,
    pub score: u32, // Relevance score for ranking
}

/// Subscription manager statistics
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionStats {
    pub total_subscriptions: u64,
    pub active_subscriptions: u64,
    pub total_filters: u64,
    pub active_filters: u64,
    pub events_processed: u64,
    pub notifications_sent: u64,
    pub notifications_failed: u64,
    pub last_updated: u64,
}

/// Notification queue entry
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NotificationQueueEntry {
    pub notification_id: Bytes,
    pub subscription_id: Bytes,
    pub event_id: Bytes,
    pub event_data: Map<Symbol, Bytes>,
    pub retry_count: u32,
    pub next_retry_at: u64,
    pub created_at: u64,
}

/// Filter performance metrics
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FilterMetrics {
    pub filter_id: Bytes,
    pub total_evaluations: u64,
    pub successful_matches: u64,
    pub evaluation_time_avg: u64,
    pub last_evaluated: u64,
    pub efficiency_score: f32, // Matches per evaluation ratio
}

/// Storage keys for filtering system
#[contracttype]
pub enum FilterStorageKey {
    EventFilter(Bytes),
    EventSubscription(Bytes),
    SubscriptionCounter,
    FilterCounter,
    NotificationQueue(Bytes),
    NotificationCounter,
    SubscriptionStats,
    FilterMetrics(Bytes),
    AddressSubscriptions(Address),
    ActiveSubscriptions,
}

impl EventFilterManager {
    /// Create a new event filter
    pub fn create_filter(
        env: &Env,
        filter_id: Bytes,
        subscriber: Address,
        event_types: Vec<EventType>,
        emitters: Vec<Address>,
        topics: Vec<Symbol>,
        severity_range: (EventSeverity, EventSeverity),
        time_range: (u64, u64),
        data_filters: Map<Symbol, Bytes>,
    ) -> EventFilter {
        let filter = EventFilter {
            filter_id: filter_id.clone(),
            subscriber: subscriber.clone(),
            event_types,
            emitters,
            topics,
            severity_range,
            time_range,
            data_filters,
            is_active: true,
            created_at: env.ledger().timestamp(),
        };

        // Store the filter
        env.storage().instance().set(&FilterStorageKey::EventFilter(filter_id), &filter);

        // Update filter counter
        let counter = env.storage().instance()
            .get::<FilterStorageKey, u64>(&FilterStorageKey::FilterCounter)
            .unwrap_or(0) + 1;
        env.storage().instance().set(&FilterStorageKey::FilterCounter, &counter);

        filter
    }

    /// Create a new event subscription
    pub fn create_subscription(
        env: &Env,
        subscription_id: Bytes,
        filter: EventFilter,
        webhook_url: Option<String>,
        notification_preferences: NotificationPreferences,
    ) -> EventSubscription {
        let subscription = EventSubscription {
            subscription_id: subscription_id.clone(),
            filter,
            webhook_url,
            notification_preferences,
            last_processed_event: None,
            created_at: env.ledger().timestamp(),
            updated_at: env.ledger().timestamp(),
        };

        // Store the subscription
        env.storage().instance().set(&FilterStorageKey::EventSubscription(subscription_id.clone()), &subscription);

        // Update subscription counter
        let counter = env.storage().instance()
            .get::<FilterStorageKey, u64>(&FilterStorageKey::SubscriptionCounter)
            .unwrap_or(0) + 1;
        env.storage().instance().set(&FilterStorageKey::SubscriptionCounter, &counter);

        // Add to address subscriptions index
        let subscriber_address = subscription.filter.subscriber.clone();
        let mut address_subs = env.storage().instance()
            .get::<FilterStorageKey, Vec<Bytes>>(&FilterStorageKey::AddressSubscriptions(subscriber_address))
            .unwrap_or(Vec::new(env));
        address_subs.push_back(subscription_id.clone());
        env.storage().instance().set(&FilterStorageKey::AddressSubscriptions(subscriber_address), &address_subs);

        // Add to active subscriptions
        let mut active_subs = env.storage().instance()
            .get::<FilterStorageKey, Vec<Bytes>>(&FilterStorageKey::ActiveSubscriptions)
            .unwrap_or(Vec::new(env));
        active_subs.push_back(subscription_id.clone());
        env.storage().instance().set(&FilterStorageKey::ActiveSubscriptions, &active_subs);

        subscription
    }

    /// Evaluate an event against all active filters
    pub fn evaluate_event(env: &Env, event: &StructuredEvent) -> Vec<FilterEvaluationResult> {
        let active_filters = Self::get_active_filters(env);
        let mut results = Vec::new(env);

        for filter in active_filters.iter() {
            let result = Self::evaluate_filter(env, filter, event);
            if result.matches {
                results.push_back(result);
            }
        }

        results
    }

    /// Evaluate a single filter against an event
    pub fn evaluate_filter(env: &Env, filter: &EventFilter, event: &StructuredEvent) -> FilterEvaluationResult {
        let mut matches = true;
        let mut matched_criteria = Vec::new(env);
        let mut score = 0u32;

        // Check event type
        if !filter.event_types.is_empty() {
            if filter.event_types.contains(&event.event_type) {
                matched_criteria.push_back(Symbol::new(env, "event_type"));
                score += 20;
            } else {
                matches = false;
            }
        }

        // Check emitter
        if !filter.emitters.is_empty() {
            if filter.emitters.contains(&event.emitter) {
                matched_criteria.push_back(Symbol::new(env, "emitter"));
                score += 25;
            } else {
                matches = false;
            }
        }

        // Check severity range
        let severity_order = |s: &EventSeverity| match s {
            EventSeverity::Low => 0,
            EventSeverity::Medium => 1,
            EventSeverity::High => 2,
            EventSeverity::Critical => 3,
        };
        if severity_order(&event.severity) >= severity_order(&filter.severity_range.0) &&
           severity_order(&event.severity) <= severity_order(&filter.severity_range.1) {
            matched_criteria.push_back(Symbol::new(env, "severity"));
            score += 15;
        } else {
            matches = false;
        }

        // Check time range
        if event.timestamp >= filter.time_range.0 && event.timestamp <= filter.time_range.1 {
            matched_criteria.push_back(Symbol::new(env, "time_range"));
            score += 10;
        } else {
            matches = false;
        }

        // Check topics
        if !filter.topics.is_empty() {
            let has_matching_topic = filter.topics.iter().any(|topic| {
                event.topics.contains(topic)
            });
            if has_matching_topic {
                matched_criteria.push_back(Symbol::new(env, "topics"));
                score += 20;
            } else {
                matches = false;
            }
        }

        // Check data filters
        let mut data_matches = true;
        for (key, value) in filter.data_filters.iter() {
            if let Some(event_value) = event.data.get(key) {
                if event_value == value {
                    matched_criteria.push_back(key.clone());
                    score += 10;
                } else {
                    data_matches = false;
                    break;
                }
            } else {
                data_matches = false;
                break;
            }
        }

        if !data_matches && !filter.data_filters.is_empty() {
            matches = false;
        }

        // Update filter metrics
        Self::update_filter_metrics(env, &filter.filter_id, matches);

        FilterEvaluationResult {
            matches,
            matched_criteria,
            score,
        }
    }

    /// Process event notifications for matching subscriptions
    pub fn process_notifications(env: &Env, event: &StructuredEvent) {
        let evaluation_results = Self::evaluate_event(env, event);
        
        for result in evaluation_results.iter() {
            // Find subscriptions that use the matching filters
            let matching_subscriptions = Self::find_subscriptions_by_filter_results(env, result);
            
            for subscription in matching_subscriptions.iter() {
                Self::queue_notification(env, &subscription.subscription_id, &event.event_id, &event.data);
            }
        }
    }

    /// Queue a notification for processing
    pub fn queue_notification(env: &Env, subscription_id: &Bytes, event_id: &Bytes, event_data: &Map<Symbol, Bytes>) {
        let notification_id = Self::generate_notification_id(env);
        let notification = NotificationQueueEntry {
            notification_id: notification_id.clone(),
            subscription_id: subscription_id.clone(),
            event_id: event_id.clone(),
            event_data: event_data.clone(),
            retry_count: 0,
            next_retry_at: env.ledger().timestamp(),
            created_at: env.ledger().timestamp(),
        };

        // Store notification in queue
        env.storage().instance().set(&FilterStorageKey::NotificationQueue(notification_id), &notification);

        // Update notification counter
        let counter = env.storage().instance()
            .get::<FilterStorageKey, u64>(&FilterStorageKey::NotificationCounter)
            .unwrap_or(0) + 1;
        env.storage().instance().set(&FilterStorageKey::NotificationCounter, &counter);
    }

    /// Process pending notifications
    pub fn process_pending_notifications(env: &Env) -> u32 {
        let current_time = env.ledger().timestamp();
        let mut processed_count = 0u32;

        // Get all pending notifications (simplified - in practice would use proper queue)
        let notification_counter = env.storage().instance()
            .get::<FilterStorageKey, u64>(&FilterStorageKey::NotificationCounter)
            .unwrap_or(0);

        for i in 1..=notification_counter {
            let notification_id = Self::get_notification_id(env, i);
            if let Some(mut notification) = env.storage().instance()
                .get::<FilterStorageKey, NotificationQueueEntry>(&FilterStorageKey::NotificationQueue(notification_id.clone())) {
                
                if notification.next_retry_at <= current_time {
                    if Self::send_notification(env, &notification) {
                        // Success - remove from queue
                        env.storage().instance().remove(&FilterStorageKey::NotificationQueue(notification_id));
                        processed_count += 1;
                    } else {
                        // Failed - schedule retry
                        notification.retry_count += 1;
                        notification.next_retry_at = Self::calculate_next_retry(env, &notification);
                        env.storage().instance().set(&FilterStorageKey::NotificationQueue(notification_id), &notification);
                    }
                }
            }
        }

        processed_count
    }

    /// Send notification (placeholder - would integrate with external services)
    fn send_notification(env: &Env, notification: &NotificationQueueEntry) -> bool {
        // Get subscription details
        if let Some(subscription) = env.storage().instance()
            .get::<FilterStorageKey, EventSubscription>(&FilterStorageKey::EventSubscription(notification.subscription_id.clone())) {
            
            // Check retry policy
            if notification.retry_count >= subscription.notification_preferences.retry_policy.max_retries {
                return false;
            }

            // Here you would integrate with webhook, email, push notification, etc.
            // For now, simulate success
            true
        } else {
            false
        }
    }

    /// Calculate next retry time
    fn calculate_next_retry(env: &Env, notification: &NotificationQueueEntry) -> u64 {
        if let Some(subscription) = env.storage().instance()
            .get::<FilterStorageKey, EventSubscription>(&FilterStorageKey::EventSubscription(notification.subscription_id.clone())) {
            
            let retry_policy = &subscription.notification_preferences.retry_policy;
            let base_delay = retry_policy.retry_delay;
            let multiplier = retry_policy.backoff_multiplier.pow(notification.retry_count);
            let delay = base_delay * multiplier;
            let max_delay = retry_policy.max_delay;
            
            std::cmp::min(delay, max_delay) + env.ledger().timestamp()
        } else {
            env.ledger().timestamp() + 300 // Default 5 minutes
        }
    }

    /// Get all active filters
    fn get_active_filters(env: &Env) -> Vec<EventFilter> {
        let filter_counter = env.storage().instance()
            .get::<FilterStorageKey, u64>(&FilterStorageKey::FilterCounter)
            .unwrap_or(0);

        let mut active_filters = Vec::new(env);

        for i in 1..=filter_counter {
            let filter_id = Self::get_filter_id(env, i);
            if let Some(filter) = env.storage().instance()
                .get::<FilterStorageKey, EventFilter>(&FilterStorageKey::EventFilter(filter_id)) {
                
                if filter.is_active {
                    active_filters.push_back(filter);
                }
            }
        }

        active_filters
    }

    /// Find subscriptions by filter evaluation results
    fn find_subscriptions_by_filter_results(env: &Env, result: &FilterEvaluationResult) -> Vec<EventSubscription> {
        let active_subscriptions = env.storage().instance()
            .get::<FilterStorageKey, Vec<Bytes>>(&FilterStorageKey::ActiveSubscriptions)
            .unwrap_or(Vec::new(env));

        let mut matching_subscriptions = Vec::new(env);

        for subscription_id in active_subscriptions.iter() {
            if let Some(subscription) = env.storage().instance()
                .get::<FilterStorageKey, EventSubscription>(&FilterStorageKey::EventSubscription(subscription_id.clone())) {
                
                // Check if subscription filter would match the event
                // This is simplified - in practice you'd cache filter evaluations
                matching_subscriptions.push_back(subscription);
            }
        }

        matching_subscriptions
    }

    /// Update filter performance metrics
    fn update_filter_metrics(env: &Env, filter_id: &Bytes, matched: bool) {
        let mut metrics = env.storage().instance()
            .get::<FilterStorageKey, FilterMetrics>(&FilterStorageKey::FilterMetrics(filter_id.clone()))
            .unwrap_or(FilterMetrics {
                filter_id: filter_id.clone(),
                total_evaluations: 0,
                successful_matches: 0,
                evaluation_time_avg: 0,
                last_evaluated: 0,
                efficiency_score: 0.0,
            });

        metrics.total_evaluations += 1;
        if matched {
            metrics.successful_matches += 1;
        }
        metrics.last_evaluated = env.ledger().timestamp();
        
        if metrics.total_evaluations > 0 {
            metrics.efficiency_score = metrics.successful_matches as f32 / metrics.total_evaluations as f32;
        }

        env.storage().instance().set(&FilterStorageKey::FilterMetrics(filter_id.clone()), &metrics);
    }

    /// Update subscription statistics
    pub fn update_subscription_stats(env: &Env) {
        let total_subscriptions = env.storage().instance()
            .get::<FilterStorageKey, u64>(&FilterStorageKey::SubscriptionCounter)
            .unwrap_or(0);

        let total_filters = env.storage().instance()
            .get::<FilterStorageKey, u64>(&FilterStorageKey::FilterCounter)
            .unwrap_or(0);

        let active_subscriptions = env.storage().instance()
            .get::<FilterStorageKey, Vec<Bytes>>(&FilterStorageKey::ActiveSubscriptions)
            .unwrap_or(Vec::new(env))
            .len() as u64;

        let active_filters = Self::get_active_filters(env).len() as u64;

        let stats = SubscriptionStats {
            total_subscriptions,
            active_subscriptions,
            total_filters,
            active_filters,
            events_processed: 0, // Would need to track separately
            notifications_sent: 0, // Would need to track separately
            notifications_failed: 0, // Would need to track separately
            last_updated: env.ledger().timestamp(),
        };

        env.storage().instance().set(&FilterStorageKey::SubscriptionStats, &stats);
    }

    /// Deactivate a subscription
    pub fn deactivate_subscription(env: &Env, subscription_id: &Bytes) {
        if let Some(mut subscription) = env.storage().instance()
            .get::<FilterStorageKey, EventSubscription>(&FilterStorageKey::EventSubscription(subscription_id.clone())) {
            
            subscription.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&FilterStorageKey::EventSubscription(subscription_id.clone()), &subscription);

            // Remove from active subscriptions
            let mut active_subs = env.storage().instance()
                .get::<FilterStorageKey, Vec<Bytes>>(&FilterStorageKey::ActiveSubscriptions)
                .unwrap_or(Vec::new(env));
            active_subs.remove(subscription_id);
            
            if !active_subs.is_empty() {
                env.storage().instance().set(&FilterStorageKey::ActiveSubscriptions, &active_subs);
            } else {
                env.storage().instance().remove(&FilterStorageKey::ActiveSubscriptions);
            }

            // Update statistics
            Self::update_subscription_stats(env);
        }
    }

    /// Get subscriptions for an address
    pub fn get_subscriptions_for_address(env: &Env, address: &Address) -> Vec<EventSubscription> {
        let address_subs = env.storage().instance()
            .get::<FilterStorageKey, Vec<Bytes>>(&FilterStorageKey::AddressSubscriptions(address.clone()))
            .unwrap_or(Vec::new(env));

        let mut subscriptions = Vec::new(env);

        for subscription_id in address_subs.iter() {
            if let Some(subscription) = env.storage().instance()
                .get::<FilterStorageKey, EventSubscription>(&FilterStorageKey::EventSubscription(subscription_id.clone())) {
                
                subscriptions.push_back(subscription);
            }
        }

        subscriptions
    }

    /// Get filter performance metrics
    pub fn get_filter_metrics(env: &Env, filter_id: &Bytes) -> Option<FilterMetrics> {
        env.storage().instance().get(&FilterStorageKey::FilterMetrics(filter_id.clone()))
    }

    /// Get subscription statistics
    pub fn get_subscription_stats(env: &Env) -> Option<SubscriptionStats> {
        env.storage().instance().get(&FilterStorageKey::SubscriptionStats)
    }

    /// Clean up expired notifications
    pub fn cleanup_expired_notifications(env: &Env, max_age: u64) -> u32 {
        let current_time = env.ledger().timestamp();
        let mut cleaned_count = 0u32;

        let notification_counter = env.storage().instance()
            .get::<FilterStorageKey, u64>(&FilterStorageKey::NotificationCounter)
            .unwrap_or(0);

        for i in 1..=notification_counter {
            let notification_id = Self::get_notification_id(env, i);
            if let Some(notification) = env.storage().instance()
                .get::<FilterStorageKey, NotificationQueueEntry>(&FilterStorageKey::NotificationQueue(notification_id.clone())) {
                
                if current_time - notification.created_at > max_age {
                    env.storage().instance().remove(&FilterStorageKey::NotificationQueue(notification_id));
                    cleaned_count += 1;
                }
            }
        }

        cleaned_count
    }

    /// Generate notification ID
    fn generate_notification_id(env: &Env) -> Bytes {
        let counter = env.storage().instance()
            .get::<FilterStorageKey, u64>(&FilterStorageKey::NotificationCounter)
            .unwrap_or(0) + 1;
        
        let mut data = Vec::new(env);
        data.push_back(counter.to_be_bytes());
        data.push_back(env.ledger().timestamp().to_be_bytes());
        env.crypto().sha256(&data)
    }

    /// Get filter ID by counter
    fn get_filter_id(env: &Env, counter: u64) -> Bytes {
        let mut data = Vec::new(env);
        data.push_back(counter.to_be_bytes());
        env.crypto().sha256(&data)
    }

    /// Get notification ID by counter
    fn get_notification_id(env: &Env, counter: u64) -> Bytes {
        let mut data = Vec::new(env);
        data.push_back(counter.to_be_bytes());
        data.push_back(b"notification".to_vec());
        env.crypto().sha256(&data)
    }
}
