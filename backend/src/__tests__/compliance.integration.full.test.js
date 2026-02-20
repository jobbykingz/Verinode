const mongoose = require('mongoose');
const AuditLogger = require('../compliance/auditLogger');
const ComplianceService = require('../services/complianceService');
const RegulatoryChecks = require('../compliance/regulatoryChecks');
const ReportGenerator = require('../compliance/reportGenerator');
const AutomatedMonitoring = require('../compliance/automatedMonitoring');

// Mock MongoDB
jest.mock('mongoose');
jest.mock('geoip-lite');

describe('Full Compliance Integration Test', () => {
  beforeAll(() => {
    mongoose.connect = jest.fn().mockResolvedValue();
    mongoose.connection = { on: jest.fn(), once: jest.fn() };
  });

  test('should demonstrate complete compliance workflow from template creation to purchase', async () => {
    // Step 1: User creates a template (compliance event logged)
    const templateCreator = {
      id: 'creator-123',
      name: 'Template Creator',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const templateData = {
      name: 'Employment Verification Template',
      description: 'Template for verifying employment credentials',
      category: 'credential',
      price: 29.99,
      content: {
        fields: ['employer', 'position', 'employment_dates', 'salary'],
        verification_methods: ['document_upload', 'employer_contact']
      },
      tags: ['employment', 'verification', 'credential']
    };

    const templateCreationEvent = await AuditLogger.logProofEvent(
      'TEMPLATE_CREATED',
      {
        id: 'template-emp-123',
        name: templateData.name,
        category: templateData.category,
        price: templateData.price,
        sensitive: false // Employment data is generally not considered highly sensitive
      },
      templateCreator,
      {
        purpose: 'marketplace_template_creation',
        templateTags: templateData.tags
      }
    );

    expect(templateCreationEvent.eventType).toBe('TEMPLATE_CREATED');
    expect(templateCreationEvent.compliance.classification).toBe('INTERNAL');

    // Step 2: User purchases the template (compliance event logged)
    const purchaser = {
      id: 'purchaser-456',
      name: 'Business Owner',
      ipAddress: '192.168.1.200',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    };

    const purchaseData = {
      templateId: 'template-emp-123',
      amount: 29.99,
      paymentMethod: 'credit_card',
      transactionHash: 'tx-abc-123-xyz'
    };

    // Simulate successful payment
    const paymentSuccessEvent = await AuditLogger.logAccessEvent(
      'TEMPLATE_PURCHASED',
      {
        resourceId: 'template-emp-123',
        resourceType: 'TEMPLATE',
        resourceName: 'Employment Verification Template',
        requestedActions: ['PURCHASE', 'ACCESS'],
        grantedActions: ['PURCHASE', 'ACCESS'],
        reason: 'template_purchase_completed'
      },
      purchaser,
      {
        amount: purchaseData.amount,
        transactionId: 'txn-789-456',
        paymentMethod: purchaseData.paymentMethod
      }
    );

    expect(paymentSuccessEvent.eventType).toBe('TEMPLATE_PURCHASED');
    expect(paymentSuccessEvent.status).toBe('SUCCESS');

    // Step 3: Template creator receives payment notification (system event)
    const paymentNotificationEvent = await AuditLogger.logSystemEvent(
      'PAYMENT_PROCESSED',
      {
        resourceId: 'template-emp-123',
        resourceType: 'TEMPLATE',
        resourceName: 'Employment Verification Template',
        service: 'payment_processor',
        version: '2.1.0'
      },
      null, // System event
      {
        amount: 29.99,
        recipient: 'creator-123',
        transactionId: 'txn-789-456'
      }
    );

    expect(paymentNotificationEvent.eventType).toBe('PAYMENT_PROCESSED');
    expect(paymentNotificationEvent.actorType).toBe('SYSTEM');

    // Step 4: Retrieve complete audit trail for the template
    const auditTrail = await ComplianceService.getAuditTrail('template-emp-123');
    
    expect(auditTrail).toHaveLength(3);
    expect(auditTrail.map(e => e.eventType)).toContain('TEMPLATE_CREATED');
    expect(auditTrail.map(e => e.eventType)).toContain('TEMPLATE_PURCHASED');
    expect(auditTrail.map(e => e.eventType)).toContain('PAYMENT_PROCESSED');

    // Step 5: Perform regulatory compliance checks
    const gdprCheck = await RegulatoryChecks.checkGDPRCompliance(auditTrail);
    const pciCheck = await RegulatoryChecks.checkPCICompliance(auditTrail);
    
    // Template creation should be GDPR compliant (no personal data processing)
    expect(gdprCheck.compliant).toBe(true);
    expect(gdprCheck.violations).toHaveLength(0);
    
    // Payment processing should be PCI compliant
    expect(pciCheck.compliant).toBe(true);
    expect(pciCheck.findings.secureTransmission).toBe(true);

    // Step 6: Generate comprehensive compliance report
    const complianceReport = await ReportGenerator.generatePDFReport({
      title: 'Template Marketplace Compliance Report',
      period: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date()
      },
      scope: 'Template creation and purchase workflow',
      regulations: ['gdpr', 'pci'],
      findings: {
        totalTransactions: 1,
        totalTemplates: 1,
        gdprCompliant: gdprCheck.compliant,
        pciCompliant: pciCheck.compliant,
        templateCreationEvents: auditTrail.filter(e => e.eventType === 'TEMPLATE_CREATED').length,
        purchaseEvents: auditTrail.filter(e => e.eventType === 'TEMPLATE_PURCHASED').length,
        paymentEvents: auditTrail.filter(e => e.eventType === 'PAYMENT_PROCESSED').length,
        violations: [
          ...gdprCheck.violations,
          ...pciCheck.violations
        ]
      }
    });

    expect(complianceReport).toContain('%PDF');
    expect(complianceReport.length).toBeGreaterThan(1000); // Should be substantial PDF

    // Step 7: Real-time monitoring for suspicious activities
    const monitoringResult = await AutomatedMonitoring.detectViolations(auditTrail);
    
    expect(monitoringResult.statistics.totalEvents).toBe(3);
    expect(monitoringResult.statistics.complianceScore).toBe(100); // All events compliant
    expect(monitoringResult.alerts).toHaveLength(0); // No violations detected

    // Step 8: Export audit trail in multiple formats
    const csvExport = AuditLogger.convertToCSV(auditTrail);
    const htmlExport = AuditLogger.generateHTMLReport(auditTrail);
    
    expect(csvExport).toContain('TEMPLATE_CREATED');
    expect(csvExport).toContain('TEMPLATE_PURCHASED');
    expect(csvExport).toContain('PAYMENT_PROCESSED');
    
    expect(htmlExport).toContain('<html>');
    expect(htmlExport).toContain('Audit Trail Report');
    expect(htmlExport).toContain('Employment Verification Template');

    // Step 9: Generate compliance metrics and dashboard data
    const metrics = await AutomatedMonitoring.getMonitoringStats(auditTrail);
    const timelineData = AutomatedMonitoring.generateTimelineData(auditTrail);
    const complianceMetrics = AutomatedMonitoring.generateComplianceMetrics(auditTrail);
    
    expect(metrics.totalEvents).toBe(3);
    expect(metrics.successfulEvents).toBe(3);
    expect(metrics.complianceScore).toBe(100);
    
    expect(timelineData).toHaveLength(3);
    expect(timelineData[0].eventType).toBe('TEMPLATE_CREATED');
    
    expect(complianceMetrics.classificationDistribution.INTERNAL).toBe(3);
    expect(complianceMetrics.statusDistribution.SUCCESS).toBe(3);

    // Step 10: Verify all compliance requirements are met
    const complianceSummary = {
      auditTrailComplete: auditTrail.length === 3,
      regulatoryChecksPassed: gdprCheck.compliant && pciCheck.compliant,
      reportGenerated: complianceReport.length > 0,
      monitoringActive: monitoringResult.statistics.totalEvents > 0,
      exportAvailable: csvExport.length > 0 && htmlExport.length > 0,
      metricsCalculated: metrics.totalEvents === 3
    };

    // All compliance requirements should be satisfied
    Object.values(complianceSummary).forEach(requirement => {
      expect(requirement).toBe(true);
    });

    console.log('✅ Full compliance workflow completed successfully!');
    console.log(`📊 Total compliance events logged: ${auditTrail.length}`);
    console.log(`📈 Compliance score: ${metrics.complianceScore}%`);
    console.log(`📄 Report generated: ${complianceReport.length > 1000 ? 'Yes' : 'No'}`);
    console.log(`📤 Export formats available: CSV, HTML`);
  });

  test('should handle compliance violations and generate appropriate alerts', async () => {
    // Simulate a scenario with compliance violations
    const suspiciousUser = {
      id: 'suspicious-789',
      name: 'Suspicious Actor',
      ipAddress: '10.0.0.1',
      userAgent: 'curl/7.0'
    };

    // Multiple failed payment attempts (potential fraud)
    const failedPayments = [];
    for (let i = 0; i < 12; i++) {
      const failedEvent = await AuditLogger.logAccessEvent(
        'PAYMENT_FAILED',
        {
          resourceId: `template-${i}`,
          resourceType: 'TEMPLATE',
          resourceName: `Template ${i}`,
          requestedActions: ['PURCHASE'],
          grantedActions: [],
          reason: 'payment_processing_failed'
        },
        suspiciousUser,
        {
          status: 'FAILURE',
          error: 'Insufficient funds',
          amount: 29.99,
          attemptNumber: i + 1
        }
      );
      failedPayments.push(failedEvent);
    }

    // Unauthorized access attempt to sensitive template
    const unauthorizedAccess = await AuditLogger.logAccessEvent(
      'ACCESS_REQUEST',
      {
        resourceId: 'sensitive-template-123',
        resourceType: 'TEMPLATE',
        resourceName: 'Healthcare Credential Template',
        requestedActions: ['DELETE', 'MODIFY'],
        grantedActions: [],
        reason: 'unauthorized_admin_access'
      },
      suspiciousUser,
      {
        status: 'FAILURE',
        error: 'Access denied - insufficient permissions'
      }
    );

    // Expired consent for data processing
    const expiredConsent = await AuditLogger.logPrivacyEvent(
      'CONSENT_GRANTED',
      {
        proofId: 'health-data-123',
        settings: {
          dataRetention: 'indefinite',
          processingPurpose: 'research'
        },
        allowedViewers: ['research-team']
      },
      suspiciousUser,
      {
        expirationDate: new Date(Date.now() - 86400000), // Expired yesterday
        status: 'FAILURE'
      }
    );

    const violationEvents = [...failedPayments, unauthorizedAccess, expiredConsent];
    
    // Check compliance violations
    const gdprCheck = await RegulatoryChecks.checkGDPRCompliance(violationEvents);
    const securityCheck = await RegulatoryChecks.checkSecurityCompliance(violationEvents);
    
    // Should detect violations
    expect(gdprCheck.compliant).toBe(false);
    expect(gdprCheck.violations).toHaveLength(1);
    expect(gdprCheck.violations[0].type).toBe('EXPIRED_CONSENT');
    
    expect(securityCheck.compliant).toBe(false);
    expect(securityCheck.violations).toHaveLength(2);
    expect(securityCheck.violations.map(v => v.type)).toContain('UNAUTHORIZED_ACCESS');
    expect(securityCheck.violations.map(v => v.type)).toContain('HIGH_ACCESS_FAILURE_RATE');

    // Generate violation report
    const violationReport = await ReportGenerator.generateJSONReport({
      title: 'Compliance Violation Report',
      period: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() },
      scope: 'Suspicious activity detection',
      findings: {
        totalViolations: 3,
        criticalViolations: 2,
        mediumViolations: 1,
        violations: [
          {
            type: 'EXPIRED_CONSENT',
            severity: 'MEDIUM',
            eventId: expiredConsent.eventId,
            description: 'User consent has expired but data processing continues'
          },
          {
            type: 'UNAUTHORIZED_ACCESS',
            severity: 'CRITICAL',
            eventId: unauthorizedAccess.eventId,
            description: 'Unauthorized access attempt to sensitive template'
          },
          {
            type: 'HIGH_ACCESS_FAILURE_RATE',
            severity: 'CRITICAL',
            eventIds: failedPayments.slice(0, 5).map(e => e.eventId),
            description: 'Unusual number of failed payment attempts indicating potential fraud'
          }
        ]
      }
    });

    const parsedReport = JSON.parse(violationReport);
    expect(parsedReport.findings.totalViolations).toBe(3);
    expect(parsedReport.findings.criticalViolations).toBe(2);

    // Real-time monitoring should detect violations
    const monitoringResult = await AutomatedMonitoring.detectViolations(violationEvents);
    
    expect(monitoringResult.alerts).toHaveLength(2);
    expect(monitoringResult.alerts.map(a => a.type)).toContain('HIGH_ACCESS_FAILURE_RATE');
    expect(monitoringResult.alerts.map(a => a.type)).toContain('EXPIRED_CONSENTS_IN_USE');
    expect(monitoringResult.statistics.complianceScore).toBeLessThan(50);

    console.log('⚠️  Compliance violations detected and reported!');
    console.log(`🚨 Total violations: ${parsedReport.findings.totalViolations}`);
    console.log(`🔴 Critical violations: ${parsedReport.findings.criticalViolations}`);
    console.log(`🟡 Medium violations: ${parsedReport.findings.mediumViolations}`);
  });
});
