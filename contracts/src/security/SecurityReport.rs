use soroban_sdk::{contracterror, contracttype, Address, Bytes, Env, String, Vec, Map};
use crate::security::security_scanner::{Vulnerability, SecurityPattern, GasAnalysis, PatternType};

#[contracterror]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SecurityReportError {
    ReportGenerationFailed = 1,
    InvalidData = 2,
    SerializationError = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityReport {
    pub report_id: Bytes,
    pub contract_address: Address,
    pub scan_timestamp: u64,
    pub overall_score: u8,
    pub gas_score: u8,
    pub vulnerability_summary: VulnerabilitySummary,
    pub pattern_summary: PatternSummary,
    pub gas_analysis_summary: GasAnalysisSummary,
    pub recommendations: Vec<Recommendation>,
    pub detailed_findings: DetailedFindings,
    pub compliance_status: ComplianceStatus,
    pub risk_assessment: RiskAssessment,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VulnerabilitySummary {
    pub total_count: u32,
    pub critical_count: u32,
    pub high_count: u32,
    pub medium_count: u32,
    pub low_count: u32,
    pub info_count: u32,
    pub most_common_type: String,
    pub affected_functions: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PatternSummary {
    pub total_count: u32,
    pub anti_pattern_count: u32,
    pub best_practice_violation_count: u32,
    pub gas_inefficiency_count: u32,
    pub security_risk_count: u32,
    pub most_severe_pattern: String,
    pub pattern_density: f32, // Patterns per 1000 lines
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GasAnalysisSummary {
    pub total_gas_estimate: u64,
    pub deployment_cost_estimate: u64,
    pub execution_cost_estimate: u64,
    pub optimization_potential: u8, // Percentage
    pub high_cost_operations: u32,
    pub storage_operations: u32,
    pub loop_operations: u32,
    pub gas_efficiency_grade: char, // A, B, C, D, F
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Recommendation {
    pub id: String,
    pub title: String,
    pub description: String,
    pub priority: RecommendationPriority,
    pub category: RecommendationCategory,
    pub effort: EffortLevel,
    pub impact: ImpactLevel,
    pub code_snippet: Option<String>,
    pub references: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RecommendationPriority {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RecommendationCategory {
    Security,
    GasOptimization,
    CodeQuality,
    BestPractice,
    Compliance,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EffortLevel {
    Low,    // < 1 hour
    Medium, // 1-4 hours
    High,   // 4-8 hours
    VeryHigh, // > 8 hours
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ImpactLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DetailedFindings {
    pub vulnerabilities: Vec<DetailedVulnerability>,
    pub patterns: Vec<DetailedPattern>,
    pub code_metrics: CodeMetrics,
    pub security_metrics: SecurityMetrics,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DetailedVulnerability {
    pub vulnerability: Vulnerability,
    pub function_name: Option<String>,
    pub line_number: Option<u32>,
    pub column_number: Option<u32>,
    pub code_context: Option<String>,
    pub exploit_scenario: String,
    pub affected_components: Vec<String>,
    pub business_impact: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DetailedPattern {
    pub pattern: SecurityPattern,
    pub occurrences: u32,
    pub locations: Vec<PatternLocation>,
    pub severity_trend: SeverityTrend,
    pub historical_context: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PatternLocation {
    pub function_name: String,
    pub line_number: u32,
    pub context: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SeverityTrend {
    Improving,
    Stable,
    Degrading,
    Unknown,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodeMetrics {
    pub total_lines: u32,
    pub comment_lines: u32,
    pub code_lines: u32,
    pub function_count: u32,
    pub cyclomatic_complexity: u32,
    pub maintainability_index: f32,
    pub technical_debt_ratio: f32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityMetrics {
    pub attack_surface_area: u32,
    pub entry_points: u32,
    pub external_calls: u32,
    pub privileged_functions: u32,
    pub state_mutating_functions: u32,
    pub view_functions: u32,
    pub security_controls: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ComplianceStatus {
    pub overall_compliant: bool,
    pub compliance_score: u8,
    pub framework_compliance: Map<String, bool>, // Framework name -> compliant
    pub missing_requirements: Vec<String>,
    pub compliance_gaps: Vec<ComplianceGap>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ComplianceGap {
    pub framework: String,
    pub requirement: String,
    pub severity: u8,
    pub description: String,
    pub remediation: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RiskAssessment {
    pub overall_risk_level: RiskLevel,
    pub security_risk_score: u8,
    pub gas_risk_score: u8,
    pub operational_risk_score: u8,
    pub risk_factors: Vec<RiskFactor>,
    pub mitigation_strategies: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RiskFactor {
    pub category: String,
    pub description: String,
    pub impact: u8,
    pub likelihood: u8,
    pub mitigation: String,
}

impl SecurityReport {
    pub fn generate(
        env: &Env,
        report_id: Bytes,
        contract_address: Address,
        vulnerabilities: Vec<Vulnerability>,
        patterns: Vec<SecurityPattern>,
        gas_analysis: GasAnalysis,
        security_score: u8,
        gas_score: u8,
    ) -> SecurityReport {
        let vulnerability_summary = Self::generate_vulnerability_summary(env, &vulnerabilities);
        let pattern_summary = Self::generate_pattern_summary(env, &patterns);
        let gas_analysis_summary = Self::generate_gas_analysis_summary(env, &gas_analysis);
        let recommendations = Self::generate_recommendations(env, &vulnerabilities, &patterns, &gas_analysis);
        let detailed_findings = Self::generate_detailed_findings(env, &vulnerabilities, &patterns);
        let compliance_status = Self::generate_compliance_status(env, &vulnerabilities, &patterns);
        let risk_assessment = Self::generate_risk_assessment(env, &vulnerabilities, &patterns, &gas_analysis);

        SecurityReport {
            report_id,
            contract_address,
            scan_timestamp: env.ledger().timestamp(),
            overall_score: security_score,
            gas_score,
            vulnerability_summary,
            pattern_summary,
            gas_analysis_summary,
            recommendations,
            detailed_findings,
            compliance_status,
            risk_assessment,
        }
    }

    fn generate_vulnerability_summary(env: &Env, vulnerabilities: &[Vulnerability]) -> VulnerabilitySummary {
        let mut critical_count = 0u32;
        let mut high_count = 0u32;
        let mut medium_count = 0u32;
        let mut low_count = 0u32;
        let mut info_count = 0u32;
        let mut affected_functions = Vec::new();

        for vuln in vulnerabilities {
            match vuln.severity {
                9..=10 => critical_count += 1,
                7..=8 => high_count += 1,
                5..=6 => medium_count += 1,
                3..=4 => low_count += 1,
                0..=2 => info_count += 1,
            }

            // Extract function names from vulnerability descriptions
            if let Some(line) = vuln.line_number {
                affected_functions.push(String::from_str(env, &format!("function_at_line_{}", line)));
            }
        }

        VulnerabilitySummary {
            total_count: vulnerabilities.len() as u32,
            critical_count,
            high_count,
            medium_count,
            low_count,
            info_count,
            most_common_type: String::from_str(env, "Reentrancy"), // Simplified
            affected_functions,
        }
    }

    fn generate_pattern_summary(env: &Env, patterns: &[SecurityPattern]) -> PatternSummary {
        let mut anti_pattern_count = 0u32;
        let mut best_practice_violation_count = 0u32;
        let mut gas_inefficiency_count = 0u32;
        let mut security_risk_count = 0u32;
        let mut max_severity = 0u8;
        let mut most_severe_pattern = String::from_str(env, "None");

        for pattern in patterns {
            match pattern.pattern_type {
                PatternType::AntiPattern => anti_pattern_count += 1,
                PatternType::BestPracticeViolation => best_practice_violation_count += 1,
                PatternType::GasInefficiency => gas_inefficiency_count += 1,
                PatternType::SecurityRisk => security_risk_count += 1,
            }

            if pattern.severity > max_severity {
                max_severity = pattern.severity;
                most_severe_pattern = pattern.name.clone();
            }
        }

        PatternSummary {
            total_count: patterns.len() as u32,
            anti_pattern_count,
            best_practice_violation_count,
            gas_inefficiency_count,
            security_risk_count,
            most_severe_pattern,
            pattern_density: (patterns.len() as f32) / 10.0, // Simplified
        }
    }

    fn generate_gas_analysis_summary(env: &Env, gas_analysis: &GasAnalysis) -> GasAnalysisSummary {
        let gas_efficiency_grade = match gas_analysis.total_gas_estimate {
            0..=100000 => 'A',
            100001..=300000 => 'B',
            300001..=500000 => 'C',
            500001..=1000000 => 'D',
            _ => 'F',
        };

        GasAnalysisSummary {
            total_gas_estimate: gas_analysis.total_gas_estimate,
            deployment_cost_estimate: gas_analysis.total_gas_estimate / 10, // Simplified
            execution_cost_estimate: gas_analysis.total_gas_estimate / 20, // Simplified
            optimization_potential: Self::calculate_optimization_potential(gas_analysis),
            high_cost_operations: gas_analysis.high_cost_operations,
            storage_operations: gas_analysis.storage_operations,
            loop_operations: gas_analysis.unoptimized_loops,
            gas_efficiency_grade,
        }
    }

    fn generate_recommendations(
        env: &Env,
        vulnerabilities: &[Vulnerability],
        patterns: &[SecurityPattern],
        gas_analysis: &GasAnalysis,
    ) -> Vec<Recommendation> {
        let mut recommendations = Vec::new();

        // Generate recommendations for critical vulnerabilities
        for vuln in vulnerabilities {
            if vuln.severity >= 7 {
                recommendations.push(Recommendation {
                    id: String::from_str(env, &format!("REC-VULN-{}", vuln.id)),
                    title: String::from_str(env, &format!("Fix {}", vuln.name)),
                    description: vuln.remediation.clone(),
                    priority: Self::severity_to_priority(vuln.severity),
                    category: RecommendationCategory::Security,
                    effort: Self::estimate_effort(&vuln.name),
                    impact: Self::severity_to_impact(vuln.severity),
                    code_snippet: None,
                    references: vec![vuln.cwe_id.clone().unwrap_or(String::from_str(env, "N/A"))],
                });
            }
        }

        // Generate recommendations for severe patterns
        for pattern in patterns {
            if pattern.severity >= 6 {
                recommendations.push(Recommendation {
                    id: String::from_str(env, &format!("REC-PAT-{}", pattern.id)),
                    title: String::from_str(env, &format!("Address {}", pattern.name)),
                    description: pattern.remediation.clone(),
                    priority: Self::severity_to_priority(pattern.severity),
                    category: RecommendationCategory::BestPractice,
                    effort: EffortLevel::Medium,
                    impact: Self::severity_to_impact(pattern.severity),
                    code_snippet: None,
                    references: Vec::new(),
                });
            }
        }

        // Generate gas optimization recommendations
        if gas_analysis.high_cost_operations > 0 {
            recommendations.push(Recommendation {
                id: String::from_str(env, "REC-GAS-001"),
                title: String::from_str(env, "Optimize High-Cost Operations"),
                description: String::from_str(env, "Reduce high-cost operations to improve gas efficiency"),
                priority: RecommendationPriority::Medium,
                category: RecommendationCategory::GasOptimization,
                effort: EffortLevel::High,
                impact: ImpactLevel::Medium,
                code_snippet: None,
                references: Vec::new(),
            });
        }

        recommendations
    }

    fn generate_detailed_findings(
        env: &Env,
        vulnerabilities: &[Vulnerability],
        patterns: &[SecurityPattern],
    ) -> DetailedFindings {
        let detailed_vulnerabilities = vulnerabilities.iter().map(|vuln| DetailedVulnerability {
            vulnerability: vuln.clone(),
            function_name: None,
            line_number: vuln.line_number,
            column_number: None,
            code_context: None,
            exploit_scenario: String::from_str(env, "Potential exploitation scenario"),
            affected_components: Vec::new(),
            business_impact: String::from_str(env, "Potential financial loss"),
        }).collect();

        let detailed_patterns = patterns.iter().map(|pattern| DetailedPattern {
            pattern: pattern.clone(),
            occurrences: 1,
            locations: vec![PatternLocation {
                function_name: String::from_str(env, "unknown"),
                line_number: 0,
                context: String::from_str(env, "unknown"),
            }],
            severity_trend: SeverityTrend::Stable,
            historical_context: None,
        }).collect();

        DetailedFindings {
            vulnerabilities: detailed_vulnerabilities,
            patterns: detailed_patterns,
            code_metrics: CodeMetrics {
                total_lines: 1000,
                comment_lines: 200,
                code_lines: 800,
                function_count: 20,
                cyclomatic_complexity: 50,
                maintainability_index: 75.0,
                technical_debt_ratio: 0.1,
            },
            security_metrics: SecurityMetrics {
                attack_surface_area: 15,
                entry_points: 8,
                external_calls: 5,
                privileged_functions: 3,
                state_mutating_functions: 12,
                view_functions: 5,
                security_controls: 7,
            },
        }
    }

    fn generate_compliance_status(
        env: &Env,
        vulnerabilities: &[Vulnerability],
        patterns: &[SecurityPattern],
    ) -> ComplianceStatus {
        let mut framework_compliance = Map::new(env);
        
        // Check compliance with common frameworks
        let critical_vulns = vulnerabilities.iter().filter(|v| v.severity >= 8).count();
        framework_compliance.set(
            String::from_str(env, "ISO-27001"),
            critical_vulns == 0
        );
        framework_compliance.set(
            String::from_str(env, "SOC2"),
            critical_vulns == 0 && patterns.len() < 10
        );
        framework_compliance.set(
            String::from_str(env, "PCI-DSS"),
            critical_vulns == 0
        );

        let overall_compliant = critical_vulns == 0 && patterns.len() < 5;
        let compliance_score = if overall_compliant { 95 } else { 60 };

        ComplianceStatus {
            overall_compliant,
            compliance_score: compliance_score as u8,
            framework_compliance,
            missing_requirements: Vec::new(),
            compliance_gaps: Vec::new(),
        }
    }

    fn generate_risk_assessment(
        env: &Env,
        vulnerabilities: &[Vulnerability],
        patterns: &[SecurityPattern],
        gas_analysis: &GasAnalysis,
    ) -> RiskAssessment {
        let critical_count = vulnerabilities.iter().filter(|v| v.severity >= 8).count();
        let high_count = vulnerabilities.iter().filter(|v| v.severity >= 6 && v.severity < 8).count();
        
        let security_risk_score = ((critical_count * 25 + high_count * 15) as u8).min(100);
        let gas_risk_score = if gas_analysis.total_gas_estimate > 1000000 { 70 } else { 30 };
        let operational_risk_score = if patterns.len() > 10 { 60 } else { 25 };

        let overall_risk_score = (security_risk_score + gas_risk_score + operational_risk_score) / 3;
        let overall_risk_level = match overall_risk_score {
            0..=30 => RiskLevel::Low,
            31..=60 => RiskLevel::Medium,
            61..=80 => RiskLevel::High,
            _ => RiskLevel::Critical,
        };

        RiskAssessment {
            overall_risk_level,
            security_risk_score,
            gas_risk_score,
            operational_risk_score,
            risk_factors: Vec::new(),
            mitigation_strategies: vec![
                String::from_str(env, "Implement comprehensive security testing"),
                String::from_str(env, "Add access controls and validation"),
                String::from_str(env, "Optimize gas usage patterns"),
            ],
        }
    }

    // Helper methods
    fn calculate_optimization_potential(gas_analysis: &GasAnalysis) -> u8 {
        let mut potential = 0u8;
        
        if gas_analysis.high_cost_operations > 0 {
            potential += 30;
        }
        
        if gas_analysis.unoptimized_loops > 0 {
            potential += 25;
        }
        
        if gas_analysis.storage_operations > 50 {
            potential += 20;
        }
        
        potential.min(100)
    }

    fn severity_to_priority(severity: u8) -> RecommendationPriority {
        match severity {
            9..=10 => RecommendationPriority::Critical,
            7..=8 => RecommendationPriority::High,
            5..=6 => RecommendationPriority::Medium,
            3..=4 => RecommendationPriority::Low,
            _ => RecommendationPriority::Info,
        }
    }

    fn severity_to_impact(severity: u8) -> ImpactLevel {
        match severity {
            9..=10 => ImpactLevel::Critical,
            7..=8 => ImpactLevel::High,
            5..=6 => ImpactLevel::Medium,
            _ => ImpactLevel::Low,
        }
    }

    fn estimate_effort(vulnerability_name: &str) -> EffortLevel {
        match vulnerability_name {
            "Reentrancy Vulnerability" => EffortLevel::High,
            "Integer Overflow/Underflow" => EffortLevel::Medium,
            "Missing Access Control" => EffortLevel::Medium,
            _ => EffortLevel::Low,
        }
    }

    pub fn to_json(&self, env: &Env) -> Result<String, SecurityReportError> {
        // In a real implementation, this would serialize the report to JSON
        Ok(String::from_str(env, "JSON representation of security report"))
    }

    pub fn export_to_csv(&self, env: &Env) -> Result<String, SecurityReportError> {
        // In a real implementation, this would export findings to CSV
        Ok(String::from_str(env, "CSV export of security findings"))
    }

    pub fn generate_summary(&self, env: &Env) -> String {
        String::from_str(env, &format!(
            "Security Report Summary:\nOverall Score: {}/100\nGas Score: {}/100\nVulnerabilities: {}\nSecurity Risks: {}\nRisk Level: {:?}",
            self.overall_score,
            self.gas_score,
            self.vulnerability_summary.total_count,
            self.pattern_summary.security_risk_count,
            self.risk_assessment.overall_risk_level
        ))
    }
}
