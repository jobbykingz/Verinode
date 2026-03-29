use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MultiSigError {
    #[error("Transaction not found")]
    TransactionNotFound,
    #[error("Invalid signature")]
    InvalidSignature,
    #[error("Insufficient signatures")]
    InsufficientSignatures,
    #[error("Transaction already executed")]
    TransactionAlreadyExecuted,
    #[error("Transaction expired")]
    TransactionExpired,
    #[error("Unauthorized signer")]
    UnauthorizedSigner,
    #[error("Invalid threshold")]
    InvalidThreshold,
    #[error("Signer already exists")]
    SignerAlreadyExists,
    #[error("Signer not found")]
    SignerNotFound,
    #[error("Invalid nonce")]
    InvalidNonce,
    #[error("Duplicate signature")]
    DuplicateSignature,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiSigTransaction {
    pub id: String,
    pub nonce: u64,
    pub destination: String,
    pub value: u64,
    pub data: Vec<u8>,
    pub created_at: u64,
    pub expires_at: Option<u64>,
    pub required_signatures: u8,
    pub signatures: HashMap<String, Signature>,
    pub executed: bool,
    pub executed_at: Option<u64>,
    pub executed_by: Option<String>,
    pub transaction_type: TransactionType,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature {
    pub signer: String,
    pub signature: Vec<u8>,
    pub signed_at: u64,
    pub message_hash: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransactionType {
    Transfer,
    ContractCall,
    ContractDeployment,
    ParameterChange,
    EmergencyAction,
    SignerManagement,
    Custom(String),
}

impl TransactionType {
    pub fn as_str(&self) -> &str {
        match self {
            TransactionType::Transfer => "transfer",
            TransactionType::ContractCall => "contract_call",
            TransactionType::ContractDeployment => "contract_deployment",
            TransactionType::ParameterChange => "parameter_change",
            TransactionType::EmergencyAction => "emergency_action",
            TransactionType::SignerManagement => "signer_management",
            TransactionType::Custom(name) => name,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signer {
    pub address: String,
    pub weight: u8,
    pub is_active: bool,
    pub added_at: u64,
    pub added_by: String,
    pub last_signed: Option<u64>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiSigConfig {
    pub signers: HashMap<String, Signer>,
    pub threshold: u8,
    pub nonce: u64,
    pub transaction_timeout: u64, // in seconds
    pub max_signers: u8,
    pub require_all_for_emergency: bool,
    pub auto_cleanup: bool,
    pub max_transaction_value: Option<u64>,
}

impl Default for MultiSigConfig {
    fn default() -> Self {
        Self {
            signers: HashMap::new(),
            threshold: 2,
            nonce: 0,
            transaction_timeout: 7 * 24 * 3600, // 7 days
            max_signers: 10,
            require_all_for_emergency: true,
            auto_cleanup: true,
            max_transaction_value: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiSigStats {
    pub total_transactions: usize,
    pub pending_transactions: usize,
    pub executed_transactions: usize,
    pub expired_transactions: usize,
    pub active_signers: usize,
    pub total_signers: usize,
    pub current_threshold: u8,
    pub average_execution_time: f64,
    pub success_rate: f64,
}

#[derive(Debug)]
pub struct MultiSigSecurity {
    config: MultiSigConfig,
    transactions: HashMap<String, MultiSigTransaction>,
    transaction_history: Vec<MultiSigTransaction>,
    signer_history: Vec<Signer>,
}

impl MultiSigSecurity {
    pub fn new(config: MultiSigConfig) -> Self {
        Self {
            config,
            transactions: HashMap::new(),
            transaction_history: Vec::new(),
            signer_history: Vec::new(),
        }
    }

    pub fn create_transaction(
        &mut self,
        destination: String,
        value: u64,
        data: Vec<u8>,
        transaction_type: TransactionType,
        required_signatures: Option<u8>,
        expires_in: Option<u64>,
        metadata: HashMap<String, String>,
        creator: &str,
    ) -> Result<String, MultiSigError> {
        // Verify creator is an active signer
        if !self.is_active_signer(creator) {
            return Err(MultiSigError::UnauthorizedSigner);
        }

        // Check transaction value limit
        if let Some(max_value) = self.config.max_transaction_value {
            if value > max_value {
                return Err(MultiSigError::InvalidThreshold); // Using existing error for simplicity
            }
        }

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let expires_at = expires_in.map(|duration| current_time + duration);

        let required_signatures = required_signatures.unwrap_or(self.config.threshold);

        // Validate required signatures
        if required_signatures == 0 || required_signatures > self.get_active_signer_count() {
            return Err(MultiSigError::InvalidThreshold);
        }

        // Special handling for emergency transactions
        if matches!(transaction_type, TransactionType::EmergencyAction) && self.config.require_all_for_emergency {
            let required_signatures = self.get_active_signer_count();
        }

        let transaction_id = format!("tx_{}_{}", self.config.nonce, current_time);

        let transaction = MultiSigTransaction {
            id: transaction_id.clone(),
            nonce: self.config.nonce,
            destination,
            value,
            data,
            created_at: current_time,
            expires_at,
            required_signatures,
            signatures: HashMap::new(),
            executed: false,
            executed_at: None,
            executed_by: None,
            transaction_type,
            metadata,
        };

        self.transactions.insert(transaction_id.clone(), transaction);
        self.config.nonce += 1;

        Ok(transaction_id)
    }

    pub fn sign_transaction(
        &mut self,
        transaction_id: &str,
        signer: &str,
        signature: Vec<u8>,
        message_hash: Vec<u8>,
    ) -> Result<(), MultiSigError> {
        // Verify signer is authorized
        if !self.is_active_signer(signer) {
            return Err(MultiSigError::UnauthorizedSigner);
        }

        let transaction = self.transactions.get_mut(transaction_id)
            .ok_or(MultiSigError::TransactionNotFound)?;

        // Check if transaction is already executed
        if transaction.executed {
            return Err(MultiSigError::TransactionAlreadyExecuted);
        }

        // Check if transaction has expired
        if let Some(expires_at) = transaction.expires_at {
            let current_time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            if current_time > expires_at {
                return Err(MultiSigError::TransactionExpired);
            }
        }

        // Check for duplicate signature
        if transaction.signatures.contains_key(signer) {
            return Err(MultiSigError::DuplicateSignature);
        }

        // Verify signature (simplified - in production, use proper cryptographic verification)
        if !self.verify_signature(&message_hash, &signature, signer) {
            return Err(MultiSigError::InvalidSignature);
        }

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let sig = Signature {
            signer: signer.to_string(),
            signature,
            signed_at: current_time,
            message_hash,
        };

        transaction.signatures.insert(signer.to_string(), sig);

        // Update signer's last signed timestamp
        if let Some(signer_info) = self.config.signers.get_mut(signer) {
            signer_info.last_signed = Some(current_time);
        }

        Ok(())
    }

    pub fn execute_transaction(
        &mut self,
        transaction_id: &str,
        executor: &str,
    ) -> Result<MultiSigTransaction, MultiSigError> {
        // Verify executor is authorized
        if !self.is_active_signer(executor) {
            return Err(MultiSigError::UnauthorizedSigner);
        }

        let transaction = self.transactions.get_mut(transaction_id)
            .ok_or(MultiSigError::TransactionNotFound)?;

        // Check if transaction is already executed
        if transaction.executed {
            return Err(MultiSigError::TransactionAlreadyExecuted);
        }

        // Check if transaction has expired
        if let Some(expires_at) = transaction.expires_at {
            let current_time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            if current_time > expires_at {
                return Err(MultiSigError::TransactionExpired);
            }
        }

        // Check if sufficient signatures
        let signature_count = transaction.signatures.len() as u8;
        if signature_count < transaction.required_signatures {
            return Err(MultiSigError::InsufficientSignatures);
        }

        // Execute transaction (in a real implementation, this would interact with the blockchain)
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        transaction.executed = true;
        transaction.executed_at = Some(current_time);
        transaction.executed_by = Some(executor.to_string());

        let executed_transaction = transaction.clone();

        // Move to history
        self.transaction_history.push(executed_transaction.clone());
        self.transactions.remove(transaction_id);

        Ok(executed_transaction)
    }

    pub fn add_signer(
        &mut self,
        address: String,
        weight: u8,
        metadata: HashMap<String, String>,
        creator: &str,
    ) -> Result<(), MultiSigError> {
        // Verify creator is authorized (requires special permissions)
        if !self.is_admin_signer(creator) {
            return Err(MultiSigError::UnauthorizedSigner);
        }

        // Check if signer already exists
        if self.config.signers.contains_key(&address) {
            return Err(MultiSigError::SignerAlreadyExists);
        }

        // Check max signers limit
        if self.config.signers.len() >= self.config.max_signers as usize {
            return Err(MultiSigError::InvalidThreshold);
        }

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let signer = Signer {
            address: address.clone(),
            weight,
            is_active: true,
            added_at: current_time,
            added_by: creator.to_string(),
            last_signed: None,
            metadata,
        };

        self.config.signers.insert(address.clone(), signer.clone());
        self.signer_history.push(signer);

        Ok(())
    }

    pub fn remove_signer(
        &mut self,
        address: &str,
        remover: &str,
    ) -> Result<(), MultiSigError> {
        // Verify remover is authorized
        if !self.is_admin_signer(remover) {
            return Err(MultiSigError::UnauthorizedSigner);
        }

        let signer = self.config.signers.get_mut(address)
            .ok_or(MultiSigError::SignerNotFound)?;

        // Check if removing this signer would make the system unusable
        let active_signers = self.get_active_signer_count();
        if active_signers <= 1 {
            return Err(MultiSigError::InvalidThreshold);
        }

        // Check if removing this signer would make threshold unachievable
        if self.config.threshold > active_signers - 1 {
            return Err(MultiSigError::InvalidThreshold);
        }

        signer.is_active = false;

        Ok(())
    }

    pub fn update_threshold(
        &mut self,
        new_threshold: u8,
        updater: &str,
    ) -> Result<(), MultiSigError> {
        // Verify updater is authorized
        if !self.is_admin_signer(updater) {
            return Err(MultiSigError::UnauthorizedSigner);
        }

        let active_signers = self.get_active_signer_count();

        // Validate new threshold
        if new_threshold == 0 || new_threshold > active_signers {
            return Err(MultiSigError::InvalidThreshold);
        }

        self.config.threshold = new_threshold;

        Ok(())
    }

    pub fn get_transaction(&self, transaction_id: &str) -> Option<&MultiSigTransaction> {
        self.transactions.get(transaction_id)
    }

    pub fn get_pending_transactions(&self) -> Vec<&MultiSigTransaction> {
        self.transactions.values()
            .filter(|tx| !tx.executed)
            .collect()
    }

    pub fn get_ready_transactions(&self) -> Vec<&MultiSigTransaction> {
        self.transactions.values()
            .filter(|tx| {
                !tx.executed && 
                (tx.signatures.len() as u8) >= tx.required_signatures
            })
            .collect()
    }

    pub fn get_signer(&self, address: &str) -> Option<&Signer> {
        self.config.signers.get(address)
    }

    pub fn get_all_signers(&self) -> Vec<&Signer> {
        self.config.signers.values().collect()
    }

    pub fn get_active_signers(&self) -> Vec<&Signer> {
        self.config.signers.values()
            .filter(|signer| signer.is_active)
            .collect()
    }

    pub fn get_transaction_history(&self) -> &[MultiSigTransaction] {
        &self.transaction_history
    }

    pub fn get_stats(&self) -> MultiSigStats {
        let pending = self.transactions.values()
            .filter(|tx| !tx.executed)
            .count();

        let executed = self.transaction_history.len();
        let total = pending + executed;

        let expired = self.transactions.values()
            .filter(|tx| {
                if let Some(expires_at) = tx.expires_at {
                    let current_time = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_secs();
                    current_time > expires_at
                } else {
                    false
                }
            })
            .count();

        let active_signers = self.get_active_signer_count();
        let total_signers = self.config.signers.len();

        // Calculate average execution time
        let total_execution_time: u64 = self.transaction_history.iter()
            .filter_map(|tx| {
                tx.executed_at.map(|executed_at| executed_at - tx.created_at)
            })
            .sum();

        let average_execution_time = if self.transaction_history.len() > 0 {
            total_execution_time as f64 / self.transaction_history.len() as f64
        } else {
            0.0
        };

        // Calculate success rate
        let success_rate = if total > 0 {
            executed as f64 / total as f64
        } else {
            1.0
        };

        MultiSigStats {
            total_transactions: total,
            pending_transactions: pending,
            executed_transactions: executed,
            expired_transactions: expired,
            active_signers,
            total_signers,
            current_threshold: self.config.threshold,
            average_execution_time,
            success_rate,
        }
    }

    pub fn cleanup_expired_transactions(&mut self) -> usize {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let initial_count = self.transactions.len();
        
        self.transactions.retain(|_, transaction| {
            if let Some(expires_at) = transaction.expires_at {
                current_time <= expires_at
            } else {
                true
            }
        });

        initial_count - self.transactions.len()
    }

    pub fn get_signatures_for_transaction(&self, transaction_id: &str) -> Option<Vec<&Signature>> {
        self.transactions.get(transaction_id)
            .map(|tx| tx.signatures.values().collect())
    }

    pub fn can_execute(&self, transaction_id: &str) -> bool {
        if let Some(transaction) = self.transactions.get(transaction_id) {
            if transaction.executed {
                return false;
            }

            // Check expiration
            if let Some(expires_at) = transaction.expires_at {
                let current_time = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                
                if current_time > expires_at {
                    return false;
                }
            }

            // Check signatures
            (transaction.signatures.len() as u8) >= transaction.required_signatures
        } else {
            false
        }
    }

    fn is_active_signer(&self, address: &str) -> bool {
        self.config.signers.get(address)
            .map(|signer| signer.is_active)
            .unwrap_or(false)
    }

    fn is_admin_signer(&self, address: &str) -> bool {
        // For simplicity, consider all signers as admin for signer management
        // In production, you might want to have a separate admin role
        self.is_active_signer(address)
    }

    fn get_active_signer_count(&self) -> u8 {
        self.config.signers.values()
            .filter(|signer| signer.is_active)
            .count() as u8
    }

    fn verify_signature(&self, message_hash: &[u8], signature: &[u8], signer: &str) -> bool {
        // Simplified signature verification
        // In production, use proper cryptographic verification
        // This is just a placeholder
        signature.len() > 0 && signer.len() > 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> MultiSigConfig {
        let mut signers = HashMap::new();
        
        signers.insert("signer1".to_string(), Signer {
            address: "signer1".to_string(),
            weight: 1,
            is_active: true,
            added_at: 0,
            added_by: "creator".to_string(),
            last_signed: None,
            metadata: HashMap::new(),
        });

        signers.insert("signer2".to_string(), Signer {
            address: "signer2".to_string(),
            weight: 1,
            is_active: true,
            added_at: 0,
            added_by: "creator".to_string(),
            last_signed: None,
            metadata: HashMap::new(),
        });

        MultiSigConfig {
            signers,
            threshold: 2,
            nonce: 0,
            transaction_timeout: 7 * 24 * 3600,
            max_signers: 10,
            require_all_for_emergency: true,
            auto_cleanup: true,
            max_transaction_value: None,
        }
    }

    #[test]
    fn test_create_transaction() {
        let mut multisig = MultiSigSecurity::new(create_test_config());
        
        let result = multisig.create_transaction(
            "0x123".to_string(),
            1000,
            vec![1, 2, 3],
            TransactionType::Transfer,
            None,
            None,
            HashMap::new(),
            "signer1",
        );

        assert!(result.is_ok());
        assert_eq!(multisig.transactions.len(), 1);
    }

    #[test]
    fn test_sign_transaction() {
        let mut multisig = MultiSigSecurity::new(create_test_config());
        
        let tx_id = multisig.create_transaction(
            "0x123".to_string(),
            1000,
            vec![1, 2, 3],
            TransactionType::Transfer,
            None,
            None,
            HashMap::new(),
            "signer1",
        ).unwrap();

        let result = multisig.sign_transaction(
            &tx_id,
            "signer1",
            vec![1, 2, 3, 4],
            vec![5, 6, 7, 8],
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_execute_transaction() {
        let mut multisig = MultiSigSecurity::new(create_test_config());
        
        let tx_id = multisig.create_transaction(
            "0x123".to_string(),
            1000,
            vec![1, 2, 3],
            TransactionType::Transfer,
            None,
            None,
            HashMap::new(),
            "signer1",
        ).unwrap();

        multisig.sign_transaction(&tx_id, "signer1", vec![1, 2, 3, 4], vec![5, 6, 7, 8]).unwrap();
        multisig.sign_transaction(&tx_id, "signer2", vec![1, 2, 3, 4], vec![5, 6, 7, 8]).unwrap();

        let result = multisig.execute_transaction(&tx_id, "signer1");
        assert!(result.is_ok());
        assert_eq!(multisig.transaction_history.len(), 1);
    }

    #[test]
    fn test_insufficient_signatures() {
        let mut multisig = MultiSigSecurity::new(create_test_config());
        
        let tx_id = multisig.create_transaction(
            "0x123".to_string(),
            1000,
            vec![1, 2, 3],
            TransactionType::Transfer,
            None,
            None,
            HashMap::new(),
            "signer1",
        ).unwrap();

        multisig.sign_transaction(&tx_id, "signer1", vec![1, 2, 3, 4], vec![5, 6, 7, 8]).unwrap();

        let result = multisig.execute_transaction(&tx_id, "signer1");
        assert!(matches!(result, Err(MultiSigError::InsufficientSignatures)));
    }
}
