#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, U256};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrossChainMessage {
    pub message_id: u64,
    pub source_chain: u32,
    pub target_chain: u32,
    pub sender: Address,
    pub recipient: Address,
    pub message_type: MessageType,
    pub payload: Bytes,
    pub nonce: u64,
    pub signature: Bytes,
    pub status: MessageStatus,
    pub created_at: u64,
    pub processed_at: Option<u64>,
    pub gas_used: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MessageType {
    ProofVerification,
    AssetTransfer,
    AtomicSwap,
    Generic,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MessageStatus {
    Pending,
    InTransit,
    Delivered,
    Failed,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MessageRelayer {
    pub relayer_id: u64,
    pub address: Address,
    pub supported_chains: Vec<u32>,
    pub fee_percentage: u32,
    pub active: bool,
    pub total_messages: u64,
    pub success_rate: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MessageQueue {
    pub queue_id: u64,
    pub chain_id: u32,
    pub messages: Vec<u64>, // message_ids
    pub priority: QueuePriority,
    pub max_size: u32,
    pub current_size: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum QueuePriority {
    Low,
    Medium,
    High,
    Critical,
}

#[contracttype]
pub enum MessageDataKey {
    CrossChainMessage(u64),
    MessageRelayer(u64),
    MessageQueue(u64),
    MessageCount,
    RelayerCount,
    QueueCount,
    PendingMessages,
    Admin,
}

#[contract]
pub struct MessagePassing;

#[contractimpl]
impl MessagePassing {
    /// Initialize the message passing contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&MessageDataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&MessageDataKey::Admin, &admin);
        env.storage().instance().set(&MessageDataKey::MessageCount, &0u64);
        env.storage().instance().set(&MessageDataKey::RelayerCount, &0u64);
        env.storage().instance().set(&MessageDataKey::QueueCount, &0u64);
        env.storage().instance().set(&MessageDataKey::PendingMessages, &Vec::new(&env));
    }

    /// Send cross-chain message
    pub fn send_message(
        env: Env,
        target_chain: u32,
        recipient: Address,
        message_type: MessageType,
        payload: Bytes,
        sender: Address,
        signature: Bytes,
    ) -> u64 {
        sender.require_auth();
        
        let count: u64 = env.storage().instance().get(&MessageDataKey::MessageCount).unwrap_or(0);
        let message_id = count + 1;
        
        let message = CrossChainMessage {
            message_id,
            source_chain: Self::get_current_chain_id(env.clone()),
            target_chain,
            sender: sender.clone(),
            recipient: recipient.clone(),
            message_type: message_type.clone(),
            payload: payload.clone(),
            nonce: count,
            signature: signature.clone(),
            status: MessageStatus::Pending,
            created_at: env.ledger().timestamp(),
            processed_at: None,
            gas_used: 0,
        };
        
        env.storage().instance().set(&MessageDataKey::CrossChainMessage(message_id), &message);
        env.storage().instance().set(&MessageDataKey::MessageCount, &message_id);
        
        // Add to pending messages
        let mut pending: Vec<u64> = env.storage().instance()
            .get(&MessageDataKey::PendingMessages)
            .unwrap_or(Vec::new(&env));
        pending.push_back(message_id);
        env.storage().instance().set(&MessageDataKey::PendingMessages, &pending);
        
        message_id
    }

    /// Process message (relayer function)
    pub fn process_message(env: Env, message_id: u64, relayer: Address) -> bool {
        relayer.require_auth();
        
        // Check if relayer is registered
        if !Self::is_relayer_active(env.clone(), relayer.clone()) {
            panic!("Relayer not active");
        }
        
        let mut message: CrossChainMessage = env.storage().instance()
            .get(&MessageDataKey::CrossChainMessage(message_id))
            .unwrap_or_else(|| panic!("Message not found"));
        
        if message.status != MessageStatus::Pending {
            panic!("Message not in pending state");
        }
        
        // Update message status
        message.status = MessageStatus::InTransit;
        message.processed_at = Some(env.ledger().timestamp());
        message.gas_used = Self::estimate_message_gas(env.clone(), message.payload.len());
        
        env.storage().instance().set(&MessageDataKey::CrossChainMessage(message_id), &message);
        
        // Remove from pending messages
        Self::remove_from_pending(env.clone(), message_id);
        
        // Update relayer stats
        Self::update_relayer_stats(env.clone(), relayer.clone(), true);
        
        true
    }

    /// Deliver message to target chain
    pub fn deliver_message(env: Env, message_id: u64, delivery_proof: Bytes, relayer: Address) -> bool {
        relayer.require_auth();
        
        let mut message: CrossChainMessage = env.storage().instance()
            .get(&MessageDataKey::CrossChainMessage(message_id))
            .unwrap_or_else(|| panic!("Message not found"));
        
        if message.status != MessageStatus::InTransit {
            panic!("Message not in transit");
        }
        
        // Verify delivery proof (simplified)
        if !Self::verify_delivery_proof(env.clone(), delivery_proof.clone()) {
            panic!("Invalid delivery proof");
        }
        
        message.status = MessageStatus::Delivered;
        message.processed_at = Some(env.ledger().timestamp());
        
        env.storage().instance().set(&MessageDataKey::CrossChainMessage(message_id), &message);
        
        true
    }

    /// Register message relayer
    pub fn register_relayer(
        env: Env,
        admin: Address,
        relayer_address: Address,
        supported_chains: Vec<u32>,
        fee_percentage: u32,
    ) -> u64 {
        let stored_admin: Address = env.storage().instance()
            .get(&MessageDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let count: u64 = env.storage().instance().get(&MessageDataKey::RelayerCount).unwrap_or(0);
        let relayer_id = count + 1;
        
        let relayer = MessageRelayer {
            relayer_id,
            address: relayer_address.clone(),
            supported_chains: supported_chains.clone(),
            fee_percentage,
            active: true,
            total_messages: 0,
            success_rate: 100,
        };
        
        env.storage().instance().set(&MessageDataKey::MessageRelayer(relayer_id), &relayer);
        env.storage().instance().set(&MessageDataKey::RelayerCount, &relayer_id);
        
        relayer_id
    }

    /// Create message queue for chain
    pub fn create_queue(
        env: Env,
        admin: Address,
        chain_id: u32,
        priority: QueuePriority,
        max_size: u32,
    ) -> u64 {
        let stored_admin: Address = env.storage().instance()
            .get(&MessageDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let count: u64 = env.storage().instance().get(&MessageDataKey::QueueCount).unwrap_or(0);
        let queue_id = count + 1;
        
        let queue = MessageQueue {
            queue_id,
            chain_id,
            messages: Vec::new(&env),
            priority: priority.clone(),
            max_size,
            current_size: 0,
        };
        
        env.storage().instance().set(&MessageDataKey::MessageQueue(queue_id), &queue);
        env.storage().instance().set(&MessageDataKey::QueueCount, &queue_id);
        
        queue_id
    }

    /// Get message details
    pub fn get_message(env: Env, message_id: u64) -> CrossChainMessage {
        env.storage().instance()
            .get(&MessageDataKey::CrossChainMessage(message_id))
            .unwrap_or_else(|| panic!("Message not found"))
    }

    /// Get relayer details
    pub fn get_relayer(env: Env, relayer_id: u64) -> MessageRelayer {
        env.storage().instance()
            .get(&MessageDataKey::MessageRelayer(relayer_id))
            .unwrap_or_else(|| panic!("Relayer not found"))
    }

    /// Get message queue
    pub fn get_queue(env: Env, queue_id: u64) -> MessageQueue {
        env.storage().instance()
            .get(&MessageDataKey::MessageQueue(queue_id))
            .unwrap_or_else(|| panic!("Queue not found"))
    }

    /// Get pending messages
    pub fn get_pending_messages(env: Env) -> Vec<u64> {
        env.storage().instance()
            .get(&MessageDataKey::PendingMessages)
            .unwrap_or(Vec::new(&env))
    }

    /// Get messages for recipient
    pub fn get_messages_for_recipient(env: Env, recipient: Address) -> Vec<CrossChainMessage> {
        let count: u64 = env.storage().instance().get(&MessageDataKey::MessageCount).unwrap_or(0);
        let mut messages = Vec::new(&env);
        
        for i in 1..=count {
            if let Some(message) = env.storage().instance().get::<MessageDataKey, CrossChainMessage>(&MessageDataKey::CrossChainMessage(i)) {
                if message.recipient == recipient {
                    messages.push_back(message);
                }
            }
        }
        
        messages
    }

    /// Get messages by type
    pub fn get_messages_by_type(env: Env, message_type: MessageType) -> Vec<CrossChainMessage> {
        let count: u64 = env.storage().instance().get(&MessageDataKey::MessageCount).unwrap_or(0);
        let mut messages = Vec::new(&env);
        
        for i in 1..=count {
            if let Some(message) = env.storage().instance().get::<MessageDataKey, CrossChainMessage>(&MessageDataKey::CrossChainMessage(i)) {
                if message.message_type == message_type {
                    messages.push_back(message);
                }
            }
        }
        
        messages
    }

    /// Batch send messages
    pub fn batch_send_messages(
        env: Env,
        messages: Vec<(u32, Address, MessageType, Bytes, Bytes)>, // (target_chain, recipient, message_type, payload, signature)
        sender: Address,
    ) -> Vec<u64> {
        sender.require_auth();
        
        let mut message_ids = Vec::new(&env);
        
        for i in 0..messages.len() {
            let (target_chain, recipient, message_type, payload, signature) = messages.get(i).unwrap();
            
            let message_id = Self::send_message(
                env.clone(),
                *target_chain,
                recipient.clone(),
                message_type.clone(),
                payload.clone(),
                sender.clone(),
                signature.clone(),
            );
            
            message_ids.push_back(message_id);
        }
        
        message_ids
    }

    /// Expire old pending messages
    pub fn expire_pending_messages(env: Env, timeout_seconds: u64) -> Vec<u64> {
        let pending = Self::get_pending_messages(env.clone());
        let current_time = env.ledger().timestamp();
        let mut expired = Vec::new(&env);
        
        for i in 0..pending.len() {
            let message_id = pending.get(i).unwrap();
            let message: CrossChainMessage = env.storage().instance()
                .get(&MessageDataKey::CrossChainMessage(*message_id))
                .unwrap();
            
            if current_time > message.created_at + timeout_seconds {
                let mut updated_message = message;
                updated_message.status = MessageStatus::Expired;
                
                env.storage().instance().set(&MessageDataKey::CrossChainMessage(*message_id), &updated_message);
                expired.push_back(*message_id);
            }
        }
        
        // Remove expired from pending
        for i in 0..expired.len() {
            Self::remove_from_pending(env.clone(), *expired.get(i).unwrap());
        }
        
        expired
    }

    /// Helper functions
    fn get_current_chain_id(env: Env) -> u32 {
        // Simplified - in practice, this would get the actual chain ID
        1 // Default to Ethereum mainnet
    }

    fn estimate_message_gas(env: Env, payload_size: u32) -> u64 {
        // Base gas + gas per byte
        21000u64 + (payload_size as u64 * 100)
    }

    fn verify_delivery_proof(env: Env, proof: Bytes) -> bool {
        // Simplified proof verification
        proof.len() > 0
    }

    fn is_relayer_active(env: Env, relayer: Address) -> bool {
        let count: u64 = env.storage().instance().get(&MessageDataKey::RelayerCount).unwrap_or(0);
        
        for i in 1..=count {
            if let Some(relayer_info) = env.storage().instance().get::<MessageDataKey, MessageRelayer>(&MessageDataKey::MessageRelayer(i)) {
                if relayer_info.address == relayer && relayer_info.active {
                    return true;
                }
            }
        }
        
        false
    }

    fn update_relayer_stats(env: Env, relayer: Address, success: bool) {
        let count: u64 = env.storage().instance().get(&MessageDataKey::RelayerCount).unwrap_or(0);
        
        for i in 1..=count {
            if let Some(mut relayer_info) = env.storage().instance().get::<MessageDataKey, MessageRelayer>(&MessageDataKey::MessageRelayer(i)) {
                if relayer_info.address == relayer {
                    relayer_info.total_messages += 1;
                    if success {
                        // Maintain success rate (simplified)
                    }
                    env.storage().instance().set(&MessageDataKey::MessageRelayer(i), &relayer_info);
                    break;
                }
            }
        }
    }

    fn remove_from_pending(env: Env, message_id: u64) {
        let mut pending: Vec<u64> = env.storage().instance()
            .get(&MessageDataKey::PendingMessages)
            .unwrap_or(Vec::new(&env));
        
        let mut new_pending = Vec::new(&env);
        for i in 0..pending.len() {
            let id = pending.get(i).unwrap();
            if *id != message_id {
                new_pending.push_back(*id);
            }
        }
        
        env.storage().instance().set(&MessageDataKey::PendingMessages, &new_pending);
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&MessageDataKey::Admin).unwrap()
    }

    /// Get total message count
    pub fn get_message_count(env: Env) -> u64 {
        env.storage().instance().get(&MessageDataKey::MessageCount).unwrap_or(0)
    }

    /// Get total relayer count
    pub fn get_relayer_count(env: Env) -> u64 {
        env.storage().instance().get(&MessageDataKey::RelayerCount).unwrap_or(0)
    }
}
