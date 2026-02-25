const express = require('express');
const router = express.Router();

// Lazy-require to avoid import issues when Redis is not available
const getCacheService = () => require('../services/cacheService').cacheService;
const getCacheInvalidation = () => require('../utils/cacheInvalidation').cacheInvalidationService;

// GET /api/cache/metrics - cache hit rate, counts, etc.
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await getCacheService().getMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cache/health - Redis connectivity and overall cache health
router.get('/health', async (req, res) => {
  try {
    const health = await getCacheInvalidation().getCacheHealth();
    const status = health.redisConnected ? 'healthy' : 'unhealthy';
    res.json({ success: true, status, ...health });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cache/invalidate/tag/:tag - invalidate all keys with a tag
router.delete('/invalidate/tag/:tag', async (req, res) => {
  try {
    await getCacheService().invalidateByTag(req.params.tag);
    res.json({ success: true, message: `Invalidated cache for tag: ${req.params.tag}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cache/invalidate/proof/:proofId - invalidate a specific proof
router.delete('/invalidate/proof/:proofId', async (req, res) => {
  try {
    await getCacheInvalidation().invalidateProof(req.params.proofId);
    res.json({ success: true, message: `Invalidated cache for proof: ${req.params.proofId}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cache/invalidate/user/:userId - invalidate a specific user's cache
router.delete('/invalidate/user/:userId', async (req, res) => {
  try {
    await getCacheInvalidation().invalidateUser(req.params.userId);
    res.json({ success: true, message: `Invalidated cache for user: ${req.params.userId}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cache/invalidate/analytics - invalidate all analytics cache
router.delete('/invalidate/analytics', async (req, res) => {
  try {
    await getCacheInvalidation().invalidateAnalytics();
    res.json({ success: true, message: 'Invalidated analytics cache' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cache/reset-metrics - reset cache hit/miss counters
router.delete('/reset-metrics', async (req, res) => {
  try {
    await getCacheService().resetMetrics();
    res.json({ success: true, message: 'Cache metrics reset' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
