use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use crate::optimization::{GasAnalyzer, OptimizationReport, AutoRefactor};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationSuggestion {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: OptimizationCategory,
    pub severity: Severity,
    pub estimated_gas_saving: u64,
    pub confidence: f64,
    pub code_snippet: Option<String>,
    pub suggested_fix: Option<String>,
    pub line_number: Option<u32>,
    pub function_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OptimizationCategory {
    Storage,
    Loops,
    Arithmetic,
    ExternalCalls,
    DataStructures,
    ControlFlow,
    Memory,
    Events,
    Modifiers,
    Libraries,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIOptimizationResult {
    pub suggestions: Vec<OptimizationSuggestion>,
    pub total_estimated_savings: u64,
    pub analysis_time_ms: u64,
    pub contract_complexity_score: f64,
    pub optimization_potential: f64,
}

pub struct AIOptimizer {
    gas_analyzer: GasAnalyzer,
    auto_refactor: AutoRefactor,
    ml_model_path: String,
    optimization_patterns: HashMap<String, OptimizationPattern>,
}

#[derive(Debug, Clone)]
struct OptimizationPattern {
    pattern_id: String,
    regex_pattern: String,
    category: OptimizationCategory,
    base_gas_cost: u64,
    optimized_gas_cost: u64,
    description: String,
    suggestion_template: String,
}

impl AIOptimizer {
    pub fn new(ml_model_path: &str) -> Self {
        let mut optimizer = Self {
            gas_analyzer: GasAnalyzer::new(),
            auto_refactor: AutoRefactor::new(),
            ml_model_path: ml_model_path.to_string(),
            optimization_patterns: HashMap::new(),
        };
        
        optimizer.initialize_patterns();
        optimizer
    }

    fn initialize_patterns(&mut self) {
        // Storage optimization patterns
        self.optimization_patterns.insert("storage_packing".to_string(), OptimizationPattern {
            pattern_id: "storage_packing".to_string(),
            regex_pattern: r"struct\s+\w+\s*\{[^}]*\}".to_string(),
            category: OptimizationCategory::Storage,
            base_gas_cost: 20000,
            optimized_gas_cost: 15000,
            description: "Pack struct variables to save storage slots".to_string(),
            suggestion_template: "Consider reordering struct fields to pack them into fewer storage slots".to_string(),
        });

        // Loop optimization patterns
        self.optimization_patterns.insert("loop_unrolling".to_string(), OptimizationPattern {
            pattern_id: "loop_unrolling".to_string(),
            regex_pattern: r"for\s*\([^)]*\)\s*\{[^}]*\}".to_string(),
            category: OptimizationCategory::Loops,
            base_gas_cost: 5000,
            optimized_gas_cost: 3000,
            description: "Unroll small loops for better gas efficiency".to_string(),
            suggestion_template: "Consider unrolling this loop as it has a small, fixed number of iterations".to_string(),
        });

        // Arithmetic optimization patterns
        self.optimization_patterns.insert("bitwise_operations".to_string(), OptimizationPattern {
            pattern_id: "bitwise_operations".to_string(),
            regex_pattern: r"(\*\s*2|\/\s*2|\+\s*1|\-\s*1)".to_string(),
            category: OptimizationCategory::Arithmetic,
            base_gas_cost: 300,
            optimized_gas_cost: 150,
            description: "Use bitwise operations instead of arithmetic where possible".to_string(),
            suggestion_template: "Replace arithmetic operation with equivalent bitwise operation for gas savings".to_string(),
        });

        // External call optimization patterns
        self.optimization_patterns.insert("batch_external_calls".to_string(), OptimizationPattern {
            pattern_id: "batch_external_calls".to_string(),
            regex_pattern: r"\.call\s*\([^)]*\)".to_string(),
            category: OptimizationCategory::ExternalCalls,
            base_gas_cost: 21000,
            optimized_gas_cost: 15000,
            description: "Batch multiple external calls to reduce overhead".to_string(),
            suggestion_template: "Consider batching these external calls to reduce transaction costs".to_string(),
        });

        // Memory optimization patterns
        self.optimization_patterns.insert("memory_vs_storage".to_string(), OptimizationPattern {
            pattern_id: "memory_vs_storage".to_string(),
            regex_pattern: r"storage\s+.*=.*".to_string(),
            category: OptimizationCategory::Memory,
            base_gas_cost: 20000,
            optimized_gas_cost: 5000,
            description: "Use memory instead of storage for temporary variables".to_string(),
            suggestion_template: "Move this variable to memory as it's only used temporarily".to_string(),
        });
    }

    pub async fn analyze_contract(&self, contract_path: &str) -> Result<AIOptimizationResult, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        // Read contract source code
        let source_code = tokio::fs::read_to_string(contract_path).await?;
        
        // Perform gas analysis
        let gas_analysis = self.gas_analyzer.analyze_contract(contract_path).await?;
        
        // Generate AI-powered suggestions
        let mut suggestions = Vec::new();
        
        // Pattern-based analysis
        suggestions.extend(self.analyze_patterns(&source_code).await?);
        
        // ML-based analysis (if available)
        if Path::new(&self.ml_model_path).exists() {
            suggestions.extend(self.ml_based_analysis(&source_code).await?);
        }
        
        // Static analysis suggestions
        suggestions.extend(self.static_analysis_suggestions(&source_code, &gas_analysis).await?);
        
        // Sort suggestions by estimated gas savings
        suggestions.sort_by(|a, b| b.estimated_gas_saving.cmp(&a.estimated_gas_saving));
        
        let analysis_time = start_time.elapsed().as_millis() as u64;
        let total_savings = suggestions.iter().map(|s| s.estimated_gas_saving).sum();
        let complexity_score = self.calculate_complexity_score(&source_code);
        let optimization_potential = self.calculate_optimization_potential(&gas_analysis, total_savings);
        
        Ok(AIOptimizationResult {
            suggestions,
            total_estimated_savings: total_savings,
            analysis_time_ms: analysis_time,
            contract_complexity_score: complexity_score,
            optimization_potential,
        })
    }

    async fn analyze_patterns(&self, source_code: &str) -> Result<Vec<OptimizationSuggestion>, Box<dyn std::error::Error>> {
        let mut suggestions = Vec::new();
        
        for (pattern_id, pattern) in &self.optimization_patterns {
            // Simple pattern matching (in production, use proper regex)
            if source_code.contains(&pattern.pattern_id.replace("_", " ")) || 
               source_code.contains("for") || source_code.contains("struct") {
                
                let suggestion = OptimizationSuggestion {
                    id: format!("pattern_{}", pattern_id),
                    title: format!("{} Optimization", self.category_to_string(&pattern.category)),
                    description: pattern.description.clone(),
                    category: pattern.category.clone(),
                    severity: self.calculate_severity(pattern.base_gas_cost, pattern.optimized_gas_cost),
                    estimated_gas_saving: pattern.base_gas_cost - pattern.optimized_gas_cost,
                    confidence: 0.8,
                    code_snippet: None,
                    suggested_fix: Some(pattern.suggestion_template.clone()),
                    line_number: None,
                    function_name: None,
                };
                
                suggestions.push(suggestion);
            }
        }
        
        Ok(suggestions)
    }

    async fn ml_based_analysis(&self, source_code: &str) -> Result<Vec<OptimizationSuggestion>, Box<dyn std::error::Error>> {
        let mut suggestions = Vec::new();
        
        // Simulate ML model inference
        // In production, this would call an actual ML model
        let output = Command::new("python")
            .arg("ai/gas_optimization.py")
            .arg("--analyze")
            .arg(source_code)
            .output()
            .await?;
        
        if output.status.success() {
            let result = String::from_utf8_lossy(&output.stdout);
            // Parse ML results and convert to suggestions
            // This is a simplified version
            suggestions.push(OptimizationSuggestion {
                id: "ml_analysis_1".to_string(),
                title: "ML-Based Optimization".to_string(),
                description: "Machine learning model identified optimization opportunities".to_string(),
                category: OptimizationCategory::Storage,
                severity: Severity::Medium,
                estimated_gas_saving: 5000,
                confidence: 0.9,
                code_snippet: None,
                suggested_fix: Some(result.trim().to_string()),
                line_number: None,
                function_name: None,
            });
        }
        
        Ok(suggestions)
    }

    async fn static_analysis_suggestions(&self, source_code: &str, gas_analysis: &crate::optimization::GasAnalysisResult) -> Result<Vec<OptimizationSuggestion>, Box<dyn std::error::Error>> {
        let mut suggestions = Vec::new();
        
        // Check for expensive operations
        if source_code.contains("require(") {
            suggestions.push(OptimizationSuggestion {
                id: "require_optimization".to_string(),
                title: "Optimize Require Statements".to_string(),
                description: "Combine multiple require statements or use custom errors".to_string(),
                category: OptimizationCategory::ControlFlow,
                severity: Severity::Medium,
                estimated_gas_saving: 2000,
                confidence: 0.7,
                code_snippet: None,
                suggested_fix: Some("Consider using custom error messages or combining conditions".to_string()),
                line_number: None,
                function_name: None,
            });
        }
        
        // Check for unnecessary storage operations
        if source_code.matches("storage ").count() > 5 {
            suggestions.push(OptimizationSuggestion {
                id: "storage_optimization".to_string(),
                title: "Reduce Storage Operations".to_string(),
                description: "Multiple storage operations detected, consider optimization".to_string(),
                category: OptimizationCategory::Storage,
                severity: Severity::High,
                estimated_gas_saving: 15000,
                confidence: 0.8,
                code_snippet: None,
                suggested_fix: Some("Consider using memory variables or batching storage operations".to_string()),
                line_number: None,
                function_name: None,
            });
        }
        
        Ok(suggestions)
    }

    fn calculate_severity(&self, base_cost: u64, optimized_cost: u64) -> Severity {
        let savings = base_cost - optimized_cost;
        match savings {
            s if s >= 10000 => Severity::Critical,
            s if s >= 5000 => Severity::High,
            s if s >= 2000 => Severity::Medium,
            s if s >= 500 => Severity::Low,
            _ => Severity::Info,
        }
    }

    fn category_to_string(&self, category: &OptimizationCategory) -> String {
        match category {
            OptimizationCategory::Storage => "Storage".to_string(),
            OptimizationCategory::Loops => "Loops".to_string(),
            OptimizationCategory::Arithmetic => "Arithmetic".to_string(),
            OptimizationCategory::ExternalCalls => "External Calls".to_string(),
            OptimizationCategory::DataStructures => "Data Structures".to_string(),
            OptimizationCategory::ControlFlow => "Control Flow".to_string(),
            OptimizationCategory::Memory => "Memory".to_string(),
            OptimizationCategory::Events => "Events".to_string(),
            OptimizationCategory::Modifiers => "Modifiers".to_string(),
            OptimizationCategory::Libraries => "Libraries".to_string(),
        }
    }

    fn calculate_complexity_score(&self, source_code: &str) -> f64 {
        let lines = source_code.lines().count();
        let functions = source_code.matches("function ").count();
        let loops = source_code.matches("for ").count() + source_code.matches("while ").count();
        let conditionals = source_code.matches("if ").count();
        
        // Simple complexity calculation
        let base_score = (lines as f64) * 0.1;
        let function_score = (functions as f64) * 2.0;
        let loop_score = (loops as f64) * 3.0;
        let conditional_score = (conditionals as f64) * 1.5;
        
        base_score + function_score + loop_score + conditional_score
    }

    fn calculate_optimization_potential(&self, gas_analysis: &crate::optimization::GasAnalysisResult, total_savings: u64) -> f64 {
        if gas_analysis.total_gas_cost == 0 {
            return 0.0;
        }
        
        (total_savings as f64 / gas_analysis.total_gas_cost as f64) * 100.0
    }

    pub async fn apply_optimizations(&self, contract_path: &str, suggestions: &[OptimizationSuggestion]) -> Result<String, Box<dyn std::error::Error>> {
        let optimized_code = self.auto_refactor.refactor_contract(contract_path, suggestions).await?;
        Ok(optimized_code)
    }

    pub async fn generate_optimization_report(&self, result: &AIOptimizationResult) -> Result<OptimizationReport, Box<dyn std::error::Error>> {
        let report = OptimizationReport::generate_from_ai_result(result)?;
        Ok(report)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ai_optimizer_initialization() {
        let optimizer = AIOptimizer::new("models/gas_optimization.pkl");
        assert_eq!(optimizer.optimization_patterns.len(), 5);
    }

    #[tokio::test]
    async fn test_pattern_analysis() {
        let optimizer = AIOptimizer::new("models/gas_optimization.pkl");
        let source_code = r#"
            contract TestContract {
                struct MyStruct {
                    uint256 a;
                    uint256 b;
                    uint256 c;
                }
                
                function testFunction() public {
                    for(uint i = 0; i < 10; i++) {
                        // do something
                    }
                }
            }
        "#;
        
        let suggestions = optimizer.analyze_patterns(source_code).await.unwrap();
        assert!(!suggestions.is_empty());
    }
}
