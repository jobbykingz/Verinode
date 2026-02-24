const { MLValidationService } = require('../services/mlValidationService');
const { ValidationScore } = require('../models/ValidationScore');
const { TrainingData } = require('../models/TrainingData');

// Mock the models
jest.mock('../models/ValidationScore');
jest.mock('../models/TrainingData');

describe('MLValidationService', () => {
  let mlValidationService;

  beforeEach(() => {
    mlValidationService = new MLValidationService();
    jest.clearAllMocks();
  });

  describe('validateProof', () => {
    const mockValidationRequest = {
      proofId: 'test-proof-123',
      proofHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      issuerAddress: '0x1234567890123456789012345678901234567890',
      eventData: { type: 'certificate', name: 'Test Certificate' },
      timestamp: new Date(),
      ipfsCid: 'QmTest123',
      ipfsSize: 1024,
      stellarTxId: 'tx-test-123'
    };

    it('should validate a proof successfully', async () => {
      // Mock the saveValidationResult method
      mlValidationService.saveValidationResult = jest.fn().mockResolvedValue(true);

      const result = await mlValidationService.validateProof(mockValidationRequest);

      expect(result).toHaveProperty('proofId', mockValidationRequest.proofId);
      expect(result).toHaveProperty('validationScore');
      expect(result).toHaveProperty('confidenceLevel');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('suspiciousPatterns');
      expect(result).toHaveProperty('explainability');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('modelVersion');
      expect(result).toHaveProperty('requiresReview');
      expect(typeof result.validationScore).toBe('number');
      expect(result.validationScore).toBeGreaterThanOrEqual(0);
      expect(result.validationScore).toBeLessThanOrEqual(1);
    });

    it('should extract features correctly', async () => {
      const features = await mlValidationService.extractFeatures(mockValidationRequest);

      expect(features).toHaveProperty('hashComplexity');
      expect(features).toHaveProperty('timestampAnomaly');
      expect(features).toHaveProperty('issuerReputation');
      expect(features).toHaveProperty('contentSimilarity');
      expect(features).toHaveProperty('networkActivity');
      expect(features).toHaveProperty('geographicAnomaly');
      expect(features).toHaveProperty('frequencyPattern');
      expect(features).toHaveProperty('sizeAnomaly');

      // Check that all feature values are between 0 and 1
      Object.values(features).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('should calculate hash complexity correctly', async () => {
      const complexity = await mlValidationService.calculateHashComplexity('abcdef123456');
      expect(typeof complexity).toBe('number');
      expect(complexity).toBeGreaterThanOrEqual(0);
      expect(complexity).toBeLessThanOrEqual(1);
    });

    it('should calculate timestamp anomaly correctly', async () => {
      const now = new Date();
      const oldTimestamp = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const recentTimestamp = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago

      const oldAnomaly = await mlValidationService.calculateTimestampAnomaly(oldTimestamp);
      const recentAnomaly = await mlValidationService.calculateTimestampAnomaly(recentTimestamp);

      expect(oldAnomaly).toBeGreaterThan(recentAnomaly);
    });

    it('should calculate risk level correctly', () => {
      expect(mlValidationService.calculateRiskLevel(0.9)).toBe('low');
      expect(mlValidationService.calculateRiskLevel(0.7)).toBe('medium');
      expect(mlValidationService.calculateRiskLevel(0.5)).toBe('high');
      expect(mlValidationService.calculateRiskLevel(0.2)).toBe('critical');
    });

    it('should handle validation errors gracefully', async () => {
      // Mock an error in feature extraction
      mlValidationService.extractFeatures = jest.fn().mockRejectedValue(new Error('Feature extraction failed'));

      await expect(mlValidationService.validateProof(mockValidationRequest))
        .rejects.toThrow('ML validation failed: Feature extraction failed');
    });
  });

  describe('getValidationHistory', () => {
    it('should return validation history for issuer', async () => {
      const mockHistory = [
        { proofId: 'proof1', issuerAddress: '0x123' },
        { proofId: 'proof2', issuerAddress: '0x123' }
      ];

      ValidationScore.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockHistory)
        })
      });

      const result = await mlValidationService.getValidationHistory('0x123', 100);

      expect(ValidationScore.find).toHaveBeenCalledWith({ issuerAddress: '0x123' });
      expect(result).toEqual(mockHistory);
    });

    it('should return all validation history when no issuer specified', async () => {
      const mockHistory = [
        { proofId: 'proof1', issuerAddress: '0x123' },
        { proofId: 'proof2', issuerAddress: '0x456' }
      ];

      ValidationScore.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockHistory)
        })
      });

      const result = await mlValidationService.getValidationHistory();

      expect(ValidationScore.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getValidationStats', () => {
    it('should return validation statistics for 24h', async () => {
      const mockStats = [
        { _id: 'low', count: 100, avgScore: 0.85 },
        { _id: 'medium', count: 30, avgScore: 0.65 },
        { _id: 'high', count: 15, avgScore: 0.45 },
        { _id: 'critical', count: 5, avgScore: 0.25 }
      ];

      ValidationScore.aggregate
        .mockReturnValueOnce([{ _id: null, avgScore: 0.75 }]) // average score
        .mockReturnValueOnce(mockStats) // risk distribution
        .mockReturnValueOnce(150); // total validations

      const result = await mlValidationService.getValidationStats('24h');

      expect(result).toHaveProperty('timeRange', '24h');
      expect(result).toHaveProperty('totalValidations', 150);
      expect(result).toHaveProperty('riskDistribution');
      expect(result).toHaveProperty('averageScore', 0.75);
    });

    it('should handle different time ranges', async () => {
      ValidationScore.aggregate.mockReturnValue([]);
      ValidationScore.countDocuments.mockResolvedValue(0);

      const timeRanges = ['1h', '24h', '7d', '30d'];

      for (const range of timeRanges) {
        await mlValidationService.getValidationStats(range);
        expect(ValidationScore.aggregate).toHaveBeenCalled();
      }
    });
  });

  describe('feature calculation methods', () => {
    it('should calculate issuer reputation correctly', async () => {
      // Mock ValidationScore responses
      ValidationScore.countDocuments
        .mockResolvedValueOnce(100) // historical validations
        .mockResolvedValueOnce(10); // suspicious validations

      const reputation = await mlValidationService.calculateIssuerReputation('0x123');

      expect(reputation).toBe(0.9); // (100 - 10) / 100
      expect(ValidationScore.countDocuments).toHaveBeenCalledTimes(2);
    });

    it('should handle unknown issuer reputation', async () => {
      ValidationScore.countDocuments.mockResolvedValue(0);

      const reputation = await mlValidationService.calculateIssuerReputation('0xunknown');

      expect(reputation).toBe(0.5); // default for unknown issuer
    });

    it('should calculate content similarity correctly', async () => {
      const eventData = { type: 'certificate', name: 'Test Achievement' };
      const similarity = await mlValidationService.calculateContentSimilarity(eventData);

      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should calculate network activity correctly', async () => {
      ValidationScore.countDocuments.mockResolvedValue(25);

      const activity = await mlValidationService.calculateNetworkActivity('0x123');

      expect(typeof activity).toBe('number');
      expect(activity).toBeGreaterThanOrEqual(0);
      expect(activity).toBeLessThanOrEqual(1);
    });

    it('should calculate frequency pattern correctly', async () => {
      const mockValidations = [
        { createdAt: new Date('2024-01-01T10:00:00Z') },
        { createdAt: new Date('2024-01-01T10:30:00Z') },
        { createdAt: new Date('2024-01-01T11:00:00Z') }
      ];

      ValidationScore.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockValidations)
      });

      const pattern = await mlValidationService.calculateFrequencyPattern('0x123', new Date('2024-01-01T12:00:00Z'));

      expect(typeof pattern).toBe('number');
      expect(pattern).toBeGreaterThanOrEqual(0);
      expect(pattern).toBeLessThanOrEqual(1);
    });

    it('should calculate size anomaly correctly', async () => {
      const normalSize = 1024;
      const largeSize = 10240;
      const smallSize = 100;

      const normalAnomaly = await mlValidationService.calculateSizeAnomaly(normalSize);
      const largeAnomaly = await mlValidationService.calculateSizeAnomaly(largeSize);
      const smallAnomaly = await mlValidationService.calculateSizeAnomaly(smallSize);

      expect(normalAnomaly).toBeLessThan(largeAnomaly);
      expect(normalAnomaly).toBeLessThan(smallAnomaly);
    });
  });

  describe('explainability', () => {
    it('should generate explainability correctly', async () => {
      const features = {
        hashComplexity: 0.8,
        timestampAnomaly: 0.2,
        issuerReputation: 0.9,
        contentSimilarity: 0.7,
        networkActivity: 0.1,
        geographicAnomaly: 0.3,
        frequencyPattern: 0.2,
        sizeAnomaly: 0.4
      };

      const prediction = { score: 0.85, confidence: 0.9, modelLatency: 150 };

      const explainability = await mlValidationService.generateExplainability(features, prediction, mockValidationRequest);

      expect(explainability).toHaveProperty('primaryReasons');
      expect(explainability).toHaveProperty('featureImportance');
      expect(explainability).toHaveProperty('similarCases');
      expect(Array.isArray(explainability.primaryReasons)).toBe(true);
      expect(typeof explainability.featureImportance).toBe('object');
      expect(Array.isArray(explainability.similarCases)).toBe(true);
    });

    it('should detect suspicious patterns correctly', async () => {
      const features = {
        timestampAnomaly: 0.8, // high
        networkActivity: 0.9, // high
        issuerReputation: 0.2, // low
        hashComplexity: 0.1, // low
        sizeAnomaly: 0.8 // high
      };

      const patterns = await mlValidationService.detectSuspiciousPatterns(features, mockValidationRequest);

      expect(patterns).toContain('unusual_timestamp');
      expect(patterns).toContain('high_frequency_activity');
      expect(patterns).toContain('low_issuer_reputation');
      expect(patterns).toContain('suspicious_hash_pattern');
      expect(patterns).toContain('unusual_content_size');
    });
  });
});
