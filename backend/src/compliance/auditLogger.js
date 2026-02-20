const ComplianceService = require('../services/complianceService');
const geoip = require('geoip-lite');

class AuditLogger {
  /**
   * Log proof-related events
   */
  static async logProofEvent(eventType, proofData, actor, additionalData = {}) {
    const eventData = {
      eventType,
      actorId: actor.id,
      actorName: actor.name,
      actorType: actor.type || 'USER',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      resource: {
        id: proofData.id,
        type: 'PROOF',
        name: `Proof ${proofData.id}`
      },
      action: this.getActionFromEventType(eventType),
      data: {
        proofId: proofData.id,
        hash: proofData.hash,
        issuer: proofData.issuer,
        ...additionalData
      },
      gdprRelevant: true,
      classification: proofData.sensitive ? 'CONFIDENTIAL' : 'INTERNAL',
      sessionId: actor.sessionId,
      correlationId: additionalData.correlationId
    };

    // Add location data if IP available
    if (actor.ipAddress) {
      const geo = geoip.lookup(actor.ipAddress);
      if (geo) {
        eventData.location = {
          country: geo.country,
          region: geo.region,
          city: geo.city
        };
      }
    }

    return await ComplianceService.logEvent(eventData);
  }

  /**
   * Log privacy control events
   */
  static async logPrivacyEvent(eventType, privacyData, actor, additionalData = {}) {
    const eventData = {
      eventType,
      actorId: actor.id,
      actorName: actor.name,
      actorType: actor.type || 'USER',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      resource: privacyData.proofId ? {
        id: privacyData.proofId,
        type: 'PROOF',
        name: `Proof ${privacyData.proofId}`
      } : undefined,
      action: this.getActionFromEventType(eventType),
      data: {
        privacySettings: privacyData.settings,
        allowedViewers: privacyData.allowedViewers,
        ...additionalData
      },
      gdprRelevant: true,
      classification: 'CONFIDENTIAL',
      sessionId: actor.sessionId,
      correlationId: additionalData.correlationId
    };

    return await ComplianceService.logEvent(eventData);
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(eventType, securityData, actor, additionalData = {}) {
    const eventData = {
      eventType,
      actorId: actor.id,
      actorName: actor.name,
      actorType: actor.type || 'USER',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      resource: securityData.resourceId ? {
        id: securityData.resourceId,
        type: securityData.resourceType,
        name: securityData.resourceName
      } : undefined,
      action: this.getActionFromEventType(eventType),
      data: {
        keyId: securityData.keyId,
        algorithm: securityData.algorithm,
        ...additionalData
      },
      classification: 'RESTRICTED',
      sessionId: actor.sessionId,
      correlationId: additionalData.correlationId,
      status: additionalData.status || 'SUCCESS',
      error: additionalData.error
    };

    // Add security alert flag for critical events
    if (['KEY_COMPROMISED', 'UNAUTHORIZED_ACCESS', 'SECURITY_BREACH'].includes(eventType)) {
      eventData.compliance = {
        classification: 'RESTRICTED',
        gdprRelevant: true
      };
    }

    return await ComplianceService.logEvent(eventData);
  }

  /**
   * Log user access events
   */
  static async logAccessEvent(eventType, accessData, actor, additionalData = {}) {
    const eventData = {
      eventType,
      actorId: actor.id,
      actorName: actor.name,
      actorType: actor.type || 'USER',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      resource: accessData.resourceId ? {
        id: accessData.resourceId,
        type: accessData.resourceType,
        name: accessData.resourceName
      } : undefined,
      action: this.getActionFromEventType(eventType),
      data: {
        requestedActions: accessData.requestedActions,
        grantedActions: accessData.grantedActions,
        reason: accessData.reason,
        ...additionalData
      },
      gdprRelevant: eventType === 'CONSENT_GRANTED' || eventType === 'ACCESS_REQUEST',
      classification: 'INTERNAL',
      sessionId: actor.sessionId,
      correlationId: additionalData.correlationId,
      status: additionalData.status || 'SUCCESS'
    };

    return await ComplianceService.logEvent(eventData);
  }

  /**
   * Log system events
   */
  static async logSystemEvent(eventType, systemData, actor = null, additionalData = {}) {
    const eventData = {
      eventType,
      actorId: actor ? actor.id : 'SYSTEM',
      actorName: actor ? actor.name : 'System Service',
      actorType: actor ? actor.type : 'SYSTEM',
      resource: systemData.resourceId ? {
        id: systemData.resourceId,
        type: systemData.resourceType,
        name: systemData.resourceName
      } : undefined,
      action: this.getActionFromEventType(eventType),
      data: {
        service: systemData.service,
        version: systemData.version,
        configuration: systemData.configuration,
        ...additionalData
      },
      classification: systemData.sensitive ? 'CONFIDENTIAL' : 'INTERNAL',
      correlationId: additionalData.correlationId,
      status: additionalData.status || 'SUCCESS',
      error: additionalData.error
    };

    return await ComplianceService.logEvent(eventData);
  }

  /**
   * Bulk log events for performance
   */
  static async logBulkEvents(events) {
    const promises = events.map(event => 
      ComplianceService.logEvent(event)
    );
    return await Promise.all(promises);
  }

  /**
   * Get action description from event type
   */
  static getActionFromEventType(eventType) {
    const actions = {
      'PROOF_ISSUED': 'Issued cryptographic proof',
      'PROOF_VERIFIED': 'Verified proof authenticity',
      'PROOF_SHARED': 'Shared proof with recipient',
      'PROOF_ENCRYPTED': 'Encrypted proof data',
      'PRIVACY_SETTING_CHANGED': 'Modified privacy settings',
      'KEY_GENERATED': 'Generated encryption key',
      'KEY_ROTATED': 'Rotated encryption key',
      'KEY_COMPROMISED': 'Reported key compromise',
      'ACCESS_REQUEST': 'Requested access to resource',
      'CONSENT_GRANTED': 'Granted data access consent',
      'CONSENT_REVOKED': 'Revoked data access consent',
      'SELECTIVE_DISCLOSURE': 'Created selective disclosure',
      'ZK_PROOF_GENERATED': 'Generated zero-knowledge proof',
      'ZK_PROOF_VERIFIED': 'Verified zero-knowledge proof',
      'USER_LOGIN': 'User authentication',
      'USER_LOGOUT': 'User logout',
      'ROLE_CHANGED': 'Modified user role',
      'PERMISSION_GRANTED': 'Granted system permission',
      'PERMISSION_REVOKED': 'Revoked system permission',
      'SYSTEM_CONFIGURATION': 'Modified system configuration',
      'SECURITY_ALERT': 'Security incident detected',
      'UNAUTHORIZED_ACCESS': 'Unauthorized access attempt'
    };

    return actions[eventType] || eventType.replace(/_/g, ' ').toLowerCase();
  }

  /**
   * Create audit trail for a specific proof
   */
  static async getProofAuditTrail(proofId, options = {}) {
    return await ComplianceService.getAuditTrail(proofId, options);
  }

  /**
   * Create audit trail for a specific user
   */
  static async getUserAuditTrail(userId, options = {}) {
    return await ComplianceService.getUserAuditTrail(userId, options);
  }

  /**
   * Get compliance-related events
   */
  static async getComplianceEvents(regulations, options = {}) {
    return await ComplianceService.getComplianceEvents(regulations, options);
  }

  /**
   * Real-time monitoring for compliance violations
   */
  static async monitorComplianceViolations() {
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    
    // Check for compliance violations
    const violations = await ComplianceService.getComplianceEvents(
      ['gdpr', 'hipaa'], 
      { startDate: lastHour }
    );

    const alerts = [];

    // Check for patterns indicating violations
    const failedAccessAttempts = violations.filter(
      v => v.eventType === 'ACCESS_REQUEST' && v.status === 'FAILURE'
    );

    if (failedAccessAttempts.length > 10) {
      alerts.push({
        type: 'HIGH_ACCESS_FAILURE_RATE',
        severity: 'HIGH',
        message: `Unusual number of failed access attempts: ${failedAccessAttempts.length}`,
        timestamp: new Date(),
        relatedEvents: failedAccessAttempts.slice(0, 5).map(e => e.eventId)
      });
    }

    const expiredConsents = violations.filter(
      v => v.eventType === 'CONSENT_GRANTED' && 
           v.eventData?.expirationDate && 
           new Date(v.eventData.expirationDate) < new Date()
    );

    if (expiredConsents.length > 0) {
      alerts.push({
        type: 'EXPIRED_CONSENTS_IN_USE',
        severity: 'MEDIUM',
        message: `Found ${expiredConsents.length} expired consents still being referenced`,
        timestamp: new Date(),
        relatedEvents: expiredConsents.slice(0, 5).map(e => e.eventId)
      });
    }

    return alerts;
  }

  /**
   * Export audit trail in various formats
   */
  static async exportAuditTrail(format, options = {}) {
    const { 
      resourceId, 
      userId, 
      startDate, 
      endDate, 
      eventType 
    } = options;

    let auditTrail;
    
    if (resourceId) {
      auditTrail = await this.getProofAuditTrail(resourceId, { startDate, endDate, eventType });
    } else if (userId) {
      auditTrail = await this.getUserAuditTrail(userId, { startDate, endDate, eventType });
    } else {
      auditTrail = await ComplianceService.getComplianceEvents([], { startDate, endDate, eventType });
    }

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(auditTrail, null, 2);
      
      case 'csv':
        return this.convertToCSV(auditTrail);
      
      case 'html':
        return this.generateHTMLReport(auditTrail);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert audit trail to CSV format
   */
  static convertToCSV(auditTrail) {
    if (auditTrail.length === 0) return '';

    const headers = [
      'Timestamp', 'Event Type', 'Actor', 'Resource', 'Action', 'Status', 'IP Address'
    ];

    const rows = auditTrail.map(event => [
      event.timestamp.toISOString(),
      event.eventType,
      event.actor.name,
      event.resource?.name || 'N/A',
      event.action,
      event.status,
      event.actor.ipAddress || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Generate HTML report for audit trail
   */
  static generateHTMLReport(auditTrail) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Audit Trail Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .success { color: green; }
        .failure { color: red; }
        .warning { color: orange; }
    </style>
</head>
<body>
    <h1>Audit Trail Report</h1>
    <p>Generated on: ${new Date().toISOString()}</p>
    <table>
        <thead>
            <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Actor</th>
                <th>Resource</th>
                <th>Action</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${auditTrail.map(event => `
                <tr>
                    <td>${event.timestamp.toISOString()}</td>
                    <td>${event.eventType}</td>
                    <td>${event.actor.name}</td>
                    <td>${event.resource?.name || 'N/A'}</td>
                    <td>${event.action}</td>
                    <td class="${event.status.toLowerCase()}">${event.status}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

    return html;
  }
}

module.exports = AuditLogger;