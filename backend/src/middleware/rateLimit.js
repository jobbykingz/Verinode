const rateLimit = require('express-rate-limit');
const { WinstonLogger } = require('../utils/logger');
const { RateLimitService } = require('../services/ratelimiting/RateLimitService');
const { RateLimitViolation, RateLimitUser } = require('../models/RateLimit');

class RateLimiterMiddleware {
  constructor(config = {}) {
    this.logger = new WinstonLogger();
    
    // Initialize the advanced rate limit service
    this.rateLimitService = new RateLimitService({
      redisUrl: config.redisUrl || process.env.REDIS_URL,
      enableUserRateLimiting: config.enableUserRateLimiting !== false,
      enableTieredRateLimiting: config.enableTieredRateLimiting !== false,
      enableDynamicAdjustment: config.enableDynamicAdjustment !== false,
      defaultLimits: {
        requestsPerMinute: config.defaultLimits?.requestsPerMinute || 100,
        requestsPerHour: config.defaultLimits?.requestsPerHour || 1000,
        requestsPerDay: config.defaultLimits?.requestsPerDay || 10000
      }
    });

    // Initialize default configurations
    this.initializeDefaultConfigurations();
  }

  async initializeDefaultConfigurations() {
    try {
      // Set up default tier configurations
      await this.setupDefaultTiers();
      
      // Set up dynamic adjustment rules
      await this.setupDynamicRules();
      
      this.logger.info('Rate limit middleware initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize rate limit configurations', { error });
    }
  }

  async setupDefaultTiers() {
    // Example: Set up a premium user
    this.rateLimitService.setUserTier({
      userId: 'premium-user-example',
      tier: 'premium',
      customLimits: {
        '/api/proofs': {
          requestsPerMinute: 200,
          requestsPerHour: 5000,
          requestsPerDay: 50000
        }
      }
    });
  }

  async setupDynamicRules() {
    // Add custom dynamic adjustment rules
    this.rateLimitService.addAdjustmentRule({
      id: 'business-hours-boost',
      name: 'Business Hours Boost',
      description: 'Increase limits during business hours (9 AM - 5 PM)',
      condition: (metrics, context) => {
        const hour = new Date().getHours();
        return hour >= 9 && hour <= 17;
      },
      adjustment: (limits) => ({
        ...limits,
        requestsPerMinute: Math.floor(limits.requestsPerMinute * 1.2),
        requestsPerHour: Math.floor(limits.requestsPerHour * 1.1)
      }),
      priority: 3,
      enabled: true
    });
  }

  getConfig() {
    return {
      general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: {
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          return this.generateKey(req);
        },
        onLimitReached: (req, res) => {
          this.logRateLimitEvent(req, 'general');
        }
      },
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // limit each IP to 5 auth attempts per windowMs
        message: {
          error: 'Too many authentication attempts, please try again later.',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          return this.generateKey(req);
        },
        onLimitReached: (req, res) => {
          this.logRateLimitEvent(req, 'auth');
        }
      },
      sensitive: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // limit each IP to 10 sensitive operations per hour
        message: {
          error: 'Too many sensitive operations, please try again later.',
          retryAfter: '1 hour'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          return this.generateKey(req);
        },
        onLimitReached: (req, res) => {
          this.logRateLimitEvent(req, 'sensitive');
        }
      },
      upload: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 20, // limit each IP to 20 uploads per hour
        message: {
          error: 'Too many uploads, please try again later.',
          retryAfter: '1 hour'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          return this.generateKey(req);
        },
        onLimitReached: (req, res) => {
          this.logRateLimitEvent(req, 'upload');
        }
      }
    };
  }

  generateKey(req) {
    // Use IP address as primary key
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    // If user is authenticated, include user ID for more precise limiting
    const userId = req.user?.id;
    
    return userId ? `${ip}:${userId}` : ip;
  }

  async logRateLimitEvent(req, type, additionalData = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'RATE_LIMIT_EXCEEDED',
      limitType: type,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || '',
      method: req.method,
      url: req.url,
      userId: req.user?.id,
      requestId: req.requestId,
      ...additionalData
    };

    this.logger.warn('Rate limit exceeded', logData);

    // Store violation in database
    try {
      await RateLimitViolation.create({
        userId: req.user?.id,
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        endpoint: req.path,
        method: req.method,
        tier: req.user?.tier,
        violationType: type,
        limitExceeded: additionalData.limit || 0,
        actualRequests: additionalData.actualRequests || 0,
        userAgent: req.get('User-Agent') || ''
      });

      // Update user violation count
      if (req.user?.id) {
        await RateLimitUser.incrementViolations(req.user.id, 'medium');
      }
    } catch (error) {
      this.logger.error('Failed to log rate limit violation to database', { error });
    }
  }

  // Enhanced rate limiting middleware using the new service
  advancedRateLimiter(options = {}) {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;
        const endpoint = req.path;
        
        // Check rate limit using the advanced service
        const result = await this.rateLimitService.checkRateLimit(
          userId,
          endpoint,
          req,
          res
        );

        // Update user usage statistics
        if (result.allowed && userId) {
          await RateLimitUser.updateUsage(userId, endpoint);
        }

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit-Minute': result.limits.minute.limit,
          'X-RateLimit-Remaining-Minute': Math.max(0, result.limits.minute.limit - result.limits.minute.used),
          'X-RateLimit-Reset-Minute': new Date(result.limits.minute.resetTime).toISOString(),
          'X-RateLimit-Limit-Hour': result.limits.hour.limit,
          'X-RateLimit-Remaining-Hour': Math.max(0, result.limits.hour.limit - result.limits.hour.used),
          'X-RateLimit-Reset-Hour': new Date(result.limits.hour.resetTime).toISOString(),
          'X-RateLimit-Limit-Day': result.limits.day.limit,
          'X-RateLimit-Remaining-Day': Math.max(0, result.limits.day.limit - result.limits.day.used),
          'X-RateLimit-Reset-Day': new Date(result.limits.day.resetTime).toISOString()
        });

        if (result.features) {
          res.set({
            'X-RateLimit-Burst-Remaining': result.features.burstRemaining,
            'X-RateLimit-Priority-Access': result.features.priorityAccess,
            'X-RateLimit-Custom-Access': result.features.customAccess,
            'X-RateLimit-Analytics-Access': result.features.analyticsAccess
          });
        }

        if (!result.allowed) {
          // Log the violation
          await this.logRateLimitEvent(req, 'advanced', {
            limit: result.limits.minute.limit,
            actualRequests: result.limits.minute.used,
            tier: result.tier,
            adjustmentReason: result.adjustmentReason
          });

          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: options.customMessage || 'Too many requests, please try again later.',
            retryAfter: result.retryAfter || Math.ceil((result.limits.minute.resetTime - Date.now()) / 1000),
            limits: {
              minute: result.limits.minute,
              hour: result.limits.hour,
              day: result.limits.day
            },
            tier: result.tier,
            features: result.features
          });
        }

        next();
      } catch (error) {
        this.logger.error('Advanced rate limiter error', { error });
        // Fail open - allow request if rate limiting fails
        next();
      }
    };
  }

  // Legacy methods for backward compatibility
  generalLimiter() {
    const config = this.getConfig().general;
    return rateLimit(config);
  }

  authLimiter() {
    const config = this.getConfig().auth;
    return rateLimit(config);
  }

  sensitiveLimiter() {
    const config = this.getConfig().sensitive;
    return rateLimit(config);
  }

  uploadLimiter() {
    const config = this.getConfig().upload;
    return rateLimit(config);
  }

  createCustomLimiter(options) {
    return rateLimit({
      ...options,
      keyGenerator: options.keyGenerator || ((req) => this.generateKey(req)),
      onLimitReached: options.onLimitReached || ((req, res) => {
        this.logRateLimitEvent(req, 'custom');
      })
    });
  }

  userBasedLimiter(windowMs, max) {
    return rateLimit({
      windowMs,
      max,
      keyGenerator: (req) => {
        const userId = req.user?.id;
        if (!userId) {
          // If not authenticated, use IP
          return req.ip || req.connection.remoteAddress || 'anonymous';
        }
        return `user:${userId}`;
      },
      message: {
        error: 'Too many requests for this user, please try again later.',
        retryAfter: `${Math.ceil(windowMs / 60000)} minutes`
      },
      standardHeaders: true,
      legacyHeaders: false,
      onLimitReached: (req, res) => {
        this.logRateLimitEvent(req, 'user-based');
      }
    });
  }

  dynamicLimiter() {
    return this.advancedRateLimiter();
  }

  // API endpoint rate limiting
  apiLimiter(endpoint, options = {}) {
    return this.advancedRateLimiter({
      customMessage: `Rate limit exceeded for ${endpoint}`,
      ...options
    });
  }

  // Emergency controls
  setEmergencyMode(enabled) {
    this.rateLimitService.setEmergencyMode(enabled);
    this.logger.warn(`Emergency mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Analytics and monitoring
  async getAnalytics(timeRange = 3600000) {
    return this.rateLimitService.getAnalytics(timeRange);
  }

  async getNotifications(limit = 50) {
    return this.rateLimitService.getNotifications(limit);
  }

  // User management
  setUserTier(userId, tier, customLimits = {}) {
    this.rateLimitService.setUserTier({
      userId,
      tier,
      customLimits
    });
  }

  setUserRateLimitConfig(config) {
    this.rateLimitService.setUserRateLimitConfig(config);
  }

  async upgradeUserTier(userId, newTier) {
    return this.rateLimitService.upgradeUserTier(userId, newTier);
  }

  // Health check
  async healthCheck() {
    return this.rateLimitService.healthCheck();
  }

  // Configuration management
  updateConfig(newConfig) {
    this.rateLimitService.updateConfig(newConfig);
  }

  getConfig() {
    return this.rateLimitService.getConfig();
  }

  // Cleanup
  async cleanup() {
    await this.rateLimitService.cleanup();
  }
}

// Export singleton instance
const rateLimiterMiddleware = new RateLimiterMiddleware();

// Export convenience functions
module.exports = {
  RateLimiterMiddleware,
  rateLimiterMiddleware,
  // Advanced rate limiting
  advancedRateLimiter: (options) => rateLimiterMiddleware.advancedRateLimiter(options),
  // Legacy rate limiting (for backward compatibility)
  generalLimiter: () => rateLimiterMiddleware.generalLimiter(),
  authLimiter: () => rateLimiterMiddleware.authLimiter(),
  sensitiveLimiter: () => rateLimiterMiddleware.sensitiveLimiter(),
  uploadLimiter: () => rateLimiterMiddleware.uploadLimiter(),
  dynamicLimiter: () => rateLimiterMiddleware.dynamicLimiter(),
  userBasedLimiter: (windowMs, max) => rateLimiterMiddleware.userBasedLimiter(windowMs, max),
  // API-specific limiters
  apiLimiter: (endpoint, options) => rateLimiterMiddleware.apiLimiter(endpoint, options),
  // Management functions
  setEmergencyMode: (enabled) => rateLimiterMiddleware.setEmergencyMode(enabled),
  getAnalytics: (timeRange) => rateLimiterMiddleware.getAnalytics(timeRange),
  getNotifications: (limit) => rateLimiterMiddleware.getNotifications(limit),
  setUserTier: (userId, tier, customLimits) => rateLimiterMiddleware.setUserTier(userId, tier, customLimits),
  setUserRateLimitConfig: (config) => rateLimiterMiddleware.setUserRateLimitConfig(config),
  upgradeUserTier: (userId, newTier) => rateLimiterMiddleware.upgradeUserTier(userId, newTier),
  healthCheck: () => rateLimiterMiddleware.healthCheck(),
  updateConfig: (newConfig) => rateLimiterMiddleware.updateConfig(newConfig),
  cleanup: () => rateLimiterMiddleware.cleanup()
};
