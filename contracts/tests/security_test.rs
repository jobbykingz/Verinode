use soroban_sdk::{contractimpl, contracttype, Address, Bytes, Env, String, Vec};
use verinode_contracts::security::SecurityScanner;
use verinode_contracts::security::VulnerabilityDetector;
use verinode_contracts::security::PatternMatcher;
use verinode_contracts::security::SecurityReport;
use verinode_contracts::security::security_scanner::{
    ScanConfig, SecurityScannerError, Vulnerability, SecurityPattern, PatternType
};

#[contracttype]
pub struct SecurityTestContract;

#[contractimpl]
impl SecurityTestContract {
    // Test functions for security scanner
    pub fn test_security_scanner_basic(env: Env) -> bool {
        let scanner = SecurityScanner::new();
        let contract_address = Address::generate(&env);
        
        // Create test bytecode with vulnerabilities
        let mut bytecode = Bytes::new(&env);
        bytecode.append(&b"test_contract_with_vulnerabilities".to_vec());
        
        let config = ScanConfig {
            enable_gas_analysis: true,
            enable_pattern_matching: true,
            enable_vulnerability_detection: true,
            severity_threshold: 5,
            custom_rules: None,
        };
        
        match scanner.scan_contract(&env, contract_address, bytecode, config) {
            Ok(result) => {
                // Verify basic scan results
                result.vulnerabilities_found >= 0 &&
                result.security_score <= 100 &&
                result.gas_optimization_score <= 100
            }
            Err(_) => false,
        }
    }

    pub fn test_vulnerability_detector(env: Env) -> bool {
        let detector = VulnerabilityDetector::new();
        
        // Test bytecode with reentrancy vulnerability
        let mut reentrancy_bytecode = Bytes::new(&env);
        reentrancy_bytecode.append(&b"function withdraw() { call.value(amount)(); balance[msg.sender] = 0; }".to_vec());
        
        let reentrancy_result = detector.detect_vulnerabilities(&env, &reentrancy_bytecode);
        
        // Test bytecode with integer overflow
        let mut overflow_bytecode = Bytes::new(&env);
        overflow_bytecode.append(&b"function add(uint a, uint b) { return a + b; }".to_vec());
        
        let overflow_result = detector.detect_vulnerabilities(&env, &overflow_bytecode);
        
        // Test clean bytecode
        let mut clean_bytecode = Bytes::new(&env);
        clean_bytecode.append(&b"function safe_add(uint a, uint b) require(a + b >= a) { return a + b; }".to_vec());
        
        let clean_result = detector.detect_vulnerabilities(&env, &clean_bytecode);
        
        matches!(reentrancy_result, Ok(vulns) if vulns.len() > 0) &&
        matches!(overflow_result, Ok(vulns) if vulns.len() > 0) &&
        matches!(clean_result, Ok(vulns) if vulns.len() == 0)
    }

    pub fn test_pattern_matcher(env: Env) -> bool {
        let matcher = PatternMatcher::new();
        
        // Test bytecode with anti-patterns
        let mut anti_pattern_bytecode = Bytes::new(&env);
        anti_pattern_bytecode.append(&b"function complex() { if (x) { if (y) { if (z) { return 123; } } } }".to_vec());
        
        let anti_pattern_result = matcher.match_security_patterns(&env, &anti_pattern_bytecode);
        
        // Test bytecode with gas inefficiencies
        let mut gas_inefficient_bytecode = Bytes::new(&env);
        gas_inefficient_bytecode.append(&b"for (uint i = 0; i < array.length; i++) { storage_var[i] = i; }".to_vec());
        
        let gas_inefficient_result = matcher.match_security_patterns(&env, &gas_inefficient_bytecode);
        
        // Test clean bytecode
        let mut clean_bytecode = Bytes::new(&env);
        clean_bytecode.append(&b"function clean() { return 42; }".to_vec());
        
        let clean_result = matcher.match_security_patterns(&env, &clean_bytecode);
        
        matches!(anti_pattern_result, Ok(patterns) if patterns.len() > 0) &&
        matches!(gas_inefficient_result, Ok(patterns) if patterns.len() > 0) &&
        matches!(clean_result, Ok(patterns) if patterns.len() == 0)
    }

    pub fn test_security_report_generation(env: Env) -> bool {
        let vulnerabilities = vec![
            Vulnerability {
                id: String::from_str(&env, "TEST-001"),
                name: String::from_str(&env, "Test Vulnerability"),
                description: String::from_str(&env, "Test description"),
                severity: 8,
                line_number: Some(10),
                remediation: String::from_str(&env, "Fix the issue"),
                cwe_id: Some(String::from_str(&env, "CWE-123")),
            }
        ];
        
        let patterns = vec![
            SecurityPattern {
                id: String::from_str(&env, "PATTERN-001"),
                name: String::from_str(&env, "Test Pattern"),
                description: String::from_str(&env, "Test pattern description"),
                severity: 6,
                pattern_type: PatternType::AntiPattern,
                remediation: String::from_str(&env, "Improve code"),
            }
        ];
        
        let gas_analysis = verinode_contracts::security::security_scanner::GasAnalysis {
            total_gas_estimate: 100000,
            high_cost_operations: 2,
            unoptimized_loops: 1,
            storage_operations: 5,
            optimization_suggestions: Vec::new(&env),
        };
        
        let report = SecurityReport::generate(
            &env,
            Bytes::from_slice(&env, b"test_report_id"),
            Address::generate(&env),
            vulnerabilities,
            patterns,
            gas_analysis,
            75, // security_score
            80, // gas_score
        );
        
        // Verify report structure
        report.overall_score == 75 &&
        report.gas_score == 80 &&
        report.vulnerability_summary.total_count == 1 &&
        report.pattern_summary.total_count == 1
    }

    pub fn test_multiple_contract_scanning(env: Env) -> bool {
        let scanner = SecurityScanner::new();
        
        let contracts = vec![
            (Address::generate(&env), Bytes::from_slice(&env, b"contract1")),
            (Address::generate(&env), Bytes::from_slice(&env, b"contract2")),
            (Address::generate(&env), Bytes::from_slice(&env, b"contract3")),
        ];
        
        let config = ScanConfig {
            enable_gas_analysis: true,
            enable_pattern_matching: true,
            enable_vulnerability_detection: true,
            severity_threshold: 5,
            custom_rules: None,
        };
        
        match scanner.scan_multiple_contracts(&env, contracts, config) {
            Ok(results) => results.len() == 3,
            Err(_) => false,
        }
    }

    pub fn test_error_handling(env: Env) -> bool {
        let scanner = SecurityScanner::new();
        let contract_address = Address::generate(&env);
        
        // Test with empty bytecode
        let empty_bytecode = Bytes::new(&env);
        let config = ScanConfig {
            enable_gas_analysis: true,
            enable_pattern_matching: true,
            enable_vulnerability_detection: true,
            severity_threshold: 5,
            custom_rules: None,
        };
        
        match scanner.scan_contract(&env, contract_address, empty_bytecode, config) {
            Err(SecurityScannerError::InvalidInput) => true,
            _ => false,
        }
    }

    pub fn test_security_scoring(env: Env) -> bool {
        let scanner = SecurityScanner::new();
        let contract_address = Address::generate(&env);
        
        // Test with high severity vulnerabilities
        let mut high_risk_bytecode = Bytes::new(&env);
        high_risk_bytecode.append(&b"function bad() { call.value(amount)(); delegatecall(target); }".to_vec());
        
        let config = ScanConfig {
            enable_gas_analysis: true,
            enable_pattern_matching: true,
            enable_vulnerability_detection: true,
            severity_threshold: 5,
            custom_rules: None,
        };
        
        match scanner.scan_contract(&env, contract_address, high_risk_bytecode, config) {
            Ok(result) => result.security_score < 50, // Should have low security score
            Err(_) => false,
        }
    }

    pub fn test_gas_analysis(env: Env) -> bool {
        let scanner = SecurityScanner::new();
        let contract_address = Address::generate(&env);
        
        // Test with gas-inefficient bytecode
        let mut gas_inefficient_bytecode = Bytes::new(&env);
        gas_inefficient_bytecode.append(&b"for (uint i = 0; i < 1000; i++) { storage_var[i] = i * 2; }".to_vec());
        
        let config = ScanConfig {
            enable_gas_analysis: true,
            enable_pattern_matching: false,
            enable_vulnerability_detection: false,
            severity_threshold: 5,
            custom_rules: None,
        };
        
        match scanner.scan_contract(&env, contract_address, gas_inefficient_bytecode, config) {
            Ok(result) => result.gas_optimization_score < 80, // Should have lower gas score
            Err(_) => false,
        }
    }

    pub fn test_scan_configuration(env: Env) -> bool {
        let scanner = SecurityScanner::new();
        let contract_address = Address::generate(&env);
        let mut bytecode = Bytes::new(&env);
        bytecode.append(&b"test contract".to_vec());
        
        // Test with only vulnerability detection enabled
        let vuln_only_config = ScanConfig {
            enable_gas_analysis: false,
            enable_pattern_matching: false,
            enable_vulnerability_detection: true,
            severity_threshold: 5,
            custom_rules: None,
        };
        
        let vuln_only_result = scanner.scan_contract(&env, contract_address, bytecode.clone(), vuln_only_config);
        
        // Test with only gas analysis enabled
        let gas_only_config = ScanConfig {
            enable_gas_analysis: true,
            enable_pattern_matching: false,
            enable_vulnerability_detection: false,
            severity_threshold: 5,
            custom_rules: None,
        };
        
        let gas_only_result = scanner.scan_contract(&env, contract_address, bytecode, gas_only_config);
        
        matches!(vuln_only_result, Ok(_)) && matches!(gas_only_result, Ok(_))
    }

    pub fn test_performance_benchmarks(env: Env) -> bool {
        let scanner = SecurityScanner::new();
        let contract_address = Address::generate(&env);
        
        // Create larger bytecode for performance testing
        let mut large_bytecode = Bytes::new(&env);
        for i in 0..1000 {
            large_bytecode.append(&format!("function test_{}() {{ return {}; }}", i, i).into_bytes());
        }
        
        let config = ScanConfig {
            enable_gas_analysis: true,
            enable_pattern_matching: true,
            enable_vulnerability_detection: true,
            severity_threshold: 5,
            custom_rules: None,
        };
        
        let start_time = env.ledger().timestamp();
        let result = scanner.scan_contract(&env, contract_address, large_bytecode, config);
        let end_time = env.ledger().timestamp();
        
        match result {
            Ok(scan_result) => {
                // Scan should complete within reasonable time (simplified check)
                let scan_duration = end_time.saturating_sub(start_time);
                scan_result.scan_duration_ms > 0 && scan_duration < 1000 // Less than 1000 seconds
            }
            Err(_) => false,
        }
    }

    pub fn test_integration_scenarios(env: Env) -> bool {
        let scanner = SecurityScanner::new();
        
        // Test real-world scenario: ERC20-like contract with common vulnerabilities
        let mut erc20_bytecode = Bytes::new(&env);
        erc20_bytecode.append(&b"
            function transfer(address to, uint amount) {
                balance[msg.sender] -= amount;
                balance[to] += amount;
                call(to);
            }
            
            function approve(address spender, uint amount) {
                allowance[msg.sender][spender] = amount;
            }
            
            function transferFrom(address from, address to, uint amount) {
                allowance[from][msg.sender] -= amount;
                balance[from] -= amount;
                balance[to] += amount;
            }
        ".to_vec());
        
        let config = ScanConfig {
            enable_gas_analysis: true,
            enable_pattern_matching: true,
            enable_vulnerability_detection: true,
            severity_threshold: 5,
            custom_rules: None,
        };
        
        match scanner.scan_contract(&env, Address::generate(&env), erc20_bytecode, config) {
            Ok(result) => {
                // Should detect multiple issues in this vulnerable ERC20
                result.vulnerabilities_found >= 2 &&
                result.security_score < 80
            }
            Err(_) => false,
        }
    }

    pub fn run_all_tests(env: Env) -> Vec<bool> {
        vec![
            Self::test_security_scanner_basic(env.clone()),
            Self::test_vulnerability_detector(env.clone()),
            Self::test_pattern_matcher(env.clone()),
            Self::test_security_report_generation(env.clone()),
            Self::test_multiple_contract_scanning(env.clone()),
            Self::test_error_handling(env.clone()),
            Self::test_security_scoring(env.clone()),
            Self::test_gas_analysis(env.clone()),
            Self::test_scan_configuration(env.clone()),
            Self::test_performance_benchmarks(env.clone()),
            Self::test_integration_scenarios(env),
        ]
    }
}

// Unit tests for individual components
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vulnerability_detection() {
        let env = Env::default();
        let test_contract = SecurityTestContract;
        
        assert!(test_contract.test_vulnerability_detector(env));
    }

    #[test]
    fn test_pattern_matching() {
        let env = Env::default();
        let test_contract = SecurityTestContract;
        
        assert!(test_contract.test_pattern_matcher(env));
    }

    #[test]
    fn test_security_scanner() {
        let env = Env::default();
        let test_contract = SecurityTestContract;
        
        assert!(test_contract.test_security_scanner_basic(env));
    }

    #[test]
    fn test_report_generation() {
        let env = Env::default();
        let test_contract = SecurityTestContract;
        
        assert!(test_contract.test_security_report_generation(env));
    }

    #[test]
    fn test_error_cases() {
        let env = Env::default();
        let test_contract = SecurityTestContract;
        
        assert!(test_contract.test_error_handling(env));
    }

    #[test]
    fn test_gas_analysis() {
        let env = Env::default();
        let test_contract = SecurityTestContract;
        
        assert!(test_contract.test_gas_analysis(env));
    }

    #[test]
    fn test_all_components() {
        let env = Env::default();
        let test_contract = SecurityTestContract;
        
        let results = test_contract.run_all_tests(env);
        
        // All tests should pass
        for (i, result) in results.iter().enumerate() {
            assert!(result, "Test {} failed", i);
        }
    }
}

// Integration tests
#[cfg(test)]
mod integration_tests {
    use super::*;

    #[test]
    fn test_full_scan_pipeline() {
        let env = Env::default();
        let scanner = SecurityScanner::new();
        
        // Create contract with multiple types of issues
        let mut problematic_bytecode = Bytes::new(&env);
        problematic_bytecode.append(&b"
            // Reentrancy vulnerability
            function withdraw() {
                call.value(balance[msg.sender])();
                balance[msg.sender] = 0;
            }
            
            // Integer overflow
            function add(uint a, uint b) {
                return a + b;
            }
            
            // Gas inefficiency
            for (uint i = 0; i < array.length; i++) {
                storage_var[i] = array[i] * 2;
            }
            
            // Missing access control
            function mint(address to, uint amount) {
                balance[to] += amount;
            }
        ".to_vec());
        
        let config = ScanConfig {
            enable_gas_analysis: true,
            enable_pattern_matching: true,
            enable_vulnerability_detection: true,
            severity_threshold: 3, // Low threshold to catch more issues
            custom_rules: None,
        };
        
        let result = scanner.scan_contract(&env, Address::generate(&env), problematic_bytecode, config).unwrap();
        
        // Should detect multiple issues
        assert!(result.vulnerabilities_found >= 3);
        assert!(result.security_score < 70);
        assert!(result.gas_optimization_score < 80);
        
        // Verify report contains expected sections
        assert!(!result.recommendations.is_empty());
        assert!(result.vulnerability_summary.total_count > 0);
        assert!(result.pattern_summary.total_count > 0);
    }

    #[test]
    fn test_ci_cd_integration() {
        let env = Env::default();
        let scanner = SecurityScanner::new();
        
        // Simulate CI/CD pipeline scan
        let contracts = vec![
            (Address::generate(&env), Bytes::from_slice(&env, b"contract_A")),
            (Address::generate(&env), Bytes::from_slice(&env, b"contract_B")),
            (Address::generate(&env), Bytes::from_slice(&env, b"contract_C")),
        ];
        
        let ci_config = ScanConfig {
            enable_gas_analysis: true,
            enable_pattern_matching: true,
            enable_vulnerability_detection: true,
            severity_threshold: 7, // High threshold for CI (only critical issues)
            custom_rules: None,
        };
        
        let results = scanner.scan_multiple_contracts(&env, contracts, ci_config).unwrap();
        
        // CI should scan all contracts
        assert_eq!(results.len(), 3);
        
        // Check if any contracts fail CI (have critical issues)
        let failed_contracts = results.iter().filter(|r| r.security_score < 50).count();
        
        // For CI/CD, we might want to fail the build if security score is too low
        if failed_contracts > 0 {
            panic!("CI/CD pipeline failed: {} contracts have critical security issues", failed_contracts);
        }
    }
}
