const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

// Public routes - cache search results and popular queries to reduce DB load
router.get('/', cacheMiddleware({
  ttl: 120, // 2 min - search results change as new proofs are added
  keyPrefix: 'search',
  keyGenerator: (req) => `results:${JSON.stringify(req.query)}`,
  tags: ['search-results']
}), searchController.search);

router.get('/autocomplete', cacheMiddleware({
  ttl: 300, // 5 min - autocomplete suggestions are stable
  keyPrefix: 'search',
  keyGenerator: (req) => `autocomplete:${req.query.q || ''}`,
  tags: ['search-results']
}), searchController.autoComplete);

router.get('/popular', cacheMiddleware({
  ttl: 600, // 10 min - popular searches change slowly
  keyPrefix: 'search',
  keyGenerator: () => 'popular',
  tags: ['search-results']
}), searchController.getPopularSearches);

// Protected routes (require authentication) - user-specific, not cached globally
router.get('/history', searchController.getSearchHistory);
router.delete('/history/:id', searchController.deleteSearchHistory);
router.delete('/history', searchController.clearSearchHistory);
router.post('/saved', searchController.saveSearchQuery);
router.get('/saved', searchController.getSavedQueries);
router.delete('/saved/:id', searchController.deleteSavedQuery);
router.get('/recent', searchController.getRecentSearches);

// Admin routes
router.get('/analytics', cacheMiddleware({
  ttl: 300, // 5 min
  keyPrefix: 'search',
  keyGenerator: (req) => `analytics:${JSON.stringify(req.query)}`,
  tags: ['search-analytics']
}), searchController.getSearchAnalytics);

router.get('/indexes/stats', cacheMiddleware({
  ttl: 60, // 1 min - index stats should be fairly fresh
  keyPrefix: 'search',
  keyGenerator: () => 'index-stats',
  tags: ['search-indexes']
}), searchController.getIndexStats);

router.post('/indexes/rebuild', searchController.rebuildIndexes);

router.get('/indexes/health', cacheMiddleware({
  ttl: 30, // 30 sec - health checks need to be recent
  keyPrefix: 'search',
  keyGenerator: () => 'index-health',
  tags: ['search-indexes']
}), searchController.checkIndexHealth);

router.get('/indexes/suggestions', cacheMiddleware({
  ttl: 300,
  keyPrefix: 'search',
  keyGenerator: () => 'index-suggestions',
  tags: ['search-indexes']
}), searchController.getIndexSuggestions);

module.exports = router;
