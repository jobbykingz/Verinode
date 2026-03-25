#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GasBreakdown {
    pub storage_operations: u64,
    pub computation_operations: u64,
    pub memory_operations: u64,
    pub external_calls: u64,
    pub event_emissions: u64,
    pub base_transaction: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FunctionGasProfile {
    pub function_name: String,
    pub total_gas: u64,
    pub breakdown: GasBreakdown,
    pub execution_time_ms: u64,
    pub memory_usage_bytes: u64,
    pub optimization_potential: f64, // Percentage of gas that could be saved
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GasAnalysisResult {
    pub contract_address: Address,
    pub total_gas_consumed: u64,
    pub function_profiles: Vec<FunctionGasProfile>,
    pub overall_breakdown: GasBreakdown,
    pub optimization_score: f64, // 0-100, higher is better
    pub critical_gas_consumers: Vec<String>,
    pub recommendations: Vec<String>,
    pub analysis_timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GasBenchmark {
    pub benchmark_id: u64,
    pub contract_name: String,
    pub function_name: String,
    pub gas_usage: u64,
    pub optimization_level: String,
    pub timestamp: u64,
    pub environment: String,
}

#[contracttype]
pub enum GasAnalyzerDataKey {
    AnalysisResults(Address),
    Benchmarks(u64),
    BenchmarkCount,
    AnalysisHistory,
    GasPriceHistory,
}

#[contract]
pub struct GasAnalyzer;

#[contractimpl]
impl GasAnalyzer {
    /// Initialize the gas analyzer
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&GasAnalyzerDataKey::BenchmarkCount) {
            panic!("Gas Analyzer already initialized");
        }
        
        env.storage().instance().set(&GasAnalyzerDataKey::BenchmarkCount, &0u64);
        env.storage().instance().set(&GasAnalyzerDataKey::AnalysisHistory, &Vec::new(&env));
        env.storage().instance().set(&GasAnalyzerDataKey::GasPriceHistory, &Vec::new(&env));
    }

    /// Perform comprehensive gas analysis of a contract
    pub fn analyze_contract_gas(
        env: Env,
        contract_address: Address,
        source_code: String,
        functions_to_analyze: Vec<String>,
    ) -> GasAnalysisResult {
        let mut function_profiles = Vec::new(&env);
        let mut total_gas = 0u64;
        let mut critical_consumers = Vec::new(&env);
        let mut recommendations = Vec::new(&env);

        // Analyze each function
        for function_name in functions_to_analyze.iter() {
            let profile = Self::analyze_function_gas(&env, source_code.clone(), function_name.clone());
            total_gas += profile.total_gas;
            
            // Identify critical gas consumers (functions using > 20% of total gas)
            if profile.total_gas > total_gas / 5 {
                critical_consumers.push_back(function_name.clone());
            }
            
            function_profiles.push_back(profile.clone());
            
            // Generate recommendations based on profile
            let function_recommendations = Self::generate_recommendations(&env, profile.clone());
            for rec in function_recommendations.iter() {
                recommendations.push_back(rec.clone());
            }
        }

        // Calculate overall breakdown
        let overall_breakdown = Self::calculate_overall_breakdown(&env, function_profiles.clone());
        
        // Calculate optimization score
        let optimization_score = Self::calculate_optimization_score(&env, function_profiles.clone());

        let result = GasAnalysisResult {
            contract_address: contract_address.clone(),
            total_gas_consumed: total_gas,
            function_profiles: function_profiles.clone(),
            overall_breakdown,
            optimization_score,
            critical_gas_consumers: critical_consumers,
            recommendations,
            analysis_timestamp: env.ledger().timestamp(),
        };

        // Store analysis result
        env.storage().instance().set(
            &GasAnalyzerDataKey::AnalysisResults(contract_address),
            &result.clone()
        );

        // Store in history
        Self::store_analysis_history(&env, result.clone());

        result
    }

    /// Analyze gas usage for a specific function
    fn analyze_function_gas(env: &Env, source_code: String, function_name: String) -> FunctionGasProfile {
        let function_code = Self::extract_function_code(&source_code, &function_name);
        
        let storage_gas = Self::calculate_storage_gas(&function_code);
        let computation_gas = Self::calculate_computation_gas(&function_code);
        let memory_gas = Self::calculate_memory_gas(&function_code);
        let external_call_gas = Self::calculate_external_call_gas(&function_code);
        let event_gas = Self::calculate_event_gas(&function_code);
        let base_gas = 21000; // Base transaction cost

        let total_gas = storage_gas + computation_gas + memory_gas + external_call_gas + event_gas + base_gas;

        let breakdown = GasBreakdown {
            storage_operations: storage_gas,
            computation_operations: computation_gas,
            memory_operations: memory_gas,
            external_calls: external_call_gas,
            event_emissions: event_gas,
            base_transaction: base_gas,
        };

        // Estimate execution time (simplified)
        let execution_time_ms = (total_gas / 1000) as u64; // Rough estimate
        
        // Estimate memory usage
        let memory_usage_bytes = Self::estimate_memory_usage(&function_code);

        // Calculate optimization potential
        let optimization_potential = Self::calculate_optimization_potential(&function_code, total_gas);

        FunctionGasProfile {
            function_name,
            total_gas,
            breakdown,
            execution_time_ms,
            memory_usage_bytes,
            optimization_potential,
        }
    }

    /// Extract function code from source
    fn extract_function_code(source_code: &str, function_name: &str) -> String {
        let lines: Vec<&str> = source_code.lines().collect();
        let mut function_lines = Vec::new();
        let mut in_function = false;
        let mut brace_count = 0;

        for line in lines {
            if line.contains(&format!("fn {}", function_name)) {
                in_function = true;
                function_lines.push(line);
                brace_count += line.matches("{").count() as i32;
                brace_count -= line.matches("}").count() as i32;
                continue;
            }

            if in_function {
                function_lines.push(line);
                brace_count += line.matches("{").count() as i32;
                brace_count -= line.matches("}").count() as i32;

                if brace_count <= 0 {
                    break;
                }
            }
        }

        function_lines.join("\n")
    }

    /// Calculate gas cost for storage operations
    fn calculate_storage_gas(function_code: &str) -> u64 {
        let mut storage_gas = 0u64;
        
        // Storage writes
        storage_gas += function_code.matches("storage().set").count() as u64 * 5000;
        storage_gas += function_code.matches("storage().persistent().set").count() as u64 * 8000;
        storage_gas += function_code.matches("storage().instance().set").count() as u64 * 5000;
        
        // Storage reads
        storage_gas += function_code.matches("storage().get").count() as u64 * 2000;
        storage_gas += function_code.matches("storage().persistent().get").count() as u64 * 3000;
        storage_gas += function_code.matches("storage().instance().get").count() as u64 * 2000;
        
        // Storage deletions
        storage_gas += function_code.matches("storage().del").count() as u64 * 1500;
        
        storage_gas
    }

    /// Calculate gas cost for computation operations
    fn calculate_computation_gas(function_code: &str) -> u64 {
        let mut computation_gas = 0u64;
        
        // Loops
        computation_gas += function_code.matches("for ").count() as u64 * 3000;
        computation_gas += function_code.matches("while ").count() as u64 * 2500;
        
        // Arithmetic operations
        computation_gas += function_code.matches("+").count() as u64 * 3;
        computation_gas += function_code.matches("-").count() as u64 * 3;
        computation_gas += function_code.matches("*").count() as u64 * 5;
        computation_gas += function_code.matches("/").count() as u64 * 8;
        computation_gas += function_code.matches("%").count() as u64 * 8;
        
        // Bit operations (cheaper than arithmetic)
        computation_gas += function_code.matches("<<").count() as u64 * 1;
        computation_gas += function_code.matches(">>").count() as u64 * 1;
        computation_gas += function_code.matches("&").count() as u64 * 1;
        computation_gas += function_code.matches("|").count() as u64 * 1;
        computation_gas += function_code.matches("^").count() as u64 * 1;
        
        // Comparisons
        computation_gas += function_code.matches("==").count() as u64 * 3;
        computation_gas += function_code.matches("!=").count() as u64 * 3;
        computation_gas += function_code.matches("<=").count() as u64 * 3;
        computation_gas += function_code.matches(">=").count() as u64 * 3;
        computation_gas += function_code.matches("<").count() as u64 * 3;
        computation_gas += function_code.matches(">").count() as u64 * 3;
        
        // Hash operations
        computation_gas += function_code.matches("hash").count() as u64 * 30;
        computation_gas += function_code.matches("sha256").count() as u64 * 50;
        
        computation_gas
    }

    /// Calculate gas cost for memory operations
    fn calculate_memory_gas(function_code: &str) -> u64 {
        let mut memory_gas = 0u64;
        
        // Vector operations
        memory_gas += function_code.matches("Vec::new").count() as u64 * 1000;
        memory_gas += function_code.matches("push_back").count() as u64 * 500;
        memory_gas += function_code.matches("pop_back").count() as u64 * 200;
        memory_gas += function_code.matches("get").count() as u64 * 100;
        memory_gas += function_code.matches("set").count() as u64 * 200;
        
        // String operations
        memory_gas += function_code.matches("String::from_str").count() as u64 * 1500;
        memory_gas += function_code.matches(".clone()").count() as u64 * 800;
        
        // Map operations
        memory_gas += function_code.matches("Map::new").count() as u64 * 1500;
        memory_gas += function_code.matches("insert").count() as u64 * 600;
        
        memory_gas
    }

    /// Calculate gas cost for external calls
    fn calculate_external_call_gas(function_code: &str) -> u64 {
        let mut external_gas = 0u64;
        
        // Contract calls
        external_gas += function_code.matches(".invoke").count() as u64 * 20000;
        external_gas += function_code.matches(".try_invoke").count() as u64 * 20000;
        
        // Cross-contract calls
        external_gas += function_code.matches("call").count() as u64 * 25000;
        
        external_gas
    }

    /// Calculate gas cost for event emissions
    fn calculate_event_gas(function_code: &str) -> u64 {
        let mut event_gas = 0u64;
        
        // Event emissions
        event_gas += function_code.matches("events().publish").count() as u64 * 1000;
        event_gas += function_code.matches("event").count() as u64 * 800;
        
        event_gas
    }

    /// Estimate memory usage in bytes
    fn estimate_memory_usage(function_code: &str) -> u64 {
        let mut memory_usage = 0u64;
        
        // Base memory
        memory_usage += 1024; // Stack frame
        
        // Variables
        memory_usage += function_code.matches("let ").count() as u64 * 64;
        
        // Collections
        memory_usage += function_code.matches("Vec::new").count() as u64 * 256;
        memory_usage += function_code.matches("Map::new").count() as u64 * 512;
        memory_usage += function_code.matches("String::from_str").count() as u64 * 128;
        
        memory_usage
    }

    /// Calculate optimization potential for a function
    fn calculate_optimization_potential(function_code: &str, current_gas: u64) -> f64 {
        let mut optimization_score = 0.0;
        
        // Check for common optimization opportunities
        if function_code.contains("persistent().set") {
            optimization_score += 0.15; // Storage optimization
        }
        
        if function_code.contains("for ") && function_code.contains("push_back") {
            optimization_score += 0.10; // Loop optimization
        }
        
        if function_code.contains(".clone()") {
            optimization_score += 0.08; // Clone optimization
        }
        
        if function_code.contains("if condition {") && function_code.contains("} else {") {
            optimization_score += 0.12; // Early return optimization
        }
        
        if function_code.contains("* 2") || function_code.contains("* 4") {
            optimization_score += 0.05; // Bit operation optimization
        }
        
        if function_code.matches("storage().set").count() > 3 {
            optimization_score += 0.20; // Batch storage optimization
        }
        
        // Cap at 80% potential
        optimization_score.min(0.80)
    }

    /// Calculate overall gas breakdown from function profiles
    fn calculate_overall_breakdown(env: &Env, function_profiles: Vec<FunctionGasProfile>) -> GasBreakdown {
        let mut total_storage = 0u64;
        let mut total_computation = 0u64;
        let mut total_memory = 0u64;
        let mut total_external = 0u64;
        let mut total_events = 0u64;
        let mut total_base = 0u64;

        for profile in function_profiles.iter() {
            total_storage += profile.breakdown.storage_operations;
            total_computation += profile.breakdown.computation_operations;
            total_memory += profile.breakdown.memory_operations;
            total_external += profile.breakdown.external_calls;
            total_events += profile.breakdown.event_emissions;
            total_base += profile.breakdown.base_transaction;
        }

        GasBreakdown {
            storage_operations: total_storage,
            computation_operations: total_computation,
            memory_operations: total_memory,
            external_calls: total_external,
            event_emissions: total_events,
            base_transaction: total_base,
        }
    }

    /// Calculate overall optimization score
    fn calculate_optimization_score(env: &Env, function_profiles: Vec<FunctionGasProfile>) -> f64 {
        if function_profiles.is_empty() {
            return 0.0;
        }

        let total_potential: f64 = function_profiles.iter()
            .map(|p| p.optimization_potential)
            .sum();
        
        let average_potential = total_potential / function_profiles.len() as f64;
        
        // Convert to a score where 100 = fully optimized
        (1.0 - average_potential) * 100.0
    }

    /// Generate optimization recommendations
    fn generate_recommendations(env: &Env, profile: FunctionGasProfile) -> Vec<String> {
        let mut recommendations = Vec::new(env);
        
        if profile.breakdown.storage_operations > profile.total_gas / 3 {
            recommendations.push_back(String::from_str(
                env,
                &format!("High storage usage in {}: Consider using instance storage or batching operations", profile.function_name)
            ));
        }
        
        if profile.breakdown.computation_operations > profile.total_gas / 4 {
            recommendations.push_back(String::from_str(
                env,
                &format!("High computation cost in {}: Consider algorithmic optimizations", profile.function_name)
            ));
        }
        
        if profile.optimization_potential > 0.3 {
            recommendations.push_back(String::from_str(
                env,
                &format!("{} has high optimization potential ({}%)", profile.function_name, (profile.optimization_potential * 100.0) as u32)
            ));
        }
        
        if profile.execution_time_ms > 1000 {
            recommendations.push_back(String::from_str(
                env,
                &format!("{} has high execution time: {}ms", profile.function_name, profile.execution_time_ms)
            ));
        }
        
        recommendations
    }

    /// Store analysis history
    fn store_analysis_history(env: &Env, result: GasAnalysisResult) {
        let mut history: Vec<GasAnalysisResult> = env.storage().instance()
            .get(&GasAnalyzerDataKey::AnalysisHistory)
            .unwrap_or(Vec::new(env));
        
        history.push_back(result);
        
        // Keep only last 100 analyses
        if history.len() > 100 {
            history.remove(0);
        }
        
        env.storage().instance().set(&GasAnalyzerDataKey::AnalysisHistory, &history);
    }

    /// Create a gas benchmark
    pub fn create_benchmark(
        env: Env,
        contract_name: String,
        function_name: String,
        gas_usage: u64,
        optimization_level: String,
        environment: String,
    ) -> u64 {
        let benchmark_count: u64 = env.storage().instance()
            .get(&GasAnalyzerDataKey::BenchmarkCount)
            .unwrap_or(0);
        
        let benchmark_id = benchmark_count + 1;
        
        let benchmark = GasBenchmark {
            benchmark_id,
            contract_name: contract_name.clone(),
            function_name: function_name.clone(),
            gas_usage,
            optimization_level: optimization_level.clone(),
            timestamp: env.ledger().timestamp(),
            environment: environment.clone(),
        };
        
        env.storage().instance().set(&GasAnalyzerDataKey::Benchmarks(benchmark_id), &benchmark);
        env.storage().instance().set(&GasAnalyzerDataKey::BenchmarkCount, &benchmark_id);
        
        benchmark_id
    }

    /// Get analysis result for a contract
    pub fn get_analysis_result(env: Env, contract_address: Address) -> Option<GasAnalysisResult> {
        env.storage().instance().get(&GasAnalyzerDataKey::AnalysisResults(contract_address))
    }

    /// Get analysis history
    pub fn get_analysis_history(env: Env) -> Vec<GasAnalysisResult> {
        env.storage().instance()
            .get(&GasAnalyzerDataKey::AnalysisHistory)
            .unwrap_or(Vec::new(&env))
    }

    /// Get benchmarks
    pub fn get_benchmarks(env: Env) -> Vec<GasBenchmark> {
        let mut benchmarks = Vec::new(&env);
        let benchmark_count: u64 = env.storage().instance()
            .get(&GasAnalyzerDataKey::BenchmarkCount)
            .unwrap_or(0);
        
        for benchmark_id in 1..=benchmark_count {
            if let Some(benchmark) = env.storage().instance().get::<GasAnalyzerDataKey, GasBenchmark>(
                &GasAnalyzerDataKey::Benchmarks(benchmark_id)
            ) {
                benchmarks.push_back(benchmark);
            }
        }
        
        benchmarks
    }

    /// Compare gas usage between two functions
    pub fn compare_functions(
        env: Env,
        function1_profile: FunctionGasProfile,
        function2_profile: FunctionGasProfile,
    ) -> String {
        let gas_diff = function1_profile.total_gas.abs_diff(function2_profile.total_gas);
        let percentage_diff = if function2_profile.total_gas > 0 {
            (gas_diff as f64 / function2_profile.total_gas as f64) * 100.0
        } else {
            0.0
        };

        if function1_profile.total_gas < function2_profile.total_gas {
            String::from_str(
                env,
                &format!("{} is more efficient by {} gas ({:.2}% less)", 
                    function1_profile.function_name, gas_diff, percentage_diff)
            )
        } else {
            String::from_str(
                env,
                &format!("{} is more efficient by {} gas ({:.2}% less)", 
                    function2_profile.function_name, gas_diff, percentage_diff)
            )
        }
    }
}
