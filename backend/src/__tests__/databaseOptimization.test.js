const request = require('supertest');
const mongoose = require('mongoose');
const { performance } = require('perf_hooks');

// Import our optimization services
const QueryAnalyzer = require('../src/utils/queryAnalyzer');
const QueryOptimizer = require('../src/services/queryOptimizer');
const DatabaseIndexer = require('../src/services/databaseIndexer');
const QueryCache = require('../src/middleware/queryCache');
const { manager: databaseManager } = require('../config/database_optimized');

// Import models
const IPFSContent = require('../src/models/IPFSContent');
const PerformanceMetrics = require('../src/models/PerformanceMetrics');

describe('Database Performance Optimization Tests', () => {
  let queryAnalyzer;
  let queryOptimizer;
  let databaseIndexer;
  let queryCache;
  let testDb;

  beforeAll(async () => {
    // Initialize test database connection
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/verinode_test');
    testDb = mongoose.connection.db;
    
    // Initialize optimization services
    queryAnalyzer = new QueryAnalyzer();
    queryOptimizer = new QueryOptimizer();
    databaseIndexer = new DatabaseIndexer();
    queryCache = new QueryCache({
      maxSize: 100,
      ttl: 60000, // 1 minute for tests
      cleanupInterval: 10000
    });

    // Initialize database manager
    await databaseManager.initialize();
  });

  afterAll(async () => {
    await databaseManager.shutdown();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await testDb.collection('ipfscontents').deleteMany({});
    await testDb.collection('performancemetrics').deleteMany({});
    queryCache.clear();
  });

  describe('Query Analyzer Tests', () => {
    test('should analyze simple query correctly', () => {
      const query = { contentType: 'proof', isPublic: true };
      const analysis = queryAnalyzer.analyzeQuery(query, 'ipfscontents');
      
      expect(analysis.queryHash).toBeDefined();
      expect(analysis.complexity).toBe('low');
      expect(analysis.cacheable).toBe(true);
      expect(analysis.potentialIndexes).toHaveLength(2);
    });

    test('should identify high complexity queries', () => {
      const complexQuery = {
        $or: [
          { contentType: 'proof', tags: { $in: ['important', 'urgent'] } },
          { $and: [{ isPublic: true }, { createdAt: { $gte: new Date() } }] }
        ]
      };
      
      const analysis = queryAnalyzer.analyzeQuery(complexQuery, 'ipfscontents');
      
      expect(analysis.complexity).toBe('high');
      expect(analysis.estimatedCost).toBeGreaterThan(5);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    test('should measure query execution time', async () => {
      const query = { contentType: 'proof' };
      
      const result = await queryAnalyzer.measureQueryExecution(
        async () => ({ success: true }),
        query,
        'ipfscontents'
      );
      
      expect(result.result).toEqual({ success: true });
      expect(result.metrics.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics.queryHash).toBeDefined();
    });

    test('should analyze aggregation pipelines', () => {
      const pipeline = [
        { $match: { contentType: 'proof' } },
        { $group: { _id: '$owner', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ];
      
      const analysis = queryAnalyzer.analyzeAggregationPipeline(pipeline, 'ipfscontents');
      
      expect(analysis.stages).toBe(3);
      expect(analysis.complexity).toBe('medium');
      expect(analysis.potentialIndexes.length).toBeGreaterThan(0);
    });
  });

  describe('Query Optimizer Tests', () => {
    test('should optimize query with recommendations', async () => {
      const query = { tags: { $regex: 'important' } };
      const optimizationPlan = await queryOptimizer.optimizeQuery(query, 'ipfscontents');
      
      expect(optimizationPlan.originalQuery).toEqual(query);
      expect(optimizationPlan.analysis).toBeDefined();
      expect(optimizationPlan.optimizations.length).toBeGreaterThan(0);
      expect(optimizationPlan.estimatedImprovement).toMatch(/\d+%$/);
    });

    test('should apply safe optimizations automatically', async () => {
      const query = { tags: { $regex: '^important' } };
      const result = await queryOptimizer.applyAutoOptimizations(query, 'ipfscontents');
      
      expect(result.originalQuery).toEqual(query);
      expect(result.optimizedQuery).toBeDefined();
      expect(result.appliedOptimizations.length).toBeGreaterThanOrEqual(0);
      expect(result.improvement).toBeDefined();
    });

    test('should generate index recommendations', async () => {
      const query = { contentType: 'proof', isPublic: true };
      const optimizationPlan = await queryOptimizer.optimizeQuery(query, 'ipfscontents');
      
      const indexRecommendations = optimizationPlan.optimizations.filter(
        opt => opt.type === 'create_index'
      );
      
      expect(indexRecommendations.length).toBeGreaterThan(0);
      expect(indexRecommendations[0].collection).toBe('ipfscontents');
      expect(indexRecommendations[0].index).toBeDefined();
    });
  });

  describe('Database Indexer Tests', () => {
    test('should analyze collection indexes', async () => {
      // Create some test data
      await testDb.collection('ipfscontents').insertMany([
        { cid: 'test1', contentType: 'proof', isPublic: true, owner: 'user1' },
        { cid: 'test2', contentType: 'document', isPublic: false, owner: 'user2' }
      ]);
      
      const analysis = await databaseIndexer.analyzeCollectionIndexes('ipfscontents');
      
      expect(analysis.collection).toBe('ipfscontents');
      expect(analysis.existingIndexes).toBeDefined();
      expect(analysis.stats).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
    });

    test('should create recommended indexes', async () => {
      const recommendations = [
        {
          type: 'single_field',
          priority: 'high',
          fields: { contentType: 1 },
          reason: 'Test index'
        }
      ];
      
      const results = await databaseIndexer.createIndexes('ipfscontents', recommendations);
      
      expect(results.successful).toHaveLength(1);
      expect(results.failed).toHaveLength(0);
      expect(results.successful[0].indexName).toContain('idx_ipfscontents_contentType');
    });

    test('should drop unused indexes', async () => {
      // First create an index
      await testDb.collection('ipfscontents').createIndex({ testField: 1 });
      
      // Then drop unused indexes
      const results = await databaseIndexer.dropUnusedIndexes('ipfscontents', 0);
      
      expect(results.dropped.length).toBeGreaterThanOrEqual(0);
      expect(results.retained.length).toBeGreaterThan(0); // At least _id index
    });
  });

  describe('Query Cache Tests', () => {
    test('should cache and retrieve query results', async () => {
      const query = { contentType: 'proof' };
      const result = [{ cid: 'test1', contentType: 'proof' }];
      
      // Cache the result
      const setResult = await queryCache.set(query, 'ipfscontents', result);
      expect(setResult).toBe(true);
      
      // Retrieve from cache
      const cachedResult = await queryCache.get(query, 'ipfscontents');
      expect(cachedResult).toEqual(result);
    });

    test('should respect TTL', async () => {
      const query = { contentType: 'proof' };
      const result = [{ cid: 'test1' }];
      
      // Cache with short TTL
      await queryCache.set(query, 'ipfscontents', result, { ttl: 50 });
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should return null (expired)
      const cachedResult = await queryCache.get(query, 'ipfscontents');
      expect(cachedResult).toBeNull();
    });

    test('should handle cache eviction', async () => {
      // Create cache with small size
      const smallCache = new QueryCache({ maxSize: 2 });
      
      // Fill cache beyond capacity
      await smallCache.set({ id: 1 }, 'test', { data: 'result1' });
      await smallCache.set({ id: 2 }, 'test', { data: 'result2' });
      await smallCache.set({ id: 3 }, 'test', { data: 'result3' });
      
      // First item should be evicted
      const result1 = await smallCache.get({ id: 1 }, 'test');
      expect(result1).toBeNull();
      
      // Last item should still be cached
      const result3 = await smallCache.get({ id: 3 }, 'test');
      expect(result3).toEqual({ data: 'result3' });
      
      smallCache.shutdown();
    });

    test('should provide accurate statistics', async () => {
      const query = { contentType: 'proof' };
      const result = [{ cid: 'test1' }];
      
      // Set and get to generate stats
      await queryCache.set(query, 'ipfscontents', result);
      await queryCache.get(query, 'ipfscontents');
      await queryCache.get({ other: 'query' }, 'ipfscontents'); // miss
      
      const stats = queryCache.getStats();
      
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('Database Manager Integration Tests', () => {
    test('should initialize all services', async () => {
      const health = await databaseManager.getHealthStatus();
      
      expect(health.connected).toBe(true);
      expect(health.mongoose).toBe(true);
      expect(health.services.queryCache).toBe(true);
      expect(health.services.queryOptimizer).toBe(true);
      expect(health.services.databaseIndexer).toBe(true);
    });

    test('should execute optimized queries', async () => {
      // Insert test data
      await testDb.collection('ipfscontents').insertMany([
        { cid: 'test1', contentType: 'proof', isPublic: true },
        { cid: 'test2', contentType: 'document', isPublic: false }
      ]);
      
      const query = { contentType: 'proof' };
      const result = await databaseManager.executeQuery(
        { collection: { name: 'ipfscontents' } },
        query,
        { cache: true, optimize: true }
      );
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].contentType).toBe('proof');
    });
  });

  describe('Performance Metrics Tests', () => {
    test('should record query performance metrics', async () => {
      const metrics = await PerformanceMetrics.create({
        queryHash: 'test123',
        queryText: '{ contentType: "proof" }',
        executionTime: 150,
        databaseName: 'verinode_test',
        collectionName: 'ipfscontents',
        documentsScanned: 10,
        documentsReturned: 5,
        slowQuery: false,
        cacheHit: false
      });
      
      expect(metrics.queryHash).toBe('test123');
      expect(metrics.executionTime).toBe(150);
      expect(metrics.slowQuery).toBe(false);
    });

    test('should retrieve slow queries', async () => {
      // Create some test metrics
      await PerformanceMetrics.create({
        queryHash: 'slow1',
        queryText: '{ slow: true }',
        executionTime: 1500,
        databaseName: 'verinode_test',
        collectionName: 'ipfscontents',
        slowQuery: true
      });
      
      await PerformanceMetrics.create({
        queryHash: 'fast1',
        queryText: '{ fast: true }',
        executionTime: 100,
        databaseName: 'verinode_test',
        collectionName: 'ipfscontents',
        slowQuery: false
      });
      
      const slowQueries = await PerformanceMetrics.getSlowQueries();
      
      expect(slowQueries.length).toBe(1);
      expect(slowQueries[0].queryHash).toBe('slow1');
      expect(slowQueries[0].slowQuery).toBe(true);
    });

    test('should generate performance report', async () => {
      // Create test metrics
      await PerformanceMetrics.create({
        queryHash: 'test1',
        executionTime: 100,
        databaseName: 'verinode_test',
        collectionName: 'ipfscontents',
        cacheHit: true
      });
      
      await PerformanceMetrics.create({
        queryHash: 'test2',
        executionTime: 200,
        databaseName: 'verinode_test',
        collectionName: 'customtemplates',
        cacheHit: false
      });
      
      const report = await PerformanceMetrics.getPerformanceReport();
      
      expect(report).toBeDefined();
      expect(report.totalQueries).toBe(2);
      expect(report.avgExecutionTime).toBe(150);
      expect(report.cacheHitRate).toBe(0.5);
    });
  });

  describe('End-to-End Performance Tests', () => {
    test('should demonstrate performance improvement with caching', async () => {
      const query = { contentType: 'proof' };
      const result = [{ cid: 'test1', contentType: 'proof' }];
      
      // First execution (no cache)
      const start1 = performance.now();
      await databaseManager.executeQuery(
        { collection: { name: 'ipfscontents' } },
        query,
        { cache: true }
      );
      const time1 = performance.now() - start1;
      
      // Cache the result manually for testing
      await queryCache.set(query, 'ipfscontents', result);
      
      // Second execution (with cache)
      const start2 = performance.now();
      const cachedResult = await databaseManager.executeQuery(
        { collection: { name: 'ipfscontents' } },
        query,
        { cache: true }
      );
      const time2 = performance.now() - start2;
      
      expect(cachedResult).toEqual(result);
      expect(time2).toBeLessThan(time1); // Cache should be faster
    });

    test('should handle high query volume efficiently', async () => {
      const queries = Array.from({ length: 100 }, (_, i) => ({
        contentType: ['proof', 'document', 'image'][i % 3],
        isPublic: i % 2 === 0
      }));
      
      const startTime = performance.now();
      
      // Execute all queries concurrently
      const promises = queries.map(query =>
        databaseManager.executeQuery(
          { collection: { name: 'ipfscontents' } },
          query,
          { cache: true, optimize: true }
        )
      );
      
      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      
      expect(results).toHaveLength(100);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Check cache efficiency
      const stats = queryCache.getStats();
      expect(stats.hitRate).toBeGreaterThan(0.3); // Some cache hits expected
    });
  });
});
