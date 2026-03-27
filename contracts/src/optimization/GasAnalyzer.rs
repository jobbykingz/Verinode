use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasAnalysisResult {
    pub contract_name: String,
    pub total_gas_cost: u64,
    pub deployment_cost: u64,
    pub function_costs: HashMap<String, FunctionGasCost>,
    pub storage_operations: Vec<StorageOperation>,
    pub external_calls: Vec<ExternalCall>,
    pub loops: Vec<LoopAnalysis>,
    pub optimization_opportunities: Vec<OptimizationOpportunity>,
    pub gas_efficiency_score: f64,
    pub analysis_timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionGasCost {
    pub name: String,
    pub execution_cost: u64,
    pub transaction_cost: u64,
    pub input_cost: u64,
    pub output_cost: u64,
    pub lines_of_code: u32,
    pub complexity_score: f64,
    pub gas_per_line: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageOperation {
    pub operation_type: StorageOperationType,
    pub variable_name: String,
    pub gas_cost: u64,
    pub line_number: u32,
    pub function_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StorageOperationType {
    Read,
    Write,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalCall {
    pub target_contract: String,
    pub function_name: String,
    pub gas_cost: u64,
    pub line_number: u32,
    pub call_type: CallType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CallType {
    Call,
    DelegateCall,
    StaticCall,
    Transfer,
    Send,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoopAnalysis {
    pub loop_type: LoopType,
    pub iterations_estimate: u32,
    pub gas_cost_per_iteration: u64,
    pub total_gas_cost: u64,
    pub line_number: u32,
    pub function_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoopType {
    For,
    While,
    DoWhile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationOpportunity {
    pub opportunity_type: OptimizationType,
    pub description: String,
    pub estimated_savings: u64,
    pub confidence: f64,
    pub line_number: Option<u32>,
    pub function_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OptimizationType {
    StoragePacking,
    LoopUnrolling,
    BitwiseOperations,
    MemoryUsage,
    CallOptimization,
    CustomErrors,
    LibraryUsage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GasBenchmark {
    pub contract_name: String,
    pub version: String,
    pub benchmarks: HashMap<String, BenchmarkResult>,
    pub comparison_baseline: Option<String>,
    pub improvement_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub function_name: String,
    pub gas_used: u64,
    pub execution_time_ms: u64,
    pub memory_used: u64,
    pub success: bool,
}

pub struct GasAnalyzer {
    gas_costs: HashMap<String, u64>,
    optimization_patterns: Vec<OptimizationPattern>,
}

#[derive(Debug, Clone)]
struct OptimizationPattern {
    pattern_id: String,
    regex_pattern: String,
    optimization_type: OptimizationType,
    base_gas_cost: u64,
    optimized_gas_cost: u64,
    description: String,
}

impl GasAnalyzer {
    pub fn new() -> Self {
        let mut analyzer = Self {
            gas_costs: HashMap::new(),
            optimization_patterns: Vec::new(),
        };
        
        analyzer.initialize_gas_costs();
        analyzer.initialize_optimization_patterns();
        analyzer
    }

    fn initialize_gas_costs(&mut self) {
        // Ethereum gas costs (can be adapted for Stellar/Soroban)
        self.gas_costs.insert("GZERO".to_string(), 0);
        self.gas_costs.insert("GCALL".to_string(), 700);
        self.gas_costs.insert("GCALLVALUE".to_string(), 9000);
        self.gas_costs.insert("GEXTCODE".to_string(), 700);
        self.gas_costs.insert("GEXTCODEHASH".to_string(), 400);
        self.gas_costs.insert("GEXTCODECOPY".to_string(), 700);
        self.gas_costs.insert("GBALANCE".to_string(), 400);
        self.gas_costs.insert("GSELFDESTRUCT".to_string(), 5000);
        self.gas_costs.insert("GSELFDESTRUCT_NEWACCOUNT".to_string(), 25000);
        self.gas_costs.insert("GCREATE".to_string(), 32000);
        self.gas_costs.insert("GCREATE2".to_string(), 32000);
        self.gas_costs.insert("GLOG".to_string(), 375);
        self.gas_costs.insert("GLOGDATA".to_string(), 8);
        self.gas_costs.insert("GLOGTOPIC".to_string(), 375);
        self.gas_costs.insert("GEXP".to_string(), 10);
        self.gas_costs.insert("GEXPBYTE".to_string(), 50);
        self.gas_costs.insert("GMEMCOPY".to_string(), 3);
        self.gas_costs.insert("GMEMORY".to_string(), 3);
        self.gas_costs.insert("GKECCAK256".to_string(), 30);
        self.gas_costs.insert("GKECCAK256WORD".to_string(), 6);
        self.gas_costs.insert("GSTORAGE".to_string(), 20000);
        self.gas_costs.insert("GSTORAGERESET".to_string(), 5000);
        self.gas_costs.insert("GSTORAGEREFUND".to_string(), 15000);
        self.gas_costs.insert("GSTORAGECLEAR".to_string(), 15000);
        self.gas_costs.insert("GCLEANSTORAGE".to_string(), 15000);
        self.gas_costs.insert("GSHA3".to_string(), 30);
        self.gas_costs.insert("GSHA3WORD".to_string(), 6);
        self.gas_costs.insert("GSLOAD".to_string(), 800);
        self.gas_costs.insert("GSSTORE".to_string(), 20000);
        self.gas_costs.insert("GSSTOREZERO".to_string(), 5000);
        self.gas_costs.insert("GJUMPDEST".to_string(), 1);
        self.gas_costs.insert("GJUMP".to_string(), 8);
        self.gas_costs.insert("GRETURN".to_string(), 0);
        self.gas_costs.insert("GDELEGATECALL".to_string(), 700);
        self.gas_costs.insert("GSTATICCALL".to_string(), 700);
        self.gas_costs.insert("GTRANSACTION".to_string(), 21000);
        self.gas_costs.insert("GTRANSACTIONZERO".to_string(), 0);
        self.gas_costs.insert("GTRANSACTIONCREATE".to_string(), 32000);
        self.gas_costs.insert("GTRANSACTIONCREATEZERO".to_string(), 0);
        self.gas_costs.insert("GCALLNEWACCOUNT".to_string(), 25000);
        self.gas_costs.insert("GNEWACCOUNT".to_string(), 25000);
        self.gas_costs.insert("GEXPONENT".to_string(), 10);
        self.gas_costs.insert("GEXPONENTBYTE".to_string(), 50);
        self.gas_costs.insert("GMEMORY".to_string(), 3);
        self.gas_costs.insert("GMEMWORD".to_string(), 3);
        self.gas_costs.insert("GQUADRATICPERBYTE".to_string(), 0);
        self.gas_costs.insert("GCOPY".to_string(), 3);
        self.gas_costs.insert("GCOPYWORD".to_string(), 3);
        self.gas_costs.insert("GCOPYBYTE".to_string(), 3);
        self.gas_costs.insert("GCOPYQUADRATICPERBYTE".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE2".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE3".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE4".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE5".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE6".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE7".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE8".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE9".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE10".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE11".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE12".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE13".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE14".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE15".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE16".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE17".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE18".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE19".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE20".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE21".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE22".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE23".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE24".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE25".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE26".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE27".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE28".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE29".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE30".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE31".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE32".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE33".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE34".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE35".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE36".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE37".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE38".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE39".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE40".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE41".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE42".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE43".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE44".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE45".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE46".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE47".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE48".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE49".to_string(), 0);
        self.gas_costs.insert("GQUADRATICPERBYTE50".to_string(), 0);
    }

    fn initialize_optimization_patterns(&mut self) {
        self.optimization_patterns.push(OptimizationPattern {
            pattern_id: "storage_packing".to_string(),
            regex_pattern: r"struct\s+\w+\s*\{[^}]*\}".to_string(),
            optimization_type: OptimizationType::StoragePacking,
            base_gas_cost: 20000,
            optimized_gas_cost: 15000,
            description: "Pack struct variables to save storage slots".to_string(),
        });

        self.optimization_patterns.push(OptimizationPattern {
            pattern_id: "bitwise_multiplication".to_string(),
            regex_pattern: r"(\w+)\s*\*\s*2".to_string(),
            optimization_type: OptimizationType::BitwiseOperations,
            base_gas_cost: 300,
            optimized_gas_cost: 150,
            description: "Use left shift instead of multiplication by 2".to_string(),
        });

        self.optimization_patterns.push(OptimizationPattern {
            pattern_id: "bitwise_division".to_string(),
            regex_pattern: r"(\w+)\s*/\s*2".to_string(),
            optimization_type: OptimizationType::BitwiseOperations,
            base_gas_cost: 300,
            optimized_gas_cost: 150,
            description: "Use right shift instead of division by 2".to_string(),
        });

        self.optimization_patterns.push(OptimizationPattern {
            pattern_id: "require_optimization".to_string(),
            regex_pattern: r'require\(([^,]+),\s*"([^"]+)"\)'.to_string(),
            optimization_type: OptimizationType::CustomErrors,
            base_gas_cost: 2000,
            optimized_gas_cost: 500,
            description: "Use custom errors instead of require strings".to_string(),
        });

        self.optimization_patterns.push(OptimizationPattern {
            pattern_id: "storage_vs_memory".to_string(),
            regex_pattern: r"storage\s+.*=.*".to_string(),
            optimization_type: OptimizationType::MemoryUsage,
            base_gas_cost: 20000,
            optimized_gas_cost: 5000,
            description: "Use memory instead of storage for temporary variables".to_string(),
        });
    }

    pub async fn analyze_contract(&self, contract_path: &str) -> Result<GasAnalysisResult, Box<dyn std::error::Error>> {
        let source_code = tokio::fs::read_to_string(contract_path).await?;
        let contract_name = self.extract_contract_name(&source_code);
        
        let mut function_costs = HashMap::new();
        let mut storage_operations = Vec::new();
        let mut external_calls = Vec::new();
        let mut loops = Vec::new();
        let mut optimization_opportunities = Vec::new();
        
        // Analyze functions
        let functions = self.extract_functions(&source_code);
        for (func_name, func_code) in functions {
            let func_cost = self.analyze_function(&func_name, &func_code).await?;
            function_costs.insert(func_name, func_cost);
        }
        
        // Analyze storage operations
        storage_operations = self.analyze_storage_operations(&source_code).await?;
        
        // Analyze external calls
        external_calls = self.analyze_external_calls(&source_code).await?;
        
        // Analyze loops
        loops = self.analyze_loops(&source_code).await?;
        
        // Find optimization opportunities
        optimization_opportunities = self.find_optimization_opportunities(&source_code).await?;
        
        // Calculate total gas cost
        let total_gas_cost = self.calculate_total_gas_cost(&function_costs, &storage_operations, &external_calls, &loops);
        
        // Calculate deployment cost (simplified)
        let deployment_cost = self.estimate_deployment_cost(&source_code);
        
        // Calculate efficiency score
        let gas_efficiency_score = self.calculate_efficiency_score(total_gas_cost, &function_costs);
        
        Ok(GasAnalysisResult {
            contract_name,
            total_gas_cost,
            deployment_cost,
            function_costs,
            storage_operations,
            external_calls,
            loops,
            optimization_opportunities,
            gas_efficiency_score,
            analysis_timestamp: chrono::Utc::now(),
        })
    }

    fn extract_contract_name(&self, source_code: &str) -> String {
        let regex = Regex::new(r"contract\s+(\w+)").unwrap();
        if let Some(captures) = regex.captures(source_code) {
            captures.get(1).unwrap().as_str().to_string()
        } else {
            "Unknown".to_string()
        }
    }

    fn extract_functions(&self, source_code: &str) -> Vec<(String, String)> {
        let mut functions = Vec::new();
        let function_regex = Regex::new(r"function\s+(\w+)\s*\([^)]*\)\s*(?:public|private|internal|external)?\s*(?:view|pure|payable)?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}").unwrap();
        
        for captures in function_regex.captures_iter(source_code) {
            let func_name = captures.get(1).unwrap().as_str().to_string();
            let func_body = captures.get(2).unwrap().as_str().to_string();
            functions.push((func_name, func_body));
        }
        
        functions
    }

    async fn analyze_function(&self, func_name: &str, func_code: &str) -> Result<FunctionGasCost, Box<dyn std::error::Error>> {
        let lines_of_code = func_code.lines().count() as u32;
        
        // Base execution cost calculation (simplified)
        let execution_cost = self.calculate_execution_cost(func_code).await?;
        
        // Transaction cost includes base cost + execution cost
        let transaction_cost = 21000 + execution_cost;
        
        // Input/output costs (simplified)
        let input_cost = self.estimate_input_cost(func_code);
        let output_cost = self.estimate_output_cost(func_code);
        
        // Complexity score based on control flow
        let complexity_score = self.calculate_complexity_score(func_code);
        
        // Gas per line metric
        let gas_per_line = execution_cost as f64 / lines_of_code as f64;
        
        Ok(FunctionGasCost {
            name: func_name.to_string(),
            execution_cost,
            transaction_cost,
            input_cost,
            output_cost,
            lines_of_code,
            complexity_score,
            gas_per_line,
        })
    }

    async fn calculate_execution_cost(&self, func_code: &str) -> Result<u64, Box<dyn std::error::Error>> {
        let mut cost = 0u64;
        
        // Base cost per operation
        cost += func_code.lines().count() as u64 * 3; // GMEMORY per line
        
        // Storage operations
        let storage_writes = func_code.matches("storage ").count() as u64;
        cost += storage_writes * 20000; // GSTORAGE
        
        // External calls
        let external_calls = func_code.matches(".call(").count() as u64;
        cost += external_calls * 700; // GCALL
        
        // Loops
        let loops = func_code.matches("for ").count() + func_code.matches("while ").count();
        cost += (loops as u64) * 50; // Loop overhead
        
        // Arithmetic operations
        let arithmetic_ops = func_code.matches("+").count() + 
                           func_code.matches("-").count() + 
                           func_code.matches("*").count() + 
                           func_code.matches("/").count();
        cost += (arithmetic_ops as u64) * 3; // GEXPO per byte
        
        // Hash operations
        let hash_ops = func_code.matches("keccak256(").count() as u64;
        cost += hash_ops * 30; // GKECCAK256
        
        Ok(cost)
    }

    fn estimate_input_cost(&self, func_code: &str) -> u64 {
        // Simplified input cost based on parameters
        let param_count = func_code.matches("uint256").count() + 
                         func_code.matches("address").count() + 
                         func_code.matches("bool").count();
        (param_count as u64) * 32 * 3 // 32 bytes per param * GMEMORY
    }

    fn estimate_output_cost(&self, func_code: &str) -> u64 {
        // Simplified output cost based on return statements
        let return_count = func_code.matches("return ").count() as u64;
        return_count * 32 * 3 // 32 bytes per return * GMEMORY
    }

    fn calculate_complexity_score(&self, func_code: &str) -> f64 {
        let if_count = func_code.matches("if ").count();
        let for_count = func_code.matches("for ").count();
        let while_count = func_code.matches("while ").count();
        let call_count = func_code.matches(".call(").count();
        
        // Cyclomatic complexity approximation
        1.0 + (if_count + for_count + while_count + call_count) as f64
    }

    async fn analyze_storage_operations(&self, source_code: &str) -> Result<Vec<StorageOperation>, Box<dyn std::error::Error>> {
        let mut operations = Vec::new();
        let lines: Vec<&str> = source_code.lines().collect();
        
        for (line_num, line) in lines.iter().enumerate() {
            if line.contains("storage") && line.contains("=") {
                let operation_type = if line.contains("delete") {
                    StorageOperationType::Delete
                } else if line.contains("=") {
                    StorageOperationType::Write
                } else {
                    StorageOperationType::Read
                };
                
                let gas_cost = match operation_type {
                    StorageOperationType::Read => 800,
                    StorageOperationType::Write => 20000,
                    StorageOperationType::Delete => 5000,
                };
                
                operations.push(StorageOperation {
                    operation_type,
                    variable_name: "unknown".to_string(), // Would need proper parsing
                    gas_cost,
                    line_number: line_num as u32,
                    function_name: "unknown".to_string(), // Would need proper parsing
                });
            }
        }
        
        Ok(operations)
    }

    async fn analyze_external_calls(&self, source_code: &str) -> Result<Vec<ExternalCall>, Box<dyn std::error::Error>> {
        let mut calls = Vec::new();
        let lines: Vec<&str> = source_code.lines().collect();
        
        for (line_num, line) in lines.iter().enumerate() {
            if line.contains(".call(") || line.contains(".transfer(") || line.contains(".send(") {
                let call_type = if line.contains(".call(") {
                    CallType::Call
                } else if line.contains(".transfer(") {
                    CallType::Transfer
                } else if line.contains(".send(") {
                    CallType::Send
                } else {
                    CallType::Call
                };
                
                let gas_cost = match call_type {
                    CallType::Call => 700,
                    CallType::Transfer => 2300,
                    CallType::Send => 9000,
                    _ => 700,
                };
                
                calls.push(ExternalCall {
                    target_contract: "unknown".to_string(), // Would need proper parsing
                    function_name: "unknown".to_string(), // Would need proper parsing
                    gas_cost,
                    line_number: line_num as u32,
                    call_type,
                });
            }
        }
        
        Ok(calls)
    }

    async fn analyze_loops(&self, source_code: &str) -> Result<Vec<LoopAnalysis>, Box<dyn std::error::Error>> {
        let mut loops = Vec::new();
        let lines: Vec<&str> = source_code.lines().collect();
        
        for (line_num, line) in lines.iter().enumerate() {
            if line.contains("for ") || line.contains("while ") {
                let loop_type = if line.contains("for ") {
                    LoopType::For
                } else {
                    LoopType::While
                };
                
                // Estimate iterations (simplified)
                let iterations_estimate = if line.contains("< 10") {
                    10
                } else if line.contains("< 100") {
                    100
                } else {
                    50 // default estimate
                };
                
                let gas_cost_per_iteration = 50; // Simplified
                let total_gas_cost = iterations_estimate as u64 * gas_cost_per_iteration;
                
                loops.push(LoopAnalysis {
                    loop_type,
                    iterations_estimate,
                    gas_cost_per_iteration,
                    total_gas_cost,
                    line_number: line_num as u32,
                    function_name: "unknown".to_string(), // Would need proper parsing
                });
            }
        }
        
        Ok(loops)
    }

    async fn find_optimization_opportunities(&self, source_code: &str) -> Result<Vec<OptimizationOpportunity>, Box<dyn std::error::Error>> {
        let mut opportunities = Vec::new();
        
        for pattern in &self.optimization_patterns {
            if let Ok(regex) = Regex::new(&pattern.regex_pattern) {
                let matches = regex.find_iter(source_code).count();
                if matches > 0 {
                    opportunities.push(OptimizationOpportunity {
                        opportunity_type: pattern.optimization_type.clone(),
                        description: pattern.description.clone(),
                        estimated_savings: (pattern.base_gas_cost - pattern.optimized_gas_cost) * matches as u64,
                        confidence: 0.8,
                        line_number: None,
                        function_name: None,
                    });
                }
            }
        }
        
        Ok(opportunities)
    }

    fn calculate_total_gas_cost(&self, function_costs: &HashMap<String, FunctionGasCost>, 
                               storage_ops: &[StorageOperation], 
                               external_calls: &[ExternalCall], 
                               loops: &[LoopAnalysis]) -> u64 {
        let mut total = 0u64;
        
        // Function costs
        for func_cost in function_costs.values() {
            total += func_cost.execution_cost;
        }
        
        // Storage operations
        for op in storage_ops {
            total += op.gas_cost;
        }
        
        // External calls
        for call in external_calls {
            total += call.gas_cost;
        }
        
        // Loop costs
        for loop_analysis in loops {
            total += loop_analysis.total_gas_cost;
        }
        
        total
    }

    fn estimate_deployment_cost(&self, source_code: &str) -> u64 {
        // Simplified deployment cost estimation
        let byte_size = source_code.len() as u64;
        let base_cost = 32000; // GCREATE
        let byte_cost = byte_size * 200; // Rough estimate per byte
        base_cost + byte_cost
    }

    fn calculate_efficiency_score(&self, total_gas_cost: u64, function_costs: &HashMap<String, FunctionGasCost>) -> f64 {
        if function_costs.is_empty() {
            return 0.0;
        }
        
        let avg_gas_per_function = total_gas_cost as f64 / function_costs.len() as f64;
        let baseline_avg = 50000.0; // Baseline average gas per function
        
        // Efficiency score: higher is better (100 is perfect)
        (baseline_avg / avg_gas_per_function * 100.0).min(100.0)
    }

    pub async fn benchmark_contract(&self, contract_path: &str, version: &str) -> Result<GasBenchmark, Box<dyn std::error::Error>> {
        let analysis = self.analyze_contract(contract_path).await?;
        
        let mut benchmarks = HashMap::new();
        
        // Create benchmark results for each function
        for (func_name, func_cost) in &analysis.function_costs {
            benchmarks.insert(func_name.clone(), BenchmarkResult {
                function_name: func_name.clone(),
                gas_used: func_cost.execution_cost,
                execution_time_ms: func_cost.execution_cost / 1000, // Rough estimate
                memory_used: func_cost.input_cost + func_cost.output_cost,
                success: true,
            });
        }
        
        Ok(GasBenchmark {
            contract_name: analysis.contract_name,
            version: version.to_string(),
            benchmarks,
            comparison_baseline: None,
            improvement_percentage: 0.0,
        })
    }

    pub fn compare_benchmarks(&self, current: &GasBenchmark, baseline: &GasBenchmark) -> f64 {
        let mut total_improvement = 0.0;
        let mut comparisons = 0;
        
        for (func_name, current_result) in &current.benchmarks {
            if let Some(baseline_result) = baseline.benchmarks.get(func_name) {
                let improvement = if baseline_result.gas_used > 0 {
                    ((baseline_result.gas_used - current_result.gas_used) as f64 / baseline_result.gas_used as f64) * 100.0
                } else {
                    0.0
                };
                total_improvement += improvement;
                comparisons += 1;
            }
        }
        
        if comparisons > 0 {
            total_improvement / comparisons as f64
        } else {
            0.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_gas_analyzer_initialization() {
        let analyzer = GasAnalyzer::new();
        assert!(analyzer.gas_costs.len() > 0);
        assert!(analyzer.optimization_patterns.len() > 0);
    }

    #[tokio::test]
    async fn test_contract_analysis() {
        let analyzer = GasAnalyzer::new();
        let contract_code = r#"
            contract TestContract {
                uint256 public value;
                
                function setValue(uint256 _value) public {
                    value = _value;
                }
                
                function getValue() public view returns (uint256) {
                    return value;
                }
            }
        "#;
        
        // Create a temporary file for testing
        let temp_path = "temp_contract.sol";
        tokio::fs::write(temp_path, contract_code).await.unwrap();
        
        let result = analyzer.analyze_contract(temp_path).await.unwrap();
        assert_eq!(result.contract_name, "TestContract");
        assert!(result.total_gas_cost > 0);
        
        // Clean up
        tokio::fs::remove_file(temp_path).await.unwrap();
    }

    #[tokio::test]
    async fn test_optimization_opportunities() {
        let analyzer = GasAnalyzer::new();
        let code = r#"
            function test() public {
                uint x = a * 2;
                uint y = b / 2;
                require(x > 0, "x must be positive");
            }
        "#;
        
        let opportunities = analyzer.find_optimization_opportunities(code).await.unwrap();
        assert!(!opportunities.is_empty());
    }
}
