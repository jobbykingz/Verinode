import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { body, query } from 'express-validator';
import { validateRequest } from '../middleware/validation';
import { cacheMiddleware } from '../middleware/cacheMiddleware';

const router = Router();
const analyticsController = new AnalyticsController();

// Shared analytics cache config - 5 min TTL (aggregations are expensive)
const analyticsCache = (keySuffix: string) => cacheMiddleware({
  ttl: 300,
  keyPrefix: 'analytics',
  keyGenerator: (req) => `${keySuffix}:${JSON.stringify(req.query)}`,
  tags: ['analytics']
});

// Usage Trends
router.get('/usage-trends',
  query('timeframe').optional().isIn(['1d', '7d', '30d', '90d', '1y']),
  query('granularity').optional().isIn(['hourly', 'daily', 'weekly', 'monthly']),
  validateRequest,
  analyticsCache('usage-trends'),
  analyticsController.getUsageTrends.bind(analyticsController)
);

// User Behavior
router.get('/user-behavior',
  query('userId').optional().isString(),
  query('timeframe').optional().isIn(['1d', '7d', '30d', '90d', '1y']),
  validateRequest,
  analyticsCache('user-behavior'),
  analyticsController.getUserBehavior.bind(analyticsController)
);

// Performance Metrics
router.get('/performance-metrics',
  query('timeframe').optional().isIn(['1h', '6h', '12h', '24h', '7d']),
  validateRequest,
  analyticsCache('performance-metrics'),
  analyticsController.getPerformanceMetrics.bind(analyticsController)
);

// Custom Reports - not cached (user-defined, highly variable)
router.post('/custom-reports',
  body('metrics').isArray({ min: 1 }),
  body('timeframe').isString(),
  body('filters').optional().isArray(),
  validateRequest,
  analyticsController.getCustomReport.bind(analyticsController)
);

// Predictive Analytics - cache 15 min (model output is stable short-term)
router.get('/predictive-analytics',
  query('metric').isString(),
  query('horizon').optional().isIn(['7d', '30d', '90d', '1y']),
  validateRequest,
  cacheMiddleware({
    ttl: 900,
    keyPrefix: 'analytics',
    keyGenerator: (req) => `predictive:${JSON.stringify(req.query)}`,
    tags: ['analytics']
  }),
  analyticsController.getPredictiveAnalytics.bind(analyticsController)
);

// Business KPIs
router.get('/business-kpis',
  query('timeframe').optional().isIn(['1d', '7d', '30d', '90d', '1y']),
  validateRequest,
  analyticsCache('business-kpis'),
  analyticsController.getBusinessKPIs.bind(analyticsController)
);

// Data Visualization - not cached (config-driven, highly variable)
router.post('/visualization',
  body('chartType').isIn(['line', 'bar', 'pie', 'scatter', 'heatmap', 'gauge', 'funnel']),
  body('data').isArray(),
  body('config').isObject(),
  validateRequest,
  analyticsController.getDataVisualization.bind(analyticsController)
);

export default router;
