const { AlertService } = require('../services/alertService');

describe('AlertService', () => {
  let alertService;

  beforeEach(() => {
    alertService = new AlertService();
  });

  describe('evaluateAndCreateAlert', () => {
    const mockValidationScore = {
      proofId: 'test-proof-123',
      proofHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      issuerAddress: '0x1234567890123456789012345678901234567890',
      validationScore: 0.3, // High risk
      confidenceLevel: 0.85,
      riskLevel: 'high',
      suspiciousPatterns: ['high_frequency_activity', 'low_issuer_reputation'],
      modelVersion: '1.0.0',
      features: {
        hashComplexity: 0.8,
        timestampAnomaly: 0.7,
        issuerReputation: 0.2, // Low reputation
        contentSimilarity: 0.6,
        networkActivity: 0.8, // High activity
        geographicAnomaly: 0.3,
        frequencyPattern: 0.9, // High frequency
        sizeAnomaly: 0.4
      },
      explainability: {
        primaryReasons: ['Low issuer reputation', 'High frequency activity'],
        featureImportance: {
          issuerReputation: 0.25,
          networkActivity: 0.15,
          frequencyPattern: 0.05
        },
        similarCases: [
          { proofId: 'similar-1', similarity: 0.85, outcome: 'high' },
          { proofId: 'similar-2', similarity: 0.75, outcome: 'medium' }
        ]
      },
      metadata: {
        validationTime: 150,
        processingTime: 120,
        modelLatency: 30,
        timestamp: new Date()
      }
    };

    it('should create alert for high risk validation', async () => {
      const alert = await alertService.evaluateAndCreateAlert(mockValidationScore);

      expect(alert).toBeTruthy();
      expect(alert.proofId).toBe(mockValidationScore.proofId);
      expect(alert.riskScore).toBe(mockValidationScore.validationScore);
      expect(alert.confidence).toBe(mockValidationScore.confidenceLevel);
      expect(alert.severity).toBe('high');
      expect(alert.status).toBe('open');
      expect(alert.suspiciousPatterns).toEqual(mockValidationScore.suspiciousPatterns);
    });

    it('should create critical alert for very low validation score', async () => {
      const criticalScore = {
        ...mockValidationScore,
        validationScore: 0.1,
        riskLevel: 'critical'
      };

      const alert = await alertService.evaluateAndCreateAlert(criticalScore);

      expect(alert.severity).toBe('critical');
      expect(alert.alertType).toBe('critical_threat');
    });

    it('should not create alert for low risk validation', async () => {
      const lowRiskScore = {
        ...mockValidationScore,
        validationScore: 0.9,
        riskLevel: 'low',
        suspiciousPatterns: []
      };

      const alert = await alertService.evaluateAndCreateAlert(lowRiskScore);

      expect(alert).toBeNull();
    });

    it('should create alert for suspicious patterns', async () => {
      const suspiciousScore = {
        ...mockValidationScore,
        validationScore: 0.7, // Medium score
        riskLevel: 'medium',
        suspiciousPatterns: ['high_frequency_activity', 'low_issuer_reputation', 'unusual_timestamp']
      };

      const alert = await alertService.evaluateAndCreateAlert(suspiciousScore);

      expect(alert).toBeTruthy();
      expect(alert.severity).toBe('medium');
      expect(alert.alertType).toBe('suspicious_pattern');
    });
  });

  describe('getAlerts', () => {
    beforeEach(async () => {
      // Create some test alerts
      const mockValidationScore = {
        proofId: 'test-proof',
        validationScore: 0.3,
        riskLevel: 'high',
        suspiciousPatterns: ['test']
      };

      await alertService.evaluateAndCreateAlert(mockValidationScore);
    });

    it('should return all alerts', async () => {
      const alerts = await alertService.getAlerts();

      expect(Array.isArray(alerts)).toBe(true);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should filter alerts by severity', async () => {
      const highAlerts = await alertService.getAlerts({ severity: 'high' });

      highAlerts.forEach(alert => {
        expect(alert.severity).toBe('high');
      });
    });

    it('should filter alerts by status', async () => {
      const openAlerts = await alertService.getAlerts({ status: 'open' });

      openAlerts.forEach(alert => {
        expect(alert.status).toBe('open');
      });
    });

    it('should filter alerts by issuer address', async () => {
      const issuerAlerts = await alertService.getAlerts({ 
        issuerAddress: '0x1234567890123456789012345678901234567890' 
      });

      issuerAlerts.forEach(alert => {
        expect(alert.issuerAddress).toBe('0x1234567890123456789012345678901234567890');
      });
    });

    it('should limit results', async () => {
      const limitedAlerts = await alertService.getAlerts({ limit: 5 });

      expect(limitedAlerts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('updateAlertStatus', () => {
    let testAlert;

    beforeEach(async () => {
      const mockValidationScore = {
        proofId: 'test-proof-update',
        validationScore: 0.3,
        riskLevel: 'high',
        suspiciousPatterns: ['test']
      };

      testAlert = await alertService.evaluateAndCreateAlert(mockValidationScore);
    });

    it('should update alert status to investigating', async () => {
      const updatedAlert = await alertService.updateAlertStatus(
        testAlert.id,
        'investigating',
        'security-team'
      );

      expect(updatedAlert.status).toBe('investigating');
      expect(updatedAlert.assignedTo).toBe('security-team');
      expect(updatedAlert.updatedAt).toBeInstanceOf(Date);
    });

    it('should update alert status to resolved', async () => {
      const updatedAlert = await alertService.updateAlertStatus(
        testAlert.id,
        'resolved',
        'security-team',
        'False positive - legitimate proof'
      );

      expect(updatedAlert.status).toBe('resolved');
      expect(updatedAlert.resolutionNotes).toBe('False positive - legitimate proof');
      expect(updatedAlert.resolvedAt).toBeInstanceOf(Date);
    });

    it('should update alert status to false positive', async () => {
      const updatedAlert = await alertService.updateAlertStatus(
        testAlert.id,
        'false_positive',
        'security-team',
        'Model misclassification'
      );

      expect(updatedAlert.status).toBe('false_positive');
      expect(updatedAlert.resolutionNotes).toBe('Model misclassification');
    });

    it('should return null for non-existent alert', async () => {
      const result = await alertService.updateAlertStatus('non-existent', 'resolved');

      expect(result).toBeNull();
    });
  });

  describe('getAlertStats', () => {
    it('should return alert statistics for 24h', async () => {
      const stats = await alertService.getAlertStats('24h');

      expect(stats).toHaveProperty('timeRange', '24h');
      expect(stats).toHaveProperty('totalAlerts');
      expect(stats).toHaveProperty('severityDistribution');
      expect(stats).toHaveProperty('statusDistribution');
      expect(stats).toHaveProperty('typeDistribution');
      expect(stats).toHaveProperty('averageResolutionTime');

      expect(typeof stats.totalAlerts).toBe('number');
      expect(typeof stats.severityDistribution).toBe('object');
      expect(typeof stats.statusDistribution).toBe('object');
      expect(typeof stats.averageResolutionTime).toBe('number');
    });

    it('should handle different time ranges', async () => {
      const timeRanges = ['1h', '24h', '7d', '30d'];

      for (const range of timeRanges) {
        const stats = await alertService.getAlertStats(range);
        expect(stats.timeRange).toBe(range);
      }
    });
  });

  describe('alert rules', () => {
    it('should create custom alert rule', async () => {
      const customRule = {
        name: 'Custom High Risk Rule',
        description: 'Alert for custom high risk conditions',
        conditions: {
          riskLevelThreshold: 0.3
        },
        severity: 'high',
        enabled: true,
        notificationChannels: ['email']
      };

      const createdRule = await alertService.createCustomRule(customRule);

      expect(createdRule.id).toBeTruthy();
      expect(createdRule.name).toBe(customRule.name);
      expect(createdRule.conditions).toEqual(customRule.conditions);
      expect(createdRule.severity).toBe(customRule.severity);
      expect(createdRule.enabled).toBe(customRule.enabled);
    });

    it('should update existing rule', async () => {
      const customRule = {
        name: 'Rule to Update',
        conditions: { riskLevelThreshold: 0.5 },
        severity: 'medium',
        enabled: true,
        notificationChannels: []
      };

      const createdRule = await alertService.createCustomRule(customRule);
      const updates = {
        name: 'Updated Rule Name',
        enabled: false
      };

      const updatedRule = await alertService.updateRule(createdRule.id, updates);

      expect(updatedRule.name).toBe('Updated Rule Name');
      expect(updatedRule.enabled).toBe(false);
      expect(updatedRule.conditions).toEqual(customRule.conditions); // Should remain unchanged
    });

    it('should delete rule', async () => {
      const customRule = {
        name: 'Rule to Delete',
        conditions: {},
        severity: 'low',
        enabled: true,
        notificationChannels: []
      };

      const createdRule = await alertService.createCustomRule(customRule);
      const deleted = await alertService.deleteRule(createdRule.id);

      expect(deleted).toBe(true);

      const rules = await alertService.getRules();
      const deletedRule = rules.find(r => r.id === createdRule.id);
      expect(deletedRule).toBeUndefined();
    });

    it('should get all rules', async () => {
      const rules = await alertService.getRules();

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);

      // Check that default rules exist
      const ruleNames = rules.map(r => r.name);
      expect(ruleNames).toContain('Critical Risk Detection');
      expect(ruleNames).toContain('High Risk Detection');
      expect(ruleNames).toContain('Suspicious Pattern Detection');
    });
  });

  describe('notification channels', () => {
    it('should initialize default notification channels', () => {
      const channels = alertService.notificationChannels;

      expect(channels.has('email')).toBe(true);
      expect(channels.has('slack')).toBe(true);
      expect(channels.has('webhook')).toBe(true);

      const emailChannel = channels.get('email');
      expect(emailChannel.type).toBe('email');
      expect(emailChannel.enabled).toBe(true);
    });
  });

  describe('pattern description', () => {
    it('should return descriptions for suspicious patterns', () => {
      const patterns = [
        'unusual_timestamp',
        'high_frequency_activity',
        'low_issuer_reputation',
        'suspicious_hash_pattern',
        'unusual_content_size'
      ];

      patterns.forEach(pattern => {
        const description = alertService.getPatternDescription(pattern);
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });

    it('should return pattern name for unknown patterns', () => {
      const unknownPattern = 'unknown_pattern';
      const description = alertService.getPatternDescription(unknownPattern);

      expect(description).toBe(unknownPattern);
    });
  });

  describe('alert type determination', () => {
    it('should determine correct alert types', () => {
      const testCases = [
        { score: 0.1, expectedType: 'critical_threat' },
        { score: 0.3, expectedType: 'high_risk' },
        { score: 0.7, expectedType: 'suspicious_pattern' },
        { score: 0.9, expectedType: 'anomaly_detected' }
      ];

      testCases.forEach(({ score, expectedType }) => {
        const mockValidationScore = {
          validationScore: score,
          suspiciousPatterns: score < 0.7 ? ['test'] : []
        };

        const alertType = alertService.determineAlertType(
          { conditions: { riskLevelThreshold: 0.5 } },
          mockValidationScore
        );

        expect(alertType).toBe(expectedType);
      });
    });
  });
});
