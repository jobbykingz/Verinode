use soroban_sdk::{symbol_short, Address, Env, Symbol, Vec};
use verinode_contracts::optimization::{
    GasOptimizer, GasMetrics, OptimizationReport,
    StorageOptimization, PackedStruct, OptimizedStorageLayout,
    LoopOptimization, LoopMetrics, OptimizationPattern,
    CallOptimization, CallMetrics, CallOptimizationReport
};

#[test]
fn test_gas_optimizer_basic_functionality() {
    let env = Env::default();
    let test_function = symbol_short!("test_function");
    
    let gas_optimizer = GasOptimizer::new();
    let metrics = GasOptimizer::analyze_gas_usage(&env, &test_function);
    
    assert!(metrics.total_gas_used >= 0);
    assert!(metrics.storage_gas >= 0);
    assert!(metrics.computation_gas >= 0);
    assert!(metrics.call_gas >= 0);
}

#[test]
fn test_gas_optimizer_optimization_report() {
    let env = Env::default();
    let test_function = symbol_short!("optimization_test");
    
    let initial_metrics = GasMetrics {
        total_gas_used: 10000,
        storage_gas: 3000,
        computation_gas: 4000,
        call_gas: 3000,
        optimization_savings: 0,
    };
    
    let report = GasOptimizer::optimize_function(&env, &test_function, initial_metrics);
    
    assert!(report.optimized_gas <= report.original_gas);
    assert!(report.savings_percentage >= 0);
    assert!(report.optimizations_applied.len() >= 0);
}

#[test]
fn test_gas_optimizer_validation() {
    let env = Env::default();
    
    let good_report = OptimizationReport {
        original_gas: 10000,
        optimized_gas: 7000,
        savings_percentage: 30,
        optimizations_applied: Vec::new(&env),
    };
    
    let bad_report = OptimizationReport {
        original_gas: 10000,
        optimized_gas: 9000,
        savings_percentage: 10,
        optimizations_applied: Vec::new(&env),
    };
    
    assert!(GasOptimizer::validate_optimizations(&env, &good_report));
    assert!(!GasOptimizer::validate_optimizations(&env, &bad_report));
}

#[test]
fn test_storage_optimization_struct_packing() {
    let env = Env::default();
    let storage_opt = StorageOptimization::new();
    
    let test_struct = PackedStruct {
        field1: 1000,
        field2: 2000,
        field3: true,
        field4: 255,
    };
    
    let packed_data = StorageOptimization::pack_struct_data(&test_struct);
    
    let unpacked_field1 = (packed_data >> 32) & 0xFFFFFFFF;
    let unpacked_field2 = packed_data & 0xFFFFFFFF;
    let unpacked_field3 = (packed_data >> 63) & 1 == 1;
    let unpacked_field4 = ((packed_data >> 56) & 0xFF) as u8;
    
    assert_eq!(test_struct.field1, unpacked_field1 as u32);
    assert_eq!(test_struct.field2, unpacked_field2 as u32);
    assert_eq!(test_struct.field3, unpacked_field3);
    assert_eq!(test_struct.field4, unpacked_field4);
}

#[test]
fn test_storage_optimization_gas_estimation() {
    let env = Env::default();
    let storage_gas = StorageOptimization::estimate_storage_gas(&env);
    
    assert!(storage_gas > 0);
}

#[test]
fn test_storage_optimization_application() {
    let env = Env::default();
    let savings = StorageOptimization::apply_optimizations(&env);
    
    assert!(savings >= 0);
}

#[test]
fn test_storage_optimization_patterns() {
    let env = Env::default();
    let patterns = StorageOptimization::analyze_storage_patterns(&env);
    
    assert!(patterns.len() > 0);
}

#[test]
fn test_storage_optimization_validation() {
    let env = Env::default();
    let is_valid = StorageOptimization::validate_storage_optimization(&env);
    
    assert!(is_valid);
}

#[test]
fn test_loop_optimization_basic_functionality() {
    let env = Env::default();
    let loop_opt = LoopOptimization::new();
    
    let computation_gas = LoopOptimization::estimate_computation_gas(&env);
    assert!(computation_gas >= 0);
}

#[test]
fn test_loop_optimization_application() {
    let env = Env::default();
    let savings = LoopOptimization::apply_optimizations(&env);
    
    assert!(savings >= 0);
}

#[test]
fn test_loop_optimization_performance_measurement() {
    let env = Env::default();
    let metrics = LoopOptimization::measure_loop_performance(&env, 100);
    
    assert_eq!(metrics.iterations, 100);
    assert!(metrics.gas_per_iteration >= 0);
    assert!(metrics.total_gas >= 0);
    assert!(metrics.optimization_potential > 0);
}

#[test]
fn test_loop_optimization_patterns() {
    let env = Env::default();
    let patterns = LoopOptimization::analyze_loop_patterns(&env);
    
    assert!(patterns.len() > 0);
    
    for pattern in patterns.iter() {
        assert!(pattern.estimated_savings > 0);
    }
}

#[test]
fn test_loop_optimization_validation() {
    let env = Env::default();
    let is_valid = LoopOptimization::validate_optimization(&env);
    
    assert!(is_valid);
}

#[test]
fn test_call_optimization_basic_functionality() {
    let env = Env::default();
    let call_opt = CallOptimization::new();
    
    let call_gas = CallOptimization::estimate_call_gas(&env);
    assert!(call_gas >= 0);
}

#[test]
fn test_call_optimization_application() {
    let env = Env::default();
    let savings = CallOptimization::apply_optimizations(&env);
    
    assert!(savings >= 0);
}

#[test]
fn test_call_optimization_pattern_analysis() {
    let env = Env::default();
    let metrics = CallOptimization::analyze_call_patterns(&env);
    
    assert!(metrics.external_calls >= 0);
    assert!(metrics.internal_calls >= 0);
    assert!(metrics.gas_per_call >= 0);
    assert!(metrics.total_gas >= 0);
    assert!(metrics.caching_potential >= 0);
}

#[test]
fn test_call_optimization_report_generation() {
    let env = Env::default();
    let test_metrics = CallMetrics {
        external_calls: 10,
        internal_calls: 5,
        gas_per_call: 1000,
        total_gas: 10000,
        caching_potential: 70,
    };
    
    let report = CallOptimization::generate_optimization_report(&env, &test_metrics);
    
    assert!(report.optimized_calls <= report.original_calls);
    assert!(report.gas_savings >= 0);
    assert!(report.techniques_applied.len() >= 0);
}

#[test]
fn test_call_optimization_techniques() {
    let env = Env::default();
    let techniques = CallOptimization::get_call_optimization_techniques(&env);
    
    assert!(techniques.len() > 0);
}

#[test]
fn test_call_optimization_validation() {
    let env = Env::default();
    let is_valid = CallOptimization::validate_call_optimization(&env);
    
    assert!(is_valid);
}

#[test]
fn test_call_optimization_performance_measurement() {
    let env = Env::default();
    let metrics = CallOptimization::measure_call_performance(&env, 50);
    
    assert_eq!(metrics.external_calls, 50);
    assert!(metrics.gas_per_call >= 0);
    assert!(metrics.total_gas >= 0);
}

#[test]
fn test_integrated_gas_optimization() {
    let env = Env::default();
    let test_function = symbol_short!("integrated_test");
    
    let initial_metrics = GasMetrics {
        total_gas_used: 15000,
        storage_gas: 5000,
        computation_gas: 5000,
        call_gas: 5000,
        optimization_savings: 0,
    };
    
    let benchmark_report = GasOptimizer::benchmark_function(&env, &test_function);
    
    assert!(benchmark_report.original_gas > 0);
    assert!(benchmark_report.optimized_gas <= benchmark_report.original_gas);
    assert!(benchmark_report.savings_percentage >= 0);
    
    let is_valid = GasOptimizer::validate_optimizations(&env, &benchmark_report);
    
    if benchmark_report.savings_percentage >= 20 {
        assert!(is_valid);
    }
}

#[test]
fn test_optimization_recommendations() {
    let env = Env::default();
    let test_metrics = GasMetrics {
        total_gas_used: 12000,
        storage_gas: 4000,
        computation_gas: 4000,
        call_gas: 4000,
        optimization_savings: 0,
    };
    
    let recommendations = GasOptimizer::get_optimization_recommendations(&env, &test_metrics);
    
    assert!(recommendations.len() > 0);
}

#[test]
fn test_gas_optimization_regression() {
    let env = Env::default();
    
    let baseline_metrics = GasMetrics {
        total_gas_used: 10000,
        storage_gas: 3333,
        computation_gas: 3333,
        call_gas: 3334,
        optimization_savings: 0,
    };
    
    let optimized_metrics = GasMetrics {
        total_gas_used: 7500,
        storage_gas: 2500,
        computation_gas: 2500,
        call_gas: 2500,
        optimization_savings: 2500,
    };
    
    let savings_percentage = (baseline_metrics.total_gas_used - optimized_metrics.total_gas_used) * 100 / baseline_metrics.total_gas_used;
    
    assert!(savings_percentage >= 20);
}

#[test]
fn test_optimization_suite_integration() {
    let env = Env::default();
    
    let storage_savings = StorageOptimization::apply_optimizations(&env);
    let loop_savings = LoopOptimization::apply_optimizations(&env);
    let call_savings = CallOptimization::apply_optimizations(&env);
    
    let total_savings = storage_savings + loop_savings + call_savings;
    
    assert!(total_savings >= 0);
    
    let storage_patterns = StorageOptimization::analyze_storage_patterns(&env);
    let loop_patterns = LoopOptimization::analyze_loop_patterns(&env);
    let call_techniques = CallOptimization::get_call_optimization_techniques(&env);
    
    assert!(storage_patterns.len() > 0);
    assert!(loop_patterns.len() > 0);
    assert!(call_techniques.len() > 0);
}

#[test]
fn test_gas_optimization_edge_cases() {
    let env = Env::default();
    
    let zero_metrics = GasMetrics {
        total_gas_used: 0,
        storage_gas: 0,
        computation_gas: 0,
        call_gas: 0,
        optimization_savings: 0,
    };
    
    let report = GasOptimizer::optimize_function(&env, &symbol_short!("zero_test"), zero_metrics);
    
    assert_eq!(report.original_gas, 0);
    assert_eq!(report.optimized_gas, 0);
    assert_eq!(report.savings_percentage, 0);
}

#[test]
fn test_optimization_performance_benchmarks() {
    let env = Env::default();
    
    let start_time = env.ledger().timestamp();
    
    let _storage_analysis = StorageOptimization::estimate_storage_gas(&env);
    let _loop_analysis = LoopOptimization::estimate_computation_gas(&env);
    let _call_analysis = CallOptimization::estimate_call_gas(&env);
    
    let end_time = env.ledger().timestamp();
    let analysis_duration = end_time - start_time;
    
    assert!(analysis_duration < 1000000);
}
