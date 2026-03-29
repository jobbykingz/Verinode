#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Symbol, Map};

#[contract]
pub struct UpgradeManager;

#[contractimpl]
impl UpgradeManager {
    /// Register a proxy contract and its admin for centralized management
    pub fn register_proxy(env: Env, admin: Address, proxy_address: Address) {
        admin.require_auth();
        let mut proxies: Map<Address, Address> = env.storage().instance()
            .get(&Symbol::new(&env, "proxies")).unwrap_or(Map::new(&env));
        
        proxies.set(proxy_address, admin);
        env.storage().instance().set(&Symbol::new(&env, "proxies"), &proxies);
    }

    /// Log an upgrade event centrally
    pub fn log_upgrade(env: Env, proxy_address: Address, old_hash: BytesN<32>, new_hash: BytesN<32>) {
        // Ensure caller is the registered admin of the proxy
        let proxies: Map<Address, Address> = env.storage().instance().get(&Symbol::new(&env, "proxies")).unwrap();
        let admin = proxies.get(proxy_address.clone()).expect("Proxy not registered");
        admin.require_auth();

        env.events().publish(
            (Symbol::new(&env, "contract_upgraded"), proxy_address),
            (old_hash, new_hash)
        );
    }

    pub fn log_rollback(env: Env, proxy_address: Address, restored_hash: BytesN<32>) {
        let proxies: Map<Address, Address> = env.storage().instance().get(&Symbol::new(&env, "proxies")).unwrap();
        let admin = proxies.get(proxy_address.clone()).expect("Proxy not registered");
        admin.require_auth();

        env.events().publish(
            (Symbol::new(&env, "contract_rolled_back"), proxy_address),
            restored_hash
        );
    }
}