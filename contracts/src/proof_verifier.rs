#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, 
    Address, Bytes, Env, String, Vec, Map, 
    symbol_short, Symbol
};

#[contracttype]
pub enum DataKey {
    Proof(u64),
    ProofCount,
    Admin,
    RevokedProofs,
    ProofMetadata,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proof {
    pub id: u64,
    pub issuer: Address,
    pub subject: Address,
    pub proof_type: String,
    pub event_data: Bytes,
    pub timestamp: u64,
    pub verified: bool,
    pub hash: Bytes,
    pub revoked: bool,
    pub metadata: Map<Symbol, String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProofRequest {
    pub subject: Address,
    pub proof_type: String,
    pub event_data: Bytes,
    pub metadata: Map<Symbol, String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchOperation {
    pub operation_type: u32, // 1=issue, 2=verify, 3=revoke
    pub proof_id: Option<u64>,
    pub proof_request: Option<ProofRequest>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchResult {
    pub success: bool,
    pub proof_id: Option<u64>,
    pub error: Option<String>,
}

#[contract]
pub struct ProofVerifier;

#[contractimpl]
impl ProofVerifier {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ProofCount, &0u64);
        env.storage().instance().set(&DataKey::RevokedProofs, &Vec::<u64>::new(&env));
    }

    /// Issue a new cryptographic proof
    pub fn issue_proof(env: Env, issuer: Address, request: ProofRequest) -> u64 {
        issuer.require_auth();
        
        let count: u64 = env.storage().instance().get(&DataKey::ProofCount).unwrap_or(0);
        let proof_id = count + 1;
        
        // Generate proof hash from event data and metadata
        let mut hash_input = request.event_data.clone();
        for (key, value) in request.metadata.iter() {
            hash_input.append(&Bytes::from_slice(&env, key.to_string().as_bytes()));
            hash_input.append(&Bytes::from_slice(&env, value.as_bytes()));
        }
        let hash = env.crypto().sha256(&hash_input);
        
        let proof = Proof {
            id: proof_id,
            issuer: issuer.clone(),
            subject: request.subject,
            proof_type: request.proof_type,
            event_data: request.event_data,
            timestamp: env.ledger().timestamp(),
            verified: false,
            hash: hash.clone(),
            revoked: false,
            metadata: request.metadata,
        };
        
        env.storage().instance().set(&DataKey::Proof(proof_id), &proof);
        env.storage().instance().set(&DataKey::ProofCount, &proof_id);
        
        // Emit event for proof issuance
        env.events().publish(
            (symbol_short!("proof_issued"), proof_id, issuer),
            (proof.subject, proof.proof_type.clone(), proof.hash.clone())
        );
        
        proof_id
    }

    /// Verify a proof's authenticity
    pub fn verify_proof(env: Env, verifier: Address, proof_id: u64) -> bool {
        verifier.require_auth();
        
        let mut proof: Proof = env.storage().instance()
            .get(&DataKey::Proof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));
        
        // Check if proof is revoked
        if proof.revoked {
            return false;
        }
        
        // Verify hash integrity
        let mut hash_input = proof.event_data.clone();
        for (key, value) in proof.metadata.iter() {
            hash_input.append(&Bytes::from_slice(&env, key.to_string().as_bytes()));
            hash_input.append(&Bytes::from_slice(&env, value.as_bytes()));
        }
        let computed_hash = env.crypto().sha256(&hash_input);
        
        if computed_hash != proof.hash {
            return false;
        }
        
        // Mark as verified if not already
        if !proof.verified {
            proof.verified = true;
            env.storage().instance().set(&DataKey::Proof(proof_id), &proof);
            
            // Emit verification event
            env.events().publish(
                (symbol_short!("proof_verified"), proof_id, verifier),
                (proof.issuer, proof.subject)
            );
        }
        
        true
    }

    /// Get proof details
    pub fn get_proof(env: Env, proof_id: u64) -> Proof {
        env.storage().instance()
            .get(&DataKey::Proof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"))
    }

    /// Revoke a proof (only admin or issuer can revoke)
    pub fn revoke_proof(env: Env, revoker: Address, proof_id: u64, reason: String) {
        revoker.require_auth();
        
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        let mut proof: Proof = env.storage().instance()
            .get(&DataKey::Proof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));
        
        // Only admin or original issuer can revoke
        if revoker != admin && revoker != proof.issuer {
            panic!("Not authorized to revoke this proof");
        }
        
        if proof.revoked {
            panic!("Proof already revoked");
        }
        
        proof.revoked = true;
        proof.verified = false;
        
        env.storage().instance().set(&DataKey::Proof(proof_id), &proof);
        
        // Add to revoked proofs list
        let mut revoked: Vec<u64> = env.storage().instance()
            .get(&DataKey::RevokedProofs)
            .unwrap_or(Vec::new(&env));
        revoked.push_back(proof_id);
        env.storage().instance().set(&DataKey::RevokedProofs, &revoked);
        
        // Emit revocation event
        env.events().publish(
            (symbol_short!("proof_revoked"), proof_id, revoker),
            (reason, proof.issuer, proof.subject)
        );
    }

    /// Batch operations for multiple proofs
    pub fn batch_operations(env: Env, operator: Address, operations: Vec<BatchOperation>) -> Vec<BatchResult> {
        operator.require_auth();
        
        let mut results = Vec::new(&env);
        
        for operation in operations.iter() {
            let result = match operation.operation_type {
                1 => { // Issue
                    if let Some(request) = &operation.proof_request {
                        match Self::issue_proof(env.clone(), operator.clone(), request.clone()) {
                            proof_id => BatchResult {
                                success: true,
                                proof_id: Some(proof_id),
                                error: None,
                            }
                        }
                    } else {
                        BatchResult {
                            success: false,
                            proof_id: None,
                            error: Some(String::from_slice(&env, "Missing proof request")),
                        }
                    }
                },
                2 => { // Verify
                    if let Some(proof_id) = operation.proof_id {
                        match Self::verify_proof(env.clone(), operator.clone(), proof_id) {
                            success => BatchResult {
                                success,
                                proof_id: Some(proof_id),
                                error: None,
                            }
                        }
                    } else {
                        BatchResult {
                            success: false,
                            proof_id: None,
                            error: Some(String::from_slice(&env, "Missing proof ID")),
                        }
                    }
                },
                3 => { // Revoke
                    if let Some(proof_id) = operation.proof_id {
                        Self::revoke_proof(env.clone(), operator.clone(), proof_id, String::from_slice(&env, "Batch revocation"));
                        BatchResult {
                            success: true,
                            proof_id: Some(proof_id),
                            error: None,
                        }
                    } else {
                        BatchResult {
                            success: false,
                            proof_id: None,
                            error: Some(String::from_slice(&env, "Missing proof ID")),
                        }
                    }
                },
                _ => BatchResult {
                    success: false,
                    proof_id: None,
                    error: Some(String::from_slice(&env, "Invalid operation type")),
                }
            };
            
            results.push_back(result);
        }
        
        results
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

    /// Get all proofs for a subject
    pub fn get_proofs_by_subject(env: Env, subject: Address) -> Vec<Proof> {
        let count: u64 = env.storage().instance().get(&DataKey::ProofCount).unwrap_or(0);
        let mut proofs = Vec::new(&env);
        
        for i in 1..=count {
            if let Some(proof) = env.storage().instance().get::<DataKey, Proof>(&DataKey::Proof(i)) {
                if proof.subject == subject {
                    proofs.push_back(proof);
                }
            }
        }
        
        proofs
    }

    /// Get all revoked proofs
    pub fn get_revoked_proofs(env: Env) -> Vec<Proof> {
        let revoked_ids: Vec<u64> = env.storage().instance()
            .get(&DataKey::RevokedProofs)
            .unwrap_or(Vec::new(&env));
        
        let mut proofs = Vec::new(&env);
        for proof_id in revoked_ids.iter() {
            if let Some(proof) = env.storage().instance().get::<DataKey, Proof>(&DataKey::Proof(*proof_id)) {
                proofs.push_back(proof);
            }
        }
        
        proofs
    }

    /// Check if a proof is valid (not revoked and hash is valid)
    pub fn is_proof_valid(env: Env, proof_id: u64) -> bool {
        let proof: Proof = env.storage().instance()
            .get(&DataKey::Proof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));
        
        if proof.revoked {
            return false;
        }
        
        // Verify hash integrity
        let mut hash_input = proof.event_data.clone();
        for (key, value) in proof.metadata.iter() {
            hash_input.append(&Bytes::from_slice(&env, key.to_string().as_bytes()));
            hash_input.append(&Bytes::from_slice(&env, value.as_bytes()));
        }
        let computed_hash = env.crypto().sha256(&hash_input);
        
        computed_hash == proof.hash
    }

    /// Get the admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Get total proof count
    pub fn get_proof_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::ProofCount).unwrap_or(0)
    }

    /// Update admin address (only current admin can update)
    pub fn update_admin(env: Env, current_admin: Address, new_admin: Address) {
        current_admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if current_admin != stored_admin {
            panic!("Not authorized");
        }
        
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        
        env.events().publish(
            symbol_short!("admin_updated"),
            (current_admin, new_admin)
        );
    }
}
