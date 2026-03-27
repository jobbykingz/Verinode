#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Env, Address, Bytes};

    #[test]
    fn test_ai_optimizer() {
        let env = Env::default();
        let optimizer = AIOptimizer::new();
        
        let contract_code = r#"
        pub fn test_function(env: Env, data: Vec<Bytes>) -> Vec<Bytes> {
            let mut results = Vec::new(&env);
            
            for i in 0..data.len() {
                let timestamp = env.ledger().timestamp();
                let proof = env.storage().instance().get(&DataKey::Proof(i as u64));
                
                if let Some(p) = proof {
                    if p.verified == true {
                        results.push_back(p.event_data.clone());
                        env.storage().instance().set(&DataKey::Result(i as u64), &timestamp);
                    }
                }
            }
            
            results
        }
        "#;
        
        let function_signatures = vec!["test_function".to_string()];
        let result = optimizer.analyze_contract(&env, contract_code, &function_signatures);
        
        assert!(result.original_gas_cost > 0);
        assert!(result.optimized_gas_cost > 0);
        assert!(result.total_savings > 0);
        assert!(result.savings_percentage > 0.0);
        assert!(!result.suggestions.is_empty());
    }

    #[test]
    fn test_gas_analyzer() {
        let env = Env::default();
        let analyzer = GasAnalyzer::new();
        
        let contract_code = r#"
        pub fn expensive_function(env: Env, count: u64) -> u64 {
            let mut total = 0;
            
            for i in 1..=count {
                let proof = env.storage().instance().get(&DataKey::Proof(i));
                if let Some(p) = proof {
                    total += p.timestamp;
                }
            }
            
            total
        }
        "#;
        
        let function_signatures = vec!["expensive_function".to_string()];
        let profile = analyzer.analyze_contract(&env, contract_code, &function_signatures);
        
        assert_eq!(profile.contract_name, "VerinodeContract");
        assert!(profile.total_gas_cost > 0);
        assert!(profile.gas_efficiency_score > 0.0);
        assert!(!profile.function_analyses.is_empty());
    }

    #[test]
    fn test_auto_refactor() {
        let refact = AutoRefactor::new();
        
        let original_code = r#"
        let mut results = Vec::new(&env);
        for i in 0..10 {
            let timestamp = env.ledger().timestamp();
            results.push_back(timestamp);
        }
        "#;
        
        let suggestion = OptimizationSuggestion {
            contract_function: "test".to_string(),
            current_gas_cost: 10000,
            optimized_gas_cost: 8000,
            savings_percentage: 20.0,
            suggestion_type: SuggestionType::MemoryOptimization,
            description: "Optimize memory usage".to_string(),
            code_changes: vec!["Pre-allocate vector".to_string()],
            confidence_score: 0.8,
        };
        
        let optimized_code = refact.apply_optimization(original_code, &suggestion);
        
        assert!(!optimized_code.is_empty());
        assert_ne!(optimized_code, original_code);
    }

    #[test]
    fn test_optimization_report() {
        let env = Env::default();
        
        let result = AIOptimizationResult {
            original_gas_cost: 100000,
            optimized_gas_cost: 70000,
            total_savings: 30000,
            savings_percentage: 30.0,
            suggestions: vec![],
            applied_optimizations: vec!["StorageOptimization".to_string()],
            risk_assessment: RiskLevel::Low,
        };
        
        let report = OptimizationReport::new(&result, &env);
        
        assert!(!report.report_id.is_empty());
        assert_eq!(report.contract_name, "VerinodeContract");
        assert!(report.analysis_timestamp > 0);
    }

    #[test]
    fn test_gas_cost_estimation() {
        let env = Env::default();
        let analyzer = GasAnalyzer::new();
        
        // Test simple function
        let simple_code = r#"
        pub fn simple_function(env: Env) -> u64 {
            env.ledger().timestamp()
        }
        "#;
        
        let function_signatures = vec!["simple_function".to_string()];
        let cost = analyzer.estimate_total_gas_cost(&env, simple_code, &function_signatures);
        
        assert!(cost > 0);
        
        // Test complex function
        let complex_code = r#"
        pub fn complex_function(env: Env, data: Vec<Bytes>) -> Vec<Bytes> {
            let mut results = Vec::new(&env);
            
            for i in 0..data.len() {
                let timestamp = env.ledger().timestamp();
                let proof = env.storage().instance().get(&DataKey::Proof(i as u64));
                
                if let Some(p) = proof {
                    if p.verified == true {
                        results.push_back(p.event_data.clone());
                        env.storage().instance().set(&DataKey::Result(i as u64), &timestamp);
                    }
                }
            }
            
            results
        }
        "#;
        
        let complex_signatures = vec!["complex_function".to_string()];
        let complex_cost = analyzer.estimate_total_gas_cost(&env, complex_code, &complex_signatures);
        
        assert!(complex_cost > cost); // Complex function should cost more
    }

    #[test]
    fn test_pattern_recognition() {
        let optimizer = AIOptimizer::new();
        
        let code_with_patterns = r#"
        pub fn function_with_patterns(env: Env) {
            // Multiple storage operations
            env.storage().instance().set(&DataKey::Test1, &1);
            env.storage().instance().set(&DataKey::Test2, &2);
            env.storage().instance().set(&DataKey::Test3, &3);
            
            // Storage in loop
            for i in 1..=10 {
                let value = env.storage().instance().get(&DataKey::Proof(i));
                env.storage().instance().set(&DataKey::Result(i), &i);
            }
            
            // Repeated computation
            let timestamp1 = env.ledger().timestamp();
            let timestamp2 = env.ledger().timestamp();
            let timestamp3 = env.ledger().timestamp();
        }
        "#;
        
        let patterns = optimizer.detect_optimization_patterns(code_with_patterns);
        
        assert!(!patterns.is_empty());
        
        // Should detect storage inefficiency
        let storage_patterns: Vec<_> = patterns.iter()
            .filter(|p| matches!(p.pattern_type, PatternType::InefficientStorage))
            .collect();
        assert!(!storage_patterns.is_empty());
        
        // Should detect storage in loop
        let loop_patterns: Vec<_> = patterns.iter()
            .filter(|p| matches!(p.pattern_type, PatternType::LoopInefficiency))
            .collect();
        assert!(!loop_patterns.is_empty());
        
        // Should detect redundant computation
        let redundant_patterns: Vec<_> = patterns.iter()
            .filter(|p| matches!(p.pattern_type, PatternType::RedundantComputation))
            .collect();
        assert!(!redundant_patterns.is_empty());
    }

    #[test]
    fn test_optimization_suggestion_generation() {
        let optimizer = AIOptimizer::new();
        
        let pattern = OptimizationPattern {
            pattern_type: PatternType::InefficientStorage,
            locations: vec![10, 15, 20],
            severity: Severity::High,
            description: "Multiple storage operations detected".to_string(),
        };
        
        let suggestion = optimizer.generate_optimization_suggestion(&pattern, "test_function");
        
        assert_eq!(suggestion.contract_function, "storage_operations");
        assert!(suggestion.current_gas_cost > suggestion.optimized_gas_cost);
        assert!(suggestion.savings_percentage > 0.0);
        assert!(matches!(suggestion.suggestion_type, SuggestionType::StorageOptimization));
        assert!(!suggestion.code_changes.is_empty());
        assert!(suggestion.confidence_score > 0.0);
    }

    #[test]
    fn test_refactoring_validation() {
        let refact = AutoRefactor::new();
        
        let original_code = r#"
        pub fn test_function(env: Env) -> u64 {
            let x = 5;
            let y = 10;
            x + y
        }
        "#;
        
        let optimized_code = r#"
        pub fn test_function(env: Env) -> u64 {
            15 // Optimized: constant folding
        }
        "#;
        
        assert!(refact.validate_optimization(original_code, optimized_code));
    }

    #[test]
    fn test_compilation_validation() {
        let refact = AutoRefactor::new();
        
        // Valid code
        let valid_code = r#"
        pub fn valid_function(env: Env) -> u64 {
            42
        }
        "#;
        
        let status = refact.validate_compilation(valid_code);
        assert!(matches!(status, CompilationStatus::Success));
        
        // Invalid code (brace mismatch)
        let invalid_code = r#"
        pub fn invalid_function(env: Env) -> u64 {
            42
        // Missing closing brace
        "#;
        
        let status = refact.validate_compilation(invalid_code);
        assert!(matches!(status, CompilationStatus::Error(_)));
    }

    #[test]
    fn test_gas_comparison() {
        let analyzer = GasAnalyzer::new();
        
        let original_cost = 100000;
        let optimized_cost = 70000;
        
        let comparison = analyzer.compare_gas_costs(original_cost, optimized_cost);
        
        assert_eq!(comparison.original_cost, original_cost);
        assert_eq!(comparison.optimized_cost, optimized_cost);
        assert_eq!(comparison.gas_savings, 30000);
        assert_eq!(comparison.savings_percentage, 30.0);
        assert!(comparison.efficiency_improvement > 0.0);
    }

    #[test]
    fn test_risk_assessment() {
        let optimizer = AIOptimizer::new();
        
        // Low risk scenario
        let low_risk_suggestions = vec![
            OptimizationSuggestion {
                contract_function: "test1".to_string(),
                current_gas_cost: 10000,
                optimized_gas_cost: 8000,
                savings_percentage: 20.0,
                suggestion_type: SuggestionType::ConstantFolding,
                description: "Fold constants".to_string(),
                code_changes: vec!["Cache computed values".to_string()],
                confidence_score: 0.95,
            }
        ];
        
        let applied_optimizations = vec!["ConstantFolding".to_string()];
        let risk = optimizer.assess_optimization_risk(&low_risk_suggestions, &applied_optimizations);
        assert!(matches!(risk, RiskLevel::Low));
        
        // High risk scenario
        let high_risk_suggestions = vec![
            OptimizationSuggestion {
                contract_function: "test1".to_string(),
                current_gas_cost: 10000,
                optimized_gas_cost: 8000,
                savings_percentage: 20.0,
                suggestion_type: SuggestionType::StorageOptimization,
                description: "Optimize storage".to_string(),
                code_changes: vec!["Batch storage operations".to_string()],
                confidence_score: 0.6,
            },
            OptimizationSuggestion {
                contract_function: "test2".to_string(),
                current_gas_cost: 15000,
                optimized_gas_cost: 10000,
                savings_percentage: 33.3,
                suggestion_type: SuggestionType::AlgorithmImprovement,
                description: "Improve algorithm".to_string(),
                code_changes: vec!["Replace nested loops".to_string()],
                confidence_score: 0.7,
            }
        ];
        
        let applied_optimizations = vec!["StorageOptimization".to_string(), "AlgorithmImprovement".to_string()];
        let risk = optimizer.assess_optimization_risk(&high_risk_suggestions, &applied_optimizations);
        assert!(matches!(risk, RiskLevel::High));
    }

    #[test]
    fn test_optimization_report_generation() {
        let env = Env::default();
        
        let result = AIOptimizationResult {
            original_gas_cost: 200000,
            optimized_gas_cost: 130000,
            total_savings: 70000,
            savings_percentage: 35.0,
            suggestions: vec![
                OptimizationSuggestion {
                    contract_function: "test_function".to_string(),
                    current_gas_cost: 50000,
                    optimized_gas_cost: 35000,
                    savings_percentage: 30.0,
                    suggestion_type: SuggestionType::StorageOptimization,
                    description: "Optimize storage operations".to_string(),
                    code_changes: vec!["Batch storage writes".to_string()],
                    confidence_score: 0.85,
                }
            ],
            applied_optimizations: vec!["StorageOptimization".to_string()],
            risk_assessment: RiskLevel::Medium,
        };
        
        let report = OptimizationReport::new(&result, &env);
        
        // Test markdown report generation
        let markdown_report = report.generate_markdown_report();
        assert!(!markdown_report.is_empty());
        assert!(markdown_report.contains("Gas Optimization Report"));
        assert!(markdown_report.contains("35.0%"));
        
        // Test JSON export
        let json_report = report.export_json();
        assert!(!json_report.is_empty());
        assert!(json_report.contains("200000"));
        assert!(json_report.contains("130000"));
    }
}
