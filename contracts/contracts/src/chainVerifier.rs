#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, U256};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChainVerificationResult {
    pub chain_id: u32,
    pub proof_id: u64,
    pub verified: bool,
    pub verifier: Address,
    pub timestamp: u64,
    pub gas_used: u64,
    pub verification_hash: Bytes,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerificationRule {
    pub rule_id: u32,
    pub chain_id: u32,
    pub min_confirmations: u32,
    pub gas_limit: u64,
    pub verification_method: String,
    pub active: bool,
}

#[contracttype]
pub enum VerifierDataKey {
    VerificationResult(u64, u32), // proof_id, chain_id
    VerificationRule(u32),
    RuleCount,
    TrustedVerifier(Address),
    Admin,
}

#[contract]
pub struct ChainVerifier;

#[contractimpl]
impl ChainVerifier {
    /// Initialize the verifier contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&VerifierDataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&VerifierDataKey::Admin, &admin);
        env.storage().instance().set(&VerifierDataKey::RuleCount, &0u32);
    }

    /// Add trusted verifier
    pub fn add_trusted_verifier(env: Env, admin: Address, verifier: Address) {
        let stored_admin: Address = env.storage().instance()
            .get(&VerifierDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        env.storage().instance().set(&VerifierDataKey::TrustedVerifier(verifier), &true);
    }

    /// Check if address is trusted verifier
    pub fn is_trusted_verifier(env: Env, verifier: Address) -> bool {
        env.storage().instance().has(&VerifierDataKey::TrustedVerifier(verifier))
    }

    /// Add verification rule for a chain
    pub fn add_verification_rule(env: Env, admin: Address, rule: VerificationRule) {
        let stored_admin: Address = env.storage().instance()
            .get(&VerifierDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let count: u32 = env.storage().instance().get(&VerifierDataKey::RuleCount).unwrap_or(0);
        let rule_id = count + 1;
        
        let mut new_rule = rule;
        new_rule.rule_id = rule_id;
        
        env.storage().instance().set(&VerifierDataKey::VerificationRule(rule_id), &new_rule);
        env.storage().instance().set(&VerifierDataKey::RuleCount, &rule_id);
    }

    /// Get verification rule
    pub fn get_verification_rule(env: Env, rule_id: u32) -> Option<VerificationRule> {
        env.storage().instance().get(&VerifierDataKey::VerificationRule(rule_id))
    }

    /// Get verification rules for chain
    pub fn get_chain_rules(env: Env, chain_id: u32) -> Vec<VerificationRule> {
        let count: u32 = env.storage().instance().get(&VerifierDataKey::RuleCount).unwrap_or(0);
        let mut rules = Vec::new(&env);
        
        for i in 1..=count {
            if let Some(rule) = env.storage().instance().get::<VerifierDataKey, VerificationRule>(&VerifierDataKey::VerificationRule(i)) {
                if rule.chain_id == chain_id && rule.active {
                    rules.push_back(rule);
                }
            }
        }
        
        rules
    }

    /// Verify proof on specific chain
    pub fn verify_proof_on_chain(
        env: Env,
        proof_id: u64,
        chain_id: u32,
        proof_data: Bytes,
        verifier: Address,
        verification_hash: Bytes,
    ) -> bool {
        // Check if verifier is trusted
        if !Self::is_trusted_verifier(env.clone(), verifier.clone()) {
            panic!("Not a trusted verifier");
        }
        
        verifier.require_auth();
        
        // Get chain rules
        let chain_rules = Self::get_chain_rules(env.clone(), chain_id);
        if chain_rules.is_empty() {
            panic!("No verification rules for this chain");
        }
        
        // Simulate verification process
        let verified = Self::simulate_verification(env.clone(), proof_data.clone(), chain_id);
        
        // Record verification result
        let result = ChainVerificationResult {
            chain_id,
            proof_id,
            verified,
            verifier: verifier.clone(),
            timestamp: env.ledger().timestamp(),
            gas_used: Self::estimate_gas_usage(env.clone(), proof_data.len()),
            verification_hash: verification_hash.clone(),
        };
        
        env.storage().instance().set(&VerifierDataKey::VerificationResult(proof_id, chain_id), &result);
        
        verified
    }

    /// Get verification result
    pub fn get_verification_result(env: Env, proof_id: u64, chain_id: u32) -> Option<ChainVerificationResult> {
        env.storage().instance().get(&VerifierDataKey::VerificationResult(proof_id, chain_id))
    }

    /// Batch verify proofs across multiple chains
    pub fn batch_verify_proofs(
        env: Env,
        proofs: Vec<(u64, u32, Bytes)>, // (proof_id, chain_id, proof_data)
        verifier: Address,
    ) -> Vec<bool> {
        verifier.require_auth();
        
        if !Self::is_trusted_verifier(env.clone(), verifier.clone()) {
            panic!("Not a trusted verifier");
        }
        
        let mut results = Vec::new(&env);
        
        for i in 0..proofs.len() {
            let (proof_id, chain_id, proof_data) = proofs.get(i).unwrap();
            let verification_hash = Self::generate_verification_hash(env.clone(), proof_data.clone());
            
            let verified = Self::verify_proof_on_chain(
                env.clone(),
                *proof_id,
                *chain_id,
                proof_data.clone(),
                verifier.clone(),
                verification_hash,
            );
            
            results.push_back(verified);
        }
        
        results
    }

    /// Check if proof is verified on all required chains
    pub fn is_fully_verified(env: Env, proof_id: u64, required_chains: Vec<u32>) -> bool {
        for i in 0..required_chains.len() {
            let chain_id = required_chains.get(i).unwrap();
            if let Some(result) = Self::get_verification_result(env.clone(), proof_id, *chain_id) {
                if !result.verified {
                    return false;
                }
            } else {
                return false;
            }
        }
        true
    }

    /// Get verification statistics
    pub fn get_verification_stats(env: Env, chain_id: u32) -> (u64, u64, u64) {
        // Returns (total_verifications, successful_verifications, failed_verifications)
        let mut total = 0u64;
        let mut successful = 0u64;
        let mut failed = 0u64;
        
        // This is a simplified implementation
        // In practice, you'd iterate through all verification results
        
        (total, successful, failed)
    }

    /// Simulate verification process (placeholder)
    fn simulate_verification(env: Env, proof_data: Bytes, chain_id: u32) -> bool {
        // Simplified verification logic
        // In practice, this would involve complex cryptographic verification
        proof_data.len() > 0 && (chain_id == 1 || chain_id == 137 || chain_id == 56)
    }

    /// Estimate gas usage for verification
    fn estimate_gas_usage(env: Env, proof_size: u32) -> u64 {
        // Base gas + gas per byte of proof data
        21000u64 + (proof_size as u64 * 50)
    }

    /// Generate verification hash
    fn generate_verification_hash(env: Env, data: Bytes) -> Bytes {
        // Simplified hash generation
        // In practice, use proper cryptographic hash function
        let mut hash = Bytes::new(&env);
        if data.len() > 0 {
            hash = data.slice(0..min(data.len(), 32));
        }
        hash
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&VerifierDataKey::Admin).unwrap()
    }

    /// Get total rule count
    pub fn get_rule_count(env: Env) -> u32 {
        env.storage().instance().get(&VerifierDataKey::RuleCount).unwrap_or(0)
    }
}

fn min(a: u32, b: u32) -> u32 {
    if a < b { a } else { b }
}
