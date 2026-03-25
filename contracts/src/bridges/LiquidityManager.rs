#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, U256, u128, i128};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LiquidityPool {
    pub pool_id: u64,
    pub token_a: Address,
    pub token_b: Address,
    pub reserve_a: u128,
    pub reserve_b: u128,
    pub total_liquidity: u128,
    pub fee_rate: u32,
    pub active: bool,
    pub created_at: u64,
    pub last_updated: u64,
    pub apr: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LiquidityPosition {
    pub position_id: u64,
    pub user: Address,
    pub pool_id: u64,
    pub liquidity_amount: u128,
    pub token_a_amount: u128,
    pub token_b_amount: u128,
    pub rewards_earned: u128,
    pub created_at: u64,
    pub last_claimed: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LiquidityReward {
    pub reward_id: u64,
    pub pool_id: u64,
    pub user: Address,
    pub amount: u128,
    pub reward_type: RewardType,
    pub created_at: u64,
    pub claimed: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RewardType {
    TradingFee,
    LiquidityMining,
    Bonus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenPrice {
    pub token: Address,
    pub price: u128,
    pub timestamp: u64,
    pub chain_id: u32,
}

#[contracttype]
pub enum LiquidityDataKey {
    Pool(u64),
    Position(u64),
    Reward(u64),
    TokenPrice(Address),
    PoolCount,
    PositionCount,
    RewardCount,
    SupportedTokens,
    Admin,
    Paused,
    TotalLiquidity,
    TotalVolume24h,
    FeeCollector,
}

#[contract]
pub struct LiquidityManager;

#[contractimpl]
impl LiquidityManager {
    /// Initialize the liquidity manager
    pub fn initialize(env: Env, admin: Address, fee_collector: Address) {
        if env.storage().instance().has(&LiquidityDataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&LiquidityDataKey::Admin, &admin);
        env.storage().instance().set(&LiquidityDataKey::FeeCollector, &fee_collector);
        env.storage().instance().set(&LiquidityDataKey::PoolCount, &0u64);
        env.storage().instance().set(&LiquidityDataKey::PositionCount, &0u64);
        env.storage().instance().set(&LiquidityDataKey::RewardCount, &0u64);
        env.storage().instance().set(&LiquidityDataKey::Paused, &false);
        env.storage().instance().set(&LiquidityDataKey::TotalLiquidity, &0u128);
        env.storage().instance().set(&LiquidityDataKey::TotalVolume24h, &0u128);
        
        // Initialize supported tokens
        let mut supported_tokens = Vec::new(&env);
        supported_tokens.push_back(Address::from_string(&String::from_str(&env, "WETH")));
        supported_tokens.push_back(Address::from_string(&String::from_str(&env, "WMATIC")));
        supported_tokens.push_back(Address::from_string(&String::from_str(&env, "WBNB")));
        supported_tokens.push_back(Address::from_string(&String::from_str(&env, "USDC")));
        supported_tokens.push_back(Address::from_string(&String::from_str(&env, "USDT")));
        env.storage().instance().set(&LiquidityDataKey::SupportedTokens, &supported_tokens);
    }

    /// Create a new liquidity pool
    pub fn create_pool(
        env: Env,
        admin: Address,
        token_a: Address,
        token_b: Address,
        fee_rate: u32,
    ) -> u64 {
        let stored_admin: Address = env.storage().instance()
            .get(&LiquidityDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        // Check if tokens are supported
        let supported_tokens = Self::get_supported_tokens(env.clone());
        if !supported_tokens.contains(&token_a) || !supported_tokens.contains(&token_b) {
            panic!("Token not supported");
        }
        
        if token_a == token_b {
            panic!("Cannot create pool with same token");
        }
        
        let count: u64 = env.storage().instance().get(&LiquidityDataKey::PoolCount).unwrap_or(0);
        let pool_id = count + 1;
        
        let pool = LiquidityPool {
            pool_id,
            token_a: token_a.clone(),
            token_b: token_b.clone(),
            reserve_a: 0u128,
            reserve_b: 0u128,
            total_liquidity: 0u128,
            fee_rate,
            active: true,
            created_at: env.ledger().timestamp(),
            last_updated: env.ledger().timestamp(),
            apr: 0u32,
        };
        
        env.storage().instance().set(&LiquidityDataKey::Pool(pool_id), &pool);
        env.storage().instance().set(&LiquidityDataKey::PoolCount, &pool_id);
        
        pool_id
    }

    /// Add liquidity to a pool
    pub fn add_liquidity(
        env: Env,
        pool_id: u64,
        user: Address,
        amount_a: u128,
        amount_b: u128,
        min_liquidity: u128,
    ) -> u64 {
        if Self::is_paused(env.clone()) {
            panic!("Contract is paused");
        }
        
        user.require_auth();
        
        let mut pool: LiquidityPool = env.storage().instance()
            .get(&LiquidityDataKey::Pool(pool_id))
            .unwrap_or_else(|| panic!("Pool not found"));
        
        if !pool.active {
            panic!("Pool not active");
        }
        
        let liquidity = if pool.total_liquidity == 0 {
            // First liquidity provider - set initial prices
            amount_a.min(amount_b)
        } else {
            // Calculate optimal amount based on current ratio
            let optimal_amount_b = (amount_a * pool.reserve_b) / pool.reserve_a;
            let liquidity_amount = (amount_a * pool.total_liquidity) / pool.reserve_a;
            
            if amount_b < optimal_amount_b {
                panic!("Insufficient amount_b");
            }
            
            liquidity_amount
        };
        
        if liquidity < min_liquidity {
            panic!("Insufficient liquidity");
        }
        
        // Update pool reserves
        pool.reserve_a += amount_a;
        pool.reserve_b += amount_b;
        pool.total_liquidity += liquidity;
        pool.last_updated = env.ledger().timestamp();
        
        env.storage().instance().set(&LiquidityDataKey::Pool(pool_id), &pool);
        
        // Create liquidity position
        let position_count: u64 = env.storage().instance().get(&LiquidityDataKey::PositionCount).unwrap_or(0);
        let position_id = position_count + 1;
        
        let position = LiquidityPosition {
            position_id,
            user: user.clone(),
            pool_id,
            liquidity_amount: liquidity,
            token_a_amount: amount_a,
            token_b_amount: amount_b,
            rewards_earned: 0u128,
            created_at: env.ledger().timestamp(),
            last_claimed: env.ledger().timestamp(),
        };
        
        env.storage().instance().set(&LiquidityDataKey::Position(position_id), &position);
        env.storage().instance().set(&LiquidityDataKey::PositionCount, &position_id);
        
        // Update total liquidity
        let mut total_liquidity: u128 = env.storage().instance().get(&LiquidityDataKey::TotalLiquidity).unwrap_or(0);
        total_liquidity += liquidity;
        env.storage().instance().set(&LiquidityDataKey::TotalLiquidity, &total_liquidity);
        
        position_id
    }

    /// Remove liquidity from a pool
    pub fn remove_liquidity(
        env: Env,
        position_id: u64,
        user: Address,
        liquidity_amount: u128,
    ) -> (u128, u128) {
        if Self::is_paused(env.clone()) {
            panic!("Contract is paused");
        }
        
        user.require_auth();
        
        let mut position: LiquidityPosition = env.storage().instance()
            .get(&LiquidityDataKey::Position(position_id))
            .unwrap_or_else(|| panic!("Position not found"));
        
        if position.user != user {
            panic!("Not position owner");
        }
        
        if position.liquidity_amount < liquidity_amount {
            panic!("Insufficient liquidity");
        }
        
        let pool: LiquidityPool = env.storage().instance()
            .get(&LiquidityDataKey::Pool(position.pool_id))
            .unwrap_or_else(|| panic!("Pool not found"));
        
        // Calculate token amounts based on liquidity share
        let token_a_amount = (liquidity_amount * pool.reserve_a) / pool.total_liquidity;
        let token_b_amount = (liquidity_amount * pool.reserve_b) / pool.total_liquidity;
        
        // Update position
        position.liquidity_amount -= liquidity_amount;
        env.storage().instance().set(&LiquidityDataKey::Position(position_id), &position);
        
        // Update pool reserves
        let mut updated_pool = pool;
        updated_pool.reserve_a -= token_a_amount;
        updated_pool.reserve_b -= token_b_amount;
        updated_pool.total_liquidity -= liquidity_amount;
        updated_pool.last_updated = env.ledger().timestamp();
        
        env.storage().instance().set(&LiquidityDataKey::Pool(position.pool_id), &updated_pool);
        
        // Update total liquidity
        let mut total_liquidity: u128 = env.storage().instance().get(&LiquidityDataKey::TotalLiquidity).unwrap_or(0);
        total_liquidity -= liquidity_amount;
        env.storage().instance().set(&LiquidityDataKey::TotalLiquidity, &total_liquidity);
        
        (token_a_amount, token_b_amount)
    }

    /// Swap tokens through a liquidity pool
    pub fn swap(
        env: Env,
        pool_id: u64,
        user: Address,
        token_in: Address,
        amount_in: u128,
        min_amount_out: u128,
    ) -> u128 {
        if Self::is_paused(env.clone()) {
            panic!("Contract is paused");
        }
        
        user.require_auth();
        
        let mut pool: LiquidityPool = env.storage().instance()
            .get(&LiquidityDataKey::Pool(pool_id))
            .unwrap_or_else(|| panic!("Pool not found"));
        
        if !pool.active {
            panic!("Pool not active");
        }
        
        // Determine output token
        let (token_out, reserve_in, reserve_out) = if token_in == pool.token_a {
            (pool.token_b.clone(), pool.reserve_a, pool.reserve_b)
        } else if token_in == pool.token_b {
            (pool.token_a.clone(), pool.reserve_b, pool.reserve_a)
        } else {
            panic!("Invalid input token");
        };
        
        // Calculate output amount using constant product formula
        let amount_in_with_fee = amount_in * (10000 - pool.fee_rate);
        let numerator = amount_in_with_fee * reserve_out;
        let denominator = (reserve_in * 10000) + amount_in_with_fee;
        let amount_out = numerator / denominator;
        
        if amount_out < min_amount_out {
            panic!("Insufficient output amount");
        }
        
        if amount_out >= reserve_out {
            panic!("Insufficient liquidity");
        }
        
        // Update pool reserves
        if token_in == pool.token_a {
            pool.reserve_a += amount_in;
            pool.reserve_b -= amount_out;
        } else {
            pool.reserve_b += amount_in;
            pool.reserve_a -= amount_out;
        }
        
        pool.last_updated = env.ledger().timestamp();
        env.storage().instance().set(&LiquidityDataKey::Pool(pool_id), &pool);
        
        // Update 24h volume
        let mut volume_24h: u128 = env.storage().instance().get(&LiquidityDataKey::TotalVolume24h).unwrap_or(0);
        volume_24h += amount_in;
        env.storage().instance().set(&LiquidityDataKey::TotalVolume24h, &volume_24h);
        
        // Distribute trading fees to liquidity providers
        Self::distribute_trading_fees(env.clone(), pool_id, amount_in * pool.fee_rate as u128 / 10000);
        
        amount_out
    }

    /// Distribute trading fees to liquidity providers
    fn distribute_trading_fees(env: Env, pool_id: u64, fee_amount: u128) {
        let pool: LiquidityPool = env.storage().instance()
            .get(&LiquidityDataKey::Pool(pool_id))
            .unwrap_or_else(|| panic!("Pool not found"));
        
        if pool.total_liquidity == 0 {
            return;
        }
        
        // Create reward for fee collector
        let fee_collector: Address = env.storage().instance()
            .get(&LiquidityDataKey::FeeCollector)
            .unwrap();
        
        let reward_count: u64 = env.storage().instance().get(&LiquidityDataKey::RewardCount).unwrap_or(0);
        let reward_id = reward_count + 1;
        
        let reward = LiquidityReward {
            reward_id,
            pool_id,
            user: fee_collector,
            amount: fee_amount,
            reward_type: RewardType::TradingFee,
            created_at: env.ledger().timestamp(),
            claimed: false,
        };
        
        env.storage().instance().set(&LiquidityDataKey::Reward(reward_id), &reward);
        env.storage().instance().set(&LiquidityDataKey::RewardCount, &reward_id);
    }

    /// Claim rewards
    pub fn claim_rewards(env: Env, user: Address, reward_ids: Vec<u64>) -> u128 {
        user.require_auth();
        
        let mut total_claimed = 0u128;
        
        for reward_id in reward_ids.iter() {
            let mut reward: LiquidityReward = env.storage().instance()
                .get(&LiquidityDataKey::Reward(*reward_id))
                .unwrap_or_else(|| panic!("Reward not found"));
            
            if reward.user != user || reward.claimed {
                continue;
            }
            
            reward.claimed = true;
            total_claimed += reward.amount;
            
            env.storage().instance().set(&LiquidityDataKey::Reward(*reward_id), &reward);
        }
        
        total_claimed
    }

    /// Update token price
    pub fn update_token_price(env: Env, admin: Address, token: Address, price: u128, chain_id: u32) {
        let stored_admin: Address = env.storage().instance()
            .get(&LiquidityDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let token_price = TokenPrice {
            token: token.clone(),
            price,
            timestamp: env.ledger().timestamp(),
            chain_id,
        };
        
        env.storage().instance().set(&LiquidityDataKey::TokenPrice(token), &token_price);
    }

    /// Calculate APR for a pool
    pub fn calculate_apr(env: Env, pool_id: u64) -> u32 {
        let pool: LiquidityPool = env.storage().instance()
            .get(&LiquidityDataKey::Pool(pool_id))
            .unwrap_or_else(|| panic!("Pool not found"));
        
        if pool.total_liquidity == 0 {
            return 0;
        }
        
        let volume_24h: u128 = env.storage().instance().get(&LiquidityDataKey::TotalVolume24h).unwrap_or(0);
        let daily_fees = (volume_24h * pool.fee_rate as u128) / 10000;
        let yearly_fees = daily_fees * 365;
        
        ((yearly_fees * 10000) / pool.total_liquidity) as u32
    }

    /// Emergency pause/unpause
    pub fn set_pause(env: Env, admin: Address, paused: bool) {
        let stored_admin: Address = env.storage().instance()
            .get(&LiquidityDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        env.storage().instance().set(&LiquidityDataKey::Paused, &paused);
    }

    /// Check if contract is paused
    fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&LiquidityDataKey::Paused).unwrap_or(false)
    }

    /// Get pool details
    pub fn get_pool(env: Env, pool_id: u64) -> LiquidityPool {
        env.storage().instance()
            .get(&LiquidityDataKey::Pool(pool_id))
            .unwrap_or_else(|| panic!("Pool not found"))
    }

    /// Get position details
    pub fn get_position(env: Env, position_id: u64) -> LiquidityPosition {
        env.storage().instance()
            .get(&LiquidityDataKey::Position(position_id))
            .unwrap_or_else(|| panic!("Position not found"))
    }

    /// Get reward details
    pub fn get_reward(env: Env, reward_id: u64) -> LiquidityReward {
        env.storage().instance()
            .get(&LiquidityDataKey::Reward(reward_id))
            .unwrap_or_else(|| panic!("Reward not found"))
    }

    /// Get supported tokens
    pub fn get_supported_tokens(env: Env) -> Vec<Address> {
        env.storage().instance().get(&LiquidityDataKey::SupportedTokens).unwrap_or(Vec::new(&env))
    }

    /// Get pool count
    pub fn get_pool_count(env: Env) -> u64 {
        env.storage().instance().get(&LiquidityDataKey::PoolCount).unwrap_or(0)
    }

    /// Get total liquidity
    pub fn get_total_liquidity(env: Env) -> u128 {
        env.storage().instance().get(&LiquidityDataKey::TotalLiquidity).unwrap_or(0)
    }

    /// Get 24h volume
    pub fn get_volume_24h(env: Env) -> u128 {
        env.storage().instance().get(&LiquidityDataKey::TotalVolume24h).unwrap_or(0)
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&LiquidityDataKey::Admin).unwrap()
    }
}
