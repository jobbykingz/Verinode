use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum EmergencyPauseError {
    #[error("Contract is already paused")]
    AlreadyPaused,
    #[error("Contract is not paused")]
    NotPaused,
    #[error("Unauthorized access")]
    Unauthorized,
    #[error("Pause has expired")]
    PauseExpired,
    #[error("Invalid pause duration")]
    InvalidDuration,
    #[error("Emergency action not found")]
    ActionNotFound,
    #[error("Action already executed")]
    ActionAlreadyExecuted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmergencyPause {
    pub is_paused: bool,
    pub paused_at: Option<u64>,
    pub paused_by: Option<String>,
    pub pause_reason: Option<String>,
    pub expires_at: Option<u64>,
    pub auto_resume: bool,
    pub emergency_level: EmergencyLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EmergencyLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl EmergencyLevel {
    pub fn as_u8(&self) -> u8 {
        match self {
            EmergencyLevel::Low => 1,
            EmergencyLevel::Medium => 2,
            EmergencyLevel::High => 3,
            EmergencyLevel::Critical => 4,
        }
    }

    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            1 => Some(EmergencyLevel::Low),
            2 => Some(EmergencyLevel::Medium),
            3 => Some(EmergencyLevel::High),
            4 => Some(EmergencyLevel::Critical),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmergencyAction {
    pub id: String,
    pub action_type: EmergencyActionType,
    pub target_address: String,
    pub data: Vec<u8>,
    pub created_at: u64,
    pub created_by: String,
    pub executed_at: Option<u64>,
    pub executed_by: Option<String>,
    pub is_executed: bool,
    pub requires_approval: bool,
    pub approvals: Vec<String>,
    pub required_approvals: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmergencyActionType {
    Transfer,
    ContractUpgrade,
    ParameterChange,
    RoleModification,
    TokenFreeze,
    AccountFreeze,
    EmergencyWithdraw,
    Custom(String),
}

impl EmergencyActionType {
    pub fn as_str(&self) -> &str {
        match self {
            EmergencyActionType::Transfer => "transfer",
            EmergencyActionType::ContractUpgrade => "contract_upgrade",
            EmergencyActionType::ParameterChange => "parameter_change",
            EmergencyActionType::RoleModification => "role_modification",
            EmergencyActionType::TokenFreeze => "token_freeze",
            EmergencyActionType::AccountFreeze => "account_freeze",
            EmergencyActionType::EmergencyWithdraw => "emergency_withdraw",
            EmergencyActionType::Custom(name) => name,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmergencyConfig {
    pub emergency_addresses: Vec<String>,
    pub admin_addresses: Vec<String>,
    pub guardian_addresses: Vec<String>,
    pub max_pause_duration: u64, // in seconds
    pub default_pause_duration: u64,
    pub auto_resume_enabled: bool,
    pub notification_addresses: Vec<String>,
    pub critical_action_threshold: u8,
}

impl Default for EmergencyConfig {
    fn default() -> Self {
        Self {
            emergency_addresses: Vec::new(),
            admin_addresses: Vec::new(),
            guardian_addresses: Vec::new(),
            max_pause_duration: 7 * 24 * 3600, // 7 days
            default_pause_duration: 24 * 3600, // 24 hours
            auto_resume_enabled: false,
            notification_addresses: Vec::new(),
            critical_action_threshold: 3,
        }
    }
}

#[derive(Debug)]
pub struct EmergencyPauseManager {
    pause_state: EmergencyPause,
    config: EmergencyConfig,
    emergency_actions: HashMap<String, EmergencyAction>,
    pause_history: Vec<EmergencyPause>,
    action_history: Vec<EmergencyAction>,
}

impl EmergencyPauseManager {
    pub fn new(config: EmergencyConfig) -> Self {
        Self {
            pause_state: EmergencyPause {
                is_paused: false,
                paused_at: None,
                paused_by: None,
                pause_reason: None,
                expires_at: None,
                auto_resume: config.auto_resume_enabled,
                emergency_level: EmergencyLevel::Low,
            },
            config,
            emergency_actions: HashMap::new(),
            pause_history: Vec::new(),
            action_history: Vec::new(),
        }
    }

    pub fn emergency_pause(
        &mut self,
        reason: String,
        emergency_level: EmergencyLevel,
        duration: Option<u64>,
        executor: &str,
    ) -> Result<(), EmergencyPauseError> {
        // Check authorization
        if !self.is_authorized_for_pause(executor, &emergency_level) {
            return Err(EmergencyPauseError::Unauthorized);
        }

        // Check if already paused
        if self.pause_state.is_paused {
            return Err(EmergencyPauseError::AlreadyPaused);
        }

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let duration = duration.unwrap_or(self.config.default_pause_duration);
        
        // Validate duration
        if duration > self.config.max_pause_duration {
            return Err(EmergencyPauseError::InvalidDuration);
        }

        let expires_at = if self.pause_state.auto_resume {
            Some(current_time + duration)
        } else {
            None
        };

        // Store previous state in history
        self.pause_history.push(self.pause_state.clone());

        // Update pause state
        self.pause_state = EmergencyPause {
            is_paused: true,
            paused_at: Some(current_time),
            paused_by: Some(executor.to_string()),
            pause_reason: Some(reason),
            expires_at,
            auto_resume: self.pause_state.auto_resume,
            emergency_level,
        };

        Ok(())
    }

    pub fn resume(&mut self, executor: &str) -> Result<(), EmergencyPauseError> {
        // Check authorization
        if !self.is_authorized_for_resume(executor) {
            return Err(EmergencyPauseError::Unauthorized);
        }

        // Check if currently paused
        if !self.pause_state.is_paused {
            return Err(EmergencyPauseError::NotPaused);
        }

        // Check auto-resume condition
        if self.pause_state.auto_resume {
            if let Some(expires_at) = self.pause_state.expires_at {
                let current_time = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                
                if current_time < expires_at {
                    return Err(EmergencyPauseError::PauseExpired);
                }
            }
        }

        // Store previous state in history
        self.pause_history.push(self.pause_state.clone());

        // Reset pause state
        self.pause_state = EmergencyPause {
            is_paused: false,
            paused_at: None,
            paused_by: None,
            pause_reason: None,
            expires_at: None,
            auto_resume: self.pause_state.auto_resume,
            emergency_level: EmergencyLevel::Low,
        };

        Ok(())
    }

    pub fn create_emergency_action(
        &mut self,
        id: String,
        action_type: EmergencyActionType,
        target_address: String,
        data: Vec<u8>,
        executor: &str,
        requires_approval: bool,
    ) -> Result<(), EmergencyPauseError> {
        // Check authorization
        if !self.is_authorized_for_action(executor, &action_type) {
            return Err(EmergencyPauseError::Unauthorized);
        }

        // Check if action already exists
        if self.emergency_actions.contains_key(&id) {
            return Err(EmergencyPauseError::ActionAlreadyExecuted);
        }

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let required_approvals = if requires_approval {
            self.config.critical_action_threshold
        } else {
            1
        };

        let action = EmergencyAction {
            id: id.clone(),
            action_type,
            target_address,
            data,
            created_at: current_time,
            created_by: executor.to_string(),
            executed_at: None,
            executed_by: None,
            is_executed: false,
            requires_approval,
            approvals: Vec::new(),
            required_approvals,
        };

        self.emergency_actions.insert(id, action);
        Ok(())
    }

    pub fn approve_emergency_action(
        &mut self,
        action_id: &str,
        approver: &str,
    ) -> Result<(), EmergencyPauseError> {
        // Check authorization
        if !self.is_guardian_or_admin(approver) {
            return Err(EmergencyPauseError::Unauthorized);
        }

        let action = self.emergency_actions.get_mut(action_id)
            .ok_or(EmergencyPauseError::ActionNotFound)?;

        // Check if already executed
        if action.is_executed {
            return Err(EmergencyPauseError::ActionAlreadyExecuted);
        }

        // Check if already approved
        if action.approvals.contains(&approver.to_string()) {
            return Ok(()); // Already approved
        }

        action.approvals.push(approver.to_string());
        Ok(())
    }

    pub fn execute_emergency_action(
        &mut self,
        action_id: &str,
        executor: &str,
    ) -> Result<EmergencyAction, EmergencyPauseError> {
        // Check authorization
        if !self.is_authorized_for_action_execution(executor) {
            return Err(EmergencyPauseError::Unauthorized);
        }

        let action = self.emergency_actions.get_mut(action_id)
            .ok_or(EmergencyPauseError::ActionNotFound)?;

        // Check if already executed
        if action.is_executed {
            return Err(EmergencyPauseError::ActionAlreadyExecuted);
        }

        // Check approvals
        if action.requires_approval && action.approvals.len() < action.required_approvals as usize {
            return Err(EmergencyPauseError::Unauthorized);
        }

        // Execute action
        action.is_executed = true;
        action.executed_at = Some(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
        action.executed_by = Some(executor.to_string());

        let executed_action = action.clone();

        // Move to history
        self.action_history.push(executed_action.clone());
        self.emergency_actions.remove(action_id);

        Ok(executed_action)
    }

    pub fn cancel_emergency_action(
        &mut self,
        action_id: &str,
        executor: &str,
    ) -> Result<EmergencyAction, EmergencyPauseError> {
        // Check authorization
        if !self.is_admin_or_emergency(executor) {
            return Err(EmergencyPauseError::Unauthorized);
        }

        let action = self.emergency_actions.remove(action_id)
            .ok_or(EmergencyPauseError::ActionNotFound)?;

        Ok(action)
    }

    pub fn get_pause_state(&self) -> &EmergencyPause {
        &self.pause_state
    }

    pub fn is_paused(&self) -> bool {
        self.pause_state.is_paused
    }

    pub fn get_emergency_action(&self, id: &str) -> Option<&EmergencyAction> {
        self.emergency_actions.get(id)
    }

    pub fn get_pending_actions(&self) -> Vec<&EmergencyAction> {
        self.emergency_actions.values()
            .filter(|action| !action.is_executed)
            .collect()
    }

    pub fn get_actions_requiring_approval(&self) -> Vec<&EmergencyAction> {
        self.emergency_actions.values()
            .filter(|action| action.requires_approval && !action.is_executed)
            .collect()
    }

    pub fn get_pause_history(&self) -> &[EmergencyPause] {
        &self.pause_history
    }

    pub fn get_action_history(&self) -> &[EmergencyAction] {
        &self.action_history
    }

    pub fn update_config(&mut self, new_config: EmergencyConfig, executor: &str) -> Result<(), EmergencyPauseError> {
        if !self.config.admin_addresses.contains(&executor.to_string()) {
            return Err(EmergencyPauseError::Unauthorized);
        }

        self.config = new_config;
        Ok(())
    }

    pub fn add_emergency_address(&mut self, address: String, executor: &str) -> Result<(), EmergencyPauseError> {
        if !self.config.admin_addresses.contains(&executor.to_string()) {
            return Err(EmergencyPauseError::Unauthorized);
        }

        if !self.config.emergency_addresses.contains(&address) {
            self.config.emergency_addresses.push(address);
        }
        Ok(())
    }

    pub fn add_guardian_address(&mut self, address: String, executor: &str) -> Result<(), EmergencyPauseError> {
        if !self.config.admin_addresses.contains(&executor.to_string()) {
            return Err(EmergencyPauseError::Unauthorized);
        }

        if !self.config.guardian_addresses.contains(&address) {
            self.config.guardian_addresses.push(address);
        }
        Ok(())
    }

    pub fn get_config(&self) -> &EmergencyConfig {
        &self.config
    }

    pub fn get_stats(&self) -> EmergencyStats {
        let pending_actions = self.emergency_actions.values()
            .filter(|action| !action.is_executed)
            .count();

        let actions_requiring_approval = self.emergency_actions.values()
            .filter(|action| action.requires_approval && !action.is_executed)
            .count();

        let executed_actions = self.action_history.len();

        EmergencyStats {
            is_paused: self.pause_state.is_paused,
            emergency_level: self.pause_state.emergency_level.clone(),
            pending_actions,
            actions_requiring_approval,
            executed_actions,
            total_actions: pending_actions + executed_actions,
        }
    }

    fn is_authorized_for_pause(&self, executor: &str, level: &EmergencyLevel) -> bool {
        let executor = executor.to_string();
        
        match level {
            EmergencyLevel::Low | EmergencyLevel::Medium => {
                self.config.emergency_addresses.contains(&executor) 
                    || self.config.admin_addresses.contains(&executor)
            }
            EmergencyLevel::High | EmergencyLevel::Critical => {
                self.config.admin_addresses.contains(&executor)
            }
        }
    }

    fn is_authorized_for_resume(&self, executor: &str) -> bool {
        let executor = executor.to_string();
        self.config.admin_addresses.contains(&executor) 
            || self.config.guardian_addresses.contains(&executor)
    }

    fn is_authorized_for_action(&self, executor: &str, action_type: &EmergencyActionType) -> bool {
        let executor = executor.to_string();
        
        match action_type {
            EmergencyActionType::TokenFreeze | EmergencyActionType::AccountFreeze => {
                self.config.emergency_addresses.contains(&executor) 
                    || self.config.admin_addresses.contains(&executor)
            }
            EmergencyActionType::EmergencyWithdraw => {
                self.config.admin_addresses.contains(&executor)
            }
            _ => {
                self.config.emergency_addresses.contains(&executor) 
                    || self.config.admin_addresses.contains(&executor)
                    || self.config.guardian_addresses.contains(&executor)
            }
        }
    }

    fn is_authorized_for_action_execution(&self, executor: &str) -> bool {
        let executor = executor.to_string();
        self.config.emergency_addresses.contains(&executor) 
            || self.config.admin_addresses.contains(&executor)
    }

    fn is_guardian_or_admin(&self, address: &str) -> bool {
        let address = address.to_string();
        self.config.guardian_addresses.contains(&address) 
            || self.config.admin_addresses.contains(&address)
    }

    fn is_admin_or_emergency(&self, address: &str) -> bool {
        let address = address.to_string();
        self.config.admin_addresses.contains(&address) 
            || self.config.emergency_addresses.contains(&address)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmergencyStats {
    pub is_paused: bool,
    pub emergency_level: EmergencyLevel,
    pub pending_actions: usize,
    pub actions_requiring_approval: usize,
    pub executed_actions: usize,
    pub total_actions: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> EmergencyConfig {
        EmergencyConfig {
            emergency_addresses: vec!["emergency1".to_string()],
            admin_addresses: vec!["admin1".to_string()],
            guardian_addresses: vec!["guardian1".to_string()],
            max_pause_duration: 3600,
            default_pause_duration: 300,
            auto_resume_enabled: true,
            notification_addresses: Vec::new(),
            critical_action_threshold: 2,
        }
    }

    #[test]
    fn test_emergency_pause() {
        let mut manager = EmergencyPauseManager::new(create_test_config());
        
        let result = manager.emergency_pause(
            "Test pause".to_string(),
            EmergencyLevel::Medium,
            None,
            "emergency1",
        );

        assert!(result.is_ok());
        assert!(manager.is_paused());
    }

    #[test]
    fn test_unauthorized_pause() {
        let mut manager = EmergencyPauseManager::new(create_test_config());
        
        let result = manager.emergency_pause(
            "Test pause".to_string(),
            EmergencyLevel::High,
            None,
            "unauthorized",
        );

        assert!(matches!(result, Err(EmergencyPauseError::Unauthorized)));
    }

    #[test]
    fn test_emergency_action() {
        let mut manager = EmergencyPauseManager::new(create_test_config());
        
        let result = manager.create_emergency_action(
            "action1".to_string(),
            EmergencyActionType::Transfer,
            "target".to_string(),
            vec![1, 2, 3],
            "emergency1",
            false,
        );

        assert!(result.is_ok());
    }
}
