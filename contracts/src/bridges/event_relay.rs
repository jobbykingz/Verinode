#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayMessage {
    pub message_id: u64,
    pub source_chain: u32,
    pub target_chain: u32,
    pub event_data: Bytes,
    pub relay_attempts: u32,
    pub last_attempt: u64,
    pub status: RelayStatus,
    pub error_message: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RelayStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Retrying,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayConfig {
    pub max_attempts: u32,
    pub retry_delay: u64,
    pub timeout: u64,
    pub gas_limit: u64,
}

#[contracttype]
pub enum EventRelayDataKey {
    RelayMessage(u64),
    RelayConfig,
    MessageCount,
    PendingRelays,
    FailedRelays,
    CompletedRelays,
}

#[contract]
pub struct EventRelayContract;

#[contractimpl]
impl EventRelayContract {
    /// Initialize the event relay contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&EventRelayDataKey::MessageCount) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&EventRelayDataKey::MessageCount, &0u64);
        env.storage().instance().set(&EventRelayDataKey::PendingRelays, &Vec::<u64>::new(&env));
        env.storage().instance().set(&EventRelayDataKey::FailedRelays, &Vec::<u64>::new(&env));
        env.storage().instance().set(&EventRelayDataKey::CompletedRelays, &Vec::<u64>::new(&env));

        // Default relay config
        let config = RelayConfig {
            max_attempts: 3,
            retry_delay: 300, // 5 minutes
            timeout: 3600,    // 1 hour
            gas_limit: 2000000,
        };
        env.storage().instance().set(&EventRelayDataKey::RelayConfig, &config);
    }

    /// Create a new relay message
    pub fn create_relay(
        env: Env,
        source_chain: u32,
        target_chain: u32,
        event_data: Bytes,
    ) -> u64 {
        let count: u64 = env.storage().instance().get(&EventRelayDataKey::MessageCount).unwrap_or(0);
        let message_id = count + 1;

        let message = RelayMessage {
            message_id,
            source_chain,
            target_chain,
            event_data,
            relay_attempts: 0,
            last_attempt: 0,
            status: RelayStatus::Pending,
            error_message: None,
        };

        env.storage().instance().set(&EventRelayDataKey::RelayMessage(message_id), &message);
        env.storage().instance().set(&EventRelayDataKey::MessageCount, &message_id);

        // Add to pending relays
        let mut pending: Vec<u64> = env.storage().instance().get(&EventRelayDataKey::PendingRelays).unwrap();
        pending.push_back(message_id);
        env.storage().instance().set(&EventRelayDataKey::PendingRelays, &pending);

        message_id
    }

    /// Start relaying a message
    pub fn start_relay(env: Env, message_id: u64) {
        let mut message: RelayMessage = env.storage().instance()
            .get(&EventRelayDataKey::RelayMessage(message_id))
            .unwrap_or_else(|| panic!("Relay message not found"));

        message.status = RelayStatus::InProgress;
        message.relay_attempts += 1;
        message.last_attempt = env.ledger().timestamp();

        env.storage().instance().set(&EventRelayDataKey::RelayMessage(message_id), &message);

        // Remove from pending
        let mut pending: Vec<u64> = env.storage().instance().get(&EventRelayDataKey::PendingRelays).unwrap();
        if let Some(index) = pending.iter().position(|&id| id == message_id) {
            pending.remove(index);
        }
        env.storage().instance().set(&EventRelayDataKey::PendingRelays, &pending);
    }

    /// Mark relay as completed
    pub fn complete_relay(env: Env, message_id: u64) {
        let mut message: RelayMessage = env.storage().instance()
            .get(&EventRelayDataKey::RelayMessage(message_id))
            .unwrap_or_else(|| panic!("Relay message not found"));

        message.status = RelayStatus::Completed;
        env.storage().instance().set(&EventRelayDataKey::RelayMessage(message_id), &message);

        // Add to completed
        let mut completed: Vec<u64> = env.storage().instance().get(&EventRelayDataKey::CompletedRelays).unwrap();
        completed.push_back(message_id);
        env.storage().instance().set(&EventRelayDataKey::CompletedRelays, &completed);
    }

    /// Mark relay as failed
    pub fn fail_relay(env: Env, message_id: u64, error_message: String) {
        let mut message: RelayMessage = env.storage().instance()
            .get(&EventRelayDataKey::RelayMessage(message_id))
            .unwrap_or_else(|| panic!("Relay message not found"));

        message.status = RelayStatus::Failed;
        message.error_message = Some(error_message);
        env.storage().instance().set(&EventRelayDataKey::RelayMessage(message_id), &message);

        // Add to failed
        let mut failed: Vec<u64> = env.storage().instance().get(&EventRelayDataKey::FailedRelays).unwrap();
        failed.push_back(message_id);
        env.storage().instance().set(&EventRelayDataKey::FailedRelays, &failed);
    }

    /// Retry failed relays
    pub fn retry_failed_relays(env: Env) -> Vec<u64> {
        let config: RelayConfig = env.storage().instance().get(&EventRelayDataKey::RelayConfig).unwrap();
        let failed: Vec<u64> = env.storage().instance().get(&EventRelayDataKey::FailedRelays).unwrap();
        let mut retried = Vec::new(&env);

        for message_id in failed.iter() {
            let message: RelayMessage = env.storage().instance()
                .get(&EventRelayDataKey::RelayMessage(*message_id))
                .unwrap();

            if message.relay_attempts < config.max_attempts {
                // Check if enough time has passed for retry
                let time_since_last_attempt = env.ledger().timestamp() - message.last_attempt;
                if time_since_last_attempt >= config.retry_delay {
                    // Move back to pending
                    let mut pending: Vec<u64> = env.storage().instance().get(&EventRelayDataKey::PendingRelays).unwrap();
                    pending.push_back(*message_id);
                    env.storage().instance().set(&EventRelayDataKey::PendingRelays, &pending);

                    // Update status
                    let mut updated_message = message.clone();
                    updated_message.status = RelayStatus::Retrying;
                    env.storage().instance().set(&EventRelayDataKey::RelayMessage(*message_id), &updated_message);

                    retried.push_back(*message_id);
                }
            }
        }

        // Remove retried messages from failed
        let mut updated_failed = Vec::new(&env);
        for message_id in failed.iter() {
            if !retried.contains(message_id) {
                updated_failed.push_back(*message_id);
            }
        }
        env.storage().instance().set(&EventRelayDataKey::FailedRelays, &updated_failed);

        retried
    }

    /// Get relay message
    pub fn get_relay_message(env: Env, message_id: u64) -> RelayMessage {
        env.storage().instance()
            .get(&EventRelayDataKey::RelayMessage(message_id))
            .unwrap_or_else(|| panic!("Relay message not found"))
    }

    /// Get pending relays
    pub fn get_pending_relays(env: Env) -> Vec<u64> {
        env.storage().instance().get(&EventRelayDataKey::PendingRelays).unwrap()
    }

    /// Get failed relays
    pub fn get_failed_relays(env: Env) -> Vec<u64> {
        env.storage().instance().get(&EventRelayDataKey::FailedRelays).unwrap()
    }

    /// Get completed relays
    pub fn get_completed_relays(env: Env) -> Vec<u64> {
        env.storage().instance().get(&EventRelayDataKey::CompletedRelays).unwrap()
    }

    /// Update relay configuration
    pub fn update_config(
        env: Env,
        max_attempts: u32,
        retry_delay: u64,
        timeout: u64,
        gas_limit: u64,
    ) {
        let config = RelayConfig {
            max_attempts,
            retry_delay,
            timeout,
            gas_limit,
        };
        env.storage().instance().set(&EventRelayDataKey::RelayConfig, &config);
    }

    /// Get relay configuration
    pub fn get_config(env: Env) -> RelayConfig {
        env.storage().instance().get(&EventRelayDataKey::RelayConfig).unwrap()
    }

    /// Check if relay has timed out
    pub fn check_timeout(env: Env, message_id: u64) -> bool {
        let config: RelayConfig = env.storage().instance().get(&EventRelayDataKey::RelayConfig).unwrap();
        let message: RelayMessage = env.storage().instance()
            .get(&EventRelayDataKey::RelayMessage(message_id))
            .unwrap_or_else(|| panic!("Relay message not found"));

        let time_since_last_attempt = env.ledger().timestamp() - message.last_attempt;
        time_since_last_attempt > config.timeout
    }
}