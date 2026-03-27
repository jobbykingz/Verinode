import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { WinstonLogger } from '../utils/logger';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: any, res: any) => void;
  emergencyBypass?: boolean;
  dynamicAdjustment?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
  retryAfter?: number;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestRate: number;
}

export class AdvancedRateLimiter extends EventEmitter {
  private redis: Redis;
  private logger: WinstonLogger;
  private systemMetrics: SystemMetrics;
  private emergencyMode: boolean = false;
  private adjustmentFactor: number = 1.0;

  constructor(redisUrl?: string) {
    super();
    this.redis = new Redis(redisUrl || process.env.REDIS_URL);
    this.logger = new WinstonLogger();
    this.systemMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      activeConnections: 0,
      requestRate: 0
    };
    
    this.startMetricsCollection();
  }

  async checkRateLimit(
    key: string,
    config: RateLimitConfig,
    req?: any,
    res?: any
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Check emergency bypass
    if (config.emergencyBypass && this.emergencyMode) {
      this.logger.info('Emergency bypass activated', { key });
      return {
        allowed: true,
        remaining: config.max,
        resetTime: now + config.windowMs,
        totalHits: 0
      };
    }

    // Apply dynamic adjustment
    let adjustedMax = config.max;
    if (config.dynamicAdjustment) {
      adjustedMax = Math.floor(config.max * this.adjustmentFactor);
    }

    try {
      const pipeline = this.redis.pipeline();
      
      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      
      // Count current requests
      pipeline.zcard(key);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));
      
      const results = await pipeline.exec();
      const totalHits = results?.[2]?.[1] as number || 0;
      
      const allowed = totalHits <= adjustedMax;
      const remaining = Math.max(0, adjustedMax - totalHits);
      const resetTime = now + config.windowMs;
      
      if (!allowed && config.onLimitReached && req && res) {
        config.onLimitReached(req, res);
      }
      
      // Emit event for monitoring
      this.emit('rateLimitChecked', {
        key,
        allowed,
        totalHits,
        remaining,
        adjustedMax,
        timestamp: now
      });
      
      return {
        allowed,
        remaining,
        resetTime,
        totalHits,
        retryAfter: allowed ? undefined : Math.ceil(config.windowMs / 1000)
      };
      
    } catch (error) {
      this.logger.error('Rate limit check failed', { key, error });
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: config.max,
        resetTime: now + config.windowMs,
        totalHits: 0
      };
    }
  }

  async getRateLimitStats(key: string): Promise<{
    currentHits: number;
    resetTime: number;
    oldestRequest?: number;
  }> {
    try {
      const now = Date.now();
      const windowStart = now - (15 * 60 * 1000); // 15 minutes default
      
      const pipeline = this.redis.pipeline();
      pipeline.zcard(key);
      pipeline.zrange(key, 0, 0, 'WITHSCORES');
      pipeline.expire(key, 900); // 15 minutes
      
      const results = await pipeline.exec();
      const currentHits = results?.[0]?.[1] as number || 0;
      const oldestResult = results?.[1]?.[1] as string[] || [];
      const oldestRequest = oldestResult.length > 1 ? parseInt(oldestResult[1]) : undefined;
      
      return {
        currentHits,
        resetTime: oldestRequest ? oldestRequest + (15 * 60 * 1000) : now + (15 * 60 * 1000),
        oldestRequest
      };
    } catch (error) {
      this.logger.error('Failed to get rate limit stats', { key, error });
      return {
        currentHits: 0,
        resetTime: Date.now() + (15 * 60 * 1000)
      };
    }
  }

  async resetRateLimit(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.info('Rate limit reset', { key });
    } catch (error) {
      this.logger.error('Failed to reset rate limit', { key, error });
    }
  }

  setEmergencyMode(enabled: boolean): void {
    this.emergencyMode = enabled;
    this.logger.warn(`Emergency mode ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('emergencyModeChanged', enabled);
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateSystemMetrics();
      this.adjustRateLimits();
    }, 30000); // Update every 30 seconds
  }

  private updateSystemMetrics(): void {
    const usage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    
    this.systemMetrics = {
      cpuUsage: (usage.user + usage.system) / 1000000, // Convert to milliseconds
      memoryUsage: memoryUsage.heapUsed / memoryUsage.heapTotal,
      activeConnections: this.redis.status === 'ready' ? 1 : 0,
      requestRate: 0 // Would be updated by middleware
    };
  }

  private adjustRateLimits(): void {
    const { cpuUsage, memoryUsage } = this.systemMetrics;
    
    // Adjust based on system load
    if (cpuUsage > 80 || memoryUsage > 0.9) {
      this.adjustmentFactor = Math.max(0.5, this.adjustmentFactor - 0.1);
    } else if (cpuUsage < 50 && memoryUsage < 0.7) {
      this.adjustmentFactor = Math.min(1.5, this.adjustmentFactor + 0.05);
    }
    
    this.emit('adjustmentFactorChanged', this.adjustmentFactor);
  }

  async getAnalytics(timeRange: number = 3600000): Promise<{
    totalRequests: number;
    blockedRequests: number;
    topUsers: Array<{ key: string; requests: number }>;
    systemLoad: SystemMetrics;
  }> {
    const now = Date.now();
    const startTime = now - timeRange;
    
    try {
      // Get all rate limit keys
      const keys = await this.redis.keys('rate_limit:*');
      
      let totalRequests = 0;
      let blockedRequests = 0;
      const userRequests: { [key: string]: number } = {};
      
      for (const key of keys) {
        const stats = await this.getRateLimitStats(key);
        totalRequests += stats.currentHits;
        
        const userKey = key.replace('rate_limit:', '');
        userRequests[userKey] = stats.currentHits;
      }
      
      // Sort users by request count
      const topUsers = Object.entries(userRequests)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([key, requests]) => ({ key, requests }));
      
      return {
        totalRequests,
        blockedRequests,
        topUsers,
        systemLoad: this.systemMetrics
      };
    } catch (error) {
      this.logger.error('Failed to get analytics', { error });
      return {
        totalRequests: 0,
        blockedRequests: 0,
        topUsers: [],
        systemLoad: this.systemMetrics
      };
    }
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}
