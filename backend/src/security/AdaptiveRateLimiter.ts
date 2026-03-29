import { getRedisClient } from '../config/redis.ts';
import { ThreatDetector } from './ThreatDetector.ts';

export class AdaptiveRateLimiter {
  private static instance: AdaptiveRateLimiter;
  private redis = getRedisClient();
  private threatDetector = ThreatDetector.getInstance();

  private constructor() {}

  public static getInstance(): AdaptiveRateLimiter {
    if (!AdaptiveRateLimiter.instance) {
      AdaptiveRateLimiter.instance = new AdaptiveRateLimiter();
    }
    return AdaptiveRateLimiter.instance;
  }

  public async getLimit(userId: string, tier: 'free' | 'premium' | 'enterprise', geo?: string): Promise<{ limit: number; window: number }> {
    const trustScore = await this.threatDetector.getTrustScore(userId);

    // 1. Tier-based base limit
    let baseLimit = 1000; // Free
    if (tier === 'premium') baseLimit = 10000;
    if (tier === 'enterprise') baseLimit = 100000;

    // 2. Trust score adaptation (reduced limits for low trust)
    const trustFactor = trustScore / 100;
    let adaptedLimit = baseLimit * trustFactor;

    // 3. Geographic-based limits (restricted countries get lower limits)
    if (this.isRestrictedGeo(geo)) {
      adaptedLimit *= 0.5;
    }

    // 4. Time-based (peak hour reduction)
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      adaptedLimit *= 0.8; // Peak hours: 20% reduction
    }

    return { limit: Math.round(adaptedLimit), window: 3600 };
  }

  private isRestrictedGeo(geo: string | undefined): boolean {
    const restrictedGeos = ['restricted_country1', 'restricted_country2'];
    return !!geo && restrictedGeos.includes(geo);
  }

  public async increment(key: string, window: number): Promise<number> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, window);
    const results = await multi.exec();
    return results ? (results[0][1] as number) : 0;
  }
}
