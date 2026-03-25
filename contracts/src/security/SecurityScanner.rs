use soroban_sdk::{contracterror, contracttype, Address, Bytes, Env, String};
use crate::security::VulnerabilityDetector;
use crate::security::PatternMatcher;
use crate::security::SecurityReport;

#[contracterror]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SecurityScannerError {
    InvalidInput = 1,
    ScanInProgress = 2,
    ContractNotFound = 3,
    InsufficientPermissions = 4,
    ScanTimeout = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScanConfig {
    pub enable_gas_analysis: bool,
    pub enable_pattern_matching: bool,
    pub enable_vulnerability_detection: bool,
    pub severity_threshold: u8, // 0-10 scale
    pub custom_rules: Option<Bytes>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScanResult {
    pub scan_id: Bytes,
    pub contract_address: Address,
    pub timestamp: u64,
    pub vulnerabilities_found: u32,
    pub security_score: u8, // 0-100 scale
    pub gas_optimization_score: u8, // 0-100 scale
    pub scan_duration_ms: u64,
    pub report: SecurityReport,
}

pub struct SecurityScanner;

impl SecurityScanner {
    pub fn new() -> Self {
        Self
    }

    pub fn scan_contract(
        &self,
        env: &Env,
        contract_address: Address,
        contract_bytecode: Bytes,
        config: ScanConfig,
    ) -> Result<ScanResult, SecurityScannerError> {
        let scan_id = self.generate_scan_id(env);
        let start_time = env.ledger().timestamp();

        // Validate inputs
        if contract_bytecode.len() == 0 {
            return Err(SecurityScannerError::InvalidInput);
        }

        let mut vulnerabilities_found = 0u32;
        let mut security_score = 100u8;
        let mut gas_score = 100u8;

        // Initialize detector components
        let vulnerability_detector = VulnerabilityDetector::new();
        let pattern_matcher = PatternMatcher::new();

        // Perform vulnerability detection
        let vuln_results = if config.enable_vulnerability_detection {
            vulnerability_detector.detect_vulnerabilities(env, &contract_bytecode)?
        } else {
            Vec::new()
        };

        // Perform pattern matching
        let pattern_results = if config.enable_pattern_matching {
            pattern_matcher.match_security_patterns(env, &contract_bytecode)?
        } else {
            Vec::new()
        };

        // Perform gas analysis
        let gas_analysis = if config.enable_gas_analysis {
            self.analyze_gas_usage(env, &contract_bytecode)?
        } else {
            GasAnalysis::default()
        };

        // Calculate total vulnerabilities and scores
        vulnerabilities_found += vuln_results.len() as u32;
        vulnerabilities_found += pattern_results.len() as u32;

        // Calculate security score based on findings
        security_score = self.calculate_security_score(
            &vuln_results,
            &pattern_results,
            config.severity_threshold,
        );

        // Calculate gas optimization score
        gas_score = self.calculate_gas_score(&gas_analysis);

        let end_time = env.ledger().timestamp();
        let scan_duration = end_time.saturating_sub(start_time) * 1000; // Convert to ms

        // Generate comprehensive security report
        let report = SecurityReport::generate(
            env,
            scan_id.clone(),
            contract_address.clone(),
            vuln_results,
            pattern_results,
            gas_analysis,
            security_score,
            gas_score,
        );

        Ok(ScanResult {
            scan_id,
            contract_address,
            timestamp: start_time,
            vulnerabilities_found,
            security_score,
            gas_optimization_score: gas_score,
            scan_duration_ms: scan_duration,
            report,
        })
    }

    pub fn scan_multiple_contracts(
        &self,
        env: &Env,
        contracts: Vec<(Address, Bytes)>,
        config: ScanConfig,
    ) -> Result<Vec<ScanResult>, SecurityScannerError> {
        if contracts.is_empty() {
            return Err(SecurityScannerError::InvalidInput);
        }

        let mut results = Vec::new();
        
        for (address, bytecode) in contracts {
            match self.scan_contract(env, address, bytecode, config.clone()) {
                Ok(result) => results.push(result),
                Err(e) => {
                    // Log error but continue with other contracts
                    env.logs().add(&format!("Scan failed for contract: {:?}", e));
                }
            }
        }

        Ok(results)
    }

    fn generate_scan_id(&self, env: &Env) -> Bytes {
        let timestamp = env.ledger().timestamp();
        let nonce = env.prng().gen::<u64>();
        let mut scan_id = Bytes::new(env);
        scan_id.append(&timestamp.to_be_bytes());
        scan_id.append(&nonce.to_be_bytes());
        scan_id
    }

    fn calculate_security_score(
        &self,
        vulnerabilities: &[Vulnerability],
        patterns: &[SecurityPattern],
        severity_threshold: u8,
    ) -> u8 {
        let mut score = 100u8;
        
        // Deduct points for vulnerabilities based on severity
        for vuln in vulnerabilities {
            if vuln.severity >= severity_threshold {
                score = score.saturating_sub(vuln.severity * 5);
            }
        }

        // Deduct points for security anti-patterns
        for pattern in patterns {
            score = score.saturating_sub(pattern.severity * 3);
        }

        score.max(0)
    }

    fn calculate_gas_score(&self, gas_analysis: &GasAnalysis) -> u8 {
        let mut score = 100u8;
        
        // Deduct points for high gas usage patterns
        if gas_analysis.high_cost_operations > 0 {
            score = score.saturating_sub(10);
        }
        
        if gas_analysis.unoptimized_loops > 0 {
            score = score.saturating_sub(15);
        }
        
        if gas_analysis.storage_operations > 100 {
            score = score.saturating_sub(20);
        }

        score.max(0)
    }

    fn analyze_gas_usage(&self, env: &Env, bytecode: &Bytes) -> Result<GasAnalysis, SecurityScannerError> {
        // Simplified gas analysis - in a real implementation, this would
        // use more sophisticated bytecode analysis
        let mut analysis = GasAnalysis::default();
        
        // Count storage operations (simplified pattern matching)
        let bytecode_str = String::from_str(env, &bytecode.to_string());
        if bytecode_str.contains(&String::from_str(env, "sto")) {
            analysis.storage_operations += 1;
        }
        
        // Count loop patterns
        if bytecode_str.contains(&String::from_str(env, "loop")) {
            analysis.unoptimized_loops += 1;
        }
        
        // Detect high-cost operations
        if bytecode_str.contains(&String::from_str(env, "ecrecover")) ||
           bytecode_str.contains(&String::from_str(env, "sha256")) {
            analysis.high_cost_operations += 1;
        }

        Ok(analysis)
    }

    pub fn get_scan_history(
        &self,
        env: &Env,
        contract_address: Address,
        limit: u32,
    ) -> Result<Vec<ScanResult>, SecurityScannerError> {
        // In a real implementation, this would query storage
        // For now, return empty vector
        Ok(Vec::new())
    }

    pub fn get_vulnerability_statistics(
        &self,
        env: &Env,
    ) -> Result<VulnerabilityStats, SecurityScannerError> {
        // Return aggregate statistics
        Ok(VulnerabilityStats {
            total_scans: 0,
            vulnerabilities_found: 0,
            most_common_vuln: String::from_str(env, "None"),
            average_security_score: 85,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vulnerability {
    pub id: String,
    pub name: String,
    pub description: String,
    pub severity: u8,
    pub line_number: Option<u32>,
    pub remediation: String,
    pub cwe_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityPattern {
    pub id: String,
    pub name: String,
    pub description: String,
    pub severity: u8,
    pub pattern_type: PatternType,
    pub remediation: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PatternType {
    AntiPattern,
    BestPracticeViolation,
    GasInefficiency,
    SecurityRisk,
}

#[derive(Clone, Debug, Default)]
pub struct GasAnalysis {
    pub total_gas_estimate: u64,
    pub high_cost_operations: u32,
    pub unoptimized_loops: u32,
    pub storage_operations: u32,
    pub optimization_suggestions: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VulnerabilityStats {
    pub total_scans: u64,
    pub vulnerabilities_found: u64,
    pub most_common_vuln: String,
    pub average_security_score: u8,
}
