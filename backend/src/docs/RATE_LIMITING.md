# Advanced Rate Limiting System

This document describes the comprehensive rate limiting system implemented for the Verinode backend API.

## Overview

The advanced rate limiting system provides:

- **User-based rate limiting** with authentication integration
- **Tiered access levels** (free, basic, premium, enterprise)
- **Dynamic rate adjustment** based on system load
- **Rate limit analytics and monitoring**
- **Customizable rate limit rules per endpoint**
- **Rate limit bypass for emergency situations**
- **Rate limit notifications and alerts**
- **Performance optimization for rate limit checks**
- **Rate limit API for client applications**

## Architecture

The system consists of several key components:

### Core Components

1. **AdvancedRateLimiter** (`src/ratelimiting/AdvancedRateLimiter.ts`)
   - Core rate limiting engine with Redis backend
   - Supports multiple time windows (minute, hour, day, month)
   - Emergency bypass functionality
   - System metrics collection

2. **UserRateLimiter** (`src/ratelimiting/UserRateLimiter.ts`)
   - User-specific rate limiting
   - Custom endpoint limits per user
   - Whitelist and bypass capabilities
   - Usage tracking and analytics

3. **TieredRateLimiter** (`src/ratelimiting/TieredRateLimiter.ts`)
   - Tier-based access control
   - Feature-based rate limiting
   - Automatic tier upgrades
   - Custom tier configurations

4. **DynamicRateLimiter** (`src/ratelimiting/DynamicRateLimiter.ts`)
   - Rule-based dynamic adjustments
   - System load monitoring
   - Predictive scaling
   - Load balancing integration

5. **RateLimitService** (`src/services/ratelimiting/RateLimitService.ts`)
   - Unified service interface
   - Configuration management
   - Analytics and reporting
   - Notification system

6. **Database Models** (`src/models/RateLimit.js`)
   - RateLimitRule - Custom rate limit rules
   - RateLimitViolation - Violation tracking
   - RateLimitAnalytics - Usage analytics
   - RateLimitUser - User configurations
   - RateLimitAlert - System alerts
   - RateLimitConfiguration - System settings

## Usage

### Basic Rate Limiting

```javascript
const { advancedRateLimiter } = require('./middleware/rateLimit');

// Apply to all routes
app.use('/api', advancedRateLimiter());

// Apply to specific route
app.get('/api/data', advancedRateLimiter(), (req, res) => {
  res.json({ message: 'Data' });
});
```

### User-based Rate Limiting

```javascript
const { setUserRateLimitConfig } = require('./middleware/rateLimit');

// Set user-specific limits
setUserRateLimitConfig({
  userId: 'user123',
  baseLimits: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000
  },
  customLimits: {
    '/api/sensitive': {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      requestsPerDay: 1000
    }
  }
});
```

### Tiered Rate Limiting

```javascript
const { setUserTier } = require('./middleware/rateLimit');

// Upgrade user to premium tier
setUserTier('user123', 'premium', {
  '/api/premium': {
    requestsPerMinute: 200,
    requestsPerHour: 5000,
    requestsPerDay: 50000
  }
});
```

### Emergency Mode

```javascript
const { setEmergencyMode } = require('./middleware/rateLimit');

// Enable emergency mode (bypasses all rate limits)
setEmergencyMode(true);

// Disable emergency mode
setEmergencyMode(false);
```

## Configuration

### Default Configuration

```javascript
const rateLimitService = new RateLimitService({
  redisUrl: 'redis://localhost:6379',
  enableUserRateLimiting: true,
  enableTieredRateLimiting: true,
  enableDynamicAdjustment: true,
  defaultLimits: {
    requestsPerMinute: 100,
    requestsPerHour: 1000,
    requestsPerDay: 10000
  }
});
```

### Tier Configurations

#### Free Tier
- 10 requests/minute
- 100 requests/hour
- 1,000 requests/day
- 10,000 requests/month

#### Basic Tier
- 30 requests/minute
- 500 requests/hour
- 5,000 requests/day
- 50,000 requests/month
- Burst allowance: 10
- Advanced analytics: true

#### Premium Tier
- 100 requests/minute
- 2,000 requests/hour
- 20,000 requests/day
- 200,000 requests/month
- Burst allowance: 50
- Priority support: true
- Custom endpoints: true

#### Enterprise Tier
- 1,000 requests/minute
- 10,000 requests/hour
- 100,000 requests/day
- 1,000,000 requests/month
- Burst allowance: 500
- Emergency bypass: true

## Dynamic Adjustment Rules

The system supports rule-based dynamic adjustments:

### Built-in Rules

1. **High CPU Usage Reduction**
   - Trigger: CPU usage > 80%
   - Action: Reduce limits by 20-30%

2. **High Memory Usage Reduction**
   - Trigger: Memory usage > 90%
   - Action: Reduce limits by 30-40%

3. **Low Load Increase**
   - Trigger: CPU < 30% and Memory < 50%
   - Action: Increase limits by 10-20%

4. **Emergency Mode**
   - Trigger: CPU > 95% or Memory > 98%
   - Action: Reduce limits by 50-80%

### Custom Rules

```javascript
rateLimitService.addAdjustmentRule({
  id: 'business-hours-boost',
  name: 'Business Hours Boost',
  description: 'Increase limits during business hours',
  condition: (metrics, context) => {
    const hour = new Date().getHours();
    return hour >= 9 && hour <= 17;
  },
  adjustment: (limits) => ({
    ...limits,
    requestsPerMinute: Math.floor(limits.requestsPerMinute * 1.2)
  }),
  priority: 3,
  enabled: true
});
```

## API Endpoints

### Rate Limit Status

```http
GET /api/rate-limit-status
```

Response headers:
- `X-RateLimit-Limit-Minute`: Minute limit
- `X-RateLimit-Remaining-Minute`: Remaining requests this minute
- `X-RateLimit-Reset-Minute`: Minute window reset time
- `X-RateLimit-Limit-Hour`: Hour limit
- `X-RateLimit-Remaining-Hour`: Remaining requests this hour
- `X-RateLimit-Reset-Hour`: Hour window reset time
- `X-RateLimit-Limit-Day`: Day limit
- `X-RateLimit-Remaining-Day`: Remaining requests today
- `X-RateLimit-Reset-Day`: Day window reset time

### Analytics

```http
GET /api/admin/analytics
```

Response:
```json
{
  "totalRequests": 15000,
  "blockedRequests": 500,
  "topUsers": [
    { "userId": "user123", "requests": 1500, "tier": "premium" }
  ],
  "systemLoad": {
    "cpuUsage": 45.2,
    "memoryUsage": 0.67,
    "activeConnections": 25,
    "requestRate": 150
  },
  "tierBreakdown": {
    "free": { "users": 100, "requests": 5000, "blockedRequests": 200 },
    "premium": { "users": 50, "requests": 10000, "blockedRequests": 300 }
  }
}
```

## Monitoring and Alerts

### Violation Tracking

All rate limit violations are automatically logged to the database with:
- User ID and IP address
- Endpoint and method
- Violation type (minute, hour, day, month)
- Limit exceeded and actual requests
- Timestamp and user agent

### Notifications

The system generates notifications for:
- Rate limit exceeded
- Tier upgrades
- Emergency mode changes
- System load anomalies
- Anomalous usage patterns

### Health Checks

```javascript
const health = await rateLimitService.healthCheck();
// Returns: { status: 'healthy' | 'degraded' | 'unhealthy', details: {...} }
```

## Performance Considerations

### Redis Optimization

- Use Redis clustering for high availability
- Configure appropriate memory limits
- Use Redis persistence for critical data
- Monitor Redis performance metrics

### Database Optimization

- Indexes on frequently queried fields
- Regular cleanup of old analytics data
- Partitioning for large analytics tables
- Connection pooling

### Caching

- Cache user tier configurations
- Cache rate limit rules
- Cache analytics summaries
- Use CDN for static rate limit information

## Security

### Rate Limit Bypass Prevention

- Validate user authentication tokens
- Use IP-based limiting for unauthenticated requests
- Implement request signature validation
- Monitor for bypass attempts

### DDoS Protection

- Automatic emergency mode activation
- IP blacklisting for repeated violations
- CAPTCHA integration for suspicious requests
- Rate limit sharing across multiple servers

## Testing

Run the test suite:

```bash
npm test -- rateLimiting.test.js
```

Test coverage includes:
- Basic rate limiting functionality
- User-based rate limiting
- Tiered rate limiting
- Emergency mode
- Analytics and reporting
- Database integration
- Error handling

## Deployment

### Environment Variables

```bash
REDIS_URL=redis://localhost:6379
ENABLE_USER_RATE_LIMITING=true
ENABLE_TIERED_RATE_LIMITING=true
ENABLE_DYNAMIC_ADJUSTMENT=true
DEFAULT_REQUESTS_PER_MINUTE=100
DEFAULT_REQUESTS_PER_HOUR=1000
DEFAULT_REQUESTS_PER_DAY=10000
```

### Docker Configuration

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Monitoring

Set up monitoring for:
- Redis connection health
- Rate limit hit ratios
- System resource usage
- Violation rates
- API response times

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis server status
   - Verify connection string
   - Check network connectivity

2. **Rate Limits Not Working**
   - Verify middleware is applied correctly
   - Check user authentication
   - Review configuration settings

3. **High Memory Usage**
   - Check Redis memory usage
   - Review data retention policies
   - Optimize database queries

### Debug Logging

Enable debug logging:

```javascript
const logger = new WinstonLogger({ level: 'debug' });
```

## Migration Guide

### From Basic Rate Limiting

1. Replace existing rate limit middleware:
   ```javascript
   // Old
   const rateLimit = require('express-rate-limit');
   app.use(rateLimit({ max: 100 }));
   
   // New
   const { advancedRateLimiter } = require('./middleware/rateLimit');
   app.use(advancedRateLimiter());
   ```

2. Set up user tiers:
   ```javascript
   const { setUserTier } = require('./middleware/rateLimit');
   // Migrate existing users to appropriate tiers
   ```

3. Configure custom rules:
   ```javascript
   rateLimitService.addAdjustmentRule(customRule);
   ```

## API Reference

### RateLimitService

#### Methods

- `checkRateLimit(userId, endpoint, req, res)` - Check rate limit
- `setUserTier(userInfo)` - Set user tier configuration
- `setUserRateLimitConfig(config)` - Set user-specific limits
- `upgradeUserTier(userId, newTier)` - Upgrade user tier
- `addAdjustmentRule(rule)` - Add dynamic adjustment rule
- `setEmergencyMode(enabled)` - Toggle emergency mode
- `getAnalytics(timeRange)` - Get usage analytics
- `getNotifications(limit)` - Get system notifications
- `healthCheck()` - Get system health status

### Middleware Functions

- `advancedRateLimiter(options)` - Advanced rate limiting middleware
- `apiLimiter(endpoint, options)` - Endpoint-specific limiter
- `setEmergencyMode(enabled)` - Emergency mode control
- `getAnalytics(timeRange)` - Analytics data
- `setUserTier(userId, tier, customLimits)` - User tier management

## Contributing

When contributing to the rate limiting system:

1. Follow the existing code style
2. Add comprehensive tests
3. Update documentation
4. Consider performance impact
5. Test with various load scenarios

## License

This rate limiting system is part of the Verinode project and follows the same license terms.
