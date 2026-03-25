import { ValidationScore, IValidationScore } from '../models/ValidationScore';
import { TrainingData, ITrainingData } from '../models/TrainingData';

export interface ValidationRequest {
  proofId: string;
  proofHash: string;
  issuerAddress: string;
  eventData: any;
  timestamp: Date;
  ipfsCid?: string;
  ipfsSize?: number;
  stellarTxId?: string;
}

export interface ValidationResult {
  proofId: string;
  validationScore: number;
  confidenceLevel: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suspiciousPatterns: string[];
  explainability: {
    primaryReasons: string[];
    featureImportance: { [key: string]: number };
    similarCases: Array<{
      proofId: string;
      similarity: number;
      outcome: string;
    }>;
  };
  processingTime: number;
  modelVersion: string;
  requiresReview: boolean;
}

export class MLValidationService {
  private modelVersion: string = '1.0.0';
  private readonly RISK_THRESHOLDS = {
    low: 0.8,
    medium: 0.6,
    high: 0.4,
    critical: 0.0
  };

  async validateProof(request: ValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Extract features from the proof
      const features = await this.extractFeatures(request);
      
      // Run ML model prediction
      const prediction = await this.runMLModel(features);
      
      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(prediction.score);
      
      // Generate explainability
      const explainability = await this.generateExplainability(features, prediction, request);
      
      // Detect suspicious patterns
      const suspiciousPatterns = await this.detectSuspiciousPatterns(features, request);
      
      const processingTime = Date.now() - startTime;
      
      // Save validation result
      await this.saveValidationResult({
        proofId: request.proofId,
        proofHash: request.proofHash,
        issuerAddress: request.issuerAddress,
        validationScore: prediction.score,
        confidenceLevel: prediction.confidence,
        riskLevel,
        suspiciousPatterns,
        modelVersion: this.modelVersion,
        features,
        explainability,
        metadata: {
          validationTime: processingTime,
          processingTime: prediction.modelLatency,
          modelLatency: prediction.modelLatency,
          timestamp: new Date()
        }
      } as IValidationScore);

      return {
        proofId: request.proofId,
        validationScore: prediction.score,
        confidenceLevel: prediction.confidence,
        riskLevel,
        suspiciousPatterns,
        explainability,
        processingTime,
        modelVersion: this.modelVersion,
        requiresReview: prediction.score < this.RISK_THRESHOLDS.medium
      };
      
    } catch (error) {
      console.error('ML validation failed:', error);
      throw new Error(`ML validation failed: ${error.message}`);
    }
  }

  private async extractFeatures(request: ValidationRequest): Promise<any> {
    const features = {
      hashComplexity: await this.calculateHashComplexity(request.proofHash),
      timestampAnomaly: await this.calculateTimestampAnomaly(request.timestamp),
      issuerReputation: await this.calculateIssuerReputation(request.issuerAddress),
      contentSimilarity: await this.calculateContentSimilarity(request.eventData),
      networkActivity: await this.calculateNetworkActivity(request.issuerAddress),
      geographicAnomaly: await this.calculateGeographicAnomaly(request.issuerAddress),
      frequencyPattern: await this.calculateFrequencyPattern(request.issuerAddress, request.timestamp),
      sizeAnomaly: await this.calculateSizeAnomaly(request.ipfsSize)
    };

    return features;
  }

  private async calculateHashComplexity(hash: string): Promise<number> {
    // Calculate entropy and character distribution
    const uniqueChars = new Set(hash).size;
    const entropy = (uniqueChars / hash.length) * Math.log2(hash.length);
    return Math.min(entropy / 4, 1); // Normalize to 0-1
  }

  private async calculateTimestampAnomaly(timestamp: Date): Promise<number> {
    const now = new Date();
    const hoursDiff = Math.abs(now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    
    // Anomaly increases with very recent or very old timestamps
    if (hoursDiff < 1) return 0.8; // Very recent (potential bot activity)
    if (hoursDiff > 24 * 30) return 0.6; // Very old (potential stale data)
    return 0.1; // Normal timeframe
  }

  private async calculateIssuerReputation(address: string): Promise<number> {
    // Mock reputation calculation based on historical data
    // In production, this would query blockchain activity and validation history
    const historicalValidations = await ValidationScore.countDocuments({ issuerAddress: address });
    const suspiciousCount = await ValidationScore.countDocuments({ 
      issuerAddress: address, 
      riskLevel: { $in: ['high', 'critical'] } 
    });
    
    if (historicalValidations === 0) return 0.5; // Unknown issuer
    
    const suspiciousRatio = suspiciousCount / historicalValidations;
    return Math.max(0, 1 - suspiciousRatio);
  }

  private async calculateContentSimilarity(eventData: any): Promise<number> {
    // Calculate similarity to known patterns
    const dataString = JSON.stringify(eventData);
    const commonPatterns = ['certificate', 'degree', 'achievement', 'completion'];
    
    let similarityScore = 0;
    commonPatterns.forEach(pattern => {
      if (dataString.toLowerCase().includes(pattern)) {
        similarityScore += 0.2;
      }
    });
    
    return Math.min(similarityScore, 1);
  }

  private async calculateNetworkActivity(address: string): Promise<number> {
    // Mock network activity analysis
    // In production, this would analyze blockchain transaction patterns
    const recentActivity = await ValidationScore.countDocuments({
      issuerAddress: address,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    // High activity might indicate automated/bot behavior
    if (recentActivity > 100) return 0.8;
    if (recentActivity > 50) return 0.5;
    if (recentActivity > 10) return 0.2;
    return 0.1;
  }

  private async calculateGeographicAnomaly(address: string): Promise<number> {
    // Mock geographic analysis
    // In production, this would use IP geolocation and blockchain node data
    return Math.random() * 0.3; // Low random anomaly for demo
  }

  private async calculateFrequencyPattern(address: string, timestamp: Date): Promise<number> {
    // Analyze submission frequency patterns
    const recentSubmissions = await ValidationScore.find({
      issuerAddress: address,
      createdAt: { 
        $gte: new Date(timestamp.getTime() - 24 * 60 * 60 * 1000),
        $lte: timestamp 
      }
    }).sort({ createdAt: 1 });
    
    if (recentSubmissions.length < 2) return 0.1;
    
    // Calculate time intervals between submissions
    const intervals = [];
    for (let i = 1; i < recentSubmissions.length; i++) {
      const interval = recentSubmissions[i].createdAt.getTime() - recentSubmissions[i-1].createdAt.getTime();
      intervals.push(interval);
    }
    
    // Regular intervals might indicate automation
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    
    // Low variance = regular pattern = higher anomaly
    return Math.min(1 / (1 + variance / (60 * 60 * 1000)), 1);
  }

  private async calculateSizeAnomaly(size?: number): Promise<number> {
    if (!size) return 0.5; // Unknown size
    
    // Analyze size distribution
    const avgSize = 1024; // 1KB average
    const sizeRatio = size / avgSize;
    
    if (sizeRatio > 10) return 0.8; // Very large
    if (sizeRatio > 5) return 0.5;  // Large
    if (sizeRatio < 0.1) return 0.6; // Very small
    return 0.1; // Normal size
  }

  private async runMLModel(features: any): Promise<{ score: number; confidence: number; modelLatency: number }> {
    const startTime = Date.now();
    
    // Mock ML model prediction
    // In production, this would call a real ML model (TensorFlow, PyTorch, etc.)
    const weightedSum = 
      features.hashComplexity * 0.15 +
      features.timestampAnomaly * 0.20 +
      features.issuerReputation * 0.25 +
      features.contentSimilarity * 0.10 +
      features.networkActivity * 0.15 +
      features.geographicAnomaly * 0.05 +
      features.frequencyPattern * 0.05 +
      features.sizeAnomaly * 0.05;
    
    // Apply non-linear transformation
    const score = 1 / (1 + Math.exp(-5 * (weightedSum - 0.5)));
    const confidence = 0.8 + Math.random() * 0.2; // Mock confidence
    const modelLatency = Date.now() - startTime;
    
    return { score, confidence, modelLatency };
  }

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.RISK_THRESHOLDS.low) return 'low';
    if (score >= this.RISK_THRESHOLDS.medium) return 'medium';
    if (score >= this.RISK_THRESHOLDS.high) return 'high';
    return 'critical';
  }

  private async generateExplainability(features: any, prediction: any, request: ValidationRequest): Promise<any> {
    const featureImportance = {
      hashComplexity: features.hashComplexity * 0.15,
      timestampAnomaly: features.timestampAnomaly * 0.20,
      issuerReputation: features.issuerReputation * 0.25,
      contentSimilarity: features.contentSimilarity * 0.10,
      networkActivity: features.networkActivity * 0.15,
      geographicAnomaly: features.geographicAnomaly * 0.05,
      frequencyPattern: features.frequencyPattern * 0.05,
      sizeAnomaly: features.sizeAnomaly * 0.05
    };

    const primaryReasons = [];
    const sortedFeatures = Object.entries(featureImportance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    sortedFeatures.forEach(([feature, importance]) => {
      if (importance > 0.1) {
        if (features[feature] > 0.7) {
          primaryReasons.push(`High ${feature} detected`);
        } else if (features[feature] < 0.3) {
          primaryReasons.push(`Low ${feature} detected`);
        }
      }
    });

    // Find similar cases
    const similarCases = await ValidationScore.find({
      issuerAddress: { $ne: request.issuerAddress }
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('proofId riskLevel validationScore')
    .then(scores => scores.map(score => ({
      proofId: score.proofId,
      similarity: Math.random() * 0.5 + 0.5, // Mock similarity
      outcome: score.riskLevel
    })));

    return {
      primaryReasons,
      featureImportance,
      similarCases
    };
  }

  private async detectSuspiciousPatterns(features: any, request: ValidationRequest): Promise<string[]> {
    const patterns = [];

    if (features.timestampAnomaly > 0.7) {
      patterns.push('unusual_timestamp');
    }
    if (features.networkActivity > 0.7) {
      patterns.push('high_frequency_activity');
    }
    if (features.frequencyPattern > 0.7) {
      patterns.push('regular_submission_pattern');
    }
    if (features.issuerReputation < 0.3) {
      patterns.push('low_issuer_reputation');
    }
    if (features.hashComplexity < 0.2) {
      patterns.push('suspicious_hash_pattern');
    }
    if (features.sizeAnomaly > 0.7) {
      patterns.push('unusual_content_size');
    }

    return patterns;
  }

  private async saveValidationResult(result: IValidationScore): Promise<void> {
    try {
      await ValidationScore.findOneAndUpdate(
        { proofId: result.proofId },
        result,
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('Failed to save validation result:', error);
      throw error;
    }
  }

  async getValidationHistory(issuerAddress?: string, limit: number = 100): Promise<IValidationScore[]> {
    const query = issuerAddress ? { issuerAddress } : {};
    return ValidationScore.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getValidationStats(timeRange: string = '24h'): Promise<any> {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const stats = await ValidationScore.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 },
          avgScore: { $avg: '$validationScore' }
        }
      }
    ]);

    const totalValidations = await ValidationScore.countDocuments({
      createdAt: { $gte: startDate }
    });

    return {
      timeRange,
      totalValidations,
      riskDistribution: stats,
      averageScore: await ValidationScore.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: null, avgScore: { $avg: '$validationScore' } } }
      ]).then(result => result[0]?.avgScore || 0)
    };
  }
}
