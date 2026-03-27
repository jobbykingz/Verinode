#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChainConfig {
    pub chain_id: u32,
    pub rpc_url: String,
    pub contract_addresses: Vec<Address>,
    pub event_signatures: Vec<Bytes>,
    pub polling_interval: u64,
    pub last_polled_block: u64,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ListenerMetrics {
    pub chain_id: u32,
    pub total_events: u64,
    pub processed_events: u64,
    pub failed_events: u64,
    pub last_update: u64,
    pub avg_processing_time: u64,
}

#[contracttype]
pub enum ChainListenerDataKey {
    ChainConfig(u32),
    ListenerMetrics(u32),
    ActiveChains,
    EventQueue,
}

#[contract]
pub struct ChainListenerContract;

#[contractimpl]
impl ChainListenerContract {
    /// Initialize the chain listener contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ChainListenerDataKey::ActiveChains) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&ChainListenerDataKey::ActiveChains, &Vec::<u32>::new(&env));
        env.storage().instance().set(&ChainListenerDataKey::EventQueue, &Vec::<Bytes>::new(&env));
    }

    /// Register a new chain for listening
    pub fn register_chain(
        env: Env,
        chain_id: u32,
        rpc_url: String,
        contract_addresses: Vec<Address>,
        event_signatures: Vec<Bytes>,
        polling_interval: u64,
    ) {
        let config = ChainConfig {
            chain_id,
            rpc_url,
            contract_addresses,
            event_signatures,
            polling_interval,
            last_polled_block: 0,
            is_active: true,
        };

        env.storage().instance().set(&ChainListenerDataKey::ChainConfig(chain_id), &config);

        // Add to active chains
        let mut active: Vec<u32> = env.storage().instance().get(&ChainListenerDataKey::ActiveChains).unwrap();
        if !active.contains(&chain_id) {
            active.push_back(chain_id);
            env.storage().instance().set(&ChainListenerDataKey::ActiveChains, &active);
        }

        // Initialize metrics
        let metrics = ListenerMetrics {
            chain_id,
            total_events: 0,
            processed_events: 0,
            failed_events: 0,
            last_update: env.ledger().timestamp(),
            avg_processing_time: 0,
        };
        env.storage().instance().set(&ChainListenerDataKey::ListenerMetrics(chain_id), &metrics);
    }

    /// Update the last polled block for a chain
    pub fn update_last_block(env: Env, chain_id: u32, block_number: u64) {
        let mut config: ChainConfig = env.storage().instance()
            .get(&ChainListenerDataKey::ChainConfig(chain_id))
            .unwrap_or_else(|| panic!("Chain config not found"));

        config.last_polled_block = block_number;
        env.storage().instance().set(&ChainListenerDataKey::ChainConfig(chain_id), &config);
    }

    /// Add event to processing queue
    pub fn queue_event(env: Env, event_data: Bytes) {
        let mut queue: Vec<Bytes> = env.storage().instance().get(&ChainListenerDataKey::EventQueue).unwrap();
        queue.push_back(event_data);
        env.storage().instance().set(&ChainListenerDataKey::EventQueue, &queue);
    }

    /// Get next event from queue
    pub fn dequeue_event(env: Env) -> Option<Bytes> {
        let mut queue: Vec<Bytes> = env.storage().instance().get(&ChainListenerDataKey::EventQueue).unwrap();
        if queue.is_empty() {
            None
        } else {
            let event = queue.front().unwrap().clone();
            queue.pop_front();
            env.storage().instance().set(&ChainListenerDataKey::EventQueue, &queue);
            Some(event)
        }
    }

    /// Update listener metrics
    pub fn update_metrics(
        env: Env,
        chain_id: u32,
        total_events: u64,
        processed_events: u64,
        failed_events: u64,
        processing_time: u64,
    ) {
        let mut metrics: ListenerMetrics = env.storage().instance()
            .get(&ChainListenerDataKey::ListenerMetrics(chain_id))
            .unwrap_or_else(|| panic!("Metrics not found"));

        metrics.total_events = total_events;
        metrics.processed_events = processed_events;
        metrics.failed_events = failed_events;
        metrics.last_update = env.ledger().timestamp();

        // Update average processing time
        if metrics.avg_processing_time == 0 {
            metrics.avg_processing_time = processing_time;
        } else {
            metrics.avg_processing_time = (metrics.avg_processing_time + processing_time) / 2;
        }

        env.storage().instance().set(&ChainListenerDataKey::ListenerMetrics(chain_id), &metrics);
    }

    /// Get chain configuration
    pub fn get_chain_config(env: Env, chain_id: u32) -> ChainConfig {
        env.storage().instance()
            .get(&ChainListenerDataKey::ChainConfig(chain_id))
            .unwrap_or_else(|| panic!("Chain config not found"))
    }

    /// Get listener metrics
    pub fn get_metrics(env: Env, chain_id: u32) -> ListenerMetrics {
        env.storage().instance()
            .get(&ChainListenerDataKey::ListenerMetrics(chain_id))
            .unwrap_or_else(|| panic!("Metrics not found"))
    }

    /// Get all active chains
    pub fn get_active_chains(env: Env) -> Vec<u32> {
        env.storage().instance().get(&ChainListenerDataKey::ActiveChains).unwrap()
    }

    /// Deactivate a chain
    pub fn deactivate_chain(env: Env, chain_id: u32) {
        let mut config: ChainConfig = env.storage().instance()
            .get(&ChainListenerDataKey::ChainConfig(chain_id))
            .unwrap_or_else(|| panic!("Chain config not found"));

        config.is_active = false;
        env.storage().instance().set(&ChainListenerDataKey::ChainConfig(chain_id), &config);

        // Remove from active chains
        let mut active: Vec<u32> = env.storage().instance().get(&ChainListenerDataKey::ActiveChains).unwrap();
        if let Some(index) = active.iter().position(|&id| id == chain_id) {
            active.remove(index);
        }
        env.storage().instance().set(&ChainListenerDataKey::ActiveChains, &active);
    }

    /// Get queue size
    pub fn get_queue_size(env: Env) -> u32 {
        let queue: Vec<Bytes> = env.storage().instance().get(&ChainListenerDataKey::EventQueue).unwrap();
        queue.len()
    }
}