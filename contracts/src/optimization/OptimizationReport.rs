#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, Symbol};
use crate::gas_analyzer::GasAnalysisResult;
use crate::auto_refactor::RefactorResult;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OptimizationSummary {
    pub total_gas_saved: u64,
    pub gas_reduction_percentage: f64,
    pub optimizations_applied: u32,
    pub risk_score: f64,
    pub compilation_success: bool,
    pub estimated_cost_savings_usd: f64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DetailedMetrics {
    pub function_name: String,
    pub original_gas: u64,
    pub optimized_gas: u64,
    pub gas_saved: u64,
    pub optimization_percentage: f64,
    pub applied_transformations: Vec<String>,
    pub complexity_reduction: f64,
    pub maintainability_score: u8, // 1-10
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OptimizationReport {
    pub report_id: u64,
    pub contract_address: Address,
    pub timestamp: u64,
    pub summary: OptimizationSummary,
    pub detailed_metrics: Vec<DetailedMetrics>,
    pub recommendations: Vec<String>,
    pub warnings: Vec<String>,
    pub before_after_comparison: Map<String, String>, // function -> comparison
    pub performance_benchmarks: Map<String, u64>, // function -> execution_time_ms
    pub code_quality_metrics: CodeQualityMetrics,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodeQualityMetrics {
    pub cyclomatic_complexity_reduction: f64,
    pub code_duplication_reduction: f64,
    pub maintainability_improvement: f64,
    pub test_coverage_impact: f64,
    pub security_score: u8, // 1-10
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrendAnalysis {
    pub optimization_trend: Vec<f64>, // Historical gas reduction percentages
    pub quality_trend: Vec<f64>, // Historical quality scores
    pub performance_trend: Vec<u64>, // Historical execution times
    pub cost_savings_trend: Vec<f64>, // Historical cost savings
}

#[contracttype]
pub enum OptimizationReportDataKey {
    Reports(u64),
    ReportCount,
    ReportHistory,
    TrendData,
    TemplateReports,
}

#[contract]
pub struct OptimizationReport;

#[contractimpl]
impl OptimizationReport {
    /// Initialize the optimization reporting system
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&OptimizationReportDataKey::ReportCount) {
            panic!("Optimization Report already initialized");
        }
        
        env.storage().instance().set(&OptimizationReportDataKey::ReportCount, &0u64);
        env.storage().instance().set(&OptimizationReportDataKey::ReportHistory, &Vec::new(&env));
        env.storage().instance().set(&OptimizationReportDataKey::TrendData, &Vec::new(&env));
    }

    /// Generate comprehensive optimization report
    pub fn generate_report(
        env: Env,
        contract_address: Address,
        gas_analysis: GasAnalysisResult,
        refactor_result: RefactorResult,
        gas_price_usd: f64, // Current gas price in USD
    ) -> OptimizationReport {
        let report_count: u64 = env.storage().instance()
            .get(&OptimizationReportDataKey::ReportCount)
            .unwrap_or(0);
        
        let report_id = report_count + 1;

        // Calculate summary metrics
        let summary = Self::calculate_summary(&env, &gas_analysis, &refactor_result, gas_price_usd);
        
        // Generate detailed metrics for each function
        let detailed_metrics = Self::generate_detailed_metrics(&env, &gas_analysis, &refactor_result);
        
        // Generate recommendations and warnings
        let recommendations = Self::generate_recommendations(&env, &gas_analysis, &refactor_result);
        let warnings = Self::generate_warnings(&env, &refactor_result);
        
        // Create before/after comparison
        let before_after_comparison = Self::create_before_after_comparison(&env, &gas_analysis, &refactor_result);
        
        // Generate performance benchmarks
        let performance_benchmarks = Self::generate_performance_benchmarks(&env, &gas_analysis);
        
        // Calculate code quality metrics
        let code_quality_metrics = Self::calculate_code_quality_metrics(&env, &gas_analysis, &refactor_result);

        let report = OptimizationReport {
            report_id,
            contract_address: contract_address.clone(),
            timestamp: env.ledger().timestamp(),
            summary,
            detailed_metrics: detailed_metrics.clone(),
            recommendations: recommendations.clone(),
            warnings: warnings.clone(),
            before_after_comparison,
            performance_benchmarks,
            code_quality_metrics,
        };

        // Store the report
        env.storage().instance().set(&OptimizationReportDataKey::Reports(report_id), &report.clone());
        env.storage().instance().set(&OptimizationReportDataKey::ReportCount, &report_id);
        
        // Store in history
        Self::store_report_history(&env, report.clone());
        
        // Update trend data
        Self::update_trend_data(&env, report.clone());

        report
    }

    /// Calculate optimization summary
    fn calculate_summary(
        env: &Env,
        gas_analysis: &GasAnalysisResult,
        refactor_result: &RefactorResult,
        gas_price_usd: f64,
    ) -> OptimizationSummary {
        let total_gas_saved = refactor_result.total_gas_savings;
        let gas_reduction_percentage = if gas_analysis.total_gas_consumed > 0 {
            (total_gas_saved as f64 / gas_analysis.total_gas_consumed as f64) * 100.0
        } else {
            0.0
        };
        
        let optimizations_applied = refactor_result.applied_rules.len() as u32;
        let compilation_success = refactor_result.compilation_status;
        
        // Estimate cost savings (simplified calculation)
        let estimated_cost_savings_usd = (total_gas_saved as f64 / 1_000_000.0) * gas_price_usd;

        OptimizationSummary {
            total_gas_saved,
            gas_reduction_percentage,
            optimizations_applied,
            risk_score: refactor_result.risk_score,
            compilation_success,
            estimated_cost_savings_usd,
        }
    }

    /// Generate detailed metrics for each function
    fn generate_detailed_metrics(
        env: &Env,
        gas_analysis: &GasAnalysisResult,
        refactor_result: &RefactorResult,
    ) -> Vec<DetailedMetrics> {
        let mut detailed_metrics = Vec::new(env);

        for function_profile in gas_analysis.function_profiles.iter() {
            // Estimate optimized gas based on applied transformations
            let estimated_optimized_gas = function_profile.total_gas - 
                (function_profile.total_gas as f64 * function_profile.optimization_potential) as u64;
            
            let gas_saved = function_profile.total_gas - estimated_optimized_gas;
            let optimization_percentage = if function_profile.total_gas > 0 {
                (gas_saved as f64 / function_profile.total_gas as f64) * 100.0
            } else {
                0.0
            };

            // Generate applied transformations based on function analysis
            let applied_transformations = Self::get_applied_transformations(env, function_profile.function_name.clone());
            
            // Calculate complexity reduction (simplified)
            let complexity_reduction = function_profile.optimization_potential * 0.5;
            
            // Calculate maintainability score (1-10)
            let maintainability_score = if optimization_percentage > 30.0 {
                8
            } else if optimization_percentage > 15.0 {
                6
            } else if optimization_percentage > 5.0 {
                4
            } else {
                2
            };

            detailed_metrics.push_back(DetailedMetrics {
                function_name: function_profile.function_name.clone(),
                original_gas: function_profile.total_gas,
                optimized_gas: estimated_optimized_gas,
                gas_saved,
                optimization_percentage,
                applied_transformations,
                complexity_reduction,
                maintainability_score,
            });
        }

        detailed_metrics
    }

    /// Get applied transformations for a function
    fn get_applied_transformations(env: &Env, function_name: String) -> Vec<String> {
        let mut transformations = Vec::new(env);
        
        // This would be based on actual applied rules in a real implementation
        transformations.push_back(String::from_str(env, "Storage optimization"));
        transformations.push_back(String::from_str(env, "Loop optimization"));
        transformations.push_back(String::from_str(env, "Memory optimization"));
        
        transformations
    }

    /// Generate optimization recommendations
    fn generate_recommendations(
        env: &Env,
        gas_analysis: &GasAnalysisResult,
        refactor_result: &RefactorResult,
    ) -> Vec<String> {
        let mut recommendations = Vec::new(env);

        // Based on gas analysis
        if gas_analysis.optimization_score < 50.0 {
            recommendations.push_back(String::from_str(
                env,
                "Contract has significant optimization potential. Consider comprehensive refactoring."
            ));
        }

        // Based on refactor results
        if refactor_result.risk_score > 7.0 {
            recommendations.push_back(String::from_str(
                env,
                "High-risk optimizations applied. Consider gradual deployment and thorough testing."
            ));
        }

        if !refactor_result.compilation_status {
            recommendations.push_back(String::from_str(
                env,
                "Compilation issues detected. Review applied transformations."
            ));
        }

        // Function-specific recommendations
        for critical_function in gas_analysis.critical_gas_consumers.iter() {
            recommendations.push_back(String::from_str(
                env,
                &format!("Focus optimization efforts on {} (critical gas consumer)", critical_function)
            ));
        }

        // General recommendations
        recommendations.push_back(String::from_str(
            env,
            "Implement automated gas testing in CI/CD pipeline"
        ));
        
        recommendations.push_back(String::from_str(
            env,
            "Consider using gas-efficient data structures and algorithms"
        ));

        recommendations
    }

    /// Generate warnings
    fn generate_warnings(env: &Env, refactor_result: &RefactorResult) -> Vec<String> {
        let mut warnings = Vec::new(env);

        // Add warnings from refactor result
        for warning in refactor_result.warnings.iter() {
            warnings.push_back(warning.clone());
        }

        // Additional warnings based on analysis
        if refactor_result.risk_score > 8.0 {
            warnings.push_back(String::from_str(
                env,
                "Very high risk score detected. Manual review strongly recommended."
            ));
        }

        if refactor_result.total_gas_savings < 1000 {
            warnings.push_back(String::from_str(
                env,
                "Minimal gas savings achieved. Review optimization strategy."
            ));
        }

        warnings
    }

    /// Create before/after comparison
    fn create_before_after_comparison(
        env: &Env,
        gas_analysis: &GasAnalysisResult,
        refactor_result: &RefactorResult,
    ) -> Map<String, String> {
        let mut comparison = Map::new(env);

        for function_profile in gas_analysis.function_profiles.iter() {
            let before = format!("Gas: {}, Time: {}ms", 
                function_profile.total_gas, 
                function_profile.execution_time_ms
            );
            
            let optimized_gas = function_profile.total_gas - 
                (function_profile.total_gas as f64 * function_profile.optimization_potential) as u64;
            let optimized_time = function_profile.execution_time_ms - 
                (function_profile.execution_time_ms as f64 * function_profile.optimization_potential * 0.5) as u64;
            
            let after = format!("Gas: {}, Time: {}ms", optimized_gas, optimized_time);
            
            comparison.set(function_profile.function_name.clone(), 
                String::from_str(env, &format!("Before: {} | After: {}", before, after)));
        }

        comparison
    }

    /// Generate performance benchmarks
    fn generate_performance_benchmarks(env: &Env, gas_analysis: &GasAnalysisResult) -> Map<String, u64> {
        let mut benchmarks = Map::new(env);

        for function_profile in gas_analysis.function_profiles.iter() {
            benchmarks.set(
                function_profile.function_name.clone(),
                function_profile.execution_time_ms
            );
        }

        benchmarks
    }

    /// Calculate code quality metrics
    fn calculate_code_quality_metrics(
        env: &Env,
        gas_analysis: &GasAnalysisResult,
        refactor_result: &RefactorResult,
    ) -> CodeQualityMetrics {
        // Simplified calculations - in practice, these would be more sophisticated
        let cyclomatic_complexity_reduction = gas_analysis.optimization_score / 100.0 * 0.3;
        let code_duplication_reduction = if refactor_result.applied_rules.len() > 5 { 0.2 } else { 0.1 };
        let maintainability_improvement = (refactor_result.total_gas_savings as f64 / 10000.0).min(0.5);
        let test_coverage_impact = 0.1; // Assume slight improvement
        let security_score = if refactor_result.risk_score < 5.0 { 8 } else { 6 };

        CodeQualityMetrics {
            cyclomatic_complexity_reduction,
            code_duplication_reduction,
            maintainability_improvement,
            test_coverage_impact,
            security_score,
        }
    }

    /// Store report in history
    fn store_report_history(env: &Env, report: OptimizationReport) {
        let mut history: Vec<OptimizationReport> = env.storage().instance()
            .get(&OptimizationReportDataKey::ReportHistory)
            .unwrap_or(Vec::new(env));
        
        history.push_back(report);
        
        // Keep only last 100 reports
        if history.len() > 100 {
            history.remove(0);
        }
        
        env.storage().instance().set(&OptimizationReportDataKey::ReportHistory, &history);
    }

    /// Update trend data
    fn update_trend_data(env: &Env, report: OptimizationReport) {
        let mut trend_data: Vec<TrendAnalysis> = env.storage().instance()
            .get(&OptimizationReportDataKey::TrendData)
            .unwrap_or(Vec::new(env));
        
        // Create new trend data point
        let mut new_trend = if trend_data.is_empty() {
            TrendAnalysis {
                optimization_trend: Vec::new(env),
                quality_trend: Vec::new(env),
                performance_trend: Vec::new(env),
                cost_savings_trend: Vec::new(env),
            }
        } else {
            trend_data.last().unwrap().clone()
        };

        // Add current data points
        new_trend.optimization_trend.push_back(report.summary.gas_reduction_percentage);
        new_trend.quality_trend.push_back(report.code_quality_metrics.maintainability_improvement);
        new_trend.performance_trend.push_back(report.summary.total_gas_saved);
        new_trend.cost_savings_trend.push_back(report.summary.estimated_cost_savings_usd);

        // Keep only last 50 data points
        if new_trend.optimization_trend.len() > 50 {
            new_trend.optimization_trend.remove(0);
            new_trend.quality_trend.remove(0);
            new_trend.performance_trend.remove(0);
            new_trend.cost_savings_trend.remove(0);
        }

        trend_data.push_back(new_trend);
        
        // Keep only last 20 trend analyses
        if trend_data.len() > 20 {
            trend_data.remove(0);
        }

        env.storage().instance().set(&OptimizationReportDataKey::TrendData, &trend_data);
    }

    /// Get a specific report
    pub fn get_report(env: Env, report_id: u64) -> Option<OptimizationReport> {
        env.storage().instance().get(&OptimizationReportDataKey::Reports(report_id))
    }

    /// Get all reports
    pub fn get_all_reports(env: Env) -> Vec<OptimizationReport> {
        let mut reports = Vec::new(&env);
        let report_count: u64 = env.storage().instance()
            .get(&OptimizationReportDataKey::ReportCount)
            .unwrap_or(0);
        
        for report_id in 1..=report_count {
            if let Some(report) = env.storage().instance().get::<OptimizationReportDataKey, OptimizationReport>(
                &OptimizationReportDataKey::Reports(report_id)
            ) {
                reports.push_back(report);
            }
        }
        
        reports
    }

    /// Get report history
    pub fn get_report_history(env: Env) -> Vec<OptimizationReport> {
        env.storage().instance()
            .get(&OptimizationReportDataKey::ReportHistory)
            .unwrap_or(Vec::new(&env))
    }

    /// Get trend analysis
    pub fn get_trend_analysis(env: Env) -> Option<TrendAnalysis> {
        let trend_data: Vec<TrendAnalysis> = env.storage().instance()
            .get(&OptimizationReportDataKey::TrendData)
            .unwrap_or(Vec::new(&env));
        
        trend_data.last().cloned()
    }

    /// Generate summary statistics
    pub fn generate_summary_statistics(env: Env) -> Map<String, String> {
        let mut stats = Map::new(&env);
        let reports = Self::get_all_reports(env.clone());
        
        if reports.is_empty() {
            stats.set(String::from_str(&env, "total_reports"), String::from_str(&env, "0"));
            return stats;
        }

        let total_gas_saved: u64 = reports.iter().map(|r| r.summary.total_gas_saved).sum();
        let avg_gas_reduction: f64 = reports.iter().map(|r| r.summary.gas_reduction_percentage).sum::<f64>() / reports.len() as f64;
        let total_cost_savings: f64 = reports.iter().map(|r| r.summary.estimated_cost_savings_usd).sum();
        let successful_optimizations: u32 = reports.iter().filter(|r| r.summary.compilation_success).count() as u32;

        stats.set(String::from_str(&env, "total_reports"), String::from_str(&env, &reports.len().to_string()));
        stats.set(String::from_str(&env, "total_gas_saved"), String::from_str(&env, &total_gas_saved.to_string()));
        stats.set(String::from_str(&env, "avg_gas_reduction"), String::from_str(&env, &format!("{:.2}%", avg_gas_reduction)));
        stats.set(String::from_str(&env, "total_cost_savings"), String::from_str(&env, &format!("${:.2}", total_cost_savings)));
        stats.set(String::from_str(&env, "successful_optimizations"), String::from_str(&env, &successful_optimizations.to_string()));

        stats
    }

    /// Export report to different formats
    pub fn export_report(env: Env, report_id: u64, format: String) -> String {
        if let Some(report) = Self::get_report(env.clone(), report_id) {
            match format.to_lowercase().as_str() {
                "json" => Self::export_as_json(&env, report),
                "csv" => Self::export_as_csv(&env, report),
                "markdown" => Self::export_as_markdown(&env, report),
                _ => String::from_str(&env, "Unsupported format"),
            }
        } else {
            String::from_str(&env, "Report not found")
        }
    }

    /// Export report as JSON
    fn export_as_json(env: &Env, report: OptimizationReport) -> String {
        let json = format!(
            r#"{{
  "report_id": {},
  "contract_address": "{:?}",
  "timestamp": {},
  "summary": {{
    "total_gas_saved": {},
    "gas_reduction_percentage": {:.2},
    "optimizations_applied": {},
    "risk_score": {:.2},
    "compilation_success": {},
    "estimated_cost_savings_usd": {:.2}
  }}
}}"#,
            report.report_id,
            report.contract_address,
            report.timestamp,
            report.summary.total_gas_saved,
            report.summary.gas_reduction_percentage,
            report.summary.optimizations_applied,
            report.summary.risk_score,
            report.summary.compilation_success,
            report.summary.estimated_cost_savings_usd
        );
        
        String::from_str(env, &json)
    }

    /// Export report as CSV
    fn export_as_csv(env: &Env, report: OptimizationReport) -> String {
        let mut csv = String::from_str(env, "Function,Original Gas,Optimized Gas,Gas Saved,Reduction %\n");
        
        for metric in report.detailed_metrics.iter() {
            let line = format!("{},{},{},{},{:.2}%\n",
                metric.function_name,
                metric.original_gas,
                metric.optimized_gas,
                metric.gas_saved,
                metric.optimization_percentage
            );
            csv = csv + String::from_str(env, &line);
        }
        
        csv
    }

    /// Export report as Markdown
    fn export_as_markdown(env: &Env, report: OptimizationReport) -> String {
        let mut markdown = format!(
            r#"# Optimization Report {}

**Contract Address:** `{:?}`  
**Timestamp:** {}  
**Gas Reduction:** {:.2}%  
**Total Gas Saved:** {}  
**Cost Savings:** ${:.2}

## Summary

- **Optimizations Applied:** {}
- **Risk Score:** {:.2}/10
- **Compilation Status:** {}

## Function Details

| Function | Original Gas | Optimized Gas | Gas Saved | Reduction % |
|----------|--------------|---------------|-----------|-------------|
"#,
            report.report_id,
            report.contract_address,
            report.timestamp,
            report.summary.gas_reduction_percentage,
            report.summary.total_gas_saved,
            report.summary.estimated_cost_savings_usd,
            report.summary.optimizations_applied,
            report.summary.risk_score,
            if report.summary.compilation_success { "✅ Success" } else { "❌ Failed" }
        );

        for metric in report.detailed_metrics.iter() {
            let line = format!("| {} | {} | {} | {} | {:.2}% |\n",
                metric.function_name,
                metric.original_gas,
                metric.optimized_gas,
                metric.gas_saved,
                metric.optimization_percentage
            );
            markdown = markdown + &line;
        }

        String::from_str(env, &markdown)
    }
}
