const { AnalyticsService } = require('../../src/services/analyticsService');

describe('AnalyticsService', () => {
  let analyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService();
  });

  describe('getUsageTrends', () => {
    it('should return usage trends for specified timeframe', async () => {
      const trends = await analyticsService.getUsageTrends('30d', 'daily');
      
      expect(trends).toBeInstanceOf(Array);
      expect(trends.length).toBe(30);
      
      const trend = trends[0];
      expect(trend).toHaveProperty('date');
      expect(trend).toHaveProperty('metric');
      expect(trend).toHaveProperty('value');
      expect(trend).toHaveProperty('change');
      expect(trend).toHaveProperty('changePercent');
      expect(trend).toHaveProperty('forecast');
    });

    it('should handle different granularities', async () => {
      const dailyTrends = await analyticsService.getUsageTrends('7d', 'daily');
      const weeklyTrends = await analyticsService.getUsageTrends('30d', 'weekly');
      
      expect(dailyTrends.length).toBe(7);
      expect(weeklyTrends.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getUserBehavior', () => {
    it('should return user behavior data', async () => {
      const behavior = await analyticsService.getUserBehavior('user123', '30d');
      
      expect(behavior).toBeInstanceOf(Array);
      expect(behavior.length).toBeGreaterThan(0);
      
      const userBehavior = behavior[0];
      expect(userBehavior).toHaveProperty('loginFrequency');
      expect(userBehavior).toHaveProperty('proofCreationRate');
      expect(userBehavior).toHaveProperty('verificationRate');
      expect(userBehavior).toHaveProperty('featureUsage');
      expect(userBehavior).toHaveProperty('sessionDuration');
      expect(userBehavior).toHaveProperty('lastActivity');
    });

    it('should work without userId parameter', async () => {
      const behavior = await analyticsService.getUserBehavior(undefined, '30d');
      expect(behavior).toBeInstanceOf(Array);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance bottlenecks', async () => {
      const metrics = await analyticsService.getPerformanceMetrics('24h');
      
      expect(metrics).toBeInstanceOf(Array);
      expect(metrics.length).toBeGreaterThan(0);
      
      const bottleneck = metrics[0];
      expect(bottleneck).toHaveProperty('area');
      expect(bottleneck).toHaveProperty('severity');
      expect(bottleneck).toHaveProperty('description');
      expect(bottleneck).toHaveProperty('impact');
      expect(bottleneck).toHaveProperty('recommendations');
      expect(bottleneck).toHaveProperty('affectedUsers');
      expect(bottleneck).toHaveProperty('frequency');
      
      expect(['low', 'medium', 'high', 'critical']).toContain(bottleneck.severity);
    });
  });

  describe('generateCustomReport', () => {
    it('should generate a custom report', async () => {
      const metrics = ['total_users', 'revenue'];
      const timeframe = '30d';
      const filters = [];
      
      const report = await analyticsService.generateCustomReport(metrics, timeframe, filters);
      
      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('name');
      expect(report).toHaveProperty('description');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('timeframe');
      expect(report).toHaveProperty('filters');
      expect(report).toHaveProperty('data');
      expect(report).toHaveProperty('createdAt');
      expect(report).toHaveProperty('updatedAt');
      expect(report).toHaveProperty('createdBy');
      
      expect(report.metrics).toEqual(metrics);
      expect(report.timeframe).toEqual(timeframe);
      expect(report.filters).toEqual(filters);
      expect(report.data).toBeInstanceOf(Array);
    });

    it('should generate data points for each metric', async () => {
      const metrics = ['metric1', 'metric2'];
      const timeframe = '7d';
      
      const report = await analyticsService.generateCustomReport(metrics, timeframe, []);
      
      expect(report.data.length).toBe(7);
      report.data.forEach(dataPoint => {
        expect(dataPoint).toHaveProperty('timestamp');
        expect(dataPoint).toHaveProperty('metrics');
        expect(dataPoint).toHaveProperty('dimensions');
        
        expect(Object.keys(dataPoint.metrics)).toEqual(expect.arrayContaining(metrics));
      });
    });
  });

  describe('getPredictiveAnalytics', () => {
    it('should return predictive model', async () => {
      const metric = 'user_growth';
      const horizon = '30d';
      
      const model = await analyticsService.getPredictiveAnalytics(metric, horizon);
      
      expect(model).toHaveProperty('metric');
      expect(model).toHaveProperty('predictions');
      expect(model).toHaveProperty('confidence');
      expect(model).toHaveProperty('accuracy');
      expect(model).toHaveProperty('modelType');
      expect(model).toHaveProperty('lastTrained');
      
      expect(model.metric).toEqual(metric);
      expect(model.predictions).toBeInstanceOf(Array);
      expect(model.predictions.length).toBe(30);
      
      const prediction = model.predictions[0];
      expect(prediction).toHaveProperty('date');
      expect(prediction).toHaveProperty('value');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction).toHaveProperty('range');
      expect(prediction.range).toHaveProperty('lower');
      expect(prediction.range).toHaveProperty('upper');
    });
  });

  describe('getBusinessKPIs', () => {
    it('should return KPI dashboard', async () => {
      const dashboard = await analyticsService.getBusinessKPIs('30d');
      
      expect(dashboard).toHaveProperty('id');
      expect(dashboard).toHaveProperty('name');
      expect(dashboard).toHaveProperty('description');
      expect(dashboard).toHaveProperty('kpis');
      expect(dashboard).toHaveProperty('timeframe');
      expect(dashboard).toHaveProperty('refreshInterval');
      expect(dashboard).toHaveProperty('lastUpdated');
      expect(dashboard).toHaveProperty('widgets');
      
      expect(dashboard.kpis).toBeInstanceOf(Array);
      expect(dashboard.kpis.length).toBeGreaterThan(0);
      
      const kpi = dashboard.kpis[0];
      expect(kpi).toHaveProperty('id');
      expect(kpi).toHaveProperty('name');
      expect(kpi).toHaveProperty('value');
      expect(kpi).toHaveProperty('unit');
      expect(kpi).toHaveProperty('trend');
      expect(kpi).toHaveProperty('change');
      expect(kpi).toHaveProperty('changePercent');
      expect(kpi).toHaveProperty('status');
      
      expect(['up', 'down', 'stable']).toContain(kpi.trend);
      expect(['good', 'warning', 'critical']).toContain(kpi.status);
    });
  });

  describe('generateVisualization', () => {
    it('should generate visualization configuration', async () => {
      const chartType = 'line';
      const data = [{ name: 'Test', value: 100 }];
      const config = { title: 'Test Chart' };
      
      const viz = await analyticsService.generateVisualization(chartType, data, config);
      
      expect(viz).toHaveProperty('id');
      expect(viz).toHaveProperty('type');
      expect(viz).toHaveProperty('title');
      expect(viz).toHaveProperty('data');
      expect(viz).toHaveProperty('config');
      expect(viz).toHaveProperty('interactive');
      expect(viz).toHaveProperty('realtime');
      
      expect(viz.type).toEqual(chartType);
      expect(viz.data).toEqual(data);
      expect(viz.interactive).toBe(true);
      expect(viz.realtime).toBe(false);
    });
  });

  describe('getRealTimeMetrics', () => {
    it('should return real-time system metrics', async () => {
      const metrics = await analyticsService.getRealTimeMetrics();
      
      expect(metrics).toBeInstanceOf(Object);
      expect(metrics).toHaveProperty('activeUsers');
      expect(metrics).toHaveProperty('requestsPerSecond');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('diskUsage');
      expect(metrics).toHaveProperty('networkIn');
      expect(metrics).toHaveProperty('networkOut');
      expect(metrics).toHaveProperty('databaseConnections');
      
      Object.values(metrics).forEach(value => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('trackEvent', () => {
    it('should track analytics events', async () => {
      const event = {
        id: 'event123',
        userId: 'user123',
        sessionId: 'session123',
        eventType: 'user_action',
        eventName: 'proof_created',
        properties: { proofId: 'proof123' },
        timestamp: new Date(),
        userAgent: 'Mozilla/5.0...',
        ipAddress: '192.168.1.1'
      };
      
      // This should not throw an error
      await expect(analyticsService.trackEvent(event)).resolves.toBeUndefined();
    });
  });
});
