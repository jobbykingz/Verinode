#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Symbol, Vec, Val};

#[contract]
pub struct ProxyContract;

#[contractimpl]
impl ProxyContract {
    /// Initializes the proxy with an admin and the initial implementation WASM hash
    pub fn init(env: Env, admin: Address, wasm_hash: BytesN<32>) {
        assert!(!env.storage().instance().has(&Symbol::new(&env, "admin")), "Already initialized");
        env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
        env.storage().instance().set(&Symbol::new(&env, "impl_hash"), &wasm_hash);
        env.deployer().update_current_contract_wasm(wasm_hash);
    }

    /// Upgrades the contract to a new implementation WASM hash (Zero-downtime)
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&Symbol::new(&env, "admin")).unwrap();
        admin.require_auth();
        
        let current_hash: BytesN<32> = env.storage().instance().get(&Symbol::new(&env, "impl_hash")).unwrap();
        
        // Store previous hash for rollback capability
        env.storage().instance().set(&Symbol::new(&env, "prev_hash"), &current_hash);
        env.storage().instance().set(&Symbol::new(&env, "impl_hash"), &new_wasm_hash);
        
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Rolls back the contract to the previous implementation
    pub fn rollback(env: Env) {
        let admin: Address = env.storage().instance().get(&Symbol::new(&env, "admin")).unwrap();
        admin.require_auth();

        let prev_hash: BytesN<32> = env.storage().instance().get(&Symbol::new(&env, "prev_hash")).expect("No previous implementation found");
        
        env.storage().instance().set(&Symbol::new(&env, "impl_hash"), &prev_hash);
        env.deployer().update_current_contract_wasm(prev_hash);
    }
}