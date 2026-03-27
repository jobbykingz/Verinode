use std::collections::HashMap;
use std::path::Path;
use regex::Regex;
use serde::{Deserialize, Serialize};
use crate::optimization::AIOptimizer;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefactoringRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub pattern: String,
    pub replacement: String,
    pub category: RefactoringCategory,
    pub gas_savings_estimate: u64,
    pub risk_level: RiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RefactoringCategory {
    StorageOptimization,
    LoopOptimization,
    ArithmeticOptimization,
    CallOptimization,
    MemoryOptimization,
    StructuralOptimization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefactoringResult {
    pub original_code: String,
    pub refactored_code: String,
    pub applied_rules: Vec<RefactoringRule>,
    pub total_gas_savings: u64,
    pub changes_made: usize,
    pub validation_passed: bool,
    pub warnings: Vec<String>,
}

pub struct AutoRefactor {
    rules: Vec<RefactoringRule>,
    ai_optimizer: AIOptimizer,
}

impl AutoRefactor {
    pub fn new() -> Self {
        let mut refactor = Self {
            rules: Vec::new(),
            ai_optimizer: AIOptimizer::new("models/gas_optimization.pkl"),
        };
        
        refactor.initialize_rules();
        refactor
    }

    fn initialize_rules(&mut self) {
        // Storage optimization rules
        self.rules.push(RefactoringRule {
            id: "pack_struct_fields".to_string(),
            name: "Pack Struct Fields".to_string(),
            description: "Reorder struct fields to minimize storage slots".to_string(),
            pattern: r"struct\s+(\w+)\s*\{([^}]+)\}".to_string(),
            replacement: "struct $1 {$2}".to_string(),
            category: RefactoringCategory::StorageOptimization,
            gas_savings_estimate: 5000,
            risk_level: RiskLevel::Low,
        });

        // Loop optimization rules
        self.rules.push(RefactoringRule {
            id: "unroll_small_loops".to_string(),
            name: "Unroll Small Loops".to_string(),
            description: "Unroll loops with small, fixed iteration counts".to_string(),
            pattern: r"for\s*\(\s*uint\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*(\d+)\s*;\s*\1\+\+\s*\)\s*\{([^}]*)\}".to_string(),
            replacement: "unrolled_loop".to_string(),
            category: RefactoringCategory::LoopOptimization,
            gas_savings_estimate: 2000,
            risk_level: RiskLevel::Medium,
        });

        // Arithmetic optimization rules
        self.rules.push(RefactoringRule {
            id: "use_bitwise_operations".to_string(),
            name: "Use Bitwise Operations".to_string(),
            description: "Replace arithmetic operations with bitwise equivalents".to_string(),
            pattern: r"(\w+)\s*\*\s*2".to_string(),
            replacement: "$1 << 1".to_string(),
            category: RefactoringCategory::ArithmeticOptimization,
            gas_savings_estimate: 150,
            risk_level: RiskLevel::Low,
        });

        self.rules.push(RefactoringRule {
            id: "use_bitwise_div".to_string(),
            name: "Use Bitwise Division".to_string(),
            description: "Replace division by 2 with right shift".to_string(),
            pattern: r"(\w+)\s*/\s*2".to_string(),
            replacement: "$1 >> 1".to_string(),
            category: RefactoringCategory::ArithmeticOptimization,
            gas_savings_estimate: 200,
            risk_level: RiskLevel::Low,
        });

        // Memory optimization rules
        self.rules.push(RefactoringRule {
            id: "cache_storage_reads".to_string(),
            name: "Cache Storage Reads".to_string(),
            description: "Cache frequently accessed storage variables in memory".to_string(),
            pattern: r"storage\s+(\w+)\s*=\s*([^;]+);".to_string(),
            replacement: "uint256 cached_$1 = $2;".to_string(),
            category: RefactoringCategory::MemoryOptimization,
            gas_savings_estimate: 3000,
            risk_level: RiskLevel::Low,
        });

        // Call optimization rules
        self.rules.push(RefactoringRule {
            id: "batch_external_calls".to_string(),
            name: "Batch External Calls".to_string(),
            description: "Combine multiple external calls into a single transaction".to_string(),
            pattern: r"(\w+\.call\([^)]+\))\s*;\s*(\w+\.call\([^)]+\))".to_string(),
            replacement: "multicall([$1, $2])".to_string(),
            category: RefactoringCategory::CallOptimization,
            gas_savings_estimate: 6000,
            risk_level: RiskLevel::Medium,
        });

        // Structural optimization rules
        self.rules.push(RefactoringRule {
            id: "combine_require_statements".to_string(),
            name: "Combine Require Statements".to_string(),
            description: "Combine multiple require statements with logical operators".to_string(),
            pattern: r"require\(([^)]+)\);\s*require\(([^)]+)\)".to_string(),
            replacement: "require($1 && $2)".to_string(),
            category: RefactoringCategory::StructuralOptimization,
            gas_savings_estimate: 1000,
            risk_level: RiskLevel::Low,
        });

        self.rules.push(RefactoringRule {
            id: "use_custom_errors".to_string(),
            name: "Use Custom Errors".to_string(),
            description: "Replace require strings with custom errors".to_string(),
            pattern: r'require\(([^,]+),\s*"([^"]+)"\)'.to_string(),
            replacement: "if(!$1) revert CustomError();".to_string(),
            category: RefactoringCategory::StructuralOptimization,
            gas_savings_estimate: 2500,
            risk_level: RiskLevel::Medium,
        });
    }

    pub async fn refactor_contract(&self, contract_path: &str, suggestions: &[crate::optimization::OptimizationSuggestion]) -> Result<RefactoringResult, Box<dyn std::error::Error>> {
        let original_code = tokio::fs::read_to_string(contract_path).await?;
        
        let mut refactored_code = original_code.clone();
        let mut applied_rules = Vec::new();
        let mut total_gas_savings = 0;
        let mut changes_made = 0;
        let mut warnings = Vec::new();

        // Apply rules based on suggestions
        for suggestion in suggestions {
            if let Some(rule) = self.find_rule_for_suggestion(suggestion) {
                match self.apply_rule(&mut refactored_code, &rule) {
                    Ok((new_code, gas_savings, changes)) => {
                        refactored_code = new_code;
                        total_gas_savings += gas_savings;
                        changes_made += changes;
                        applied_rules.push(rule.clone());
                        
                        // Validate the change
                        if let Err(warning) = self.validate_refactoring(&original_code, &refactored_code).await {
                            warnings.push(warning);
                        }
                    }
                    Err(e) => {
                        warnings.push(format!("Failed to apply rule {}: {}", rule.name, e));
                    }
                }
            }
        }

        // Apply general optimization rules
        for rule in &self.rules {
            if self.should_apply_rule(&rule, &refactored_code) {
                match self.apply_rule(&mut refactored_code, rule) {
                    Ok((new_code, gas_savings, changes)) => {
                        refactored_code = new_code;
                        total_gas_savings += gas_savings;
                        changes_made += changes;
                        applied_rules.push(rule.clone());
                    }
                    Err(e) => {
                        warnings.push(format!("Failed to apply rule {}: {}", rule.name, e));
                    }
                }
            }
        }

        // Validate final result
        let validation_passed = self.validate_final_result(&original_code, &refactored_code).await?;

        Ok(RefactoringResult {
            original_code,
            refactored_code,
            applied_rules,
            total_gas_savings,
            changes_made,
            validation_passed,
            warnings,
        })
    }

    fn find_rule_for_suggestion(&self, suggestion: &crate::optimization::OptimizationSuggestion) -> Option<&RefactoringRule> {
        match &suggestion.category {
            crate::optimization::OptimizationCategory::Storage => {
                self.rules.iter().find(|r| matches!(r.category, RefactoringCategory::StorageOptimization))
            }
            crate::optimization::OptimizationCategory::Loops => {
                self.rules.iter().find(|r| matches!(r.category, RefactoringCategory::LoopOptimization))
            }
            crate::optimization::OptimizationCategory::Arithmetic => {
                self.rules.iter().find(|r| matches!(r.category, RefactoringCategory::ArithmeticOptimization))
            }
            crate::optimization::OptimizationCategory::ExternalCalls => {
                self.rules.iter().find(|r| matches!(r.category, RefactoringCategory::CallOptimization))
            }
            crate::optimization::OptimizationCategory::Memory => {
                self.rules.iter().find(|r| matches!(r.category, RefactoringCategory::MemoryOptimization))
            }
            _ => None,
        }
    }

    fn should_apply_rule(&self, rule: &RefactoringRule, code: &str) -> bool {
        // Check if the pattern exists in the code
        if let Ok(regex) = Regex::new(&rule.pattern) {
            regex.is_match(code)
        } else {
            false
        }
    }

    fn apply_rule(&self, code: &mut String, rule: &RefactoringRule) -> Result<(String, u64, usize), Box<dyn std::error::Error>> {
        let mut new_code = code.clone();
        let mut changes = 0;

        match rule.id.as_str() {
            "use_bitwise_operations" => {
                // Replace multiplication by 2 with left shift
                let regex = Regex::new(r"(\w+)\s*\*\s*2")?;
                let before_matches = regex.find_iter(&new_code).count();
                new_code = regex.replace_all(&new_code, "$1 << 1").to_string();
                changes = regex.find_iter(&new_code).count() - before_matches;
            }
            "use_bitwise_div" => {
                // Replace division by 2 with right shift
                let regex = Regex::new(r"(\w+)\s*/\s*2")?;
                let before_matches = regex.find_iter(&new_code).count();
                new_code = regex.replace_all(&new_code, "$1 >> 1").to_string();
                changes = regex.find_iter(&new_code).count() - before_matches;
            }
            "combine_require_statements" => {
                // Combine consecutive require statements
                let regex = Regex::new(r"require\(([^)]+)\);\s*require\(([^)]+)\)")?;
                let before_matches = regex.find_iter(&new_code).count();
                new_code = regex.replace_all(&new_code, "require($1 && $2)").to_string();
                changes = regex.find_iter(&new_code).count() - before_matches;
            }
            "cache_storage_reads" => {
                // Cache storage reads (simplified version)
                let lines: Vec<&str> = new_code.lines().collect();
                let mut new_lines = Vec::new();
                let mut storage_vars = HashMap::new();
                
                for line in lines {
                    if line.contains("storage") && line.contains("=") {
                        if let Some(captures) = Regex::new(r"storage\s+(\w+)\s*=\s*([^;]+);")?.captures(line) {
                            let var_name = captures.get(1).unwrap().as_str();
                            let value = captures.get(2).unwrap().as_str();
                            storage_vars.insert(var_name.to_string(), value.to_string());
                            new_lines.push(format!("uint256 cached_{} = {};", var_name, value));
                            changes += 1;
                        } else {
                            new_lines.push(line.to_string());
                        }
                    } else {
                        new_lines.push(line.to_string());
                    }
                }
                new_code = new_lines.join("\n");
            }
            "unroll_small_loops" => {
                // Unroll small loops (simplified version)
                let regex = Regex::new(r"for\s*\(\s*uint\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*(\d+)\s*;\s*\1\+\+\s*\)\s*\{([^{}]*)\}")?;
                let before_matches = regex.find_iter(&new_code).count();
                
                new_code = regex.replace_all(&new_code, |caps: &regex::Captures| {
                    let loop_var = caps.get(1).unwrap().as_str();
                    let iterations: u32 = caps.get(2).unwrap().as_str().parse().unwrap_or(3);
                    let body = caps.get(3).unwrap().as_str();
                    
                    if iterations <= 3 {
                        let mut unrolled = String::new();
                        for i in 0..iterations {
                            let iteration_body = body.replace(loop_var, &i.to_string());
                            unrolled.push_str(&iteration_body);
                            unrolled.push('\n');
                        }
                        unrolled
                    } else {
                        caps.get(0).unwrap().as_str().to_string()
                    }
                }).to_string();
                changes = regex.find_iter(&new_code).count() - before_matches;
            }
            _ => {
                // Default case: apply simple regex replacement
                if let Ok(regex) = Regex::new(&rule.pattern) {
                    let before_matches = regex.find_iter(&new_code).count();
                    new_code = regex.replace_all(&new_code, &rule.replacement).to_string();
                    changes = regex.find_iter(&new_code).count() - before_matches;
                }
            }
        }

        Ok((new_code, rule.gas_savings_estimate * changes as u64, changes))
    }

    async fn validate_refactoring(&self, original: &str, refactored: &str) -> Result<(), String> {
        // Basic validation checks
        if original.lines().count() != refactored.lines().count() {
            return Err("Line count changed significantly".to_string());
        }

        // Check for syntax errors (simplified)
        if refactored.contains(";;") || refactored.contains("{{") || refactored.contains("}}") {
            return Err("Potential syntax errors detected".to_string());
        }

        // Check function count
        let original_functions = original.matches("function ").count();
        let refactored_functions = refactored.matches("function ").count();
        if original_functions != refactored_functions {
            return Err("Function count changed".to_string());
        }

        Ok(())
    }

    async fn validate_final_result(&self, original: &str, refactored: &str) -> Result<bool, Box<dyn std::error::Error>> {
        // Compile check (simplified - in production would use actual compiler)
        let validation_result = self.validate_refactoring(original, refactored).await;
        
        match validation_result {
            Ok(_) => Ok(true),
            Err(warning) => {
                eprintln!("Validation warning: {}", warning);
                Ok(false)
            }
        }
    }

    pub async fn refactor_with_ai_assistance(&self, contract_path: &str) -> Result<RefactoringResult, Box<dyn std::error::Error>> {
        // First, get AI suggestions
        let ai_result = self.ai_optimizer.analyze_contract(contract_path).await?;
        
        // Then apply refactoring based on AI suggestions
        self.refactor_contract(contract_path, &ai_result.suggestions).await
    }

    pub fn generate_refactoring_summary(&self, result: &RefactoringResult) -> String {
        let mut summary = String::new();
        
        summary.push_str("# Refactoring Summary\n\n");
        summary.push_str(&format!("**Total Gas Savings: {}**\n\n", result.total_gas_savings));
        summary.push_str(&format!("**Changes Made: {}**\n\n", result.changes_made));
        summary.push_str(&format!("**Validation Status: {}**\n\n", 
            if result.validation_passed { "✅ Passed" } else { "❌ Failed" }));
        
        if !result.warnings.is_empty() {
            summary.push_str("## Warnings\n\n");
            for warning in &result.warnings {
                summary.push_str(&format!("- {}\n", warning));
            }
            summary.push_str("\n");
        }
        
        summary.push_str("## Applied Rules\n\n");
        for rule in &result.applied_rules {
            summary.push_str(&format!("### {}\n", rule.name));
            summary.push_str(&format!("**Category:** {:?}\n", rule.category));
            summary.push_str(&format!("**Gas Savings:** {}\n", rule.gas_savings_estimate));
            summary.push_str(&format!("**Risk Level:** {:?}\n", rule.risk_level));
            summary.push_str(&format!("**Description:** {}\n\n", rule.description));
        }
        
        summary
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_auto_refactor_initialization() {
        let refactor = AutoRefactor::new();
        assert!(refactor.rules.len() > 0);
    }

    #[tokio::test]
    async fn test_bitwise_optimization() {
        let refactor = AutoRefactor::new();
        let mut code = "uint x = a * 2;".to_string();
        
        let rule = refactor.rules.iter()
            .find(|r| r.id == "use_bitwise_operations")
            .unwrap();
        
        let (new_code, savings, changes) = refactor.apply_rule(&mut code, rule).unwrap();
        
        assert!(new_code.contains("<<"));
        assert_eq!(changes, 1);
        assert!(savings > 0);
    }

    #[tokio::test]
    async fn test_refactoring_validation() {
        let refactor = AutoRefactor::new();
        let original = "contract Test { function test() public { } }";
        let refactored = "contract Test { function test() public { } }";
        
        let result = refactor.validate_refactoring(original, refactored).await;
        assert!(result.is_ok());
    }
}
