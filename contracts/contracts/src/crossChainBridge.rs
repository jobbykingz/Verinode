#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, U256};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChainConfig {
    pub chain_id: u32,
    pub chain_name: String,
    pub bridge_address: Address,
    pub gas_price: u64,
    pub block_time: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrossChainProof {
    pub proof_id: u64,
    pub source_chain: u32,
    pub target_chain: u32,
    pub proof_data: Bytes,
    pub source_verification: bool,
    pub target_verification: bool,
    pub timestamp: u64,
    pub gas_used: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BridgeMessage {
    pub message_id: u64,
    pub source_chain: u32,
    pub target_chain: u32,
    pub sender: Address,
    pub recipient: Address,
    pub data: Bytes,
    pub nonce: u64,
    pub signature: Bytes,
    pub timestamp: u64,
}

#[contracttype]
pub enum BridgeDataKey {
    ChainConfig(u32),
    CrossChainProof(u64),
    BridgeMessage(u64),
    ProofCount,
    MessageCount,
    SupportedChains,
    Admin,
}

#[contract]
pub struct CrossChainBridge;

#[contractimpl]
impl CrossChainBridge {
    /// Initialize the bridge contract with admin
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&BridgeDataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&BridgeDataKey::Admin, &admin);
        env.storage().instance().set(&BridgeDataKey::ProofCount, &0u64);
        env.storage().instance().set(&BridgeDataKey::MessageCount, &0u64);
        
        let mut supported_chains = Vec::new(&env);
        supported_chains.push_back(1u32); // Ethereum
        supported_chains.push_back(137u32); // Polygon
        supported_chains.push_back(56u32); // BSC
        env.storage().instance().set(&BridgeDataKey::SupportedChains, &supported_chains);
    }

    /// Add supported chain configuration
    pub fn add_chain_config(env: Env, admin: Address, chain_config: ChainConfig) {
        let stored_admin: Address = env.storage().instance()
            .get(&BridgeDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        env.storage().instance().set(&BridgeDataKey::ChainConfig(chain_config.chain_id), &chain_config);
    }

    /// Get chain configuration
    pub fn get_chain_config(env: Env, chain_id: u32) -> Option<ChainConfig> {
        env.storage().instance().get(&BridgeDataKey::ChainConfig(chain_id))
    }

    /// Get all supported chains
    pub fn get_supported_chains(env: Env) -> Vec<u32> {
        env.storage().instance().get(&BridgeDataKey::SupportedChains).unwrap_or(Vec::new(&env))
    }

    /// Submit cross-chain proof for verification
    pub fn submit_cross_chain_proof(
        env: Env,
        source_chain: u32,
        target_chain: u32,
        proof_data: Bytes,
        submitter: Address,
    ) -> u64 {
        submitter.require_auth();
        
        // Verify chains are supported
        let supported_chains = Self::get_supported_chains(env.clone());
        if !supported_chains.contains(&source_chain) || !supported_chains.contains(&target_chain) {
            panic!("Unsupported chain");
        }
        
        let count: u64 = env.storage().instance().get(&BridgeDataKey::ProofCount).unwrap_or(0);
        let proof_id = count + 1;
        
        let proof = CrossChainProof {
            proof_id,
            source_chain,
            target_chain,
            proof_data: proof_data.clone(),
            source_verification: false,
            target_verification: false,
            timestamp: env.ledger().timestamp(),
            gas_used: 0,
        };
        
        env.storage().instance().set(&BridgeDataKey::CrossChainProof(proof_id), &proof);
        env.storage().instance().set(&BridgeDataKey::ProofCount, &proof_id);
        
        proof_id
    }

    /// Verify proof on source chain
    pub fn verify_source_proof(env: Env, admin: Address, proof_id: u64) -> bool {
        let stored_admin: Address = env.storage().instance()
            .get(&BridgeDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let mut proof: CrossChainProof = env.storage().instance()
            .get(&BridgeDataKey::CrossChainProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));
        
        proof.source_verification = true;
        env.storage().instance().set(&BridgeDataKey::CrossChainProof(proof_id), &proof);
        
        true
    }

    /// Verify proof on target chain
    pub fn verify_target_proof(env: Env, admin: Address, proof_id: u64) -> bool {
        let stored_admin: Address = env.storage().instance()
            .get(&BridgeDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let mut proof: CrossChainProof = env.storage().instance()
            .get(&BridgeDataKey::CrossChainProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));
        
        if !proof.source_verification {
            panic!("Source proof must be verified first");
        }
        
        proof.target_verification = true;
        env.storage().instance().set(&BridgeDataKey::CrossChainProof(proof_id), &proof);
        
        true
    }

    /// Get cross-chain proof details
    pub fn get_cross_chain_proof(env: Env, proof_id: u64) -> CrossChainProof {
        env.storage().instance()
            .get(&BridgeDataKey::CrossChainProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"))
    }

    /// Send bridge message
    pub fn send_bridge_message(
        env: Env,
        source_chain: u32,
        target_chain: u32,
        recipient: Address,
        data: Bytes,
        sender: Address,
        signature: Bytes,
    ) -> u64 {
        sender.require_auth();
        
        let count: u64 = env.storage().instance().get(&BridgeDataKey::MessageCount).unwrap_or(0);
        let message_id = count + 1;
        
        let message = BridgeMessage {
            message_id,
            source_chain,
            target_chain,
            sender: sender.clone(),
            recipient: recipient.clone(),
            data: data.clone(),
            nonce: count,
            signature: signature.clone(),
            timestamp: env.ledger().timestamp(),
        };
        
        env.storage().instance().set(&BridgeDataKey::BridgeMessage(message_id), &message);
        env.storage().instance().set(&BridgeDataKey::MessageCount, &message_id);
        
        message_id
    }

    /// Get bridge message
    pub fn get_bridge_message(env: Env, message_id: u64) -> BridgeMessage {
        env.storage().instance()
            .get(&BridgeDataKey::BridgeMessage(message_id))
            .unwrap_or_else(|| panic!("Message not found"))
    }

    /// Get total proof count
    pub fn get_proof_count(env: Env) -> u64 {
        env.storage().instance().get(&BridgeDataKey::ProofCount).unwrap_or(0)
    }

    /// Get total message count
    pub fn get_message_count(env: Env) -> u64 {
        env.storage().instance().get(&BridgeDataKey::MessageCount).unwrap_or(0)
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&BridgeDataKey::Admin).unwrap()
    }
}
