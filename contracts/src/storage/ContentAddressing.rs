use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, String, Vec, Map, Symbol, Val};
use soroban_sdk::crypto::Hash;

#[contract]
pub struct ContentAddressing;

#[derive(Clone, Debug)]
pub struct ContentIdentifier {
    pub cid: String,
    pub hash_function: String,
    pub hash_digest: Hash,
    pub codec: String,
    pub multihash: String,
    pub version: u32,
}

#[derive(Clone, Debug)]
pub struct ContentMetadata {
    pub content_id: ContentIdentifier,
    pub size: u64,
    pub mime_type: String,
    pub created_at: u64,
    pub modified_at: u64,
    pub checksum: Hash,
    pub encryption: Option<String>,
    pub compression: Option<String>,
}

#[derive(Clone, Debug)]
pub struct AddressingConfig {
    pub default_hash_function: String,
    pub default_codec: String,
    pub enable_versioning: bool,
    pub enable_deduplication: bool,
    pub checksum_verification: bool,
}

#[derive(Clone, Debug)]
pub struct ContentVersion {
    pub version_id: u32,
    pub content_id: ContentIdentifier,
    pub parent_version: Option<u32>,
    pub change_description: String,
    pub created_at: u64,
    pub size_delta: i64,
}

#[contractimpl]
impl ContentAddressing {
    /// Initialize Content Addressing system
    pub fn initialize(env: Env, admin: Address, config: AddressingConfig) {
        let admin_key = Symbol::new(&env, "admin");
        env.storage().instance().set(&admin_key, &admin);
        
        let config_key = Symbol::new(&env, "addressing_config");
        env.storage().instance().set(&config_key, &config);
        
        let content_key = Symbol::new(&env, "content_registry");
        let content_map: Map<String, ContentMetadata> = Map::new(&env);
        env.storage().instance().set(&content_key, &content_map);
        
        let versions_key = Symbol::new(&env, "content_versions");
        let versions_map: Map<String, Vec<ContentVersion>> = Map::new(&env);
        env.storage().instance().set(&versions_key, &versions_map);
        
        let dedup_key = Symbol::new(&env, "deduplication_map");
        let dedup_map: Map<Hash, String> = Map::new(&env);
        env.storage().instance().set(&dedup_key, &dedup_map);
        
        let stats_key = Symbol::new(&env, "addressing_stats");
        let stats_map: Map<String, u64> = Map::new(&env);
        env.storage().instance().set(&stats_key, &stats_map);
    }

    /// Generate content identifier for data
    pub fn generate_content_id(env: Env, data: Bytes, mime_type: String) -> ContentIdentifier {
        let config = Self::get_config(&env);
        
        // Generate hash based on configured hash function
        let hash = Self::hash_content(&env, &data, &config.default_hash_function);
        let multihash = Self::encode_multihash(&env, &hash, &config.default_hash_function);
        
        // Generate CID using configured codec
        let cid = Self::encode_cid(&env, &hash, &config.default_codec, 1);
        
        ContentIdentifier {
            cid: cid.clone(),
            hash_function: config.default_hash_function,
            hash_digest: hash,
            codec: config.default_codec,
            multihash,
            version: 1,
        }
    }

    /// Register content with metadata
    pub fn register_content(env: Env, user: Address, data: Bytes, mime_type: String, encryption: Option<String>, compression: Option<String>) -> ContentMetadata {
        user.require_auth();
        
        let config = Self::get_config(&env);
        let content_id = Self::generate_content_id(env.clone(), data.clone(), mime_type.clone());
        let checksum = env.crypto().sha256(&data);
        
        // Check for duplicates if deduplication is enabled
        if config.enable_deduplication {
            if let Some(existing_cid) = Self::check_duplicate(&env, checksum) {
                return Self::get_content_metadata(&env, existing_cid).unwrap_or_else(|| ContentMetadata {
                    content_id,
                    size: data.len() as u64,
                    mime_type,
                    created_at: env.ledger().timestamp(),
                    modified_at: env.ledger().timestamp(),
                    checksum,
                    encryption,
                    compression,
                });
            }
        }
        
        let metadata = ContentMetadata {
            content_id: content_id.clone(),
            size: data.len() as u64,
            mime_type: mime_type.clone(),
            created_at: env.ledger().timestamp(),
            modified_at: env.ledger().timestamp(),
            checksum,
            encryption,
            compression,
        };
        
        // Register content
        Self::store_content_metadata(&env, content_id.cid.clone(), metadata.clone());
        
        // Update deduplication map if enabled
        if config.enable_deduplication {
            Self::update_deduplication_map(&env, checksum, content_id.cid.clone());
        }
        
        // Update statistics
        Self::update_stats(&env, "total_content", 1);
        Self::update_stats(&env, "total_size", data.len() as u64);
        
        metadata
    }

    /// Create new version of content
    pub fn create_version(env: Env, user: Address, parent_cid: String, new_data: Bytes, change_description: String) -> ContentVersion {
        user.require_auth();
        
        let config = Self::get_config(&env);
        
        if !config.enable_versioning {
            panic!("Versioning is not enabled");
        }
        
        // Generate new content ID
        let new_content_id = Self::generate_content_id(env.clone(), new_data.clone(), String::from_str(&env, "application/octet-stream"));
        
        // Get parent versions
        let versions_key = Symbol::new(&env, "content_versions");
        let mut versions_map: Map<String, Vec<ContentVersion>> = env.storage()
            .instance()
            .get(&versions_key)
            .unwrap_or_else(|| Map::new(&env));
        
        let parent_versions = versions_map.get(parent_cid.clone())
            .unwrap_or_else(|| Vec::new(&env));
        
        // Determine new version number
        let new_version_id = parent_versions.len() as u32 + 1;
        
        // Calculate size delta
        let parent_metadata = Self::get_content_metadata(&env, parent_cid.clone())
            .unwrap_or_else(|| ContentMetadata {
                content_id: new_content_id.clone(),
                size: 0,
                mime_type: String::from_str(&env, "application/octet-stream"),
                created_at: env.ledger().timestamp(),
                modified_at: env.ledger().timestamp(),
                checksum: Hash::from_array([0; 32]),
                encryption: None,
                compression: None,
            });
        
        let size_delta = new_data.len() as i64 - parent_metadata.size as i64;
        
        let version = ContentVersion {
            version_id: new_version_id,
            content_id: new_content_id,
            parent_version: Some(new_version_id - 1),
            change_description,
            created_at: env.ledger().timestamp(),
            size_delta,
        };
        
        // Store new version
        let mut new_versions = parent_versions;
        new_versions.push_back(version.clone());
        versions_map.set(parent_cid, new_versions);
        env.storage().instance().set(&versions_key, &versions_map);
        
        version
    }

    /// Get content metadata by CID
    pub fn get_content_metadata(env: Env, cid: String) -> Option<ContentMetadata> {
        let content_key = Symbol::new(&env, "content_registry");
        let content_map: Map<String, ContentMetadata> = env.storage()
            .instance()
            .get(&content_key)
            .unwrap_or_else(|| Map::new(&env));
        
        content_map.get(cid)
    }

    /// Get content versions
    pub fn get_content_versions(env: Env, cid: String) -> Vec<ContentVersion> {
        let versions_key = Symbol::new(&env, "content_versions");
        let versions_map: Map<String, Vec<ContentVersion>> = env.storage()
            .instance()
            .get(&versions_key)
            .unwrap_or_else(|| Map::new(&env));
        
        versions_map.get(cid).unwrap_or_else(|| Vec::new(&env))
    }

    /// Verify content integrity
    pub fn verify_content_integrity(env: Env, cid: String, data: Bytes) -> bool {
        let metadata = match Self::get_content_metadata(env.clone(), cid.clone()) {
            Some(meta) => meta,
            None => return false,
        };
        
        let config = Self::get_config(&env);
        
        if config.checksum_verification {
            let calculated_checksum = env.crypto().sha256(&data);
            if calculated_checksum != metadata.checksum {
                return false;
            }
        }
        
        // Verify CID matches content
        let expected_content_id = Self::generate_content_id(env, data, metadata.mime_type);
        expected_content_id.cid == cid
    }

    /// Resolve content identifier to hash
    pub fn resolve_cid(env: Env, cid: String) -> Option<Hash> {
        let metadata = Self::get_content_metadata(env, cid)?;
        Some(metadata.content_id.hash_digest)
    }

    /// Find duplicate content
    pub fn find_duplicates(env: Env) -> Vec<(String, String)> {
        let dedup_key = Symbol::new(&env, "deduplication_map");
        let dedup_map: Map<Hash, String> = env.storage()
            .instance()
            .get(&dedup_key)
            .unwrap_or_else(|| Map::new(&env));
        
        let mut duplicates = Vec::new(&env);
        let mut seen_hashes = Map::new(&env);
        
        for (hash, cid) in dedup_map.iter() {
            if seen_hash.contains_key(hash) {
                duplicates.push_back((seen_hashes.get(hash).unwrap().clone(), cid));
            } else {
                seen_hashes.set(hash, cid);
            }
        }
        
        duplicates
    }

    /// Get addressing statistics
    pub fn get_stats(env: Env) -> Map<String, u64> {
        let stats_key = Symbol::new(&env, "addressing_stats");
        env.storage()
            .instance()
            .get(&stats_key)
            .unwrap_or_else(|| Map::new(&env))
    }

    /// Hash content using specified function
    fn hash_content(env: &Env, data: &Bytes, hash_function: &String) -> Hash {
        match hash_function.to_string().as_str() {
            "sha256" => env.crypto().sha256(data),
            "sha1" => {
                // Simplified SHA1 implementation (would use proper crypto in production)
                let sha256_hash = env.crypto().sha256(data);
                sha256_hash // For demonstration, using SHA256 as placeholder
            },
            _ => env.crypto().sha256(data), // Default to SHA256
        }
    }

    /// Encode multihash format
    fn encode_multihash(env: &Env, hash: &Hash, hash_function: &String) -> String {
        let hash_code = match hash_function.to_string().as_str() {
            "sha256" => 0x12,
            "sha1" => 0x11,
            _ => 0x12,
        };
        
        let hash_length = 32; // SHA256 produces 32 bytes
        format!("{}{}{}", hash_code, hash_length, hex::encode(hash.to_array().as_slice()))
    }

    /// Encode CID using specified codec
    fn encode_cid(env: &Env, hash: &Hash, codec: &String, version: u32) -> String {
        // Simplified CID encoding (would use proper CID library in production)
        let codec_code = match codec.to_string().as_str() {
            "dag-pb" => 0x70,
            "dag-json" => 0x0129,
            "raw" => 0x55,
            _ => 0x55,
        };
        
        format!("bafy{}{}{}", version, codec_code, hex::encode(hash.to_array().as_slice())[..16].to_string())
    }

    /// Store content metadata
    fn store_content_metadata(env: &Env, cid: String, metadata: ContentMetadata) {
        let content_key = Symbol::new(env, "content_registry");
        let mut content_map: Map<String, ContentMetadata> = env.storage()
            .instance()
            .get(&content_key)
            .unwrap_or_else(|| Map::new(env));
        
        content_map.set(cid, metadata);
        env.storage().instance().set(&content_key, &content_map);
    }

    /// Check for duplicate content
    fn check_duplicate(env: &Env, checksum: Hash) -> Option<String> {
        let dedup_key = Symbol::new(env, "deduplication_map");
        let dedup_map: Map<Hash, String> = env.storage()
            .instance()
            .get(&dedup_key)
            .unwrap_or_else(|| Map::new(env));
        
        dedup_map.get(checksum)
    }

    /// Update deduplication map
    fn update_deduplication_map(env: &Env, checksum: Hash, cid: String) {
        let dedup_key = Symbol::new(env, "deduplication_map");
        let mut dedup_map: Map<Hash, String> = env.storage()
            .instance()
            .get(&dedup_key)
            .unwrap_or_else(|| Map::new(env));
        
        dedup_map.set(checksum, cid);
        env.storage().instance().set(&dedup_key, &dedup_map);
    }

    /// Update statistics
    fn update_stats(env: &Env, stat_name: &str, delta: u64) {
        let stats_key = Symbol::new(env, "addressing_stats");
        let mut stats_map: Map<String, u64> = env.storage()
            .instance()
            .get(&stats_key)
            .unwrap_or_else(|| Map::new(env));
        
        let current = stats_map.get(String::from_str(env, stat_name)).unwrap_or(0);
        stats_map.set(String::from_str(env, stat_name), current + delta);
        env.storage().instance().set(&stats_key, &stats_map);
    }

    /// Get configuration
    pub fn get_config(env: &Env) -> AddressingConfig {
        let config_key = Symbol::new(env, "addressing_config");
        env.storage()
            .instance()
            .get(&config_key)
            .unwrap_or_else(|| AddressingConfig {
                default_hash_function: String::from_str(env, "sha256"),
                default_codec: String::from_str(env, "raw"),
                enable_versioning: true,
                enable_deduplication: true,
                checksum_verification: true,
            })
    }

    /// Update configuration (admin only)
    pub fn update_config(env: Env, admin: Address, new_config: AddressingConfig) -> Result<(), String> {
        let admin_key = Symbol::new(&env, "admin");
        let stored_admin: Address = env.storage()
            .instance()
            .get(&admin_key)
            .ok_or("Admin not found")?;
        
        if admin != stored_admin {
            return Err("Unauthorized".into());
        }
        
        let config_key = Symbol::new(&env, "addressing_config");
        env.storage().instance().set(&config_key, &new_config);
        
        Ok(())
    }

    /// List all content CIDs
    pub fn list_content_cids(env: Env) -> Vec<String> {
        let content_key = Symbol::new(&env, "content_registry");
        let content_map: Map<String, ContentMetadata> = env.storage()
            .instance()
            .get(&content_key)
            .unwrap_or_else(|| Map::new(&env));
        
        content_map.keys().collect()
    }

    /// Get content by MIME type
    pub fn get_content_by_mime_type(env: Env, mime_type: String) -> Vec<String> {
        let content_key = Symbol::new(&env, "content_registry");
        let content_map: Map<String, ContentMetadata> = env.storage()
            .instance()
            .get(&content_key)
            .unwrap_or_else(|| Map::new(&env));
        
        content_map.iter()
            .filter(|(_, metadata)| metadata.mime_type == mime_type)
            .map(|(cid, _)| cid)
            .collect()
    }
}
