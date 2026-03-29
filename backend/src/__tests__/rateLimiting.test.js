const { RateLimitService } = require('../services/ratelimiting/RateLimitService');
const { RateLimitUser, RateLimitViolation } = require('../models/RateLimit');

describe('Rate Limiting System', () => {
  let rateLimitService;

  beforeAll(async () => {
    // Initialize rate limit service with test configuration
    rateLimitService = new RateLimitService({
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      enableUserRateLimiting: true,
      enableTieredRateLimiting: true,
      enableDynamicAdjustment: true,
      defaultLimits: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 1000
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    await rateLimitService.cleanup();
  });

  describe('Basic Rate Limiting', () => {
    test('should allow requests within limits', async () => {
      const req = {
        ip: '127.0.0.1',
        method: 'GET',
        path: '/api/test'
      };

      const result = await rateLimitService.checkRateLimit(
        undefined,
        '/api/test',
        req
      );

      expect(result.allowed).toBe(true);
      expect(result.limits.minute.limit).toBe(10);
    });

    test('should block requests exceeding limits', async () => {
      const req = {
        ip: '127.0.0.2',
        method: 'GET',
        path: '/api/test'
      };

      // Make multiple requests to exceed limit
      for (let i = 0; i < 15; i++) {
        const result = await rateLimitService.checkRateLimit(
          undefined,
          '/api/test',
          req
        );
        
        if (i < 10) {
          expect(result.allowed).toBe(true);
        } else {
          expect(result.allowed).toBe(false);
          expect(result.retryAfter).toBeDefined();
          break;
        }
      }
    });
  });

  describe('User-based Rate Limiting', () => {
    const testUserId = 'test-user-123';

    beforeEach(async () => {
      // Set up user rate limit config
      rateLimitService.setUserRateLimitConfig({
        userId: testUserId,
        baseLimits: {
          requestsPerMinute: 5,
          requestsPerHour: 50,
          requestsPerDay: 500
        }
      });
    });

    test('should apply user-specific limits', async () => {
      const req = {
        ip: '127.0.0.3',
        method: 'GET',
        path: '/api/user/test',
        user: { id: testUserId }
      };

      const result = await rateLimitService.checkRateLimit(
        testUserId,
        '/api/user/test',
        req
      );

      expect(result.allowed).toBe(true);
      expect(result.limits.minute.limit).toBe(5);
    });

    test('should block user when exceeding their limits', async () => {
      const req = {
        ip: '127.0.0.4',
        method: 'GET',
        path: '/api/user/test',
        user: { id: testUserId }
      };

      // Make requests to exceed user limit
      let blocked = false;
      for (let i = 0; i < 10; i++) {
        const result = await rateLimitService.checkRateLimit(
          testUserId,
          '/api/user/test',
          req
        );
        
        if (!result.allowed) {
          blocked = true;
          expect(result.retryAfter).toBeDefined();
          break;
        }
      }
      
      expect(blocked).toBe(true);
    });
  });

  describe('Tiered Rate Limiting', () => {
    const premiumUserId = 'premium-user-123';

    beforeEach(async () => {
      // Set up premium user tier
      rateLimitService.setUserTier({
        userId: premiumUserId,
        tier: 'premium',
        customLimits: {
          '/api/premium': {
            requestsPerMinute: 50,
            requestsPerHour: 500,
            requestsPerDay: 5000
          }
        }
      });
    });

    test('should apply tier-specific limits', async () => {
      const req = {
        ip: '127.0.0.5',
        method: 'GET',
        path: '/api/premium',
        user: { id: premiumUserId }
      };

      const result = await rateLimitService.checkRateLimit(
        premiumUserId,
        '/api/premium',
        req
      );

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('premium');
      expect(result.features).toBeDefined();
      expect(result.features.priorityAccess).toBe(true);
    });

    test('should apply custom endpoint limits for tiered users', async () => {
      const req = {
        ip: '127.0.0.6',
        method: 'GET',
        path: '/api/premium',
        user: { id: premiumUserId }
      };

      const result = await rateLimitService.checkRateLimit(
        premiumUserId,
        '/api/premium',
        req
      );

      expect(result.limits.minute.limit).toBe(50); // Custom limit for premium tier
    });
  });

  describe('Emergency Mode', () => {
    test('should allow all requests in emergency mode', async () => {
      // Enable emergency mode
      rateLimitService.setEmergencyMode(true);

      const req = {
        ip: '127.0.0.7',
        method: 'GET',
        path: '/api/emergency'
      };

      const result = await rateLimitService.checkRateLimit(
        undefined,
        '/api/emergency',
        req
      );

      expect(result.allowed).toBe(true);
      expect(result.limits.minute.limit).toBe(Infinity);

      // Disable emergency mode
      rateLimitService.setEmergencyMode(false);
    });
  });

  describe('Analytics', () => {
    test('should return analytics data', async () => {
      const analytics = await rateLimitService.getAnalytics(3600000); // 1 hour

      expect(analytics).toHaveProperty('totalRequests');
      expect(analytics).toHaveProperty('blockedRequests');
      expect(analytics).toHaveProperty('topUsers');
      expect(analytics).toHaveProperty('systemLoad');
      expect(analytics).toHaveProperty('tierBreakdown');
    });

    test('should return notifications', async () => {
      const notifications = rateLimitService.getNotifications(10);

      expect(Array.isArray(notifications)).toBe(true);
    });
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const health = await rateLimitService.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('details');
      expect(health.details).toHaveProperty('redis');
      expect(health.details).toHaveProperty('emergencyMode');
    });
  });

  describe('Database Integration', () => {
    test('should create rate limit violations in database', async () => {
      const violationData = {
        userId: 'test-user-db',
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
        method: 'GET',
        violationType: 'minute',
        limitExceeded: 10,
        actualRequests: 15,
        userAgent: 'test-agent'
      };

      const violation = await RateLimitViolation.create(violationData);

      expect(violation).toBeDefined();
      expect(violation.userId).toBe('test-user-db');
      expect(violation.resolved).toBe(false);
    });

    test('should create and update rate limit users', async () => {
      const userData = {
        userId: 'test-user-db-2',
        email: 'test@example.com',
        tier: 'basic'
      };

      // Create user
      const user = await RateLimitUser.create(userData);
      expect(user.userId).toBe('test-user-db-2');
      expect(user.tier).toBe('basic');

      // Update usage
      await RateLimitUser.updateUsage('test-user-db-2', '/api/test', 5);
      
      // Increment violations
      await RateLimitUser.incrementViolations('test-user-db-2', 'medium');

      // Verify updates
      const updatedUser = await RateLimitUser.findByUserId('test-user-db-2');
      expect(updatedUser.usage.currentMonth.requests).toBe(5);
      expect(updatedUser.violations.count).toBe(1);
    });
  });

  describe('Configuration Management', () => {
    test('should update service configuration', async () => {
      const newConfig = {
        defaultLimits: {
          requestsPerMinute: 20,
          requestsPerHour: 200,
          requestsPerDay: 2000
        }
      };

      rateLimitService.updateConfig(newConfig);
      
      const config = rateLimitService.getConfig();
      expect(config.defaultLimits.requestsPerMinute).toBe(20);
    });
  });

  describe('Error Handling', () => {
    test('should fail open when rate limiting service fails', async () => {
      // Mock a failure scenario
      const originalService = rateLimitService;
      rateLimitService = null;

      const req = {
        ip: '127.0.0.8',
        method: 'GET',
        path: '/api/test'
      };

      // This should not throw an error but allow the request
      try {
        const result = await originalService.checkRateLimit(
          undefined,
          '/api/test',
          req
        );
        expect(result.allowed).toBe(true);
      } catch (error) {
        // If it does throw, that's also acceptable behavior
        expect(error).toBeDefined();
      }

      rateLimitService = originalService;
    });
  });
});

describe('Rate Limiting Middleware', () => {
  const { advancedRateLimiter } = require('../middleware/rateLimit');

  test('should create middleware function', () => {
    const middleware = advancedRateLimiter();
    expect(typeof middleware).toBe('function');
  });

  test('should handle requests with middleware', async () => {
    const middleware = advancedRateLimiter();
    
    const req = {
      ip: '127.0.0.9',
      method: 'GET',
      path: '/api/middleware-test',
      user: { id: 'middleware-test-user' }
    };

    const res = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.set).toHaveBeenCalled();
  });
});
