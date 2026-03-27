const express = require('express');
const { manager: databaseManager } = require('../config/database_optimized');
const QueryOptimizer = require('../services/queryOptimizer');
const DatabaseIndexer = require('../services/databaseIndexer');
const QueryCache = require('../middleware/queryCache');
const PerformanceMetrics = require('../models/PerformanceMetrics');

const router = express.Router();

// Initialize services
const queryOptimizer = new QueryOptimizer();
const databaseIndexer = new DatabaseIndexer();
const queryCache = new QueryCache();

/**
 * GET /api/performance/health
 * Get database health status
 */
router.get('/health', async (req, res) => {
  try {
    const health = await databaseManager.getHealthStatus();
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/performance/metrics
 * Get performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { limit = 100, startDate, endDate } = req.query;
    
    let query = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const metrics = await PerformanceMetrics
      .find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: {
        metrics,
        total: metrics.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/performance/slow-queries
 * Get slow queries
 */
router.get('/slow-queries', async (req, res) => {
  try {
    const { limit = 50, threshold = 1000 } = req.query;
    
    const slowQueries = await PerformanceMetrics.getSlowQueries(
      parseInt(limit),
      parseInt(threshold)
    );
    
    res.json({
      success: true,
      data: {
        queries: slowQueries,
        total: slowQueries.length,
        threshold: parseInt(threshold)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/performance/optimize
 * Optimize a query
 */
router.post('/optimize', async (req, res) => {
  try {
    const { collection, query, options = {} } = req.body;
    
    if (!collection || !query) {
      return res.status(400).json({
        success: false,
        error: 'Collection and query are required'
      });
    }
    
    const optimizationPlan = await queryOptimizer.optimizeQuery(query, collection, options);
    
    res.json({
      success: true,
      data: {
        optimizationPlan
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/performance/analyze
 * Analyze query performance
 */
router.post('/analyze', async (req, res) => {
  try {
    const { collection, query, options = {} } = req.body;
    
    if (!collection || !query) {
      return res.status(400).json({
        success: false,
        error: 'Collection and query are required'
      });
    }
    
    const analysis = await queryOptimizer.queryAnalyzer.analyzeQuery(query, collection);
    
    res.json({
      success: true,
      data: {
        analysis
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/performance/indexes/:collection
 * Get collection index analysis
 */
router.get('/indexes/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    
    const analysis = await databaseIndexer.analyzeCollectionIndexes(collection);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/performance/indexes/:collection
 * Create recommended indexes for collection
 */
router.post('/indexes/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const { autoApply = false, priorities = ['high', 'medium'] } = req.body;
    
    // Get index recommendations
    const analysis = await databaseIndexer.analyzeCollectionIndexes(collection);
    
    // Filter by priority
    const filteredRecommendations = analysis.recommendations.filter(
      rec => priorities.includes(rec.priority)
    );
    
    // Create indexes
    const results = await databaseIndexer.createIndexes(
      collection,
      filteredRecommendations,
      { autoApply }
    );
    
    res.json({
      success: true,
      data: {
        results,
        recommendations: filteredRecommendations,
        totalRecommendations: analysis.recommendations.length,
        appliedRecommendations: filteredRecommendations.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/performance/indexes/:collection/unused
 * Drop unused indexes from collection
 */
router.delete('/indexes/:collection/unused', async (req, res) => {
  try {
    const { collection } = req.params;
    const { daysThreshold = 30 } = req.query;
    
    const results = await databaseIndexer.dropUnusedIndexes(
      collection,
      parseInt(daysThreshold)
    );
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/performance/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = queryCache.getStats();
    
    res.json({
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/performance/cache/clear
 * Clear cache
 */
router.post('/cache/clear', async (req, res) => {
  try {
    queryCache.clear();
    
    res.json({
      success: true,
      data: {
        message: 'Cache cleared successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/performance/cache/info
 * Get detailed cache information
 */
router.get('/cache/info', async (req, res) => {
  try {
    const info = queryCache.getCacheInfo();
    
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/performance/pool/stats
 * Get connection pool statistics
 */
router.get('/pool/stats', async (req, res) => {
  try {
    const health = await databaseManager.getHealthStatus();
    const poolStats = health.stats.connectionPool;
    
    res.json({
      success: true,
      data: {
        stats: poolStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/performance/pool/health
 * Get connection pool health
 */
router.get('/pool/health', async (req, res) => {
  try {
    const health = await databaseManager.getHealthStatus();
    
    // Simple health check for connection pool
    const poolHealth = {
      healthy: health.connected && health.mongoose,
      issues: [],
      stats: health.stats.connectionPool || {}
    };
    
    // Check for common issues
    if (health.stats.connectionPool) {
      const stats = health.stats.connectionPool;
      
      if (stats.waitingQueueLength > 10) {
        poolHealth.issues.push('High waiting queue length');
      }
      
      if (stats.utilizationRate > 0.9) {
        poolHealth.issues.push('High connection utilization');
      }
      
      if (stats.avgAcquireTime > 1000) {
        poolHealth.issues.push('Slow connection acquire times');
      }
    }
    
    res.json({
      success: true,
      data: poolHealth
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/performance/report
 * Get comprehensive performance report
 */
router.get('/report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Get performance metrics report
    const performanceReport = await PerformanceMetrics.getPerformanceReport(start, end);
    
    // Get database health
    const health = await databaseManager.getHealthStatus();
    
    // Get cache stats
    const cacheStats = queryCache.getStats();
    
    // Get indexing stats
    const indexingStats = await databaseIndexer.getIndexingStats();
    
    res.json({
      success: true,
      data: {
        period: { startDate: start, endDate: end },
        performance: performanceReport[0] || {},
        database: health,
        cache: cacheStats,
        indexing: indexingStats,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/performance/benchmark
 * Run performance benchmark
 */
router.post('/benchmark', async (req, res) => {
  try {
    const { queries, iterations = 10 } = req.body;
    
    if (!queries || !Array.isArray(queries)) {
      return res.status(400).json({
        success: false,
        error: 'Queries array is required'
      });
    }
    
    const results = [];
    
    for (const queryConfig of queries) {
      const { collection, query, options = {} } = queryConfig;
      const times = [];
      
      // Run multiple iterations
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        
        try {
          await databaseManager.executeQuery(
            { collection: { name: collection } },
            query,
            { ...options, cache: false, optimize: false } // Benchmark raw performance
          );
          
          times.push(Date.now() - start);
        } catch (error) {
          times.push(-1); // Mark failed queries
        }
      }
      
      const validTimes = times.filter(t => t > 0);
      
      results.push({
        collection,
        query,
        iterations,
        successful: validTimes.length,
        failed: times.length - validTimes.length,
        avgTime: validTimes.length > 0 ? validTimes.reduce((a, b) => a + b) / validTimes.length : 0,
        minTime: validTimes.length > 0 ? Math.min(...validTimes) : 0,
        maxTime: validTimes.length > 0 ? Math.max(...validTimes) : 0
      });
    }
    
    res.json({
      success: true,
      data: {
        benchmark: {
          results,
          summary: {
            totalQueries: queries.length,
            totalIterations: queries.length * iterations,
            overallAvgTime: results.reduce((sum, r) => sum + r.avgTime, 0) / results.length
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
