/*
Advanced Gas Profiler for Verinode Smart Contracts

This tool provides comprehensive gas profiling capabilities including:
- Real-time gas consumption tracking
- Function-level gas analysis
- Storage operation profiling
- Performance benchmarking
- Gas optimization recommendations
- Historical trend analysis
*/

use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use regex::Regex;
use clap::{Arg, Command};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasProfile {
    pub function_name: String,
    pub total_gas: u64,
    pub execution_time_ms: u64,
    pub storage_operations: u64,
    pub computation_operations: u64,
    pub memory_operations: u64,
    pub external_calls: u64,
    pub line_by_line_gas: Vec<(u32, u64)>, // (line_number, gas_consumed)
    pub optimization_potential: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractProfile {
    pub contract_name: String,
    pub file_path: String,
    pub total_functions: u32,
    pub total_gas_consumed: u64,
    pub function_profiles: Vec<GasProfile>,
    pub storage_analysis: StorageAnalysis,
    pub complexity_metrics: ComplexityMetrics,
    pub optimization_recommendations: Vec<String>,
    pub benchmark_comparison: Option<BenchmarkComparison>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageAnalysis {
    pub total_storage_reads: u64,
    pub total_storage_writes: u64,
    pub persistent_storage_usage: u64,
    pub instance_storage_usage: u64,
    pub temporary_storage_usage: u64,
    pub storage_efficiency_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplexityMetrics {
    pub cyclomatic_complexity: u32,
    pub cognitive_complexity: u32,
    pub lines_of_code: u32,
    pub function_count: u32,
    pub loop_count: u32,
    pub conditional_count: u32,
    pub nesting_depth: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkComparison {
    pub baseline_gas: u64,
    pub current_gas: u64,
    pub gas_difference: i64,
    pub percentage_change: f64,
    pub performance_regression: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfilingSession {
    pub session_id: String,
    pub timestamp: String,
    pub contracts_profiled: Vec<String>,
    pub total_gas_saved: u64,
    pub optimization_score: f64,
    pub duration_seconds: u64,
}

pub struct AdvancedGasProfiler {
    profiles: HashMap<String, ContractProfile>,
    benchmarks: HashMap<String, u64>,
    session_history: Vec<ProfilingSession>,
    gas_costs: HashMap<String, u64>, // Operation -> gas cost
}

impl AdvancedGasProfiler {
    pub fn new() -> Self {
        let mut profiler = Self {
            profiles: HashMap::new(),
            benchmarks: HashMap::new(),
            session_history: Vec::new(),
            gas_costs: Self::initialize_gas_costs(),
        };
        
        profiler.load_benchmarks();
        profiler
    }
    
    fn initialize_gas_costs() -> HashMap<String, u64> {
        let mut costs = HashMap::new();
        
        // Storage operations
        costs.insert("storage_instance_set".to_string(), 5000);
        costs.insert("storage_instance_get".to_string(), 2000);
        costs.insert("storage_persistent_set".to_string(), 8000);
        costs.insert("storage_persistent_get".to_string(), 3000);
        costs.insert("storage_temporary_set".to_string(), 3000);
        costs.insert("storage_temporary_get".to_string(), 1500);
        
        // Computation operations
        costs.insert("add".to_string(), 3);
        costs.insert("subtract".to_string(), 3);
        costs.insert("multiply".to_string(), 5);
        costs.insert("divide".to_string(), 8);
        costs.insert("modulo".to_string(), 8);
        costs.insert("bit_shift".to_string(), 1);
        costs.insert("bit_and".to_string(), 1);
        costs.insert("bit_or".to_string(), 1);
        costs.insert("bit_xor".to_string(), 1);
        
        // Memory operations
        costs.insert("vec_new".to_string(), 1000);
        costs.insert("vec_push".to_string(), 500);
        costs.insert("vec_pop".to_string(), 200);
        costs.insert("vec_get".to_string(), 100);
        costs.insert("vec_set".to_string(), 200);
        costs.insert("string_new".to_string(), 1500);
        costs.insert("string_clone".to_string(), 800);
        costs.insert("map_new".to_string(), 1500);
        costs.insert("map_insert".to_string(), 600);
        
        // Control flow
        costs.insert("branch".to_string(), 3);
        costs.insert("loop_start".to_string(), 3000);
        costs.insert("loop_iteration".to_string(), 500);
        
        // External operations
        costs.insert("contract_call".to_string(), 20000);
        costs.insert("cross_contract_call".to_string(), 25000);
        costs.insert("event_publish".to_string(), 1000);
        
        // Cryptographic operations
        costs.insert("hash".to_string(), 30);
        costs.insert("sha256".to_string(), 50);
        costs.insert("verify_signature".to_string(), 2000);
        
        costs
    }
    
    pub fn profile_contract(&mut self, file_path: &str) -> Result<ContractProfile, Box<dyn std::error::Error>> {
        let start_time = Instant::now();
        
        // Read source code
        let source_code = fs::read_to_string(file_path)?;
        let contract_name = Path::new(file_path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        
        // Extract functions
        let functions = self.extract_functions(&source_code);
        
        // Profile each function
        let mut function_profiles = Vec::new();
        let mut total_gas = 0u64;
        
        for (function_name, function_code) in functions {
            let profile = self.profile_function(&function_name, &function_code);
            total_gas += profile.total_gas;
            function_profiles.push(profile);
        }
        
        // Analyze storage usage
        let storage_analysis = self.analyze_storage_usage(&source_code);
        
        // Calculate complexity metrics
        let complexity_metrics = self.calculate_complexity_metrics(&source_code);
        
        // Generate optimization recommendations
        let optimization_recommendations = self.generate_recommendations(&function_profiles, &storage_analysis, &complexity_metrics);
        
        // Compare with benchmarks if available
        let benchmark_comparison = self.compare_with_benchmark(&contract_name, total_gas);
        
        let contract_profile = ContractProfile {
            contract_name: contract_name.clone(),
            file_path: file_path.to_string(),
            total_functions: function_profiles.len() as u32,
            total_gas_consumed: total_gas,
            function_profiles,
            storage_analysis,
            complexity_metrics,
            optimization_recommendations,
            benchmark_comparison,
        };
        
        // Store profile
        self.profiles.insert(contract_name.clone(), contract_profile.clone());
        
        let duration = start_time.elapsed();
        println!("Profiled {} in {:?}", contract_name, duration);
        
        Ok(contract_profile)
    }
    
    fn extract_functions(&self, source_code: &str) -> Vec<(String, String)> {
        let mut functions = Vec::new();
        
        // Regex to match Rust functions
        let function_regex = Regex::new(
            r"(?s)pub\s+fn\s+(\w+)\s*\([^)]*\)\s*(->\s*\w+)?\s*\{(.*?)\}"
        ).unwrap();
        
        for captures in function_regex.captures_iter(source_code) {
            let function_name = captures.get(1).unwrap().as_str().to_string();
            let function_body = captures.get(3).unwrap().as_str().to_string();
            functions.push((function_name, function_body));
        }
        
        // Also match private functions
        let private_function_regex = Regex::new(
            r"(?s)fn\s+(\w+)\s*\([^)]*\)\s*(->\s*\w+)?\s*\{(.*?)\}"
        ).unwrap();
        
        for captures in private_function_regex.captures_iter(source_code) {
            let function_name = captures.get(1).unwrap().as_str().to_string();
            let function_body = captures.get(3).unwrap().as_str().to_string();
            
            // Avoid duplicates
            if !functions.iter().any(|(name, _)| name == &function_name) {
                functions.push((function_name, function_body));
            }
        }
        
        functions
    }
    
    fn profile_function(&self, function_name: &str, function_code: &str) -> GasProfile {
        let lines: Vec<&str> = function_code.lines().collect();
        let mut line_by_line_gas = Vec::new();
        let mut total_gas = 21000u64; // Base transaction cost
        
        let mut storage_ops = 0u64;
        let mut computation_ops = 0u64;
        let mut memory_ops = 0u64;
        let mut external_calls = 0u64;
        
        for (line_num, line) in lines.iter().enumerate() {
            let mut line_gas = 0u64;
            
            // Storage operations
            if line.contains("storage().instance().set") {
                line_gas += self.gas_costs["storage_instance_set"];
                storage_ops += 1;
            }
            if line.contains("storage().instance().get") {
                line_gas += self.gas_costs["storage_instance_get"];
                storage_ops += 1;
            }
            if line.contains("storage().persistent().set") {
                line_gas += self.gas_costs["storage_persistent_set"];
                storage_ops += 1;
            }
            if line.contains("storage().persistent().get") {
                line_gas += self.gas_costs["storage_persistent_get"];
                storage_ops += 1;
            }
            
            // Computation operations
            let add_ops = line.matches('+').count() as u64;
            let sub_ops = line.matches('-').count() as u64;
            let mul_ops = line.matches('*').count() as u64;
            let div_ops = line.matches('/').count() as u64;
            
            line_gas += add_ops * self.gas_costs["add"];
            line_gas += sub_ops * self.gas_costs["subtract"];
            line_gas += mul_ops * self.gas_costs["multiply"];
            line_gas += div_ops * self.gas_costs["divide"];
            
            computation_ops += add_ops + sub_ops + mul_ops + div_ops;
            
            // Bit operations
            if line.contains("<<") || line.contains(">>") {
                line_gas += self.gas_costs["bit_shift"];
                computation_ops += 1;
            }
            if line.contains('&') || line.contains('|') || line.contains('^') {
                line_gas += self.gas_costs["bit_and"];
                computation_ops += 1;
            }
            
            // Memory operations
            if line.contains("Vec::new") {
                line_gas += self.gas_costs["vec_new"];
                memory_ops += 1;
            }
            if line.contains("push_back") {
                line_gas += self.gas_costs["vec_push"];
                memory_ops += 1;
            }
            if line.contains("String::from_str") {
                line_gas += self.gas_costs["string_new"];
                memory_ops += 1;
            }
            if line.contains(".clone()") {
                line_gas += self.gas_costs["string_clone"];
                memory_ops += 1;
            }
            if line.contains("Map::new") {
                line_gas += self.gas_costs["map_new"];
                memory_ops += 1;
            }
            
            // Control flow
            if line.contains("for ") {
                line_gas += self.gas_costs["loop_start"];
                computation_ops += 1;
            }
            if line.contains("while ") {
                line_gas += self.gas_costs["loop_start"];
                computation_ops += 1;
            }
            if line.contains("if ") || line.contains("match ") {
                line_gas += self.gas_costs["branch"];
                computation_ops += 1;
            }
            
            // External calls
            if line.contains(".invoke") || line.contains(".try_invoke") {
                line_gas += self.gas_costs["contract_call"];
                external_calls += 1;
            }
            
            // Cryptographic operations
            if line.contains("hash") {
                line_gas += self.gas_costs["hash"];
                computation_ops += 1;
            }
            if line.contains("sha256") {
                line_gas += self.gas_costs["sha256"];
                computation_ops += 1;
            }
            
            // Events
            if line.contains("events().publish") {
                line_gas += self.gas_costs["event_publish"];
            }
            
            line_by_line_gas.push((line_num as u32 + 1, line_gas));
            total_gas += line_gas;
        }
        
        // Estimate execution time (simplified)
        let execution_time_ms = (total_gas / 1000) as u64;
        
        // Calculate optimization potential
        let optimization_potential = self.calculate_optimization_potential(function_code, total_gas);
        
        GasProfile {
            function_name: function_name.to_string(),
            total_gas,
            execution_time_ms,
            storage_operations: storage_ops,
            computation_operations: computation_ops,
            memory_operations: memory_ops,
            external_calls,
            line_by_line_gas,
            optimization_potential,
        }
    }
    
    fn analyze_storage_usage(&self, source_code: &str) -> StorageAnalysis {
        let persistent_reads = source_code.matches("storage().persistent().get").count() as u64;
        let persistent_writes = source_code.matches("storage().persistent().set").count() as u64;
        let instance_reads = source_code.matches("storage().instance().get").count() as u64;
        let instance_writes = source_code.matches("storage().instance().set").count() as u64;
        
        let total_storage_reads = persistent_reads + instance_reads;
        let total_storage_writes = persistent_writes + instance_writes;
        
        let persistent_storage_usage = (persistent_reads + persistent_writes) * self.gas_costs["storage_persistent_set"];
        let instance_storage_usage = (instance_reads + instance_writes) * self.gas_costs["storage_instance_set"];
        let temporary_storage_usage = 0; // Would need more sophisticated analysis
        
        let total_storage_ops = total_storage_reads + total_storage_writes;
        let storage_efficiency_score = if total_storage_ops > 0 {
            1.0 - (total_storage_reads as f64 / total_storage_ops as f64 * 0.3) // Penalize too many reads
        } else {
            1.0
        };
        
        StorageAnalysis {
            total_storage_reads,
            total_storage_writes,
            persistent_storage_usage,
            instance_storage_usage,
            temporary_storage_usage,
            storage_efficiency_score,
        }
    }
    
    fn calculate_complexity_metrics(&self, source_code: &str) -> ComplexityMetrics {
        let lines: Vec<&str> = source_code.lines().collect();
        let lines_of_code = lines.len() as u32;
        
        let function_count = source_code.matches("fn ").count() as u32;
        let loop_count = source_code.matches("for ").count() as u32 + source_code.matches("while ").count() as u32;
        let conditional_count = source_code.matches("if ").count() as u32 + source_code.matches("match ").count() as u32;
        
        // Cyclomatic complexity
        let cyclomatic_complexity = conditional_count + loop_count + 1;
        
        // Cognitive complexity (simplified)
        let cognitive_complexity = cyclomatic_complexity + (loop_count * 2);
        
        // Nesting depth (simplified)
        let mut max_depth = 0u32;
        let mut current_depth = 0u32;
        
        for line in lines {
            if line.contains('{') {
                current_depth += 1;
                max_depth = max_depth.max(current_depth);
            }
            if line.contains('}') {
                current_depth = current_depth.saturating_sub(1);
            }
        }
        
        ComplexityMetrics {
            cyclomatic_complexity,
            cognitive_complexity,
            lines_of_code,
            function_count,
            loop_count,
            conditional_count,
            nesting_depth: max_depth,
        }
    }
    
    fn calculate_optimization_potential(&self, function_code: &str, current_gas: u64) -> f64 {
        let mut potential = 0.0;
        
        // Storage optimization potential
        if function_code.contains("storage().persistent().set") {
            potential += 0.15;
        }
        
        // Loop optimization potential
        if function_code.contains("for ") && function_code.contains("push_back") {
            potential += 0.10;
        }
        
        // String optimization potential
        if function_code.contains(".clone()") {
            potential += 0.08;
        }
        
        // Early return potential
        if function_code.contains("if ") && function_code.contains("else ") {
            potential += 0.12;
        }
        
        // Arithmetic optimization potential
        if function_code.contains("* 2") || function_code.contains("* 4") {
            potential += 0.05;
        }
        
        // Batch operations potential
        let storage_sets = function_code.matches("storage().set").count();
        if storage_sets > 3 {
            potential += 0.20;
        }
        
        potential.min(0.80) // Cap at 80%
    }
    
    fn generate_recommendations(
        &self,
        function_profiles: &[GasProfile],
        storage_analysis: &StorageAnalysis,
        complexity_metrics: &ComplexityMetrics,
    ) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        // Storage recommendations
        if storage_analysis.persistent_storage_usage > storage_analysis.instance_storage_usage * 2 {
            recommendations.push(
                "Consider using instance storage instead of persistent storage for temporary data".to_string()
            );
        }
        
        if storage_analysis.total_storage_writes > 5 {
            recommendations.push(
                "Consider batching storage operations to reduce gas costs".to_string()
            );
        }
        
        // Function-specific recommendations
        for profile in function_profiles {
            if profile.optimization_potential > 0.3 {
                recommendations.push(format!(
                    "Function '{}' has high optimization potential ({:.1}%)",
                    profile.function_name,
                    profile.optimization_potential * 100.0
                ));
            }
            
            if profile.storage_operations > profile.total_gas / 3 {
                recommendations.push(format!(
                    "Function '{}' has high storage usage ({:.1}% of total gas)",
                    profile.function_name,
                    (profile.storage_operations as f64 / profile.total_gas as f64) * 100.0
                ));
            }
            
            if profile.execution_time_ms > 1000 {
                recommendations.push(format!(
                    "Function '{}' has high execution time: {}ms",
                    profile.function_name, profile.execution_time_ms
                ));
            }
        }
        
        // Complexity recommendations
        if complexity_metrics.cyclomatic_complexity > 10 {
            recommendations.push(
                "High cyclomatic complexity detected. Consider refactoring complex functions.".to_string()
            );
        }
        
        if complexity_metrics.nesting_depth > 4 {
            recommendations.push(
                "Deep nesting detected. Consider using early returns to reduce complexity.".to_string()
            );
        }
        
        // General recommendations
        recommendations.push(
            "Implement automated gas testing in CI/CD pipeline".to_string()
        );
        
        recommendations.push(
            "Consider using gas-efficient data structures and algorithms".to_string()
        );
        
        recommendations
    }
    
    fn compare_with_benchmark(&self, contract_name: &str, current_gas: u64) -> Option<BenchmarkComparison> {
        if let Some(&baseline_gas) = self.benchmarks.get(contract_name) {
            let gas_difference = current_gas as i64 - baseline_gas as i64;
            let percentage_change = (gas_difference as f64 / baseline_gas as f64) * 100.0;
            let performance_regression = gas_difference > 0 && percentage_change > 5.0;
            
            Some(BenchmarkComparison {
                baseline_gas,
                current_gas,
                gas_difference,
                percentage_change,
                performance_regression,
            })
        } else {
            None
        }
    }
    
    pub fn save_benchmark(&mut self, contract_name: &str, gas_usage: u64) {
        self.benchmarks.insert(contract_name.to_string(), gas_usage);
        
        // Save to file
        if let Ok(data) = serde_json::to_string_pretty(&self.benchmarks) {
            let _ = fs::write("benchmarks.json", data);
        }
    }
    
    fn load_benchmarks(&mut self) {
        if Path::new("benchmarks.json").exists() {
            if let Ok(data) = fs::read_to_string("benchmarks.json") {
                if let Ok(benchmarks) = serde_json::from_str(&data) {
                    self.benchmarks = benchmarks;
                }
            }
        }
    }
    
    pub fn generate_report(&self, contract_name: &str, format: &str) -> Result<String, Box<dyn std::error::Error>> {
        if let Some(profile) = self.profiles.get(contract_name) {
            match format.to_lowercase().as_str() {
                "json" => Ok(serde_json::to_string_pretty(profile)?),
                "csv" => Ok(self.generate_csv_report(profile)),
                "markdown" => Ok(self.generate_markdown_report(profile)),
                _ => Err("Unsupported format".into()),
            }
        } else {
            Err("Contract not found".into())
        }
    }
    
    fn generate_csv_report(&self, profile: &ContractProfile) -> String {
        let mut csv = String::new();
        
        // Header
        csv.push_str("Function,Total Gas,Execution Time (ms),Storage Ops,Computation Ops,Memory Ops,External Calls,Optimization Potential\n");
        
        // Function data
        for func_profile in &profile.function_profiles {
            csv.push_str(&format!(
                "{},{},{},{},{},{},{:.2}%\n",
                func_profile.function_name,
                func_profile.total_gas,
                func_profile.execution_time_ms,
                func_profile.storage_operations,
                func_profile.computation_operations,
                func_profile.memory_operations,
                func_profile.external_calls,
                func_profile.optimization_potential * 100.0
            ));
        }
        
        csv
    }
    
    fn generate_markdown_report(&self, profile: &ContractProfile) -> String {
        let mut md = format!(
            "# Gas Profiling Report: {}\n\n",
            profile.contract_name
        );
        
        // Summary
        md.push_str(&format!(
            "## Summary\n\n\
            - **Total Functions:** {}\n\
            - **Total Gas Consumed:** {:,}\n\
            - **Average Gas per Function:** {:,}\n\
            - **Lines of Code:** {}\n\
            - **Cyclomatic Complexity:** {}\n\n",
            profile.total_functions,
            profile.total_gas_consumed,
            profile.total_gas_consumed / profile.total_functions as u64,
            profile.complexity_metrics.lines_of_code,
            profile.complexity_metrics.cyclomatic_complexity
        ));
        
        // Storage Analysis
        md.push_str("## Storage Analysis\n\n");
        md.push_str(&format!(
            "- **Total Storage Reads:** {}\n\
            - **Total Storage Writes:** {}\n\
            - **Persistent Storage Usage:** {:,} gas\n\
            - **Instance Storage Usage:** {:,} gas\n\
            - **Storage Efficiency Score:** {:.2}/1.0\n\n",
            profile.storage_analysis.total_storage_reads,
            profile.storage_analysis.total_storage_writes,
            profile.storage_analysis.persistent_storage_usage,
            profile.storage_analysis.instance_storage_usage,
            profile.storage_analysis.storage_efficiency_score
        ));
        
        // Function Details
        md.push_str("## Function Details\n\n");
        md.push_str("| Function | Gas | Time (ms) | Storage | Computation | Memory | External | Potential |\n");
        md.push_str("|----------|-----|-----------|----------|--------------|--------|----------|-----------|\n");
        
        for func_profile in &profile.function_profiles {
            md.push_str(&format!(
                "| {} | {:,} | {} | {} | {} | {} | {} | {:.1}% |\n",
                func_profile.function_name,
                func_profile.total_gas,
                func_profile.execution_time_ms,
                func_profile.storage_operations,
                func_profile.computation_operations,
                func_profile.memory_operations,
                func_profile.external_calls,
                func_profile.optimization_potential * 100.0
            ));
        }
        
        // Recommendations
        md.push_str("\n## Optimization Recommendations\n\n");
        for (i, rec) in profile.optimization_recommendations.iter().enumerate() {
            md.push_str(&format!("{}. {}\n", i + 1, rec));
        }
        
        // Benchmark Comparison
        if let Some(benchmark) = &profile.benchmark_comparison {
            md.push_str("\n## Benchmark Comparison\n\n");
            md.push_str(&format!(
                "- **Baseline Gas:** {:,}\n\
                - **Current Gas:** {:,}\n\
                - **Gas Difference:** {:,} ({:.1}%)\n\
                - **Performance Regression:** {}\n",
                benchmark.baseline_gas,
                benchmark.current_gas,
                benchmark.gas_difference.abs(),
                benchmark.percentage_change.abs(),
                if benchmark.performance_regression { "Yes ⚠️" } else { "No ✅" }
            ));
        }
        
        md
    }
    
    pub fn profile_directory(&mut self, dir_path: &str) -> Result<Vec<ContractProfile>, Box<dyn std::error::Error>> {
        let mut profiles = Vec::new();
        
        for entry in fs::read_dir(dir_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                if let Some(extension) = path.extension() {
                    if extension == "rs" {
                        match self.profile_contract(path.to_str().unwrap()) {
                            Ok(profile) => profiles.push(profile),
                            Err(e) => eprintln!("Error profiling {}: {}", path.display(), e),
                        }
                    }
                }
            }
        }
        
        Ok(profiles)
    }
    
    pub fn start_profiling_session(&mut self) -> String {
        let session_id = format!("session_{}", chrono::Utc::now().timestamp());
        session_id
    }
    
    pub fn end_profiling_session(&mut self, session_id: String) -> ProfilingSession {
        let session = ProfilingSession {
            session_id: session_id.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            contracts_profiled: self.profiles.keys().cloned().collect(),
            total_gas_saved: 0, // Would calculate based on optimizations
            optimization_score: 0.0, // Would calculate based on improvements
            duration_seconds: 0, // Would track actual duration
        };
        
        self.session_history.push(session.clone());
        session
    }
}

fn main() {
    let matches = Command::new("advanced_gas_profiler")
        .version("1.0")
        .about("Advanced gas profiler for Verinode smart contracts")
        .arg(
            Arg::new("input")
                .short('i')
                .long("input")
                .value_name("FILE_OR_DIR")
                .help("Input file or directory to profile")
                .required(true),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE")
                .help("Output file for the report"),
        )
        .arg(
            Arg::new("format")
                .short('f')
                .long("format")
                .value_name("FORMAT")
                .help("Output format (json, csv, markdown)")
                .default_value("markdown"),
        )
        .arg(
            Arg::new("benchmark")
                .short('b')
                .long("benchmark")
                .help("Save current gas usage as benchmark"),
        )
        .get_matches();
    
    let mut profiler = AdvancedGasProfiler::new();
    let input = matches.get_one::<String>("input").unwrap();
    let format = matches.get_one::<String>("format").unwrap();
    
    let start_time = Instant::now();
    
    // Profile input
    let profiles = if Path::new(input).is_dir() {
        profiler.profile_directory(input).unwrap_or_else(|e| {
            eprintln!("Error profiling directory: {}", e);
            Vec::new()
        })
    } else {
        match profiler.profile_contract(input) {
            Ok(profile) => vec![profile],
            Err(e) => {
                eprintln!("Error profiling contract: {}", e);
                Vec::new()
            }
        }
    };
    
    if profiles.is_empty() {
        eprintln!("No contracts were successfully profiled");
        return;
    }
    
    // Generate reports
    for profile in &profiles {
        let report = profiler.generate_report(&profile.contract_name, format).unwrap();
        
        if let Some(output_file) = matches.get_one::<String>("output") {
            let file_path = if profiles.len() == 1 {
                output_file.to_string()
            } else {
                format!("{}_{}", output_file, profile.contract_name)
            };
            
            fs::write(&file_path, report).unwrap_or_else(|e| {
                eprintln!("Error writing report to {}: {}", file_path, e);
            });
            
            println!("Report saved to: {}", file_path);
        } else {
            println!("\n=== Report for {} ===", profile.contract_name);
            println!("{}", report);
        }
        
        // Save benchmark if requested
        if matches.get_flag("benchmark") {
            profiler.save_benchmark(&profile.contract_name, profile.total_gas_consumed);
            println!("Benchmark saved for {}", profile.contract_name);
        }
    }
    
    let duration = start_time.elapsed();
    println!("\nProfiling completed in {:?}", duration);
    println!("Total contracts profiled: {}", profiles.len());
    
    let total_gas: u64 = profiles.iter().map(|p| p.total_gas_consumed).sum();
    println!("Total gas across all contracts: {:,}", total_gas);
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_gas_profiler_creation() {
        let profiler = AdvancedGasProfiler::new();
        assert!(profiler.gas_costs.contains_key("storage_instance_set"));
        assert_eq!(profiler.gas_costs["storage_instance_set"], 5000);
    }
    
    #[test]
    fn test_function_extraction() {
        let profiler = AdvancedGasProfiler::new();
        let code = r#"
            pub fn test_function() -> u64 {
                let x = 5;
                x * 2
            }
            
            fn private_function() {
                println!("test");
            }
        "#;
        
        let functions = profiler.extract_functions(code);
        assert_eq!(functions.len(), 2);
        assert_eq!(functions[0].0, "test_function");
        assert_eq!(functions[1].0, "private_function");
    }
    
    #[test]
    fn test_complexity_metrics() {
        let profiler = AdvancedGasProfiler::new();
        let code = r#"
            pub fn complex_function() {
                if true {
                    for i in 0..10 {
                        if i > 5 {
                            match i {
                                6 => println!("six"),
                                _ => println!("other"),
                            }
                        }
                    }
                }
            }
        "#;
        
        let metrics = profiler.calculate_complexity_metrics(code);
        assert!(metrics.cyclomatic_complexity > 1);
        assert!(metrics.loop_count > 0);
        assert!(metrics.conditional_count > 0);
    }
}
