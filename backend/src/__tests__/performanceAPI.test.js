const request = require('supertest');
const app = require('../src/index');
const { manager: databaseManager } = require('../config/database_optimized');

describe('Database Performance API Tests', () => {
  let authToken;

  beforeAll(async () => {
    // Initialize database
    await databaseManager.initialize();
    
    // Get auth token (mock for testing)
    authToken = 'test-token';
  });

  afterAll(async () => {
    await databaseManager.shutdown();
  });

  describe('Performance Monitoring Endpoints', () => {
    test('GET /api/performance/health - should return database health status', async () => {
      const response = await request(app)
        .get('/api/performance/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('connected');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('stats');
    });

    test('GET /api/performance/metrics - should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/performance/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(Array.isArray(response.body.metrics)).toBe(true);
    });

    test('GET /api/performance/slow-queries - should return slow queries', async () => {
      const response = await request(app)
        .get('/api/performance/slow-queries')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('queries');
      expect(Array.isArray(response.body.queries)).toBe(true);
    });
  });

  describe('Query Optimization Endpoints', () => {
    test('POST /api/performance/optimize - should optimize query', async () => {
      const query = {
        collection: 'ipfscontents',
        query: { contentType: 'proof', isPublic: true }
      };

      const response = await request(app)
        .post('/api/performance/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .send(query)
        .expect(200);

      expect(response.body).toHaveProperty('optimizationPlan');
      expect(response.body.optimizationPlan).toHaveProperty('recommendations');
      expect(response.body.optimizationPlan).toHaveProperty('estimatedImprovement');
    });

    test('POST /api/performance/analyze - should analyze query performance', async () => {
      const query = {
        collection: 'ipfscontents',
        query: { contentType: 'proof' }
      };

      const response = await request(app)
        .post('/api/performance/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send(query)
        .expect(200);

      expect(response.body).toHaveProperty('analysis');
      expect(response.body.analysis).toHaveProperty('complexity');
      expect(response.body.analysis).toHaveProperty('recommendations');
    });
  });

  describe('Index Management Endpoints', () => {
    test('GET /api/performance/indexes/:collection - should return collection indexes', async () => {
      const response = await request(app)
        .get('/api/performance/indexes/ipfscontents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('existingIndexes');
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('stats');
    });

    test('POST /api/performance/indexes/:collection - should create recommended indexes', async () => {
      const response = await request(app)
        .post('/api/performance/indexes/ipfscontents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ autoApply: true })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveProperty('successful');
      expect(response.body.results).toHaveProperty('failed');
    });

    test('DELETE /api/performance/indexes/:collection/unused - should drop unused indexes', async () => {
      const response = await request(app)
        .delete('/api/performance/indexes/ipfscontents/unused')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveProperty('dropped');
      expect(response.body.results).toHaveProperty('retained');
    });
  });

  describe('Cache Management Endpoints', () => {
    test('GET /api/performance/cache/stats - should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/performance/cache/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('hitRate');
      expect(response.body.stats).toHaveProperty('currentSize');
    });

    test('POST /api/performance/cache/clear - should clear cache', async () => {
      const response = await request(app)
        .post('/api/performance/cache/clear')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('cleared');
    });

    test('GET /api/performance/cache/info - should return detailed cache info', async () => {
      const response = await request(app)
        .get('/api/performance/cache/info')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('entries');
      expect(response.body).toHaveProperty('totalEntries');
      expect(response.body).toHaveProperty('stats');
    });
  });

  describe('Connection Pool Endpoints', () => {
    test('GET /api/performance/pool/stats - should return connection pool statistics', async () => {
      const response = await request(app)
        .get('/api/performance/pool/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalConnections');
      expect(response.body.stats).toHaveProperty('activeConnections');
    });

    test('GET /api/performance/pool/health - should return connection pool health', async () => {
      const response = await request(app)
        .get('/api/performance/pool/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('healthy');
      expect(response.body).toHaveProperty('issues');
    });
  });
});
