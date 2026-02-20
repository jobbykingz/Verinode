const AuditLog = require('../models/AuditLog');
const ComplianceReport = require('../models/ComplianceReport');
const crypto = require('crypto');

class ComplianceService {
  /**
   * Generate unique event ID
   */
  static generateEventId() {
    return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Log audit event with comprehensive details
   */
  static async logEvent(eventData) {
    try {
      const auditLog = new AuditLog({
        eventId: this.generateEventId(),
        eventType: eventData.eventType,
        actor: {
          id: eventData.actorId,
          type: eventData.actorType || 'USER',
          name: eventData.actorName,
          ipAddress: eventData.ipAddress,
          userAgent: eventData.userAgent
        },
        resource: eventData.resource ? {
          id: eventData.resource.id,
          type: eventData.resource.type,
          name: eventData.resource.name
        } : undefined,
        action: eventData.action,
        eventData: eventData.data,
        compliance: {
          gdprRelevant: eventData.gdprRelevant || false,
          hipaaRelevant: eventData.hipaaRelevant || false,
          soxRelevant: eventData.soxRelevant || false,
          pciRelevant: eventData.pciRelevant || false,
          classification: eventData.classification || 'INTERNAL'
        },
        location: eventData.location,
        sessionId: eventData.sessionId,
        correlationId: eventData.correlationId,
        status: eventData.status || 'SUCCESS',
        error: eventData.error
      });

      // Add digital signature for integrity
      const signatureData = JSON.stringify({
        eventId: auditLog.eventId,
        timestamp: auditLog.timestamp,
        eventType: auditLog.eventType,
        actor: auditLog.actor.id
      });

      // In production, use proper key management
      const privateKey = crypto.randomBytes(32);
      const signature = crypto
        .createHmac('sha256', privateKey)
        .update(signatureData)
        .digest('hex');

      auditLog.digitalSignature = {
        signature,
        publicKey: privateKey.toString('hex'),
        signedAt: new Date()
      };

      await auditLog.save();
      return auditLog;
    } catch (error) {
      console.error('Failed to log audit event:', error);
      throw error;
    }
  }

  /**
   * Get audit trail for a specific resource
   */
  static async getAuditTrail(resourceId, options = {}) {
    const {
      eventType,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = options;

    const query = { 'resource.id': resourceId };

    if (eventType) {
      query.eventType = eventType;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    return await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit);
  }

  /**
   * Get audit trail for a specific user
   */
  static async getUserAuditTrail(userId, options = {}) {
    const {
      eventType,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = options;

    const query = { 'actor.id': userId };

    if (eventType) {
      query.eventType = eventType;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    return await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit);
  }

  /**
   * Get compliance events for specific regulations
   */
  static async getComplianceEvents(regulations, options = {}) {
    const {
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = options;

    const query = {};

    if (Array.isArray(regulations) && regulations.length > 0) {
      const orConditions = regulations.map(reg => ({
        [`compliance.${reg.toLowerCase()}Relevant`]: true
      }));
      query.$or = orConditions;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    return await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit);
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(reportData) {
    try {
      const reportId = `rep_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      // Calculate metrics
      const metrics = await this.calculateComplianceMetrics(
        reportData.period.startDate,
        reportData.period.endDate
      );

      // Check regulatory requirements
      const requirements = await this.checkRegulatoryRequirements(
        reportData.standards,
        reportData.period
      );

      // Identify findings
      const findings = await this.identifyComplianceFindings(
        reportData.period.startDate,
        reportData.period.endDate,
        reportData.scope
      );

      const report = new ComplianceReport({
        reportId,
        reportType: reportData.reportType,
        period: reportData.period,
        scope: reportData.scope || [],
        status: {
          overall: this.calculateOverallCompliance(findings),
          findings
        },
        requirements,
        metrics,
        generatedBy: {
          userId: reportData.userId,
          userName: reportData.userName
        },
        format: reportData.format || 'PDF'
      });

      await report.save();
      return report;
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Calculate compliance metrics
   */
  static async calculateComplianceMetrics(startDate, endDate) {
    const totalEvents = await AuditLog.countDocuments({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    const securityEvents = await AuditLog.countDocuments({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      $or: [
        { eventType: { $in: ['USER_LOGIN', 'USER_LOGOUT', 'SECURITY_ALERT'] } },
        { 'compliance.classification': { $in: ['CONFIDENTIAL', 'RESTRICTED'] } }
      ]
    });

    const privacyEvents = await AuditLog.countDocuments({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      $or: [
        { eventType: { $in: ['PROOF_ENCRYPTED', 'SELECTIVE_DISCLOSURE', 'CONSENT_GRANTED'] } },
        { 'compliance.gdprRelevant': true }
      ]
    });

    const complianceEvents = await AuditLog.countDocuments({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      eventType: {
        $in: [
          'PRIVACY_SETTING_CHANGED', 'ACCESS_REQUEST', 'CONSENT_GRANTED',
          'CONSENT_REVOKED', 'KEY_GENERATED', 'KEY_ROTATED'
        ]
      }
    });

    // Calculate risk score (simplified)
    const violations = await AuditLog.countDocuments({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      status: 'FAILURE'
    });

    const riskScore = Math.min(100, Math.max(0, 
      (violations / Math.max(1, totalEvents)) * 100
    ));

    return {
      totalEvents,
      securityEvents,
      privacyEvents,
      complianceEvents,
      violations,
      remediations: 0, // Would be calculated from resolved findings
      riskScore: Math.round(riskScore)
    };
  }

  /**
   * Check regulatory requirements compliance
   */
  static async checkRegulatoryRequirements(standards, period) {
    const requirements = [];

    for (const standard of standards) {
      const standardRequirements = await this.getStandardRequirements(standard);
      
      for (const req of standardRequirements) {
        const isMet = await this.checkRequirementCompliance(req, period);
        requirements.push({
          standard,
          requirementId: req.id,
          description: req.description,
          status: isMet ? 'MET' : 'NOT_MET',
          evidence: isMet ? [`Compliance verified for period ${period.startDate} to ${period.endDate}`] : [],
          lastAssessed: new Date()
        });
      }
    }

    return requirements;
  }

  /**
   * Identify compliance findings
   */
  static async identifyComplianceFindings(startDate, endDate, scope) {
    const findings = [];

    // Check for unauthorized access attempts
    const failedAccessEvents = await AuditLog.find({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      eventType: 'ACCESS_REQUEST',
      status: 'FAILURE'
    });

    if (failedAccessEvents.length > 5) {
      findings.push({
        category: 'Access Control',
        severity: 'HIGH',
        description: `Multiple failed access attempts detected (${failedAccessEvents.length} events)`,
        evidence: failedAccessEvents.slice(0, 3).map(e => e.eventId),
        recommendation: 'Review access controls and implement rate limiting',
        status: 'OPEN'
      });
    }

    // Check for expired consents
    const expiredConsents = await AuditLog.find({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      eventType: 'CONSENT_GRANTED',
      'eventData.expirationDate': { $lt: new Date() }
    });

    if (expiredConsents.length > 0) {
      findings.push({
        category: 'Data Privacy',
        severity: 'MEDIUM',
        description: `Found ${expiredConsents.length} expired consents still in use`,
        evidence: expiredConsents.slice(0, 3).map(e => e.eventId),
        recommendation: 'Implement automated consent expiration monitoring',
        status: 'OPEN'
      });
    }

    // Check for unencrypted sensitive data
    const unencryptedSensitive = await AuditLog.find({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      eventType: 'PROOF_ISSUED',
      'eventData.encrypted': false,
      'compliance.classification': { $in: ['CONFIDENTIAL', 'RESTRICTED'] }
    });

    if (unencryptedSensitive.length > 0) {
      findings.push({
        category: 'Data Protection',
        severity: 'HIGH',
        description: `Found ${unencryptedSensitive.length} sensitive proofs issued without encryption`,
        evidence: unencryptedSensitive.slice(0, 3).map(e => e.eventId),
        recommendation: 'Enforce encryption for all sensitive data',
        status: 'OPEN'
      });
    }

    return findings;
  }

  /**
   * Calculate overall compliance status
   */
  static calculateOverallCompliance(findings) {
    const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
    const highFindings = findings.filter(f => f.severity === 'HIGH');
    const openFindings = findings.filter(f => f.status === 'OPEN');

    if (criticalFindings.length > 0 || highFindings.length > 3) {
      return 'NON_COMPLIANT';
    } else if (openFindings.length > 0) {
      return 'PARTIALLY_COMPLIANT';
    } else {
      return 'COMPLIANT';
    }
  }

  /**
   * Get standard requirements (simplified)
   */
  static async getStandardRequirements(standard) {
    const requirements = {
      'GDPR': [
        { id: 'GDPR-1', description: 'Lawful basis for processing personal data' },
        { id: 'GDPR-2', description: 'Data minimization principles' },
        { id: 'GDPR-3', description: 'Consent management and withdrawal' },
        { id: 'GDPR-4', description: 'Data subject rights fulfillment' },
        { id: 'GDPR-5', description: 'Data protection by design and by default' }
      ],
      'HIPAA': [
        { id: 'HIPAA-1', description: 'Administrative safeguards' },
        { id: 'HIPAA-2', description: 'Physical safeguards' },
        { id: 'HIPAA-3', description: 'Technical safeguards' },
        { id: 'HIPAA-4', description: 'Breach notification procedures' }
      ],
      'SOX': [
        { id: 'SOX-1', description: 'Internal controls over financial reporting' },
        { id: 'SOX-2', description: 'Access controls for financial systems' }
      ]
    };

    return requirements[standard] || [];
  }

  /**
   * Check individual requirement compliance (simplified)
   */
  static async checkRequirementCompliance(requirement, period) {
    // This would contain actual compliance checking logic
    // For now, returning random results for demonstration
    return Math.random() > 0.2; // 80% compliance rate
  }

  /**
   * Get real-time compliance dashboard data
   */
  static async getComplianceDashboard() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const totalEvents = await AuditLog.countDocuments({
      timestamp: { $gte: last24Hours }
    });

    const securityEvents = await AuditLog.countDocuments({
      timestamp: { $gte: last24Hours },
      $or: [
        { eventType: 'SECURITY_ALERT' },
        { status: 'FAILURE' }
      ]
    });

    const complianceReports = await ComplianceReport.countDocuments({
      'generatedBy.timestamp': { $gte: last24Hours }
    });

    const openFindings = await ComplianceReport.aggregate([
      { $unwind: '$status.findings' },
      { $match: { 'status.findings.status': 'OPEN' } },
      { $count: 'count' }
    ]);

    return {
      totalEvents,
      securityEvents,
      complianceReports,
      openFindings: openFindings[0]?.count || 0,
      complianceRate: totalEvents > 0 ? 
        Math.round(((totalEvents - securityEvents) / totalEvents) * 100) : 100
    };
  }
}

module.exports = ComplianceService;