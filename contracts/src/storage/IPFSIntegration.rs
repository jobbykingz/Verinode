use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, String, Vec, Map, Symbol, Val};
use soroban_sdk::crypto::Hash;

#[contract]
pub struct IPFSIntegration;

#[derive(Clone, Debug)]
pub struct IPFSReference {
    pub cid: String,
    pub size: u64,
    pub hash: Hash,
    pub timestamp: u64,
    pub pin_status: bool,
}

#[derive(Clone, Debug)]
pub struct IPFSConfig {
    pub gateway_url: String,
    pub api_url: String,
    pub pin_timeout: u64,
    pub replication_factor: u32,
}

#[contractimpl]
impl IPFSIntegration {
    /// Initialize IPFS configuration
    pub fn initialize(env: Env, admin: Address, config: IPFSConfig) {
        let admin_key = Symbol::new(&env, "admin");
        env.storage().instance().set(&admin_key, &admin);
        
        let config_key = Symbol::new(&env, "ipfs_config");
        env.storage().instance().set(&config_key, &config);
        
        let storage_key = Symbol::new(&env, "ipfs_storage");
        let storage_map: Map<Address, Vec<IPFSReference>> = Map::new(&env);
        env.storage().instance().set(&storage_key, &storage_map);
        
        let stats_key = Symbol::new(&env, "ipfs_stats");
        let stats_map: Map<String, u64> = Map::new(&env);
        env.storage().instance().set(&stats_key, &stats_map);
    }

    /// Store data to IPFS and create reference
    pub fn store_data(env: Env, user: Address, data: Bytes, pin: bool) -> IPFSReference {
        // Verify user authorization
        user.require_auth();
        
        // Generate CID (simplified - in real implementation would use IPFS API)
        let cid = Self::generate_cid(&env, &data);
        let hash = env.crypto().sha256(&data);
        
        let reference = IPFSReference {
            cid: cid.clone(),
            size: data.len() as u64,
            hash,
            timestamp: env.ledger().timestamp(),
            pin_status: pin,
        };
        
        // Store reference in user's storage
        let storage_key = Symbol::new(&env, "ipfs_storage");
        let mut storage_map: Map<Address, Vec<IPFSReference>> = env.storage()
            .instance()
            .get(&storage_key)
            .unwrap_or_else(|| Map::new(&env));
        
        let user_refs = storage_map.get(user.clone())
            .unwrap_or_else(|| Vec::new(&env));
        let mut new_refs = user_refs;
        new_refs.push_back(reference.clone());
        storage_map.set(user, new_refs);
        env.storage().instance().set(&storage_key, &storage_map);
        
        // Update statistics
        Self::update_storage_stats(&env, "total_files", 1);
        Self::update_storage_stats(&env, "total_size", reference.size);
        
        // Pin if requested
        if pin {
            Self::pin_content(&env, &cid);
        }
        
        reference
    }

    /// Retrieve IPFS reference by CID
    pub fn get_reference(env: Env, user: Address, cid: String) -> Option<IPFSReference> {
        let storage_key = Symbol::new(&env, "ipfs_storage");
        let storage_map: Map<Address, Vec<IPFSReference>> = env.storage()
            .instance()
            .get(&storage_key)
            .unwrap_or_else(|| Map::new(&env));
        
        let user_refs = storage_map.get(user)?;
        
        for reference in user_refs.iter() {
            if reference.cid == cid {
                return Some(reference);
            }
        }
        
        None
    }

    /// List all IPFS references for a user
    pub fn list_references(env: Env, user: Address) -> Vec<IPFSReference> {
        let storage_key = Symbol::new(&env, "ipfs_storage");
        let storage_map: Map<Address, Vec<IPFSReference>> = env.storage()
            .instance()
            .get(&storage_key)
            .unwrap_or_else(|| Map::new(&env));
        
        storage_map.get(user).unwrap_or_else(|| Vec::new(&env))
    }

    /// Pin content to IPFS
    pub fn pin_content(env: Env, cid: &String) {
        let pin_key = Symbol::new(&env, "pinned_content");
        let mut pinned_set: Vec<String> = env.storage()
            .instance()
            .get(&pin_key)
            .unwrap_or_else(|| Vec::new(&env));
        
        if !pinned_set.contains(cid) {
            pinned_set.push_back(cid.clone());
            env.storage().instance().set(&pin_key, &pinned_set);
            
            Self::update_storage_stats(&env, "pinned_files", 1);
        }
    }

    /// Unpin content from IPFS
    pub fn unpin_content(env: Env, user: Address, cid: String) -> Result<(), String> {
        user.require_auth();
        
        // Update reference pin status
        let storage_key = Symbol::new(&env, "ipfs_storage");
        let mut storage_map: Map<Address, Vec<IPFSReference>> = env.storage()
            .instance()
            .get(&storage_key)
            .unwrap_or_else(|| Map::new(&env));
        
        let user_refs = storage_map.get(user.clone())
            .unwrap_or_else(|| Vec::new(&env));
        
        let mut updated_refs = Vec::new(&env);
        let mut found = false;
        
        for reference in user_refs.iter() {
            let mut ref_copy = reference.clone();
            if reference.cid == cid {
                ref_copy.pin_status = false;
                found = true;
            }
            updated_refs.push_back(ref_copy);
        }
        
        if !found {
            return Err("CID not found".into());
        }
        
        storage_map.set(user, updated_refs);
        env.storage().instance().set(&storage_key, &storage_map);
        
        // Remove from pinned set
        let pin_key = Symbol::new(&env, "pinned_content");
        let mut pinned_set: Vec<String> = env.storage()
            .instance()
            .get(&pin_key)
            .unwrap_or_else(|| Vec::new(&env));
        
        pinned_set = pinned_set.iter()
            .filter(|x| x != &cid)
            .collect();
        
        env.storage().instance().set(&pin_key, &pinned_set);
        Self::update_storage_stats(&env, "pinned_files", -1);
        
        Ok(())
    }

    /// Verify content integrity
    pub fn verify_content(env: Env, cid: String, expected_hash: Hash) -> bool {
        // In a real implementation, this would fetch from IPFS and verify
        // For now, we'll check if the stored reference matches
        let storage_key = Symbol::new(&env, "ipfs_storage");
        let storage_map: Map<Address, Vec<IPFSReference>> = env.storage()
            .instance()
            .get(&storage_key)
            .unwrap_or_else(|| Map::new(&env));
        
        for user_refs in storage_map.values() {
            for reference in user_refs.iter() {
                if reference.cid == cid {
                    return reference.hash == expected_hash;
                }
            }
        }
        
        false
    }

    /// Get storage statistics
    pub fn get_storage_stats(env: Env) -> Map<String, u64> {
        let stats_key = Symbol::new(&env, "ipfs_stats");
        env.storage()
            .instance()
            .get(&stats_key)
            .unwrap_or_else(|| Map::new(&env))
    }

    /// Generate CID from data (simplified implementation)
    fn generate_cid(env: &Env, data: &Bytes) -> String {
        let hash = env.crypto().sha256(data);
        format!("bafybeih{}", hex::encode(hash.to_array().as_slice())[..16].to_string())
    }

    /// Update storage statistics
    fn update_storage_stats(env: &Env, stat_name: &str, delta: i64) {
        let stats_key = Symbol::new(env, "ipfs_stats");
        let mut stats_map: Map<String, u64> = env.storage()
            .instance()
            .get(&stats_key)
            .unwrap_or_else(|| Map::new(env));
        
        let current = stats_map.get(String::from_str(env, stat_name)).unwrap_or(0);
        let new_value = if delta >= 0 {
            current.saturating_add(delta as u64)
        } else {
            current.saturating_sub((-delta) as u64)
        };
        
        stats_map.set(String::from_str(env, stat_name), new_value);
        env.storage().instance().set(&stats_key, &stats_map);
    }

    /// Check if content is pinned
    pub fn is_pinned(env: Env, cid: String) -> bool {
        let pin_key = Symbol::new(&env, "pinned_content");
        let pinned_set: Vec<String> = env.storage()
            .instance()
            .get(&pin_key)
            .unwrap_or_else(|| Vec::new(&env));
        
        pinned_set.contains(&cid)
    }

    /// Get configuration
    pub fn get_config(env: Env) -> IPFSConfig {
        let config_key = Symbol::new(&env, "ipfs_config");
        env.storage()
            .instance()
            .get(&config_key)
            .unwrap_or_else(|| IPFSConfig {
                gateway_url: String::from_str(&env, "https://ipfs.io"),
                api_url: String::from_str(&env, "https://api.ipfs.io"),
                pin_timeout: 3600,
                replication_factor: 3,
            })
    }

    /// Update configuration (admin only)
    pub fn update_config(env: Env, admin: Address, new_config: IPFSConfig) -> Result<(), String> {
        let admin_key = Symbol::new(&env, "admin");
        let stored_admin: Address = env.storage()
            .instance()
            .get(&admin_key)
            .ok_or("Admin not found")?;
        
        if admin != stored_admin {
            return Err("Unauthorized".into());
        }
        
        let config_key = Symbol::new(&env, "ipfs_config");
        env.storage().instance().set(&config_key, &new_config);
        
        Ok(())
    }
}
