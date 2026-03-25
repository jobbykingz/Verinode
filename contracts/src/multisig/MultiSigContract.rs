use soroban_sdk::{contract, contractimpl, Address, Env, Vec, Map, String, Bool, BytesN, Uint256, Symbol, panic_with_error};
use soroban_sdk::auth::{ContractContext, SubContractContext};
use soroban_sdk::crypto::sha256;

// Error codes
const ERROR_NOT_AUTHORIZED: u32 = 1;
const ERROR_INVALID_THRESHOLD: u32 = 2;
const ERROR_SIGNATURE_ALREADY_EXISTS: u32 = 3;
const ERROR_INSUFFICIENT_SIGNATURES: u32 = 4;
const ERROR_INVALID_OPERATION: u32 = 5;
const ERROR_WALLET_FROZEN: u32 = 6;
const ERROR_EXPIRED_REQUEST: u32 = 7;
const ERROR_INVALID_SIGNER: u32 = 8;
const ERROR_THRESHOLD_NOT_MET: u32 = 9;
const ERROR_ALREADY_EXECUTED: u32 = 10;

// Contract state keys
const WALLET_CONFIG: Symbol = symbol!("wallet_config");
const SIGNATURE_REQUESTS: Symbol = symbol!("signature_requests");
const WALLET_STATE: Symbol = symbol!("wallet_state");
const NONCES: Symbol = symbol!("nonces");

#[derive(Clone)]
pub struct WalletConfig {
    pub threshold: u32,
    pub signers: Map<Address, SignerInfo>,
    pub max_signers: u32,
    pub allow_signer_removal: Bool,
    pub require_all_for_critical: Bool,
}

#[derive(Clone)]
pub struct SignerInfo {
    pub name: String,
    pub role: SignerRole,
    pub weight: u32,
    pub active: Bool,
    pub added_at: u64,
}

#[derive(Clone)]
pub enum SignerRole {
    Owner,
    Admin,
    Signer,
}

#[derive(Clone)]
pub struct SignatureRequest {
    pub request_id: BytesN<32>,
    pub operation_type: OperationType,
    pub payload: Vec<u8>,
    pub signatures: Map<Address, Signature>,
    pub status: RequestStatus,
    pub created_at: u64,
    pub expires_at: u64,
    pub threshold_required: u32,
    pub current_weight: u32,
    pub nonce: BytesN<32>,
    pub hash: BytesN<32>,
}

#[derive(Clone)]
pub enum OperationType {
    ProofCreation,
    ProofVerification,
    ContractInteraction,
    TokenTransfer,
    ConfigChange,
    SignerManagement,
    EmergencyActions,
}

#[derive(Clone)]
pub struct Signature {
    pub signature: Vec<u8>,
    pub signed_at: u64,
    pub weight: u32,
    pub metadata: Vec<u8>,
}

#[derive(Clone)]
pub enum RequestStatus {
    Pending,
    Approved,
    Rejected,
    Expired,
    Executed,
    Failed,
}

#[derive(Clone)]
pub struct WalletState {
    pub is_active: Bool,
    pub is_frozen: Bool,
    pub frozen_by: Option<Address>,
    pub frozen_at: Option<u64>,
    pub freeze_reason: Option<String>,
    pub daily_limit: Uint256,
    pub single_transaction_limit: Uint256,
    pub daily_spent: Uint256,
    pub last_reset: u64,
}

pub struct MultiSigContract;

#[contractimpl]
impl MultiSigContract {
    /// Initialize the multi-signature wallet
    pub fn initialize(
        env: Env,
        threshold: u32,
        signers: Vec<Address>,
        signer_names: Vec<String>,
        signer_weights: Vec<u32>,
        max_signers: u32,
    ) {
        // Validate inputs
        if threshold == 0 || threshold > signers.len() as u32 {
            panic_with_error!(&env, ERROR_INVALID_THRESHOLD);
        }

        if signers.len() as u32 > max_signers {
            panic_with_error!(&env, ERROR_INVALID_THRESHOLD);
        }

        // Create signer map
        let mut signer_map = Map::new(&env);
        let current_time = env.ledger().timestamp();

        for (i, signer) in signers.iter().enumerate() {
            let signer_info = SignerInfo {
                name: signer_names.get(i).unwrap().clone(),
                role: SignerRole::Signer, // Default role
                weight: signer_weights.get(i).unwrap_or(&1).clone(),
                active: true,
                added_at: current_time,
            };
            signer_map.set(signer, signer_info);
        }

        // Initialize wallet configuration
        let config = WalletConfig {
            threshold,
            signers: signer_map,
            max_signers,
            allow_signer_removal: true,
            require_all_for_critical: false,
        };

        // Initialize wallet state
        let state = WalletState {
            is_active: true,
            is_frozen: false,
            frozen_by: None,
            frozen_at: None,
            freeze_reason: None,
            daily_limit: Uint256::from_u1000000(1000000), // Default limit
            single_transaction_limit: Uint256::from_u1000000(100000),
            daily_spent: Uint256::from_u1000000(0),
            last_reset: current_time,
        };

        // Store configuration and state
        env.storage().instance().set(&WALLET_CONFIG, &config);
        env.storage().instance().set(&WALLET_STATE, &state);
        env.storage().instance().set(&SIGNATURE_REQUESTS, &Map::new(&env));
        env.storage().instance().set(&NONCES, &Map::new(&env));
    }

    /// Create a new signature request
    pub fn create_signature_request(
        env: Env,
        request_id: BytesN<32>,
        operation_type: OperationType,
        payload: Vec<u8>,
        expires_in_hours: u32,
        nonce: BytesN<32>,
    ) -> BytesN<32> {
        // Check if wallet is frozen
        let state: WalletState = env.storage().instance().get(&WALLET_STATE).unwrap();
        if state.is_frozen {
            panic_with_error!(&env, ERROR_WALLET_FROZEN);
        }

        // Calculate hash
        let mut hash_input = Vec::new(&env);
        hash_input.push_back(&request_id);
        hash_input.push_back(&payload);
        hash_input.push_back(&nonce);
        let hash = sha256::hash(&env, &hash_input);

        // Set expiration time
        let current_time = env.ledger().timestamp();
        let expires_at = current_time + (expires_in_hours as u64 * 3600);

        // Get threshold for this operation type
        let config: WalletConfig = env.storage().instance().get(&WALLET_CONFIG).unwrap();
        let threshold_required = Self::calculate_threshold(&config, &operation_type);

        // Create signature request
        let request = SignatureRequest {
            request_id,
            operation_type,
            payload,
            signatures: Map::new(&env),
            status: RequestStatus::Pending,
            created_at: current_time,
            expires_at,
            threshold_required,
            current_weight: 0,
            nonce,
            hash,
        };

        // Store the request
        let mut requests: Map<BytesN<32>, SignatureRequest> = env.storage().instance().get(&SIGNATURE_REQUESTS).unwrap();
        requests.set(request_id, request);
        env.storage().instance().set(&SIGNATURE_REQUESTS, &requests);

        // Store nonce to prevent reuse
        let mut nonces: Map<BytesN<32>, u64> = env.storage().instance().get(&NONCES).unwrap();
        nonces.set(nonce, current_time);
        env.storage().instance().set(&NONCES, &nonces);

        request_id
    }

    /// Add signature to a request
    pub fn add_signature(
        env: Env,
        request_id: BytesN<32>,
        signer: Address,
        signature: Vec<u8>,
        metadata: Vec<u8>,
    ) {
        // Get the signature request
        let mut requests: Map<BytesN<32>, SignatureRequest> = env.storage().instance().get(&SIGNATURE_REQUESTS).unwrap();
        let mut request: SignatureRequest = requests.get(request_id).unwrap_or_else(|| {
            panic_with_error!(&env, ERROR_INVALID_OPERATION);
        });

        // Validate request status
        if request.status != RequestStatus::Pending {
            panic_with_error!(&env, ERROR_INVALID_OPERATION);
        }

        // Check if expired
        let current_time = env.ledger().timestamp();
        if current_time > request.expires_at {
            request.status = RequestStatus::Expired;
            requests.set(request_id, request);
            env.storage().instance().set(&SIGNATURE_REQUESTS, &requests);
            panic_with_error!(&env, ERROR_EXPIRED_REQUEST);
        }

        // Check if already signed
        if request.signatures.contains_key(&signer) {
            panic_with_error!(&env, ERROR_SIGNATURE_ALREADY_EXISTS);
        }

        // Validate signer
        let config: WalletConfig = env.storage().instance().get(&WALLET_CONFIG).unwrap();
        let signer_info = config.signers.get(&signer).unwrap_or_else(|| {
            panic_with_error!(&env, ERROR_INVALID_SIGNER);
        });

        if !signer_info.active {
            panic_with_error!(&env, ERROR_INVALID_SIGNER);
        }

        // Verify signature (simplified - in production, implement proper crypto verification)
        // This is a placeholder for actual signature verification
        let is_valid = Self::verify_signature(&env, &request.hash, &signature, &signer);
        if !is_valid {
            panic_with_error!(&env, ERROR_NOT_AUTHORIZED);
        }

        // Add signature
        let sig_data = Signature {
            signature,
            signed_at: current_time,
            weight: signer_info.weight,
            metadata,
        };

        request.signatures.set(signer, sig_data);
        request.current_weight += signer_info.weight;

        // Check if threshold is met
        if request.current_weight >= request.threshold_required {
            request.status = RequestStatus::Approved;
        }

        // Update request
        requests.set(request_id, request);
        env.storage().instance().set(&SIGNATURE_REQUESTS, &requests);
    }

    /// Execute an approved signature request
    pub fn execute_request(env: Env, request_id: BytesN<32>) {
        // Get the signature request
        let mut requests: Map<BytesN<32>, SignatureRequest> = env.storage().instance().get(&SIGNATURE_REQUESTS).unwrap();
        let mut request: SignatureRequest = requests.get(request_id).unwrap_or_else(|| {
            panic_with_error!(&env, ERROR_INVALID_OPERATION);
        });

        // Validate request status
        if request.status != RequestStatus::Approved {
            panic_with_error!(&env, ERROR_THRESHOLD_NOT_MET);
        }

        // Check if wallet is frozen
        let state: WalletState = env.storage().instance().get(&WALLET_STATE).unwrap();
        if state.is_frozen {
            panic_with_error!(&env, ERROR_WALLET_FROZEN);
        }

        // Execute the operation based on type
        let execution_result = match request.operation_type {
            OperationType::ProofCreation => Self::execute_proof_creation(&env, &request.payload),
            OperationType::ProofVerification => Self::execute_proof_verification(&env, &request.payload),
            OperationType::ContractInteraction => Self::execute_contract_interaction(&env, &request.payload),
            OperationType::TokenTransfer => Self::execute_token_transfer(&env, &request.payload),
            OperationType::ConfigChange => Self::execute_config_change(&env, &request.payload),
            OperationType::SignerManagement => Self::execute_signer_management(&env, &request.payload),
            OperationType::EmergencyActions => Self::execute_emergency_actions(&env, &request.payload),
        };

        // Update request status
        request.status = if execution_result {
            RequestStatus::Executed
        } else {
            RequestStatus::Failed
        };

        requests.set(request_id, request);
        env.storage().instance().set(&SIGNATURE_REQUESTS, &requests);
    }

    /// Update wallet configuration (requires multi-sig)
    pub fn update_config(
        env: Env,
        request_id: BytesN<32>,
        new_threshold: Option<u32>,
        new_max_signers: Option<u32>,
        allow_signer_removal: Option<bool>,
        require_all_for_critical: Option<bool>,
    ) {
        // This must be called through a signature request
        Self::execute_request(env, request_id);

        // Update configuration if execution was successful
        let mut config: WalletConfig = env.storage().instance().get(&WALLET_CONFIG).unwrap();
        
        if let Some(threshold) = new_threshold {
            config.threshold = threshold;
        }
        if let Some(max_signers) = new_max_signers {
            config.max_signers = max_signers;
        }
        if let Some(allow) = allow_signer_removal {
            config.allow_signer_removal = Bool::from(allow);
        }
        if let Some(require) = require_all_for_critical {
            config.require_all_for_critical = Bool::from(require);
        }

        env.storage().instance().set(&WALLET_CONFIG, &config);
    }

    /// Add or remove signers (requires multi-sig)
    pub fn manage_signers(
        env: Env,
        request_id: BytesN<32>,
        action: bool, // true = add, false = remove
        signers: Vec<Address>,
        signer_names: Vec<String>,
        signer_weights: Vec<u32>,
    ) {
        // This must be called through a signature request
        Self::execute_request(env, request_id);

        let mut config: WalletConfig = env.storage().instance().get(&WALLET_CONFIG).unwrap();
        let current_time = env.ledger().timestamp();

        if action {
            // Add signers
            for (i, signer) in signers.iter().enumerate() {
                if config.signers.len() >= config.max_signers as usize {
                    panic_with_error!(&env, ERROR_INVALID_THRESHOLD);
                }

                let signer_info = SignerInfo {
                    name: signer_names.get(i).unwrap().clone(),
                    role: SignerRole::Signer,
                    weight: signer_weights.get(i).unwrap_or(&1).clone(),
                    active: true,
                    added_at: current_time,
                };
                config.signers.set(signer, signer_info);
            }
        } else {
            // Remove signers
            if !config.allow_signer_removal {
                panic_with_error!(&env, ERROR_NOT_AUTHORIZED);
            }

            for signer in signers.iter() {
                config.signers.remove(signer);
            }
        }

        env.storage().instance().set(&WALLET_CONFIG, &config);
    }

    /// Freeze or unfreeze the wallet (requires multi-sig)
    pub fn freeze_wallet(
        env: Env,
        request_id: BytesN<32>,
        freeze: bool,
        reason: Option<String>,
    ) {
        // This must be called through a signature request
        Self::execute_request(env, request_id);

        let mut state: WalletState = env.storage().instance().get(&WALLET_STATE).unwrap();
        let current_time = env.ledger().timestamp();

        if freeze {
            state.is_frozen = true;
            state.frozen_at = Some(current_time);
            state.freeze_reason = reason;
        } else {
            state.is_frozen = false;
            state.frozen_at = None;
            state.freeze_reason = None;
        }

        env.storage().instance().set(&WALLET_STATE, &state);
    }

    /// Get wallet configuration
    pub fn get_wallet_config(env: Env) -> WalletConfig {
        env.storage().instance().get(&WALLET_CONFIG).unwrap()
    }

    /// Get wallet state
    pub fn get_wallet_state(env: Env) -> WalletState {
        env.storage().instance().get(&WALLET_STATE).unwrap()
    }

    /// Get signature request
    pub fn get_signature_request(env: Env, request_id: BytesN<32>) -> SignatureRequest {
        let requests: Map<BytesN<32>, SignatureRequest> = env.storage().instance().get(&SIGNATURE_REQUESTS).unwrap();
        requests.get(request_id).unwrap_or_else(|| {
            panic_with_error!(&env, ERROR_INVALID_OPERATION);
        })
    }

    /// Get all signature requests
    pub fn get_all_signature_requests(env: Env) -> Vec<SignatureRequest> {
        let requests: Map<BytesN<32>, SignatureRequest> = env.storage().instance().get(&SIGNATURE_REQUESTS).unwrap();
        requests.values()
    }

    // Private helper methods

    fn calculate_threshold(config: &WalletConfig, operation_type: &OperationType) -> u32 {
        if config.require_all_for_critical {
            match operation_type {
                OperationType::ConfigChange | OperationType::SignerManagement | OperationType::EmergencyActions => {
                    // Require all active signers for critical operations
                    let total_weight = config.signers.values()
                        .filter(|s| s.active)
                        .map(|s| s.weight)
                        .sum();
                    total_weight
                }
                _ => config.threshold,
            }
        } else {
            config.threshold
        }
    }

    fn verify_signature(env: &Env, hash: &BytesN<32>, signature: &Vec<u8>, signer: &Address) -> bool {
        // Placeholder for signature verification
        // In production, implement proper cryptographic verification
        // This would verify that the signature was created by the signer for the given hash
        true
    }

    // Operation execution methods (placeholders)

    fn execute_proof_creation(env: &Env, payload: &Vec<u8>) -> bool {
        // Placeholder for proof creation logic
        true
    }

    fn execute_proof_verification(env: &Env, payload: &Vec<u8>) -> bool {
        // Placeholder for proof verification logic
        true
    }

    fn execute_contract_interaction(env: &Env, payload: &Vec<u8>) -> bool {
        // Placeholder for contract interaction logic
        true
    }

    fn execute_token_transfer(env: &Env, payload: &Vec<u8>) -> bool {
        // Placeholder for token transfer logic
        true
    }

    fn execute_config_change(env: &Env, payload: &Vec<u8>) -> bool {
        // Placeholder for config change logic
        true
    }

    fn execute_signer_management(env: &Env, payload: &Vec<u8>) -> bool {
        // Placeholder for signer management logic
        true
    }

    fn execute_emergency_actions(env: &Env, payload: &Vec<u8>) -> bool {
        // Placeholder for emergency actions logic
        true
    }
}
