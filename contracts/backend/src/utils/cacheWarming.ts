import { cacheService } from '../services/cacheService';

export interface CacheWarmupEntry {
  key: string;
  value: any;
  options?: {
    ttl?: number;
    keyPrefix?: string;
    tags?: string[];
  };
}

export class CacheWarmingService {
  async warmProofVerification(proofId: string, verificationData: any): Promise<void> {
    try {
      await cacheService.set(`verification:${proofId}`, verificationData, {
        ttl: 1800, // 30 minutes
        keyPrefix: 'proof',
        tags: ['proof-verification']
      });
    } catch (error) {
      console.error(`Proof verification warming error for ${proofId}:`, error);
      throw error;
    }
  }

  async warmUserProofs(userId: string, userProofs: any[]): Promise<void> {
    try {
      await cacheService.set(`proofs:${userId}`, userProofs, {
        ttl: 3600, // 1 hour
        keyPrefix: 'user',
        tags: ['user-proofs']
      });
    } catch (error) {
      console.error(`User proofs warming error for ${userId}:`, error);
      throw error;
    }
  }

  async warmAnalytics(analyticsData: any): Promise<void> {
    try {
      await cacheService.set('stats:overview', analyticsData, {
        ttl: 300, // 5 minutes
        keyPrefix: 'analytics',
        tags: ['analytics']
      });
    } catch (error) {
      console.error('Analytics warming error:', error);
      throw error;
    }
  }

  async warmPopularProofs(popularProofs: any[]): Promise<void> {
    try {
      const entries: CacheWarmupEntry[] = popularProofs.map(proof => ({
        key: `verification:${proof.id}`,
        value: proof.verificationData,
        options: {
          ttl: 3600, // 1 hour
          keyPrefix: 'proof',
          tags: ['proof-verification', 'popular-proofs']
        }
      }));

      await cacheService.warmCache(entries);
    } catch (error) {
      console.error('Popular proofs warming error:', error);
      throw error;
    }
  }

  async warmUserProfiles(userProfiles: any[]): Promise<void> {
    try {
      const entries: CacheWarmupEntry[] = userProfiles.map(profile => ({
        key: `profile:${profile.userId}`,
        value: profile,
        options: {
          ttl: 7200, // 2 hours
          keyPrefix: 'user',
          tags: ['user-profiles']
        }
      }));

      await cacheService.warmCache(entries);
    } catch (error) {
      console.error('User profiles warming error:', error);
      throw error;
    }
  }

  async warmSystemConfig(configData: any): Promise<void> {
    try {
      await cacheService.set('system:config', configData, {
        ttl: 86400, // 24 hours
        keyPrefix: 'system',
        tags: ['system-config']
      });
    } catch (error) {
      console.error('System config warming error:', error);
      throw error;
    }
  }

  async warmCustomEntries(entries: CacheWarmupEntry[]): Promise<void> {
    try {
      await cacheService.warmCache(entries);
    } catch (error) {
      console.error('Custom entries warming error:', error);
      throw error;
    }
  }

  async warmAllCriticalData(): Promise<void> {
    try {
      // This would typically fetch data from your database
      // For now, we'll provide a template structure
      console.log('Starting critical data warmup...');

      // Example warmup calls (would need actual data fetching)
      // await this.warmPopularProofs(await this.getPopularProofs());
      // await this.warmAnalytics(await this.getAnalyticsData());
      // await this.warmSystemConfig(await this.getSystemConfig());

      console.log('Critical data warmup completed');
    } catch (error) {
      console.error('Critical data warmup error:', error);
      throw error;
    }
  }

  async schedulePeriodicWarmup(intervalMinutes: number = 60): Promise<void> {
    try {
      setInterval(async () => {
        try {
          await this.warmAllCriticalData();
        } catch (error) {
          console.error('Periodic warmup error:', error);
        }
      }, intervalMinutes * 60 * 1000);

      console.log(`Periodic warmup scheduled every ${intervalMinutes} minutes`);
    } catch (error) {
      console.error('Periodic warmup scheduling error:', error);
      throw error;
    }
  }

  async getWarmupStatus(): Promise<{
    lastWarmup: Date | null;
    nextWarmup: Date | null;
    warmedKeys: string[];
    totalWarmed: number;
  }> {
    try {
      // This would typically track warmup status in Redis or database
      return {
        lastWarmup: null,
        nextWarmup: null,
        warmedKeys: [],
        totalWarmed: 0
      };
    } catch (error) {
      console.error('Warmup status error:', error);
      return {
        lastWarmup: null,
        nextWarmup: null,
        warmedKeys: [],
        totalWarmed: 0
      };
    }
  }

  // Helper methods that would need to be implemented based on your data sources
  private async getPopularProofs(): Promise<any[]> {
    // Implementation would fetch popular proofs from database
    return [];
  }

  private async getAnalyticsData(): Promise<any> {
    // Implementation would fetch analytics data from database
    return {};
  }

  private async getSystemConfig(): Promise<any> {
    // Implementation would fetch system config from database
    return {};
  }
}

export const cacheWarmingService = new CacheWarmingService();
export default cacheWarmingService;
