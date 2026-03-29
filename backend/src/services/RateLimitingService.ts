import { AdaptiveRateLimiter } from '../security/AdaptiveRateLimiter.ts';
import { ThreatDetector } from '../security/ThreatDetector.ts';

export class RateLimitingService {
  private static instance: RateLimitingService;
  private adaptiveLimit = AdaptiveRateLimiter.getInstance();
  private threatDetector = ThreatDetector.getInstance();

  private constructor() {}

  public static getInstance(): RateLimitingService {
    if (!RateLimitingService.instance) {
      RateLimitingService.instance = new RateLimitingService();
    }
    return RateLimitingService.instance;
  }

  public async checkRequest(userId: string, request: {
    ip: string;
    path: string;
    headers: Record<string, string>;
    body: any;
    tier: 'free' | 'premium' | 'enterprise';
    geo?: string;
  }): Promise<{ allowed: boolean; retryAfter?: number; headers?: Record<string, string> }> {
    // 1. Analyze for AI-based threats
    const { isThreat, severity, score } = await this.threatDetector.analyzeRequest(request);
    
    // 2. Block critical threats immediately (Adaptive Rate Limit)
    if (isThreat && (severity === 'high' || severity === 'critical' || score > 0.9)) {
       return { allowed: false, retryAfter: 3600 }; // Block for 1 hour
    }

    // 3. Get adaptive limits based on trust, geo, tier, etc.
    const { limit, window } = await this.adaptiveLimit.getLimit(userId, request.tier, request.geo);
    
    // 4. Increment and check counts in Redis
    const currentCount = await this.adaptiveLimit.increment(`rl:${userId}:${request.path}`, window);

    const isAllowed = currentCount <= limit;
    const remaining = Math.max(0, limit - currentCount);

    return {
      allowed: isAllowed,
      retryAfter: !isAllowed ? window : undefined,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': (Date.now() + window * 1000).toString(),
        'X-Threat-Score': score.toString(),
        'X-User-Tier': request.tier
      }
    };
  }

  public async getClientTrustProfile(userId: string) {
    const trustScore = await this.threatDetector.getTrustScore(userId);
    return {
      userId,
      trustScore,
      riskLevel: trustScore > 80 ? 'low' : trustScore > 50 ? 'medium' : 'high'
    };
  }
}
