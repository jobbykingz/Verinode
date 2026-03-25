pub mod security_scanner;
pub mod vulnerability_detector;
pub mod pattern_matcher;
pub mod security_report;

// Re-export main components for easier access
pub use security_scanner::{
    SecurityScanner, ScanConfig, ScanResult, SecurityScannerError, Vulnerability,
    SecurityPattern, PatternType, GasAnalysis, VulnerabilityStats
};

pub use vulnerability_detector::{
    VulnerabilityDetector, VulnerabilityDetectorError, VulnerabilityDatabase
};

pub use pattern_matcher::{
    PatternMatcher, PatternMatcherError, PatternRegistry
};

pub use security_report::{
    SecurityReport, SecurityReportError, VulnerabilitySummary, PatternSummary,
    GasAnalysisSummary, Recommendation, RecommendationPriority, RecommendationCategory,
    DetailedFindings, ComplianceStatus, RiskAssessment
};
