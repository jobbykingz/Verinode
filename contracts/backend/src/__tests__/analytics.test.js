const request = require('supertest');
const app = require('../../src/index');

describe('Analytics API', () => {
  describe('GET /api/analytics/usage-trends', () => {
    it('should return usage trends data', async () => {
      const response = await request(app)
        .get('/api/analytics/usage-trends')
        .query({ timeframe: '30d', granularity: 'daily' })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('date');
      expect(response.body[0]).toHaveProperty('value');
      expect(response.body[0]).toHaveProperty('change');
      expect(response.body[0]).toHaveProperty('changePercent');
    });

    it('should validate timeframe parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/usage-trends')
        .query({ timeframe: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/analytics/user-behavior', () => {
    it('should return user behavior data', async () => {
      const response = await request(app)
        .get('/api/analytics/user-behavior')
        .query({ timeframe: '30d' })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('loginFrequency');
      expect(response.body[0]).toHaveProperty('proofCreationRate');
      expect(response.body[0]).toHaveProperty('verificationRate');
      expect(response.body[0]).toHaveProperty('featureUsage');
    });

    it('should accept userId parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/user-behavior')
        .query({ userId: 'test-user', timeframe: '30d' })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/analytics/performance-metrics', () => {
    it('should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/performance-metrics')
        .query({ timeframe: '24h' })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('area');
      expect(response.body[0]).toHaveProperty('severity');
      expect(response.body[0]).toHaveProperty('description');
      expect(response.body[0]).toHaveProperty('recommendations');
    });
  });

  describe('POST /api/analytics/custom-reports', () => {
    it('should create a custom report', async () => {
      const reportData = {
        metrics: ['total_users', 'revenue'],
        timeframe: '30d',
        filters: []
      };

      const response = await request(app)
        .post('/api/analytics/custom-reports')
        .send(reportData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('timeframe');
      expect(response.body).toHaveProperty('data');
    });

    it('should validate report data', async () => {
      const invalidData = {
        metrics: [], // Empty metrics array should fail validation
        timeframe: '30d'
      };

      const response = await request(app)
        .post('/api/analytics/custom-reports')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/analytics/predictive-analytics', () => {
    it('should return predictive analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/predictive-analytics')
        .query({ metric: 'user_growth', horizon: '30d' })
        .expect(200);

      expect(response.body).toHaveProperty('metric');
      expect(response.body).toHaveProperty('predictions');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('accuracy');
      expect(response.body).toHaveProperty('modelType');
      expect(response.body.predictions).toBeInstanceOf(Array);
    });

    it('should validate metric parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/predictive-analytics')
        .query({ metric: '', horizon: '30d' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/analytics/business-kpis', () => {
    it('should return business KPIs', async () => {
      const response = await request(app)
        .get('/api/analytics/business-kpis')
        .query({ timeframe: '30d' })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('kpis');
      expect(response.body.kpis).toBeInstanceOf(Array);
      expect(response.body.kpis.length).toBeGreaterThan(0);
      
      const kpi = response.body.kpis[0];
      expect(kpi).toHaveProperty('id');
      expect(kpi).toHaveProperty('name');
      expect(kpi).toHaveProperty('value');
      expect(kpi).toHaveProperty('trend');
      expect(kpi).toHaveProperty('status');
    });
  });

  describe('POST /api/analytics/visualization', () => {
    it('should generate data visualization', async () => {
      const vizData = {
        chartType: 'line',
        data: [
          { name: 'Jan', value: 100 },
          { name: 'Feb', value: 200 }
        ],
        config: {
          title: 'Test Chart',
          xAxis: 'name',
          yAxis: 'value'
        }
      };

      const response = await request(app)
        .post('/api/analytics/visualization')
        .send(vizData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('config');
    });

    it('should validate chart type', async () => {
      const invalidData = {
        chartType: 'invalid',
        data: [],
        config: {}
      };

      const response = await request(app)
        .post('/api/analytics/visualization')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
