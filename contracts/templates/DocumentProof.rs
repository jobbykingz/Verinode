use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, Symbol, U256};
use crate::security::hash_utils::HashUtils;
use crate::security::encryption::EncryptionUtils;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DocumentProof {
    pub id: u64,
    pub document_hash: Bytes,
    pub document_type: DocumentType,
    pub content_hash: Bytes,
    pub metadata: DocumentMetadata,
    pub issuer: Address,
    pub signatories: Vec<Signatory>,
    pub timestamp: u64,
    pub verified: bool,
    pub verification_attempts: u32,
    pub ipfs_cid: Option<String>,
    pub encryption_info: Option<EncryptionInfo>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DocumentType {
    LegalContract,
    Certificate,
    AcademicTranscript,
    MedicalRecord,
    FinancialStatement,
    TechnicalSpecification,
    CreativeWork,
    GovernmentDocument,
    BusinessDocument,
    PersonalIdentification,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DocumentMetadata {
    pub title: String,
    pub description: String,
    pub author: String,
    pub creation_date: u64,
    pub last_modified: u64,
    pub version: String,
    pub language: String,
    pub tags: Vec<String>,
    pub custom_fields: Map<Symbol, String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Signatory {
    pub address: Address,
    pub role: SignatoryRole,
    pub signature: Bytes,
    pub signed_at: u64,
    pub verification_method: VerificationMethod,
    pub certificate_id: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SignatoryRole {
    Author,
    Reviewer,
    Approver,
    Witness,
    Notary,
    Authority,
    Custodian,
    Participant,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VerificationMethod {
    DigitalSignature,
    HashComparison,
    TimestampVerification,
    MultiSignature,
    ZeroKnowledge,
    Biometric,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EncryptionInfo {
    pub algorithm: EncryptionAlgorithm,
    pub key_hash: Bytes,
    pub iv: Bytes,
    pub encrypted_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EncryptionAlgorithm {
    AES256,
    RSA2048,
    RSA4096,
    ChaCha20,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DocumentTemplateParams {
    pub allowed_document_types: Vec<DocumentType>,
    pub required_signatories: Vec<SignatoryRole>,
    pub verification_requirements: VerificationRequirements,
    pub storage_requirements: StorageRequirements,
    pub privacy_settings: DocumentPrivacySettings,
    pub validation_rules: Vec<ValidationRule>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerificationRequirements {
    pub require_timestamp: bool,
    pub require_notarization: bool,
    pub require_multi_signature: bool,
    pub require_encryption: bool,
    pub require_ipfs_storage: bool,
    pub min_verification_level: VerificationLevel,
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
pub struct StorageRequirements {
    pub ipfs_required: bool,
    pub encryption_required: bool,
    pub backup_required: bool,
    pub retention_period: Option<u64>, // in seconds
    pub geo_restrictions: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DocumentPrivacySettings {
    pub public_metadata: bool,
    pub public_verification: bool,
    pub share_with_authorities: bool,
    pub audit_access: bool,
    pub data_classification: DataClassification,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataClassification {
    Public,
    Internal,
    Confidential,
    Restricted,
    Secret,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ValidationRule {
    pub rule_type: ValidationRuleType,
    pub parameters: Map<Symbol, String>,
    pub error_message: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ValidationRuleType {
    FileSizeLimit,
    FileTypeCheck,
    ContentValidation,
    SignatureFormat,
    TimestampRange,
    Custom(String),
}

#[contract]
pub struct DocumentProofContract;

#[contractimpl]
impl DocumentProofContract {
    /// Initialize the document proof contract
    pub fn initialize(env: Env, admin: Address, params: DocumentTemplateParams) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        // Validate template parameters
        Self::validate_template_params(&params);

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TemplateParams, &params);
        env.storage().instance().set(&DataKey::DocumentCount, &0u64);
        env.storage().instance().set(&DataKey::RevokedDocuments, &Vec::new(&env));
    }

    /// Create a new document proof
    pub fn create_document_proof(
        env: Env,
        document_hash: Bytes,
        document_type: DocumentType,
        content_hash: Bytes,
        metadata: DocumentMetadata,
        signatories: Vec<Signatory>,
        ipfs_cid: Option<String>,
        encryption_info: Option<EncryptionInfo>,
    ) -> u64 {
        // Require at least one signatory to be authenticated
        if let Some(first_signatory) = signatories.first() {
            first_signatory.address.require_auth();
        } else {
            panic!("At least one signatory is required");
        }

        let params: DocumentTemplateParams = env.storage().instance()
            .get(&DataKey::TemplateParams)
            .unwrap_or_else(|| panic!("Template parameters not found"));

        // Validate document against template requirements
        Self::validate_document_request(&env, &params, &document_type, &signatories, &ipfs_cid, &encryption_info);

        let count: u64 = env.storage().instance().get(&DataKey::DocumentCount).unwrap_or(0);
        let document_id = count + 1;

        let document_proof = DocumentProof {
            id: document_id,
            document_hash: document_hash.clone(),
            document_type: document_type.clone(),
            content_hash: content_hash.clone(),
            metadata: metadata.clone(),
            issuer: signatories.first().unwrap().address.clone(),
            signatories: signatories.clone(),
            timestamp: env.ledger().timestamp(),
            verified: false,
            verification_attempts: 0,
            ipfs_cid: ipfs_cid.clone(),
            encryption_info: encryption_info.clone(),
        };

        env.storage().instance().set(&DataKey::DocumentProof(document_id), &document_proof);
        env.storage().instance().set(&DataKey::DocumentCount, &document_id);

        // Store signatories separately for efficient querying
        for (i, signatory) in signatories.iter().enumerate() {
            env.storage().instance().set(&DataKey::Signatory(document_id, i as u64), &signatory);
        }

        document_id
    }

    /// Verify a document proof
    pub fn verify_document_proof(env: Env, document_id: u64) -> bool {
        let mut document: DocumentProof = env.storage().instance()
            .get(&DataKey::DocumentProof(document_id))
            .unwrap_or_else(|| panic!("Document proof not found"));

        // Check if document has been revoked
        if Self::is_document_revoked(&env, document_id) {
            return false;
        }

        let params: DocumentTemplateParams = env.storage().instance()
            .get(&DataKey::TemplateParams)
            .unwrap_or_else(|| panic!("Template parameters not found"));

        // Verify document hash integrity
        if !Self::verify_hash_integrity(&document) {
            document.verification_attempts += 1;
            env.storage().instance().set(&DataKey::DocumentProof(document_id), &document);
            return false;
        }

        // Verify all signatories
        let mut all_signatures_valid = true;
        for (i, _) in document.signatories.iter().enumerate() {
            if let Some(signatory) = env.storage().instance().get::<DataKey, Signatory>(&DataKey::Signatory(document_id, i as u64)) {
                if !Self::verify_signatory_signature(&env, &signatory, &document) {
                    all_signatures_valid = false;
                    break;
                }
            }
        }

        // Verify IPFS content if required
        if params.storage_requirements.ipfs_required {
            if let Some(ref cid) = document.ipfs_cid {
                if !Self::verify_ipfs_content(&env, cid, &document.content_hash) {
                    all_signatures_valid = false;
                }
            } else {
                all_signatures_valid = false;
            }
        }

        // Verify encryption if required
        if params.storage_requirements.encryption_required {
            if document.encryption_info.is_none() {
                all_signatures_valid = false;
            }
        }

        document.verified = all_signatures_valid;
        document.verification_attempts += 1;
        env.storage().instance().set(&DataKey::DocumentProof(document_id), &document);

        all_signatures_valid
    }

    /// Add additional signature to document
    pub fn add_signature(
        env: Env,
        document_id: u64,
        signatory: Signatory,
    ) {
        let document: DocumentProof = env.storage().instance()
            .get(&DataKey::DocumentProof(document_id))
            .unwrap_or_else(|| panic!("Document proof not found"));

        signatory.address.require_auth();

        let mut updated_document = document;
        updated_document.signatories.push_back(signatory.clone());

        env.storage().instance().set(&DataKey::DocumentProof(document_id), &updated_document);
        
        // Store the new signatory
        let signatory_index = updated_document.signatories.len() - 1;
        env.storage().instance().set(&DataKey::Signatory(document_id, signatory_index as u64), &signatory);
    }

    /// Revoke a document proof
    pub fn revoke_document_proof(
        env: Env,
        admin: Address,
        document_id: u64,
        reason: String,
    ) {
        Self::require_admin(&env, &admin);

        let mut document: DocumentProof = env.storage().instance()
            .get(&DataKey::DocumentProof(document_id))
            .unwrap_or_else(|| panic!("Document proof not found"));

        document.verified = false;

        env.storage().instance().set(&DataKey::DocumentProof(document_id), &document);

        // Add to revoked list
        let mut revoked_documents: Vec<u64> = env.storage().instance()
            .get(&DataKey::RevokedDocuments)
            .unwrap_or(Vec::new(&env));
        
        revoked_documents.push_back(document_id);
        env.storage().instance().set(&DataKey::RevokedDocuments, &revoked_documents);

        // Store revocation reason
        env.storage().instance().set(&DataKey::RevocationReason(document_id), &reason);
    }

    /// Get document proof details
    pub fn get_document_proof(env: Env, document_id: u64) -> DocumentProof {
        env.storage().instance()
            .get(&DataKey::DocumentProof(document_id))
            .unwrap_or_else(|| panic!("Document proof not found"))
    }

    /// Get all documents for an issuer
    pub fn get_documents_by_issuer(env: Env, issuer: Address) -> Vec<DocumentProof> {
        let count: u64 = env.storage().instance().get(&DataKey::DocumentCount).unwrap_or(0);
        let mut documents = Vec::new(&env);
        
        for i in 1..=count {
            if let Some(document) = env.storage().instance().get::<DataKey, DocumentProof>(&DataKey::DocumentProof(i)) {
                if document.issuer == issuer {
                    documents.push_back(document);
                }
            }
        }
        
        documents
    }

    /// Get signatories for a document
    pub fn get_document_signatories(env: Env, document_id: u64) -> Vec<Signatory> {
        let document: DocumentProof = env.storage().instance()
            .get(&DataKey::DocumentProof(document_id))
            .unwrap_or_else(|| panic!("Document proof not found"));

        let mut signatories = Vec::new(&env);
        for i in 0..document.signatories.len() {
            if let Some(signatory) = env.storage().instance().get::<DataKey, Signatory>(&DataKey::Signatory(document_id, i)) {
                signatories.push_back(signatory);
            }
        }
        
        signatories
    }

    /// Update document metadata
    pub fn update_document_metadata(
        env: Env,
        document_id: u64,
        metadata: DocumentMetadata,
    ) {
        let document: DocumentProof = env.storage().instance()
            .get(&DataKey::DocumentProof(document_id))
            .unwrap_or_else(|| panic!("Document proof not found"));

        // Require authorization from issuer or any signatory
        if let Some(first_signatory) = document.signatories.first() {
            first_signatory.address.require_auth();
        }

        let mut updated_document = document;
        updated_document.metadata = metadata;

        env.storage().instance().set(&DataKey::DocumentProof(document_id), &updated_document);
    }

    /// Get document verification status
    pub fn get_verification_status(env: Env, document_id: u64) -> VerificationStatus {
        let document: DocumentProof = env.storage().instance()
            .get(&DataKey::DocumentProof(document_id))
            .unwrap_or_else(|| panic!("Document proof not found"));

        if Self::is_document_revoked(&env, document_id) {
            VerificationStatus::Revoked
        } else if document.verified {
            VerificationStatus::Verified
        } else if document.verification_attempts > 0 {
            VerificationStatus::Failed
        } else {
            VerificationStatus::Pending
        }
    }

    // Private helper methods

    fn validate_template_params(params: &DocumentTemplateParams) {
        // Validate allowed document types
        if params.allowed_document_types.is_empty() {
            panic!("At least one document type must be allowed");
        }

        // Validate required signatories
        if params.required_signatories.is_empty() {
            panic!("At least one signatory role must be required");
        }
    }

    fn validate_document_request(
        env: &Env,
        params: &DocumentTemplateParams,
        document_type: &DocumentType,
        signatories: &Vec<Signatory>,
        ipfs_cid: &Option<String>,
        encryption_info: &Option<EncryptionInfo>,
    ) {
        // Check if document type is allowed
        if !params.allowed_document_types.contains(document_type) {
            panic!("Document type not allowed by template");
        }

        // Check if required signatory roles are present
        for required_role in &params.required_signatories {
            let has_role = signatories.iter().any(|s| &s.role == required_role);
            if !has_role {
                panic!("Required signatory role missing: {:?}", required_role);
            }
        }

        // Check IPFS requirement
        if params.storage_requirements.ipfs_required && ipfs_cid.is_none() {
            panic!("IPFS CID is required by template");
        }

        // Check encryption requirement
        if params.storage_requirements.encryption_required && encryption_info.is_none() {
            panic!("Encryption is required by template");
        }
    }

    fn verify_hash_integrity(document: &DocumentProof) -> bool {
        // Compare document hash with computed content hash
        // This is a simplified implementation
        // In practice, you would recompute the hash from the actual content
        document.document_hash == document.content_hash
    }

    fn verify_signatory_signature(env: &Env, signatory: &Signatory, document: &DocumentProof) -> bool {
        // Verify the signature against the document hash
        // This is a simplified implementation
        // In practice, you would use cryptographic signature verification
        !signatory.signature.is_empty() && signatory.signed_at > 0
    }

    fn verify_ipfs_content(env: &Env, cid: &str, expected_hash: &Bytes) -> bool {
        // This would integrate with IPFS to verify content
        // For now, return true if CID is provided
        !cid.is_empty()
    }

    fn is_document_revoked(env: &Env, document_id: u64) -> bool {
        let revoked_documents: Vec<u64> = env.storage().instance()
            .get(&DataKey::RevokedDocuments)
            .unwrap_or(Vec::new(&env));
        
        revoked_documents.contains(&document_id)
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
pub enum VerificationStatus {
    Pending,
    Verified,
    Failed,
    Revoked,
}

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    Admin,
    TemplateParams,
    DocumentCount,
    DocumentProof(u64),
    Signatory(u64, u64),
    RevokedDocuments,
    RevocationReason(u64),
}
