import { Request } from 'express';
import { logger } from '../utils/logger';
import { redisService } from '../services/redisService';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  enableRedis: boolean;
  redisKeyPrefix: string;
  enableDistributedLimiting: boolean;
  enableBurstProtection: boolean;
  burstLimit: number;
  enableAdaptiveLimiting: boolean;
  enableUserBasedLimiting: boolean;
  enableEndpointBasedLimiting: boolean;
  enableGeoBasedLimiting: boolean;
  enableTimeBasedLimiting: boolean;
}

export interface RateLimitRule {
  id: string;
  name: string;
  description?: string;
  conditions: {
    path?: string;
    method?: string;
    user?: string;
    role?: string;
    ip?: string;
    geo?: string[];
    timeWindow?: {
      start: string;
      end: string;
      timezone?: string;
    };
  };
  limits: {
    requests: number;
    window: number;
    burst?: number;
  };
  strategy: 'fixed' | 'sliding' | 'token-bucket' | 'leaky-bucket' | 'adaptive';
  priority: number;
  enabled: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  limit: number;
  windowMs: number;
  strategy: string;
  ruleId?: string;
  metadata?: {
    ip: string;
    userId?: string;
    endpoint?: string;
    currentUsage: number;
    totalRequests: number;
    violationCount: number;
  };
}

export interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  violationsByRule: Record<string, number>;
  violationsByIP: Record<string, number>;
  violationsByUser: Record<string, number>;
  violationsByEndpoint: Record<string, number>;
  averageResponseTime: number;
  peakLoad: number;
  currentLoad: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private rules: Map<string, RateLimitRule> = new Map();
  private localStore: Map<string, any> = new Map();
  private metrics: RateLimitMetrics;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: 60000,
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      enableRedis: true,
      redisKeyPrefix: 'rate_limit:',
      enableDistributedLimiting: true,
      enableBurstProtection: true,
      burstLimit: 10,
      enableAdaptiveLimiting: false,
      enableUserBasedLimiting: true,
      enableEndpointBasedLimiting: true,
      enableGeoBasedLimiting: false,
      enableTimeBasedLimiting: false,
      ...config,
    };

    this.initializeMetrics();
    this.startCleanupInterval();
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      violationsByRule: {},
      violationsByIP: {},
      violationsByUser: {},
      violationsByEndpoint: {},
      averageResponseTime: 0,
      peakLoad: 0,
      currentLoad: 0,
    };
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  public addRule(rule: RateLimitRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Rate limit rule added: ${rule.id}`);
  }

  public removeRule(ruleId: string): void {
    if (this.rules.delete(ruleId)) {
      logger.info(`Rate limit rule removed: ${ruleId}`);
    }
  }

  public getRule(ruleId: string): RateLimitRule | undefined {
    return this.rules.get(ruleId);
  }

  public getAllRules(): RateLimitRule[] {
    return Array.from(this.rules.values());
  }

  public async checkLimit(req: Request, customLimit?: { requests: number; window: number; burst?: number }): Promise<RateLimitResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    this.metrics.currentLoad++;

    try {
      // Find matching rules
      const matchingRules = this.findMatchingRules(req);
      
      if (matchingRules.length === 0 && !customLimit) {
        // No rules match, allow request
        this.metrics.allowedRequests++;
        return this.createAllowResult(0, 0);
      }

      // Apply the most restrictive rule
      const rule = matchingRules.length > 0 ? matchingRules[0] : null;
      const limit = customLimit || (rule ? rule.limits : { requests: this.config.maxRequests, window: this.config.windowMs });

      // Generate key for rate limiting
      const key = this.generateKey(req, rule);
      
      // Check limit based on strategy
      let result: RateLimitResult;
      if (rule) {
        result = await this.checkLimitByStrategy(key, limit, rule.strategy, req);
        result.ruleId = rule.id;
      } else {
        result = await this.checkLimitByStrategy(key, limit, 'fixed', req);
      }

      // Add metadata
      result.metadata = {
        ip: this.getClientIP(req),
        userId: this.getUserId(req),
        endpoint: `${req.method}:${req.path}`,
        currentUsage: limit.requests - result.remaining,
        totalRequests: this.metrics.totalRequests,
        violationCount: this.getViolationCount(key),
      };

      // Update metrics
      if (result.allowed) {
        this.metrics.allowedRequests++;
      } else {
        this.metrics.blockedRequests++;
        this.recordViolation(result);
      }

      // Update peak load
      if (this.metrics.currentLoad > this.metrics.peakLoad) {
        this.metrics.peakLoad = this.metrics.currentLoad;
      }

      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      return result;

    } finally {
      this.metrics.currentLoad--;
    }
  }

  private findMatchingRules(req: Request): RateLimitRule[] {
    const matchingRules: RateLimitRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      if (this.matchesRule(req, rule)) {
        matchingRules.push(rule);
      }
    }

    // Sort by priority (higher priority first)
    matchingRules.sort((a, b) => b.priority - a.priority);

    return matchingRules;
  }

  private matchesRule(req: Request, rule: RateLimitRule): boolean {
    const conditions = rule.conditions;

    // Check path
    if (conditions.path && !this.matchesPath(req.path, conditions.path)) {
      return false;
    }

    // Check method
    if (conditions.method && req.method.toLowerCase() !== conditions.method.toLowerCase()) {
      return false;
    }

    // Check user
    if (conditions.user && this.getUserId(req) !== conditions.user) {
      return false;
    }

    // Check role
    if (conditions.role && !this.hasUserRole(req, conditions.role)) {
      return false;
    }

    // Check IP
    if (conditions.ip && !this.matchesIP(this.getClientIP(req), conditions.ip)) {
      return false;
    }

    // Check geo location
    if (conditions.geo && conditions.geo.length > 0) {
      const geo = this.getGeoLocation(req);
      if (!geo || !conditions.geo.includes(geo)) {
        return false;
      }
    }

    // Check time window
    if (conditions.timeWindow && !this.isInTimeWindow(conditions.timeWindow)) {
      return false;
    }

    return true;
  }

  private matchesPath(requestPath: string, rulePath: string): boolean {
    // Simple path matching with wildcards
    if (rulePath.includes('*')) {
      const regex = new RegExp(rulePath.replace(/\*/g, '.*'));
      return regex.test(requestPath);
    }
    return requestPath === rulePath;
  }

  private matchesIP(clientIP: string, ruleIP: string): boolean {
    // Simple IP matching - can be enhanced with CIDR support
    if (ruleIP.includes('*')) {
      const regex = new RegExp(ruleIP.replace(/\*/g, '.*'));
      return regex.test(clientIP);
    }
    return clientIP === ruleIP;
  }

  private hasUserRole(req: Request, requiredRole: string): boolean {
    // Check if user has the required role
    const userRoles = this.getUserRoles(req);
    return userRoles.includes(requiredRole);
  }

  private isInTimeWindow(timeWindow: any): boolean {
    const now = new Date();
    const timezone = timeWindow.timezone || 'UTC';
    
    // Convert times to the specified timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const currentTime = formatter.format(now);
    const currentHour = parseInt(currentTime.split(':')[0]);
    const currentMinute = parseInt(currentTime.split(':')[1]);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = timeWindow.start.split(':').map(Number);
    const [endHour, endMinute] = timeWindow.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Crosses midnight
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  private generateKey(req: Request, rule?: RateLimitRule): string {
    const parts: string[] = [];

    if (this.config.enableUserBasedLimiting && this.getUserId(req)) {
      parts.push(`user:${this.getUserId(req)}`);
    } else {
      parts.push(`ip:${this.getClientIP(req)}`);
    }

    if (this.config.enableEndpointBasedLimiting) {
      parts.push(`endpoint:${req.method}:${req.path}`);
    }

    if (rule) {
      parts.push(`rule:${rule.id}`);
    }

    if (this.config.enableGeoBasedLimiting) {
      const geo = this.getGeoLocation(req);
      if (geo) {
        parts.push(`geo:${geo}`);
      }
    }

    return parts.join(':');
  }

  private async checkLimitByStrategy(
    key: string,
    limit: { requests: number; window: number; burst?: number },
    strategy: string,
    req: Request
  ): Promise<RateLimitResult> {
    switch (strategy) {
      case 'fixed':
        return await this.fixedWindowCounter(key, limit);
      case 'sliding':
        return await this.slidingWindowCounter(key, limit);
      case 'token-bucket':
        return await this.tokenBucket(key, limit);
      case 'leaky-bucket':
        return await this.leakyBucket(key, limit);
      case 'adaptive':
        return await this.adaptiveRateLimit(key, limit, req);
      default:
        return await this.fixedWindowCounter(key, limit);
    }
  }

  private async fixedWindowCounter(key: string, limit: { requests: number; window: number }): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / limit.window) * limit.window;
    const windowEnd = windowStart + limit.window;

    const storeKey = `${key}:fixed:${windowStart}`;

    if (this.config.enableRedis) {
      return await this.redisFixedWindow(storeKey, limit, windowEnd);
    } else {
      return await this.localFixedWindow(storeKey, limit, windowEnd);
    }
  }

  private async slidingWindowCounter(key: string, limit: { requests: number; window: number }): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - limit.window;

    const storeKey = `${key}:sliding`;

    if (this.config.enableRedis) {
      return await this.redisSlidingWindow(storeKey, limit, windowStart, now);
    } else {
      return await this.localSlidingWindow(storeKey, limit, windowStart, now);
    }
  }

  private async tokenBucket(key: string, limit: { requests: number; window: number; burst?: number }): Promise<RateLimitResult> {
    const now = Date.now();
    const burstLimit = limit.burst || this.config.burstLimit;
    const refillRate = limit.requests / limit.window; // tokens per millisecond

    const storeKey = `${key}:token_bucket`;

    if (this.config.enableRedis) {
      return await this.redisTokenBucket(storeKey, limit, burstLimit, refillRate, now);
    } else {
      return await this.localTokenBucket(storeKey, limit, burstLimit, refillRate, now);
    }
  }

  private async leakyBucket(key: string, limit: { requests: number; window: number }): Promise<RateLimitResult> {
    const now = Date.now();
    const leakRate = limit.requests / limit.window; // requests per millisecond

    const storeKey = `${key}:leaky_bucket`;

    if (this.config.enableRedis) {
      return await this.redisLeakyBucket(storeKey, limit, leakRate, now);
    } else {
      return await this.localLeakyBucket(storeKey, limit, leakRate, now);
    }
  }

  private async adaptiveRateLimit(key: string, limit: { requests: number; window: number }, req: Request): Promise<RateLimitResult> {
    // Adaptive rate limiting based on system load and user behavior
    const systemLoad = this.metrics.currentLoad / this.metrics.peakLoad;
    const userBehavior = this.getUserBehaviorScore(req);
    
    const adaptiveFactor = Math.max(0.1, 1 - systemLoad * 0.5 - userBehavior * 0.3);
    const adaptiveLimit = Math.floor(limit.requests * adaptiveFactor);

    return await this.fixedWindowCounter(key, {
      requests: adaptiveLimit,
      window: limit.window,
    });
  }

  // Redis implementations
  private async redisFixedWindow(key: string, limit: { requests: number; window: number }, resetTime: number): Promise<RateLimitResult> {
    try {
      const current = await redisService.incr(key);
      
      if (current === 1) {
        await redisService.expire(key, Math.ceil(limit.window / 1000));
      }

      const allowed = current <= limit.requests;
      const remaining = Math.max(0, limit.requests - current);

      return {
        allowed,
        remaining,
        resetTime,
        limit: limit.requests,
        windowMs: limit.window,
        strategy: 'fixed',
        retryAfter: allowed ? undefined : Math.ceil((resetTime - Date.now()) / 1000),
      };
    } catch (error) {
      logger.error('Redis fixed window error:', error);
      return this.createAllowResult(limit.requests, limit.window);
    }
  }

  private async redisSlidingWindow(key: string, limit: { requests: number; window: number }, windowStart: number, now: number): Promise<RateLimitResult> {
    try {
      // Remove old entries
      await redisService.zremrangebyscore(key, 0, windowStart);

      // Add current request
      await redisService.zadd(key, now, now);

      // Count requests in window
      const current = await redisService.zcard(key);

      // Set expiration
      await redisService.expire(key, Math.ceil(limit.window / 1000));

      const allowed = current <= limit.requests;
      const remaining = Math.max(0, limit.requests - current);
      const resetTime = now + limit.window;

      return {
        allowed,
        remaining,
        resetTime,
        limit: limit.requests,
        windowMs: limit.window,
        strategy: 'sliding',
        retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000),
      };
    } catch (error) {
      logger.error('Redis sliding window error:', error);
      return this.createAllowResult(limit.requests, limit.window);
    }
  }

  private async redisTokenBucket(key: string, limit: { requests: number; window: number }, burstLimit: number, refillRate: number, now: number): Promise<RateLimitResult> {
    try {
      const script = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local burst_limit = tonumber(ARGV[3])
        local ttl = tonumber(ARGV[4])
        
        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or burst_limit
        local last_refill = tonumber(bucket[2]) or now
        
        -- Refill tokens
        local elapsed = now - last_refill
        tokens = math.min(burst_limit, tokens + elapsed * refill_rate)
        
        local allowed = tokens >= 1
        if allowed then
          tokens = tokens - 1
        end
        
        -- Update bucket
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, ttl)
        
        return {tokens, allowed}
      `;

      const result = await redisService.eval(script, [key], [now, refillRate, burstLimit, Math.ceil(limit.window / 1000)]);
      const tokens = result[0];
      const allowed = result[1];

      return {
        allowed,
        remaining: Math.floor(tokens),
        resetTime: now + limit.window,
        limit: burstLimit,
        windowMs: limit.window,
        strategy: 'token-bucket',
        retryAfter: allowed ? undefined : Math.ceil(limit.window / 1000),
      };
    } catch (error) {
      logger.error('Redis token bucket error:', error);
      return this.createAllowResult(limit.requests, limit.window);
    }
  }

  private async redisLeakyBucket(key: string, limit: { requests: number; window: number }, leakRate: number, now: number): Promise<RateLimitResult> {
    try {
      const script = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local leak_rate = tonumber(ARGV[2])
        local ttl = tonumber(ARGV[3])
        
        local bucket = redis.call('HMGET', key, 'queue', 'last_leak')
        local queue = cjson.decode(bucket[1] or '[]')
        local last_leak = tonumber(bucket[2]) or now
        
        -- Leak requests
        local elapsed = now - last_leak
        local leaked = math.floor(elapsed * leak_rate)
        if leaked > 0 then
          for i = 1, math.min(leaked, #queue) do
            table.remove(queue, 1)
          end
          last_leak = now
        end
        
        local allowed = #queue < 10  -- Max queue size
        if allowed then
          table.insert(queue, now)
        end
        
        -- Update bucket
        redis.call('HMSET', key, 'queue', cjson.encode(queue), 'last_leak', last_leak)
        redis.call('EXPIRE', key, ttl)
        
        return {#queue, allowed}
      `;

      const result = await redisService.eval(script, [key], [now, leakRate, Math.ceil(limit.window / 1000)]);
      const queueSize = result[0];
      const allowed = result[1];

      return {
        allowed,
        remaining: Math.max(0, 10 - queueSize),
        resetTime: now + limit.window,
        limit: 10,
        windowMs: limit.window,
        strategy: 'leaky-bucket',
        retryAfter: allowed ? undefined : Math.ceil(limit.window / 1000),
      };
    } catch (error) {
      logger.error('Redis leaky bucket error:', error);
      return this.createAllowResult(limit.requests, limit.window);
    }
  }

  // Local implementations (fallback when Redis is not available)
  private async localFixedWindow(key: string, limit: { requests: number; window: number }, resetTime: number): Promise<RateLimitResult> {
    const current = (this.localStore.get(key) || 0) + 1;
    this.localStore.set(key, current);

    // Clean up expired entries
    setTimeout(() => {
      this.localStore.delete(key);
    }, limit.window);

    const allowed = current <= limit.requests;
    const remaining = Math.max(0, limit.requests - current);

    return {
      allowed,
      remaining,
      resetTime,
      limit: limit.requests,
      windowMs: limit.window,
      strategy: 'fixed',
      retryAfter: allowed ? undefined : Math.ceil((resetTime - Date.now()) / 1000),
    };
  }

  private async localSlidingWindow(key: string, limit: { requests: number; window: number }, windowStart: number, now: number): Promise<RateLimitResult> {
    const requests = this.localStore.get(key) || [];
    
    // Remove old requests
    const validRequests = requests.filter((timestamp: number) => timestamp > windowStart);
    validRequests.push(now);
    
    this.localStore.set(key, validRequests);

    const current = validRequests.length;
    const allowed = current <= limit.requests;
    const remaining = Math.max(0, limit.requests - current);
    const resetTime = now + limit.window;

    return {
      allowed,
      remaining,
      resetTime,
      limit: limit.requests,
      windowMs: limit.window,
      strategy: 'sliding',
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000),
    };
  }

  private async localTokenBucket(key: string, limit: { requests: number; window: number }, burstLimit: number, refillRate: number, now: number): Promise<RateLimitResult> {
    const bucket = this.localStore.get(key) || { tokens: burstLimit, lastRefill: now };
    
    // Refill tokens
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(burstLimit, bucket.tokens + elapsed * refillRate);
    bucket.lastRefill = now;

    const allowed = bucket.tokens >= 1;
    if (allowed) {
      bucket.tokens -= 1;
    }

    this.localStore.set(key, bucket);

    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      resetTime: now + limit.window,
      limit: burstLimit,
      windowMs: limit.window,
      strategy: 'token-bucket',
      retryAfter: allowed ? undefined : Math.ceil(limit.window / 1000),
    };
  }

  private async localLeakyBucket(key: string, limit: { requests: number; window: number }, leakRate: number, now: number): Promise<RateLimitResult> {
    const bucket = this.localStore.get(key) || { queue: [], lastLeak: now };
    
    // Leak requests
    const elapsed = now - bucket.lastLeak;
    const leaked = Math.floor(elapsed * leakRate);
    if (leaked > 0) {
      bucket.queue = bucket.queue.slice(leaked);
      bucket.lastLeak = now;
    }

    const allowed = bucket.queue.length < 10;
    if (allowed) {
      bucket.queue.push(now);
    }

    this.localStore.set(key, bucket);

    return {
      allowed,
      remaining: Math.max(0, 10 - bucket.queue.length),
      resetTime: now + limit.window,
      limit: 10,
      windowMs: limit.window,
      strategy: 'leaky-bucket',
      retryAfter: allowed ? undefined : Math.ceil(limit.window / 1000),
    };
  }

  private createAllowResult(limit: number, window: number): RateLimitResult {
    return {
      allowed: true,
      remaining: limit,
      resetTime: Date.now() + window,
      limit,
      windowMs: window,
      strategy: 'fallback',
    };
  }

  private recordViolation(result: RateLimitResult): void {
    if (result.ruleId) {
      this.metrics.violationsByRule[result.ruleId] = (this.metrics.violationsByRule[result.ruleId] || 0) + 1;
    }

    if (result.metadata?.ip) {
      this.metrics.violationsByIP[result.metadata.ip] = (this.metrics.violationsByIP[result.metadata.ip] || 0) + 1;
    }

    if (result.metadata?.userId) {
      this.metrics.violationsByUser[result.metadata.userId] = (this.metrics.violationsByUser[result.metadata.userId] || 0) + 1;
    }

    if (result.metadata?.endpoint) {
      this.metrics.violationsByEndpoint[result.metadata.endpoint] = (this.metrics.violationsByEndpoint[result.metadata.endpoint] || 0) + 1;
    }
  }

  private getViolationCount(key: string): number {
    // Simple violation count tracking
    return 0;
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalRequests = this.metrics.allowedRequests + this.metrics.blockedRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  private cleanupExpiredEntries(): void {
    if (!this.config.enableRedis) {
      // Clean up local store
      const now = Date.now();
      for (const [key, value] of this.localStore.entries()) {
        if (key.includes('sliding') && Array.isArray(value)) {
          const validRequests = value.filter((timestamp: number) => timestamp > now - 60000);
          if (validRequests.length === 0) {
            this.localStore.delete(key);
          } else {
            this.localStore.set(key, validRequests);
          }
        }
      }
    }
  }

  // Helper methods
  private getClientIP(req: Request): string {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
           '127.0.0.1';
  }

  private getUserId(req: Request): string | undefined {
    return req.headers['x-user-id'] as string || 
           (req as any).user?.id || 
           (req as any).session?.userId;
  }

  private getUserRoles(req: Request): string[] {
    return (req as any).user?.roles || [];
  }

  private getGeoLocation(req: Request): string | undefined {
    // Simple geo location detection - in production, use a proper geo IP service
    const ip = this.getClientIP(req);
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return 'internal';
    }
    return 'unknown';
  }

  private getUserBehaviorScore(req: Request): number {
    // Simple behavior scoring - in production, use machine learning
    return 0.1;
  }

  // Public methods
  public async getMetrics(): Promise<RateLimitMetrics> {
    return { ...this.metrics };
  }

  public async resetMetrics(): Promise<void> {
    this.initializeMetrics();
    logger.info('RateLimiter metrics reset');
  }

  public clearLocalStore(): void {
    this.localStore.clear();
    logger.info('RateLimiter local store cleared');
  }

  public getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('RateLimiter configuration updated');
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.localStore.clear();
    logger.info('RateLimiter destroyed');
  }
}
