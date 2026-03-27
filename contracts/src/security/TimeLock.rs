use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TimeLockError {
    #[error("Operation is still time-locked. Unlock at {unlock_time}")]
    OperationLocked { unlock_time: u64 },
    #[error("Operation not found")]
    OperationNotFound,
    #[error("Invalid time lock duration")]
    InvalidDuration,
    #[error("Unauthorized access")]
    Unauthorized,
    #[error("Operation already executed")]
    AlreadyExecuted,
    #[error("Time lock has expired")]
    TimeLockExpired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeLockOperation {
    pub id: String,
    pub operation_type: String,
    pub target_address: String,
    pub data: Vec<u8>,
    pub created_at: u64,
    pub unlock_time: u64,
    pub expires_at: Option<u64>,
    pub executor: String,
    pub is_executed: bool,
    pub priority: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeLockConfig {
    pub min_delay: Duration,
    pub max_delay: Duration,
    pub default_delay: Duration,
    pub admin_addresses: Vec<String>,
    pub emergency_addresses: Vec<String>,
}

impl Default for TimeLockConfig {
    fn default() -> Self {
        Self {
            min_delay: Duration::from_secs(3600), // 1 hour
            max_delay: Duration::from_secs(30 * 24 * 3600), // 30 days
            default_delay: Duration::from_secs(24 * 3600), // 24 hours
            admin_addresses: Vec::new(),
            emergency_addresses: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationType {
    Transfer,
    ContractUpgrade,
    ParameterChange,
    RoleModification,
    EmergencyAction,
    Custom(String),
}

impl OperationType {
    pub fn as_str(&self) -> &str {
        match self {
            OperationType::Transfer => "transfer",
            OperationType::ContractUpgrade => "contract_upgrade",
            OperationType::ParameterChange => "parameter_change",
            OperationType::RoleModification => "role_modification",
            OperationType::EmergencyAction => "emergency_action",
            OperationType::Custom(name) => name,
        }
    }
}

#[derive(Debug)]
pub struct TimeLock {
    operations: HashMap<String, TimeLockOperation>,
    config: TimeLockConfig,
    operation_history: Vec<TimeLockOperation>,
}

impl TimeLock {
    pub fn new(config: TimeLockConfig) -> Self {
        Self {
            operations: HashMap::new(),
            config,
            operation_history: Vec::new(),
        }
    }

    pub fn create_time_lock(
        &mut self,
        id: String,
        operation_type: OperationType,
        target_address: String,
        data: Vec<u8>,
        executor: String,
        delay: Option<Duration>,
        expires_at: Option<u64>,
        priority: u8,
    ) -> Result<String, TimeLockError> {
        // Validate executor
        if !self.is_authorized(&executor) {
            return Err(TimeLockError::Unauthorized);
        }

        // Check if operation already exists
        if self.operations.contains_key(&id) {
            return Err(TimeLockError::AlreadyExecuted);
        }

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let delay = delay.unwrap_or(self.config.default_delay);
        
        // Validate delay duration
        if delay < self.config.min_delay || delay > self.config.max_delay {
            return Err(TimeLockError::InvalidDuration);
        }

        let unlock_time = current_time + delay.as_secs();

        // Check if expires_at is in the past
        if let Some(expiry) = expires_at {
            if expiry <= current_time {
                return Err(TimeLockError::TimeLockExpired);
            }
        }

        let operation = TimeLockOperation {
            id: id.clone(),
            operation_type: operation_type.as_str().to_string(),
            target_address,
            data,
            created_at: current_time,
            unlock_time,
            expires_at,
            executor,
            is_executed: false,
            priority,
        };

        self.operations.insert(id.clone(), operation.clone());
        Ok(id)
    }

    pub fn execute_operation(
        &mut self,
        id: &str,
        executor: &str,
    ) -> Result<TimeLockOperation, TimeLockError> {
        // Validate executor
        if !self.is_authorized(executor) {
            return Err(TimeLockError::Unauthorized);
        }

        let operation = self.operations.get_mut(id)
            .ok_or(TimeLockError::OperationNotFound)?;

        // Check if already executed
        if operation.is_executed {
            return Err(TimeLockError::AlreadyExecuted);
        }

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Check if time lock has expired
        if let Some(expiry) = operation.expires_at {
            if current_time > expiry {
                return Err(TimeLockError::TimeLockExpired);
            }
        }

        // Check if operation is still locked
        if current_time < operation.unlock_time {
            return Err(TimeLockError::OperationLocked {
                unlock_time: operation.unlock_time,
            });
        }

        // Mark as executed
        operation.is_executed = true;
        let executed_operation = operation.clone();

        // Move to history
        self.operation_history.push(executed_operation.clone());
        self.operations.remove(id);

        Ok(executed_operation)
    }

    pub fn cancel_operation(
        &mut self,
        id: &str,
        executor: &str,
    ) -> Result<TimeLockOperation, TimeLockError> {
        // Only admins or emergency addresses can cancel
        if !self.config.admin_addresses.contains(&executor.to_string()) 
            && !self.config.emergency_addresses.contains(&executor.to_string()) {
            return Err(TimeLockError::Unauthorized);
        }

        let operation = self.operations.remove(id)
            .ok_or(TimeLockError::OperationNotFound)?;

        Ok(operation)
    }

    pub fn get_operation(&self, id: &str) -> Option<&TimeLockOperation> {
        self.operations.get(id)
    }

    pub fn get_pending_operations(&self) -> Vec<&TimeLockOperation> {
        self.operations.values()
            .filter(|op| !op.is_executed)
            .collect()
    }

    pub fn get_ready_operations(&self) -> Vec<&TimeLockOperation> {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        self.operations.values()
            .filter(|op| !op.is_executed && current_time >= op.unlock_time)
            .collect()
    }

    pub fn get_operations_by_type(&self, operation_type: &str) -> Vec<&TimeLockOperation> {
        self.operations.values()
            .filter(|op| op.operation_type == operation_type)
            .collect()
    }

    pub fn update_config(&mut self, new_config: TimeLockConfig, executor: &str) -> Result<(), TimeLockError> {
        if !self.config.admin_addresses.contains(&executor.to_string()) {
            return Err(TimeLockError::Unauthorized);
        }

        self.config = new_config;
        Ok(())
    }

    pub fn add_admin(&mut self, address: String, executor: &str) -> Result<(), TimeLockError> {
        if !self.config.admin_addresses.contains(&executor.to_string()) {
            return Err(TimeLockError::Unauthorized);
        }

        if !self.config.admin_addresses.contains(&address) {
            self.config.admin_addresses.push(address);
        }
        Ok(())
    }

    pub fn remove_admin(&mut self, address: &str, executor: &str) -> Result<(), TimeLockError> {
        if !self.config.admin_addresses.contains(&executor.to_string()) {
            return Err(TimeLockError::Unauthorized);
        }

        self.config.admin_addresses.retain(|addr| addr != address);
        Ok(())
    }

    pub fn get_time_remaining(&self, id: &str) -> Result<u64, TimeLockError> {
        let operation = self.operations.get(id)
            .ok_or(TimeLockError::OperationNotFound)?;

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if current_time >= operation.unlock_time {
            Ok(0)
        } else {
            Ok(operation.unlock_time - current_time)
        }
    }

    pub fn get_operation_history(&self) -> &[TimeLockOperation] {
        &self.operation_history
    }

    pub fn get_config(&self) -> &TimeLockConfig {
        &self.config
    }

    pub fn get_stats(&self) -> TimeLockStats {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let pending = self.operations.values()
            .filter(|op| !op.is_executed && current_time < op.unlock_time)
            .count();

        let ready = self.operations.values()
            .filter(|op| !op.is_executed && current_time >= op.unlock_time)
            .count();

        let executed = self.operation_history.len();

        TimeLockStats {
            pending_operations: pending,
            ready_operations: ready,
            executed_operations: executed,
            total_operations: pending + ready + executed,
        }
    }

    fn is_authorized(&self, address: &str) -> bool {
        self.config.admin_addresses.contains(&address.to_string()) 
            || self.config.emergency_addresses.contains(&address.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeLockStats {
    pub pending_operations: usize,
    pub ready_operations: usize,
    pub executed_operations: usize,
    pub total_operations: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> TimeLockConfig {
        TimeLockConfig {
            min_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(3600),
            default_delay: Duration::from_secs(5),
            admin_addresses: vec!["admin1".to_string()],
            emergency_addresses: vec!["emergency1".to_string()],
        }
    }

    #[test]
    fn test_create_time_lock() {
        let mut timelock = TimeLock::new(create_test_config());
        
        let result = timelock.create_time_lock(
            "op1".to_string(),
            OperationType::Transfer,
            "target".to_string(),
            vec![1, 2, 3],
            "admin1".to_string(),
            None,
            None,
            1,
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_unauthorized_access() {
        let mut timelock = TimeLock::new(create_test_config());
        
        let result = timelock.create_time_lock(
            "op1".to_string(),
            OperationType::Transfer,
            "target".to_string(),
            vec![1, 2, 3],
            "unauthorized".to_string(),
            None,
            None,
            1,
        );

        assert!(matches!(result, Err(TimeLockError::Unauthorized)));
    }

    #[test]
    fn test_operation_locked() {
        let mut timelock = TimeLock::new(create_test_config());
        
        timelock.create_time_lock(
            "op1".to_string(),
            OperationType::Transfer,
            "target".to_string(),
            vec![1, 2, 3],
            "admin1".to_string(),
            Some(Duration::from_secs(10)),
            None,
            1,
        ).unwrap();

        let result = timelock.execute_operation("op1", "admin1");
        assert!(matches!(result, Err(TimeLockError::OperationLocked { .. })));
    }
}
