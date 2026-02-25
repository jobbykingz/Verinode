#![no_std]
#[cfg(test)]
mod test;
mod privacyVerification;
mod crossChainBridge;
mod chainVerifier;
mod atomicSwap;
mod messagePassing;
mod grantTreasury;

use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec};

#[contracttype]
pub enum DataKey {
    Proof(u64),
    ProofCount,
    Admin,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proof {
    pub id: u64,
    pub issuer: Address,
    pub event_data: Bytes,
    pub timestamp: u64,
    pub verified: bool,
    pub hash: Bytes,
}

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
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ProofCount, &0u64);
    }

    /// Issue a new cryptographic proof
    pub fn issue_proof(
        env: Env,
        issuer: Address,
        event_data: Bytes,
        hash: Bytes,
    ) -> u64 {
        issuer.require_auth();
        
        let count: u64 = env.storage().instance().get(&DataKey::ProofCount).unwrap_or(0);
        let proof_id = count + 1;
        
        let proof = Proof {
            id: proof_id,
            issuer: issuer.clone(),
            event_data: event_data.clone(),
            timestamp: env.ledger().timestamp(),
            verified: false,
            hash: hash.clone(),
        };
        
        env.storage().instance().set(&DataKey::Proof(proof_id), &proof);
        env.storage().instance().set(&DataKey::ProofCount, &proof_id);
        
        proof_id
    }

    /// Verify a proof
    pub fn verify_proof(env: Env, admin: Address, proof_id: u64) -> bool {
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let mut proof: Proof = env.storage().instance()
            .get(&DataKey::Proof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));
        
        proof.verified = true;
        env.storage().instance().set(&DataKey::Proof(proof_id), &proof);
        
        true
    }

    /// Get proof details
    pub fn get_proof(env: Env, proof_id: u64) -> Proof {
        env.storage().instance()
            .get(&DataKey::Proof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"))
    }

    /// Get all proofs for an issuer
    pub fn get_proofs_by_issuer(env: Env, issuer: Address) -> Vec<Proof> {
        let count: u64 = env.storage().instance().get(&DataKey::ProofCount).unwrap_or(0);
        let mut proofs = Vec::new(&env);
        
        for i in 1..=count {
            if let Some(proof) = env.storage().instance().get::<DataKey, Proof>(&DataKey::Proof(i)) {
                if proof.issuer == issuer {
                    proofs.push_back(proof);
                }
            }
        }
        
        proofs
    }

    /// Get the admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Get total proof count
    pub fn get_proof_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::ProofCount).unwrap_or(0)
    }

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
