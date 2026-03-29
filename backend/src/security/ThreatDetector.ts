import ThreatPattern, { IThreatPattern } from '../models/ThreatPattern.ts';
import { getRedisClient } from '../config/redis.ts';

export class ThreatDetector {
  private static instance: ThreatDetector;
  private redis = getRedisClient();

  private constructor() {}

  public static getInstance(): ThreatDetector {
    if (!ThreatDetector.instance) {
      ThreatDetector.instance = new ThreatDetector();
    }
    return ThreatDetector.instance;
  }

  public async analyzeRequest(request: {
    ip: string;
    userId?: string;
    path: string;
    headers: Record<string, string>;
    body: any;
    geo?: string;
  }): Promise<{ isThreat: boolean; severity: string; score: number }> {
    // 1. Basic Signature Matching (Historical database)
    const knownThreats = await ThreatPattern.find({ isActive: true });
    
    // 2. Mock AI Behavioral Analysis
    const requestEntropy = this.calculateEntropy(JSON.stringify(request));
    const isAnomaly = requestEntropy > 0.8; // Example threshold

    // 3. Frequency Analysis (using Redis)
    const recentRequests = await this.redis.get(`requests:${request.ip}`);
    
    let threatScore = isAnomaly ? 0.6 : 0;
    
    // 4. Heuristic-based detection
    if (this.isLikelySqlInjection(request.body)) threatScore += 0.5;
    if (this.isLikelyBruteForce(request.ip)) threatScore += 0.4;

    const isThreat = threatScore > 0.7;
    const severity = threatScore > 0.9 ? 'critical' : threatScore > 0.7 ? 'high' : 'medium';

    if (isThreat) {
      await this.logThreat(request, severity, threatScore);
    }

    return { isThreat, severity, score: threatScore };
  }

  private calculateEntropy(str: string): number {
    const len = str.length;
    const frequencies: Record<string, number> = {};
    for (let i = 0; i < len; i++) {
      const char = str[i];
      frequencies[char] = (frequencies[char] || 0) + 1;
    }
    return Object.values(frequencies).reduce((acc, freq) => {
      const p = freq / len;
      return acc - p * Math.log2(p);
    }, 0) / 8; // Normalized
  }

  private isLikelySqlInjection(body: any): boolean {
    const sqlRegex = /('|"|;|\/\*|\*\/|union|select|insert|update|delete|drop)/i;
    return sqlRegex.test(JSON.stringify(body));
  }

  private isLikelyBruteForce(ip: string): boolean {
    // Mock logic: checks Redis for failed login attempts
    return false;
  }

  private async logThreat(request: any, severity: string, score: number) {
    await ThreatPattern.create({
      patternType: 'behavioral_anomaly',
      signature: `${request.ip}:${request.path}:${Date.now()}`,
      severity,
      confidence: score,
      metadata: { request }
    });
  }

  public async getTrustScore(userId: string): Promise<number> {
    const threats = await ThreatPattern.find({ 'metadata.request.userId': userId });
    const score = 100 - (threats.length * 5);
    return Math.max(0, score);
  }
}
