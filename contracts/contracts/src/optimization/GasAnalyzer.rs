use soroban_sdk::{Env, String, Vec, Map};
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq)]
pub struct GasAnalysis {
    pub function_name: String,
    pub total_gas_cost: u64,
    pub operation_costs: Vec<OperationCost>,
    pub optimization_opportunities: Vec<OptimizationOpportunity>,
    pub complexity_score: f64,
    pub execution_time_estimate: u64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct OperationCost {
    pub operation_type: OperationType,
    pub gas_cost: u64,
    pub line_number: usize,
    pub description: String,
    pub optimization_potential: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub enum OperationType {
    StorageRead,
    StorageWrite,
    StorageDelete,
    CryptographicOperation,
    LoopIteration,
    FunctionCall,
    MemoryAllocation,
    Arithmetic,
    Comparison,
    Branch,
    ExternalCall,
    EventEmission,
}

#[derive(Clone, Debug, PartialEq)]
pub struct OptimizationOpportunity {
    pub opportunity_type: OptimizationType,
    pub potential_savings: u64,
    pub description: String,
    pub difficulty: Difficulty,
    pub line_numbers: Vec<usize>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum OptimizationType {
    StorageBatching,
    LoopOptimization,
    MemoryPreallocation,
    FunctionInlining,
    ConstantFolding,
    DeadCodeRemoval,
    Caching,
    AlgorithmImprovement,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Difficulty {
    Easy,
    Medium,
    Hard,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ContractGasProfile {
    pub contract_name: String,
    pub total_functions: usize,
    pub total_gas_cost: u64,
    pub average_gas_cost: f64,
    pub function_analyses: Vec<GasAnalysis>,
    pub global_optimizations: Vec<OptimizationOpportunity>,
    pub gas_efficiency_score: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GasBenchmark {
    pub contract_name: String,
    pub version: String,
    pub timestamp: u64,
    pub total_gas_cost: u64,
    pub function_costs: HashMap<String, u64>,
    pub optimization_savings: u64,
}

pub struct GasAnalyzer;

impl GasAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub fn analyze_contract(
        &self,
        env: &Env,
        contract_code: &str,
        function_signatures: &[String],
    ) -> ContractGasProfile {
        let mut function_analyses = Vec::new();
        let mut total_gas_cost = 0u64;
        
        for function in function_signatures {
            let analysis = self.analyze_function(env, contract_code, function);
            total_gas_cost += analysis.total_gas_cost;
            function_analyses.push(analysis);
        }
        
        let average_gas_cost = if function_analyses.is_empty() {
            0.0
        } else {
            total_gas_cost as f64 / function_analyses.len() as f64
        };
        
        let global_optimizations = self.identify_global_optimizations(contract_code);
        let gas_efficiency_score = self.calculate_efficiency_score(&function_analyses);
        
        ContractGasProfile {
            contract_name: "VerinodeContract".to_string(),
            total_functions: function_analyses.len(),
            total_gas_cost,
            average_gas_cost,
            function_analyses,
            global_optimizations,
            gas_efficiency_score,
        }
    }

    pub fn analyze_function(
        &self,
        _env: &Env,
        contract_code: &str,
        function_name: &str,
    ) -> GasAnalysis {
        let function_code = self.extract_function_code(contract_code, function_name);
        let operation_costs = self.analyze_operations(&function_code);
        let total_gas_cost: u64 = operation_costs.iter().map(|op| op.gas_cost).sum();
        let optimization_opportunities = self.identify_optimization_opportunities(&function_code, &operation_costs);
        let complexity_score = self.calculate_complexity_score(&function_code);
        let execution_time_estimate = self.estimate_execution_time(total_gas_cost);
        
        GasAnalysis {
            function_name: function_name.to_string(),
            total_gas_cost,
            operation_costs,
            optimization_opportunities,
            complexity_score,
            execution_time_estimate,
        }
    }

    fn extract_function_code(&self, contract_code: &str, function_name: &str) -> String {
        let lines: Vec<&str> = contract_code.lines().collect();
        let mut function_lines = Vec::new();
        let mut in_function = false;
        let mut brace_count = 0;
        
        for line in lines {
            if line.contains(&format!("pub fn {}", function_name)) || 
               line.contains(&format!("fn {}", function_name)) {
                in_function = true;
                function_lines.push(line);
                brace_count += line.matches("{").count().saturating_sub(line.matches("}").count());
                continue;
            }
            
            if in_function {
                function_lines.push(line);
                brace_count += line.matches("{").count().saturating_sub(line.matches("}").count());
                
                if brace_count == 0 {
                    break;
                }
            }
        }
        
        function_lines.join("\n")
    }

    fn analyze_operations(&self, function_code: &str) -> Vec<OperationCost> {
        let mut operations = Vec::new();
        let lines: Vec<&str> = function_code.lines().enumerate().collect();
        
        for (line_num, line) in lines {
            // Storage operations
            if line.contains("env.storage().instance().get") {
                operations.push(OperationCost {
                    operation_type: OperationType::StorageRead,
                    gas_cost: 2000, // Base cost for storage read
                    line_number: line_num + 1,
                    description: "Storage read operation".to_string(),
                    optimization_potential: 0.3,
                });
            }
            
            if line.contains("env.storage().instance().set") {
                operations.push(OperationCost {
                    operation_type: OperationType::StorageWrite,
                    gas_cost: 5000, // Base cost for storage write
                    line_number: line_num + 1,
                    description: "Storage write operation".to_string(),
                    optimization_potential: 0.4,
                });
            }
            
            if line.contains("env.storage().instance().remove") {
                operations.push(OperationCost {
                    operation_type: OperationType::StorageDelete,
                    gas_cost: 3000, // Base cost for storage delete
                    line_number: line_num + 1,
                    description: "Storage delete operation".to_string(),
                    optimization_potential: 0.2,
                });
            }
            
            // Loop operations
            if line.contains("for") || line.contains("while") {
                operations.push(OperationCost {
                    operation_type: OperationType::LoopIteration,
                    gas_cost: 100, // Per iteration cost
                    line_number: line_num + 1,
                    description: "Loop iteration".to_string(),
                    optimization_potential: 0.6,
                });
            }
            
            // Function calls
            if line.contains(".require_auth()") {
                operations.push(OperationCost {
                    operation_type: OperationType::FunctionCall,
                    gas_cost: 1500,
                    line_number: line_num + 1,
                    description: "Authorization check".to_string(),
                    optimization_potential: 0.5,
                });
            }
            
            // Cryptographic operations
            if line.contains("hash") || line.contains("verify") || line.contains("sign") {
                operations.push(OperationCost {
                    operation_type: OperationType::CryptographicOperation,
                    gas_cost: 10000,
                    line_number: line_num + 1,
                    description: "Cryptographic operation".to_string(),
                    optimization_potential: 0.2,
                });
            }
            
            // Memory allocation
            if line.contains("Vec::new") || line.contains("String::new") {
                operations.push(OperationCost {
                    operation_type: OperationType::MemoryAllocation,
                    gas_cost: 500,
                    line_number: line_num + 1,
                    description: "Memory allocation".to_string(),
                    optimization_potential: 0.7,
                });
            }
            
            // Arithmetic operations
            if line.matches("+").count() > 0 || line.matches("*").count() > 0 || line.matches("/").count() > 0 {
                operations.push(OperationCost {
                    operation_type: OperationType::Arithmetic,
                    gas_cost: 50,
                    line_number: line_num + 1,
                    description: "Arithmetic operation".to_string(),
                    optimization_potential: 0.3,
                });
            }
            
            // Event emission
            if line.contains("env.events().publish") {
                operations.push(OperationCost {
                    operation_type: OperationType::EventEmission,
                    gas_cost: 2000,
                    line_number: line_num + 1,
                    description: "Event emission".to_string(),
                    optimization_potential: 0.1,
                });
            }
        }
        
        operations
    }

    fn identify_optimization_opportunities(
        &self,
        function_code: &str,
        operation_costs: &[OperationCost],
    ) -> Vec<OptimizationOpportunity> {
        let mut opportunities = Vec::new();
        
        // Storage batching opportunity
        let storage_ops: Vec<_> = operation_costs.iter()
            .filter(|op| matches!(op.operation_type, OperationType::StorageWrite))
            .collect();
        
        if storage_ops.len() > 2 {
            let potential_savings = (storage_ops.len() as u64 - 1) * 1000; // Save 1000 gas per batched write
            opportunities.push(OptimizationOpportunity {
                opportunity_type: OptimizationType::StorageBatching,
                potential_savings,
                description: "Batch multiple storage writes to reduce gas costs".to_string(),
                difficulty: Difficulty::Medium,
                line_numbers: storage_ops.iter().map(|op| op.line_number).collect(),
            });
        }
        
        // Loop optimization opportunity
        let loop_ops: Vec<_> = operation_costs.iter()
            .filter(|op| matches!(op.operation_type, OperationType::LoopIteration))
            .collect();
        
        if !loop_ops.is_empty() && function_code.contains("env.storage()") {
            let potential_savings = loop_ops.len() as u64 * 200; // Save 200 gas per optimized iteration
            opportunities.push(OptimizationOpportunity {
                opportunity_type: OptimizationType::LoopOptimization,
                potential_savings,
                description: "Optimize loops by caching storage values".to_string(),
                difficulty: Difficulty::Easy,
                line_numbers: loop_ops.iter().map(|op| op.line_number).collect(),
            });
        }
        
        // Memory preallocation opportunity
        let vec_ops: Vec<_> = operation_costs.iter()
            .filter(|op| matches!(op.operation_type, OperationType::MemoryAllocation))
            .collect();
        
        if vec_ops.len() > 1 {
            let potential_savings = vec_ops.len() as u64 * 300;
            opportunities.push(OptimizationOpportunity {
                opportunity_type: OptimizationType::MemoryPreallocation,
                potential_savings,
                description: "Pre-allocate memory for vectors to reduce reallocation costs".to_string(),
                difficulty: Difficulty::Easy,
                line_numbers: vec_ops.iter().map(|op| op.line_number).collect(),
            });
        }
        
        // Function inlining opportunity
        let function_calls: Vec<_> = operation_costs.iter()
            .filter(|op| matches!(op.operation_type, OperationType::FunctionCall))
            .collect();
        
        if function_calls.len() > 3 {
            let potential_savings = function_calls.len() as u64 * 500;
            opportunities.push(OptimizationOpportunity {
                opportunity_type: OptimizationType::FunctionInlining,
                potential_savings,
                description: "Inline small functions to reduce call overhead".to_string(),
                difficulty: Difficulty::Medium,
                line_numbers: function_calls.iter().map(|op| op.line_number).collect(),
            });
        }
        
        opportunities
    }

    fn identify_global_optimizations(&self, contract_code: &str) -> Vec<OptimizationOpportunity> {
        let mut opportunities = Vec::new();
        
        // Check for repeated patterns across the contract
        if contract_code.matches("env.ledger().timestamp()").count() > 3 {
            opportunities.push(OptimizationOpportunity {
                opportunity_type: OptimizationType::Caching,
                potential_savings: 2000,
                description: "Cache timestamp value to avoid repeated calls".to_string(),
                difficulty: Difficulty::Easy,
                line_numbers: vec![],
            });
        }
        
        // Check for inefficient data structures
        if contract_code.contains("Vec::new") && contract_code.contains("push_back") {
            opportunities.push(OptimizationOpportunity {
                opportunity_type: OptimizationType::MemoryPreallocation,
                potential_savings: 1500,
                description: "Use with_capacity for vectors when size is predictable".to_string(),
                difficulty: Difficulty::Easy,
                line_numbers: vec![],
            });
        }
        
        // Check for algorithm improvements
        if contract_code.contains("for") && contract_code.contains(".contains") {
            opportunities.push(OptimizationOpportunity {
                opportunity_type: OptimizationType::AlgorithmImprovement,
                potential_savings: 5000,
                description: "Replace linear search with more efficient algorithms".to_string(),
                difficulty: Difficulty::Hard,
                line_numbers: vec![],
            });
        }
        
        opportunities
    }

    fn calculate_complexity_score(&self, function_code: &str) -> f64 {
        let mut score = 0.0;
        
        // Base score for function length
        let line_count = function_code.lines().count();
        score += line_count as f64 * 0.1;
        
        // Add score for control flow complexity
        score += function_code.matches("if").count() as f64 * 2.0;
        score += function_code.matches("for").count() as f64 * 3.0;
        score += function_code.matches("while").count() as f64 * 3.0;
        score += function_code.matches("match").count() as f64 * 2.5;
        
        // Add score for storage operations
        score += function_code.matches("env.storage()").count() as f64 * 4.0;
        
        // Add score for cryptographic operations
        score += function_code.matches("hash").count() as f64 * 5.0;
        score += function_code.matches("verify").count() as f64 * 5.0;
        
        score
    }

    fn estimate_execution_time(&self, gas_cost: u64) -> u64 {
        // Rough estimation: 1 million gas = ~1 second
        gas_cost / 1_000_000
    }

    fn calculate_efficiency_score(&self, function_analyses: &[GasAnalysis]) -> f64 {
        if function_analyses.is_empty() {
            return 0.0;
        }
        
        let total_complexity: f64 = function_analyses.iter().map(|fa| fa.complexity_score).sum();
        let total_gas: u64 = function_analyses.iter().map(|fa| fa.total_gas_cost).sum();
        let function_count = function_analyses.len() as f64;
        
        // Efficiency score: lower gas and lower complexity = higher score
        let gas_factor = 1.0 / (1.0 + total_gas as f64 / 100000.0); // Normalize gas cost
        let complexity_factor = 1.0 / (1.0 + total_complexity / function_count); // Normalize complexity
        
        (gas_factor + complexity_factor) * 50.0 // Scale to 0-100
    }

    pub fn estimate_total_gas_cost(
        &self,
        _env: &Env,
        contract_code: &str,
        function_signatures: &[String],
    ) -> u64 {
        let profile = self.analyze_contract(_env, contract_code, function_signatures);
        profile.total_gas_cost
    }

    pub fn estimate_optimized_gas_cost(
        &self,
        _env: &Env,
        contract_code: &str,
        function_signatures: &[String],
        applied_optimizations: &[String],
    ) -> u64 {
        let original_cost = self.estimate_total_gas_cost(_env, contract_code, function_signatures);
        let mut savings = 0u64;
        
        for optimization in applied_optimizations {
            match optimization.as_str() {
                "StorageOptimization" => savings += original_cost * 15 / 100, // 15% savings
                "LoopOptimization" => savings += original_cost * 20 / 100,   // 20% savings
                "ArithmeticOptimization" => savings += original_cost * 5 / 100, // 5% savings
                "MemoryOptimization" => savings += original_cost * 10 / 100,   // 10% savings
                "FunctionInlining" => savings += original_cost * 8 / 100,      // 8% savings
                "ConstantFolding" => savings += original_cost * 3 / 100,       // 3% savings
                "DeadCodeElimination" => savings += original_cost * 7 / 100,  // 7% savings
                "BatchOperations" => savings += original_cost * 12 / 100,     // 12% savings
                _ => {}
            }
        }
        
        original_cost.saturating_sub(savings)
    }

    pub fn compare_gas_costs(&self, original: u64, optimized: u64) -> GasComparison {
        let savings = original.saturating_sub(optimized);
        let savings_percentage = if original > 0 {
            (savings as f64 / original as f64) * 100.0
        } else {
            0.0
        };
        
        GasComparison {
            original_cost: original,
            optimized_cost: optimized,
            gas_savings: savings,
            savings_percentage,
            efficiency_improvement: self.calculate_efficiency_improvement(original, optimized),
        }
    }

    fn calculate_efficiency_improvement(&self, original: u64, optimized: u64) -> f64 {
        if original == 0 {
            return 0.0;
        }
        
        let reduction_ratio = 1.0 - (optimized as f64 / original as f64);
        reduction_ratio * 100.0
    }

    pub fn generate_gas_report(&self, profile: &ContractGasProfile) -> String {
        let mut report = String::new();
        
        report.push_str("# Gas Analysis Report\n\n");
        report.push_str(&format!("Contract: {}\n", profile.contract_name));
        report.push_str(&format!("Total Functions: {}\n", profile.total_functions));
        report.push_str(&format!("Total Gas Cost: {:,}\n", profile.total_gas_cost));
        report.push_str(&format!("Average Gas Cost: {:.2}\n", profile.average_gas_cost));
        report.push_str(&format!("Efficiency Score: {:.2}/100\n\n", profile.gas_efficiency_score));
        
        report.push_str("## Function Analysis\n\n");
        for analysis in &profile.function_analyses {
            report.push_str(&format!("### {}\n", analysis.function_name));
            report.push_str(&format!("- Gas Cost: {:,}\n", analysis.total_gas_cost));
            report.push_str(&format!("- Complexity Score: {:.2}\n", analysis.complexity_score));
            report.push_str(&format!("- Est. Execution Time: {}s\n", analysis.execution_time_estimate));
            report.push_str(&format!("- Optimization Opportunities: {}\n", analysis.optimization_opportunities.len()));
            report.push_str("\n");
        }
        
        report.push_str("## Global Optimization Opportunities\n\n");
        for (i, opportunity) in profile.global_optimizations.iter().enumerate() {
            report.push_str(&format!("{}. {}\n", i + 1, opportunity.description));
            report.push_str(&format!("   - Potential Savings: {:,} gas\n", opportunity.potential_savings));
            report.push_str(&format!("   - Difficulty: {:?}\n\n", opportunity.difficulty));
        }
        
        report
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct GasComparison {
    pub original_cost: u64,
    pub optimized_cost: u64,
    pub gas_savings: u64,
    pub savings_percentage: f64,
    pub efficiency_improvement: f64,
}
