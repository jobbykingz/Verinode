#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, U256, u128, i128};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BridgeTransaction {
    pub transaction_id: u64,
    pub source_chain: u32,
    pub target_chain: u32,
    pub token_address: Address,
    pub from_address: Address,
    pub to_address: Address,
    pub amount: u128,
    pub fee: u128,
    pub nonce: u64,
    pub status: TransactionStatus,
    pub timestamp: u64,
    pub gas_used: u64,
    pub relayer_fee: u128,
    pub metadata: Bytes,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TransactionStatus {
    Pending,
    Confirmed,
    Completed,
    Failed,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChainConfiguration {
    pub chain_id: u32,
    pub chain_name: String,
    pub native_token: Address,
    pub bridge_contract: Address,
    pub confirmations: u32,
    pub gas_limit: u64,
    pub active: bool,
    pub minimum_fee: u128,
    pub maximum_fee: u128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayerInfo {
    pub address: Address,
    pub stake: u128,
    pub reputation: u32,
    pub active: bool,
    pub total_transactions: u64,
    pub success_rate: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeTier {
    pub tier_name: String,
    pub min_amount: u128,
    pub max_amount: u128,
    pub fee_percentage: u32,
    pub fixed_fee: u128,
}

#[contracttype]
pub enum AdvancedBridgeDataKey {
    Transaction(u64),
    ChainConfig(u32),
    Relayer(Address),
    FeeTier(String),
    TransactionCount,
    ActiveRelayers,
    SupportedTokens,
    Admin,
    Paused,
    EmergencyMode,
    TotalVolume,
    TotalFees,
}

#[contract]
pub struct AdvancedBridge;

#[contractimpl]
impl AdvancedBridge {
    /// Initialize the advanced bridge contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&AdvancedBridgeDataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&AdvancedBridgeDataKey::Admin, &admin);
        env.storage().instance().set(&AdvancedBridgeDataKey::TransactionCount, &0u64);
        env.storage().instance().set(&AdvancedBridgeDataKey::Paused, &false);
        env.storage().instance().set(&AdvancedBridgeDataKey::EmergencyMode, &false);
        env.storage().instance().set(&AdvancedBridgeDataKey::TotalVolume, &0u128);
        env.storage().instance().set(&AdvancedBridgeDataKey::TotalFees, &0u128);
        
        // Initialize default fee tiers
        Self::initialize_default_fee_tiers(env.clone());
        
        // Initialize supported chains
        Self::initialize_default_chains(env.clone());
    }

    /// Initialize default fee tiers
    fn initialize_default_fee_tiers(env: Env) {
        let tiers = vec![
            FeeTier {
                tier_name: String::from_str(&env, "Small"),
                min_amount: 0u128,
                max_amount: 1000u128,
                fee_percentage: 50, // 0.5%
                fixed_fee: 100u128,
            },
            FeeTier {
                tier_name: String::from_str(&env, "Medium"),
                min_amount: 1000u128,
                max_amount: 10000u128,
                fee_percentage: 30, // 0.3%
                fixed_fee: 50u128,
            },
            FeeTier {
                tier_name: String::from_str(&env, "Large"),
                min_amount: 10000u128,
                max_amount: 100000u128,
                fee_percentage: 20, // 0.2%
                fixed_fee: 25u128,
            },
            FeeTier {
                tier_name: String::from_str(&env, "Whale"),
                min_amount: 100000u128,
                max_amount: u128::MAX,
                fee_percentage: 10, // 0.1%
                fixed_fee: 10u128,
            },
        ];
        
        for tier in tiers {
            env.storage().instance().set(&AdvancedBridgeDataKey::FeeTier(tier.tier_name.clone()), &tier);
        }
    }

    /// Initialize default chain configurations
    fn initialize_default_chains(env: Env) {
        let default_chains = vec![
            ChainConfiguration {
                chain_id: 1,
                chain_name: String::from_str(&env, "Ethereum"),
                native_token: Address::from_string(&String::from_str(&env, "WETH")),
                bridge_contract: Address::from_string(&String::from_str(&env, "0x0000000000000000000000000000000000000000")),
                confirmations: 12,
                gas_limit: 200000,
                active: true,
                minimum_fee: 100u128,
                maximum_fee: 10000u128,
            },
            ChainConfiguration {
                chain_id: 137,
                chain_name: String::from_str(&env, "Polygon"),
                native_token: Address::from_string(&String::from_str(&env, "WMATIC")),
                bridge_contract: Address::from_string(&String::from_str(&env, "0x0000000000000000000000000000000000000000")),
                confirmations: 20,
                gas_limit: 150000,
                active: true,
                minimum_fee: 50u128,
                maximum_fee: 5000u128,
            },
            ChainConfiguration {
                chain_id: 56,
                chain_name: String::from_str(&env, "BSC"),
                native_token: Address::from_string(&String::from_str(&env, "WBNB")),
                bridge_contract: Address::from_string(&String::from_str(&env, "0x0000000000000000000000000000000000000000")),
                confirmations: 10,
                gas_limit: 180000,
                active: true,
                minimum_fee: 75u128,
                maximum_fee: 7500u128,
            },
        ];
        
        for chain in default_chains {
            env.storage().instance().set(&AdvancedBridgeDataKey::ChainConfig(chain.chain_id), &chain);
        }
    }

    /// Initiate a cross-chain bridge transaction
    pub fn initiate_bridge(
        env: Env,
        source_chain: u32,
        target_chain: u32,
        token_address: Address,
        to_address: Address,
        amount: u128,
        from_address: Address,
        metadata: Bytes,
    ) -> u64 {
        // Check if contract is paused
        if Self::is_paused(env.clone()) {
            panic!("Contract is paused");
        }
        
        from_address.require_auth();
        
        // Validate chain configurations
        let source_config = Self::get_chain_config(env.clone(), source_chain)
            .unwrap_or_else(|| panic!("Source chain not supported"));
        let target_config = Self::get_chain_config(env.clone(), target_chain)
            .unwrap_or_else(|| panic!("Target chain not supported"));
        
        if !source_config.active || !target_config.active {
            panic!("Chain not active");
        }
        
        // Calculate fees
        let fee = Self::calculate_fees(env.clone(), amount);
        let total_amount = amount + fee;
        
        // Create transaction
        let count: u64 = env.storage().instance().get(&AdvancedBridgeDataKey::TransactionCount).unwrap_or(0);
        let transaction_id = count + 1;
        
        let transaction = BridgeTransaction {
            transaction_id,
            source_chain,
            target_chain,
            token_address: token_address.clone(),
            from_address: from_address.clone(),
            to_address: to_address.clone(),
            amount,
            fee,
            nonce: count,
            status: TransactionStatus::Pending,
            timestamp: env.ledger().timestamp(),
            gas_used: 0,
            relayer_fee: fee / 2, // Half of fee goes to relayer
            metadata: metadata.clone(),
        };
        
        env.storage().instance().set(&AdvancedBridgeDataKey::Transaction(transaction_id), &transaction);
        env.storage().instance().set(&AdvancedBridgeDataKey::TransactionCount, &transaction_id);
        
        // Update total volume and fees
        let mut total_volume: u128 = env.storage().instance().get(&AdvancedBridgeDataKey::TotalVolume).unwrap_or(0);
        let mut total_fees: u128 = env.storage().instance().get(&AdvancedBridgeDataKey::TotalFees).unwrap_or(0);
        total_volume += amount;
        total_fees += fee;
        env.storage().instance().set(&AdvancedBridgeDataKey::TotalVolume, &total_volume);
        env.storage().instance().set(&AdvancedBridgeDataKey::TotalFees, &total_fees);
        
        transaction_id
    }

    /// Confirm a bridge transaction
    pub fn confirm_transaction(env: Env, transaction_id: u64, relayer: Address) -> bool {
        if Self::is_paused(env.clone()) {
            panic!("Contract is paused");
        }
        
        relayer.require_auth();
        
        // Verify relayer is active
        let relayer_info = Self::get_relayer(env.clone(), relayer.clone())
            .unwrap_or_else(|| panic!("Relayer not registered"));
        
        if !relayer_info.active {
            panic!("Relayer not active");
        }
        
        let mut transaction: BridgeTransaction = env.storage().instance()
            .get(&AdvancedBridgeDataKey::Transaction(transaction_id))
            .unwrap_or_else(|| panic!("Transaction not found"));
        
        if transaction.status != TransactionStatus::Pending {
            panic!("Transaction not in pending state");
        }
        
        transaction.status = TransactionStatus::Confirmed;
        env.storage().instance().set(&AdvancedBridgeDataKey::Transaction(transaction_id), &transaction);
        
        // Update relayer stats
        Self::update_relayer_stats(env.clone(), relayer, true);
        
        true
    }

    /// Complete a bridge transaction
    pub fn complete_transaction(env: Env, transaction_id: u64, relayer: Address, proof: Bytes) -> bool {
        if Self::is_paused(env.clone()) {
            panic!("Contract is paused");
        }
        
        relayer.require_auth();
        
        let mut transaction: BridgeTransaction = env.storage().instance()
            .get(&AdvancedBridgeDataKey::Transaction(transaction_id))
            .unwrap_or_else(|| panic!("Transaction not found"));
        
        if transaction.status != TransactionStatus::Confirmed {
            panic!("Transaction not confirmed");
        }
        
        // Verify proof (simplified - in production, this would be more complex)
        if proof.is_empty() {
            panic!("Invalid proof");
        }
        
        transaction.status = TransactionStatus::Completed;
        env.storage().instance().set(&AdvancedBridgeDataKey::Transaction(transaction_id), &transaction);
        
        // Update relayer stats
        Self::update_relayer_stats(env.clone(), relayer, true);
        
        true
    }

    /// Register a new relayer
    pub fn register_relayer(env: Env, admin: Address, relayer_address: Address, stake: u128) {
        let stored_admin: Address = env.storage().instance()
            .get(&AdvancedBridgeDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let relayer_info = RelayerInfo {
            address: relayer_address.clone(),
            stake,
            reputation: 100, // Start with neutral reputation
            active: true,
            total_transactions: 0,
            success_rate: 100,
        };
        
        env.storage().instance().set(&AdvancedBridgeDataKey::Relayer(relayer_address), &relayer_info);
    }

    /// Update chain configuration
    pub fn update_chain_config(env: Env, admin: Address, chain_config: ChainConfiguration) {
        let stored_admin: Address = env.storage().instance()
            .get(&AdvancedBridgeDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        env.storage().instance().set(&AdvancedBridgeDataKey::ChainConfig(chain_config.chain_id), &chain_config);
    }

    /// Calculate bridge fees based on amount and fee tiers
    fn calculate_fees(env: Env, amount: u128) -> u128 {
        let fee_tiers = vec![
            ("Small", 0u128, 1000u128, 50, 100u128),
            ("Medium", 1000u128, 10000u128, 30, 50u128),
            ("Large", 10000u128, 100000u128, 20, 25u128),
            ("Whale", 100000u128, u128::MAX, 10, 10u128),
        ];
        
        for (tier_name, min_amount, max_amount, fee_percentage, fixed_fee) in fee_tiers {
            if amount >= *min_amount && amount <= *max_amount {
                let percentage_fee = (amount * *fee_percentage as u128) / 10000;
                return percentage_fee + fixed_fee;
            }
        }
        
        100u128 // Default fee
    }

    /// Update relayer statistics
    fn update_relayer_stats(env: Env, relayer: Address, success: bool) {
        let mut relayer_info: RelayerInfo = env.storage().instance()
            .get(&AdvancedBridgeDataKey::Relayer(relayer.clone()))
            .unwrap_or_else(|| panic!("Relayer not found"));
        
        relayer_info.total_transactions += 1;
        if success {
            relayer_info.reputation = (relayer_info.reputation + 1).min(1000);
        } else {
            relayer_info.reputation = relayer_info.reputation.saturating_sub(10);
        }
        relayer_info.success_rate = (relayer_info.success_rate * 95 + if success { 100 } else { 0 }) / 100;
        
        env.storage().instance().set(&AdvancedBridgeDataKey::Relayer(relayer), &relayer_info);
    }

    /// Emergency pause/unpause
    pub fn set_pause(env: Env, admin: Address, paused: bool) {
        let stored_admin: Address = env.storage().instance()
            .get(&AdvancedBridgeDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        env.storage().instance().set(&AdvancedBridgeDataKey::Paused, &paused);
    }

    /// Check if contract is paused
    fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&AdvancedBridgeDataKey::Paused).unwrap_or(false)
    }

    /// Get transaction details
    pub fn get_transaction(env: Env, transaction_id: u64) -> BridgeTransaction {
        env.storage().instance()
            .get(&AdvancedBridgeDataKey::Transaction(transaction_id))
            .unwrap_or_else(|| panic!("Transaction not found"))
    }

    /// Get chain configuration
    pub fn get_chain_config(env: Env, chain_id: u32) -> Option<ChainConfiguration> {
        env.storage().instance().get(&AdvancedBridgeDataKey::ChainConfig(chain_id))
    }

    /// Get relayer information
    pub fn get_relayer(env: Env, relayer: Address) -> Option<RelayerInfo> {
        env.storage().instance().get(&AdvancedBridgeDataKey::Relayer(relayer))
    }

    /// Get total transaction count
    pub fn get_transaction_count(env: Env) -> u64 {
        env.storage().instance().get(&AdvancedBridgeDataKey::TransactionCount).unwrap_or(0)
    }

    /// Get total volume
    pub fn get_total_volume(env: Env) -> u128 {
        env.storage().instance().get(&AdvancedBridgeDataKey::TotalVolume).unwrap_or(0)
    }

    /// Get total fees
    pub fn get_total_fees(env: Env) -> u128 {
        env.storage().instance().get(&AdvancedBridgeDataKey::TotalFees).unwrap_or(0)
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&AdvancedBridgeDataKey::Admin).unwrap()
    }
}
