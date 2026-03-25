use soroban_sdk::{contracttype, Address, Env, Symbol, Vec};
use crate::optimization::StorageOptimization;
use crate::optimization::LoopOptimization;
use crate::optimization::CallOptimization;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GasMetrics {
    pub total_gas_used: u64,
    pub storage_gas: u64,
    pub computation_gas: u64,
    pub call_gas: u64,
    pub optimization_savings: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OptimizationReport {
    pub original_gas: u64,
    pub optimized_gas: u64,
    pub savings_percentage: u32,
    pub optimizations_applied: Vec<Symbol>,
}

pub struct GasOptimizer;

impl GasOptimizer {
    pub fn new() -> Self {
        Self
    }

    pub fn analyze_gas_usage(env: &Env, function_name: &Symbol) -> GasMetrics {
        let start_gas = env.ledger().sequence();
        
        let storage_gas = StorageOptimization::estimate_storage_gas(env);
        let computation_gas = LoopOptimization::estimate_computation_gas(env);
        let call_gas = CallOptimization::estimate_call_gas(env);
        
        let end_gas = env.ledger().sequence();
        let total_gas_used = end_gas - start_gas;
        
        GasMetrics {
            total_gas_used,
            storage_gas,
            computation_gas,
            call_gas,
            optimization_savings: 0,
        }
    }

    pub fn optimize_function(
        env: &Env,
        function_name: &Symbol,
        current_metrics: GasMetrics,
    ) -> OptimizationReport {
        let original_gas = current_metrics.total_gas_used;
        
        let mut optimized_gas = original_gas;
        let mut optimizations_applied: Vec<Symbol> = Vec::new(env);
        
        if current_metrics.storage_gas > original_gas / 3 {
            let storage_savings = StorageOptimization::apply_optimizations(env);
            optimized_gas -= storage_savings;
            optimizations_applied.push_back(env, Symbol::new(env, "STORAGE_PACKING"));
        }
        
        if current_metrics.computation_gas > original_gas / 3 {
            let loop_savings = LoopOptimization::apply_optimizations(env);
            optimized_gas -= loop_savings;
            optimizations_applied.push_back(env, Symbol::new(env, "LOOP_OPTIMIZATION"));
        }
        
        if current_metrics.call_gas > original_gas / 4 {
            let call_savings = CallOptimization::apply_optimizations(env);
            optimized_gas -= call_savings;
            optimizations_applied.push_back(env, Symbol::new(env, "CALL_OPTIMIZATION"));
        }
        
        let savings_percentage = if original_gas > 0 {
            ((original_gas - optimized_gas) * 100 / original_gas) as u32
        } else {
            0
        };
        
        OptimizationReport {
            original_gas,
            optimized_gas,
            savings_percentage,
            optimizations_applied,
        }
    }

    pub fn benchmark_function(env: &Env, function_name: &Symbol) -> OptimizationReport {
        let initial_metrics = Self::analyze_gas_usage(env, function_name);
        let report = Self::optimize_function(env, function_name, initial_metrics);
        
        env.logs().add(
            &format!(
                "Gas optimization report for {}: {} -> {} ({}% savings)",
                function_name,
                report.original_gas,
                report.optimized_gas,
                report.savings_percentage
            )
        );
        
        report
    }

    pub fn validate_optimizations(env: &Env, report: &OptimizationReport) -> bool {
        if report.savings_percentage < 20 {
            env.logs().add(
                &format!(
                    "Warning: Gas savings {}% is below target of 20%",
                    report.savings_percentage
                )
            );
            return false;
        }
        
        if report.optimized_gas >= report.original_gas {
            env.logs().add("Error: Optimization increased gas usage");
            return false;
        }
        
        true
    }

    pub fn get_optimization_recommendations(env: &Env, metrics: &GasMetrics) -> Vec<Symbol> {
        let mut recommendations: Vec<Symbol> = Vec::new(env);
        
        if metrics.storage_gas > metrics.total_gas_used / 3 {
            recommendations.push_back(env, Symbol::new(env, "CONSIDER_STORAGE_PACKING"));
            recommendations.push_back(env, Symbol::new(env, "USE_MAPPINGS_OVER_ARRAYS"));
        }
        
        if metrics.computation_gas > metrics.total_gas_used / 3 {
            recommendations.push_back(env, Symbol::new(env, "OPTIMIZE_LOOPS"));
            recommendations.push_back(env, Symbol::new(env, "REDUCE_REDUNDANT_CALCULATIONS"));
        }
        
        if metrics.call_gas > metrics.total_gas_used / 4 {
            recommendations.push_back(env, Symbol::new(env, "BATCH_EXTERNAL_CALLS"));
            recommendations.push_back(env, Symbol::new(env, "USE_CALL_CACHE"));
        }
        
        recommendations
    }
}
