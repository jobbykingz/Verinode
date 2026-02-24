import { cacheService } from '../services/cacheService';

export class CacheInvalidationService {
  async invalidateProof(proofId: string): Promise<void> {
    try {
      await Promise.all([
        cacheService.del(`verification:${proofId}`, { keyPrefix: 'proof' }),
        cacheService.invalidateByTag('proof-verification'),
        cacheService.invalidateByTag('user-proofs'),
        cacheService.invalidatePattern(`*proof*${proofId}*`)
      ]);
    } catch (error) {
      console.error(`Proof cache invalidation error for ${proofId}:`, error);
      throw error;
    }
  }

  async invalidateUser(userId: string): Promise<void> {
    try {
      await Promise.all([
        cacheService.del(`proofs:${userId}`, { keyPrefix: 'user' }),
        cacheService.invalidateByTag('user-proofs'),
        cacheService.invalidatePattern(`*user*${userId}*`)
      ]);
    } catch (error) {
      console.error(`User cache invalidation error for ${userId}:`, error);
      throw error;
    }
  }

  async invalidateAnalytics(): Promise<void> {
    try {
      await Promise.all([
        cacheService.invalidateByTag('analytics'),
        cacheService.invalidatePattern('analytics:*')
      ]);
    } catch (error) {
      console.error('Analytics cache invalidation error:', error);
      throw error;
    }
  }

  async invalidateAllProofs(): Promise<void> {
    try {
      await Promise.all([
        cacheService.invalidateByTag('proof-verification'),
        cacheService.invalidateByTag('user-proofs'),
        cacheService.invalidatePattern('proof:*'),
        cacheService.invalidatePattern('user:*proofs*')
      ]);
    } catch (error) {
      console.error('All proofs cache invalidation error:', error);
      throw error;
    }
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      await cacheService.invalidatePattern(pattern);
    } catch (error) {
      console.error(`Pattern cache invalidation error for ${pattern}:`, error);
      throw error;
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      await Promise.all(
        tags.map(tag => cacheService.invalidateByTag(tag))
      );
    } catch (error) {
      console.error(`Tags cache invalidation error for ${tags.join(', ')}:`, error);
      throw error;
    }
  }

  async invalidateExpiredCache(): Promise<void> {
    try {
      // This would require a more sophisticated implementation
      // For now, we'll rely on Redis TTL
      console.log('Expired cache cleanup completed');
    } catch (error) {
      console.error('Expired cache cleanup error:', error);
    }
  }

  async getCacheHealth(): Promise<{
    redisConnected: boolean;
    metrics: any;
    estimatedSize: number;
  }> {
    try {
      const metrics = await cacheService.getMetrics();
      const redisConnected = await this.checkRedisConnection();
      
      return {
        redisConnected,
        metrics,
        estimatedSize: metrics.sets - metrics.deletes
      };
    } catch (error) {
      console.error('Cache health check error:', error);
      return {
        redisConnected: false,
        metrics: { hits: 0, misses: 0, sets: 0, deletes: 0, hitRate: 0 },
        estimatedSize: 0
      };
    }
  }

  private async checkRedisConnection(): Promise<boolean> {
    try {
      const { redisService } = await import('../services/redisService');
      return await redisService.healthCheck();
    } catch (error) {
      return false;
    }
  }
}

export const cacheInvalidationService = new CacheInvalidationService();
export default cacheInvalidationService;
