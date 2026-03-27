use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, Symbol, U256};
use crate::security::access_control::AccessControl;
use crate::security::validation::ValidationUtils;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipProof {
    pub id: u64,
    pub asset_identifier: AssetIdentifier,
    pub owner: Address,
    pub ownership_type: OwnershipType,
    pub proof_data: OwnershipProofData,
    pub transfer_history: Vec<TransferRecord>,
    pub timestamp: u64,
    pub expires_at: Option<u64>,
    pub verified: bool,
    pub restrictions: Vec<OwnershipRestriction>,
    pub metadata: OwnershipMetadata,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssetIdentifier {
    pub asset_type: AssetType,
    pub asset_id: String,
    pub asset_hash: Option<Bytes>,
    pub ipfs_cid: Option<String>,
    pub chain_id: Option<u32>,
    pub contract_address: Option<Address>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AssetType {
    RealEstate,
    Vehicle,
    DigitalAsset,
    IntellectualProperty,
    FinancialInstrument,
    PhysicalGood,
    Artwork,
    DomainName,
    CarbonCredit,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OwnershipType {
    FullOwnership,
    PartialOwnership,
    Leasehold,
    UsageRights,
    LicensingRights,
    Custody,
    StakingRights,
    AccessRights,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipProofData {
    pub proof_method: ProofMethod,
    pub certificate_data: Option<CertificateData>,
    pub legal_document_hash: Option<Bytes>,
    pub blockchain_reference: Option<BlockchainReference>,
    pub physical_verification: Option<PhysicalVerification>,
    pub digital_signature: Option<Bytes>,
    pub multi_signature_data: Option<Vec<Bytes>>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProofMethod {
    LegalDocument,
    BlockchainTransaction,
    DigitalCertificate,
    PhysicalInspection,
    MultiSignature,
    ZeroKnowledge,
    OracleVerification,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificateData {
    pub certificate_id: String,
    pub issuer: Address,
    pub issued_at: u64,
    pub expires_at: Option<u64>,
    pub certificate_type: CertificateType,
    pub verification_data: Bytes,
    pub digital_signature: Bytes,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CertificateType {
    TitleDeed,
    RegistrationCertificate,
    BillOfSale,
    AppraisalCertificate,
    InsuranceCertificate,
    ExportLicense,
    ImportLicense,
    ComplianceCertificate,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BlockchainReference {
    pub network: String,
    pub transaction_hash: Bytes,
    pub block_number: u64,
    pub block_hash: Bytes,
    pub contract_address: Option<Address>,
    pub log_index: Option<u32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PhysicalVerification {
    pub verified_by: Address,
    pub verification_method: VerificationMethod,
    pub verification_date: u64,
    pub location: String,
    pub evidence_hash: Bytes,
    pub photos: Vec<String>, // IPFS CIDs
    pub documents: Vec<String>, // IPFS CIDs
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VerificationMethod {
    VisualInspection,
    DocumentVerification,
    BiometricVerification,
    GPSVerification,
    QRCodeScan,
    NFCVerification,
    ThirdPartyOracle,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferRecord {
    pub transfer_id: u64,
    pub from_address: Address,
    pub to_address: Address,
    pub transfer_date: u64,
    pub transfer_type: TransferType,
    pub consideration: Option<Consideration>,
    pub approval_signatures: Vec<Bytes>,
    pub blockchain_tx: Option<Bytes>,
    pub metadata: Map<Symbol, String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TransferType {
    Sale,
    Gift,
    Inheritance,
    Lease,
    License,
    Pledge,
    Escrow,
    Auction,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Consideration {
    pub amount: Option<u64>,
    pub currency: Option<String>,
    pub asset_exchange: Option<AssetIdentifier>,
    pub terms: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipRestriction {
    pub restriction_type: RestrictionType,
    pub restriction_data: Map<Symbol, String>,
    pub expires_at: Option<u64>,
    pub enforceable: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RestrictionType {
    TransferRestriction,
    UsageRestriction,
    GeographicRestriction,
    TimeRestriction,
    QuantityRestriction,
    QualityRestriction,
    LegalRestriction,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipMetadata {
    pub asset_name: String,
    pub description: String,
    pub category: String,
    pub location: String,
    pub condition: AssetCondition,
    pub valuation: Option<Valuation>,
    pub insurance: Option<InsuranceInfo>,
    pub maintenance_records: Vec<MaintenanceRecord>,
    pub custom_attributes: Map<Symbol, String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AssetCondition {
    New,
    Excellent,
    Good,
    Fair,
    Poor,
    Damaged,
    Restored,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Valuation {
    pub amount: u64,
    pub currency: String,
    pub valuation_date: u64,
    pub valuator: Address,
    pub valuation_method: ValuationMethod,
    pub confidence_level: f32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ValuationMethod {
    MarketComparison,
    CostApproach,
    IncomeApproach,
    ExpertAppraisal,
    AutomatedValuation,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InsuranceInfo {
    pub provider: String,
    pub policy_number: String,
    pub coverage_amount: u64,
    pub premium_amount: u64,
    pub coverage_type: String,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MaintenanceRecord {
    pub record_id: u64,
    pub maintenance_date: u64,
    pub maintenance_type: String,
    pub provider: Address,
    pub cost: u64,
    pub description: String,
    pub documents: Vec<String>, // IPFS CIDs
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipTemplateParams {
    pub allowed_asset_types: Vec<AssetType>,
    pub required_proof_methods: Vec<ProofMethod>,
    pub transfer_restrictions: Vec<RestrictionType>,
    pub verification_requirements: VerificationRequirements,
    pub governance_rules: GovernanceRules,
    pub security_settings: SecuritySettings,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerificationRequirements {
    pub require_certificate: bool,
    pub require_legal_document: bool,
    pub require_blockchain_reference: bool,
    pub require_physical_verification: bool,
    pub min_verification_level: VerificationLevel,
    pub verification_frequency: Option<u64>, // in seconds
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
pub struct GovernanceRules {
    pub transfer_approval_required: bool,
    pub approval_threshold: u32,
    pub voting_period: u64,
    pub dispute_resolution: DisputeResolution,
    pub upgrade_procedure: UpgradeProcedure,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeResolution {
    SimpleMajority,
    Supermajority,
    Unanimous,
    Arbitration,
    CourtJurisdiction,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum UpgradeProcedure {
    Simple,
    MultiStage,
    TimeLocked,
    DAOVote,
    Automatic,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecuritySettings {
    pub encryption_required: bool,
    pub multi_signature_required: bool,
    pub audit_trail_enabled: bool,
    pub access_control_enabled: bool,
    pub fraud_detection_enabled: bool,
}

#[contract]
pub struct OwnershipProofContract;

#[contractimpl]
impl OwnershipProofContract {
    /// Initialize ownership proof contract
    pub fn initialize(env: Env, admin: Address, params: OwnershipTemplateParams) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        // Validate template parameters
        Self::validate_template_params(&params);

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TemplateParams, &params);
        env.storage().instance().set(&DataKey::OwnershipCount, &0u64);
        env.storage().instance().set(&DataKey::TransferCount, &0u64);
        env.storage().instance().set(&DataKey::RevokedOwnerships, &Vec::new(&env));
    }

    /// Create a new ownership proof
    pub fn create_ownership_proof(
        env: Env,
        asset_identifier: AssetIdentifier,
        owner: Address,
        ownership_type: OwnershipType,
        proof_data: OwnershipProofData,
        metadata: OwnershipMetadata,
        restrictions: Vec<OwnershipRestriction>,
        expires_at: Option<u64>,
    ) -> u64 {
        owner.require_auth();

        let params: OwnershipTemplateParams = env.storage().instance()
            .get(&DataKey::TemplateParams)
            .unwrap_or_else(|| panic!("Template parameters not found"));

        // Validate ownership creation request
        Self::validate_ownership_request(&env, &params, &asset_identifier, &ownership_type, &proof_data, &restrictions);

        let count: u64 = env.storage().instance().get(&DataKey::OwnershipCount).unwrap_or(0);
        let ownership_id = count + 1;

        let ownership_proof = OwnershipProof {
            id: ownership_id,
            asset_identifier: asset_identifier.clone(),
            owner: owner.clone(),
            ownership_type: ownership_type.clone(),
            proof_data: proof_data.clone(),
            transfer_history: Vec::new(&env),
            timestamp: env.ledger().timestamp(),
            expires_at,
            verified: false,
            restrictions: restrictions.clone(),
            metadata: metadata.clone(),
        };

        env.storage().instance().set(&DataKey::OwnershipProof(ownership_id), &ownership_proof);
        env.storage().instance().set(&DataKey::OwnershipCount, &ownership_id);

        // Store asset identifier separately for efficient querying
        env.storage().instance().set(&DataKey::AssetIdentifier(ownership_id), &asset_identifier);

        ownership_id
    }

    /// Verify an ownership proof
    pub fn verify_ownership_proof(env: Env, admin: Address, ownership_id: u64) -> bool {
        Self::require_admin(&env, &admin);

        let mut ownership_proof: OwnershipProof = env.storage().instance()
            .get(&DataKey::OwnershipProof(ownership_id))
            .unwrap_or_else(|| panic!("Ownership proof not found"));

        // Check if ownership has expired
        if let Some(expires_at) = ownership_proof.expires_at {
            if env.ledger().timestamp() > expires_at {
                return false;
            }
        }

        // Check if ownership has been revoked
        if Self::is_ownership_revoked(&env, ownership_id) {
            return false;
        }

        let params: OwnershipTemplateParams = env.storage().instance()
            .get(&DataKey::TemplateParams)
            .unwrap_or_else(|| panic!("Template parameters not found"));

        // Verify proof method requirements
        if !params.required_proof_methods.contains(&ownership_proof.proof_data.proof_method) {
            return false;
        }

        // Verify certificate if required
        if params.verification_requirements.require_certificate {
            if ownership_proof.proof_data.certificate_data.is_none() {
                return false;
            }
        }

        // Verify legal document if required
        if params.verification_requirements.require_legal_document {
            if ownership_proof.proof_data.legal_document_hash.is_none() {
                return false;
            }
        }

        // Verify blockchain reference if required
        if params.verification_requirements.require_blockchain_reference {
            if ownership_proof.proof_data.blockchain_reference.is_none() {
                return false;
            }
        }

        // Verify physical verification if required
        if params.verification_requirements.require_physical_verification {
            if ownership_proof.proof_data.physical_verification.is_none() {
                return false;
            }
        }

        ownership_proof.verified = true;
        env.storage().instance().set(&DataKey::OwnershipProof(ownership_id), &ownership_proof);

        true
    }

    /// Transfer ownership
    pub fn transfer_ownership(
        env: Env,
        ownership_id: u64,
        from_address: Address,
        to_address: Address,
        transfer_type: TransferType,
        consideration: Option<Consideration>,
        approval_signatures: Vec<Bytes>,
        metadata: Map<Symbol, String>,
    ) {
        let ownership_proof: OwnershipProof = env.storage().instance()
            .get(&DataKey::OwnershipProof(ownership_id))
            .unwrap_or_else(|| panic!("Ownership proof not found"));

        // Verify current owner
        if ownership_proof.owner != from_address {
            panic!("Not the current owner");
        }

        from_address.require_auth();

        let params: OwnershipTemplateParams = env.storage().instance()
            .get(&DataKey::TemplateParams)
            .unwrap_or_else(|| panic!("Template parameters not found"));

        // Check transfer restrictions
        for restriction in &ownership_proof.restrictions {
            if !Self::check_transfer_restriction(&env, restriction, &transfer_type, &to_address) {
                panic!("Transfer restricted: {:?}", restriction.restriction_type);
            }
        }

        // Check approval requirements
        if params.governance_rules.transfer_approval_required {
            if approval_signatures.len() < params.governance_rules.approval_threshold as usize {
                panic!("Insufficient approval signatures");
            }
        }

        let transfer_count: u64 = env.storage().instance().get(&DataKey::TransferCount).unwrap_or(0);
        let transfer_id = transfer_count + 1;

        let transfer_record = TransferRecord {
            transfer_id,
            from_address: from_address.clone(),
            to_address: to_address.clone(),
            transfer_date: env.ledger().timestamp(),
            transfer_type: transfer_type.clone(),
            consideration,
            approval_signatures,
            blockchain_tx: None,
            metadata,
        };

        // Update ownership proof
        let mut updated_ownership = ownership_proof;
        updated_ownership.owner = to_address.clone();
        updated_ownership.transfer_history.push_back(transfer_record.clone());

        env.storage().instance().set(&DataKey::OwnershipProof(ownership_id), &updated_ownership);
        env.storage().instance().set(&DataKey::TransferCount, &transfer_id);
        env.storage().instance().set(&DataKey::TransferRecord(transfer_id), &transfer_record);
    }

    /// Add maintenance record
    pub fn add_maintenance_record(
        env: Env,
        ownership_id: u64,
        maintenance_record: MaintenanceRecord,
    ) {
        let ownership_proof: OwnershipProof = env.storage().instance()
            .get(&DataKey::OwnershipProof(ownership_id))
            .unwrap_or_else(|| panic!("Ownership proof not found"));

        ownership_proof.owner.require_auth();

        let mut updated_ownership = ownership_proof;
        updated_ownership.metadata.maintenance_records.push_back(maintenance_record.clone());

        env.storage().instance().set(&DataKey::OwnershipProof(ownership_id), &updated_ownership);
    }

    /// Update ownership metadata
    pub fn update_ownership_metadata(
        env: Env,
        ownership_id: u64,
        metadata: OwnershipMetadata,
    ) {
        let ownership_proof: OwnershipProof = env.storage().instance()
            .get(&DataKey::OwnershipProof(ownership_id))
            .unwrap_or_else(|| panic!("Ownership proof not found"));

        ownership_proof.owner.require_auth();

        let mut updated_ownership = ownership_proof;
        updated_ownership.metadata = metadata;

        env.storage().instance().set(&DataKey::OwnershipProof(ownership_id), &updated_ownership);
    }

    /// Revoke ownership proof
    pub fn revoke_ownership_proof(
        env: Env,
        admin: Address,
        ownership_id: u64,
        reason: String,
    ) {
        Self::require_admin(&env, &admin);

        let mut ownership_proof: OwnershipProof = env.storage().instance()
            .get(&DataKey::OwnershipProof(ownership_id))
            .unwrap_or_else(|| panic!("Ownership proof not found"));

        ownership_proof.verified = false;

        env.storage().instance().set(&DataKey::OwnershipProof(ownership_id), &ownership_proof);

        // Add to revoked list
        let mut revoked_ownerships: Vec<u64> = env.storage().instance()
            .get(&DataKey::RevokedOwnerships)
            .unwrap_or(Vec::new(&env));
        
        revoked_ownerships.push_back(ownership_id);
        env.storage().instance().set(&DataKey::RevokedOwnerships, &revoked_ownerships);

        // Store revocation reason
        env.storage().instance().set(&DataKey::RevocationReason(ownership_id), &reason);
    }

    /// Get ownership proof details
    pub fn get_ownership_proof(env: Env, ownership_id: u64) -> OwnershipProof {
        env.storage().instance()
            .get(&DataKey::OwnershipProof(ownership_id))
            .unwrap_or_else(|| panic!("Ownership proof not found"))
    }

    /// Get all ownership proofs for an owner
    pub fn get_ownerships_by_owner(env: Env, owner: Address) -> Vec<OwnershipProof> {
        let count: u64 = env.storage().instance().get(&DataKey::OwnershipCount).unwrap_or(0);
        let mut ownerships = Vec::new(&env);
        
        for i in 1..=count {
            if let Some(ownership) = env.storage().instance().get::<DataKey, OwnershipProof>(&DataKey::OwnershipProof(i)) {
                if ownership.owner == owner {
                    ownerships.push_back(ownership);
                }
            }
        }
        
        ownerships
    }

    /// Get transfer history for an ownership
    pub fn get_transfer_history(env: Env, ownership_id: u64) -> Vec<TransferRecord> {
        let ownership_proof: OwnershipProof = env.storage().instance()
            .get(&DataKey::OwnershipProof(ownership_id))
            .unwrap_or_else(|| panic!("Ownership proof not found"));

        ownership_proof.transfer_history
    }

    /// Check if ownership is valid
    pub fn is_ownership_valid(env: Env, ownership_id: u64) -> bool {
        let ownership_proof: OwnershipProof = env.storage().instance()
            .get(&DataKey::OwnershipProof(ownership_id))
            .unwrap_or_else(|| panic!("Ownership proof not found"));

        // Check expiration
        if let Some(expires_at) = ownership_proof.expires_at {
            if env.ledger().timestamp() > expires_at {
                return false;
            }
        }

        // Check revocation
        !Self::is_ownership_revoked(&env, ownership_id) && ownership_proof.verified
    }

    // Private helper methods

    fn validate_template_params(params: &OwnershipTemplateParams) {
        // Validate allowed asset types
        if params.allowed_asset_types.is_empty() {
            panic!("At least one asset type must be allowed");
        }

        // Validate required proof methods
        if params.required_proof_methods.is_empty() {
            panic!("At least one proof method must be required");
        }

        // Validate governance rules
        if params.governance_rules.approval_threshold == 0 {
            panic!("Approval threshold must be greater than 0");
        }
    }

    fn validate_ownership_request(
        env: &Env,
        params: &OwnershipTemplateParams,
        asset_identifier: &AssetIdentifier,
        ownership_type: &OwnershipType,
        proof_data: &OwnershipProofData,
        restrictions: &Vec<OwnershipRestriction>,
    ) {
        // Check if asset type is allowed
        if !params.allowed_asset_types.contains(&asset_identifier.asset_type) {
            panic!("Asset type not allowed by template");
        }

        // Check if proof method is required
        if !params.required_proof_methods.contains(&proof_data.proof_method) {
            panic!("Proof method not allowed by template");
        }

        // Validate restrictions
        for restriction in restrictions {
            if !params.transfer_restrictions.contains(&restriction.restriction_type) {
                panic!("Restriction type not allowed by template: {:?}", restriction.restriction_type);
            }
        }
    }

    fn check_transfer_restriction(
        env: &Env,
        restriction: &OwnershipRestriction,
        transfer_type: &TransferType,
        to_address: &Address,
    ) -> bool {
        match restriction.restriction_type {
            RestrictionType::TransferRestriction => {
                // Check if transfer type is allowed
                restriction.restriction_data.get_unchecked(&Symbol::new(&env, "allowed_types"))
                    .contains(&transfer_type.to_string())
            }
            RestrictionType::GeographicRestriction => {
                // Check geographic restrictions (simplified)
                true // In practice, would check against location data
            }
            RestrictionType::TimeRestriction => {
                // Check time restrictions
                if let Some(expires_at) = restriction.expires_at {
                    env.ledger().timestamp() <= expires_at
                } else {
                    true
                }
            }
            _ => true, // Allow other restrictions by default
        }
    }

    fn is_ownership_revoked(env: &Env, ownership_id: u64) -> bool {
        let revoked_ownerships: Vec<u64> = env.storage().instance()
            .get(&DataKey::RevokedOwnerships)
            .unwrap_or(Vec::new(&env));
        
        revoked_ownerships.contains(&ownership_id)
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
    OwnershipCount,
    TransferCount,
    OwnershipProof(u64),
    AssetIdentifier(u64),
    TransferRecord(u64),
    RevokedOwnerships,
    RevocationReason(u64),
}
