use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, Symbol, U256};
use crate::security::validation::ValidationUtils;
use crate::security::access_control::AccessControl;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemplateManager {
    pub admin: Address,
    pub templates: Vec<ContractTemplate>,
    pub template_versions: Map<String, Vec<TemplateVersion>>,
    pub template_categories: Vec<TemplateCategory>,
    pub usage_stats: Map<String, TemplateUsageStats>,
    pub security_audit_results: Map<String, AuditResult>,
    pub deployment_queue: Vec<DeploymentRequest>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: TemplateCategory,
    pub version: String,
    pub author: Address,
    pub created_at: u64,
    pub updated_at: u64,
    pub template_type: TemplateType,
    pub parameters: TemplateParameters,
    pub security_level: SecurityLevel,
    pub pricing: TemplatePricing,
    pub tags: Vec<String>,
    pub dependencies: Vec<TemplateDependency>,
    pub documentation: TemplateDocumentation,
    pub verification_requirements: VerificationRequirements,
    pub deployment_config: DeploymentConfig,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TemplateCategory {
    Identity,
    Document,
    Timestamp,
    Ownership,
    Financial,
    Legal,
    Healthcare,
    Education,
    RealEstate,
    SupplyChain,
    DigitalAssets,
    Governance,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TemplateType {
    ProofContract,
    VerificationContract,
    GovernanceContract,
    TokenContract,
    NFTContract,
    MarketplaceContract,
    EscrowContract,
    OracleContract,
    MultiSigContract,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemplateParameters {
    pub required_params: Vec<ParameterDefinition>,
    pub optional_params: Vec<ParameterDefinition>,
    pub default_values: Map<Symbol, String>,
    pub validation_rules: Vec<ValidationRule>,
    pub parameter_groups: Vec<ParameterGroup>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParameterDefinition {
    pub name: String,
    pub param_type: ParameterType,
    pub required: bool,
    pub default_value: Option<String>,
    pub description: String,
    pub validation_pattern: Option<String>,
    pub min_value: Option<String>,
    pub max_value: Option<String>,
    pub options: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ParameterType {
    String,
    Number,
    Boolean,
    Address,
    Bytes,
    Array,
    Object,
    Enum,
    Timestamp,
    CID,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ValidationRule {
    pub rule_name: String,
    pub rule_type: ValidationRuleType,
    pub parameters: Map<Symbol, String>,
    pub error_message: String,
    pub severity: ValidationSeverity,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ValidationRuleType {
    Required,
    MinLength,
    MaxLength,
    Pattern,
    Range,
    Custom,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ValidationSeverity {
    Error,
    Warning,
    Info,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParameterGroup {
    pub name: String,
    pub description: String,
    pub parameters: Vec<String>,
    pub display_order: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SecurityLevel {
    Basic,
    Standard,
    Enhanced,
    Maximum,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemplatePricing {
    pub pricing_model: PricingModel,
    pub base_price: u64,
    pub price_per_use: Option<u64>,
    pub subscription_required: bool,
    pub free_tier_limits: Option<TierLimits>,
    pub enterprise_pricing: Option<EnterprisePricing>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PricingModel {
    Free,
    PerUse,
    Subscription,
    Tiered,
    Enterprise,
    Custom,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TierLimits {
    pub max_uses_per_month: u32,
    pub max_concurrent_deployments: u32,
    pub features_included: Vec<String>,
    pub support_level: SupportLevel,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SupportLevel {
    Community,
    Standard,
    Premium,
    Enterprise,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnterprisePricing {
    pub annual_price: u64,
    pub max_users: u32,
    pub custom_support: bool,
    pub source_code_access: bool,
    pub sla_guarantee: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemplateDependency {
    pub name: String,
    pub version_requirement: String,
    pub dependency_type: DependencyType,
    pub optional: bool,
    pub download_url: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DependencyType {
    Contract,
    Library,
    Oracle,
    Template,
    External,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemplateDocumentation {
    pub overview: String,
    pub installation_guide: String,
    pub usage_examples: Vec<UsageExample>,
    pub api_reference: String,
    pub troubleshooting: Vec<TroubleshootingItem>,
    pub security_considerations: Vec<SecurityConsideration>,
    pub changelog: Vec<ChangelogEntry>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UsageExample {
    pub title: String,
    pub description: String,
    pub code: String,
    pub parameters: Map<Symbol, String>,
    pub expected_output: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TroubleshootingItem {
    pub problem: String,
    pub solution: String,
    pub error_codes: Vec<String>,
    pub related_issues: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityConsideration {
    pub risk_level: RiskLevel,
    pub description: String,
    pub mitigation: String,
    pub audit_required: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChangelogEntry {
    pub version: String,
    pub date: u64,
    pub changes: Vec<String>,
    pub breaking_changes: Vec<String>,
    pub migration_guide: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerificationRequirements {
    pub code_review_required: bool,
    pub security_audit_required: bool,
    pub testing_requirements: TestingRequirements,
    pub compliance_standards: Vec<ComplianceStandard>,
    pub gas_optimization_required: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TestingRequirements {
    pub unit_test_coverage: f32,
    pub integration_test_required: bool,
    pub stress_test_required: bool,
    pub security_test_required: bool,
    pub performance_test_required: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ComplianceStandard {
    GDPR,
    HIPAA,
    SOX,
    PCI_DSS,
    ISO27001,
    SOC2,
    Custom(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeploymentConfig {
    pub supported_networks: Vec<String>,
    pub gas_estimates: GasEstimates,
    pub deployment_steps: Vec<DeploymentStep>,
    pub environment_requirements: EnvironmentRequirements,
    pub monitoring_setup: MonitoringSetup,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GasEstimates {
    pub deployment_gas: u64,
    pub execution_gas: Map<String, u64>, // function name -> gas
    pub storage_gas: u64,
    pub optimization_tips: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeploymentStep {
    pub step_number: u32,
    pub title: String,
    pub description: String,
    pub command: String,
    pub verification_method: String,
    pub expected_duration: u32, // in minutes
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnvironmentRequirements {
    pub min_stellar_version: String,
    pub required_dependencies: Vec<String>,
    pub hardware_requirements: HardwareRequirements,
    pub network_requirements: NetworkRequirements,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HardwareRequirements {
    pub min_memory: u64,
    pub min_storage: u64,
    pub recommended_cpu: String,
    pub optional_hardware: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NetworkRequirements {
    pub bandwidth_mbps: u32,
    pub latency_ms: u32,
    pub reliability: f32,
    pub security_requirements: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MonitoringSetup {
    pub metrics_enabled: bool,
    pub logging_enabled: bool,
    pub alerting_enabled: bool,
    pub dashboard_url: Option<String>,
    pub monitoring_tools: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemplateVersion {
    pub version: String,
    pub changelog: String,
    pub template_hash: Bytes,
    pub created_at: u64,
    pub author: Address,
    pub deprecated: bool,
    pub migration_path: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemplateUsageStats {
    pub total_deployments: u64,
    pub active_deployments: u64,
    pub success_rate: f32,
    pub average_gas_used: u64,
    pub user_satisfaction: f32,
    pub last_updated: u64,
    pub usage_by_region: Map<String, u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditResult {
    pub audit_id: String,
    pub auditor: Address,
    pub audit_date: u64,
    pub security_score: u8, // 0-100
    pub vulnerabilities_found: Vec<Vulnerability>,
    pub compliance_status: ComplianceStatus,
    pub recommendations: Vec<String>,
    pub next_audit_date: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vulnerability {
    pub severity: VulnerabilitySeverity,
    pub description: String,
    pub affected_code: String,
    pub remediation: String,
    pub cve_id: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VulnerabilitySeverity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ComplianceStatus {
    Compliant,
    NonCompliant,
    PartiallyCompliant,
    PendingReview,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeploymentRequest {
    pub request_id: u64,
    pub template_id: String,
    pub requester: Address,
    pub parameters: Map<Symbol, String>,
    pub target_network: String,
    pub status: DeploymentStatus,
    pub created_at: u64,
    pub updated_at: u64,
    pub deployment_hash: Option<Bytes>,
    pub error_message: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DeploymentStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

#[contract]
pub struct TemplateManagerContract;

#[contractimpl]
impl TemplateManagerContract {
    /// Initialize template manager
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Manager) {
            panic!("Template manager already initialized");
        }

        let manager = TemplateManager {
            admin: admin.clone(),
            templates: Vec::new(&env),
            template_versions: Map::new(&env),
            template_categories: Vec::new(&env),
            usage_stats: Map::new(&env),
            security_audit_results: Map::new(&env),
            deployment_queue: Vec::new(&env),
        };

        env.storage().instance().set(&DataKey::Manager, &manager);
        
        // Initialize default categories
        let default_categories = vec![
            &env, TemplateCategory::Identity,
            &env, TemplateCategory::Document,
            &env, TemplateCategory::Timestamp,
            &env, TemplateCategory::Ownership,
        ];
        env.storage().instance().set(&DataKey::Categories, &default_categories);
    }

    /// Register a new template
    pub fn register_template(
        env: Env,
        template: ContractTemplate,
    ) {
        let manager: TemplateManager = env.storage().instance()
            .get(&DataKey::Manager)
            .unwrap_or_else(|| panic!("Template manager not initialized"));

        // Verify admin authorization
        if manager.admin != template.author {
            panic!("Only admin can register templates");
        }

        template.author.require_auth();

        // Validate template
        Self::validate_template(&template);

        let mut updated_manager = manager;
        updated_manager.templates.push_back(template.clone());

        env.storage().instance().set(&DataKey::Manager, &updated_manager);
        env.storage().instance().set(&DataKey::Template(template.id.clone()), &template);
    }

    /// Update an existing template
    pub fn update_template(
        env: Env,
        template_id: String,
        updated_template: ContractTemplate,
    ) {
        let manager: TemplateManager = env.storage().instance()
            .get(&DataKey::Manager)
            .unwrap_or_else(|| panic!("Template manager not initialized"));

        let existing_template: ContractTemplate = env.storage().instance()
            .get(&DataKey::Template(template_id.clone()))
            .unwrap_or_else(|| panic!("Template not found"));

        // Verify author authorization
        if manager.admin != existing_template.author {
            panic!("Only template author can update templates");
        }

        existing_template.author.require_auth();

        // Validate updated template
        Self::validate_template(&updated_template);

        // Create new version
        let new_version = TemplateVersion {
            version: updated_template.version.clone(),
            changelog: format!("Updated from version {}", existing_template.version),
            template_hash: Self::compute_template_hash(&updated_template),
            created_at: env.ledger().timestamp(),
            author: existing_template.author.clone(),
            deprecated: false,
            migration_path: None,
        };

        // Store updated template
        env.storage().instance().set(&DataKey::Template(template_id), &updated_template);

        // Update version history
        let mut versions: Vec<TemplateVersion> = env.storage().instance()
            .get(&DataKey::TemplateVersions(template_id.clone()))
            .unwrap_or(Vec::new(&env));
        
        versions.push_back(new_version);
        env.storage().instance().set(&DataKey::TemplateVersions(template_id), &versions);
    }

    /// Deploy a template
    pub fn deploy_template(
        env: Env,
        template_id: String,
        parameters: Map<Symbol, String>,
        target_network: String,
    ) -> u64 {
        let requester = env.current_contract_address();
        requester.require_auth();

        let template: ContractTemplate = env.storage().instance()
            .get(&DataKey::Template(template_id.clone()))
            .unwrap_or_else(|| panic!("Template not found"));

        // Validate parameters
        Self::validate_deployment_parameters(&template, &parameters);

        let request_count: u64 = env.storage().instance().get(&DataKey::DeploymentCount).unwrap_or(0);
        let request_id = request_count + 1;

        let deployment_request = DeploymentRequest {
            request_id,
            template_id: template_id.clone(),
            requester: requester.clone(),
            parameters: parameters.clone(),
            target_network: target_network.clone(),
            status: DeploymentStatus::Pending,
            created_at: env.ledger().timestamp(),
            updated_at: env.ledger().timestamp(),
            deployment_hash: None,
            error_message: None,
        };

        // Add to deployment queue
        let mut manager: TemplateManager = env.storage().instance()
            .get(&DataKey::Manager)
            .unwrap();
        
        manager.deployment_queue.push_back(deployment_request.clone());
        env.storage().instance().set(&DataKey::Manager, &manager);
        env.storage().instance().set(&DataKey::DeploymentCount, &request_id);

        request_id
    }

    /// Process deployment queue
    pub fn process_deployment_queue(env: Env, admin: Address) {
        let mut manager: TemplateManager = env.storage().instance()
            .get(&DataKey::Manager)
            .unwrap();

        if manager.admin != admin {
            panic!("Only admin can process deployment queue");
        }

        admin.require_auth();

        let mut processed_requests = Vec::new(&env);
        let mut remaining_requests = Vec::new(&env);

        for request in manager.deployment_queue.iter() {
            if request.status == DeploymentStatus::Pending {
                // Process deployment (simplified)
                let deployment_hash = Self::generate_deployment_hash(&request);
                
                let mut updated_request = request.clone();
                updated_request.status = DeploymentStatus::Completed;
                updated_request.updated_at = env.ledger().timestamp();
                updated_request.deployment_hash = Some(deployment_hash);

                // Update usage stats
                Self::update_usage_stats(&env, &request.template_id);

                processed_requests.push_back(updated_request);
            } else {
                remaining_requests.push_back(request.clone());
            }
        }

        manager.deployment_queue = remaining_requests;
        env.storage().instance().set(&DataKey::Manager, &manager);

        // Store processed requests
        for request in processed_requests.iter() {
            env.storage().instance().set(&DataKey::DeploymentRequest(request.request_id), &request);
        }
    }

    /// Get template details
    pub fn get_template(env: Env, template_id: String) -> ContractTemplate {
        env.storage().instance()
            .get(&DataKey::Template(template_id))
            .unwrap_or_else(|| panic!("Template not found"))
    }

    /// List all templates
    pub fn list_templates(env: Env) -> Vec<ContractTemplate> {
        let manager: TemplateManager = env.storage().instance()
            .get(&DataKey::Manager)
            .unwrap();
        
        manager.templates
    }

    /// Get templates by category
    pub fn get_templates_by_category(env: Env, category: TemplateCategory) -> Vec<ContractTemplate> {
        let manager: TemplateManager = env.storage().instance()
            .get(&DataKey::Manager)
            .unwrap();
        
        manager.templates.iter()
            .filter(|t| t.category == category)
            .cloned()
            .collect()
    }

    /// Get template versions
    pub fn get_template_versions(env: Env, template_id: String) -> Vec<TemplateVersion> {
        env.storage().instance()
            .get(&DataKey::TemplateVersions(template_id))
            .unwrap_or(Vec::new(&env))
    }

    /// Get usage statistics
    pub fn get_usage_stats(env: Env, template_id: String) -> TemplateUsageStats {
        env.storage().instance()
            .get(&DataKey::UsageStats(template_id))
            .unwrap_or_else(|| TemplateUsageStats {
                total_deployments: 0,
                active_deployments: 0,
                success_rate: 0.0,
                average_gas_used: 0,
                user_satisfaction: 0.0,
                last_updated: 0,
                usage_by_region: Map::new(&env),
            })
    }

    /// Submit security audit result
    pub fn submit_audit_result(
        env: Env,
        template_id: String,
        audit_result: AuditResult,
    ) {
        let manager: TemplateManager = env.storage().instance()
            .get(&DataKey::Manager)
            .unwrap();

        // Verify auditor authorization
        if manager.admin != audit_result.auditor {
            panic!("Only authorized auditors can submit audit results");
        }

        audit_result.auditor.require_auth();

        env.storage().instance().set(&DataKey::AuditResult(template_id), &audit_result);
    }

    /// Get audit result
    pub fn get_audit_result(env: Env, template_id: String) -> AuditResult {
        env.storage().instance()
            .get(&DataKey::AuditResult(template_id))
            .unwrap_or_else(|| panic!("Audit result not found"))
    }

    /// Search templates
    pub fn search_templates(
        env: Env,
        query: String,
        category: Option<TemplateCategory>,
        tags: Vec<String>,
    ) -> Vec<ContractTemplate> {
        let manager: TemplateManager = env.storage().instance()
            .get(&DataKey::Manager)
            .unwrap();

        manager.templates.iter()
            .filter(|t| {
                let matches_query = t.name.to_string().contains(&query) || 
                                  t.description.to_string().contains(&query);
                let matches_category = category.as_ref().map_or(true, |c| &t.category == c);
                let matches_tags = tags.is_empty() || 
                                   tags.iter().any(|tag| t.tags.contains(tag));
                
                matches_query && matches_category && matches_tags
            })
            .cloned()
            .collect()
    }

    // Private helper methods

    fn validate_template(template: &ContractTemplate) {
        // Validate required fields
        if template.name.is_empty() {
            panic!("Template name is required");
        }

        if template.id.is_empty() {
            panic!("Template ID is required");
        }

        if template.description.is_empty() {
            panic!("Template description is required");
        }

        // Validate parameters
        if template.parameters.required_params.is_empty() {
            panic!("At least one required parameter is required");
        }

        // Validate security level
        match template.security_level {
            SecurityLevel::Basic | SecurityLevel::Standard | SecurityLevel::Enhanced | SecurityLevel::Maximum => {},
            SecurityLevel::Custom(_) => {},
        }
    }

    fn validate_deployment_parameters(template: &ContractTemplate, parameters: &Map<Symbol, String>) {
        // Check all required parameters are provided
        for param in &template.parameters.required_params {
            if !parameters.has_key(&Symbol::new(&env, &param.name)) {
                panic!("Required parameter missing: {}", param.name);
            }
        }

        // Validate parameter types and values
        for (symbol, value) in parameters.iter() {
            let param_name = symbol.to_string();
            
            // Find parameter definition
            let param_def = template.parameters.required_params.iter()
                .chain(template.parameters.optional_params.iter())
                .find(|p| p.name == param_name);
            
            if let Some(def) = param_def {
                Self::validate_parameter_value(&def, value);
            }
        }
    }

    fn validate_parameter_value(param_def: &ParameterDefinition, value: &String) {
        match param_def.param_type {
            ParameterType::String => {
                if let Some(min_len) = &param_def.min_value {
                    if value.len() < min_len.parse::<usize>().unwrap_or(0) {
                        panic!("String value too short");
                    }
                }
                if let Some(max_len) = &param_def.max_value {
                    if value.len() > max_len.parse::<usize>().unwrap_or(u32::MAX as usize) {
                        panic!("String value too long");
                    }
                }
            }
            ParameterType::Number => {
                if value.parse::<u64>().is_err() {
                    panic!("Invalid number value");
                }
            }
            ParameterType::Boolean => {
                if value != "true" && value != "false" {
                    panic!("Invalid boolean value");
                }
            }
            ParameterType::Address => {
                // Validate address format (simplified)
                if value.len() != 56 { // Stellar address length
                    panic!("Invalid address format");
                }
            }
            _ => {} // Accept other types for now
        }
    }

    fn compute_template_hash(template: &ContractTemplate) -> Bytes {
        // Simplified template hash computation
        // In practice, would use proper hashing
        let combined_data = format!("{}{}{}{}", template.id, template.version, template.name);
        combined_data.into_bytes()
    }

    fn generate_deployment_hash(request: &DeploymentRequest) -> Bytes {
        // Simplified deployment hash generation
        // In practice, would include more details
        let combined_data = format!("{}{}{}", request.template_id, request.request_id);
        combined_data.into_bytes()
    }

    fn update_usage_stats(env: &Env, template_id: &String) {
        let mut stats = env.storage().instance()
            .get(&DataKey::UsageStats(template_id.clone()))
            .unwrap_or_else(|| TemplateUsageStats {
                total_deployments: 0,
                active_deployments: 0,
                success_rate: 0.0,
                average_gas_used: 0,
                user_satisfaction: 0.0,
                last_updated: 0,
                usage_by_region: Map::new(&env),
            });

        stats.total_deployments += 1;
        stats.active_deployments += 1;
        stats.last_updated = env.ledger().timestamp();

        env.storage().instance().set(&DataKey::UsageStats(template_id.clone()), &stats);
    }
}

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    Manager,
    Categories,
    Template(String),
    TemplateVersions(String),
    UsageStats(String),
    AuditResult(String),
    DeploymentCount,
    DeploymentRequest(u64),
}
