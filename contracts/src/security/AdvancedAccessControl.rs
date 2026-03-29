use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AccessControlError {
    #[error("Access denied: insufficient permissions")]
    AccessDenied,
    #[error("Role not found")]
    RoleNotFound,
    #[error("User not found")]
    UserNotFound,
    #[error("Permission not found")]
    PermissionNotFound,
    #[error("Role already exists")]
    RoleAlreadyExists,
    #[error("User already has role")]
    UserAlreadyHasRole,
    #[error("Invalid role hierarchy")]
    InvalidHierarchy,
    #[error("Unauthorized operation")]
    Unauthorized,
    #[error("Permission already granted")]
    PermissionAlreadyGranted,
    #[error("Session expired")]
    SessionExpired,
    #[error("Invalid session token")]
    InvalidSession,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Permission {
    // Contract permissions
    ContractDeploy,
    ContractUpgrade,
    ContractPause,
    ContractExecute,
    
    // Financial permissions
    Transfer,
    ApproveTransfer,
    Mint,
    Burn,
    
    // Administrative permissions
    UserManagement,
    RoleManagement,
    PermissionManagement,
    
    // Security permissions
    EmergencyPause,
    EmergencyResume,
    SecurityAudit,
    VulnerabilityReport,
    
    // System permissions
    SystemConfig,
    SystemMonitor,
    SystemBackup,
    
    // Custom permissions
    Custom(String),
}

impl Permission {
    pub fn as_str(&self) -> &str {
        match self {
            Permission::ContractDeploy => "contract_deploy",
            Permission::ContractUpgrade => "contract_upgrade",
            Permission::ContractPause => "contract_pause",
            Permission::ContractExecute => "contract_execute",
            Permission::Transfer => "transfer",
            Permission::ApproveTransfer => "approve_transfer",
            Permission::Mint => "mint",
            Permission::Burn => "burn",
            Permission::UserManagement => "user_management",
            Permission::RoleManagement => "role_management",
            Permission::PermissionManagement => "permission_management",
            Permission::EmergencyPause => "emergency_pause",
            Permission::EmergencyResume => "emergency_resume",
            Permission::SecurityAudit => "security_audit",
            Permission::VulnerabilityReport => "vulnerability_report",
            Permission::SystemConfig => "system_config",
            Permission::SystemMonitor => "system_monitor",
            Permission::SystemBackup => "system_backup",
            Permission::Custom(name) => name,
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "contract_deploy" => Some(Permission::ContractDeploy),
            "contract_upgrade" => Some(Permission::ContractUpgrade),
            "contract_pause" => Some(Permission::ContractPause),
            "contract_execute" => Some(Permission::ContractExecute),
            "transfer" => Some(Permission::Transfer),
            "approve_transfer" => Some(Permission::ApproveTransfer),
            "mint" => Some(Permission::Mint),
            "burn" => Some(Permission::Burn),
            "user_management" => Some(Permission::UserManagement),
            "role_management" => Some(Permission::RoleManagement),
            "permission_management" => Some(Permission::PermissionManagement),
            "emergency_pause" => Some(Permission::EmergencyPause),
            "emergency_resume" => Some(Permission::EmergencyResume),
            "security_audit" => Some(Permission::SecurityAudit),
            "vulnerability_report" => Some(Permission::VulnerabilityReport),
            "system_config" => Some(Permission::SystemConfig),
            "system_monitor" => Some(Permission::SystemMonitor),
            "system_backup" => Some(Permission::SystemBackup),
            _ => Some(Permission::Custom(s.to_string())),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub description: String,
    pub permissions: HashSet<Permission>,
    pub parent_role: Option<String>,
    pub level: u8,
    pub is_active: bool,
    pub created_at: u64,
    pub created_by: String,
    pub updated_at: Option<u64>,
    pub updated_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub address: String,
    pub roles: HashSet<String>,
    pub custom_permissions: HashSet<Permission>,
    pub is_active: bool,
    pub created_at: u64,
    pub created_by: String,
    pub updated_at: Option<u64>,
    pub updated_by: Option<String>,
    pub last_login: Option<u64>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSession {
    pub user_id: String,
    pub session_token: String,
    pub created_at: u64,
    pub expires_at: u64,
    pub permissions: HashSet<Permission>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessPolicy {
    pub id: String,
    pub name: String,
    pub description: String,
    pub resource: String,
    pub required_permissions: HashSet<Permission>,
    pub conditions: Vec<PolicyCondition>,
    pub is_active: bool,
    pub created_at: u64,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PolicyCondition {
    TimeWindow { start: u64, end: u64 },
    IpWhitelist(Vec<String>),
    MinRoleLevel(u8),
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessControlConfig {
    pub admin_address: String,
    pub default_session_duration: u64, // in seconds
    pub max_session_duration: u64,
    pub require_multi_admin: bool,
    pub audit_access: bool,
    pub ip_whitelist_enabled: bool,
    pub session_timeout_enabled: bool,
}

impl Default for AccessControlConfig {
    fn default() -> Self {
        Self {
            admin_address: String::new(),
            default_session_duration: 3600, // 1 hour
            max_session_duration: 24 * 3600, // 24 hours
            require_multi_admin: false,
            audit_access: true,
            ip_whitelist_enabled: false,
            session_timeout_enabled: true,
        }
    }
}

#[derive(Debug)]
pub struct AdvancedAccessControl {
    roles: HashMap<String, Role>,
    users: HashMap<String, User>,
    sessions: HashMap<String, UserSession>,
    policies: HashMap<String, AccessPolicy>,
    config: AccessControlConfig,
    audit_log: Vec<AccessAuditEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessAuditEntry {
    pub timestamp: u64,
    pub user_id: String,
    pub action: String,
    pub resource: String,
    pub permission: Permission,
    pub granted: bool,
    pub reason: Option<String>,
    pub ip_address: Option<String>,
    pub session_token: Option<String>,
}

impl AdvancedAccessControl {
    pub fn new(config: AccessControlConfig) -> Self {
        let mut access_control = Self {
            roles: HashMap::new(),
            users: HashMap::new(),
            sessions: HashMap::new(),
            policies: HashMap::new(),
            config,
            audit_log: Vec::new(),
        };

        // Initialize with default roles
        access_control.initialize_default_roles();
        access_control
    }

    fn initialize_default_roles(&mut self) {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Super Admin role
        let super_admin_permissions = HashSet::from([
            Permission::ContractDeploy,
            Permission::ContractUpgrade,
            Permission::ContractPause,
            Permission::ContractExecute,
            Permission::Transfer,
            Permission::ApproveTransfer,
            Permission::Mint,
            Permission::Burn,
            Permission::UserManagement,
            Permission::RoleManagement,
            Permission::PermissionManagement,
            Permission::EmergencyPause,
            Permission::EmergencyResume,
            Permission::SecurityAudit,
            Permission::VulnerabilityReport,
            Permission::SystemConfig,
            Permission::SystemMonitor,
            Permission::SystemBackup,
        ]);

        let super_admin_role = Role {
            id: "super_admin".to_string(),
            name: "Super Administrator".to_string(),
            description: "Full system access with all permissions".to_string(),
            permissions: super_admin_permissions,
            parent_role: None,
            level: 10,
            is_active: true,
            created_at: current_time,
            created_by: "system".to_string(),
            updated_at: None,
            updated_by: None,
        };

        // Admin role
        let admin_permissions = HashSet::from([
            Permission::ContractExecute,
            Permission::Transfer,
            Permission::ApproveTransfer,
            Permission::UserManagement,
            Permission::SecurityAudit,
            Permission::SystemMonitor,
        ]);

        let admin_role = Role {
            id: "admin".to_string(),
            name: "Administrator".to_string(),
            description: "Administrative access with limited permissions".to_string(),
            permissions: admin_permissions,
            parent_role: Some("super_admin".to_string()),
            level: 8,
            is_active: true,
            created_at: current_time,
            created_by: "system".to_string(),
            updated_at: None,
            updated_by: None,
        };

        // User role
        let user_permissions = HashSet::from([
            Permission::Transfer,
            Permission::ContractExecute,
        ]);

        let user_role = Role {
            id: "user".to_string(),
            name: "User".to_string(),
            description: "Standard user with basic permissions".to_string(),
            permissions: user_permissions,
            parent_role: Some("admin".to_string()),
            level: 5,
            is_active: true,
            created_at: current_time,
            created_by: "system".to_string(),
            updated_at: None,
            updated_by: None,
        };

        self.roles.insert("super_admin".to_string(), super_admin_role);
        self.roles.insert("admin".to_string(), admin_role);
        self.roles.insert("user".to_string(), user_role);
    }

    pub fn create_role(
        &mut self,
        id: String,
        name: String,
        description: String,
        permissions: HashSet<Permission>,
        parent_role: Option<String>,
        executor: &str,
    ) -> Result<(), AccessControlError> {
        // Check authorization
        if !self.has_permission(executor, &Permission::RoleManagement)? {
            return Err(AccessControlError::Unauthorized);
        }

        // Check if role already exists
        if self.roles.contains_key(&id) {
            return Err(AccessControlError::RoleAlreadyExists);
        }

        // Validate parent role
        let level = if let Some(parent_id) = &parent_role {
            let parent = self.roles.get(parent_id)
                .ok_or(AccessControlError::RoleNotFound)?;
            
            if parent.level >= 10 {
                return Err(AccessControlError::InvalidHierarchy);
            }
            
            parent.level + 1
        } else {
            10 // Top-level role
        };

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let role = Role {
            id: id.clone(),
            name,
            description,
            permissions,
            parent_role,
            level,
            is_active: true,
            created_at: current_time,
            created_by: executor.to_string(),
            updated_at: None,
            updated_by: None,
        };

        self.roles.insert(id, role);
        Ok(())
    }

    pub fn assign_role_to_user(
        &mut self,
        user_id: &str,
        role_id: &str,
        executor: &str,
    ) -> Result<(), AccessControlError> {
        // Check authorization
        if !self.has_permission(executor, &Permission::UserManagement)? {
            return Err(AccessControlError::Unauthorized);
        }

        // Check if role exists
        if !self.roles.contains_key(role_id) {
            return Err(AccessControlError::RoleNotFound);
        }

        // Get or create user
        let user = self.users.get_mut(user_id)
            .ok_or(AccessControlError::UserNotFound)?;

        // Check if user already has role
        if user.roles.contains(role_id) {
            return Err(AccessControlError::UserAlreadyHasRole);
        }

        user.roles.insert(role_id.to_string());
        
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        user.updated_at = Some(current_time);
        user.updated_by = Some(executor.to_string());

        Ok(())
    }

    pub fn create_user(
        &mut self,
        id: String,
        address: String,
        executor: &str,
    ) -> Result<(), AccessControlError> {
        // Check authorization
        if !self.has_permission(executor, &Permission::UserManagement)? {
            return Err(AccessControlError::Unauthorized);
        }

        // Check if user already exists
        if self.users.contains_key(&id) {
            return Err(AccessControlError::UserNotFound); // User already exists
        }

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let user = User {
            id: id.clone(),
            address,
            roles: HashSet::new(),
            custom_permissions: HashSet::new(),
            is_active: true,
            created_at: current_time,
            created_by: executor.to_string(),
            updated_at: None,
            updated_by: None,
            last_login: None,
            metadata: HashMap::new(),
        };

        self.users.insert(id, user);
        Ok(())
    }

    pub fn has_permission(&self, user_id: &str, permission: &Permission) -> Result<bool, AccessControlError> {
        let user = self.users.get(user_id)
            .ok_or(AccessControlError::UserNotFound)?;

        // Check custom permissions first
        if user.custom_permissions.contains(permission) {
            return Ok(true);
        }

        // Check role permissions
        for role_id in &user.roles {
            if let Some(role) = self.roles.get(role_id) {
                if role.permissions.contains(permission) {
                    return Ok(true);
                }

                // Check parent roles recursively
                if self.check_parent_role_permissions(&role.parent_role, permission)? {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    fn check_parent_role_permissions(&self, parent_role_id: &Option<String>, permission: &Permission) -> Result<bool, AccessControlError> {
        if let Some(parent_id) = parent_role_id {
            if let Some(parent_role) = self.roles.get(parent_id) {
                if parent_role.permissions.contains(permission) {
                    return Ok(true);
                }
                return self.check_parent_role_permissions(&parent_role.parent_role, permission);
            }
        }
        Ok(false)
    }

    pub fn create_session(
        &mut self,
        user_id: &str,
        ip_address: Option<String>,
        user_agent: Option<String>,
        duration: Option<u64>,
    ) -> Result<String, AccessControlError> {
        let user = self.users.get(user_id)
            .ok_or(AccessControlError::UserNotFound)?;

        if !user.is_active {
            return Err(AccessControlError::AccessDenied);
        }

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let session_duration = duration.unwrap_or(self.config.default_session_duration)
            .min(self.config.max_session_duration);

        let expires_at = current_time + session_duration;

        // Collect all user permissions
        let mut permissions = user.custom_permissions.clone();
        
        for role_id in &user.roles {
            if let Some(role) = self.roles.get(role_id) {
                permissions.extend(role.permissions.clone());
                
                // Add parent role permissions
                self.add_parent_permissions(&role.parent_role, &mut permissions)?;
            }
        }

        let session_token = format!("{}_{}", user_id, current_time);

        let session = UserSession {
            user_id: user_id.to_string(),
            session_token: session_token.clone(),
            created_at: current_time,
            expires_at,
            permissions,
            ip_address,
            user_agent,
        };

        self.sessions.insert(session_token.clone(), session);
        Ok(session_token)
    }

    fn add_parent_permissions(&self, parent_role_id: &Option<String>, permissions: &mut HashSet<Permission>) -> Result<(), AccessControlError> {
        if let Some(parent_id) = parent_role_id {
            if let Some(parent_role) = self.roles.get(parent_id) {
                permissions.extend(parent_role.permissions.clone());
                return self.add_parent_permissions(&parent_role.parent_role, permissions);
            }
        }
        Ok(())
    }

    pub fn validate_session(&self, session_token: &str) -> Result<&UserSession, AccessControlError> {
        let session = self.sessions.get(session_token)
            .ok_or(AccessControlError::InvalidSession)?;

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if current_time > session.expires_at {
            return Err(AccessControlError::SessionExpired);
        }

        Ok(session)
    }

    pub fn check_access(
        &mut self,
        session_token: &str,
        permission: &Permission,
        resource: &str,
        ip_address: Option<String>,
    ) -> Result<bool, AccessControlError> {
        let session = self.validate_session(session_token)?;
        
        let has_permission = session.permissions.contains(permission);
        
        // Log access attempt
        let audit_entry = AccessAuditEntry {
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            user_id: session.user_id.clone(),
            action: "access_check".to_string(),
            resource: resource.to_string(),
            permission: permission.clone(),
            granted: has_permission,
            reason: if has_permission { None } else { Some("Insufficient permissions".to_string()) },
            ip_address,
            session_token: Some(session_token.to_string()),
        };

        self.audit_log.push(audit_entry);

        Ok(has_permission)
    }

    pub fn revoke_session(&mut self, session_token: &str) -> Result<(), AccessControlError> {
        self.sessions.remove(session_token)
            .ok_or(AccessControlError::InvalidSession)?;
        
        Ok(())
    }

    pub fn grant_custom_permission(
        &mut self,
        user_id: &str,
        permission: Permission,
        executor: &str,
    ) -> Result<(), AccessControlError> {
        if !self.has_permission(executor, &Permission::PermissionManagement)? {
            return Err(AccessControlError::Unauthorized);
        }

        let user = self.users.get_mut(user_id)
            .ok_or(AccessControlError::UserNotFound)?;

        if user.custom_permissions.contains(&permission) {
            return Err(AccessControlError::PermissionAlreadyGranted);
        }

        user.custom_permissions.insert(permission);
        
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        user.updated_at = Some(current_time);
        user.updated_by = Some(executor.to_string());

        Ok(())
    }

    pub fn revoke_custom_permission(
        &mut self,
        user_id: &str,
        permission: &Permission,
        executor: &str,
    ) -> Result<(), AccessControlError> {
        if !self.has_permission(executor, &Permission::PermissionManagement)? {
            return Err(AccessControlError::Unauthorized);
        }

        let user = self.users.get_mut(user_id)
            .ok_or(AccessControlError::UserNotFound)?;

        user.custom_permissions.remove(permission);
        
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        user.updated_at = Some(current_time);
        user.updated_by = Some(executor.to_string());

        Ok(())
    }

    pub fn get_user(&self, user_id: &str) -> Option<&User> {
        self.users.get(user_id)
    }

    pub fn get_role(&self, role_id: &str) -> Option<&Role> {
        self.roles.get(role_id)
    }

    pub fn get_audit_log(&self) -> &[AccessAuditEntry] {
        &self.audit_log
    }

    pub fn get_active_sessions(&self) -> Vec<&UserSession> {
        self.sessions.values().collect()
    }

    pub fn cleanup_expired_sessions(&mut self) -> usize {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let initial_count = self.sessions.len();
        
        self.sessions.retain(|_, session| session.expires_at > current_time);
        
        initial_count - self.sessions.len()
    }

    pub fn get_user_permissions(&self, user_id: &str) -> Result<HashSet<Permission>, AccessControlError> {
        let user = self.users.get(user_id)
            .ok_or(AccessControlError::UserNotFound)?;

        let mut permissions = user.custom_permissions.clone();
        
        for role_id in &user.roles {
            if let Some(role) = self.roles.get(role_id) {
                permissions.extend(role.permissions.clone());
                self.add_parent_permissions(&role.parent_role, &mut permissions)?;
            }
        }

        Ok(permissions)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> AccessControlConfig {
        AccessControlConfig {
            admin_address: "admin1".to_string(),
            default_session_duration: 3600,
            max_session_duration: 24 * 3600,
            require_multi_admin: false,
            audit_access: true,
            ip_whitelist_enabled: false,
            session_timeout_enabled: true,
        }
    }

    #[test]
    fn test_default_roles() {
        let access_control = AdvancedAccessControl::new(create_test_config());
        
        assert!(access_control.roles.contains_key("super_admin"));
        assert!(access_control.roles.contains_key("admin"));
        assert!(access_control.roles.contains_key("user"));
    }

    #[test]
    fn test_create_user() {
        let mut access_control = AdvancedAccessControl::new(create_test_config());
        
        let result = access_control.create_user(
            "user1".to_string(),
            "0x123".to_string(),
            "admin1",
        );

        assert!(result.is_ok());
        assert!(access_control.users.contains_key("user1"));
    }

    #[test]
    fn test_permission_check() {
        let mut access_control = AdvancedAccessControl::new(create_test_config());
        
        access_control.create_user(
            "user1".to_string(),
            "0x123".to_string(),
            "admin1",
        ).unwrap();

        access_control.assign_role_to_user("user1", "user", "admin1").unwrap();

        let has_permission = access_control.has_permission("user1", &Permission::Transfer).unwrap();
        assert!(has_permission);

        let has_permission = access_control.has_permission("user1", &Permission::UserManagement).unwrap();
        assert!(!has_permission);
    }
}
