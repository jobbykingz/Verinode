import { RedisCluster } from './RedisCluster';

interface CacheOptions { ttl?: number; level?: 'L1' | 'L2' | 'BOTH'; }

export class CacheManager {
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();
  private analytics = { hitsL1: 0, hitsL2: 0, misses: 0, invalidations: 0 };

  constructor(private redisCluster: RedisCluster) {
    this.redisCluster.on('message', (channel, message) => {
      if (channel === 'cache_invalidate') {
        this.memoryCache.delete(message); // Sync invalidation across instances
      }
    });
  }

  public async get<T>(key: string): Promise<T | null> {
    // L1 Check
    const memData = this.memoryCache.get(key);
    if (memData && memData.expiry > Date.now()) {
      this.analytics.hitsL1++;
      return memData.value as T;
    } else if (memData) {
      this.memoryCache.delete(key);
    }

    // L2 Check
    const redisData = await this.redisCluster.get(key);
    if (redisData) {
      this.analytics.hitsL2++;
      const parsed = JSON.parse(redisData);
      this.memoryCache.set(key, { value: parsed, expiry: Date.now() + 60000 }); // Repopulate L1
      return parsed as T;
    }

    this.analytics.misses++;
    return null;
  }

  public async set(key: string, value: any, options: CacheOptions = { level: 'BOTH' }): Promise<void> {
    const ttl = options.ttl || 3600;
    
    if (options.level === 'L1' || options.level === 'BOTH') {
      this.memoryCache.set(key, { value, expiry: Date.now() + (ttl * 1000) });
    }

    if (options.level === 'L2' || options.level === 'BOTH') {
      await this.redisCluster.set(key, JSON.stringify(value), ttl);
    }
  }

  public async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.redisCluster.del(key);
    await this.redisCluster.publish('cache_invalidate', key);
    this.analytics.invalidations++;
  }

  public getAnalytics() { return this.analytics; }
}