use std::collections::{HashMap, VecDeque};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SecurityAuditError {
    #[error("Audit entry not found")]
    EntryNotFound,
    #[error("Invalid audit data")]
    InvalidData,
    #[error("Unauthorized access")]
    Unauthorized,
    #[error("Audit log is full")]
    AuditLogFull,
    #[error("Report generation failed")]
    ReportGenerationFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditEventType {
    UserAction,
    SystemEvent,
    SecurityEvent,
    ContractInteraction,
    AccessControl,
    EmergencyAction,
    ConfigurationChange,
    Error,
    Custom(String),
}

impl AuditEventType {
    pub fn as_str(&self) -> &str {
        match self {
            AuditEventType::UserAction => "user_action",
            AuditEventType::SystemEvent => "system_event",
            AuditEventType::SecurityEvent => "security_event",
            AuditEventType::ContractInteraction => "contract_interaction",
            AuditEventType::AccessControl => "access_control",
            AuditEventType::EmergencyAction => "emergency_action",
            AuditEventType::ConfigurationChange => "configuration_change",
            AuditEventType::Error => "error",
            AuditEventType::Custom(name) => name,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SeverityLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl SeverityLevel {
    pub fn as_u8(&self) -> u8 {
        match self {
            SeverityLevel::Low => 1,
            SeverityLevel::Medium => 2,
            SeverityLevel::High => 3,
            SeverityLevel::Critical => 4,
        }
    }

    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            1 => Some(SeverityLevel::Low),
            2 => Some(SeverityLevel::Medium),
            3 => Some(SeverityLevel::High),
            4 => Some(SeverityLevel::Critical),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub timestamp: u64,
    pub event_type: AuditEventType,
    pub severity: SeverityLevel,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub action: String,
    pub resource: Option<String>,
    pub details: HashMap<String, String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub contract_address: Option<String>,
    pub transaction_hash: Option<String>,
    pub block_number: Option<u64>,
    pub success: bool,
    pub error_message: Option<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditFilter {
    pub start_time: Option<u64>,
    pub end_time: Option<u64>,
    pub event_types: Option<Vec<AuditEventType>>,
    pub severity_levels: Option<Vec<SeverityLevel>>,
    pub user_ids: Option<Vec<String>>,
    pub resources: Option<Vec<String>>,
    pub success_only: Option<bool>,
    pub ip_addresses: Option<Vec<String>>,
    pub contract_addresses: Option<Vec<String>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditReport {
    pub id: String,
    pub generated_at: u64,
    pub generated_by: String,
    pub filter: AuditFilter,
    pub total_entries: usize,
    pub entries: Vec<AuditEntry>,
    pub summary: AuditSummary,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditSummary {
    pub total_events: usize,
    pub events_by_type: HashMap<String, usize>,
    pub events_by_severity: HashMap<String, usize>,
    pub events_by_user: HashMap<String, usize>,
    pub success_rate: f64,
    pub error_rate: f64,
    pub unique_users: usize,
    pub unique_resources: usize,
    pub time_span: (u64, u64),
    pub critical_events: usize,
    pub high_risk_events: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityMetrics {
    pub total_audit_entries: usize,
    pub entries_last_24h: usize,
    pub entries_last_7d: usize,
    pub entries_last_30d: usize,
    pub critical_events_24h: usize,
    pub failed_attempts_24h: usize,
    pub unique_users_24h: usize,
    pub most_active_users: Vec<(String, usize)>,
    pub most_accessed_resources: Vec<(String, usize)>,
    pub security_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditConfig {
    pub max_entries: usize,
    pub retention_period: u64, // in seconds
    pub auto_cleanup: bool,
    pub compression_enabled: bool,
    pub encryption_enabled: bool,
    pub backup_enabled: bool,
    pub real_time_monitoring: bool,
    pub alert_thresholds: AlertThresholds,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertThresholds {
    pub critical_events_per_hour: u32,
    pub failed_attempts_per_hour: u32,
    pub unusual_activity_threshold: f64,
    pub concurrent_sessions_per_user: u32,
}

impl Default for AuditConfig {
    fn default() -> Self {
        Self {
            max_entries: 100000,
            retention_period: 90 * 24 * 3600, // 90 days
            auto_cleanup: true,
            compression_enabled: true,
            encryption_enabled: true,
            backup_enabled: true,
            real_time_monitoring: true,
            alert_thresholds: AlertThresholds {
                critical_events_per_hour: 5,
                failed_attempts_per_hour: 10,
                unusual_activity_threshold: 2.0,
                concurrent_sessions_per_user: 3,
            },
        }
    }
}

#[derive(Debug)]
pub struct SecurityAudit {
    audit_log: VecDeque<AuditEntry>,
    config: AuditConfig,
    reports: HashMap<String, AuditReport>,
    metrics: SecurityMetrics,
    archived_entries: Vec<AuditEntry>,
}

impl SecurityAudit {
    pub fn new(config: AuditConfig) -> Self {
        Self {
            audit_log: VecDeque::with_capacity(config.max_entries),
            config,
            reports: HashMap::new(),
            metrics: SecurityMetrics {
                total_audit_entries: 0,
                entries_last_24h: 0,
                entries_last_7d: 0,
                entries_last_30d: 0,
                critical_events_24h: 0,
                failed_attempts_24h: 0,
                unique_users_24h: 0,
                most_active_users: Vec::new(),
                most_accessed_resources: Vec::new(),
                security_score: 100.0,
            },
            archived_entries: Vec::new(),
        }
    }

    pub fn log_event(
        &mut self,
        event_type: AuditEventType,
        severity: SeverityLevel,
        action: String,
        user_id: Option<String>,
        resource: Option<String>,
        details: HashMap<String, String>,
        success: bool,
        error_message: Option<String>,
    ) -> Result<String, SecurityAuditError> {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let entry_id = format!("audit_{}_{}", current_time, self.audit_log.len());

        let entry = AuditEntry {
            id: entry_id.clone(),
            timestamp: current_time,
            event_type,
            severity: severity.clone(),
            user_id: user_id.clone(),
            session_id: None,
            action,
            resource: resource.clone(),
            details,
            ip_address: None,
            user_agent: None,
            contract_address: None,
            transaction_hash: None,
            block_number: None,
            success,
            error_message,
            metadata: HashMap::new(),
        };

        // Check if audit log is full
        if self.audit_log.len() >= self.config.max_entries {
            if self.config.auto_cleanup {
                self.cleanup_old_entries()?;
            } else {
                return Err(SecurityAuditError::AuditLogFull);
            }
        }

        self.audit_log.push_back(entry.clone());
        self.metrics.total_audit_entries += 1;

        // Update metrics
        self.update_metrics(&entry);

        // Check for alerts
        if self.config.real_time_monitoring {
            self.check_alerts(&entry);
        }

        Ok(entry_id)
    }

    pub fn log_contract_interaction(
        &mut self,
        action: String,
        contract_address: String,
        user_id: Option<String>,
        transaction_hash: Option<String>,
        block_number: Option<u64>,
        success: bool,
        details: HashMap<String, String>,
    ) -> Result<String, SecurityAuditError> {
        let severity = if success {
            SeverityLevel::Low
        } else {
            SeverityLevel::High
        };

        let mut entry_details = details;
        entry_details.insert("contract_address".to_string(), contract_address.clone());
        
        if let Some(tx_hash) = &transaction_hash {
            entry_details.insert("transaction_hash".to_string(), tx_hash.clone());
        }

        let entry_id = self.log_event(
            AuditEventType::ContractInteraction,
            severity,
            action,
            user_id,
            Some(contract_address),
            entry_details,
            success,
            None,
        )?;

        // Update contract-specific fields
        if let Some(entry) = self.audit_log.back_mut() {
            entry.contract_address = Some(contract_address);
            entry.transaction_hash = transaction_hash;
            entry.block_number = block_number;
        }

        Ok(entry_id)
    }

    pub fn log_security_event(
        &mut self,
        action: String,
        severity: SeverityLevel,
        user_id: Option<String>,
        ip_address: Option<String>,
        details: HashMap<String, String>,
    ) -> Result<String, SecurityAuditError> {
        let entry_id = self.log_event(
            AuditEventType::SecurityEvent,
            severity,
            action,
            user_id,
            None,
            details,
            true,
            None,
        )?;

        // Update security-specific fields
        if let Some(entry) = self.audit_log.back_mut() {
            entry.ip_address = ip_address;
        }

        Ok(entry_id)
    }

    pub fn query_audit_log(&self, filter: &AuditFilter) -> Vec<&AuditEntry> {
        let mut entries: Vec<&AuditEntry> = self.audit_log.iter().collect();

        // Apply filters
        if let Some(start_time) = filter.start_time {
            entries.retain(|entry| entry.timestamp >= start_time);
        }

        if let Some(end_time) = filter.end_time {
            entries.retain(|entry| entry.timestamp <= end_time);
        }

        if let Some(event_types) = &filter.event_types {
            entries.retain(|entry| event_types.contains(&entry.event_type));
        }

        if let Some(severity_levels) = &filter.severity_levels {
            entries.retain(|entry| severity_levels.contains(&entry.severity));
        }

        if let Some(user_ids) = &filter.user_ids {
            entries.retain(|entry| {
                if let Some(user_id) = &entry.user_id {
                    user_ids.contains(user_id)
                } else {
                    false
                }
            });
        }

        if let Some(resources) = &filter.resources {
            entries.retain(|entry| {
                if let Some(resource) = &entry.resource {
                    resources.contains(resource)
                } else {
                    false
                }
            });
        }

        if let Some(success_only) = filter.success_only {
            entries.retain(|entry| entry.success == success_only);
        }

        if let Some(ip_addresses) = &filter.ip_addresses {
            entries.retain(|entry| {
                if let Some(ip) = &entry.ip_address {
                    ip_addresses.contains(ip)
                } else {
                    false
                }
            });
        }

        if let Some(contract_addresses) = &filter.contract_addresses {
            entries.retain(|entry| {
                if let Some(contract) = &entry.contract_address {
                    contract_addresses.contains(contract)
                } else {
                    false
                }
            });
        }

        // Sort by timestamp (newest first)
        entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        // Apply pagination
        let offset = filter.offset.unwrap_or(0);
        let limit = filter.limit.unwrap_or(entries.len());

        entries.into_iter().skip(offset).take(limit).collect()
    }

    pub fn generate_report(
        &mut self,
        filter: AuditFilter,
        generated_by: String,
    ) -> Result<AuditReport, SecurityAuditError> {
        let entries = self.query_audit_log(&filter);
        let total_entries = entries.len();

        let summary = self.generate_summary(&entries);
        let recommendations = self.generate_recommendations(&summary);

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let report_id = format!("report_{}_{}", current_time, self.reports.len());

        let report = AuditReport {
            id: report_id.clone(),
            generated_at: current_time,
            generated_by,
            filter: filter.clone(),
            total_entries,
            entries: entries.into_iter().cloned().collect(),
            summary,
            recommendations,
        };

        self.reports.insert(report_id.clone(), report.clone());
        Ok(report)
    }

    fn generate_summary(&self, entries: &[&AuditEntry]) -> AuditSummary {
        let mut events_by_type = HashMap::new();
        let mut events_by_severity = HashMap::new();
        let mut events_by_user = HashMap::new();
        let mut success_count = 0;
        let mut critical_events = 0;
        let mut high_risk_events = 0;
        let mut unique_users = std::collections::HashSet::new();
        let mut unique_resources = std::collections::HashSet::new();
        let mut min_time = u64::MAX;
        let mut max_time = 0;

        for entry in entries {
            // Count by type
            *events_by_type.entry(entry.event_type.as_str().to_string()).or_insert(0) += 1;

            // Count by severity
            *events_by_severity.entry(format!("{:?}", entry.severity)).or_insert(0) += 1;

            // Count by user
            if let Some(user_id) = &entry.user_id {
                *events_by_user.entry(user_id.clone()).or_insert(0) += 1;
                unique_users.insert(user_id.clone());
            }

            // Count success/failure
            if entry.success {
                success_count += 1;
            }

            // Count critical and high-risk events
            match entry.severity {
                SeverityLevel::Critical => critical_events += 1,
                SeverityLevel::High => high_risk_events += 1,
                _ => {}
            }

            // Track unique resources
            if let Some(resource) = &entry.resource {
                unique_resources.insert(resource.clone());
            }

            // Track time span
            min_time = min_time.min(entry.timestamp);
            max_time = max_time.max(entry.timestamp);
        }

        let total_events = entries.len();
        let success_rate = if total_events > 0 {
            success_count as f64 / total_events as f64
        } else {
            0.0
        };

        let error_rate = 1.0 - success_rate;

        AuditSummary {
            total_events,
            events_by_type,
            events_by_severity,
            events_by_user,
            success_rate,
            error_rate,
            unique_users: unique_users.len(),
            unique_resources: unique_resources.len(),
            time_span: (min_time, max_time),
            critical_events,
            high_risk_events,
        }
    }

    fn generate_recommendations(&self, summary: &AuditSummary) -> Vec<String> {
        let mut recommendations = Vec::new();

        if summary.critical_events > 0 {
            recommendations.push("Investigate critical security events immediately".to_string());
        }

        if summary.error_rate > 0.1 {
            recommendations.push("High error rate detected - review system stability".to_string());
        }

        if summary.high_risk_events > summary.total_events / 10 {
            recommendations.push("Consider implementing additional security measures".to_string());
        }

        if summary.success_rate < 0.95 {
            recommendations.push("System reliability below optimal levels".to_string());
        }

        recommendations
    }

    fn update_metrics(&mut self, entry: &AuditEntry) {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let one_day_ago = current_time - 24 * 3600;
        let seven_days_ago = current_time - 7 * 24 * 3600;
        let thirty_days_ago = current_time - 30 * 24 * 3600;

        // Update time-based metrics
        if entry.timestamp >= one_day_ago {
            self.metrics.entries_last_24h += 1;
            
            if entry.severity == SeverityLevel::Critical {
                self.metrics.critical_events_24h += 1;
            }
            
            if !entry.success {
                self.metrics.failed_attempts_24h += 1;
            }
        }

        if entry.timestamp >= seven_days_ago {
            self.metrics.entries_last_7d += 1;
        }

        if entry.timestamp >= thirty_days_ago {
            self.metrics.entries_last_30d += 1;
        }

        // Update security score
        self.calculate_security_score();
    }

    fn calculate_security_score(&mut self) {
        let total_recent = self.metrics.entries_last_24h;
        
        if total_recent == 0 {
            self.metrics.security_score = 100.0;
            return;
        }

        let critical_ratio = self.metrics.critical_events_24h as f64 / total_recent as f64;
        let failure_ratio = self.metrics.failed_attempts_24h as f64 / total_recent as f64;

        // Base score starts at 100
        let mut score = 100.0;

        // Deduct points for critical events
        score -= critical_ratio * 50.0;

        // Deduct points for failures
        score -= failure_ratio * 30.0;

        // Ensure score is within bounds
        self.metrics.security_score = score.max(0.0).min(100.0);
    }

    fn check_alerts(&self, entry: &AuditEntry) {
        // This would typically trigger alerts through a notification system
        // For now, we'll just log that an alert would be triggered
        if entry.severity == SeverityLevel::Critical {
            // Trigger critical alert
        }

        // Check for unusual patterns
        // This would involve more sophisticated analysis
    }

    fn cleanup_old_entries(&mut self) -> Result<(), SecurityAuditError> {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let cutoff_time = current_time - self.config.retention_period;

        // Move old entries to archive
        while let Some(entry) = self.audit_log.front() {
            if entry.timestamp < cutoff_time {
                if let Some(entry) = self.audit_log.pop_front() {
                    self.archived_entries.push(entry);
                }
            } else {
                break;
            }
        }

        Ok(())
    }

    pub fn get_metrics(&self) -> &SecurityMetrics {
        &self.metrics
    }

    pub fn get_report(&self, report_id: &str) -> Option<&AuditReport> {
        self.reports.get(report_id)
    }

    pub fn get_all_reports(&self) -> Vec<&AuditReport> {
        self.reports.values().collect()
    }

    pub fn get_entry(&self, entry_id: &str) -> Option<&AuditEntry> {
        self.audit_log.iter().find(|entry| entry.id == entry_id)
    }

    pub fn export_audit_log(&self, filter: &AuditFilter, format: ExportFormat) -> Result<String, SecurityAuditError> {
        let entries = self.query_audit_log(filter);
        
        match format {
            ExportFormat::JSON => {
                serde_json::to_string_pretty(&entries)
                    .map_err(|_| SecurityAuditError::ReportGenerationFailed)
            }
            ExportFormat::CSV => {
                let mut csv = String::new();
                csv.push_str("id,timestamp,event_type,severity,user_id,action,resource,success\n");
                
                for entry in entries {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{},{},{}\n",
                        entry.id,
                        entry.timestamp,
                        entry.event_type.as_str(),
                        format!("{:?}", entry.severity),
                        entry.user_id.as_deref().unwrap_or(""),
                        entry.action,
                        entry.resource.as_deref().unwrap_or(""),
                        entry.success
                    ));
                }
                
                Ok(csv)
            }
        }
    }

    pub fn update_config(&mut self, new_config: AuditConfig) -> Result<(), SecurityAuditError> {
        // Validate new config
        if new_config.max_entries == 0 {
            return Err(SecurityAuditError::InvalidData);
        }

        self.config = new_config;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    JSON,
    CSV,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> AuditConfig {
        AuditConfig {
            max_entries: 1000,
            retention_period: 7 * 24 * 3600,
            auto_cleanup: true,
            compression_enabled: false,
            encryption_enabled: false,
            backup_enabled: false,
            real_time_monitoring: true,
            alert_thresholds: AlertThresholds {
                critical_events_per_hour: 5,
                failed_attempts_per_hour: 10,
                unusual_activity_threshold: 2.0,
                concurrent_sessions_per_user: 3,
            },
        }
    }

    #[test]
    fn test_log_event() {
        let mut audit = SecurityAudit::new(create_test_config());
        
        let result = audit.log_event(
            AuditEventType::UserAction,
            SeverityLevel::Low,
            "test_action".to_string(),
            Some("user1".to_string()),
            Some("resource1".to_string()),
            HashMap::new(),
            true,
            None,
        );

        assert!(result.is_ok());
        assert_eq!(audit.audit_log.len(), 1);
    }

    #[test]
    fn test_query_audit_log() {
        let mut audit = SecurityAudit::new(create_test_config());
        
        audit.log_event(
            AuditEventType::UserAction,
            SeverityLevel::Low,
            "test_action".to_string(),
            Some("user1".to_string()),
            Some("resource1".to_string()),
            HashMap::new(),
            true,
            None,
        ).unwrap();

        let filter = AuditFilter {
            start_time: None,
            end_time: None,
            event_types: Some(vec![AuditEventType::UserAction]),
            severity_levels: None,
            user_ids: Some(vec!["user1".to_string()]),
            resources: None,
            success_only: None,
            ip_addresses: None,
            contract_addresses: None,
            limit: None,
            offset: None,
        };

        let results = audit.query_audit_log(&filter);
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_generate_report() {
        let mut audit = SecurityAudit::new(create_test_config());
        
        audit.log_event(
            AuditEventType::SecurityEvent,
            SeverityLevel::Critical,
            "security_breach".to_string(),
            Some("attacker".to_string()),
            None,
            HashMap::new(),
            false,
            Some("Unauthorized access".to_string()),
        ).unwrap();

        let filter = AuditFilter {
            start_time: None,
            end_time: None,
            event_types: None,
            severity_levels: None,
            user_ids: None,
            resources: None,
            success_only: None,
            ip_addresses: None,
            contract_addresses: None,
            limit: None,
            offset: None,
        };

        let report = audit.generate_report(filter, "admin1".to_string());
        assert!(report.is_ok());
        
        let report = report.unwrap();
        assert_eq!(report.total_entries, 1);
        assert!(report.recommendations.len() > 0);
    }
}
