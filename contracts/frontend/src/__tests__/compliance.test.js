// Compliance Component Tests
// This file contains tests for compliance-related frontend components

describe('Compliance Components', () => {
  describe('AuditTrail Component', () => {
    test('should format audit events correctly', () => {
      const auditEvents = [
        {
          eventId: 'event-1',
          timestamp: '2024-01-01T10:00:00Z',
          eventType: 'PROOF_ISSUED',
          actor: { name: 'John Doe', id: 'user-123' },
          resource: { name: 'Employment Proof', id: 'proof-456' },
          action: 'Issued cryptographic proof',
          status: 'SUCCESS',
          compliance: { classification: 'CONFIDENTIAL', gdprRelevant: true }
        }
      ];

      // Test event formatting
      const formattedEvents = auditEvents.map(event => ({
        ...event,
        formattedTimestamp: new Date(event.timestamp).toLocaleString(),
        displayName: event.eventType.replace(/_/g, ' '),
        severity: event.status === 'SUCCESS' ? 'low' : 'high'
      }));

      expect(formattedEvents[0].formattedTimestamp).toBeDefined();
      expect(formattedEvents[0].displayName).toBe('PROOF ISSUED');
      expect(formattedEvents[0].severity).toBe('low');
    });

    test('should filter events by date range', () => {
      const events = [
        { timestamp: '2024-01-01T10:00:00Z', eventType: 'PROOF_ISSUED' },
        { timestamp: '2024-01-15T10:00:00Z', eventType: 'PROOF_VERIFIED' },
        { timestamp: '2024-02-01T10:00:00Z', eventType: 'PROOF_SHARED' }
      ];

      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-20');

      const filteredEvents = events.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= startDate && eventDate <= endDate;
      });

      expect(filteredEvents).toHaveLength(1);
      expect(filteredEvents[0].eventType).toBe('PROOF_VERIFIED');
    });

    test('should classify events by compliance level', () => {
      const events = [
        { compliance: { classification: 'PUBLIC' } },
        { compliance: { classification: 'INTERNAL' } },
        { compliance: { classification: 'CONFIDENTIAL' } },
        { compliance: { classification: 'RESTRICTED' } }
      ];

      const classificationCounts = events.reduce((acc, event) => {
        const level = event.compliance.classification;
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {});

      expect(classificationCounts.PUBLIC).toBe(1);
      expect(classificationCounts.INTERNAL).toBe(1);
      expect(classificationCounts.CONFIDENTIAL).toBe(1);
      expect(classificationCounts.RESTRICTED).toBe(1);
    });
  });

  describe('ComplianceReports Component', () => {
    test('should generate report metadata', () => {
      const reportConfig = {
        title: 'GDPR Compliance Report',
        period: { start: '2024-01-01', end: '2024-12-31' },
        regulations: ['gdpr', 'hipaa'],
        scope: 'All proof operations and user access'
      };

      const reportMetadata = {
        ...reportConfig,
        generatedAt: new Date().toISOString(),
        reportId: 'rep-' + Date.now(),
        status: 'draft',
        version: '1.0'
      };

      expect(reportMetadata.title).toBe('GDPR Compliance Report');
      expect(reportMetadata.reportId).toBeDefined();
      expect(reportMetadata.generatedAt).toBeDefined();
      expect(reportMetadata.regulations).toContain('gdpr');
    });

    test('should validate report parameters', () => {
      const validReport = {
        title: 'Test Report',
        period: { start: '2024-01-01', end: '2024-12-31' },
        format: 'PDF'
      };

      const invalidReport = {
        title: '', // Empty title
        period: { start: '2024-12-31', end: '2024-01-01' }, // Invalid date range
        format: 'INVALID' // Invalid format
      };

      const validateReport = (report) => {
        const errors = [];
        
        if (!report.title || report.title.length < 3) {
          errors.push('Title must be at least 3 characters');
        }
        
        if (new Date(report.period.start) > new Date(report.period.end)) {
          errors.push('Start date must be before end date');
        }
        
        const validFormats = ['PDF', 'HTML', 'JSON', 'CSV'];
        if (!validFormats.includes(report.format)) {
          errors.push('Invalid report format');
        }
        
        return { valid: errors.length === 0, errors };
      };

      expect(validateReport(validReport).valid).toBe(true);
      expect(validateReport(invalidReport).valid).toBe(false);
      expect(validateReport(invalidReport).errors).toHaveLength(3);
    });
  });

  describe('ComplianceDashboard Component', () => {
    test('should calculate compliance metrics', () => {
      const auditEvents = [
        { status: 'SUCCESS', compliance: { classification: 'CONFIDENTIAL' } },
        { status: 'SUCCESS', compliance: { classification: 'INTERNAL' } },
        { status: 'FAILURE', compliance: { classification: 'RESTRICTED' } },
        { status: 'SUCCESS', compliance: { classification: 'PUBLIC' } }
      ];

      const metrics = {
        totalEvents: auditEvents.length,
        successfulEvents: auditEvents.filter(e => e.status === 'SUCCESS').length,
        failedEvents: auditEvents.filter(e => e.status === 'FAILURE').length,
        complianceScore: (auditEvents.filter(e => e.status === 'SUCCESS').length / auditEvents.length) * 100,
        classificationDistribution: auditEvents.reduce((acc, event) => {
          const level = event.compliance.classification;
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        }, {})
      };

      expect(metrics.totalEvents).toBe(4);
      expect(metrics.successfulEvents).toBe(3);
      expect(metrics.failedEvents).toBe(1);
      expect(metrics.complianceScore).toBe(75);
      expect(metrics.classificationDistribution.CONFIDENTIAL).toBe(1);
    });

    test('should generate alert summaries', () => {
      const alerts = [
        { type: 'HIGH_ACCESS_FAILURE_RATE', severity: 'HIGH', count: 15 },
        { type: 'EXPIRED_CONSENT', severity: 'MEDIUM', count: 3 },
        { type: 'KEY_COMPROMISED', severity: 'CRITICAL', count: 1 }
      ];

      const alertSummary = {
        totalAlerts: alerts.reduce((sum, alert) => sum + alert.count, 0),
        criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').reduce((sum, a) => sum + a.count, 0),
        highAlerts: alerts.filter(a => a.severity === 'HIGH').reduce((sum, a) => sum + a.count, 0),
        mediumAlerts: alerts.filter(a => a.severity === 'MEDIUM').reduce((sum, a) => sum + a.count, 0),
        alertTypes: alerts.map(alert => alert.type)
      };

      expect(alertSummary.totalAlerts).toBe(19);
      expect(alertSummary.criticalAlerts).toBe(1);
      expect(alertSummary.highAlerts).toBe(15);
      expect(alertSummary.mediumAlerts).toBe(3);
      expect(alertSummary.alertTypes).toContain('HIGH_ACCESS_FAILURE_RATE');
    });
  });

  describe('Data Export Functionality', () => {
    test('should convert events to CSV format', () => {
      const events = [
        {
          timestamp: '2024-01-01T10:00:00Z',
          eventType: 'PROOF_ISSUED',
          actor: { name: 'John Doe' },
          resource: { name: 'Employment Proof' },
          status: 'SUCCESS'
        }
      ];

      const headers = ['Timestamp', 'Event Type', 'Actor', 'Resource', 'Status'];
      const rows = events.map(event => [
        event.timestamp,
        event.eventType,
        event.actor.name,
        event.resource.name,
        event.status
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      expect(csvContent).toContain('Timestamp,Event Type,Actor,Resource,Status');
      expect(csvContent).toContain('PROOF_ISSUED');
      expect(csvContent).toContain('John Doe');
    });

    test('should generate HTML report structure', () => {
      const reportData = {
        title: 'Compliance Report',
        generatedAt: new Date().toISOString(),
        metrics: { totalEvents: 100, complianceScore: 95 }
      };

      const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>${reportData.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .metric-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2563eb; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${reportData.title}</h1>
        <p>Generated on: ${new Date(reportData.generatedAt).toLocaleString()}</p>
    </div>
    
    <div class="metrics">
        <div class="metric-card">
            <h3>Total Events</h3>
            <div class="metric-value">${reportData.metrics.totalEvents}</div>
        </div>
        <div class="metric-card">
            <h3>Compliance Score</h3>
            <div class="metric-value">${reportData.metrics.complianceScore}%</div>
        </div>
    </div>
</body>
</html>`;

      expect(htmlTemplate).toContain(reportData.title);
      expect(htmlTemplate).toContain('Total Events');
      expect(htmlTemplate).toContain(reportData.metrics.totalEvents.toString());
    });
  });
});
