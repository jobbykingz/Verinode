const ComplianceService = require('../services/complianceService');
const AuditLogger = require('./auditLogger');
const RegulatoryComplianceChecks = require('./regulatoryChecks');

class AutomatedComplianceMonitoring {
  constructor() {
    this.monitors = new Map();
    this.alerts = [];
    this.regulatoryChecks = new RegulatoryComplianceChecks();
  }

  /**
   * Start monitoring for specific compliance areas
   */
  startMonitoring(monitorConfig) {
    const {
      monitorId,
      type,
      interval,
      rules,
      severity = 'MEDIUM'
    } = monitorConfig;

    // Clear existing monitor if it exists
    if (this.monitors.has(monitorId)) {
      this.stopMonitoring(monitorId);
    }

    const monitor = {
      id: monitorId,
      type,
      interval,
      rules,
      severity,
      active: true,
      lastCheck: null,
      nextCheck: new Date(Date.now() + interval),
      violationCount: 0,
      alertThreshold: rules.alertThreshold || 1
    };

    // Start the monitoring interval
    monitor.timer = setInterval(() => {
      this.runMonitorCheck(monitor);
    }, interval);

    this.monitors.set(monitorId, monitor);
    return monitorId;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (monitor && monitor.timer) {
      clearInterval(monitor.timer);
      this.monitors.delete(monitorId);
      return true;
    }
    return false;
  }

  /**
   * Run compliance check for a monitor
   */
  async runMonitorCheck(monitor) {
    try {
      monitor.lastCheck = new Date();
      
      let violations = [];
      
      switch (monitor.type) {
        case 'ACCESS_PATTERNS':
          violations = await this.checkAccessPatterns(monitor.rules);
          break;
        case 'DATA_RETENTION':
          violations = await this.checkDataRetention(monitor.rules);
          break;
        case 'PRIVACY_CONTROLS':
          violations = await this.checkPrivacyControls(monitor.rules);
          break;
        case 'ENCRYPTION_COMPLIANCE':
          violations = await this.checkEncryptionCompliance(monitor.rules);
          break;
        case 'CONSENT_MANAGEMENT':
          violations = await this.checkConsentManagement(monitor.rules);
          break;
        case 'REGULATORY_COMPLIANCE':
          violations = await this.checkRegulatoryCompliance(monitor.rules);
          break;
        default:
          console.warn(`Unknown monitor type: ${monitor.type}`);
          return;
      }

      // Process violations
      if (violations.length > 0) {
        monitor.violationCount += violations.length;
        
        const alert = {
          monitorId: monitor.id,
          timestamp: new Date(),
          violations,
          severity: monitor.severity,
          violationCount: monitor.violationCount
        };

        this.alerts.push(alert);
        
        // Trigger alerts if threshold exceeded
        if (monitor.violationCount >= monitor.alertThreshold) {
          await this.triggerAlerts(alert);
        }
      }

      // Update next check time
      monitor.nextCheck = new Date(Date.now() + monitor.interval);

    } catch (error) {
      console.error(`Monitor ${monitor.id} failed:`, error);
      // Log the error as a compliance event
      await AuditLogger.logSystemEvent('MONITOR_FAILURE', {
        monitorId: monitor.id,
        error: error.message,
        service: 'ComplianceMonitoring'
      });
    }
  }

  /**
   * Check for unusual access patterns
   */
  async checkAccessPatterns(rules) {
    const violations = [];
    const timeWindow = rules.timeWindow || 3600000; // 1 hour default
    const threshold = rules.threshold || 10;

    const recentEvents = await ComplianceService.getComplianceEvents(
      ['gdpr', 'hipaa'], 
      { 
        startDate: new Date(Date.now() - timeWindow) 
      }
    );

    // Group by actor to identify unusual patterns
    const actorEvents = {};
    recentEvents.forEach(event => {
      if (!actorEvents[event.actor.id]) {
        actorEvents[event.actor.id] = [];
      }
      actorEvents[event.actor.id].push(event);
    });

    // Check for excessive access attempts
    for (const [actorId, events] of Object.entries(actorEvents)) {
      if (events.length > threshold) {
        violations.push({
          type: 'EXCESSIVE_ACCESS',
          actorId,
          eventCount: events.length,
          threshold,
          description: `User ${actorId} accessed ${events.length} resources in ${timeWindow/1000/60} minutes, exceeding threshold of ${threshold}`
        });
      }
    }

    // Check for failed access attempts
    const failedAccessEvents = recentEvents.filter(
      event => event.eventType === 'ACCESS_REQUEST' && event.status === 'FAILURE'
    );

    if (failedAccessEvents.length > rules.failedThreshold || 5) {
      violations.push({
        type: 'HIGH_FAILED_ACCESS_RATE',
        failedCount: failedAccessEvents.length,
        description: `High rate of failed access attempts: ${failedAccessEvents.length} failures detected`
      });
    }

    return violations;
  }

  /**
   * Check data retention compliance
   */
  async checkDataRetention(rules) {
    const violations = [];
    
    // Check for expired data that should have been deleted
    const auditEvents = await ComplianceService.getComplianceEvents([], {
      eventType: 'PROOF_ISSUED',
      startDate: new Date(Date.now() - (rules.retentionPeriod || 365 * 24 * 60 * 60 * 1000))
    });

    const expiredData = auditEvents.filter(event => {
      const dataAge = Date.now() - new Date(event.timestamp).getTime();
      const retentionPeriod = (event.eventData?.retentionDays || 365) * 24 * 60 * 60 * 1000;
      return dataAge > retentionPeriod;
    });

    if (expiredData.length > 0) {
      violations.push({
        type: 'EXPIRED_DATA_RETENTION',
        count: expiredData.length,
        description: `Found ${expiredData.length} records exceeding retention period`
      });
    }

    return violations;
  }

  /**
   * Check privacy controls compliance
   */
  async checkPrivacyControls(rules) {
    const violations = [];
    
    // Check for data shared without proper consent
    const sharedEvents = await ComplianceService.getComplianceEvents(['gdpr'], {
      eventType: 'PROOF_SHARED',
      startDate: new Date(Date.now() - 3600000) // Last hour
    });

    const unauthorizedShares = sharedEvents.filter(event => {
      // Check if consent was granted for this sharing
      return !event.eventData?.consentGranted;
    });

    if (unauthorizedShares.length > 0) {
      violations.push({
        type: 'UNAUTHORIZED_DATA_SHARING',
        count: unauthorizedShares.length,
        description: `${unauthorizedShares.length} instances of data sharing without proper consent`
      });
    }

    // Check for public visibility of sensitive data
    const publicEvents = await ComplianceService.getComplianceEvents(['gdpr'], {
      eventType: 'PRIVACY_SETTING_CHANGED'
    });

    const publicSensitiveData = publicEvents.filter(event => {
      return event.eventData?.visibility === 'public' && 
             event.eventData?.classification === 'CONFIDENTIAL';
    });

    if (publicSensitiveData.length > 0) {
      violations.push({
        type: 'PUBLIC_SENSITIVE_DATA',
        count: publicSensitiveData.length,
        description: `${publicSensitiveData.length} sensitive data items made publicly visible`
      });
    }

    return violations;
  }

  /**
   * Check encryption compliance
   */
  async checkEncryptionCompliance(rules) {
    const violations = [];
    
    // Check for unencrypted sensitive data
    const issuedEvents = await ComplianceService.getComplianceEvents(['gdpr', 'hipaa'], {
      eventType: 'PROOF_ISSUED',
      startDate: new Date(Date.now() - 3600000)
    });

    const unencryptedSensitive = issuedEvents.filter(event => {
      return event.eventData?.sensitive && !event.eventData?.encrypted;
    });

    if (unencryptedSensitive.length > 0) {
      violations.push({
        type: 'UNENCRYPTED_SENSITIVE_DATA',
        count: unencryptedSensitive.length,
        description: `${unencryptedSensitive.length} sensitive items issued without encryption`
      });
    }

    // Check for key rotation compliance
    const keyEvents = await ComplianceService.getComplianceEvents([], {
      eventType: 'KEY_GENERATED'
    });

    const staleKeys = keyEvents.filter(event => {
      const keyAge = Date.now() - new Date(event.timestamp).getTime();
      const rotationPeriod = (event.eventData?.rotationDays || 90) * 24 * 60 * 60 * 1000;
      return keyAge > rotationPeriod;
    });

    if (staleKeys.length > 0) {
      violations.push({
        type: 'KEY_ROTATION_OVERDUE',
        count: staleKeys.length,
        description: `${staleKeys.length} encryption keys overdue for rotation`
      });
    }

    return violations;
  }

  /**
   * Check consent management compliance
   */
  async checkConsentManagement(rules) {
    const violations = [];
    
    // Check for expired consents still in use
    const consentEvents = await ComplianceService.getComplianceEvents(['gdpr'], {
      eventType: 'CONSENT_GRANTED'
    });

    const expiredConsents = consentEvents.filter(event => {
      const expiration = event.eventData?.expirationDate;
      return expiration && new Date(expiration) < new Date();
    });

    if (expiredConsents.length > 0) {
      violations.push({
        type: 'EXPIRED_CONSENTS_IN_USE',
        count: expiredConsents.length,
        description: `${expiredConsents.length} expired consents still being referenced`
      });
    }

    // Check for consent without proper documentation
    const consentRequests = await ComplianceService.getComplianceEvents(['gdpr'], {
      eventType: 'ACCESS_REQUEST'
    });

    const undocumentedConsents = consentRequests.filter(event => {
      return event.eventData?.requiresConsent && !event.eventData?.consentDocumented;
    });

    if (undocumentedConsents.length > 0) {
      violations.push({
        type: 'UNDOCUMENTED_CONSENT',
        count: undocumentedConsents.length,
        description: `${undocumentedConsents.length} access requests without proper consent documentation`
      });
    }

    return violations;
  }

  /**
   * Check regulatory compliance
   */
  async checkRegulatoryCompliance(rules) {
    const violations = [];
    const standards = rules.standards || ['GDPR', 'HIPAA'];

    for (const standard of standards) {
      try {
        const result = await this.regulatoryChecks.runComplianceCheck(standard);
        
        if (result.overallCompliance === 'NON_COMPLIANT') {
          violations.push({
            type: `${standard}_NON_COMPLIANT`,
            standard,
            description: `${standard} compliance check failed`,
            details: result.findings.filter(f => f.status !== 'COMPLIANT')
          });
        } else if (result.overallCompliance === 'PARTIALLY_COMPLIANT') {
          violations.push({
            type: `${standard}_PARTIALLY_COMPLIANT`,
            standard,
            description: `${standard} compliance is only partially met`,
            details: result.findings.filter(f => f.status !== 'COMPLIANT')
          });
        }
      } catch (error) {
        violations.push({
          type: `${standard}_CHECK_FAILED`,
          standard,
          description: `Failed to run ${standard} compliance check`,
          error: error.message
        });
      }
    }

    return violations;
  }

  /**
   * Trigger compliance alerts
   */
  async triggerAlerts(alert) {
    // Log the alert
    await AuditLogger.logSystemEvent('COMPLIANCE_VIOLATION', {
      alertId: `alert_${Date.now()}`,
      violations: alert.violations,
      severity: alert.severity,
      monitorId: alert.monitorId
    });

    // In a real implementation, this would:
    // 1. Send email notifications to compliance team
    // 2. Create tickets in incident management system
    // 3. Send notifications to Slack/Teams
    // 4. Update compliance dashboards
    // 5. Escalate based on severity levels

    console.log('COMPLIANCE ALERT TRIGGERED:', JSON.stringify(alert, null, 2));
  }

  /**
   * Get current alerts
   */
  getAlerts(options = {}) {
    const { severity, timeframe, limit = 50 } = options;
    
    let filteredAlerts = [...this.alerts];

    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }

    if (timeframe) {
      const cutoff = new Date(Date.now() - timeframe);
      filteredAlerts = filteredAlerts.filter(alert => new Date(alert.timestamp) > cutoff);
    }

    return filteredAlerts
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats() {
    const activeMonitors = Array.from(this.monitors.values()).filter(m => m.active);
    const totalAlerts = this.alerts.length;
    const recentAlerts = this.alerts.filter(alert => 
      new Date(alert.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    return {
      activeMonitors: activeMonitors.length,
      totalMonitors: this.monitors.size,
      totalAlerts,
      recentAlerts,
      violationsToday: this.alerts.filter(alert => 
        new Date(alert.timestamp).toDateString() === new Date().toDateString()
      ).reduce((sum, alert) => sum + alert.violations.length, 0),
      alertByType: this.aggregateAlertsByType()
    };
  }

  /**
   * Aggregate alerts by type
   */
  aggregateAlertsByType() {
    const typeCounts = {};
    
    this.alerts.forEach(alert => {
      alert.violations.forEach(violation => {
        const type = violation.type;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
    });

    return typeCounts;
  }

  /**
   * Get monitor status
   */
  getMonitorStatus(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return null;
    }

    return {
      id: monitor.id,
      type: monitor.type,
      active: monitor.active,
      lastCheck: monitor.lastCheck,
      nextCheck: monitor.nextCheck,
      violationCount: monitor.violationCount,
      alertThreshold: monitor.alertThreshold
    };
  }

  /**
   * Get all monitor statuses
   */
  getAllMonitorStatuses() {
    return Array.from(this.monitors.values()).map(monitor => ({
      id: monitor.id,
      type: monitor.type,
      active: monitor.active,
      lastCheck: monitor.lastCheck,
      nextCheck: monitor.nextCheck,
      violationCount: monitor.violationCount
    }));
  }

  /**
   * Configure default monitors
   */
  configureDefaultMonitors() {
    const defaultMonitors = [
      {
        monitorId: 'access-patterns-monitor',
        type: 'ACCESS_PATTERNS',
        interval: 5 * 60 * 1000, // 5 minutes
        rules: {
          threshold: 10,
          failedThreshold: 5,
          timeWindow: 3600000
        },
        severity: 'HIGH'
      },
      {
        monitorId: 'privacy-controls-monitor',
        type: 'PRIVACY_CONTROLS',
        interval: 10 * 60 * 1000, // 10 minutes
        rules: {},
        severity: 'HIGH'
      },
      {
        monitorId: 'encryption-compliance-monitor',
        type: 'ENCRYPTION_COMPLIANCE',
        interval: 15 * 60 * 1000, // 15 minutes
        rules: {
          rotationDays: 90
        },
        severity: 'MEDIUM'
      },
      {
        monitorId: 'consent-management-monitor',
        type: 'CONSENT_MANAGEMENT',
        interval: 30 * 60 * 1000, // 30 minutes
        rules: {},
        severity: 'HIGH'
      },
      {
        monitorId: 'regulatory-compliance-monitor',
        type: 'REGULATORY_COMPLIANCE',
        interval: 60 * 60 * 1000, // 1 hour
        rules: {
          standards: ['GDPR', 'HIPAA']
        },
        severity: 'CRITICAL'
      }
    ];

    defaultMonitors.forEach(config => {
      this.startMonitoring(config);
    });

    return defaultMonitors.map(m => m.monitorId);
  }
}

module.exports = AutomatedComplianceMonitoring;