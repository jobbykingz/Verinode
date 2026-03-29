use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, Symbol};
use crate::security::access_control::AccessControl;
use crate::security::validation::ValidationUtils;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IdentityProof {
    pub id: u64,
    pub subject_address: Address,
    pub identity_type: IdentityType,
    pub verification_method: VerificationMethod,
    pub credentials: Vec<Credential>,
    pub issuer: Address,
    pub timestamp: u64,
    pub expires_at: u64,
    pub verified: bool,
    pub revocation_reason: Option<String>,
    pub metadata: Map<Symbol, String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum IdentityType {
    Individual,
    Business,
    Government,
    Educational,
    Healthcare,
    Financial,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VerificationMethod {
    DocumentVerification,
    Biometric,
    DigitalSignature,
    MultiFactor,
    ZeroKnowledge,
    BlockchainBased,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Credential {
    pub id: String,
    pub type_: CredentialType,
    pub issuer: Address,
    pub issued_at: u64,
    pub expires_at: Option<u64>,
    pub credential_data: Bytes,
    pub verification_status: VerificationStatus,
    pub revocation_info: Option<RevocationInfo>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CredentialType {
    Passport,
    DriversLicense,
    NationalID,
    BirthCertificate,
    AcademicDegree,
    ProfessionalLicense,
    MedicalRecord,
    TaxDocument,
    BankStatement,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VerificationStatus {
    Pending,
    Verified,
    Rejected,
    Expired,
    Revoked,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RevocationInfo {
    pub revoked_at: u64,
    pub reason: String,
    pub revoked_by: Address,
    pub replacement_credential_id: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IdentityTemplateParams {
    pub allowed_identity_types: Vec<IdentityType>,
    pub required_verification_methods: Vec<VerificationMethod>,
    pub credential_requirements: Vec<CredentialRequirement>,
    pub validity_period: u64, // in seconds
    pub renewal_policy: RenewalPolicy,
    pub privacy_settings: PrivacySettings,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CredentialRequirement {
    pub credential_type: CredentialType,
    pub required: bool,
    pub verification_level: VerificationLevel,
    pub expiration_check: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VerificationLevel {
    Basic,
    Standard,
    Enhanced,
    Maximum,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RenewalPolicy {
    Automatic,
    Manual,
    Conditional(Vec<String>), // conditions as strings
    Disabled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PrivacySettings {
    pub public_verification: bool,
    pub share_with_third_party: bool,
    pub data_retention_period: Option<u64>,
    pub encryption_required: bool,
    pub audit_trail: bool,
}

#[contract]
pub struct IdentityProofContract;

#[contractimpl]
impl IdentityProofContract {
    /// Initialize the identity proof contract
    pub fn initialize(env: Env, admin: Address, params: IdentityTemplateParams) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        // Validate parameters
        Self::validate_template_params(&params);

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TemplateParams, &params);
        env.storage().instance().set(&DataKey::ProofCount, &0u64);
        env.storage().instance().set(&DataKey::RevokedProofs, &Vec::new(&env));
    }

    /// Issue a new identity proof
    pub fn issue_identity_proof(
        env: Env,
        subject_address: Address,
        identity_type: IdentityType,
        verification_method: VerificationMethod,
        credentials: Vec<Credential>,
        metadata: Map<Symbol, String>,
    ) -> u64 {
        subject_address.require_auth();

        let params: IdentityTemplateParams = env.storage().instance()
            .get(&DataKey::TemplateParams)
            .unwrap_or_else(|| panic!("Template parameters not found"));

        // Validate against template requirements
        Self::validate_identity_request(&env, &params, &identity_type, &verification_method, &credentials);

        let count: u64 = env.storage().instance().get(&DataKey::ProofCount).unwrap_or(0);
        let proof_id = count + 1;

        let identity_proof = IdentityProof {
            id: proof_id,
            subject_address: subject_address.clone(),
            identity_type: identity_type.clone(),
            verification_method,
            credentials: credentials.clone(),
            issuer: subject_address.clone(),
            timestamp: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + params.validity_period,
            verified: false,
            revocation_reason: None,
            metadata,
        };

        env.storage().instance().set(&DataKey::IdentityProof(proof_id), &identity_proof);
        env.storage().instance().set(&DataKey::ProofCount, &proof_id);

        // Store credentials separately for efficient querying
        for (i, credential) in credentials.iter().enumerate() {
            env.storage().instance().set(&DataKey::Credential(proof_id, i as u64), &credential);
        }

        proof_id
    }

    /// Verify an identity proof
    pub fn verify_identity_proof(env: Env, admin: Address, proof_id: u64) -> bool {
        Self::require_admin(&env, &admin);

        let mut proof: IdentityProof = env.storage().instance()
            .get(&DataKey::IdentityProof(proof_id))
            .unwrap_or_else(|| panic!("Identity proof not found"));

        // Check if proof has expired
        if env.ledger().timestamp() > proof.expires_at {
            return false;
        }

        // Check if proof has been revoked
        let revoked_proofs: Vec<u64> = env.storage().instance()
            .get(&DataKey::RevokedProofs)
            .unwrap_or(Vec::new(&env));
        
        if revoked_proofs.contains(&proof_id) {
            return false;
        }

        // Verify all credentials
        let mut all_credentials_valid = true;
        for (i, _) in proof.credentials.iter().enumerate() {
            if let Some(credential) = env.storage().instance().get::<DataKey, Credential>(&DataKey::Credential(proof_id, i as u64)) {
                if !Self::verify_credential(&env, &credential) {
                    all_credentials_valid = false;
                    break;
                }
            }
        }

        proof.verified = all_credentials_valid;
        env.storage().instance().set(&DataKey::IdentityProof(proof_id), &proof);

        all_credentials_valid
    }

    /// Revoke an identity proof
    pub fn revoke_identity_proof(
        env: Env,
        admin: Address,
        proof_id: u64,
        reason: String,
    ) {
        Self::require_admin(&env, &admin);

        let mut proof: IdentityProof = env.storage().instance()
            .get(&DataKey::IdentityProof(proof_id))
            .unwrap_or_else(|| panic!("Identity proof not found"));

        proof.verified = false;
        proof.revocation_reason = Some(reason.clone());

        env.storage().instance().set(&DataKey::IdentityProof(proof_id), &proof);

        // Add to revoked list
        let mut revoked_proofs: Vec<u64> = env.storage().instance()
            .get(&DataKey::RevokedProofs)
            .unwrap_or(Vec::new(&env));
        
        revoked_proofs.push_back(proof_id);
        env.storage().instance().set(&DataKey::RevokedProofs, &revoked_proofs);
    }

    /// Get identity proof details
    pub fn get_identity_proof(env: Env, proof_id: u64) -> IdentityProof {
        env.storage().instance()
            .get(&DataKey::IdentityProof(proof_id))
            .unwrap_or_else(|| panic!("Identity proof not found"))
    }

    /// Get all identity proofs for a subject
    pub fn get_identity_proofs_by_subject(env: Env, subject_address: Address) -> Vec<IdentityProof> {
        let count: u64 = env.storage().instance().get(&DataKey::ProofCount).unwrap_or(0);
        let mut proofs = Vec::new(&env);
        
        for i in 1..=count {
            if let Some(proof) = env.storage().instance().get::<DataKey, IdentityProof>(&DataKey::IdentityProof(i)) {
                if proof.subject_address == subject_address {
                    proofs.push_back(proof);
                }
            }
        }
        
        proofs
    }

    /// Get credentials for an identity proof
    pub fn get_credentials(env: Env, proof_id: u64) -> Vec<Credential> {
        let proof: IdentityProof = env.storage().instance()
            .get(&DataKey::IdentityProof(proof_id))
            .unwrap_or_else(|| panic!("Identity proof not found"));

        let mut credentials = Vec::new(&env);
        for i in 0..proof.credentials.len() {
            if let Some(credential) = env.storage().instance().get::<DataKey, Credential>(&DataKey::Credential(proof_id, i)) {
                credentials.push_back(credential);
            }
        }
        
        credentials
    }

    /// Check if an identity proof is valid
    pub fn is_identity_valid(env: Env, proof_id: u64) -> bool {
        let proof: IdentityProof = env.storage().instance()
            .get(&DataKey::IdentityProof(proof_id))
            .unwrap_or_else(|| panic!("Identity proof not found"));

        // Check expiration
        if env.ledger().timestamp() > proof.expires_at {
            return false;
        }

        // Check revocation
        let revoked_proofs: Vec<u64> = env.storage().instance()
            .get(&DataKey::RevokedProofs)
            .unwrap_or(Vec::new(&env));
        
        !revoked_proofs.contains(&proof_id) && proof.verified
    }

    /// Update identity proof metadata
    pub fn update_identity_metadata(
        env: Env,
        proof_id: u64,
        metadata: Map<Symbol, String>,
    ) {
        let proof: IdentityProof = env.storage().instance()
            .get(&DataKey::IdentityProof(proof_id))
            .unwrap_or_else(|| panic!("Identity proof not found"));

        proof.subject_address.require_auth();

        let mut updated_proof = proof;
        updated_proof.metadata = metadata;

        env.storage().instance().set(&DataKey::IdentityProof(proof_id), &updated_proof);
    }

    // Private helper methods

    fn validate_template_params(params: &IdentityTemplateParams) {
        // Validate allowed identity types
        if params.allowed_identity_types.is_empty() {
            panic!("At least one identity type must be allowed");
        }

        // Validate verification methods
        if params.required_verification_methods.is_empty() {
            panic!("At least one verification method must be required");
        }

        // Validate validity period
        if params.validity_period == 0 {
            panic!("Validity period must be greater than 0");
        }
    }

    fn validate_identity_request(
        env: &Env,
        params: &IdentityTemplateParams,
        identity_type: &IdentityType,
        verification_method: &VerificationMethod,
        credentials: &Vec<Credential>,
    ) {
        // Check if identity type is allowed
        if !params.allowed_identity_types.contains(identity_type) {
            panic!("Identity type not allowed by template");
        }

        // Check if verification method is required
        if !params.required_verification_methods.contains(verification_method) {
            panic!("Verification method not allowed by template");
        }

        // Validate credentials against requirements
        for requirement in &params.credential_requirements {
            let has_credential = credentials.iter().any(|c| c.type_ == requirement.credential_type);
            
            if requirement.required && !has_credential {
                panic!("Required credential type missing: {:?}", requirement.credential_type);
            }
        }

        // Check credential expiration if required
        for credential in credentials {
            if let Some(expires_at) = credential.expires_at {
                if env.ledger().timestamp() > expires_at {
                    panic!("Credential has expired");
                }
            }
        }
    }

    fn verify_credential(env: &Env, credential: &Credential) -> bool {
        // Check expiration
        if let Some(expires_at) = credential.expires_at {
            if env.ledger().timestamp() > expires_at {
                return false;
            }
        }

        // Check revocation status
        match credential.verification_status {
            VerificationStatus::Verified => true,
            VerificationStatus::Revoked => false,
            VerificationStatus::Expired => false,
            _ => false,
        }
    }

    fn require_admin(env: &Env, admin: &Address) {
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != &stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
    }
}

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    Admin,
    TemplateParams,
    ProofCount,
    IdentityProof(u64),
    Credential(u64, u64),
    RevokedProofs,
}
