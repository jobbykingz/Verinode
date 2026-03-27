const express = require('express');
const { advancedRateLimiter, setUserTier, getAnalytics, setEmergencyMode } = require('../middleware/rateLimit');

const app = express();
app.use(express.json());

// Example: Apply advanced rate limiting to all API routes
app.use('/api', advancedRateLimiter());

// Example: Apply custom rate limiting to specific endpoints
app.get('/api/public/data', advancedRateLimiter({
  customMessage: 'Public API rate limit exceeded. Please upgrade your plan for higher limits.'
}), (req, res) => {
  res.json({ message: 'Public data access', timestamp: new Date().toISOString() });
});

// Example: Premium endpoint with higher limits
app.get('/api/premium/data', advancedRateLimiter(), async (req, res) => {
  // Check if user has premium access
  if (!req.user || req.user.tier !== 'premium') {
    return res.status(403).json({ error: 'Premium access required' });
  }
  
  res.json({ 
    message: 'Premium data access', 
    timestamp: new Date().toISOString(),
    features: req.rateLimitFeatures 
  });
});

// Example: Sensitive operations with stricter limits
app.post('/api/sensitive/operation', advancedRateLimiter({
  customMessage: 'Too many sensitive operations. Please try again later.'
}), (req, res) => {
  res.json({ message: 'Sensitive operation completed', timestamp: new Date().toISOString() });
});

// Example: Admin endpoint for rate limit management
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const analytics = await getAnalytics(3600000); // Last hour
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Example: Emergency control endpoint
app.post('/api/admin/emergency', (req, res) => {
  const { enabled } = req.body;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be boolean' });
  }
  
  setEmergencyMode(enabled);
  res.json({ message: `Emergency mode ${enabled ? 'enabled' : 'disabled'}` });
});

// Example: User tier management
app.post('/api/admin/users/:userId/tier', (req, res) => {
  const { userId } = req.params;
  const { tier, customLimits } = req.body;
  
  if (!['free', 'basic', 'premium', 'enterprise'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }
  
  setUserTier(userId, tier, customLimits);
  res.json({ message: `User ${userId} upgraded to ${tier} tier` });
});

// Example: Rate limit status endpoint
app.get('/api/rate-limit-status', (req, res) => {
  const limits = {
    minute: {
      limit: req.get('X-RateLimit-Limit-Minute'),
      remaining: req.get('X-RateLimit-Remaining-Minute'),
      reset: req.get('X-RateLimit-Reset-Minute')
    },
    hour: {
      limit: req.get('X-RateLimit-Limit-Hour'),
      remaining: req.get('X-RateLimit-Remaining-Hour'),
      reset: req.get('X-RateLimit-Reset-Hour')
    },
    day: {
      limit: req.get('X-RateLimit-Limit-Day'),
      remaining: req.get('X-RateLimit-Remaining-Day'),
      reset: req.get('X-RateLimit-Reset-Day')
    }
  };

  const features = {
    burstRemaining: req.get('X-RateLimit-Burst-Remaining'),
    priorityAccess: req.get('X-RateLimit-Priority-Access'),
    customAccess: req.get('X-RateLimit-Custom-Access'),
    analyticsAccess: req.get('X-RateLimit-Analytics-Access')
  };

  res.json({ limits, features });
});

// Example middleware to simulate user authentication
app.use((req, res, next) => {
  // Simulate authenticated user for demo purposes
  if (req.headers['x-user-id']) {
    req.user = {
      id: req.headers['x-user-id'],
      tier: req.headers['x-user-tier'] || 'free'
    };
  }
  next();
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Rate limiting error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 429 error handler for rate limits
app.use((req, res, next) => {
  if (res.statusCode === 429) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: req.get('Retry-After')
    });
  }
  next();
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Rate limiting example server running on port ${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log('GET  /api/public/data - Public endpoint with basic rate limits');
  console.log('GET  /api/premium/data - Premium endpoint (requires X-User-Tier: premium)');
  console.log('POST /api/sensitive/operation - Sensitive operations with strict limits');
  console.log('GET  /api/admin/analytics - View rate limiting analytics');
  console.log('POST /api/admin/emergency - Toggle emergency mode');
  console.log('POST /api/admin/users/:userId/tier - Upgrade user tier');
  console.log('GET  /api/rate-limit-status - Check current rate limit status');
  console.log('\nExample usage:');
  console.log('curl -H "X-User-ID: user123" -H "X-User-Tier: premium" http://localhost:3001/api/premium/data');
  console.log('curl -X POST -H "Content-Type: application/json" -d \'{"enabled": true}\' http://localhost:3001/api/admin/emergency');
});

module.exports = app;
