#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, U256, u128, i128};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityPolicy {
    pub policy_id: u64,
    pub name: String,
    pub description: String,
    pub rules: Vec<SecurityRule>,
    pub active: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityRule {
    pub rule_id: u64,
    pub rule_type: RuleType,
    pub parameters: Vec<Bytes>,
    pub action: SecurityAction,
    pub threshold: u128,
    pub time_window: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RuleType {
    AmountLimit,
    FrequencyLimit,
    BlacklistAddress,
    WhitelistAddress,
    SuspiciousPattern,
    Geofencing,
    TimeLock,
    MultiSignature,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SecurityAction {
    Allow,
    Block,
    RequireAdditionalAuth,
    FlagForReview,
    Escalate,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityEvent {
    pub event_id: u64,
    pub transaction_id: u64,
    pub user_address: Address,
    pub rule_type: RuleType,
    pub action: SecurityAction,
    pub details: Bytes,
    pub timestamp: u64,
    pub resolved: bool,
    pub severity: SecuritySeverity,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SecuritySeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BlacklistEntry {
    pub address: Address,
    pub reason: String,
    pub added_at: u64,
    pub added_by: Address,
    pub permanent: bool,
    pub expires_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WhitelistEntry {
    pub address: Address,
    pub permissions: Vec<String>,
    pub added_at: u64,
    pub added_by: Address,
    pub expires_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityAudit {
    pub audit_id: u64,
    pub auditor: Address,
    pub audit_type: AuditType,
    pub findings: Vec<AuditFinding>,
    pub timestamp: u64,
    pub status: AuditStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AuditType {
    Security,
    Compliance,
    Performance,
    CodeReview,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditFinding {
    pub finding_id: u64,
    pub severity: SecuritySeverity,
    pub description: String,
    pub recommendation: String,
    pub resolved: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AuditStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

#[contracttype]
pub enum SecurityDataKey {
    Policy(u64),
    SecurityEvent(u64),
    BlacklistEntry(Address),
    WhitelistEntry(Address),
    SecurityAudit(u64),
    PolicyCount,
    EventCount,
    AuditCount,
    Admin,
    Paused,
    EmergencyMode,
    GlobalBlacklist,
    GlobalWhitelist,
}

#[contract]
pub struct BridgeSecurity;

#[contractimpl]
impl BridgeSecurity {
    /// Initialize the bridge security module
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&SecurityDataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&SecurityDataKey::Admin, &admin);
        env.storage().instance().set(&SecurityDataKey::PolicyCount, &0u64);
        env.storage().instance().set(&SecurityDataKey::EventCount, &0u64);
        env.storage().instance().set(&SecurityDataKey::AuditCount, &0u64);
        env.storage().instance().set(&SecurityDataKey::Paused, &false);
        env.storage().instance().set(&SecurityDataKey::EmergencyMode, &false);
        
        // Initialize default security policies
        Self::initialize_default_policies(env.clone());
        
        // Initialize default blacklist and whitelist
        Self::initialize_default_lists(env.clone());
    }

    /// Initialize default security policies
    fn initialize_default_policies(env: Env) {
        let default_policies = vec![
            SecurityPolicy {
                policy_id: 1,
                name: String::from_str(&env, "Amount Limit Policy"),
                description: String::from_str(&env, "Limits transaction amounts to prevent large losses"),
                rules: vec![
                    SecurityRule {
                        rule_id: 1,
                        rule_type: RuleType::AmountLimit,
                        parameters: vec![Bytes::from_slice(&env, &1000000u128.to_be_bytes())], // $1M limit
                        action: SecurityAction::RequireAdditionalAuth,
                        threshold: 1000000u128,
                        time_window: 86400, // 24 hours
                    },
                ],
                active: true,
                created_at: env.ledger().timestamp(),
                updated_at: env.ledger().timestamp(),
            },
            SecurityPolicy {
                policy_id: 2,
                name: String::from_str(&env, "Frequency Limit Policy"),
                description: String::from_str(&env, "Limits transaction frequency to prevent spam"),
                rules: vec![
                    SecurityRule {
                        rule_id: 2,
                        rule_type: RuleType::FrequencyLimit,
                        parameters: vec![Bytes::from_slice(&env, &100u64.to_be_bytes())], // 100 transactions per hour
                        action: SecurityAction::Block,
                        threshold: 100u128,
                        time_window: 3600, // 1 hour
                    },
                ],
                active: true,
                created_at: env.ledger().timestamp(),
                updated_at: env.ledger().timestamp(),
            },
        ];
        
        for policy in default_policies {
            env.storage().instance().set(&SecurityDataKey::Policy(policy.policy_id), &policy);
        }
        
        env.storage().instance().set(&SecurityDataKey::PolicyCount, &2u64);
    }

    /// Initialize default blacklist and whitelist
    fn initialize_default_lists(env: Env) {
        let mut global_blacklist = Vec::new(&env);
        let mut global_whitelist = Vec::new(&env);
        
        // Add known malicious addresses to blacklist (example)
        // In production, these would be actual malicious addresses
        let malicious_address = Address::from_string(&String::from_str(&env, "0x0000000000000000000000000000000000000001"));
        global_blacklist.push_back(malicious_address);
        
        env.storage().instance().set(&SecurityDataKey::GlobalBlacklist, &global_blacklist);
        env.storage().instance().set(&SecurityDataKey::GlobalWhitelist, &global_whitelist);
    }

    /// Create a new security policy
    pub fn create_security_policy(
        env: Env,
        admin: Address,
        name: String,
        description: String,
        rules: Vec<SecurityRule>,
    ) -> u64 {
        let stored_admin: Address = env.storage().instance()
            .get(&SecurityDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let count: u64 = env.storage().instance().get(&SecurityDataKey::PolicyCount).unwrap_or(0);
        let policy_id = count + 1;
        
        let policy = SecurityPolicy {
            policy_id,
            name: name.clone(),
            description: description.clone(),
            rules: rules.clone(),
            active: true,
            created_at: env.ledger().timestamp(),
            updated_at: env.ledger().timestamp(),
        };
        
        env.storage().instance().set(&SecurityDataKey::Policy(policy_id), &policy);
        env.storage().instance().set(&SecurityDataKey::PolicyCount, &policy_id);
        
        policy_id
    }

    /// Evaluate transaction against security policies
    pub fn evaluate_transaction(
        env: Env,
        transaction_id: u64,
        user_address: Address,
        amount: u128,
        metadata: Bytes,
    ) -> SecurityAction {
        // Check if address is blacklisted
        if Self::is_address_blacklisted(env.clone(), user_address.clone()) {
            Self::create_security_event(
                env.clone(),
                transaction_id,
                user_address.clone(),
                RuleType::BlacklistAddress,
                SecurityAction::Block,
                Bytes::from_slice(&env, b"Address is blacklisted"),
                SecuritySeverity::High,
            );
            return SecurityAction::Block;
        }
        
        // Check if address is whitelisted (whitelisted addresses bypass most checks)
        let is_whitelisted = Self::is_address_whitelisted(env.clone(), user_address.clone());
        
        let count: u64 = env.storage().instance().get(&SecurityDataKey::PolicyCount).unwrap_or(0);
        let mut final_action = SecurityAction::Allow;
        
        for i in 1..=count {
            if let Some(policy) = env.storage().instance().get::<SecurityDataKey, SecurityPolicy>(&SecurityDataKey::Policy(i)) {
                if !policy.active {
                    continue;
                }
                
                for rule in policy.rules.iter() {
                    let action = Self::evaluate_rule(env.clone(), rule, user_address.clone(), amount, metadata.clone());
                    
                    match action {
                        SecurityAction::Block => {
                            Self::create_security_event(
                                env.clone(),
                                transaction_id,
                                user_address.clone(),
                                rule.rule_type.clone(),
                                SecurityAction::Block,
                                Bytes::from_slice(&env, b"Transaction blocked by security rule"),
                                SecuritySeverity::Medium,
                            );
                            return SecurityAction::Block;
                        },
                        SecurityAction::RequireAdditionalAuth => {
                            final_action = SecurityAction::RequireAdditionalAuth;
                        },
                        SecurityAction::FlagForReview => {
                            Self::create_security_event(
                                env.clone(),
                                transaction_id,
                                user_address.clone(),
                                rule.rule_type.clone(),
                                SecurityAction::FlagForReview,
                                Bytes::from_slice(&env, b"Transaction flagged for review"),
                                SecuritySeverity::Low,
                            );
                        },
                        _ => {}
                    }
                }
            }
        }
        
        final_action
    }

    /// Evaluate individual security rule
    fn evaluate_rule(
        env: Env,
        rule: &SecurityRule,
        user_address: Address,
        amount: u128,
        metadata: Bytes,
    ) -> SecurityAction {
        match rule.rule_type {
            RuleType::AmountLimit => {
                if amount > rule.threshold {
                    SecurityAction::RequireAdditionalAuth
                } else {
                    SecurityAction::Allow
                }
            },
            RuleType::FrequencyLimit => {
                // Simplified frequency check - in production, this would track actual frequency
                let current_time = env.ledger().timestamp();
                let recent_events = Self::get_recent_events(env.clone(), user_address, rule.time_window);
                
                if recent_events.len() >= rule.threshold as usize {
                    SecurityAction::Block
                } else {
                    SecurityAction::Allow
                }
            },
            RuleType::BlacklistAddress => {
                if Self::is_address_blacklisted(env.clone(), user_address) {
                    SecurityAction::Block
                } else {
                    SecurityAction::Allow
                }
            },
            RuleType::WhitelistAddress => {
                if Self::is_address_whitelisted(env.clone(), user_address) {
                    SecurityAction::Allow
                } else {
                    SecurityAction::RequireAdditionalAuth
                }
            },
            RuleType::SuspiciousPattern => {
                // Simplified pattern detection - in production, this would use ML/AI
                if Self::detect_suspicious_pattern(metadata) {
                    SecurityAction::FlagForReview
                } else {
                    SecurityAction::Allow
                }
            },
            RuleType::TimeLock => {
                // Simplified time lock - in production, this would check actual time constraints
                SecurityAction::Allow
            },
            RuleType::MultiSignature => {
                // Simplified multi-sig check - in production, this would verify signatures
                SecurityAction::RequireAdditionalAuth
            },
            RuleType::Geofencing => {
                // Simplified geofencing - in production, this would check IP/location
                SecurityAction::Allow
            },
        }
    }

    /// Detect suspicious patterns in transaction metadata
    fn detect_suspicious_pattern(metadata: Bytes) -> bool {
        // Simplified pattern detection
        // In production, this would use sophisticated ML/AI algorithms
        metadata.len() > 10000 // Large metadata might be suspicious
    }

    /// Get recent security events for an address
    fn get_recent_events(env: Env, user_address: Address, time_window: u64) -> Vec<SecurityEvent> {
        let count: u64 = env.storage().instance().get(&SecurityDataKey::EventCount).unwrap_or(0);
        let mut recent_events = Vec::new(&env);
        let current_time = env.ledger().timestamp();
        
        for i in 1..=count {
            if let Some(event) = env.storage().instance().get::<SecurityDataKey, SecurityEvent>(&SecurityDataKey::Event(i)) {
                if event.user_address == user_address && 
                   (current_time - event.timestamp) <= time_window {
                    recent_events.push_back(event);
                }
            }
        }
        
        recent_events
    }

    /// Add address to blacklist
    pub fn add_to_blacklist(
        env: Env,
        admin: Address,
        address: Address,
        reason: String,
        permanent: bool,
        expires_at: Option<u64>,
    ) {
        let stored_admin: Address = env.storage().instance()
            .get(&SecurityDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let entry = BlacklistEntry {
            address: address.clone(),
            reason,
            added_at: env.ledger().timestamp(),
            added_by: admin,
            permanent,
            expires_at,
        };
        
        env.storage().instance().set(&SecurityDataKey::BlacklistEntry(address), &entry);
    }

    /// Add address to whitelist
    pub fn add_to_whitelist(
        env: Env,
        admin: Address,
        address: Address,
        permissions: Vec<String>,
        expires_at: Option<u64>,
    ) {
        let stored_admin: Address = env.storage().instance()
            .get(&SecurityDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        let entry = WhitelistEntry {
            address: address.clone(),
            permissions,
            added_at: env.ledger().timestamp(),
            added_by: admin,
            expires_at,
        };
        
        env.storage().instance().set(&SecurityDataKey::WhitelistEntry(address), &entry);
    }

    /// Create security audit
    pub fn create_security_audit(
        env: Env,
        auditor: Address,
        audit_type: AuditType,
        findings: Vec<AuditFinding>,
    ) -> u64 {
        let count: u64 = env.storage().instance().get(&SecurityDataKey::AuditCount).unwrap_or(0);
        let audit_id = count + 1;
        
        let audit = SecurityAudit {
            audit_id,
            auditor: auditor.clone(),
            audit_type,
            findings: findings.clone(),
            timestamp: env.ledger().timestamp(),
            status: AuditStatus::Pending,
        };
        
        env.storage().instance().set(&SecurityDataKey::SecurityAudit(audit_id), &audit);
        env.storage().instance().set(&SecurityDataKey::AuditCount, &audit_id);
        
        audit_id
    }

    /// Create security event
    fn create_security_event(
        env: Env,
        transaction_id: u64,
        user_address: Address,
        rule_type: RuleType,
        action: SecurityAction,
        details: Bytes,
        severity: SecuritySeverity,
    ) {
        let count: u64 = env.storage().instance().get(&SecurityDataKey::EventCount).unwrap_or(0);
        let event_id = count + 1;
        
        let event = SecurityEvent {
            event_id,
            transaction_id,
            user_address,
            rule_type,
            action,
            details,
            timestamp: env.ledger().timestamp(),
            resolved: false,
            severity,
        };
        
        env.storage().instance().set(&SecurityDataKey::SecurityEvent(event_id), &event);
        env.storage().instance().set(&SecurityDataKey::EventCount, &event_id);
    }

    /// Check if address is blacklisted
    fn is_address_blacklisted(env: Env, address: Address) -> bool {
        if let Some(entry) = env.storage().instance().get::<SecurityDataKey, BlacklistEntry>(&SecurityDataKey::BlacklistEntry(address.clone())) {
            if entry.permanent {
                return true;
            }
            
            if let Some(expires_at) = entry.expires_at {
                if env.ledger().timestamp() < expires_at {
                    return true;
                }
            }
        }
        
        false
    }

    /// Check if address is whitelisted
    fn is_address_whitelisted(env: Env, address: Address) -> bool {
        if let Some(entry) = env.storage().instance().get::<SecurityDataKey, WhitelistEntry>(&SecurityDataKey::WhitelistEntry(address.clone())) {
            if let Some(expires_at) = entry.expires_at {
                if env.ledger().timestamp() >= expires_at {
                    return false;
                }
            }
            return true;
        }
        
        false
    }

    /// Emergency pause/unpause
    pub fn set_pause(env: Env, admin: Address, paused: bool) {
        let stored_admin: Address = env.storage().instance()
            .get(&SecurityDataKey::Admin)
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != stored_admin {
            panic!("Not authorized");
        }
        
        admin.require_auth();
        
        env.storage().instance().set(&SecurityDataKey::Paused, &paused);
    }

    /// Get security policy
    pub fn get_security_policy(env: Env, policy_id: u64) -> SecurityPolicy {
        env.storage().instance()
            .get(&SecurityDataKey::Policy(policy_id))
            .unwrap_or_else(|| panic!("Policy not found"))
    }

    /// Get security event
    pub fn get_security_event(env: Env, event_id: u64) -> SecurityEvent {
        env.storage().instance()
            .get(&SecurityDataKey::SecurityEvent(event_id))
            .unwrap_or_else(|| panic!("Event not found"))
    }

    /// Get security audit
    pub fn get_security_audit(env: Env, audit_id: u64) -> SecurityAudit {
        env.storage().instance()
            .get(&SecurityDataKey::SecurityAudit(audit_id))
            .unwrap_or_else(|| panic!("Audit not found"))
    }

    /// Get blacklist entry
    pub fn get_blacklist_entry(env: Env, address: Address) -> Option<BlacklistEntry> {
        env.storage().instance().get(&SecurityDataKey::BlacklistEntry(address))
    }

    /// Get whitelist entry
    pub fn get_whitelist_entry(env: Env, address: Address) -> Option<WhitelistEntry> {
        env.storage().instance().get(&SecurityDataKey::WhitelistEntry(address))
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&SecurityDataKey::Admin).unwrap()
    }
}
