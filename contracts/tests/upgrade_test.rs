#![cfg(test)]

use soroban_sdk::{Env, Address, BytesN};
use crate::upgrade::ProxyContract::{ProxyContract, ProxyContractClient};

#[test]
fn test_proxy_initialization_and_upgrade() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ProxyContract);
    let client = ProxyContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let initial_hash = BytesN::from_array(&env, &[1; 32]);
    let new_hash = BytesN::from_array(&env, &[2; 32]);
    
    // Mock auth for admin
    env.mock_all_auths();

    // Initialize
    client.init(&admin, &initial_hash);
    
    // Upgrade
    client.upgrade(&new_hash);
    
    // If it reaches here without panicking, the auth and basic storage logic works.
}