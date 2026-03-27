use soroban_sdk::{Address, Env, Bytes, i128, u64, Vec};
use crate::grantTreasury::{
    GrantTreasury, TreasuryConfig, InvestmentPosition, GrantAllocation, AllocationStatus, YieldRecord,
    DataKey
};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);

    GrantTreasury::initialize(
        env.clone(),
        admin.clone(),
        pool_address,
        2000, // 20% minimum liquidity
        1000i128, // Auto-invest threshold
        86400, // Claim yield daily
    );

    let config = GrantTreasury::get_treasury_config(env.clone());
    assert_eq!(config.admin, admin);
    assert_eq!(config.liquidity_pool_address, pool_address);
    assert_eq!(config.min_liquidity_ratio, 2000);
    assert_eq!(config.auto_invest_threshold, 1000i128);
    assert_eq!(config.yield_claim_frequency, 86400);

    assert_eq!(GrantTreasury::get_total_balance(env.clone()), 0i128);
    assert_eq!(GrantTreasury::get_available_balance(env.clone()), 0i128);
    assert_eq!(GrantTreasury::get_invested_balance(env.clone()), 0i128);
}

#[test]
fn test_deposit() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    GrantTreasury::deposit(env.clone(), depositor.clone(), 5000i128);

    assert_eq!(GrantTreasury::get_total_balance(env.clone()), 5000i128);
    assert_eq!(GrantTreasury::get_available_balance(env.clone()), 5000i128);
    assert_eq!(GrantTreasury::get_invested_balance(env.clone()), 0i128);
}

#[test]
fn test_auto_invest_on_deposit() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    // Deposit above threshold should trigger auto-invest
    GrantTreasury::deposit(env.clone(), depositor.clone(), 2000i128);

    assert_eq!(GrantTreasury::get_total_balance(env.clone()), 2000i128);
    // Half should be auto-invested
    assert!(GrantTreasury::get_invested_balance(env.clone()) > 0i128);
    assert!(GrantTreasury::get_available_balance(env.clone()) > 0i128);
}

#[test]
fn test_invest_idle_funds() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    GrantTreasury::deposit(env.clone(), depositor.clone(), 3000i128);
    
    let initial_available = GrantTreasury::get_available_balance(env.clone());
    let initial_invested = GrantTreasury::get_invested_balance(env.clone());

    GrantTreasury::invest_idle_funds(env.clone(), admin.clone(), 500i128);

    assert_eq!(GrantTreasury::get_available_balance(env.clone()), initial_available - 500i128);
    assert_eq!(GrantTreasury::get_invested_balance(env.clone()), initial_invested + 500i128);

    let positions = GrantTreasury::get_investment_positions(env.clone());
    assert_eq!(positions.len(), 1);
    assert_eq!(positions.get(0).unwrap().amount, 500i128);
}

#[test]
fn test_divest_funds() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    GrantTreasury::deposit(env.clone(), depositor.clone(), 3000i128);
    GrantTreasury::invest_idle_funds(env.clone(), admin.clone(), 500i128);

    let initial_available = GrantTreasury::get_available_balance(env.clone());
    let initial_invested = GrantTreasury::get_invested_balance(env.clone());

    GrantTreasury::divest_funds(env.clone(), admin.clone(), 200i128, 0);

    assert_eq!(GrantTreasury::get_available_balance(env.clone()), initial_available + 200i128);
    assert_eq!(GrantTreasury::get_invested_balance(env.clone()), initial_invested - 200i128);

    let positions = GrantTreasury::get_investment_positions(env.clone());
    assert_eq!(positions.get(0).unwrap().amount, 300i128); // 500 - 200
}

#[test]
fn test_minimum_liquidity_constraint() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);

    // Set high minimum liquidity (50%)
    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 5000, 1000i128, 86400);

    GrantTreasury::deposit(env.clone(), depositor.clone(), 2000i128);

    // Should fail because investing would breach minimum liquidity
    let result = std::panic::catch_unwind(|| {
        GrantTreasury::invest_idle_funds(env.clone(), admin.clone(), 1500i128);
    });
    assert!(result.is_err());
}

#[test]
fn test_allocate_grant() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);
    let grantee = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    GrantTreasury::deposit(env.clone(), depositor.clone(), 3000i128);

    GrantTreasury::allocate_grant(env.clone(), admin.clone(), grantee.clone(), 1000i128);

    let allocations = GrantTreasury::get_grant_allocations(env.clone());
    assert_eq!(allocations.len(), 1);
    
    let allocation = allocations.get(0).unwrap();
    assert_eq!(allocation.grantee, grantee);
    assert_eq!(allocation.amount, 1000i128);
    assert_eq!(allocation.status, AllocationStatus::Approved);

    assert_eq!(GrantTreasury::get_available_balance(env.clone()), 2000i128);
}

#[test]
fn test_withdraw_grant() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);
    let grantee = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    GrantTreasury::deposit(env.clone(), depositor.clone(), 3000i128);
    GrantTreasury::allocate_grant(env.clone(), admin.clone(), grantee.clone(), 1000i128);

    let initial_available = GrantTreasury::get_available_balance(env.clone());

    GrantTreasury::withdraw_grant(env.clone(), grantee.clone(), 0);

    assert_eq!(GrantTreasury::get_available_balance(env.clone()), initial_available - 1000i128);

    let allocations = GrantTreasury::get_grant_allocations(env.clone());
    assert_eq!(allocations.get(0).unwrap().status, AllocationStatus::Disbursed);
}

#[test]
fn test_ensure_liquidity_for_withdrawal() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);
    let grantee = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    GrantTreasury::deposit(env.clone(), depositor.clone(), 3000i128);
    GrantTreasury::invest_idle_funds(env.clone(), admin.clone(), 1000i128);

    // Allocate more than available balance
    GrantTreasury::allocate_grant(env.clone(), admin.clone(), grantee.clone(), 2500i128);

    // Should automatically divest to ensure liquidity
    GrantTreasury::withdraw_grant(env.clone(), grantee.clone(), 0);

    let allocations = GrantTreasury::get_grant_allocations(env.clone());
    assert_eq!(allocations.get(0).unwrap().status, AllocationStatus::Disbursed);
}

#[test]
fn test_claim_yield() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    GrantTreasury::deposit(env.clone(), depositor.clone(), 3000i128);
    GrantTreasury::invest_idle_funds(env.clone(), admin.clone(), 1000i128);

    let initial_available = GrantTreasury::get_available_balance(env.clone());

    // Simulate time passage for yield accumulation
    env.ledger().set_timestamp(env.ledger().timestamp() + 86400); // 1 day later

    GrantTreasury::claim_yield(env.clone(), admin.clone());

    assert!(GrantTreasury::get_available_balance(env.clone()) > initial_available);

    let yield_history = GrantTreasury::get_yield_history(env.clone());
    assert!(yield_history.len() > 0);
}

#[test]
fn test_yield_calculation() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    let position = InvestmentPosition {
        amount: 1000i128,
        pool_address: pool_address.clone(),
        invested_at: 0,
        last_yield_claim: 0,
        accumulated_yield: 0i128,
    };

    // Simulate 1 year of investment
    env.ledger().set_timestamp(365 * 24 * 60 * 60);

    let yield_amount = GrantTreasury::get_accumulated_yield(env.clone());
    
    // With 5% APY, 1000 lumens should generate 50 lumens in yield
    assert!(yield_amount >= 40i128 && yield_amount <= 60i128); // Allow some tolerance
}

#[test]
fn test_unauthorized_access() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    // Unauthorized investment should fail
    let result = std::panic::catch_unwind(|| {
        GrantTreasury::invest_idle_funds(env.clone(), unauthorized.clone(), 100i128);
    });
    assert!(result.is_err());

    // Unauthorized grant allocation should fail
    let result = std::panic::catch_unwind(|| {
        GrantTreasury::allocate_grant(env.clone(), unauthorized.clone(), admin.clone(), 100i128);
    });
    assert!(result.is_err());

    // Unauthorized yield claim should fail
    let result = std::panic::catch_unwind(|| {
        GrantTreasury::claim_yield(env.clone(), unauthorized.clone());
    });
    assert!(result.is_err());
}

#[test]
fn test_edge_cases() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    // Test zero amount deposit
    let result = std::panic::catch_unwind(|| {
        GrantTreasury::deposit(env.clone(), depositor.clone(), 0i128);
    });
    assert!(result.is_err());

    // Test negative amount deposit
    let result = std::panic::catch_unwind(|| {
        GrantTreasury::deposit(env.clone(), depositor.clone(), -100i128);
    });
    assert!(result.is_err());

    // Test invalid position index for divestment
    GrantTreasury::deposit(env.clone(), depositor.clone(), 1000i128);
    let result = std::panic::catch_unwind(|| {
        GrantTreasury::divest_funds(env.clone(), admin.clone(), 100i128, 0);
    });
    assert!(result.is_err());
}

#[test]
fn test_view_functions() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    GrantTreasury::deposit(env.clone(), depositor.clone(), 3000i128);
    GrantTreasury::invest_idle_funds(env.clone(), admin.clone(), 500i128);

    // Test view functions
    assert_eq!(GrantTreasury::get_total_balance(env.clone()), 3000i128);
    assert!(GrantTreasury::get_available_balance(env.clone()) > 0i128);
    assert_eq!(GrantTreasury::get_invested_balance(env.clone()), 500i128);
    assert_eq!(GrantTreasury::get_apy(env.clone()), 500); // 5% APY
    assert!(GrantTreasury::should_auto_invest(env.clone()));

    let positions = GrantTreasury::get_investment_positions(env.clone());
    assert_eq!(positions.len(), 1);

    let allocations = GrantTreasury::get_grant_allocations(env.clone());
    assert_eq!(allocations.len(), 0);

    let yield_history = GrantTreasury::get_yield_history(env.clone());
    assert_eq!(yield_history.len(), 0);
}

#[test]
fn test_multiple_investments() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    GrantTreasury::deposit(env.clone(), depositor.clone(), 5000i128);

    // Make multiple investments
    GrantTreasury::invest_idle_funds(env.clone(), admin.clone(), 1000i128);
    GrantTreasury::invest_idle_funds(env.clone(), admin.clone(), 500i128);

    let positions = GrantTreasury::get_investment_positions(env.clone());
    assert_eq!(positions.len(), 2);
    assert_eq!(positions.get(0).unwrap().amount, 1000i128);
    assert_eq!(positions.get(1).unwrap().amount, 500i128);
    assert_eq!(GrantTreasury::get_invested_balance(env.clone()), 1500i128);
}

#[test]
fn test_complete_lifecycle() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let pool_address = Address::generate(&env);
    let depositor = Address::generate(&env);
    let grantee = Address::generate(&env);

    GrantTreasury::initialize(env.clone(), admin.clone(), pool_address, 2000, 1000i128, 86400);

    // 1. Deposit funds
    GrantTreasury::deposit(env.clone(), depositor.clone(), 10000i128);
    assert_eq!(GrantTreasury::get_total_balance(env.clone()), 10000i128);

    // 2. Auto-invest should trigger
    assert!(GrantTreasury::get_invested_balance(env.clone()) > 0i128);

    // 3. Allocate grants
    GrantTreasury::allocate_grant(env.clone(), admin.clone(), grantee.clone(), 2000i128);
    
    // 4. Withdraw grant (should trigger divestment if needed)
    GrantTreasury::withdraw_grant(env.clone(), grantee.clone(), 0);

    // 5. Claim yield
    env.ledger().set_timestamp(env.ledger().timestamp() + 86400);
    GrantTreasury::claim_yield(env.clone(), admin.clone());

    // 6. Check final state
    assert!(GrantTreasury::get_available_balance(env.clone()) > 0i128);
    assert!(GrantTreasury::get_accumulated_yield(env.clone()) >= 0i128);

    let allocations = GrantTreasury::get_grant_allocations(env.clone());
    assert_eq!(allocations.get(0).unwrap().status, AllocationStatus::Disbursed);
}
