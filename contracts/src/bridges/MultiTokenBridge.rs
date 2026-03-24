#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, U256, u128, i128};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenInfo {
    pub token_address: Address,
    pub chain_id: u32,
    pub symbol: String,
    pub decimals: u8,
    pub total_supply: u128,
    pub is_native: bool,
    pub is_wrapped: bool,
    pub bridge_fee: u128,
    pub minimum_amount: u128,
    pub maximum_amount: u128,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MultiTokenTransaction {
    pub transaction_id: u64,
    pub source_chain: u32,
    pub target_chain: u32,
    pub tokens: Vec<TokenTransfer>,
    pub from_address: Address,
    pub to_address: Address,
    pub total_fee: u128,
    pub nonce: u64,
    pub status: MultiTokenStatus,
    pub timestamp: u64,
    pub gas_used: u64,
    pub metadata: Bytes,
    pub signature: Bytes,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenTransfer {
    pub token_address: Address,
    pub amount: u128,
    pub fee: u128,
    pub is_native: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MultiTokenStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Refunded,
    PartiallyCompleted,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BridgeRoute {
    pub route_id: u64,
    pub source_chain: u32,
    pub target_chain: u32,
    pub tokens: Vec<Address>,
    pub fees: Vec<u128>,
    pub active: bool,
    pub priority: u32,
    pub max_amount: u128,
    pub min_amount: u128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMapping {
    pub original_token: Address,
    pub wrapped_token: Address,
    pub chain_id: u32,
    pub original_chain: u32,
    active: bool,
}

#[contracttype]
pub enum MultiTokenDataKey {
    TokenInfo(Address),
    Transaction(u64),
    Route(u64),
    TokenMapping(Address),
    TransactionCount,
    RouteCount,
    SupportedChains,
    SupportedTokens,
    Admin,
    Paused,
    EmergencyMode,
    TotalTransactions,
    TotalVolume,
    TotalFees,
}

#[contract]
pub struct MultiTokenBridge;

#[contractimpl]
impl MultiTokenBridge {
    /// Initialize the multi-token bridge
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&MultiTokenDataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&MultiTokenDataKey::Admin, &admin);
        env.storage().instance().set(&MultiTokenDataKey::TransactionCount, &0u64);
        env.storage().instance().set(&MultiTokenDataKey::RouteCount, &0u64);
        env.storage().instance().set(&MultiTokenDataKey::Paused, &false);
        env.storage().instance().set(&MultiTokenDataKey::EmergencyMode, &false);
        env.storage().instance().set(&MultiTokenDataKey::TotalTransactions, &0u64);
        env.storage().instance().set(&MultiTokenDataKey::TotalVolume, &0u128);
        env.storage().instance().set(&MultiTokenDataKey::TotalFees, &0u128);
        
        // Initialize supported chains
        let mut supported_chains = Vec::new(&env);
        supported_chains.push_back(1u32);   // Ethereum
        supported_chains.push_back(137u32); // Polygon
        supported_chains.push_back(56u32);  // BSC
        supported_chains.push_back(43114u32); // Avalanche
        supported_chains.push_back(250u32); // Fantom
        env.storage().instance().set(&MultiTokenDataKey::SupportedChains, &supported_chains);
        
        // Initialize default tokens
        Self::initialize_default_tokens(env.clone());
    }

    /// Initialize default supported tokens
    fn initialize_default_tokens(env: Env) {
        let default_tokens = vec![
            TokenInfo {
                token_address: Address::from_string(&String::from_str(&env, "WETH")),
                chain_id: 1,
                symbol: String::from_str(&env, "WETH"),
                decimals: 18,
                total_supply: 0u128,
                is_native: false,
                is_wrapped: true,
                bridge_fee: 100u128,
                minimum_amount: 1u128,
                maximum_amount: 1000000u128,
                active: true,
            },
            TokenInfo {
                token_address: Address::from_string(&String::from_str(&env, "USDC")),
                chain_id: 1,
                symbol: String::from_str(&env, "USDC"),
                decimals: 6,
                total_supply: 0u128,
                is_native: false,
                is_wrapped: false,
                bridge_fee: 50u128,
                minimum_amount: 100u128,
                maximum_amount: 10000000u128,
                active: true,
            },
            TokenInfo {
                token_address: Address::from_string(&String::from_str(&env, "USDT")),
                chain_id: 1,
                symbol: String::from_str(&env, "USDT"),
                decimals: 6,
                total_supply: 0u128,
                is_native: false,
                is_wrapped: false,
                bridge_fee: 50u128,
                minimum_amount: 100u128,
                maximum_amount: 10000000u128,
                active: true,
            },
        ];
        
        for token in default_tokens {
            env.storage().instance().set(&MultiTokenDataKey::TokenInfo(token.token_address.clone()), &token);
        }
    }

    /// Register a new token
    pub fn register_token(env: Env, admin: Address, token_info: TokenInfo) {
        let stored_admin: Address = env.storage().instance()
            .get(&MultiTokenDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let supported_chains = Self::get_supported_chains(env.clone());
        if !supported_chains.contains(&token_info.chain_id) {
            panic!("Chain not supported");
        }
        
        env.storage().instance().set(&MultiTokenDataKey::TokenInfo(token_info.token_address.clone()), &token_info);
    }

    /// Create a multi-token bridge transaction
    pub fn create_multi_token_transaction(
        env: Env,
        source_chain: u32,
        target_chain: u32,
        tokens: Vec<TokenTransfer>,
        from_address: Address,
        to_address: Address,
        metadata: Bytes,
        signature: Bytes,
    ) -> u64 {
        if Self::is_paused(env.clone()) {
            panic!("Contract is paused");
        }
        
        from_address.require_auth();
        
        // Validate chains
        let supported_chains = Self::get_supported_chains(env.clone());
        if !supported_chains.contains(&source_chain) || !supported_chains.contains(&target_chain) {
            panic!("Unsupported chain");
        }
        
        // Validate tokens
        for token_transfer in tokens.iter() {
            let token_info = Self::get_token_info(env.clone(), token_transfer.token_address.clone())
                .unwrap_or_else(|| panic!("Token not supported"));
            
            if !token_info.active {
                panic!("Token not active");
            }
            
            if token_transfer.amount < token_info.minimum_amount || 
               token_transfer.amount > token_info.maximum_amount {
                panic!("Amount out of range");
            }
        }
        
        // Calculate total fees
        let mut total_fee = 0u128;
        for token_transfer in tokens.iter() {
            total_fee += token_transfer.fee;
        }
        
        // Create transaction
        let count: u64 = env.storage().instance().get(&MultiTokenDataKey::TransactionCount).unwrap_or(0);
        let transaction_id = count + 1;
        
        let transaction = MultiTokenTransaction {
            transaction_id,
            source_chain,
            target_chain,
            tokens: tokens.clone(),
            from_address: from_address.clone(),
            to_address: to_address.clone(),
            total_fee,
            nonce: count,
            status: MultiTokenStatus::Pending,
            timestamp: env.ledger().timestamp(),
            gas_used: 0,
            metadata: metadata.clone(),
            signature: signature.clone(),
        };
        
        env.storage().instance().set(&MultiTokenDataKey::Transaction(transaction_id), &transaction);
        env.storage().instance().set(&MultiTokenDataKey::TransactionCount, &transaction_id);
        
        // Update statistics
        let mut total_transactions: u64 = env.storage().instance().get(&MultiTokenDataKey::TotalTransactions).unwrap_or(0);
        let mut total_volume: u128 = env.storage().instance().get(&MultiTokenDataKey::TotalVolume).unwrap_or(0);
        let mut total_fees: u128 = env.storage().instance().get(&MultiTokenDataKey::TotalFees).unwrap_or(0);
        
        total_transactions += 1;
        for token_transfer in tokens.iter() {
            total_volume += token_transfer.amount;
        }
        total_fees += total_fee;
        
        env.storage().instance().set(&MultiTokenDataKey::TotalTransactions, &total_transactions);
        env.storage().instance().set(&MultiTokenDataKey::TotalVolume, &total_volume);
        env.storage().instance().set(&MultiTokenDataKey::TotalFees, &total_fees);
        
        transaction_id
    }

    /// Process a multi-token transaction
    pub fn process_transaction(env: Env, transaction_id: u64, processor: Address, proofs: Vec<Bytes>) -> bool {
        if Self::is_paused(env.clone()) {
            panic!("Contract is paused");
        }
        
        processor.require_auth();
        
        let mut transaction: MultiTokenTransaction = env.storage().instance()
            .get(&MultiTokenDataKey::Transaction(transaction_id))
            .unwrap_or_else(|| panic!("Transaction not found"));
        
        if transaction.status != MultiTokenStatus::Pending {
            panic!("Transaction not in pending state");
        }
        
        if proofs.len() != transaction.tokens.len() {
            panic!("Invalid number of proofs");
        }
        
        // Verify proofs (simplified - in production, this would be more complex)
        for proof in proofs.iter() {
            if proof.is_empty() {
                panic!("Invalid proof");
            }
        }
        
        transaction.status = MultiTokenStatus::Processing;
        env.storage().instance().set(&MultiTokenDataKey::Transaction(transaction_id), &transaction);
        
        true
    }

    /// Complete a multi-token transaction
    pub fn complete_transaction(env: Env, transaction_id: u64, processor: Address, success: bool) -> bool {
        if Self::is_paused(env.clone()) {
            panic!("Contract is paused");
        }
        
        processor.require_auth();
        
        let mut transaction: MultiTokenTransaction = env.storage().instance()
            .get(&MultiTokenDataKey::Transaction(transaction_id))
            .unwrap_or_else(|| panic!("Transaction not found"));
        
        if transaction.status != MultiTokenStatus::Processing {
            panic!("Transaction not in processing state");
        }
        
        transaction.status = if success {
            MultiTokenStatus::Completed
        } else {
            MultiTokenStatus::Failed
        };
        
        env.storage().instance().set(&MultiTokenDataKey::Transaction(transaction_id), &transaction);
        
        true
    }

    /// Create a bridge route
    pub fn create_bridge_route(
        env: Env,
        admin: Address,
        source_chain: u32,
        target_chain: u32,
        tokens: Vec<Address>,
        fees: Vec<u128>,
        priority: u32,
        max_amount: u128,
        min_amount: u128,
    ) -> u64 {
        let stored_admin: Address = env.storage().instance()
            .get(&MultiTokenDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        if tokens.len() != fees.len() {
            panic!("Tokens and fees length mismatch");
        }
        
        let count: u64 = env.storage().instance().get(&MultiTokenDataKey::RouteCount).unwrap_or(0);
        let route_id = count + 1;
        
        let route = BridgeRoute {
            route_id,
            source_chain,
            target_chain,
            tokens: tokens.clone(),
            fees: fees.clone(),
            active: true,
            priority,
            max_amount,
            min_amount,
        };
        
        env.storage().instance().set(&MultiTokenDataKey::Route(route_id), &route);
        env.storage().instance().set(&MultiTokenDataKey::RouteCount, &route_id);
        
        route_id
    }

    /// Create token mapping for wrapped tokens
    pub fn create_token_mapping(
        env: Env,
        admin: Address,
        original_token: Address,
        wrapped_token: Address,
        chain_id: u32,
        original_chain: u32,
    ) {
        let stored_admin: Address = env.storage().instance()
            .get(&MultiTokenDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let mapping = TokenMapping {
            original_token: original_token.clone(),
            wrapped_token: wrapped_token.clone(),
            chain_id,
            original_chain,
            active: true,
        };
        
        env.storage().instance().set(&MultiTokenDataKey::TokenMapping(original_token), &mapping);
    }

    /// Get optimal route for token transfer
    pub fn get_optimal_route(
        env: Env,
        source_chain: u32,
        target_chain: u32,
        token_address: Address,
        amount: u128,
    ) -> Option<BridgeRoute> {
        let count: u64 = env.storage().instance().get(&MultiTokenDataKey::RouteCount).unwrap_or(0);
        let mut best_route: Option<BridgeRoute> = None;
        let mut best_priority = 0u32;
        
        for i in 1..=count {
            if let Some(route) = env.storage().instance().get::<MultiTokenDataKey, BridgeRoute>(&MultiTokenDataKey::Route(i)) {
                if route.source_chain == source_chain && 
                   route.target_chain == target_chain && 
                   route.active &&
                   route.tokens.contains(&token_address) &&
                   amount >= route.min_amount && 
                   amount <= route.max_amount {
                    
                    if best_route.is_none() || route.priority > best_priority {
                        best_route = Some(route);
                        best_priority = route.priority;
                    }
                }
            }
        }
        
        best_route
    }

    /// Batch process multiple transactions
    pub fn batch_process_transactions(
        env: Env,
        processor: Address,
        transaction_ids: Vec<u64>,
        proofs: Vec<Vec<Bytes>>,
    ) -> Vec<bool> {
        if Self::is_paused(env.clone()) {
            panic!("Contract is paused");
        }
        
        processor.require_auth();
        
        if transaction_ids.len() != proofs.len() {
            panic!("Transaction IDs and proofs length mismatch");
        }
        
        let mut results = Vec::new(&env);
        
        for (i, &transaction_id) in transaction_ids.iter().enumerate() {
            let proof_vec = proofs.get(i).unwrap();
            let result = Self::process_transaction(env.clone(), transaction_id, processor.clone(), proof_vec.clone());
            results.push_back(result);
        }
        
        results
    }

    /// Emergency pause/unpause
    pub fn set_pause(env: Env, admin: Address, paused: bool) {
        let stored_admin: Address = env.storage().instance()
            .get(&MultiTokenDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        env.storage().instance().set(&MultiTokenDataKey::Paused, &paused);
    }

    /// Check if contract is paused
    fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&MultiTokenDataKey::Paused).unwrap_or(false)
    }

    /// Get transaction details
    pub fn get_transaction(env: Env, transaction_id: u64) -> MultiTokenTransaction {
        env.storage().instance()
            .get(&MultiTokenDataKey::Transaction(transaction_id))
            .unwrap_or_else(|| panic!("Transaction not found"))
    }

    /// Get token information
    pub fn get_token_info(env: Env, token_address: Address) -> Option<TokenInfo> {
        env.storage().instance().get(&MultiTokenDataKey::TokenInfo(token_address))
    }

    /// Get route details
    pub fn get_route(env: Env, route_id: u64) -> BridgeRoute {
        env.storage().instance()
            .get(&MultiTokenDataKey::Route(route_id))
            .unwrap_or_else(|| panic!("Route not found"))
    }

    /// Get token mapping
    pub fn get_token_mapping(env: Env, original_token: Address) -> Option<TokenMapping> {
        env.storage().instance().get(&MultiTokenDataKey::TokenMapping(original_token))
    }

    /// Get supported chains
    pub fn get_supported_chains(env: Env) -> Vec<u32> {
        env.storage().instance().get(&MultiTokenDataKey::SupportedChains).unwrap_or(Vec::new(&env))
    }

    /// Get total transaction count
    pub fn get_transaction_count(env: Env) -> u64 {
        env.storage().instance().get(&MultiTokenDataKey::TransactionCount).unwrap_or(0)
    }

    /// Get total volume
    pub fn get_total_volume(env: Env) -> u128 {
        env.storage().instance().get(&MultiTokenDataKey::TotalVolume).unwrap_or(0)
    }

    /// Get total fees
    pub fn get_total_fees(env: Env) -> u128 {
        env.storage().instance().get(&MultiTokenDataKey::TotalFees).unwrap_or(0)
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&MultiTokenDataKey::Admin).unwrap()
    }
}
