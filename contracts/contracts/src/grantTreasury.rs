use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, i128, u64, Map, Vec as SorobanVec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TreasuryConfig {
    pub admin: Address,
    pub liquidity_pool_address: Address,
    pub min_liquidity_ratio: u32, // Minimum liquidity to keep available (in basis points, 10000 = 100%)
    pub auto_invest_threshold: i128, // Auto-invest when idle funds exceed this amount
    pub yield_claim_frequency: u64, // How often to claim yield (in seconds)
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvestmentPosition {
    pub amount: i128,
    pub pool_address: Address,
    pub invested_at: u64,
    pub last_yield_claim: u64,
    pub accumulated_yield: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GrantAllocation {
    pub grantee: Address,
    pub amount: i128,
    pub allocated_at: u64,
    pub status: AllocationStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AllocationStatus {
    Pending,
    Approved,
    Disbursed,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct YieldRecord {
    pub amount: i128,
    pub claimed_at: u64,
    pub pool_address: Address,
    pub apy: u32, // Annual Percentage Yield (in basis points)
}

#[contracttype]
pub enum DataKey {
    TreasuryConfig,
    TotalBalance,
    InvestedBalance,
    AvailableBalance,
    InvestmentPositions,
    GrantAllocations,
    YieldHistory,
    LastYieldClaim,
    YieldClaimCounter,
}

#[contract]
pub struct GrantTreasury;

#[contractimpl]
impl GrantTreasury {
    /// Initialize the treasury with configuration
    pub fn initialize(
        env: Env,
        admin: Address,
        liquidity_pool_address: Address,
        min_liquidity_ratio: u32,
        auto_invest_threshold: i128,
        yield_claim_frequency: u64,
    ) {
        if env.storage().instance().has(&DataKey::TreasuryConfig) {
            panic!("Treasury already initialized");
        }

        let config = TreasuryConfig {
            admin: admin.clone(),
            liquidity_pool_address,
            min_liquidity_ratio,
            auto_invest_threshold,
            yield_claim_frequency,
        };

        env.storage().instance().set(&DataKey::TreasuryConfig, &config);
        env.storage().instance().set(&DataKey::TotalBalance, &0i128);
        env.storage().instance().set(&DataKey::InvestedBalance, &0i128);
        env.storage().instance().set(&DataKey::AvailableBalance, &0i128);
        env.storage().instance().set(&DataKey::InvestmentPositions, &Vec::new(&env));
        env.storage().instance().set(&DataKey::GrantAllocations, &Vec::new(&env));
        env.storage().instance().set(&DataKey::YieldHistory, &Vec::new(&env));
        env.storage().instance().set(&DataKey::LastYieldClaim, &0u64);
        env.storage().instance().set(&DataKey::YieldClaimCounter, &0u64);
    }

    /// Deposit funds into the treasury
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let config: TreasuryConfig = env.storage().instance()
            .get(&DataKey::TreasuryConfig)
            .unwrap_or_else(|| panic!("Treasury not initialized"));

        // Update balances
        let mut total_balance: i128 = env.storage().instance()
            .get(&DataKey::TotalBalance)
            .unwrap_or(0i128);
        let mut available_balance: i128 = env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128);

        total_balance += amount;
        available_balance += amount;

        env.storage().instance().set(&DataKey::TotalBalance, &total_balance);
        env.storage().instance().set(&DataKey::AvailableBalance, &available_balance);

        // Auto-invest if threshold is met
        if available_balance >= config.auto_invest_threshold {
            Self::auto_invest_idle_funds(env);
        }
    }

    /// Invest idle funds in liquidity pool
    pub fn invest_idle_funds(env: Env, caller: Address, amount: i128) {
        caller.require_auth();
        
        let config: TreasuryConfig = env.storage().instance()
            .get(&DataKey::TreasuryConfig)
            .unwrap_or_else(|| panic!("Treasury not initialized"));

        if caller != config.admin {
            panic!("Only admin can invest funds");
        }

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let available_balance: i128 = env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128);

        if amount > available_balance {
            panic!("Insufficient available balance");
        }

        // Calculate minimum liquidity to maintain
        let min_liquidity = (total_balance(env) * config.min_liquidity_ratio as i128) / 10000i128;
        
        if (available_balance - amount) < min_liquidity {
            panic!("Investment would breach minimum liquidity requirement");
        }

        // Create investment position
        let position = InvestmentPosition {
            amount,
            pool_address: config.liquidity_pool_address,
            invested_at: env.ledger().timestamp(),
            last_yield_claim: env.ledger().timestamp(),
            accumulated_yield: 0i128,
        };

        let mut positions: Vec<InvestmentPosition> = env.storage().instance()
            .get(&DataKey::InvestmentPositions)
            .unwrap_or(Vec::new(&env));
        positions.push_back(position);
        env.storage().instance().set(&DataKey::InvestmentPositions, &positions);

        // Update balances
        let mut invested_balance: i128 = env.storage().instance()
            .get(&DataKey::InvestedBalance)
            .unwrap_or(0i128);
        invested_balance += amount;
        env.storage().instance().set(&DataKey::InvestedBalance, &invested_balance);

        available_balance -= amount;
        env.storage().instance().set(&DataKey::AvailableBalance, &available_balance);

        // In a real implementation, this would interact with the liquidity pool contract
        // For now, we simulate the investment
        env.logs().add(&format!("Invested {} lumens in liquidity pool", amount));
    }

    /// Divest funds from liquidity pool
    pub fn divest_funds(env: Env, caller: Address, amount: i128, position_index: u32) {
        caller.require_auth();
        
        let config: TreasuryConfig = env.storage().instance()
            .get(&DataKey::TreasuryConfig)
            .unwrap_or_else(|| panic!("Treasury not initialized"));

        if caller != config.admin {
            panic!("Only admin can divest funds");
        }

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let mut positions: Vec<InvestmentPosition> = env.storage().instance()
            .get(&DataKey::InvestmentPositions)
            .unwrap_or(Vec::new(&env));

        if position_index >= positions.len() {
            panic!("Invalid position index");
        }

        let mut position = positions.get(position_index).unwrap();
        
        if amount > position.amount {
            panic!("Cannot divest more than invested amount");
        }

        // Calculate yield before divesting
        let current_yield = Self::calculate_yield(env, &position);
        position.accumulated_yield += current_yield;

        // Update position
        position.amount -= amount;
        if position.amount == 0 {
            // Remove position if fully divested
            positions.remove(position_index);
        } else {
            positions.set(position_index, position);
        }

        env.storage().instance().set(&DataKey::InvestmentPositions, &positions);

        // Update balances
        let mut invested_balance: i128 = env.storage().instance()
            .get(&DataKey::InvestedBalance)
            .unwrap_or(0i128);
        invested_balance -= amount;
        env.storage().instance().set(&DataKey::InvestedBalance, &invested_balance);

        let mut available_balance: i128 = env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128);
        available_balance += amount + current_yield;
        env.storage().instance().set(&DataKey::AvailableBalance, &available_balance);

        env.logs().add(&format!("Divested {} lumens from liquidity pool", amount));
    }

    /// Allocate grant to grantee
    pub fn allocate_grant(env: Env, caller: Address, grantee: Address, amount: i128) {
        caller.require_auth();
        
        let config: TreasuryConfig = env.storage().instance()
            .get(&DataKey::TreasuryConfig)
            .unwrap_or_else(|| panic!("Treasury not initialized"));

        if caller != config.admin {
            panic!("Only admin can allocate grants");
        }

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let available_balance: i128 = env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128);

        // Ensure liquidity is available by divesting if necessary
        if amount > available_balance {
            let needed = amount - available_balance;
            Self::ensure_liquidity(env, needed);
        }

        // Create grant allocation
        let allocation = GrantAllocation {
            grantee: grantee.clone(),
            amount,
            allocated_at: env.ledger().timestamp(),
            status: AllocationStatus::Approved,
        };

        let mut allocations: Vec<GrantAllocation> = env.storage().instance()
            .get(&DataKey::GrantAllocations)
            .unwrap_or(Vec::new(&env));
        allocations.push_back(allocation);
        env.storage().instance().set(&DataKey::GrantAllocations, &allocations);

        // Update available balance
        available_balance -= amount;
        env.storage().instance().set(&DataKey::AvailableBalance, &available_balance);

        env.logs().add(&format!("Allocated {} lumens to grantee {}", amount, grantee));
    }

    /// Allow grantee to withdraw allocated funds
    pub fn withdraw_grant(env: Env, grantee: Address, allocation_id: u32) {
        grantee.require_auth();

        let mut allocations: Vec<GrantAllocation> = env.storage().instance()
            .get(&DataKey::GrantAllocations)
            .unwrap_or(Vec::new(&env));

        if allocation_id >= allocations.len() {
            panic!("Invalid allocation ID");
        }

        let mut allocation = allocations.get(allocation_id).unwrap();
        
        if allocation.grantee != grantee {
            panic!("Not authorized to withdraw this grant");
        }

        if allocation.status != AllocationStatus::Approved {
            panic!("Grant not available for withdrawal");
        }

        // Ensure liquidity is available by divesting if necessary
        let available_balance: i128 = env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128);

        if allocation.amount > available_balance {
            let needed = allocation.amount - available_balance;
            Self::ensure_liquidity(env, needed);
        }

        // Update allocation status
        allocation.status = AllocationStatus::Disbursed;
        allocations.set(allocation_id, allocation);
        env.storage().instance().set(&DataKey::GrantAllocations, &allocations);

        // Update available balance
        let mut available_balance: i128 = env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128);
        available_balance -= allocation.amount;
        env.storage().instance().set(&DataKey::AvailableBalance, &available_balance);

        env.logs().add(&format!("Grantee {} withdrew {} lumens", grantee, allocation.amount));
    }

    /// Claim yield from investments
    pub fn claim_yield(env: Env, caller: Address) {
        caller.require_auth();
        
        let config: TreasuryConfig = env.storage().instance()
            .get(&DataKey::TreasuryConfig)
            .unwrap_or_else(|| panic!("Treasury not initialized"));

        if caller != config.admin {
            panic!("Only admin can claim yield");
        }

        let mut positions: Vec<InvestmentPosition> = env.storage().instance()
            .get(&DataKey::InvestmentPositions)
            .unwrap_or(Vec::new(&env));

        let mut total_yield = 0i128;
        let current_time = env.ledger().timestamp();

        for (i, position) in positions.iter().enumerate() {
            let yield_amount = Self::calculate_yield(env, position);
            if yield_amount > 0 {
                total_yield += yield_amount;
                
                // Update position
                let mut updated_position = position.clone();
                updated_position.accumulated_yield += yield_amount;
                updated_position.last_yield_claim = current_time;
                positions.set(i as u32, updated_position);

                // Record yield
                let yield_record = YieldRecord {
                    amount: yield_amount,
                    claimed_at: current_time,
                    pool_address: position.pool_address,
                    apy: 500, // 5% APY (500 basis points)
                };

                let mut yield_history: Vec<YieldRecord> = env.storage().instance()
                    .get(&DataKey::YieldHistory)
                    .unwrap_or(Vec::new(&env));
                yield_history.push_back(yield_record);
                env.storage().instance().set(&DataKey::YieldHistory, &yield_history);
            }
        }

        env.storage().instance().set(&DataKey::InvestmentPositions, &positions);

        // Update available balance with claimed yield
        let mut available_balance: i128 = env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128);
        available_balance += total_yield;
        env.storage().instance().set(&DataKey::AvailableBalance, &available_balance);

        // Update last yield claim time
        env.storage().instance().set(&DataKey::LastYieldClaim, &current_time);

        // Increment yield claim counter
        let mut counter: u64 = env.storage().instance()
            .get(&DataKey::YieldClaimCounter)
            .unwrap_or(0u64);
        counter += 1;
        env.storage().instance().set(&DataKey::YieldClaimCounter, &counter);

        env.logs().add(&format!("Claimed {} lumens in yield", total_yield));
    }

    /// Auto-invest idle funds
    fn auto_invest_idle_funds(env: Env) {
        let config: TreasuryConfig = env.storage().instance()
            .get(&DataKey::TreasuryConfig)
            .unwrap_or_else(|| panic!("Treasury not initialized"));

        let available_balance: i128 = env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128);

        if available_balance >= config.auto_invest_threshold {
            let invest_amount = available_balance / 2; // Invest half of available funds
            Self::invest_idle_funds(env, config.admin, invest_amount);
        }
    }

    /// Ensure liquidity is available for withdrawals
    fn ensure_liquidity(env: Env, needed: i128) {
        let available_balance: i128 = env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128);

        if needed > 0 && needed > available_balance {
            let positions: Vec<InvestmentPosition> = env.storage().instance()
                .get(&DataKey::InvestmentPositions)
                .unwrap_or(Vec::new(&env));

            let mut remaining_needed = needed;
            let mut positions_to_update: Vec<InvestmentPosition> = Vec::new(&env);

            for position in positions.iter() {
                if remaining_needed <= 0 {
                    positions_to_update.push_back(position.clone());
                    continue;
                }

                let divest_amount = position.amount.min(remaining_needed);
                let yield_amount = Self::calculate_yield(env, position);
                
                remaining_needed -= divest_amount + yield_amount;

                if divest_amount < position.amount {
                    let mut updated_position = position.clone();
                    updated_position.amount -= divest_amount;
                    updated_position.accumulated_yield += yield_amount;
                    positions_to_update.push_back(updated_position);
                }
            }

            env.storage().instance().set(&DataKey::InvestmentPositions, &positions_to_update);

            // Update balances
            let mut invested_balance: i128 = env.storage().instance()
                .get(&DataKey::InvestedBalance)
                .unwrap_or(0i128);
            invested_balance -= (needed - remaining_needed);
            env.storage().instance().set(&DataKey::InvestedBalance, &invested_balance);

            let mut available_balance: i128 = env.storage().instance()
                .get(&DataKey::AvailableBalance)
                .unwrap_or(0i128);
            available_balance += needed;
            env.storage().instance().set(&DataKey::AvailableBalance, &available_balance);
        }
    }

    /// Calculate yield for an investment position
    fn calculate_yield(env: Env, position: &InvestmentPosition) -> i128 {
        let current_time = env.ledger().timestamp();
        let time_elapsed = current_time - position.last_yield_claim;
        
        // Simple yield calculation: 5% APY compounded continuously
        // yield = principal * (e^(rate * time) - 1)
        // For simplicity, we'll use a linear approximation
        let apy = 500; // 5% in basis points
        let seconds_per_year = 365u64 * 24u64 * 60u64 * 60u64;
        
        if time_elapsed == 0 {
            return 0i128;
        }

        let time_fraction = (time_elapsed as i128 * 10000i128) / seconds_per_year as i128;
        let yield_amount = (position.amount * apy as i128 * time_fraction) / (10000i128 * 10000i128);
        
        yield_amount
    }

    // View functions

    /// Get total treasury balance
    pub fn get_total_balance(env: Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::TotalBalance)
            .unwrap_or(0i128)
    }

    /// Get available balance
    pub fn get_available_balance(env: Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128)
    }

    /// Get invested balance
    pub fn get_invested_balance(env: Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::InvestedBalance)
            .unwrap_or(0i128)
    }

    /// Get all investment positions
    pub fn get_investment_positions(env: Env) -> Vec<InvestmentPosition> {
        env.storage().instance()
            .get(&DataKey::InvestmentPositions)
            .unwrap_or(Vec::new(&env))
    }

    /// Get all grant allocations
    pub fn get_grant_allocations(env: Env) -> Vec<GrantAllocation> {
        env.storage().instance()
            .get(&DataKey::GrantAllocations)
            .unwrap_or(Vec::new(&env))
    }

    /// Get yield history
    pub fn get_yield_history(env: Env) -> Vec<YieldRecord> {
        env.storage().instance()
            .get(&DataKey::YieldHistory)
            .unwrap_or(Vec::new(&env))
    }

    /// Get treasury configuration
    pub fn get_treasury_config(env: Env) -> TreasuryConfig {
        env.storage().instance()
            .get(&DataKey::TreasuryConfig)
            .unwrap_or_else(|| panic!("Treasury not initialized"))
    }

    /// Get accumulated yield
    pub fn get_accumulated_yield(env: Env) -> i128 {
        let positions: Vec<InvestmentPosition> = env.storage().instance()
            .get(&DataKey::InvestmentPositions)
            .unwrap_or(Vec::new(&env));
        
        let mut total_yield = 0i128;
        for position in positions.iter() {
            total_yield += position.accumulated_yield;
        }
        
        total_yield
    }

    /// Get APY (Annual Percentage Yield)
    pub fn get_apy(env: Env) -> u32 {
        500 // 5% APY (500 basis points)
    }

    /// Check if auto-investment is recommended
    pub fn should_auto_invest(env: Env) -> bool {
        let config: TreasuryConfig = env.storage().instance()
            .get(&DataKey::TreasuryConfig)
            .unwrap_or_else(|| panic!("Treasury not initialized"));

        let available_balance: i128 = env.storage().instance()
            .get(&DataKey::AvailableBalance)
            .unwrap_or(0i128);

        available_balance >= config.auto_invest_threshold
    }
}

// Helper function to get total balance
fn total_balance(env: Env) -> i128 {
    env.storage().instance()
        .get(&DataKey::TotalBalance)
        .unwrap_or(0i128)
}
