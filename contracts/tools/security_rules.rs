use soroban_sdk::{contracterror, contracttype, Env, String, Vec, Map};
use crate::security::security_scanner::{Vulnerability, SecurityPattern, PatternType};

#[contracterror]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SecurityRulesError {
    RuleNotFound = 1,
    InvalidRule = 2,
    RuleConflict = 3,
    ConfigurationError = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: RuleCategory,
    pub severity: RuleSeverity,
    pub enabled: bool,
    pub conditions: Vec<RuleCondition>,
    pub actions: Vec<RuleAction>,
    pub metadata: RuleMetadata,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RuleCategory {
    VulnerabilityDetection,
    PatternMatching,
    GasOptimization,
    AccessControl,
    Cryptography,
    BusinessLogic,
    Compliance,
    Custom,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RuleSeverity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RuleCondition {
    pub condition_type: ConditionType,
    pub pattern: String,
    pub parameters: Map<String, String>,
    pub required: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ConditionType {
    RegexMatch,
    StringContains,
    ASTPattern,
    BytecodePattern,
    SemanticAnalysis,
    CustomFunction,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RuleAction {
    pub action_type: ActionType,
    pub parameters: Map<String, String>,
    pub priority: u8,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ActionType {
    ReportVulnerability,
    ReportPattern,
    AdjustScore,
    BlockDeployment,
    RequireReview,
    CustomAlert,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RuleMetadata {
    pub author: String,
    pub version: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub tags: Vec<String>,
    pub references: Vec<String>,
    pub false_positive_rate: f32,
    pub detection_rate: f32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityRulesConfig {
    pub rules: Map<String, SecurityRule>,
    pub global_settings: GlobalSettings,
    pub rule_categories: Map<RuleCategory, Vec<String>>,
    pub version: String,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GlobalSettings {
    pub severity_threshold: u8,
    pub enable_all_rules: bool,
    pub strict_mode: bool,
    pub ci_mode: bool,
    pub custom_rules_enabled: bool,
    pub reporting_format: ReportingFormat,
    pub max_findings_per_scan: u32,
    pub timeout_seconds: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReportingFormat {
    Detailed,
    Summary,
    Minimal,
    Custom,
}

impl SecurityRulesConfig {
    pub fn new(env: &Env) -> Self {
        let mut config = SecurityRulesConfig {
            rules: Map::new(env),
            global_settings: GlobalSettings {
                severity_threshold: 5,
                enable_all_rules: true,
                strict_mode: false,
                ci_mode: false,
                custom_rules_enabled: true,
                reporting_format: ReportingFormat::Detailed,
                max_findings_per_scan: 100,
                timeout_seconds: 300,
            },
            rule_categories: Map::new(env),
            version: String::from_str(env, "1.0.0"),
            last_updated: env.ledger().timestamp(),
        };
        
        config.initialize_default_rules(env);
        config
    }

    fn initialize_default_rules(&mut self, env: &Env) {
        // Add default security rules
        self.add_rule(env, Self::create_reentrancy_rule(env));
        self.add_rule(env, Self::create_overflow_rule(env));
        self.add_rule(env, Self::create_access_control_rule(env));
        self.add_rule(env, Self::create_gas_optimization_rule(env));
        self.add_rule(env, Self::create_cryptography_rule(env));
        self.add_rule(env, Self::create_compliance_rule(env));
    }

    fn create_reentrancy_rule(env: &Env) -> SecurityRule {
        SecurityRule {
            id: String::from_str(env, "RULE-REENT-001"),
            name: String::from_str(env, "Reentrancy Detection"),
            description: String::from_str(env, "Detects potential reentrancy vulnerabilities"),
            category: RuleCategory::VulnerabilityDetection,
            severity: RuleSeverity::High,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    condition_type: ConditionType::RegexMatch,
                    pattern: String::from_str(env, r"call\([^)]*\)\s*;[^}]*sto"),
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "confidence"), String::from_str(env, "0.8"));
                        params.set(String::from_str(env, "context_required"), String::from_str(env, "true"));
                        params
                    },
                    required: true,
                },
            ],
            actions: vec![
                RuleAction {
                    action_type: ActionType::ReportVulnerability,
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "severity"), String::from_str(env, "8"));
                        params.set(String::from_str(env, "cwe_id"), String::from_str(env, "CWE-841"));
                        params
                    },
                    priority: 1,
                },
                RuleAction {
                    action_type: ActionType::AdjustScore,
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "adjustment"), String::from_str(env, "-25"));
                        params
                    },
                    priority: 2,
                },
            ],
            metadata: RuleMetadata {
                author: String::from_str(env, "Verinode Security Team"),
                version: String::from_str(env, "1.0.0"),
                created_at: env.ledger().timestamp(),
                updated_at: env.ledger().timestamp(),
                tags: vec![
                    String::from_str(env, "reentrancy"),
                    String::from_str(env, "security"),
                    String::from_str(env, "critical"),
                ],
                references: vec![
                    String::from_str(env, "https://swcregistry.io/docs/SWC-107"),
                ],
                false_positive_rate: 0.05,
                detection_rate: 0.95,
            },
        }
    }

    fn create_overflow_rule(env: &Env) -> SecurityRule {
        SecurityRule {
            id: String::from_str(env, "RULE-OVERFLOW-001"),
            name: String::from_str(env, "Integer Overflow Detection"),
            description: String::from_str(env, "Detects potential integer overflow vulnerabilities"),
            category: RuleCategory::VulnerabilityDetection,
            severity: RuleSeverity::Medium,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    condition_type: ConditionType::RegexMatch,
                    pattern: String::from_str(env, r"[+\-\*/]\s*[a-zA-Z_][a-zA-Z0-9_]*"),
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "confidence"), String::from_str(env, "0.7"));
                        params
                    },
                    required: true,
                },
            ],
            actions: vec![
                RuleAction {
                    action_type: ActionType::ReportVulnerability,
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "severity"), String::from_str(env, "7"));
                        params.set(String::from_str(env, "cwe_id"), String::from_str(env, "CWE-190"));
                        params
                    },
                    priority: 1,
                },
            ],
            metadata: RuleMetadata {
                author: String::from_str(env, "Verinode Security Team"),
                version: String::from_str(env, "1.0.0"),
                created_at: env.ledger().timestamp(),
                updated_at: env.ledger().timestamp(),
                tags: vec![
                    String::from_str(env, "overflow"),
                    String::from_str(env, "arithmetic"),
                    String::from_str(env, "security"),
                ],
                references: vec![
                    String::from_str(env, "https://swcregistry.io/docs/SWC-101"),
                ],
                false_positive_rate: 0.15,
                detection_rate: 0.85,
            },
        }
    }

    fn create_access_control_rule(env: &Env) -> SecurityRule {
        SecurityRule {
            id: String::from_str(env, "RULE-ACCESS-001"),
            name: String::from_str(env, "Access Control Validation"),
            description: String::from_str(env, "Ensures sensitive functions have proper access control"),
            category: RuleCategory::AccessControl,
            severity: RuleSeverity::Critical,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    condition_type: ConditionType::SemanticAnalysis,
                    pattern: String::from_str(env, "sensitive_function_without_access_control"),
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "sensitive_functions"), String::from_str(env, "mint,burn,transfer_ownership,pause,unpause"));
                        params
                    },
                    required: true,
                },
            ],
            actions: vec![
                RuleAction {
                    action_type: ActionType::ReportVulnerability,
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "severity"), String::from_str(env, "9"));
                        params.set(String::from_str(env, "cwe_id"), String::from_str(env, "CWE-862"));
                        params
                    },
                    priority: 1,
                },
                RuleAction {
                    action_type: ActionType::RequireReview,
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "review_type"), String::from_str(env, "security"));
                        params
                    },
                    priority: 2,
                },
            ],
            metadata: RuleMetadata {
                author: String::from_str(env, "Verinode Security Team"),
                version: String::from_str(env, "1.0.0"),
                created_at: env.ledger().timestamp(),
                updated_at: env.ledger().timestamp(),
                tags: vec![
                    String::from_str(env, "access-control"),
                    String::from_str(env, "authorization"),
                    String::from_str(env, "critical"),
                ],
                references: vec![
                    String::from_str(env, "https://swcregistry.io/docs/SWC-105"),
                ],
                false_positive_rate: 0.02,
                detection_rate: 0.98,
            },
        }
    }

    fn create_gas_optimization_rule(env: &Env) -> SecurityRule {
        SecurityRule {
            id: String::from_str(env, "RULE-GAS-001"),
            name: String::from_str(env, "Gas Optimization Check"),
            description: String::from_str(env, "Identifies gas optimization opportunities"),
            category: RuleCategory::GasOptimization,
            severity: RuleSeverity::Low,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    condition_type: ConditionType::RegexMatch,
                    pattern: String::from_str(env, r"for\s*\([^)]*\)\s*\{[^}]*sto"),
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "confidence"), String::from_str(env, "0.8"));
                        params
                    },
                    required: true,
                },
            ],
            actions: vec![
                RuleAction {
                    action_type: ActionType::ReportPattern,
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "pattern_type"), String::from_str(env, "GasInefficiency"));
                        params.set(String::from_str(env, "severity"), String::from_str(env, "5"));
                        params
                    },
                    priority: 1,
                },
                RuleAction {
                    action_type: ActionType::AdjustScore,
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "adjustment"), String::from_str(env, "-10"));
                        params.set(String::from_str(env, "score_type"), String::from_str(env, "gas"));
                        params
                    },
                    priority: 2,
                },
            ],
            metadata: RuleMetadata {
                author: String::from_str(env, "Verinode Performance Team"),
                version: String::from_str(env, "1.0.0"),
                created_at: env.ledger().timestamp(),
                updated_at: env.ledger().timestamp(),
                tags: vec![
                    String::from_str(env, "gas"),
                    String::from_str(env, "optimization"),
                    String::from_str(env, "performance"),
                ],
                references: vec![
                    String::from_str(env, "https://docs.soliditylang.org/en/latest/optimization/"),
                ],
                false_positive_rate: 0.1,
                detection_rate: 0.9,
            },
        }
    }

    fn create_cryptography_rule(env: &Env) -> SecurityRule {
        SecurityRule {
            id: String::from_str(env, "RULE-CRYPTO-001"),
            name: String::from_str(env, "Weak Cryptography Detection"),
            description: String::from_str(env, "Detects weak cryptographic practices"),
            category: RuleCategory::Cryptography,
            severity: RuleSeverity::High,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    condition_type: ConditionType::StringContains,
                    pattern: String::from_str(env, "block.timestamp"),
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "context"), String::from_str(env, "randomness"));
                        params
                    },
                    required: true,
                },
            ],
            actions: vec![
                RuleAction {
                    action_type: ActionType::ReportVulnerability,
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "severity"), String::from_str(env, "7"));
                        params.set(String::from_str(env, "cwe_id"), String::from_str(env, "CWE-338"));
                        params
                    },
                    priority: 1,
                },
            ],
            metadata: RuleMetadata {
                author: String::from_str(env, "Verinode Security Team"),
                version: String::from_str(env, "1.0.0"),
                created_at: env.ledger().timestamp(),
                updated_at: env.ledger().timestamp(),
                tags: vec![
                    String::from_str(env, "cryptography"),
                    String::from_str(env, "randomness"),
                    String::from_str(env, "security"),
                ],
                references: vec![
                    String::from_str(env, "https://swcregistry.io/docs/SWC-120"),
                ],
                false_positive_rate: 0.08,
                detection_rate: 0.92,
            },
        }
    }

    fn create_compliance_rule(env: &Env) -> SecurityRule {
        SecurityRule {
            id: String::from_str(env, "RULE-COMP-001"),
            name: String::from_str(env, "Compliance Validation"),
            description: String::from_str(env, "Validates compliance with security standards"),
            category: RuleCategory::Compliance,
            severity: RuleSeverity::Medium,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    condition_type: ConditionType::CustomFunction,
                    pattern: String::from_str(env, "validate_compliance_standards"),
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "standards"), String::from_str(env, "ISO-27001,SOC2,PCI-DSS"));
                        params
                    },
                    required: true,
                },
            ],
            actions: vec![
                RuleAction {
                    action_type: ActionType::CustomAlert,
                    parameters: {
                        let mut params = Map::new(env);
                        params.set(String::from_str(env, "alert_type"), String::from_str(env, "compliance"));
                        params
                    },
                    priority: 1,
                },
            ],
            metadata: RuleMetadata {
                author: String::from_str(env, "Verinode Compliance Team"),
                version: String::from_str(env, "1.0.0"),
                created_at: env.ledger().timestamp(),
                updated_at: env.ledger().timestamp(),
                tags: vec![
                    String::from_str(env, "compliance"),
                    String::from_str(env, "standards"),
                    String::from_str(env, "audit"),
                ],
                references: vec![
                    String::from_str(env, "https://www.iso.org/isoiec-27001-information-security.html"),
                ],
                false_positive_rate: 0.12,
                detection_rate: 0.88,
            },
        }
    }

    pub fn add_rule(&mut self, env: &Env, rule: SecurityRule) {
        let category = rule.category.clone();
        let id = rule.id.clone();
        
        // Add to rules map
        self.rules.set(id.clone(), rule);
        
        // Add to category index
        let mut category_rules = self.rule_categories.get(category.clone()).unwrap_or(Vec::new(env));
        category_rules.push_back(id);
        self.rule_categories.set(category, category_rules);
        
        self.last_updated = env.ledger().timestamp();
    }

    pub fn remove_rule(&mut self, id: &String) -> Result<(), SecurityRulesError> {
        let rule = self.rules.get(id.clone())
            .ok_or(SecurityRulesError::RuleNotFound)?;
        
        // Remove from category index
        let category = rule.category;
        if let Some(mut category_rules) = self.rule_categories.get(category) {
            category_rules = category_rules.iter()
                .filter(|rule_id| rule_id != id)
                .cloned()
                .collect();
            self.rule_categories.set(category, category_rules);
        }
        
        // Remove from rules map
        self.rules.remove(id.clone());
        
        Ok(())
    }

    pub fn enable_rule(&mut self, id: &String) -> Result<(), SecurityRulesError> {
        let mut rule = self.rules.get(id.clone())
            .ok_or(SecurityRulesError::RuleNotFound)?;
        
        rule.enabled = true;
        self.rules.set(id.clone(), rule);
        
        Ok(())
    }

    pub fn disable_rule(&mut self, id: &String) -> Result<(), SecurityRulesError> {
        let mut rule = self.rules.get(id.clone())
            .ok_or(SecurityRulesError::RuleNotFound)?;
        
        rule.enabled = false;
        self.rules.set(id.clone(), rule);
        
        Ok(())
    }

    pub fn get_enabled_rules(&self) -> Vec<SecurityRule> {
        let mut enabled_rules = Vec::new();
        
        for (_, rule) in self.rules.iter() {
            if rule.enabled {
                enabled_rules.push_back(rule);
            }
        }
        
        enabled_rules
    }

    pub fn get_rules_by_category(&self, category: &RuleCategory) -> Vec<SecurityRule> {
        let category_ids = self.rule_categories.get(category.clone()).unwrap_or(Vec::new());
        let mut rules = Vec::new();
        
        for id in category_ids.iter() {
            if let Some(rule) = self.rules.get(id.clone()) {
                rules.push_back(rule);
            }
        }
        
        rules
    }

    pub fn get_rules_by_severity(&self, severity: &RuleSeverity) -> Vec<SecurityRule> {
        let mut matching_rules = Vec::new();
        
        for (_, rule) in self.rules.iter() {
            if rule.severity == *severity {
                matching_rules.push_back(rule);
            }
        }
        
        matching_rules
    }

    pub fn update_rule(&mut self, env: &Env, id: &String, updated_rule: SecurityRule) -> Result<(), SecurityRulesError> {
        if !self.rules.contains_key(id.clone()) {
            return Err(SecurityRulesError::RuleNotFound);
        }
        
        let mut rule = updated_rule;
        rule.metadata.updated_at = env.ledger().timestamp();
        
        self.rules.set(id.clone(), rule);
        self.last_updated = env.ledger().timestamp();
        
        Ok(())
    }

    pub fn validate_rule(&self, rule: &SecurityRule) -> Result<(), SecurityRulesError> {
        // Validate rule structure
        if rule.id.is_empty() || rule.name.is_empty() || rule.description.is_empty() {
            return Err(SecurityRulesError::InvalidRule);
        }
        
        // Validate conditions
        if rule.conditions.is_empty() {
            return Err(SecurityRulesError::InvalidRule);
        }
        
        for condition in rule.conditions.iter() {
            if condition.pattern.is_empty() {
                return Err(SecurityRulesError::InvalidRule);
            }
        }
        
        // Validate actions
        if rule.actions.is_empty() {
            return Err(SecurityRulesError::InvalidRule);
        }
        
        // Check for rule conflicts
        self.check_rule_conflicts(rule)?;
        
        Ok(())
    }

    fn check_rule_conflicts(&self, new_rule: &SecurityRule) -> Result<(), SecurityRulesError> {
        for (_, existing_rule) in self.rules.iter() {
            if existing_rule.id == new_rule.id {
                continue; // Skip self
            }
            
            // Check for conflicting conditions
            for new_condition in new_rule.conditions.iter() {
                for existing_condition in existing_rule.conditions.iter() {
                    if new_condition.pattern == existing_condition.pattern &&
                       new_rule.category == existing_rule.category {
                        return Err(SecurityRulesError::RuleConflict);
                    }
                }
            }
        }
        
        Ok(())
    }

    pub fn apply_rules(&self, env: &Env, source_code: &String, bytecode: &String) -> Vec<RuleResult> {
        let mut results = Vec::new();
        
        for rule in self.get_enabled_rules().iter() {
            if self.evaluate_rule(env, rule, source_code, bytecode) {
                let result = RuleResult {
                    rule_id: rule.id.clone(),
                    rule_name: rule.name.clone(),
                    category: rule.category.clone(),
                    severity: rule.severity.clone(),
                    matched: true,
                    findings: self.generate_findings(env, rule, source_code, bytecode),
                    timestamp: env.ledger().timestamp(),
                };
                
                results.push_back(result);
            }
        }
        
        results
    }

    fn evaluate_rule(
        &self,
        env: &Env,
        rule: &SecurityRule,
        source_code: &String,
        bytecode: &String,
    ) -> bool {
        // Check if rule meets severity threshold
        let rule_severity = self.severity_to_number(&rule.severity);
        if rule_severity < self.global_settings.severity_threshold {
            return false;
        }
        
        // Evaluate all conditions
        for condition in rule.conditions.iter() {
            let condition_met = self.evaluate_condition(env, condition, source_code, bytecode);
            
            if condition.required && !condition_met {
                return false; // Required condition not met
            }
            
            if !condition.required && condition_met {
                return true; // Optional condition met
            }
        }
        
        // If all required conditions are met and no optional conditions were met
        true
    }

    fn evaluate_condition(
        &self,
        env: &Env,
        condition: &RuleCondition,
        source_code: &String,
        bytecode: &String,
    ) -> bool {
        match condition.condition_type {
            ConditionType::RegexMatch => {
                // In a real implementation, this would use regex matching
                source_code.contains(&condition.pattern)
            }
            ConditionType::StringContains => {
                source_code.contains(&condition.pattern) || bytecode.contains(&condition.pattern)
            }
            ConditionType::ASTPattern => {
                // In a real implementation, this would use AST analysis
                false
            }
            ConditionType::BytecodePattern => {
                bytecode.contains(&condition.pattern)
            }
            ConditionType::SemanticAnalysis => {
                // In a real implementation, this would use semantic analysis
                false
            }
            ConditionType::CustomFunction => {
                // In a real implementation, this would call custom function
                false
            }
        }
    }

    fn generate_findings(
        &self,
        env: &Env,
        rule: &SecurityRule,
        source_code: &String,
        _bytecode: &String,
    ) -> Vec<String> {
        let mut findings = Vec::new();
        
        for action in rule.actions.iter() {
            match action.action_type {
                ActionType::ReportVulnerability => {
                    findings.push_back(String::from_str(env, &format!("Vulnerability detected: {}", rule.name)));
                }
                ActionType::ReportPattern => {
                    findings.push_back(String::from_str(env, &format!("Pattern detected: {}", rule.name)));
                }
                ActionType::AdjustScore => {
                    let adjustment = action.parameters.get(String::from_str(env, "adjustment"))
                        .unwrap_or(String::from_str(env, "0"));
                    findings.push_back(String::from_str(env, &format!("Score adjustment: {}", adjustment)));
                }
                ActionType::BlockDeployment => {
                    findings.push_back(String::from_str(env, "Deployment blocked due to security concerns"));
                }
                ActionType::RequireReview => {
                    findings.push_back(String::from_str(env, "Security review required"));
                }
                ActionType::CustomAlert => {
                    findings.push_back(String::from_str(env, &format!("Custom alert: {}", rule.name)));
                }
            }
        }
        
        findings
    }

    fn severity_to_number(&self, severity: &RuleSeverity) -> u8 {
        match severity {
            RuleSeverity::Info => 1,
            RuleSeverity::Low => 3,
            RuleSeverity::Medium => 5,
            RuleSeverity::High => 7,
            RuleSeverity::Critical => 9,
        }
    }

    pub fn export_config(&self) -> Result<String, SecurityRulesError> {
        // In a real implementation, this would serialize to JSON
        Ok("Security rules configuration export".to_string())
    }

    pub fn import_config(&mut self, env: &Env, config_data: &String) -> Result<(), SecurityRulesError> {
        // In a real implementation, this would parse JSON and update configuration
        self.last_updated = env.ledger().timestamp();
        Ok(())
    }

    pub fn reset_to_defaults(&mut self, env: &Env) {
        self.rules = Map::new(env);
        self.rule_categories = Map::new(env);
        self.initialize_default_rules(env);
        self.last_updated = env.ledger().timestamp();
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RuleResult {
    pub rule_id: String,
    pub rule_name: String,
    pub category: RuleCategory,
    pub severity: RuleSeverity,
    pub matched: bool,
    pub findings: Vec<String>,
    pub timestamp: u64,
}

// Utility functions for security rules management
pub struct SecurityRulesManager;

impl SecurityRulesManager {
    pub fn create_config(env: &Env) -> SecurityRulesConfig {
        SecurityRulesConfig::new(env)
    }

    pub fn validate_config(config: &SecurityRulesConfig) -> Result<(), SecurityRulesError> {
        // Validate global settings
        if config.global_settings.severity_threshold > 10 {
            return Err(SecurityRulesError::ConfigurationError);
        }
        
        // Validate all rules
        for (_, rule) in config.rules.iter() {
            config.validate_rule(rule)?;
        }
        
        Ok(())
    }

    pub fn optimize_rules(config: &mut SecurityRulesConfig) {
        // Optimize rule order based on performance and accuracy
        // In a real implementation, this would reorder rules for better performance
    }

    pub fn merge_configs(
        base_config: SecurityRulesConfig,
        override_config: SecurityRulesConfig,
    ) -> Result<SecurityRulesConfig, SecurityRulesError> {
        let mut merged = base_config;
        
        // Override rules with matching IDs
        for (id, rule) in override_config.rules.iter() {
            merged.rules.set(id.clone(), rule);
        }
        
        // Merge global settings (override takes precedence)
        merged.global_settings = override_config.global_settings;
        
        Ok(merged)
    }

    pub fn create_custom_rule(
        env: &Env,
        id: String,
        name: String,
        description: String,
        category: RuleCategory,
        severity: RuleSeverity,
        pattern: String,
    ) -> SecurityRule {
        SecurityRule {
            id,
            name,
            description,
            category,
            severity,
            enabled: true,
            conditions: vec![
                RuleCondition {
                    condition_type: ConditionType::RegexMatch,
                    pattern,
                    parameters: Map::new(env),
                    required: true,
                },
            ],
            actions: vec![
                RuleAction {
                    action_type: ActionType::ReportVulnerability,
                    parameters: Map::new(env),
                    priority: 1,
                },
            ],
            metadata: RuleMetadata {
                author: String::from_str(env, "Custom"),
                version: String::from_str(env, "1.0.0"),
                created_at: env.ledger().timestamp(),
                updated_at: env.ledger().timestamp(),
                tags: Vec::new(env),
                references: Vec::new(env),
                false_positive_rate: 0.1,
                detection_rate: 0.8,
            },
        }
    }
}
