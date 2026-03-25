#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EncryptedProof {
    pub proof_id: u64,
    pub owner: Address,
    pub encrypted_data: Bytes,
    pub metadata: ProofMetadata,
    pub access_control: AccessControl,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProofMetadata {
    pub algorithm: String,
    pub key_version: String,
    pub data_size: u64,
    pub compression_used: bool,
    pub checksum: Bytes,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccessControl {
    pub authorized_addresses: Vec<Address>,
    pub permissions: Vec<String>,
    pub max_access_count: u32,
    pub access_count: u32,
    pub expiration_time: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProofVerification {
    pub proof_id: u64,
    pub verifier: Address,
    pub result: bool,
    pub confidence_score: u32, // 0-100
    pub verified_at: u64,
    pub gas_used: u64,
}

#[contracttype]
pub enum EncryptedProofDataKey {
    EncryptedProof(u64),
    ProofVerification(u64, u64), // (proof_id, verification_id)
    ProofCount,
    VerificationCount(u64), // per proof
    OwnerProofs(Address),
}

#[contract]
pub struct EncryptedProofContract;

#[contractimpl]
impl EncryptedProofContract {
    /// Initialize the encrypted proof contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&EncryptedProofDataKey::ProofCount) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&EncryptedProofDataKey::ProofCount, &0u64);
    }

    /// Create a new encrypted proof
    pub fn create_encrypted_proof(
        env: Env,
        owner: Address,
        encrypted_data: Bytes,
        algorithm: String,
        key_version: String,
        data_size: u64,
        compression_used: bool,
        checksum: Bytes,
        authorized_addresses: Vec<Address>,
        permissions: Vec<String>,
        max_access_count: u32,
        expiration_time: Option<u64>,
    ) -> u64 {
        owner.require_auth();

        let count: u64 = env.storage().instance().get(&EncryptedProofDataKey::ProofCount).unwrap_or(0);
        let proof_id = count + 1;

        let metadata = ProofMetadata {
            algorithm,
            key_version,
            data_size,
            compression_used,
            checksum,
        };

        let access_control = AccessControl {
            authorized_addresses,
            permissions,
            max_access_count,
            access_count: 0,
            expiration_time,
        };

        let encrypted_proof = EncryptedProof {
            proof_id,
            owner: owner.clone(),
            encrypted_data,
            metadata,
            access_control,
            created_at: env.ledger().timestamp(),
            updated_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&EncryptedProofDataKey::EncryptedProof(proof_id), &encrypted_proof);
        env.storage().instance().set(&EncryptedProofDataKey::ProofCount, &proof_id);

        // Add to owner's proofs
        let mut owner_proofs: Vec<u64> = env.storage().instance()
            .get(&EncryptedProofDataKey::OwnerProofs(owner.clone()))
            .unwrap_or(Vec::new(&env));
        owner_proofs.push_back(proof_id);
        env.storage().instance().set(&EncryptedProofDataKey::OwnerProofs(owner), &owner_proofs);

        proof_id
    }

    /// Get encrypted proof (with access control)
    pub fn get_encrypted_proof(env: Env, proof_id: u64, requester: Address) -> EncryptedProof {
        let proof = env.storage().instance()
            .get(&EncryptedProofDataKey::EncryptedProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));

        // Check access control
        Self::check_access(&proof, &requester);

        // Update access count
        let mut updated_proof = proof.clone();
        updated_proof.access_control.access_count += 1;
        updated_proof.updated_at = env.ledger().timestamp();
        env.storage().instance().set(&EncryptedProofDataKey::EncryptedProof(proof_id), &updated_proof);

        updated_proof
    }

    /// Update access control
    pub fn update_access_control(
        env: Env,
        proof_id: u64,
        owner: Address,
        authorized_addresses: Vec<Address>,
        permissions: Vec<String>,
        max_access_count: u32,
        expiration_time: Option<u64>,
    ) {
        let mut proof = env.storage().instance()
            .get(&EncryptedProofDataKey::EncryptedProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));

        // Only owner can update access control
        if proof.owner != owner {
            panic!("Not authorized to update access control");
        }

        owner.require_auth();

        proof.access_control.authorized_addresses = authorized_addresses;
        proof.access_control.permissions = permissions;
        proof.access_control.max_access_count = max_access_count;
        proof.access_control.expiration_time = expiration_time;
        proof.updated_at = env.ledger().timestamp();

        env.storage().instance().set(&EncryptedProofDataKey::EncryptedProof(proof_id), &proof);
    }

    /// Grant access to a proof
    pub fn grant_access(
        env: Env,
        proof_id: u64,
        owner: Address,
        grantee: Address,
        permissions: Vec<String>,
    ) {
        let mut proof = env.storage().instance()
            .get(&EncryptedProofDataKey::EncryptedProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));

        // Only owner can grant access
        if proof.owner != owner {
            panic!("Not authorized to grant access");
        }

        owner.require_auth();

        // Add grantee if not already authorized
        if !proof.access_control.authorized_addresses.contains(&grantee) {
            proof.access_control.authorized_addresses.push_back(grantee);
        }

        // Add permissions
        for permission in permissions.iter() {
            if !proof.access_control.permissions.contains(permission) {
                proof.access_control.permissions.push_back(permission.clone());
            }
        }

        proof.updated_at = env.ledger().timestamp();
        env.storage().instance().set(&EncryptedProofDataKey::EncryptedProof(proof_id), &proof);
    }

    /// Revoke access from a proof
    pub fn revoke_access(
        env: Env,
        proof_id: u64,
        owner: Address,
        revokee: Address,
    ) {
        let mut proof = env.storage().instance()
            .get(&EncryptedProofDataKey::EncryptedProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));

        // Only owner can revoke access
        if proof.owner != owner {
            panic!("Not authorized to revoke access");
        }

        owner.require_auth();

        // Remove revokee from authorized addresses
        let mut updated_addresses = Vec::new(&env);
        for addr in proof.access_control.authorized_addresses.iter() {
            if *addr != revokee {
                updated_addresses.push_back(*addr);
            }
        }
        proof.access_control.authorized_addresses = updated_addresses;

        proof.updated_at = env.ledger().timestamp();
        env.storage().instance().set(&EncryptedProofDataKey::EncryptedProof(proof_id), &proof);
    }

    /// Verify proof (homomorphic computation)
    pub fn verify_proof(
        env: Env,
        proof_id: u64,
        verifier: Address,
        verification_data: Bytes,
    ) -> ProofVerification {
        let proof = env.storage().instance()
            .get(&EncryptedProofDataKey::EncryptedProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));

        // Check if verifier has compute permission
        Self::check_compute_access(&proof, &verifier);

        verifier.require_auth();

        // Simulate homomorphic verification
        // In practice, this would perform homomorphic computations
        let result = Self::perform_homomorphic_verification(&proof.encrypted_data, &verification_data);
        let confidence_score = if result { 95 } else { 10 }; // Simulated confidence

        let verification_count: u64 = env.storage().instance()
            .get(&EncryptedProofDataKey::VerificationCount(proof_id))
            .unwrap_or(0);
        let verification_id = verification_count + 1;

        let verification = ProofVerification {
            proof_id,
            verifier,
            result,
            confidence_score,
            verified_at: env.ledger().timestamp(),
            gas_used: 5000, // Simulated gas usage
        };

        env.storage().instance().set(
            &EncryptedProofDataKey::ProofVerification(proof_id, verification_id),
            &verification
        );
        env.storage().instance().set(&EncryptedProofDataKey::VerificationCount(proof_id), &verification_id);

        verification
    }

    /// Get proof verifications
    pub fn get_proof_verifications(env: Env, proof_id: u64, requester: Address) -> Vec<ProofVerification> {
        let proof = env.storage().instance()
            .get(&EncryptedProofDataKey::EncryptedProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));

        // Check access
        Self::check_access(&proof, &requester);

        let verification_count: u64 = env.storage().instance()
            .get(&EncryptedProofDataKey::VerificationCount(proof_id))
            .unwrap_or(0);

        let mut verifications = Vec::new(&env);
        for i in 1..=verification_count {
            if let Some(verification) = env.storage().instance()
                .get(&EncryptedProofDataKey::ProofVerification(proof_id, i)) {
                verifications.push_back(verification);
            }
        }

        verifications
    }

    /// Get owner's proofs
    pub fn get_owner_proofs(env: Env, owner: Address) -> Vec<u64> {
        env.storage().instance()
            .get(&EncryptedProofDataKey::OwnerProofs(owner))
            .unwrap_or(Vec::new(&env))
    }

    /// Delete proof
    pub fn delete_proof(env: Env, proof_id: u64, owner: Address) {
        let proof = env.storage().instance()
            .get(&EncryptedProofDataKey::EncryptedProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));

        // Only owner can delete
        if proof.owner != owner {
            panic!("Not authorized to delete proof");
        }

        owner.require_auth();

        // Remove from storage
        env.storage().instance().remove(&EncryptedProofDataKey::EncryptedProof(proof_id));

        // Remove from owner's proofs
        let mut owner_proofs: Vec<u64> = env.storage().instance()
            .get(&EncryptedProofDataKey::OwnerProofs(owner.clone()))
            .unwrap_or(Vec::new(&env));

        let mut updated_proofs = Vec::new(&env);
        for p_id in owner_proofs.iter() {
            if *p_id != proof_id {
                updated_proofs.push_back(*p_id);
            }
        }
        env.storage().instance().set(&EncryptedProofDataKey::OwnerProofs(owner), &updated_proofs);
    }

    /// Get proof metadata (public information)
    pub fn get_proof_metadata(env: Env, proof_id: u64) -> (ProofMetadata, AccessControl, u64, u64) {
        let proof = env.storage().instance()
            .get(&EncryptedProofDataKey::EncryptedProof(proof_id))
            .unwrap_or_else(|| panic!("Proof not found"));

        (proof.metadata, proof.access_control, proof.created_at, proof.updated_at)
    }

    // Private helper methods

    fn check_access(proof: &EncryptedProof, requester: &Address) {
        // Owner always has access
        if proof.owner == *requester {
            return;
        }

        // Check if requester is authorized
        if !proof.access_control.authorized_addresses.contains(requester) {
            panic!("Access denied");
        }

        // Check expiration
        if let Some(expiration) = proof.access_control.expiration_time {
            if env.ledger().timestamp() > expiration {
                panic!("Access expired");
            }
        }

        // Check access count limit
        if proof.access_control.access_count >= proof.access_control.max_access_count {
            panic!("Access limit exceeded");
        }
    }

    fn check_compute_access(proof: &EncryptedProof, requester: &Address) {
        Self::check_access(proof, requester);

        // Check if compute permission is granted
        if !proof.access_control.permissions.contains(&String::from_str(&soroban_sdk::Env::default(), "compute")) {
            panic!("Compute permission denied");
        }
    }

    fn perform_homomorphic_verification(encrypted_data: &Bytes, verification_data: &Bytes) -> bool {
        // Simulate homomorphic verification
        // In practice, this would perform homomorphic computations to verify
        // the proof without decrypting it

        // Simple simulation: check if data lengths match and some basic properties
        if encrypted_data.len() == 0 || verification_data.len() == 0 {
            return false;
        }

        // Simulate verification logic
        let data_sum: u32 = encrypted_data.iter().map(|b| b as u32).sum();
        let verification_sum: u32 = verification_data.iter().map(|b| b as u32).sum();

        // Return true if sums are close (simulating homomorphic comparison)
        (data_sum as i32 - verification_sum as i32).abs() < 100
    }
}