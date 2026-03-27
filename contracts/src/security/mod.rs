pub mod security_scanner;
pub mod vulnerability_detector;
pub mod pattern_matcher;
pub mod security_report;

// Advanced Security Features
pub mod time_lock;
pub mod emergency_pause;
pub mod advanced_access_control;
pub mod security_audit;
pub mod multi_sig_security;

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

// Re-export advanced security components
pub use time_lock::{
    TimeLock, TimeLockConfig, TimeLockOperation, TimeLockError, TimeLockStats,
    OperationType
};

pub use emergency_pause::{
    EmergencyPauseManager, EmergencyConfig, EmergencyPause, EmergencyAction,
    EmergencyActionType, EmergencyLevel, EmergencyStats, EmergencyError
};

pub use advanced_access_control::{
    AdvancedAccessControl, AccessControlConfig, User, Role, UserSession,
    AccessPolicy, Permission, AccessControlError, AccessAuditEntry
};

pub use security_audit::{
    SecurityAudit, AuditConfig, AuditEntry, AuditReport, AuditFilter,
    AuditSummary, SecurityMetrics, ExportFormat, SecurityAuditError,
    AuditEventType, SeverityLevel
};

pub use multi_sig_security::{
    MultiSigSecurity, MultiSigConfig, MultiSigTransaction, Signature,
    Signer, TransactionType, MultiSigError, MultiSigStats
};
