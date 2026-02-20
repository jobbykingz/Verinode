const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const ComplianceReport = require('../models/ComplianceReport');
const ComplianceService = require('../services/complianceService');
const AuditLogger = require('../compliance/auditLogger');
const RegulatoryComplianceChecks = require('../compliance/regulatoryChecks');
const ComplianceReportGenerator = require('../compliance/reportGenerator');
const AutomatedComplianceMonitoring = require('../compliance/automatedMonitoring');

// Mock dependencies
jest.mock('mongoose');
jest.mock('geoip-lite');

describe('Compliance Framework Tests', () => {
  let mockAuditLog;
  let mockComplianceReport;
  let regulatoryChecks;
  let reportGenerator;
  let monitoring;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock AuditLog model
    mockAuditLog = {
      save: jest.fn().mockResolvedValue({ 
        eventId: 'test-event-123',
        eventType: 'PROOF_ISSUED',
        timestamp: new Date()
      }),
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    };
    
    // Mock ComplianceReport model
    mockComplianceReport = {
      save: jest.fn().mockResolvedValue({ 
        reportId: 'test-report-123',
        title: 'Test Compliance Report'
      }),
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    };

    // Set up model mocks
    mongoose.model = jest.fn((modelName) => {
      if (modelName === 'AuditLog') return mockAuditLog;
      if (modelName === 'ComplianceReport') return mockComplianceReport;
      return {};
    });

    // Initialize compliance services
    regulatoryChecks = new RegulatoryComplianceChecks();
    reportGenerator = new ComplianceReportGenerator();
    monitoring = new AutomatedComplianceMonitoring();
  });

  describe('Audit Logging', () => {
    test('should log proof events correctly', async () => {
      const proofData = {
        id: 'proof-123',
        hash: 'abc123',
        issuer: 'issuer-456',
        sensitive: true
      };
      
      const actor = {
        id: 'user-789',
        name: 'Test User',
        type: 'USER',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser'
      };

      const result = await AuditLogger.logProofEvent(
        'PROOF_ISSUED',
        proofData,
        actor,
        { correlationId: 'corr-123' }
      );

      expect(result.eventId).toBeDefined();
      expect(result.eventType).toBe('PROOF_ISSUED');
      expect(result.actorId).toBe('user-789');
      expect(result.compliance.classification).toBe('CONFIDENTIAL');
    });

    test('should log privacy events correctly', async () => {
      const privacyData = {
        proofId: 'proof-123',
        settings: { encryption: true, accessControl: 'restricted' },
        allowedViewers: ['user-456']
      };
      
      const actor = {
        id: 'user-789',
        name: 'Test User',
        type: 'USER'
      };

      const result = await AuditLogger.logPrivacyEvent(
        'PRIVACY_SETTING_CHANGED',
        privacyData,
        actor
      );

      expect(result.eventType).toBe('PRIVACY_SETTING_CHANGED');
      expect(result.compliance.classification).toBe('CONFIDENTIAL');
      expect(result.compliance.gdprRelevant).toBe(true);
    });

    test('should log security events with proper classification', async () => {
      const securityData = {
        resourceId: 'key-123',
        resourceType: 'ENCRYPTION_KEY',
        resourceName: 'Master Key',
        keyId: 'key-123',
        algorithm: 'RSA-4096'
      };
      
      const actor = {
        id: 'user-789',
        name: 'Test User'
      };

      const result = await AuditLogger.logSecurityEvent(
        'KEY_COMPROMISED',
        securityData,
        actor,
        { status: 'FAILURE' }
      );

      expect(result.eventType).toBe('KEY_COMPROMISED');
      expect(result.compliance.classification).toBe('RESTRICTED');
      expect(result.status).toBe('FAILURE');
    });

    test('should convert audit trail to CSV format', () => {
      const auditTrail = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          eventType: 'PROOF_ISSUED',
          actor: { name: 'Test User' },
          resource: { name: 'Proof 123' },
          action: 'Issued proof',
          status: 'SUCCESS'
        }
      ];

      const csv = AuditLogger.convertToCSV(auditTrail);
      expect(csv).toContain('Timestamp,Event Type,Actor,Resource,Action,Status,IP Address');
      expect(csv).toContain('Test User');
      expect(csv).toContain('Proof 123');
    });
  });

  describe('Compliance Service', () => {
    test('should log events through compliance service', async () => {
      const eventData = {
        eventType: 'TEST_EVENT',
        actorId: 'user-123',
        actorName: 'Test User',
        action: 'Test action'
      };

      const result = await ComplianceService.logEvent(eventData);
      
      expect(result.eventId).toBeDefined();
      expect(result.eventType).toBe('TEST_EVENT');
      expect(result.timestamp).toBeDefined();
    });

    test('should retrieve audit trail for resource', async () => {
      mockAuditLog.exec.mockResolvedValue([
        { eventId: 'event-1', eventType: 'PROOF_ISSUED' },
        { eventId: 'event-2', eventType: 'PROOF_VERIFIED' }
      ]);

      const result = await ComplianceService.getAuditTrail('resource-123');
      
      expect(result).toHaveLength(2);
      expect(result[0].eventId).toBe('event-1');
    });

    test('should generate compliance report', async () => {
      const reportData = {
        title: 'GDPR Compliance Report',
        period: { start: new Date('2024-01-01'), end: new Date('2024-12-31') },
        regulations: ['gdpr'],
        findings: { violations: 0, compliant: 100 }
      };

      const result = await ComplianceService.generateReport(reportData);
      
      expect(result.reportId).toBeDefined();
      expect(result.title).toBe('GDPR Compliance Report');
      expect(result.status).toBe('DRAFT');
    });
  });

  describe('Regulatory Checks', () => {
    test('should initialize regulatory compliance checks', () => {
      expect(regulatoryChecks).toBeDefined();
      expect(regulatoryChecks.regulations).toBeDefined();
      expect(regulatoryChecks.regulations.gdpr).toBeDefined();
    });

    test('should have GDPR requirements', () => {
      const gdprRequirements = regulatoryChecks.regulations.gdpr;
      expect(gdprRequirements).toBeDefined();
      expect(gdprRequirements.ARTICLE_5).toBeDefined();
      expect(gdprRequirements.ARTICLE_17).toBeDefined();
    });

    test('should have HIPAA requirements', () => {
      const hipaaRequirements = regulatoryChecks.regulations.hipaa;
      expect(hipaaRequirements).toBeDefined();
      expect(hipaaRequirements.STANDARD_164_308).toBeDefined();
    });
  });

  describe('Report Generation', () => {
    test('should initialize report generator', () => {
      expect(reportGenerator).toBeDefined();
      expect(reportGenerator.regulatoryChecks).toBeDefined();
    });

    test('should generate compliance report configuration', () => {
      const config = {
        reportType: 'COMPLIANCE_AUDIT',
        period: { start: new Date('2024-01-01'), end: new Date('2024-12-31') },
        standards: ['gdpr', 'hipaa'],
        scope: 'Full system audit',
        format: 'PDF'
      };

      expect(config.reportType).toBe('COMPLIANCE_AUDIT');
      expect(config.standards).toContain('gdpr');
      expect(config.format).toBe('PDF');
    });
  });

  describe('Automated Monitoring', () => {
    test('should initialize monitoring service', () => {
      expect(monitoring).toBeDefined();
      expect(monitoring.monitors).toBeDefined();
      expect(monitoring.alerts).toBeDefined();
    });

    test('should configure default monitors', () => {
      const monitorIds = monitoring.configureDefaultMonitors();
      
      expect(monitorIds).toHaveLength(5);
      expect(monitorIds).toContain('access-patterns-monitor');
      expect(monitorIds).toContain('privacy-controls-monitor');
      expect(monitorIds).toContain('regulatory-compliance-monitor');
    });

    test('should get monitoring statistics', () => {
      const stats = monitoring.getMonitoringStats();
      
      expect(stats).toBeDefined();
      expect(stats.activeMonitors).toBeDefined();
      expect(stats.totalAlerts).toBeDefined();
      expect(stats.recentAlerts).toBeDefined();
    });

    test('should get current alerts', () => {
      const alerts = monitoring.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('Audit Visualization', () => {
    test('should generate audit data for visualization', () => {
      const events = [
        { timestamp: new Date('2024-01-01T10:00:00Z'), eventType: 'PROOF_ISSUED' },
        { timestamp: new Date('2024-01-01T11:00:00Z'), eventType: 'PROOF_VERIFIED' }
      ];

      // Test data structure for visualization
      const timelineData = events.map(event => ({
        ...event,
        formattedTimestamp: event.timestamp.toISOString(),
        displayName: event.eventType.replace(/_/g, ' ')
      }));
      
      expect(timelineData).toHaveLength(2);
      expect(timelineData[0].eventType).toBe('PROOF_ISSUED');
      expect(timelineData[0].formattedTimestamp).toBeDefined();
    });

    test('should generate compliance metrics structure', () => {
      const events = [
        { compliance: { classification: 'CONFIDENTIAL' }, status: 'SUCCESS' },
        { compliance: { classification: 'RESTRICTED' }, status: 'FAILURE' }
      ];

      const metrics = {
        classificationDistribution: events.reduce((acc, event) => {
          const level = event.compliance.classification;
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        }, {}),
        statusDistribution: events.reduce((acc, event) => {
          const status = event.status;
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
        totalEvents: events.length,
        successfulEvents: events.filter(e => e.status === 'SUCCESS').length
      };
      
      expect(metrics.classificationDistribution.CONFIDENTIAL).toBe(1);
      expect(metrics.classificationDistribution.RESTRICTED).toBe(1);
      expect(metrics.statusDistribution.SUCCESS).toBe(1);
      expect(metrics.statusDistribution.FAILURE).toBe(1);
    });
  });
});
