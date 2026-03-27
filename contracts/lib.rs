#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProofVersion {
    pub version: u32,
    pub hash: String,
    pub uri: String,
    pub timestamp: u64,
    pub author: Address,
    pub message: String,
    pub branch: String,
}

#[contract]
pub struct VerinodeContract;

#[contractimpl]
impl VerinodeContract {
    // Add a new version to a proof
    pub fn add_version(
        env: Env, 
        proof_id: String, 
        hash: String, 
        uri: String, 
        author: Address,
        message: String,
        branch: String
    ) -> u32 {
        author.require_auth();
        
        let mut versions: Vec<ProofVersion> = env.storage().persistent().get(&proof_id).unwrap_or(Vec::new(&env));
        let new_version_num = versions.len() + 1;
        
        let version = ProofVersion {
            version: new_version_num,
            hash,
            uri,
            timestamp: env.ledger().timestamp(),
            author,
            message,
            branch,
        };
        
        versions.push_back(version);
        env.storage().persistent().set(&proof_id, &versions);
        
        new_version_num
    }

    // Get the full history of a proof
    pub fn get_history(env: Env, proof_id: String) -> Vec<ProofVersion> {
        env.storage().persistent().get(&proof_id).unwrap_or(Vec::new(&env))
    }

    // Get a specific version
    pub fn get_version(env: Env, proof_id: String, version: u32) -> Option<ProofVersion> {
        let versions: Vec<ProofVersion> = env.storage().persistent().get(&proof_id).unwrap_or(Vec::new(&env));
        if version == 0 || version > versions.len() {
            None
        } else {
            Some(versions.get(version - 1).unwrap())
        }
    }
}
