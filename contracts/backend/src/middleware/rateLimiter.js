const rateLimit = require('express-rate-limit');
const { WinstonLogger } = require('../utils/logger');

class RateLimiterMiddleware {
  constructor() {
    this.logger = new WinstonLogger();
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
    // Use IP address as the primary key
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    // If user is authenticated, include user ID for more precise limiting
    const userId = req.user?.id;
    
    return userId ? `${ip}:${userId}` : ip;
  }

  logRateLimitEvent(req, type) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'RATE_LIMIT_EXCEEDED',
      limitType: type,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || '',
      method: req.method,
      url: req.url,
      userId: req.user?.id,
      requestId: req.requestId
    };

    this.logger.warn('Rate limit exceeded', logData);
  }

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
    return (req, res, next) => {
      // Apply different limits based on user tier or endpoint
      const user = req.user;
      
      if (req.path.startsWith('/api/auth')) {
        return this.authLimiter()(req, res, next);
      }
      
      if (req.path.startsWith('/api/proofs') && req.method !== 'GET') {
        return this.sensitiveLimiter()(req, res, next);
      }
      
      if (req.path.includes('/upload') || req.path.includes('/ipfs')) {
        return this.uploadLimiter()(req, res, next);
      }
      
      // Premium users get higher limits
      if (user?.tier === 'premium') {
        const premiumLimiter = this.createCustomLimiter({
          windowMs: 15 * 60 * 1000,
          max: 500,
          message: {
            error: 'Premium rate limit exceeded, please try again later.',
            retryAfter: '15 minutes'
          }
        });
        return premiumLimiter(req, res, next);
      }
      
      // Default general limiter
      return this.generalLimiter()(req, res, next);
    };
  }
}

// Export singleton instance
const rateLimiterMiddleware = new RateLimiterMiddleware();

// Export convenience functions
module.exports = {
  RateLimiterMiddleware,
  rateLimiterMiddleware,
  generalLimiter: () => rateLimiterMiddleware.generalLimiter(),
  authLimiter: () => rateLimiterMiddleware.authLimiter(),
  sensitiveLimiter: () => rateLimiterMiddleware.sensitiveLimiter(),
  uploadLimiter: () => rateLimiterMiddleware.uploadLimiter(),
  dynamicLimiter: () => rateLimiterMiddleware.dynamicLimiter(),
  userBasedLimiter: (windowMs, max) => rateLimiterMiddleware.userBasedLimiter(windowMs, max)
};
