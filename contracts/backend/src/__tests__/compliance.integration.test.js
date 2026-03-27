const mongoose = require('mongoose');
const AuditLogger = require('../compliance/auditLogger');
const ComplianceService = require('../services/complianceService');
const RegulatoryChecks = require('../compliance/regulatoryChecks');
const ReportGenerator = require('../compliance/reportGenerator');
const AutomatedMonitoring = require('../compliance/automatedMonitoring');

// Mock MongoDB and external dependencies
jest.mock('mongoose');
jest.mock('geoip-lite');

describe('Compliance Integration Tests', () => {
  beforeAll(() => {
    // Setup mock database connection
    mongoose.connect = jest.fn().mockResolvedValue();
    mongoose.connection = { 
      on: jest.fn(),
      once: jest.fn()
    };
  });

  describe('End-to-End Compliance Workflow', () => {
    test('should complete full compliance cycle from event logging to reporting', async () => {
      // Step 1: Log various compliance events
      const actor = {
        id: 'user-123',
        name: 'Compliance Officer',
        ipAddress: '192.168.1.100',
        userAgent: 'Compliance Dashboard'
      };

      // Log proof issuance
      const proofEvent = await AuditLogger.logProofEvent(
        'PROOF_ISSUED',
        {
          id: 'proof-abc-123',
          hash: 'hash-value-123',
          issuer: 'trusted-issuer',
          sensitive: true
        },
        actor,
        { purpose: 'contract_execution' }
      );

      // Log consent grant
      const consentEvent = await AuditLogger.logPrivacyEvent(
        'CONSENT_GRANTED',
        {
          proofId: 'proof-abc-123',
          settings: {
            dataRetention: '2_years',
            processingPurpose: 'contract_performance'
          },
          allowedViewers: ['verifier-456']
        },
        actor,
        { 
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        }
      );

      // Log access request
      const accessEvent = await AuditLogger.logAccessEvent(
        'ACCESS_REQUEST',
        {
          resourceId: 'proof-abc-123',
          resourceType: 'PROOF',
          resourceName: 'Employment Verification Proof',
          requestedActions: ['VIEW', 'VERIFY'],
          grantedActions: ['VIEW', 'VERIFY'],
          reason: 'employment_verification'
        },
        actor
      );

      // Step 2: Retrieve audit trail
      const auditTrail = await ComplianceService.getAuditTrail('proof-abc-123');
      
      expect(auditTrail).toHaveLength(3);
      expect(auditTrail.map(e => e.eventType)).toContain('PROOF_ISSUED');
      expect(auditTrail.map(e => e.eventType)).toContain('CONSENT_GRANTED');
      expect(auditTrail.map(e => e.eventType)).toContain('ACCESS_REQUEST');

      // Step 3: Perform regulatory compliance checks
      const gdprCheck = await RegulatoryChecks.checkGDPRCompliance(auditTrail);
      const hipaaCheck = await RegulatoryChecks.checkHIPAACompliance(auditTrail);
      
      expect(gdprCheck.compliant).toBe(true);
      expect(gdprCheck.violations).toHaveLength(0);
      expect(hipaaCheck.compliant).toBe(true);

      // Step 4: Generate compliance report
      const reportData = {
        title: 'Quarterly Compliance Report',
        period: {
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
          end: new Date()
        },
        regulations: ['gdpr', 'hipaa'],
        scope: 'All proof operations and access events',
        findings: {
          totalEvents: auditTrail.length,
          gdprCompliant: gdprCheck.compliant,
          hipaaCompliant: hipaaCheck.compliant,
          violations: [
            ...gdprCheck.violations,
            ...hipaaCheck.violations
          ]
        }
      };

      const pdfReport = await ReportGenerator.generatePDFReport(reportData);
      const htmlReport = await ReportGenerator.generateHTMLReport(reportData);
      
      expect(pdfReport).toContain('%PDF');
      expect(htmlReport).toContain('<html>');
      expect(htmlReport).toContain('Quarterly Compliance Report');

      // Step 5: Real-time monitoring
      const monitoringResults = await AutomatedMonitoring.detectViolations(auditTrail);
      
      expect(monitoringResults.statistics.totalEvents).toBe(3);
      expect(monitoringResults.statistics.complianceScore).toBe(100);

      // Step 6: Export audit trail
      const csvExport = AuditLogger.convertToCSV(auditTrail);
      expect(csvExport).toContain('PROOF_ISSUED');
      expect(csvExport).toContain('CONSENT_GRANTED');
      expect(csvExport).toContain('ACCESS_REQUEST');
    });

    test('should detect and handle compliance violations', async () => {
      // Create scenario with violations
      const actor = {
        id: 'user-456',
        name: 'Test User',
        ipAddress: '10.0.0.1'
      };

      // Log expired consent (violation)
      const expiredConsent = await AuditLogger.logPrivacyEvent(
        'CONSENT_GRANTED',
        {
          proofId: 'proof-violation-123',
          settings: { dataRetention: 'indefinite' }
        },
        actor,
        { 
          expirationDate: new Date(Date.now() - 86400000), // Expired yesterday
          status: 'FAILURE'
        }
      );

      // Log unauthorized access attempt
      const unauthorizedAccess = await AuditLogger.logAccessEvent(
        'ACCESS_REQUEST',
        {
          resourceId: 'proof-violation-123',
          resourceType: 'PROOF',
          resourceName: 'Restricted Proof',
          requestedActions: ['DELETE'],
          grantedActions: [],
          reason: 'unauthorized_deletion_attempt'
        },
        actor,
        { status: 'FAILURE' }
      );

      // Log key compromise
      const keyCompromise = await AuditLogger.logSecurityEvent(
        'KEY_COMPROMISED',
        {
          resourceId: 'compromised-key-123',
          resourceType: 'ENCRYPTION_KEY',
          resourceName: 'Master Encryption Key',
          keyId: 'key-123',
          algorithm: 'AES-256'
        },
        actor,
        { status: 'FAILURE' }
      );

      // Retrieve events for checking
      const violationEvents = [expiredConsent, unauthorizedAccess, keyCompromise];
      
      // Check compliance violations
      const gdprCheck = await RegulatoryChecks.checkGDPRCompliance(violationEvents);
      const securityCheck = await RegulatoryChecks.checkSecurityCompliance(violationEvents);
      
      // Should detect violations
      expect(gdprCheck.compliant).toBe(false);
      expect(gdprCheck.violations).toHaveLength(1);
      expect(gdprCheck.violations[0].type).toBe('EXPIRED_CONSENT');

      expect(securityCheck.compliant).toBe(false);
      expect(securityCheck.violations).toHaveLength(2);
      expect(securityCheck.violations.map(v => v.type)).toContain('KEY_COMPROMISED');
      expect(securityCheck.violations.map(v => v.type)).toContain('UNAUTHORIZED_ACCESS');

      // Generate violation report
      const violationReport = await ReportGenerator.generateJSONReport({
        title: 'Compliance Violation Report',
        period: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() },
        findings: {
          totalViolations: 3,
          criticalViolations: 2,
          mediumViolations: 1,
          violations: [
            {
              type: 'EXPIRED_CONSENT',
              severity: 'MEDIUM',
              eventId: expiredConsent.eventId,
              description: 'User consent has expired but data is still being processed'
            },
            {
              type: 'KEY_COMPROMISED',
              severity: 'CRITICAL',
              eventId: keyCompromise.eventId,
              description: 'Encryption key reported as compromised'
            },
            {
              type: 'UNAUTHORIZED_ACCESS',
              severity: 'CRITICAL',
              eventId: unauthorizedAccess.eventId,
              description: 'Unauthorized access attempt to restricted resource'
            }
          ]
        }
      });

      const parsedReport = JSON.parse(violationReport);
      expect(parsedReport.findings.totalViolations).toBe(3);
      expect(parsedReport.findings.criticalViolations).toBe(2);
    });
  });

  describe('Regulatory Framework Integration', () => {
    test('should validate GDPR compliance requirements', async () => {
      const consentEvent = await AuditLogger.logPrivacyEvent(
        'CONSENT_GRANTED',
        {
          proofId: 'gdpr-test-proof',
          settings: {
            purpose: 'contract_performance',
            dataMinimization: true,
            rightToErasure: true
          },
          allowedViewers: ['authorized-verifier']
        },
        {
          id: 'data-subject-123',
          name: 'Data Subject'
        },
        {
          consentType: 'EXPLICIT',
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          dataProcessingPurpose: 'Employment verification for contract execution'
        }
      );

      const gdprEvents = [consentEvent];
      const result = await RegulatoryChecks.checkGDPRCompliance(gdprEvents);
      
      expect(result.compliant).toBe(true);
      expect(result.findings.consentCompliant).toBe(true);
      expect(result.findings.dataMinimizationCompliant).toBe(true);
      expect(result.findings.rightToErasureCompliant).toBe(true);
    });

    test('should validate HIPAA compliance for healthcare data', async () => {
      const healthcareProof = await AuditLogger.logProofEvent(
        'PROOF_ISSUED',
        {
          id: 'hipaa-medical-proof-123',
          hash: 'medical-hash-456',
          issuer: 'certified-healthcare-provider',
          sensitive: true,
          healthcare: true
        },
        {
          id: 'healthcare-worker-123',
          name: 'Certified Healthcare Provider'
        },
        {
          dataClassification: 'PROTECTED_HEALTH_INFORMATION',
          encryptionApplied: true,
          accessRestricted: true
        }
      );

      const accessEvent = await AuditLogger.logAccessEvent(
        'ACCESS_REQUEST',
        {
          resourceId: 'hipaa-medical-proof-123',
          resourceType: 'PROOF',
          resourceName: 'Medical Credential Verification',
          requestedActions: ['VIEW'],
          grantedActions: ['VIEW'],
          businessPurpose: 'treatment_verification'
        },
        {
          id: 'authorized-practitioner-456',
          name: 'Licensed Medical Practitioner',
          role: 'healthcare_provider'
        }
      );

      const hipaaEvents = [healthcareProof, accessEvent];
      const result = await RegulatoryChecks.checkHIPAACompliance(hipaaEvents);
      
      expect(result.compliant).toBe(true);
      expect(result.findings.encryptionCompliant).toBe(true);
      expect(result.findings.accessControlCompliant).toBe(true);
      expect(result.findings.businessAssociateCompliant).toBe(true);
    });

    test('should validate SOX compliance for financial data', async () => {
      const financialProof = await AuditLogger.logProofEvent(
        'PROOF_ISSUED',
        {
          id: 'sox-financial-proof-123',
          hash: 'financial-hash-456',
          issuer: 'certified-auditor',
          sensitive: true,
          financial: true
        },
        {
          id: 'certified-accountant-123',
          name: 'Certified Public Accountant'
        },
        {
          dataClassification: 'FINANCIAL_STATEMENTS',
          auditTrail: true,
          tamperEvident: true
        }
      );

      const soxEvents = [financialProof];
      const result = await RegulatoryChecks.checkSOXCompliance(soxEvents);
      
      expect(result.compliant).toBe(true);
      expect(result.findings.accessControls).toBe(true);
      expect(result.findings.auditTrail).toBe(true);
      expect(result.findings.tamperEvidence).toBe(true);
    });
  });

  describe('Automated Compliance Monitoring', () => {
    test('should monitor for real-time compliance violations', async () => {
      // Simulate high volume of failed access attempts
      const failedAccessEvents = [];
      for (let i = 0; i < 15; i++) {
        const event = await AuditLogger.logAccessEvent(
          'ACCESS_REQUEST',
          {
            resourceId: 'sensitive-proof-' + i,
            resourceType: 'PROOF',
            requestedActions: ['DELETE']
          },
          {
            id: 'suspicious-user-' + i,
            name: 'Suspicious Actor',
            ipAddress: '192.168.1.' + (100 + i)
          },
          { status: 'FAILURE' }
        );
        failedAccessEvents.push(event);
      }

      // Add some successful events for comparison
      const successfulEvents = [];
      for (let i = 0; i < 5; i++) {
        const event = await AuditLogger.logAccessEvent(
          'ACCESS_REQUEST',
          {
            resourceId: 'regular-proof-' + i,
            resourceType: 'PROOF',
            requestedActions: ['VIEW']
          },
          {
            id: 'regular-user-' + i,
            name: 'Regular User'
          },
          { status: 'SUCCESS' }
        );
        successfulEvents.push(event);
      }

      const allEvents = [...failedAccessEvents, ...successfulEvents];
      const monitoringResult = await AutomatedMonitoring.detectViolations(allEvents);
      
      expect(monitoringResult.alerts).toHaveLength(1);
      expect(monitoringResult.alerts[0].type).toBe('HIGH_ACCESS_FAILURE_RATE');
      expect(monitoringResult.alerts[0].severity).toBe('HIGH');
      expect(monitoringResult.statistics.failedEvents).toBe(15);
      expect(monitoringResult.statistics.successfulEvents).toBe(5);
      expect(monitoringResult.statistics.complianceScore).toBeLessThan(50);
    });

    test('should generate compliance dashboard metrics', async () => {
      // Create diverse set of events
      const events = [
        await AuditLogger.logProofEvent('PROOF_ISSUED', { id: '1', sensitive: true }, { id: 'user1', name: 'User 1' }),
        await AuditLogger.logProofEvent('PROOF_VERIFIED', { id: '2', sensitive: false }, { id: 'user2', name: 'User 2' }),
        await AuditLogger.logPrivacyEvent('CONSENT_GRANTED', { proofId: '3' }, { id: 'user3', name: 'User 3' }),
        await AuditLogger.logSecurityEvent('KEY_COMPROMISED', { resourceId: 'key1' }, { id: 'user4', name: 'User 4' }, { status: 'FAILURE' })
      ];

      const timelineData = AutomatedMonitoring.generateTimelineData(events);
      const metrics = AutomatedMonitoring.generateComplianceMetrics(events);
      const stats = await AutomatedMonitoring.getMonitoringStats(events);
      
      expect(timelineData).toHaveLength(4);
      expect(metrics.classificationDistribution).toBeDefined();
      expect(metrics.statusDistribution).toBeDefined();
      expect(stats.totalEvents).toBe(4);
      expect(stats.complianceScore).toBeDefined();
    });
  });
});
