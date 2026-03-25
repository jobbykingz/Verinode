import { redisService } from './redisService';

export interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
  tags?: string[];
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

export class CacheService {
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly METRICS_KEY = 'cache:metrics';

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const fullKey = this.buildKey(key, options?.keyPrefix);
    
    try {
      const cached = await redisService.get<T>(fullKey);
      
      if (cached !== null) {
        await this.incrementMetric('hits');
        return cached;
      } else {
        await this.incrementMetric('misses');
        return null;
      }
    } catch (error) {
      console.error(`Cache GET error for key ${fullKey}:`, error);
      await this.incrementMetric('misses');
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.keyPrefix);
    const ttl = options?.ttl || this.DEFAULT_TTL;
    
    try {
      await redisService.set(fullKey, value, ttl);
      await this.incrementMetric('sets');
      
      // Store tags for cache invalidation
      if (options?.tags && options.tags.length > 0) {
        await this.storeTags(fullKey, options.tags);
      }
    } catch (error) {
      console.error(`Cache SET error for key ${fullKey}:`, error);
      throw error;
    }
  }

  async del(key: string, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.keyPrefix);
    
    try {
      await redisService.del(fullKey);
      await this.incrementMetric('deletes');
      
      // Remove from tag mappings
      await this.removeTags(fullKey);
    } catch (error) {
      console.error(`Cache DEL error for key ${fullKey}:`, error);
      throw error;
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    try {
      const tagKey = `tag:${tag}`;
      const keys = await redisService.get<string[]>(tagKey) || [];
      
      if (keys.length > 0) {
        await Promise.all(keys.map(key => redisService.del(key)));
        await redisService.del(tagKey);
      }
    } catch (error) {
      console.error(`Cache invalidation error for tag ${tag}:`, error);
      throw error;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      await redisService.invalidatePattern(pattern);
    } catch (error) {
      console.error(`Cache pattern invalidation error for ${pattern}:`, error);
      throw error;
    }
  }

  async getMetrics(): Promise<CacheMetrics> {
    try {
      const metrics = await redisService.get<CacheMetrics>(this.METRICS_KEY);
      
      if (!metrics) {
        return {
          hits: 0,
          misses: 0,
          sets: 0,
          deletes: 0,
          hitRate: 0
        };
      }

      const total = metrics.hits + metrics.misses;
      metrics.hitRate = total > 0 ? (metrics.hits / total) * 100 : 0;
      
      return metrics;
    } catch (error) {
      console.error('Cache metrics error:', error);
      return {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        hitRate: 0
      };
    }
  }

  async resetMetrics(): Promise<void> {
    try {
      await redisService.del(this.METRICS_KEY);
    } catch (error) {
      console.error('Cache metrics reset error:', error);
      throw error;
    }
  }

  async warmCache<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    try {
      await Promise.all(
        entries.map(entry => this.set(entry.key, entry.value, entry.options))
      );
    } catch (error) {
      console.error('Cache warming error:', error);
      throw error;
    }
  }

  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  private async incrementMetric(type: 'hits' | 'misses' | 'sets' | 'deletes'): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      metrics[type]++;
      await redisService.set(this.METRICS_KEY, metrics, 86400); // 24 hours
    } catch (error) {
      console.error(`Metric increment error for ${type}:`, error);
    }
  }

  private async storeTags(key: string, tags: string[]): Promise<void> {
    try {
      await Promise.all(
        tags.map(async (tag) => {
          const tagKey = `tag:${tag}`;
          const existingKeys = await redisService.get<string[]>(tagKey) || [];
          const updatedKeys = [...new Set([...existingKeys, key])];
          await redisService.set(tagKey, updatedKeys, 86400);
        })
      );
    } catch (error) {
      console.error('Tag storage error:', error);
    }
  }

  private async removeTags(key: string): Promise<void> {
    try {
      // Retrieve all tag keys via the redis client directly
      const { redis } = await import('../config/redisConfig');
      const tagKeys = await redis.keys('tag:*');
      if (tagKeys.length === 0) return;

      await Promise.all(
        tagKeys.map(async (tagKey) => {
          const raw = await redis.get(tagKey);
          if (!raw) return;
          const keys: string[] = JSON.parse(raw);
          const updated = keys.filter((k) => k !== key);
          if (updated.length === 0) {
            await redis.del(tagKey);
          } else {
            await redis.set(tagKey, JSON.stringify(updated), 'EX', 86400);
          }
        })
      );
    } catch (error) {
      console.error('Tag removal error:', error);
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;
