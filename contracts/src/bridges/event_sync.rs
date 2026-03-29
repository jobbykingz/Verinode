#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChainEvent {
    pub event_id: u64,
    pub chain_id: u32,
    pub contract_address: Address,
    pub event_signature: Bytes,
    pub event_data: Bytes,
    pub block_number: u64,
    pub transaction_hash: Bytes,
    pub log_index: u32,
    pub timestamp: u64,
    pub synced: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SyncStatus {
    pub chain_id: u32,
    pub last_synced_block: u64,
    pub last_sync_timestamp: u64,
    pub sync_errors: u32,
    pub total_events: u64,
    pub pending_events: u32,
}

#[contracttype]
pub enum EventSyncDataKey {
    ChainEvent(u64),
    SyncStatus(u32),
    EventCount,
    PendingEvents,
    FailedEvents,
}

#[contract]
pub struct EventSyncContract;

#[contractimpl]
impl EventSyncContract {
    /// Initialize the event sync contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&EventSyncDataKey::EventCount) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&EventSyncDataKey::EventCount, &0u64);
        env.storage().instance().set(&EventSyncDataKey::PendingEvents, &Vec::<u64>::new(&env));
        env.storage().instance().set(&EventSyncDataKey::FailedEvents, &Vec::<u64>::new(&env));
    }

    /// Record a new cross-chain event
    pub fn record_event(
        env: Env,
        chain_id: u32,
        contract_address: Address,
        event_signature: Bytes,
        event_data: Bytes,
        block_number: u64,
        transaction_hash: Bytes,
        log_index: u32,
    ) -> u64 {
        let count: u64 = env.storage().instance().get(&EventSyncDataKey::EventCount).unwrap_or(0);
        let event_id = count + 1;

        let event = ChainEvent {
            event_id,
            chain_id,
            contract_address,
            event_signature,
            event_data,
            block_number,
            transaction_hash,
            log_index,
            timestamp: env.ledger().timestamp(),
            synced: false,
        };

        env.storage().instance().set(&EventSyncDataKey::ChainEvent(event_id), &event);
        env.storage().instance().set(&EventSyncDataKey::EventCount, &event_id);

        // Add to pending events
        let mut pending: Vec<u64> = env.storage().instance().get(&EventSyncDataKey::PendingEvents).unwrap();
        pending.push_back(event_id);
        env.storage().instance().set(&EventSyncDataKey::PendingEvents, &pending);

        event_id
    }

    /// Mark an event as synced
    pub fn mark_synced(env: Env, event_id: u64) {
        let mut event: ChainEvent = env.storage().instance()
            .get(&EventSyncDataKey::ChainEvent(event_id))
            .unwrap_or_else(|| panic!("Event not found"));

        event.synced = true;
        env.storage().instance().set(&EventSyncDataKey::ChainEvent(event_id), &event);

        // Remove from pending events
        let mut pending: Vec<u64> = env.storage().instance().get(&EventSyncDataKey::PendingEvents).unwrap();
        if let Some(index) = pending.iter().position(|&id| id == event_id) {
            pending.remove(index);
        }
        env.storage().instance().set(&EventSyncDataKey::PendingEvents, &pending);
    }

    /// Mark an event as failed
    pub fn mark_failed(env: Env, event_id: u64) {
        let mut event: ChainEvent = env.storage().instance()
            .get(&EventSyncDataKey::ChainEvent(event_id))
            .unwrap_or_else(|| panic!("Event not found"));

        event.synced = false; // Keep as false
        env.storage().instance().set(&EventSyncDataKey::ChainEvent(event_id), &event);

        // Add to failed events
        let mut failed: Vec<u64> = env.storage().instance().get(&EventSyncDataKey::FailedEvents).unwrap();
        failed.push_back(event_id);
        env.storage().instance().set(&EventSyncDataKey::FailedEvents, &failed);
    }

    /// Get event details
    pub fn get_event(env: Env, event_id: u64) -> ChainEvent {
        env.storage().instance()
            .get(&EventSyncDataKey::ChainEvent(event_id))
            .unwrap_or_else(|| panic!("Event not found"))
    }

    /// Get pending events
    pub fn get_pending_events(env: Env) -> Vec<u64> {
        env.storage().instance().get(&EventSyncDataKey::PendingEvents).unwrap()
    }

    /// Get failed events
    pub fn get_failed_events(env: Env) -> Vec<u64> {
        env.storage().instance().get(&EventSyncDataKey::FailedEvents).unwrap()
    }

    /// Update sync status for a chain
    pub fn update_sync_status(
        env: Env,
        chain_id: u32,
        last_synced_block: u64,
        sync_errors: u32,
        total_events: u64,
        pending_events: u32,
    ) {
        let status = SyncStatus {
            chain_id,
            last_synced_block,
            last_sync_timestamp: env.ledger().timestamp(),
            sync_errors,
            total_events,
            pending_events,
        };

        env.storage().instance().set(&EventSyncDataKey::SyncStatus(chain_id), &status);
    }

    /// Get sync status for a chain
    pub fn get_sync_status(env: Env, chain_id: u32) -> SyncStatus {
        env.storage().instance()
            .get(&EventSyncDataKey::SyncStatus(chain_id))
            .unwrap_or_else(|| panic!("Sync status not found"))
    }

    /// Get all events for a chain
    pub fn get_chain_events(env: Env, chain_id: u32) -> Vec<ChainEvent> {
        let count: u64 = env.storage().instance().get(&EventSyncDataKey::EventCount).unwrap_or(0);
        let mut events = Vec::new(&env);

        for i in 1..=count {
            if let Some(event) = env.storage().instance().get::<EventSyncDataKey, ChainEvent>(&EventSyncDataKey::ChainEvent(i)) {
                if event.chain_id == chain_id {
                    events.push_back(event);
                }
            }
        }

        events
    }

    /// Retry failed events
    pub fn retry_failed_events(env: Env) -> Vec<u64> {
        let failed: Vec<u64> = env.storage().instance().get(&EventSyncDataKey::FailedEvents).unwrap();
        let mut retried = Vec::new(&env);

        for event_id in failed.iter() {
            // Move back to pending
            let mut pending: Vec<u64> = env.storage().instance().get(&EventSyncDataKey::PendingEvents).unwrap();
            pending.push_back(*event_id);
            env.storage().instance().set(&EventSyncDataKey::PendingEvents, &pending);
            retried.push_back(*event_id);
        }

        // Clear failed events
        env.storage().instance().set(&EventSyncDataKey::FailedEvents, &Vec::<u64>::new(&env));

        retried
    }
}