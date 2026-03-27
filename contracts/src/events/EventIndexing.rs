use soroban_sdk::{contracttype, Address, Env, Bytes, Vec, Map, Symbol, u64};
use crate::events::structured_events::{
    StructuredEvent, EventType, EventSeverity, EventStorageKey, EventAnalytics
};

/// Event index entry for efficient querying
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventIndexEntry {
    pub event_id: Bytes,
    pub event_type: EventType,
    pub emitter: Address,
    pub timestamp: u64,
    pub block_number: u64,
    pub severity: EventSeverity,
    pub topics_hash: Bytes,
}

/// Time-based index for range queries
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TimeIndexEntry {
    pub timestamp: u64,
    pub event_ids: Vec<Bytes>,
}

/// Type-based index for event type queries
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TypeIndexEntry {
    pub event_type: EventType,
    pub event_ids: Vec<Bytes>,
}

/// Emitter-based index for address queries
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmitterIndexEntry {
    pub emitter: Address,
    pub event_ids: Vec<Bytes>,
}

/// Topic-based index for topic queries
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TopicIndexEntry {
    pub topic: Symbol,
    pub event_ids: Vec<Bytes>,
}

/// Severity-based index for severity queries
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SeverityIndexEntry {
    pub severity: EventSeverity,
    pub event_ids: Vec<Bytes>,
}

/// Composite index for complex queries
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompositeIndexEntry {
    pub composite_key: Bytes,
    pub event_ids: Vec<Bytes>,
}

/// Index statistics for monitoring
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IndexStats {
    pub total_events: u64,
    pub indexed_events: u64,
    pub index_size: u64,
    pub last_updated: u64,
    pub indexing_time_avg: u64,
}

/// Query parameters for event searches
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventQuery {
    pub event_types: Vec<EventType>,
    pub emitters: Vec<Address>,
    pub topics: Vec<Symbol>,
    pub severities: Vec<EventSeverity>,
    pub time_range: (u64, u64),
    pub block_range: (u64, u64),
    pub limit: u32,
    pub offset: u32,
    pub order_by: QueryOrder,
}

/// Query ordering options
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum QueryOrder {
    TimestampAsc,
    TimestampDesc,
    BlockNumberAsc,
    BlockNumberDesc,
    SeverityAsc,
    SeverityDesc,
}

/// Query result with pagination
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueryResult {
    pub events: Vec<StructuredEvent>,
    pub total_count: u64,
    pub has_more: bool,
    pub next_offset: u32,
}

/// Index storage keys
#[contracttype]
pub enum IndexStorageKey {
    TimeIndex(u64),
    TypeIndex(EventType),
    EmitterIndex(Address),
    TopicIndex(Symbol),
    SeverityIndex(EventSeverity),
    CompositeIndex(Bytes),
    IndexStats,
    EventToIndex(Bytes),
}

/// Event indexing system
pub struct EventIndexer;

impl EventIndexer {
    /// Index a new event
    pub fn index_event(env: &Env, event: &StructuredEvent) {
        // Create index entry
        let index_entry = EventIndexEntry {
            event_id: event.event_id.clone(),
            event_type: event.event_type.clone(),
            emitter: event.emitter.clone(),
            timestamp: event.timestamp,
            block_number: event.block_number,
            severity: event.severity.clone(),
            topics_hash: Self::calculate_topics_hash(env, &event.topics),
        };

        // Update time index
        Self::update_time_index(env, &index_entry);

        // Update type index
        Self::update_type_index(env, &index_entry);

        // Update emitter index
        Self::update_emitter_index(env, &index_entry);

        // Update topic indexes
        Self::update_topic_indexes(env, &index_entry, &event.topics);

        // Update severity index
        Self::update_severity_index(env, &index_entry);

        // Update composite indexes
        Self::update_composite_indexes(env, &index_entry);

        // Store event to index mapping
        env.storage().instance().set(
            &IndexStorageKey::EventToIndex(event.event_id.clone()),
            &index_entry
        );

        // Update index statistics
        Self::update_index_stats(env);
    }

    /// Remove event from indexes
    pub fn remove_from_index(env: &Env, event_id: &Bytes) {
        if let Some(index_entry) = env.storage().instance()
            .get::<IndexStorageKey, EventIndexEntry>(&IndexStorageKey::EventToIndex(event_id.clone())) {
            
            // Remove from time index
            Self::remove_from_time_index(env, &index_entry);

            // Remove from type index
            Self::remove_from_type_index(env, &index_entry);

            // Remove from emitter index
            Self::remove_from_emitter_index(env, &index_entry);

            // Remove from topic indexes
            Self::remove_from_topic_indexes(env, &index_entry);

            // Remove from severity index
            Self::remove_from_severity_index(env, &index_entry);

            // Remove from composite indexes
            Self::remove_from_composite_indexes(env, &index_entry);

            // Remove event to index mapping
            env.storage().instance().remove(&IndexStorageKey::EventToIndex(event_id.clone()));

            // Update index statistics
            Self::update_index_stats(env);
        }
    }

    /// Query events based on parameters
    pub fn query_events(env: &Env, query: &EventQuery) -> QueryResult {
        let mut candidate_events: Vec<Bytes> = Vec::new(env);

        // Start with the most selective index
        if !query.emitters.is_empty() {
            // Use emitter index
            for emitter in query.emitters.iter() {
                if let Some(emitter_index) = env.storage().instance()
                    .get::<IndexStorageKey, EmitterIndexEntry>(&IndexStorageKey::EmitterIndex(emitter.clone())) {
                    candidate_events.extend(emitter_index.event_ids.iter());
                }
            }
        } else if !query.event_types.is_empty() {
            // Use type index
            for event_type in query.event_types.iter() {
                if let Some(type_index) = env.storage().instance()
                    .get::<IndexStorageKey, TypeIndexEntry>(&IndexStorageKey::TypeIndex(event_type.clone())) {
                    candidate_events.extend(type_index.event_ids.iter());
                }
            }
        } else if !query.topics.is_empty() {
            // Use topic index
            for topic in query.topics.iter() {
                if let Some(topic_index) = env.storage().instance()
                    .get::<IndexStorageKey, TopicIndexEntry>(&IndexStorageKey::TopicIndex(topic.clone())) {
                    candidate_events.extend(topic_index.event_ids.iter());
                }
            }
        } else {
            // Use time index as fallback
            Self::get_events_by_time_range(env, query.time_range.0, query.time_range.1, &mut candidate_events);
        }

        // Apply additional filters
        let filtered_events = Self::apply_filters(env, candidate_events, query);

        // Sort results
        let sorted_events = Self::sort_events(env, filtered_events, &query.order_by);

        // Apply pagination
        let total_count = sorted_events.len();
        let limit = query.limit as usize;
        let offset = query.offset as usize;

        let paginated_events = if offset < sorted_events.len() {
            let end = std::cmp::min(offset + limit, sorted_events.len());
            sorted_events.slice(offset as u32, (end - offset) as u32)
        } else {
            Vec::new(env)
        };

        let has_more = offset + limit < total_count;
        let next_offset = if has_more { query.offset + query.limit } else { query.offset };

        QueryResult {
            events: paginated_events,
            total_count: total_count as u64,
            has_more,
            next_offset,
        }
    }

    /// Get events by time range
    fn get_events_by_time_range(env: &Env, start_time: u64, end_time: u64, events: &mut Vec<Bytes>) {
        let mut current_time = start_time;
        
        while current_time <= end_time {
            if let Some(time_index) = env.storage().instance()
                .get::<IndexStorageKey, TimeIndexEntry>(&IndexStorageKey::TimeIndex(current_time)) {
                events.extend(time_index.event_ids.iter());
            }
            current_time += 3600; // Move to next hour
        }
    }

    /// Apply additional filters to candidate events
    fn apply_filters(env: &Env, candidate_events: Vec<Bytes>, query: &EventQuery) -> Vec<Bytes> {
        let mut filtered_events = Vec::new(env);

        for event_id in candidate_events.iter() {
            if let Some(event) = env.storage().instance()
                .get::<EventStorageKey, StructuredEvent>(&EventStorageKey::Event(event_id.clone())) {
                
                let mut matches = true;

                // Check event type filter
                if !query.event_types.is_empty() && !query.event_types.contains(&event.event_type) {
                    matches = false;
                }

                // Check emitter filter
                if !query.emitters.is_empty() && !query.emitters.contains(&event.emitter) {
                    matches = false;
                }

                // Check severity filter
                if !query.severities.is_empty() && !query.severities.contains(&event.severity) {
                    matches = false;
                }

                // Check time range filter
                if event.timestamp < query.time_range.0 || event.timestamp > query.time_range.1 {
                    matches = false;
                }

                // Check block range filter
                if event.block_number < query.block_range.0 || event.block_number > query.block_range.1 {
                    matches = false;
                }

                // Check topics filter
                if !query.topics.is_empty() {
                    let has_matching_topic = query.topics.iter().any(|topic| {
                        event.topics.contains(topic)
                    });
                    if !has_matching_topic {
                        matches = false;
                    }
                }

                if matches {
                    filtered_events.push_back(event_id.clone());
                }
            }
        }

        filtered_events
    }

    /// Sort events based on order criteria
    fn sort_events(env: &Env, event_ids: Vec<Bytes>, order: &QueryOrder) -> Vec<Bytes> {
        let mut events_with_sort_key: Vec<(Bytes, u64)> = Vec::new(env);

        for event_id in event_ids.iter() {
            if let Some(event) = env.storage().instance()
                .get::<EventStorageKey, StructuredEvent>(&EventStorageKey::Event(event_id.clone())) {
                
                let sort_key = match order {
                    QueryOrder::TimestampAsc | QueryOrder::TimestampDesc => event.timestamp,
                    QueryOrder::BlockNumberAsc | QueryOrder::BlockNumberDesc => event.block_number,
                    QueryOrder::SeverityAsc | QueryOrder::SeverityDesc => {
                        match event.severity {
                            EventSeverity::Low => 0,
                            EventSeverity::Medium => 1,
                            EventSeverity::High => 2,
                            EventSeverity::Critical => 3,
                        }
                    }
                };

                events_with_sort_key.push_back((event_id.clone(), sort_key));
            }
        }

        // Sort based on order
        events_with_sort_key.sort_by(|a, b| {
            match order {
                QueryOrder::TimestampAsc | QueryOrder::BlockNumberAsc | QueryOrder::SeverityAsc => {
                    a.1.cmp(&b.1)
                }
                QueryOrder::TimestampDesc | QueryOrder::BlockNumberDesc | QueryOrder::SeverityDesc => {
                    b.1.cmp(&a.1)
                }
            }
        });

        // Extract sorted event IDs
        let mut sorted_events = Vec::new(env);
        for (event_id, _) in events_with_sort_key.iter() {
            sorted_events.push_back(event_id.clone());
        }

        sorted_events
    }

    /// Update time index
    fn update_time_index(env: &Env, entry: &EventIndexEntry) {
        let time_key = Self::get_time_key(entry.timestamp);
        let mut time_index = env.storage().instance()
            .get::<IndexStorageKey, TimeIndexEntry>(&IndexStorageKey::TimeIndex(time_key))
            .unwrap_or(TimeIndexEntry {
                timestamp: time_key,
                event_ids: Vec::new(env),
            });

        time_index.event_ids.push_back(entry.event_id.clone());
        env.storage().instance().set(&IndexStorageKey::TimeIndex(time_key), &time_index);
    }

    /// Update type index
    fn update_type_index(env: &Env, entry: &EventIndexEntry) {
        let mut type_index = env.storage().instance()
            .get::<IndexStorageKey, TypeIndexEntry>(&IndexStorageKey::TypeIndex(entry.event_type.clone()))
            .unwrap_or(TypeIndexEntry {
                event_type: entry.event_type.clone(),
                event_ids: Vec::new(env),
            });

        type_index.event_ids.push_back(entry.event_id.clone());
        env.storage().instance().set(&IndexStorageKey::TypeIndex(entry.event_type.clone()), &type_index);
    }

    /// Update emitter index
    fn update_emitter_index(env: &Env, entry: &EventIndexEntry) {
        let mut emitter_index = env.storage().instance()
            .get::<IndexStorageKey, EmitterIndexEntry>(&IndexStorageKey::EmitterIndex(entry.emitter.clone()))
            .unwrap_or(EmitterIndexEntry {
                emitter: entry.emitter.clone(),
                event_ids: Vec::new(env),
            });

        emitter_index.event_ids.push_back(entry.event_id.clone());
        env.storage().instance().set(&IndexStorageKey::EmitterIndex(entry.emitter.clone()), &emitter_index);
    }

    /// Update topic indexes
    fn update_topic_indexes(env: &Env, entry: &EventIndexEntry, topics: &Vec<Symbol>) {
        for topic in topics.iter() {
            let mut topic_index = env.storage().instance()
                .get::<IndexStorageKey, TopicIndexEntry>(&IndexStorageKey::TopicIndex(topic.clone()))
                .unwrap_or(TopicIndexEntry {
                    topic: topic.clone(),
                    event_ids: Vec::new(env),
                });

            topic_index.event_ids.push_back(entry.event_id.clone());
            env.storage().instance().set(&IndexStorageKey::TopicIndex(topic.clone()), &topic_index);
        }
    }

    /// Update severity index
    fn update_severity_index(env: &Env, entry: &EventIndexEntry) {
        let mut severity_index = env.storage().instance()
            .get::<IndexStorageKey, SeverityIndexEntry>(&IndexStorageKey::SeverityIndex(entry.severity.clone()))
            .unwrap_or(SeverityIndexEntry {
                severity: entry.severity.clone(),
                event_ids: Vec::new(env),
            });

        severity_index.event_ids.push_back(entry.event_id.clone());
        env.storage().instance().set(&IndexStorageKey::SeverityIndex(entry.severity.clone()), &severity_index);
    }

    /// Update composite indexes
    fn update_composite_indexes(env: &Env, entry: &EventIndexEntry) {
        // Type + Emitter composite index
        let type_emitter_key = Self::calculate_composite_key_type_emitter(env, entry);
        Self::add_to_composite_index(env, &type_emitter_key, &entry.event_id);

        // Type + Time composite index
        let type_time_key = Self::calculate_composite_key_type_time(env, entry);
        Self::add_to_composite_index(env, &type_time_key, &entry.event_id);

        // Emitter + Time composite index
        let emitter_time_key = Self::calculate_composite_key_emitter_time(env, entry);
        Self::add_to_composite_index(env, &emitter_time_key, &entry.event_id);
    }

    /// Add event to composite index
    fn add_to_composite_index(env: &Env, composite_key: &Bytes, event_id: &Bytes) {
        let mut composite_index = env.storage().instance()
            .get::<IndexStorageKey, CompositeIndexEntry>(&IndexStorageKey::CompositeIndex(composite_key.clone()))
            .unwrap_or(CompositeIndexEntry {
                composite_key: composite_key.clone(),
                event_ids: Vec::new(env),
            });

        composite_index.event_ids.push_back(event_id.clone());
        env.storage().instance().set(&IndexStorageKey::CompositeIndex(composite_key.clone()), &composite_index);
    }

    /// Remove from time index
    fn remove_from_time_index(env: &Env, entry: &EventIndexEntry) {
        let time_key = Self::get_time_key(entry.timestamp);
        if let Some(mut time_index) = env.storage().instance()
            .get::<IndexStorageKey, TimeIndexEntry>(&IndexStorageKey::TimeIndex(time_key)) {
            
            time_index.event_ids.remove(&entry.event_id);
            if !time_index.event_ids.is_empty() {
                env.storage().instance().set(&IndexStorageKey::TimeIndex(time_key), &time_index);
            } else {
                env.storage().instance().remove(&IndexStorageKey::TimeIndex(time_key));
            }
        }
    }

    /// Remove from type index
    fn remove_from_type_index(env: &Env, entry: &EventIndexEntry) {
        if let Some(mut type_index) = env.storage().instance()
            .get::<IndexStorageKey, TypeIndexEntry>(&IndexStorageKey::TypeIndex(entry.event_type.clone())) {
            
            type_index.event_ids.remove(&entry.event_id);
            if !type_index.event_ids.is_empty() {
                env.storage().instance().set(&IndexStorageKey::TypeIndex(entry.event_type.clone()), &type_index);
            } else {
                env.storage().instance().remove(&IndexStorageKey::TypeIndex(entry.event_type.clone()));
            }
        }
    }

    /// Remove from emitter index
    fn remove_from_emitter_index(env: &Env, entry: &EventIndexEntry) {
        if let Some(mut emitter_index) = env.storage().instance()
            .get::<IndexStorageKey, EmitterIndexEntry>(&IndexStorageKey::EmitterIndex(entry.emitter.clone())) {
            
            emitter_index.event_ids.remove(&entry.event_id);
            if !emitter_index.event_ids.is_empty() {
                env.storage().instance().set(&IndexStorageKey::EmitterIndex(entry.emitter.clone()), &emitter_index);
            } else {
                env.storage().instance().remove(&IndexStorageKey::EmitterIndex(entry.emitter.clone()));
            }
        }
    }

    /// Remove from topic indexes
    fn remove_from_topic_indexes(env: &Env, entry: &EventIndexEntry, topics: &Vec<Symbol>) {
        for topic in topics.iter() {
            if let Some(mut topic_index) = env.storage().instance()
                .get::<IndexStorageKey, TopicIndexEntry>(&IndexStorageKey::TopicIndex(topic.clone())) {
                
                topic_index.event_ids.remove(&entry.event_id);
                if !topic_index.event_ids.is_empty() {
                    env.storage().instance().set(&IndexStorageKey::TopicIndex(topic.clone()), &topic_index);
                } else {
                    env.storage().instance().remove(&IndexStorageKey::TopicIndex(topic.clone()));
                }
            }
        }
    }

    /// Remove from severity index
    fn remove_from_severity_index(env: &Env, entry: &EventIndexEntry) {
        if let Some(mut severity_index) = env.storage().instance()
            .get::<IndexStorageKey, SeverityIndexEntry>(&IndexStorageKey::SeverityIndex(entry.severity.clone())) {
            
            severity_index.event_ids.remove(&entry.event_id);
            if !severity_index.event_ids.is_empty() {
                env.storage().instance().set(&IndexStorageKey::SeverityIndex(entry.severity.clone()), &severity_index);
            } else {
                env.storage().instance().remove(&IndexStorageKey::SeverityIndex(entry.severity.clone()));
            }
        }
    }

    /// Remove from composite indexes
    fn remove_from_composite_indexes(env: &Env, entry: &EventIndexEntry) {
        // Type + Emitter composite index
        let type_emitter_key = Self::calculate_composite_key_type_emitter(env, entry);
        Self::remove_from_composite_index(env, &type_emitter_key, &entry.event_id);

        // Type + Time composite index
        let type_time_key = Self::calculate_composite_key_type_time(env, entry);
        Self::remove_from_composite_index(env, &type_time_key, &entry.event_id);

        // Emitter + Time composite index
        let emitter_time_key = Self::calculate_composite_key_emitter_time(env, entry);
        Self::remove_from_composite_index(env, &emitter_time_key, &entry.event_id);
    }

    /// Remove from composite index
    fn remove_from_composite_index(env: &Env, composite_key: &Bytes, event_id: &Bytes) {
        if let Some(mut composite_index) = env.storage().instance()
            .get::<IndexStorageKey, CompositeIndexEntry>(&IndexStorageKey::CompositeIndex(composite_key.clone())) {
            
            composite_index.event_ids.remove(event_id);
            if !composite_index.event_ids.is_empty() {
                env.storage().instance().set(&IndexStorageKey::CompositeIndex(composite_key.clone()), &composite_index);
            } else {
                env.storage().instance().remove(&IndexStorageKey::CompositeIndex(composite_key.clone()));
            }
        }
    }

    /// Update index statistics
    fn update_index_stats(env: &Env) {
        let total_events = env.storage().instance()
            .get::<EventStorageKey, u64>(&EventStorageKey::EventCounter)
            .unwrap_or(0);

        let stats = IndexStats {
            total_events,
            indexed_events: total_events, // Assuming all events are indexed
            index_size: Self::calculate_index_size(env),
            last_updated: env.ledger().timestamp(),
            indexing_time_avg: 0, // Would need to track actual indexing times
        };

        env.storage().instance().set(&IndexStorageKey::IndexStats, &stats);
    }

    /// Calculate total index size
    fn calculate_index_size(env: &Env) -> u64 {
        // This is a simplified calculation
        // In practice, you'd want to measure actual storage usage
        let mut size = 0u64;

        // Count time indexes
        let mut time_count = 0u64;
        let mut current_time = 0u64;
        while current_time <= env.ledger().timestamp() {
            if env.storage().instance().has(&IndexStorageKey::TimeIndex(current_time)) {
                time_count += 1;
            }
            current_time += 3600;
        }
        size += time_count;

        // Count type indexes
        let event_types = vec![
            EventType::ProofIssued, EventType::ProofVerified, EventType::ProofUpdated,
            EventType::BatchOperation, EventType::SystemEvent, EventType::CrossChainEvent,
            EventType::GovernanceEvent, EventType::TreasuryEvent
        ];
        for event_type in event_types.iter() {
            if env.storage().instance().has(&IndexStorageKey::TypeIndex(event_type.clone())) {
                size += 1;
            }
        }

        size
    }

    /// Get time key for time-based indexing
    fn get_time_key(timestamp: u64) -> u64 {
        // Round down to the nearest hour for time-based indexing
        (timestamp / 3600) * 3600
    }

    /// Calculate topics hash for indexing
    fn calculate_topics_hash(env: &Env, topics: &Vec<Symbol>) -> Bytes {
        let mut topics_data = Vec::new(env);
        for topic in topics.iter() {
            topics_data.push_back(topic.clone().into());
        }
        env.crypto().sha256(&topics_data)
    }

    /// Calculate composite key for type + emitter
    fn calculate_composite_key_type_emitter(env: &Env, entry: &EventIndexEntry) -> Bytes {
        let mut key_data = Vec::new(env);
        key_data.push_back(entry.event_type.clone().into());
        key_data.push_back(entry.emitter.clone());
        env.crypto().sha256(&key_data)
    }

    /// Calculate composite key for type + time
    fn calculate_composite_key_type_time(env: &Env, entry: &EventIndexEntry) -> Bytes {
        let mut key_data = Vec::new(env);
        key_data.push_back(entry.event_type.clone().into());
        key_data.push_back(Self::get_time_key(entry.timestamp).to_be_bytes());
        env.crypto().sha256(&key_data)
    }

    /// Calculate composite key for emitter + time
    fn calculate_composite_key_emitter_time(env: &Env, entry: &EventIndexEntry) -> Bytes {
        let mut key_data = Vec::new(env);
        key_data.push_back(entry.emitter.clone());
        key_data.push_back(Self::get_time_key(entry.timestamp).to_be_bytes());
        env.crypto().sha256(&key_data)
    }

    /// Get index statistics
    pub fn get_index_stats(env: &Env) -> Option<IndexStats> {
        env.storage().instance().get(&IndexStorageKey::IndexStats)
    }

    /// Rebuild all indexes (maintenance operation)
    pub fn rebuild_indexes(env: &Env) {
        // Clear existing indexes
        Self::clear_all_indexes(env);

        // Re-index all events
        let total_events = env.storage().instance()
            .get::<EventStorageKey, u64>(&EventStorageKey::EventCounter)
            .unwrap_or(0);

        for i in 1..=total_events {
            if let Some(event) = env.storage().instance()
                .get::<EventStorageKey, StructuredEvent>(&EventStorageKey::Event(Self::get_event_id(env, i))) {
                Self::index_event(env, &event);
            }
        }
    }

    /// Clear all indexes
    fn clear_all_indexes(env: &Env) {
        // This would clear all index storage
        // Implementation depends on storage backend capabilities
    }

    /// Get event ID by counter
    fn get_event_id(env: &Env, counter: u64) -> Bytes {
        // This would need to be implemented based on how event IDs are generated
        // For now, return a placeholder
        Bytes::from_slice(env, &counter.to_be_bytes())
    }
}
