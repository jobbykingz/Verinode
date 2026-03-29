import { getRedisClient } from '../config/redis.ts';

export class ResponseCache {
  private static instance: ResponseCache;
  private redis = getRedisClient();

  private constructor() {}

  public static getInstance(): ResponseCache {
    if (!ResponseCache.instance) {
      ResponseCache.instance = new ResponseCache();
    }
    return ResponseCache.instance;
  }

  public async getCachedResponse(key: string): Promise<any | null> {
    const cached = await this.redis.get(`graphql-cache:${key}`);
    return cached ? JSON.parse(cached) : null;
  }

  public async setCachedResponse(key: string, data: any, ttlInSeconds: number = 300): Promise<void> {
    await this.redis.set(`graphql-cache:${key}`, JSON.stringify(data), 'EX', ttlInSeconds);
  }

  public async invalidateCache(pattern: string): Promise<void> {
    const keys = await this.redis.keys(`graphql-cache:${pattern}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  public async getCacheMetrics(): Promise<{ size: number; keys: string[] }> {
    const keys = await this.redis.keys('graphql-cache:*');
    return {
      size: keys.length,
      keys
    };
  }
}
