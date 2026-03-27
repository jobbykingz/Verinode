use crate::security::{
    TimeLock, TimeLockConfig, OperationType,
    EmergencyPauseManager, EmergencyConfig, EmergencyLevel, EmergencyActionType,
    AdvancedAccessControl, AccessControlConfig, Permission,
    SecurityAudit, AuditConfig, AuditEventType, SeverityLevel,
    MultiSigSecurity, MultiSigConfig, TransactionType
};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(test)]
mod advanced_security_tests {
    use super::*;

    fn create_test_time_lock_config() -> TimeLockConfig {
        TimeLockConfig {
            min_delay: std::time::Duration::from_secs(1),
            max_delay: std::time::Duration::from_secs(3600),
            default_delay: std::time::Duration::from_secs(5),
            admin_addresses: vec!["admin1".to_string(), "admin2".to_string()],
            emergency_addresses: vec!["emergency1".to_string()],
        }
    }

    fn create_test_emergency_config() -> EmergencyConfig {
        EmergencyConfig {
            emergency_addresses: vec!["emergency1".to_string()],
            admin_addresses: vec!["admin1".to_string()],
            guardian_addresses: vec!["guardian1".to_string()],
            max_pause_duration: 3600,
            default_pause_duration: 300,
            auto_resume_enabled: false,
            notification_addresses: vec![],
            critical_action_threshold: 2,
        }
    }

    fn create_test_access_control_config() -> AccessControlConfig {
        AccessControlConfig {
            admin_address: "admin1".to_string(),
            default_session_duration: 3600,
            max_session_duration: 24 * 3600,
            require_multi_admin: false,
            audit_access: true,
            ip_whitelist_enabled: false,
            session_timeout_enabled: true,
        }
    }

    fn create_test_audit_config() -> AuditConfig {
        AuditConfig {
            max_entries: 1000,
            retention_period: 7 * 24 * 3600,
            auto_cleanup: true,
            compression_enabled: false,
            encryption_enabled: false,
            backup_enabled: false,
            real_time_monitoring: true,
            alert_thresholds: crate::security::AlertThresholds {
                critical_events_per_hour: 5,
                failed_attempts_per_hour: 10,
                unusual_activity_threshold: 2.0,
                concurrent_sessions_per_user: 3,
            },
        }
    }

    fn create_test_multisig_config() -> MultiSigConfig {
        let mut signers = HashMap::new();
        
        signers.insert("signer1".to_string(), crate::security::Signer {
            address: "signer1".to_string(),
            weight: 1,
            is_active: true,
            added_at: 0,
            added_by: "creator".to_string(),
            last_signed: None,
            metadata: HashMap::new(),
        });

        signers.insert("signer2".to_string(), crate::security::Signer {
            address: "signer2".to_string(),
            weight: 1,
            is_active: true,
            added_at: 0,
            added_by: "creator".to_string(),
            last_signed: None,
            metadata: HashMap::new(),
        });

        MultiSigConfig {
            signers,
            threshold: 2,
            nonce: 0,
            transaction_timeout: 7 * 24 * 3600,
            max_signers: 10,
            require_all_for_emergency: true,
            auto_cleanup: true,
            max_transaction_value: None,
        }
    }

    #[test]
    fn test_time_lock_operations() {
        let mut timelock = TimeLock::new(create_test_time_lock_config());

        // Test creating time-locked operation
        let result = timelock.create_time_lock(
            "op1".to_string(),
            OperationType::Transfer,
            "target".to_string(),
            vec![1, 2, 3],
            "admin1",
            Some(std::time::Duration::from_secs(2)),
            None,
            1,
        );
        assert!(result.is_ok());

        // Test operation is locked initially
        let result = timelock.execute_operation("op1", "admin1");
        assert!(result.is_err());

        // Test unauthorized access
        let result = timelock.create_time_lock(
            "op2".to_string(),
            OperationType::Transfer,
            "target".to_string(),
            vec![1, 2, 3],
            "unauthorized",
            None,
            None,
            1,
        );
        assert!(result.is_err());

        // Test getting stats
        let stats = timelock.get_stats();
        assert_eq!(stats.pending_operations, 1);
    }

    #[test]
    fn test_emergency_pause_operations() {
        let mut emergency_pause = EmergencyPauseManager::new(create_test_emergency_config());

        // Test emergency pause
        let result = emergency_pause.emergency_pause(
            "Test emergency".to_string(),
            EmergencyLevel::High,
            None,
            "emergency1",
        );
        assert!(result.is_ok());
        assert!(emergency_pause.is_paused());

        // Test unauthorized pause
        let result = emergency_pause.emergency_pause(
            "Unauthorized pause".to_string(),
            EmergencyLevel::High,
            None,
            "unauthorized",
        );
        assert!(result.is_err());

        // Test resume
        let result = emergency_pause.resume("admin1");
        assert!(result.is_ok());
        assert!(!emergency_pause.is_paused());

        // Test creating emergency action
        let result = emergency_pause.create_emergency_action(
            "action1".to_string(),
            EmergencyActionType::Transfer,
            "target".to_string(),
            vec![1, 2, 3],
            "emergency1",
            false,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_access_control_operations() {
        let mut access_control = AdvancedAccessControl::new(create_test_access_control_config());

        // Test creating user
        let result = access_control.create_user(
            "user1".to_string(),
            "0x123".to_string(),
            "admin1",
        );
        assert!(result.is_ok());

        // Test assigning role
        let result = access_control.assign_role_to_user("user1", "user", "admin1");
        assert!(result.is_ok());

        // Test permission check
        let has_permission = access_control.has_permission("user1", &Permission::Transfer).unwrap();
        assert!(has_permission);

        // Test creating session
        let result = access_control.create_session("user1", Some("127.0.0.1".to_string()), None);
        assert!(result.is_ok());

        // Test access check
        let session_token = result.unwrap();
        let has_access = access_control.check_access(&session_token, &Permission::Transfer, "resource1", Some("127.0.0.1".to_string())).unwrap();
        assert!(has_access);
    }

    #[test]
    fn test_security_audit_operations() {
        let mut audit = SecurityAudit::new(create_test_audit_config());

        // Test logging event
        let result = audit.log_event(
            AuditEventType::UserAction,
            SeverityLevel::Medium,
            "test action".to_string(),
            Some("user1".to_string()),
            Some("resource1".to_string()),
            HashMap::new(),
            true,
            None,
        );
        assert!(result.is_ok());

        // Test logging contract interaction
        let result = audit.log_contract_interaction(
            "transfer".to_string(),
            "0x123".to_string(),
            Some("user1".to_string()),
            Some("0xabc".to_string()),
            Some(12345),
            true,
            HashMap::new(),
        );
        assert!(result.is_ok());

        // Test logging security event
        let result = audit.log_security_event(
            "security breach".to_string(),
            SeverityLevel::Critical,
            Some("attacker".to_string()),
            Some("192.168.1.1".to_string()),
            HashMap::new(),
        );
        assert!(result.is_ok());

        // Test generating report
        let filter = crate::security::AuditFilter {
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
        assert_eq!(report.unwrap().total_entries, 3);

        // Test getting metrics
        let metrics = audit.get_metrics();
        assert_eq!(metrics.total_audit_entries, 3);
    }

    #[test]
    fn test_multisig_security_operations() {
        let mut multisig = MultiSigSecurity::new(create_test_multisig_config());

        // Test creating transaction
        let result = multisig.create_transaction(
            "0x123".to_string(),
            1000,
            vec![1, 2, 3],
            TransactionType::Transfer,
            None,
            None,
            HashMap::new(),
            "signer1",
        );
        assert!(result.is_ok());

        let tx_id = result.unwrap();

        // Test signing transaction
        let result = multisig.sign_transaction(
            &tx_id,
            "signer1",
            vec![1, 2, 3, 4],
            vec![5, 6, 7, 8],
        );
        assert!(result.is_ok());

        // Test insufficient signatures
        let result = multisig.execute_transaction(&tx_id, "signer1");
        assert!(result.is_err());

        // Test second signature
        let result = multisig.sign_transaction(
            &tx_id,
            "signer2",
            vec![1, 2, 3, 4],
            vec![5, 6, 7, 8],
        );
        assert!(result.is_ok());

        // Test execution with sufficient signatures
        let result = multisig.execute_transaction(&tx_id, "signer1");
        assert!(result.is_ok());

        // Test getting stats
        let stats = multisig.get_stats();
        assert_eq!(stats.executed_transactions, 1);
    }

    #[test]
    fn test_integrated_security_workflow() {
        // Initialize all security components
        let mut timelock = TimeLock::new(create_test_time_lock_config());
        let mut emergency_pause = EmergencyPauseManager::new(create_test_emergency_config());
        let mut access_control = AdvancedAccessControl::new(create_test_access_control_config());
        let mut audit = SecurityAudit::new(create_test_audit_config());
        let mut multisig = MultiSigSecurity::new(create_test_multisig_config());

        // Step 1: Setup user and permissions
        access_control.create_user("user1".to_string(), "0x123".to_string(), "admin1").unwrap();
        access_control.assign_role_to_user("user1", "user", "admin1").unwrap();
        let session_token = access_control.create_session("user1", None, None).unwrap();

        // Step 2: Log security events
        audit.log_event(
            AuditEventType::UserAction,
            SeverityLevel::Low,
            "User login".to_string(),
            Some("user1".to_string()),
            None,
            HashMap::new(),
            true,
            None,
        ).unwrap();

        // Step 3: Create time-locked operation
        let op_id = timelock.create_time_lock(
            "critical_op".to_string(),
            OperationType::ContractUpgrade,
            "0x456".to_string(),
            vec![9, 8, 7],
            "admin1",
            Some(std::time::Duration::from_secs(1)),
            None,
            10,
        ).unwrap();

        // Step 4: Create emergency action
        emergency_pause.create_emergency_action(
            "emergency_action".to_string(),
            EmergencyActionType::ContractUpgrade,
            "0x456".to_string(),
            vec![6, 5, 4],
            "emergency1",
            true,
        ).unwrap();

        // Step 5: Create multi-sig transaction
        let tx_id = multisig.create_transaction(
            "0x789".to_string(),
            500,
            vec![3, 2, 1],
            TransactionType::EmergencyAction,
            None,
            None,
            HashMap::new(),
            "signer1",
        ).unwrap();

        // Step 6: Log all security activities
        audit.log_event(
            AuditEventType::SecurityEvent,
            SeverityLevel::High,
            "Critical security workflow initiated".to_string(),
            Some("admin1".to_string()),
            None,
            HashMap::from([
                ("operation_id".to_string(), op_id.clone()),
                ("transaction_id".to_string(), tx_id.clone()),
            ]),
            true,
            None,
        ).unwrap();

        // Step 7: Verify all components are working
        assert!(!timelock.get_operations_by_type("contract_upgrade").is_empty());
        assert!(!emergency_pause.get_pending_actions().is_empty());
        assert!(!multisig.get_pending_transactions().is_empty());
        assert!(audit.get_metrics().total_audit_entries >= 2);

        // Step 8: Test access control integration
        let has_permission = access_control.check_access(&session_token, &Permission::ContractExecute, "0x456", None).unwrap();
        assert!(has_permission);

        // Step 9: Generate comprehensive report
        let filter = crate::security::AuditFilter {
            start_time: None,
            end_time: None,
            event_types: Some(vec![AuditEventType::SecurityEvent]),
            severity_levels: Some(vec![SeverityLevel::High]),
            user_ids: Some(vec!["admin1".to_string()]),
            resources: None,
            success_only: None,
            ip_addresses: None,
            contract_addresses: None,
            limit: None,
            offset: None,
        };

        let report = audit.generate_report(filter, "admin1".to_string()).unwrap();
        assert!(report.total_entries >= 1);
        assert!(!report.recommendations.is_empty());
    }

    #[test]
    fn test_security_event_monitoring() {
        let mut audit = SecurityAudit::new(create_test_audit_config());

        // Simulate multiple security events
        for i in 0..10 {
            let severity = if i % 3 == 0 { SeverityLevel::Critical } else { SeverityLevel::Medium };
            
            audit.log_event(
                AuditEventType::SecurityEvent,
                severity,
                format!("Security event {}", i),
                Some("user1".to_string()),
                Some(format!("resource{}", i)),
                HashMap::new(),
                i % 4 != 0, // Some failures
                if i % 4 == 0 { Some("Error occurred".to_string()) } else { None },
            ).unwrap();
        }

        // Test metrics calculation
        let metrics = audit.get_metrics();
        assert_eq!(metrics.total_audit_entries, 10);
        assert!(metrics.critical_events_24h > 0);
        assert!(metrics.failed_attempts_24h > 0);

        // Test report generation with filters
        let filter = crate::security::AuditFilter {
            start_time: None,
            end_time: None,
            event_types: Some(vec![AuditEventType::SecurityEvent]),
            severity_levels: Some(vec![SeverityLevel::Critical]),
            user_ids: None,
            resources: None,
            success_only: None,
            ip_addresses: None,
            contract_addresses: None,
            limit: 5,
            offset: 0,
        };

        let report = audit.generate_report(filter, "admin1".to_string()).unwrap();
        assert!(report.total_entries <= 5);
        assert!(report.summary.critical_events > 0);
    }

    #[test]
    fn test_error_handling_and_edge_cases() {
        let mut timelock = TimeLock::new(create_test_time_lock_config());
        let mut emergency_pause = EmergencyPauseManager::new(create_test_emergency_config());
        let mut access_control = AdvancedAccessControl::new(create_test_access_control_config());

        // Test duplicate operations
        timelock.create_time_lock(
            "duplicate".to_string(),
            OperationType::Transfer,
            "target".to_string(),
            vec![1, 2, 3],
            "admin1",
            None,
            None,
            1,
        ).unwrap();

        let result = timelock.create_time_lock(
            "duplicate".to_string(),
            OperationType::Transfer,
            "target".to_string(),
            vec![1, 2, 3],
            "admin1",
            None,
            None,
            1,
        );
        assert!(result.is_err());

        // Test double pause
        emergency_pause.emergency_pause(
            "First pause".to_string(),
            EmergencyLevel::Medium,
            None,
            "emergency1",
        ).unwrap();

        let result = emergency_pause.emergency_pause(
            "Second pause".to_string(),
            EmergencyLevel::Medium,
            None,
            "emergency1",
        );
        assert!(result.is_err());

        // Test invalid user operations
        let result = access_control.create_user("invalid".to_string(), "0x123".to_string(), "unauthorized");
        assert!(result.is_err());

        let result = access_control.has_permission("nonexistent", &Permission::Transfer);
        assert!(result.is_err());

        // Test session validation
        let result = access_control.validate_session("invalid_session");
        assert!(result.is_err());
    }

    #[test]
    fn test_performance_and_scalability() {
        let mut audit = SecurityAudit::new(create_test_audit_config());
        let start_time = SystemTime::now();

        // Create large number of audit entries
        for i in 0..1000 {
            audit.log_event(
                AuditEventType::UserAction,
                SeverityLevel::Low,
                format!("Performance test {}", i),
                Some(format!("user{}", i % 10)),
                Some(format!("resource{}", i % 100)),
                HashMap::new(),
                true,
                None,
            ).unwrap();
        }

        let duration = SystemTime::now().duration_since(start_time).unwrap();
        println!("Created 1000 audit entries in {:?}", duration);

        // Test query performance
        let start_query = SystemTime::now();
        let filter = crate::security::AuditFilter {
            start_time: None,
            end_time: None,
            event_types: Some(vec![AuditEventType::UserAction]),
            severity_levels: None,
            user_ids: None,
            resources: None,
            success_only: None,
            ip_addresses: None,
            contract_addresses: None,
            limit: 100,
            offset: 0,
        };

        let results = audit.query_audit_log(&filter);
        let query_duration = SystemTime::now().duration_since(start_query).unwrap();
        println!("Queried audit log in {:?}", duration);

        assert_eq!(results.len(), 100);
        assert!(query_duration.as_millis() < 100); // Should be fast
    }
}
