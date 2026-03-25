use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::optimization::{AIOptimizationResult, GasAnalysisResult, GasBenchmark};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationReport {
    pub report_id: String,
    pub contract_name: String,
    pub contract_version: String,
    pub generated_at: DateTime<Utc>,
    pub analysis_summary: AnalysisSummary,
    pub gas_analysis: GasAnalysisSection,
    pub optimization_suggestions: OptimizationSuggestionsSection,
    pub benchmarks: BenchmarkSection,
    pub recommendations: RecommendationsSection,
    pub cost_analysis: CostAnalysisSection,
    pub visualizations: VisualizationSection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisSummary {
    pub total_gas_cost: u64,
    pub deployment_cost: u64,
    pub estimated_savings: u64,
    pub optimization_potential: f64,
    pub efficiency_score: f64,
    pub complexity_score: f64,
    pub functions_analyzed: u32,
    pub optimization_opportunities: u32,
    pub risk_assessment: RiskAssessment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAssessment {
    pub overall_risk_level: RiskLevel,
    pub high_risk_changes: u32,
    pub medium_risk_changes: u32,
    pub low_risk_changes: u32,
    pub breaking_changes: u32,
    pub test_coverage_required: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasAnalysisSection {
    pub function_costs: Vec<FunctionCostReport>,
    pub storage_operations: Vec<StorageOperationReport>,
    pub external_calls: Vec<ExternalCallReport>,
    pub loop_analysis: Vec<LoopAnalysisReport>,
    pub gas_breakdown: GasBreakdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCostReport {
    pub name: String,
    pub execution_cost: u64,
    pub transaction_cost: u64,
    pub gas_per_line: f64,
    pub complexity_score: f64,
    pub optimization_suggestions: Vec<String>,
    pub cost_ranking: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageOperationReport {
    pub operation_type: String,
    pub variable_name: String,
    pub gas_cost: u64,
    pub function_name: String,
    pub optimization_possible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalCallReport {
    pub target_contract: String,
    pub function_name: String,
    pub gas_cost: u64,
    pub call_type: String,
    pub optimization_suggestions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoopAnalysisReport {
    pub loop_type: String,
    pub iterations_estimate: u32,
    pub gas_cost_per_iteration: u64,
    pub total_gas_cost: u64,
    pub function_name: String,
    pub unrolling_possible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasBreakdown {
    pub storage_percentage: f64,
    pub computation_percentage: f64,
    pub external_call_percentage: f64,
    pub loop_percentage: f64,
    pub other_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationSuggestionsSection {
    pub suggestions: Vec<OptimizationSuggestionReport>,
    pub category_breakdown: HashMap<String, CategoryStats>,
    pub priority_matrix: PriorityMatrix,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationSuggestionReport {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: String,
    pub severity: String,
    pub estimated_gas_saving: u64,
    pub confidence: f64,
    pub implementation_complexity: ImplementationComplexity,
    pub risk_level: RiskLevel,
    pub code_snippet: Option<String>,
    pub suggested_fix: Option<String>,
    pub line_number: Option<u32>,
    pub function_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImplementationComplexity {
    pub level: ComplexityLevel,
    pub estimated_time_hours: f64,
    pub required_expertise: Vec<String>,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ComplexityLevel {
    Simple,
    Moderate,
    Complex,
    VeryComplex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryStats {
    pub category_name: String,
    pub total_suggestions: u32,
    pub total_gas_savings: u64,
    pub average_confidence: f64,
    pub priority_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorityMatrix {
    pub high_priority_high_impact: Vec<String>,
    pub high_priority_low_impact: Vec<String>,
    pub low_priority_high_impact: Vec<String>,
    pub low_priority_low_impact: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkSection {
    pub current_benchmark: GasBenchmark,
    pub baseline_comparison: Option<BenchmarkComparison>,
    pub performance_trends: Vec<PerformanceTrend>,
    pub regression_analysis: RegressionAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkComparison {
    pub baseline_version: String,
    pub overall_improvement_percentage: f64,
    pub function_improvements: HashMap<String, f64>,
    pub regression_detected: bool,
    pub significant_changes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceTrend {
    pub date: DateTime<Utc>,
    pub version: String,
    pub total_gas_cost: u64,
    pub efficiency_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegressionAnalysis {
    pub regressions_detected: bool,
    pub regressed_functions: Vec<String>,
    pub regression_severity: RegressionSeverity,
    pub recommended_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RegressionSeverity {
    None,
    Minor,
    Moderate,
    Severe,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationsSection {
    pub immediate_actions: Vec<Recommendation>,
    pub short_term_goals: Vec<Recommendation>,
    pub long_term_strategy: Vec<Recommendation>,
    pub best_practices: Vec<BestPractice>,
    pub implementation_roadmap: ImplementationRoadmap,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    pub id: String,
    pub title: String,
    pub description: String,
    pub priority: Priority,
    pub estimated_effort: f64,
    pub expected_benefit: String,
    pub dependencies: Vec<String>,
    pub success_metrics: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Priority {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BestPractice {
    pub practice: String,
    pub description: String,
    pub gas_impact: String,
    pub implementation_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImplementationRoadmap {
    pub phases: Vec<RoadmapPhase>,
    pub total_estimated_duration_weeks: u32,
    pub resource_requirements: Vec<String>,
    pub milestones: Vec<Milestone>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoadmapPhase {
    pub phase_number: u32,
    pub name: String,
    pub duration_weeks: u32,
    pub objectives: Vec<String>,
    pub deliverables: Vec<String>,
    pub risks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub name: String,
    pub target_date: DateTime<Utc>,
    pub success_criteria: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostAnalysisSection {
    pub current_gas_costs: GasCostBreakdown,
    pub projected_savings: ProjectedSavings,
    pub roi_analysis: ROIAnalysis,
    pub cost_optimization_metrics: CostOptimizationMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasCostBreakdown {
    pub deployment_cost: u64,
    pub per_transaction_cost: u64,
    pub monthly_estimated_cost: f64,
    pub annual_estimated_cost: f64,
    pub cost_per_function: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectedSavings {
    pub immediate_savings: u64,
    pub monthly_savings: f64,
    pub annual_savings: f64,
    pub savings_percentage: f64,
    pub confidence_interval: (f64, f64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ROIAnalysis {
    pub implementation_cost: f64,
    pub annual_savings: f64,
    pub payback_period_months: u32,
    pub three_year_roi: f64,
    pub risk_adjusted_roi: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostOptimizationMetrics {
    pub gas_efficiency_score: f64,
    pub cost_per_operation: f64,
    pub optimization_rate: f64,
    pub benchmark_comparison: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualizationSection {
    pub charts: Vec<ChartConfig>,
    pub graphs: Vec<GraphConfig>,
    pub tables: Vec<TableConfig>,
    pub custom_visualizations: Vec<CustomVisualization>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartConfig {
    pub chart_type: String,
    pub title: String,
    pub data_source: String,
    pub x_axis: String,
    pub y_axis: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphConfig {
    pub graph_type: String,
    pub title: String,
    pub nodes: Vec<NodeConfig>,
    pub edges: Vec<EdgeConfig>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    pub id: String,
    pub label: String,
    pub size: f64,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeConfig {
    pub source: String,
    pub target: String,
    pub weight: f64,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableConfig {
    pub title: String,
    pub columns: Vec<ColumnConfig>,
    pub data_source: String,
    pub sortable: bool,
    pub filterable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnConfig {
    pub name: String,
    pub data_type: String,
    pub sortable: bool,
    pub filterable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomVisualization {
    pub visualization_type: String,
    pub title: String,
    pub config: serde_json::Value,
    pub description: String,
}

pub struct OptimizationReportGenerator;

impl OptimizationReportGenerator {
    pub fn new() -> Self {
        Self
    }

    pub fn generate_from_ai_result(ai_result: &AIOptimizationResult) -> Result<OptimizationReport, Box<dyn std::error::Error>> {
        let report_id = format!("report_{}", Utc::now().timestamp());
        
        let analysis_summary = AnalysisSummary {
            total_gas_cost: 0, // Would need gas analysis result
            deployment_cost: 0,
            estimated_savings: ai_result.total_estimated_savings,
            optimization_potential: ai_result.optimization_potential,
            efficiency_score: 75.0, // Placeholder
            complexity_score: ai_result.contract_complexity_score,
            functions_analyzed: 0, // Would need detailed analysis
            optimization_opportunities: ai_result.suggestions.len() as u32,
            risk_assessment: RiskAssessment {
                overall_risk_level: RiskLevel::Medium,
                high_risk_changes: 0,
                medium_risk_changes: ai_result.suggestions.len() as u32 / 2,
                low_risk_changes: ai_result.suggestions.len() as u32 / 2,
                breaking_changes: 0,
                test_coverage_required: 80.0,
            },
        };

        let optimization_suggestions = Self::convert_ai_suggestions(&ai_result.suggestions);

        Ok(OptimizationReport {
            report_id,
            contract_name: "Unknown".to_string(), // Would need from analysis
            contract_version: "1.0.0".to_string(),
            generated_at: Utc::now(),
            analysis_summary,
            gas_analysis: GasAnalysisSection {
                function_costs: Vec::new(),
                storage_operations: Vec::new(),
                external_calls: Vec::new(),
                loop_analysis: Vec::new(),
                gas_breakdown: GasBreakdown {
                    storage_percentage: 30.0,
                    computation_percentage: 40.0,
                    external_call_percentage: 20.0,
                    loop_percentage: 5.0,
                    other_percentage: 5.0,
                },
            },
            optimization_suggestions,
            benchmarks: BenchmarkSection {
                current_benchmark: GasBenchmark {
                    contract_name: "Unknown".to_string(),
                    version: "1.0.0".to_string(),
                    benchmarks: HashMap::new(),
                    comparison_baseline: None,
                    improvement_percentage: 0.0,
                },
                baseline_comparison: None,
                performance_trends: Vec::new(),
                regression_analysis: RegressionAnalysis {
                    regressions_detected: false,
                    regressed_functions: Vec::new(),
                    regression_severity: RegressionSeverity::None,
                    recommended_actions: Vec::new(),
                },
            },
            recommendations: RecommendationsSection {
                immediate_actions: Vec::new(),
                short_term_goals: Vec::new(),
                long_term_strategy: Vec::new(),
                best_practices: Vec::new(),
                implementation_roadmap: ImplementationRoadmap {
                    phases: Vec::new(),
                    total_estimated_duration_weeks: 0,
                    resource_requirements: Vec::new(),
                    milestones: Vec::new(),
                },
            },
            cost_analysis: CostAnalysisSection {
                current_gas_costs: GasCostBreakdown {
                    deployment_cost: 0,
                    per_transaction_cost: 0,
                    monthly_estimated_cost: 0.0,
                    annual_estimated_cost: 0.0,
                    cost_per_function: HashMap::new(),
                },
                projected_savings: ProjectedSavings {
                    immediate_savings: ai_result.total_estimated_savings,
                    monthly_savings: ai_result.total_estimated_savings as f64 * 100.0, // Estimate
                    annual_savings: ai_result.total_estimated_savings as f64 * 1200.0, // Estimate
                    savings_percentage: ai_result.optimization_potential,
                    confidence_interval: (ai_result.optimization_potential * 0.8, ai_result.optimization_potential * 1.2),
                },
                roi_analysis: ROIAnalysis {
                    implementation_cost: 5000.0,
                    annual_savings: ai_result.total_estimated_savings as f64 * 1200.0,
                    payback_period_months: 6,
                    three_year_roi: 300.0,
                    risk_adjusted_roi: 250.0,
                },
                cost_optimization_metrics: CostOptimizationMetrics {
                    gas_efficiency_score: ai_result.optimization_potential,
                    cost_per_operation: 0.0,
                    optimization_rate: ai_result.optimization_potential / 100.0,
                    benchmark_comparison: 0.0,
                },
            },
            visualizations: VisualizationSection {
                charts: vec![
                    ChartConfig {
                        chart_type: "bar".to_string(),
                        title: "Gas Usage by Function".to_string(),
                        data_source: "function_costs".to_string(),
                        x_axis: "function_name".to_string(),
                        y_axis: "gas_cost".to_string(),
                        description: "Comparison of gas costs across all functions".to_string(),
                    },
                    ChartConfig {
                        chart_type: "pie".to_string(),
                        title: "Optimization Opportunities by Category".to_string(),
                        data_source: "optimization_categories".to_string(),
                        x_axis: "category".to_string(),
                        y_axis: "count".to_string(),
                        description: "Distribution of optimization opportunities across categories".to_string(),
                    },
                ],
                graphs: Vec::new(),
                tables: vec![
                    TableConfig {
                        title: "Function Gas Analysis".to_string(),
                        columns: vec![
                            ColumnConfig {
                                name: "Function".to_string(),
                                data_type: "string".to_string(),
                                sortable: true,
                                filterable: true,
                            },
                            ColumnConfig {
                                name: "Gas Cost".to_string(),
                                data_type: "number".to_string(),
                                sortable: true,
                                filterable: false,
                            },
                            ColumnConfig {
                                name: "Optimization Potential".to_string(),
                                data_type: "percentage".to_string(),
                                sortable: true,
                                filterable: false,
                            },
                        ],
                        data_source: "function_analysis".to_string(),
                        sortable: true,
                        filterable: true,
                    },
                ],
                custom_visualizations: Vec::new(),
            },
        })
    }

    fn convert_ai_suggestions(suggestions: &[crate::optimization::OptimizationSuggestion]) -> OptimizationSuggestionsSection {
        let suggestion_reports: Vec<OptimizationSuggestionReport> = suggestions.iter().enumerate().map(|(i, suggestion)| {
            OptimizationSuggestionReport {
                id: suggestion.id.clone(),
                title: suggestion.title.clone(),
                description: suggestion.description.clone(),
                category: format!("{:?}", suggestion.category),
                severity: format!("{:?}", suggestion.severity),
                estimated_gas_saving: suggestion.estimated_gas_saving,
                confidence: suggestion.confidence,
                implementation_complexity: ImplementationComplexity {
                    level: if suggestion.estimated_gas_saving > 5000 { ComplexityLevel::Complex } else { ComplexityLevel::Simple },
                    estimated_time_hours: if suggestion.estimated_gas_saving > 5000 { 8.0 } else { 2.0 },
                    required_expertise: vec!["Solidity".to_string(), "Gas Optimization".to_string()],
                    dependencies: Vec::new(),
                },
                risk_level: RiskLevel::Medium, // Default
                code_snippet: suggestion.code_snippet.clone(),
                suggested_fix: suggestion.suggested_fix.clone(),
                line_number: suggestion.line_number,
                function_name: suggestion.function_name.clone(),
            }
        }).collect();

        let mut category_breakdown = HashMap::new();
        for suggestion in &suggestion_reports {
            let entry = category_breakdown.entry(suggestion.category.clone()).or_insert(CategoryStats {
                category_name: suggestion.category.clone(),
                total_suggestions: 0,
                total_gas_savings: 0,
                average_confidence: 0.0,
                priority_score: 0.0,
            });
            entry.total_suggestions += 1;
            entry.total_gas_savings += suggestion.estimated_gas_saving;
            entry.average_confidence = (entry.average_confidence + suggestion.confidence) / 2.0;
            entry.priority_score = suggestion.estimated_gas_saving as f64 * suggestion.confidence;
        }

        let priority_matrix = Self::create_priority_matrix(&suggestion_reports);

        OptimizationSuggestionsSection {
            suggestions: suggestion_reports,
            category_breakdown,
            priority_matrix,
        }
    }

    fn create_priority_matrix(suggestions: &[OptimizationSuggestionReport]) -> PriorityMatrix {
        let mut high_priority_high_impact = Vec::new();
        let mut high_priority_low_impact = Vec::new();
        let mut low_priority_high_impact = Vec::new();
        let mut low_priority_low_impact = Vec::new();

        for suggestion in suggestions {
            let impact = suggestion.estimated_gas_saving;
            let priority = match suggestion.severity.as_str() {
                "Critical" | "High" => "high",
                "Medium" | "Low" | "Info" => "low",
                _ => "low",
            };

            if priority == "high" && impact > 5000 {
                high_priority_high_impact.push(suggestion.id.clone());
            } else if priority == "high" && impact <= 5000 {
                high_priority_low_impact.push(suggestion.id.clone());
            } else if priority == "low" && impact > 5000 {
                low_priority_high_impact.push(suggestion.id.clone());
            } else {
                low_priority_low_impact.push(suggestion.id.clone());
            }
        }

        PriorityMatrix {
            high_priority_high_impact,
            high_priority_low_impact,
            low_priority_high_impact,
            low_priority_low_impact,
        }
    }

    pub fn generate_markdown_report(&self, report: &OptimizationReport) -> String {
        let mut markdown = String::new();
        
        markdown.push_str("# Gas Optimization Report\n\n");
        markdown.push_str(&format!("**Contract:** {}\n", report.contract_name));
        markdown.push_str(&format!("**Version:** {}\n", report.contract_version));
        markdown.push_str(&format!("**Generated:** {}\n\n", report.generated_at.format("%Y-%m-%d %H:%M:%S UTC")));
        
        // Executive Summary
        markdown.push_str("## Executive Summary\n\n");
        markdown.push_str(&format!("- **Total Gas Cost:** {:,}\n", report.analysis_summary.total_gas_cost));
        markdown.push_str(&format!("- **Estimated Savings:** {:,} ({:.1}%)\n", 
            report.analysis_summary.estimated_savings, 
            report.analysis_summary.optimization_potential));
        markdown.push_str(&format!("- **Efficiency Score:** {:.1}/100\n", report.analysis_summary.efficiency_score));
        markdown.push_str(&format!("- **Optimization Opportunities:** {}\n\n", report.analysis_summary.optimization_opportunities));
        
        // Top Recommendations
        markdown.push_str("## Top Recommendations\n\n");
        for (i, suggestion) in report.optimization_suggestions.suggestions.iter().take(5).enumerate() {
            markdown.push_str(&format!("{}. **{}**\n", i + 1, suggestion.title));
            markdown.push_str(&format!("   - **Gas Savings:** {:,}\n", suggestion.estimated_gas_saving));
            markdown.push_str(&format!("   - **Confidence:** {:.1}%\n", suggestion.confidence * 100.0));
            markdown.push_str(&format!("   - **Description:** {}\n\n", suggestion.description));
        }
        
        // Detailed Analysis
        markdown.push_str("## Detailed Analysis\n\n");
        
        // Gas Breakdown
        markdown.push_str("### Gas Cost Breakdown\n\n");
        markdown.push_str("| Category | Percentage | Cost (gas) |\n");
        markdown.push_str("|----------|------------|-----------|\n");
        markdown.push_str(&format!("| Storage | {:.1}% | {:,} |\n", 
            report.gas_analysis.gas_breakdown.storage_percentage,
            (report.analysis_summary.total_gas_cost as f64 * report.gas_analysis.gas_breakdown.storage_percentage / 100.0) as u64));
        markdown.push_str(&format!("| Computation | {:.1}% | {:,} |\n", 
            report.gas_analysis.gas_breakdown.computation_percentage,
            (report.analysis_summary.total_gas_cost as f64 * report.gas_analysis.gas_breakdown.computation_percentage / 100.0) as u64));
        markdown.push_str(&format!("| External Calls | {:.1}% | {:,} |\n", 
            report.gas_analysis.gas_breakdown.external_call_percentage,
            (report.analysis_summary.total_gas_cost as f64 * report.gas_analysis.gas_breakdown.external_call_percentage / 100.0) as u64));
        markdown.push_str(&format!("| Loops | {:.1}% | {:,} |\n\n", 
            report.gas_analysis.gas_breakdown.loop_percentage,
            (report.analysis_summary.total_gas_cost as f64 * report.gas_analysis.gas_breakdown.loop_percentage / 100.0) as u64));
        
        // Optimization Categories
        markdown.push_str("### Optimization Opportunities by Category\n\n");
        for (category, stats) in &report.optimization_suggestions.category_breakdown {
            markdown.push_str(&format!("#### {}\n", category));
            markdown.push_str(&format!("- **Suggestions:** {}\n", stats.total_suggestions));
            markdown.push_str(&format!("- **Total Savings:** {:,} gas\n", stats.total_gas_savings));
            markdown.push_str(&format!("- **Average Confidence:** {:.1}%\n\n", stats.average_confidence * 100.0));
        }
        
        // Cost Analysis
        markdown.push_str("## Cost Analysis\n\n");
        markdown.push_str("### Projected Savings\n\n");
        markdown.push_str(&format!("- **Immediate Savings:** {:,} gas\n", report.cost_analysis.projected_savings.immediate_savings));
        markdown.push_str(&format!("- **Monthly Savings:** {:.2} gas\n", report.cost_analysis.projected_savings.monthly_savings));
        markdown.push_str(&format!("- **Annual Savings:** {:.2} gas\n", report.cost_analysis.projected_savings.annual_savings));
        markdown.push_str(&format!("- **Savings Percentage:** {:.1}%\n\n", report.cost_analysis.projected_savings.savings_percentage));
        
        // ROI Analysis
        markdown.push_str("### Return on Investment\n\n");
        markdown.push_str(&format!("- **Implementation Cost:** ${:.2}\n", report.cost_analysis.roi_analysis.implementation_cost));
        markdown.push_str(&format!("- **Annual Savings:** ${:.2}\n", report.cost_analysis.roi_analysis.annual_savings));
        markdown.push_str(&format!("- **Payback Period:** {} months\n", report.cost_analysis.roi_analysis.payback_period_months));
        markdown.push_str(&format!("- **3-Year ROI:** {:.1}%\n\n", report.cost_analysis.roi_analysis.three_year_roi));
        
        // Implementation Roadmap
        markdown.push_str("## Implementation Roadmap\n\n");
        markdown.push_str("### Recommended Implementation Order\n\n");
        markdown.push_str("1. **Phase 1: Low-risk optimizations** (Weeks 1-2)\n");
        markdown.push_str("   - Implement simple arithmetic optimizations\n");
        markdown.push_str("   - Add custom errors\n");
        markdown.push_str("   - Optimize storage reads\n\n");
        
        markdown.push_str("2. **Phase 2: Medium-risk optimizations** (Weeks 3-4)\n");
        markdown.push_str("   - Refactor loops\n");
        markdown.push_str("   - Optimize external calls\n");
        markdown.push_str("   - Implement storage packing\n\n");
        
        markdown.push_str("3. **Phase 3: High-risk optimizations** (Weeks 5-6)\n");
        markdown.push_str("   - Structural refactoring\n");
        markdown.push_str("   - Library integration\n");
        markdown.push_str("   - Advanced pattern optimizations\n\n");
        
        // Conclusion
        markdown.push_str("## Conclusion\n\n");
        markdown.push_str(&format!("This analysis identified {} optimization opportunities with potential gas savings of {:,} ({:.1}% reduction). ", 
            report.analysis_summary.optimization_opportunities,
            report.analysis_summary.estimated_savings,
            report.analysis_summary.optimization_potential));
        markdown.push_str(&format!("The implementation of these optimizations is expected to provide a {:.1}% ROI within {} months.\n\n", 
            report.cost_analysis.roi_analysis.three_year_roi,
            report.cost_analysis.roi_analysis.payback_period_months));
        
        markdown.push_str("### Next Steps\n\n");
        markdown.push_str("1. Review and prioritize optimization suggestions\n");
        markdown.push_str("2. Create implementation plan with timeline\n");
        markdown.push_str("3. Set up comprehensive testing framework\n");
        markdown.push_str("4. Implement optimizations in phases\n");
        markdown.push_str("5. Monitor and validate results\n");
        
        markdown
    }

    pub async fn export_report(&self, report: &OptimizationReport, format: &str, output_path: &str) -> Result<(), Box<dyn std::error::Error>> {
        match format.to_lowercase().as_str() {
            "json" => {
                let json = serde_json::to_string_pretty(report)?;
                tokio::fs::write(output_path, json).await?;
            }
            "markdown" => {
                let markdown = self.generate_markdown_report(report);
                tokio::fs::write(output_path, markdown).await?;
            }
            "html" => {
                let html = self.generate_html_report(report).await?;
                tokio::fs::write(output_path, html).await?;
            }
            _ => return Err("Unsupported export format".into()),
        }
        Ok(())
    }

    async fn generate_html_report(&self, report: &OptimizationReport) -> Result<String, Box<dyn std::error::Error>> {
        let markdown = self.generate_markdown_report(report);
        
        // Convert markdown to HTML (simplified - in production use a proper markdown parser)
        let html = format!(r#"
<!DOCTYPE html>
<html>
<head>
    <title>Gas Optimization Report - {}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        h1 {{ color: #2c3e50; border-bottom: 2px solid #3498db; }}
        h2 {{ color: #34495e; }}
        h3 {{ color: #7f8c8d; }}
        table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        .metric {{ background-color: #ecf0f1; padding: 10px; border-radius: 5px; margin: 10px 0; }}
        .high-priority {{ color: #e74c3c; }}
        .medium-priority {{ color: #f39c12; }}
        .low-priority {{ color: #27ae60; }}
    </style>
</head>
<body>
    <div class="container">
        <pre>{}</pre>
    </div>
</body>
</html>
        "#, report.contract_name, markdown);

        Ok(html)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_report_generation() {
        let generator = OptimizationReportGenerator::new();
        
        // Create a mock AI result
        let ai_result = AIOptimizationResult {
            suggestions: vec![],
            total_estimated_savings: 10000,
            analysis_time_ms: 1000,
            contract_complexity_score: 75.0,
            optimization_potential: 35.0,
        };
        
        let report = generator.generate_from_ai_result(&ai_result).unwrap();
        assert_eq!(report.analysis_summary.estimated_savings, 10000);
        assert_eq!(report.analysis_summary.optimization_potential, 35.0);
    }

    #[test]
    fn test_markdown_generation() {
        let generator = OptimizationReportGenerator::new();
        
        let report = OptimizationReport {
            report_id: "test".to_string(),
            contract_name: "TestContract".to_string(),
            contract_version: "1.0.0".to_string(),
            generated_at: Utc::now(),
            analysis_summary: AnalysisSummary {
                total_gas_cost: 100000,
                deployment_cost: 50000,
                estimated_savings: 35000,
                optimization_potential: 35.0,
                efficiency_score: 75.0,
                complexity_score: 50.0,
                functions_analyzed: 10,
                optimization_opportunities: 5,
                risk_assessment: RiskAssessment {
                    overall_risk_level: RiskLevel::Medium,
                    high_risk_changes: 1,
                    medium_risk_changes: 2,
                    low_risk_changes: 2,
                    breaking_changes: 0,
                    test_coverage_required: 80.0,
                },
            },
            gas_analysis: GasAnalysisSection {
                function_costs: vec![],
                storage_operations: vec![],
                external_calls: vec![],
                loop_analysis: vec![],
                gas_breakdown: GasBreakdown {
                    storage_percentage: 30.0,
                    computation_percentage: 40.0,
                    external_call_percentage: 20.0,
                    loop_percentage: 5.0,
                    other_percentage: 5.0,
                },
            },
            optimization_suggestions: OptimizationSuggestionsSection {
                suggestions: vec![],
                category_breakdown: HashMap::new(),
                priority_matrix: PriorityMatrix {
                    high_priority_high_impact: vec![],
                    high_priority_low_impact: vec![],
                    low_priority_high_impact: vec![],
                    low_priority_low_impact: vec![],
                },
            },
            benchmarks: BenchmarkSection {
                current_benchmark: GasBenchmark {
                    contract_name: "TestContract".to_string(),
                    version: "1.0.0".to_string(),
                    benchmarks: HashMap::new(),
                    comparison_baseline: None,
                    improvement_percentage: 0.0,
                },
                baseline_comparison: None,
                performance_trends: vec![],
                regression_analysis: RegressionAnalysis {
                    regressions_detected: false,
                    regressed_functions: vec![],
                    regression_severity: RegressionSeverity::None,
                    recommended_actions: vec![],
                },
            },
            recommendations: RecommendationsSection {
                immediate_actions: vec![],
                short_term_goals: vec![],
                long_term_strategy: vec![],
                best_practices: vec![],
                implementation_roadmap: ImplementationRoadmap {
                    phases: vec![],
                    total_estimated_duration_weeks: 0,
                    resource_requirements: vec![],
                    milestones: vec![],
                },
            },
            cost_analysis: CostAnalysisSection {
                current_gas_costs: GasCostBreakdown {
                    deployment_cost: 50000,
                    per_transaction_cost: 100000,
                    monthly_estimated_cost: 10000.0,
                    annual_estimated_cost: 120000.0,
                    cost_per_function: HashMap::new(),
                },
                projected_savings: ProjectedSavings {
                    immediate_savings: 35000,
                    monthly_savings: 3500.0,
                    annual_savings: 42000.0,
                    savings_percentage: 35.0,
                    confidence_interval: (28.0, 42.0),
                },
                roi_analysis: ROIAnalysis {
                    implementation_cost: 5000.0,
                    annual_savings: 42000.0,
                    payback_period_months: 2,
                    three_year_roi: 2520.0,
                    risk_adjusted_roi: 2000.0,
                },
                cost_optimization_metrics: CostOptimizationMetrics {
                    gas_efficiency_score: 75.0,
                    cost_per_operation: 100.0,
                    optimization_rate: 0.35,
                    benchmark_comparison: 0.0,
                },
            },
            visualizations: VisualizationSection {
                charts: vec![],
                graphs: vec![],
                tables: vec![],
                custom_visualizations: vec![],
            },
        };
        
        let markdown = generator.generate_markdown_report(&report);
        assert!(markdown.contains("Gas Optimization Report"));
        assert!(markdown.contains("TestContract"));
        assert!(markdown.contains("35.0%"));
    }
}
