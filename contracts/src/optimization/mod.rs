pub mod ai_optimizer;
pub mod auto_refactor;
pub mod gas_analyzer;
pub mod optimization_report;

// Re-export main types for easier access
pub use ai_optimizer::{
    AIOptimizer, AIOptimizationResult, OptimizationPattern, LearningData
};
pub use auto_refactor::{
    AutoRefactor, RefactorResult, RefactorRule, CodeMetrics
};
pub use gas_analyzer::{
    GasAnalyzer, GasAnalysisResult, FunctionGasProfile, GasBreakdown
};
pub use optimization_report::{
    OptimizationReport as ReportGenerator, OptimizationReport, OptimizationSummary
};
