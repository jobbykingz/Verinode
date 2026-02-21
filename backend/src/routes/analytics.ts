import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { body, query } from 'express-validator';
import { validateRequest } from '../middleware/validation';

const router = Router();
const analyticsController = new AnalyticsController();

// Usage Trends
router.get('/usage-trends',
  query('timeframe').optional().isIn(['1d', '7d', '30d', '90d', '1y']),
  query('granularity').optional().isIn(['hourly', 'daily', 'weekly', 'monthly']),
  validateRequest,
  analyticsController.getUsageTrends.bind(analyticsController)
);

// User Behavior
router.get('/user-behavior',
  query('userId').optional().isString(),
  query('timeframe').optional().isIn(['1d', '7d', '30d', '90d', '1y']),
  validateRequest,
  analyticsController.getUserBehavior.bind(analyticsController)
);

// Performance Metrics
router.get('/performance-metrics',
  query('timeframe').optional().isIn(['1h', '6h', '12h', '24h', '7d']),
  validateRequest,
  analyticsController.getPerformanceMetrics.bind(analyticsController)
);

// Custom Reports
router.post('/custom-reports',
  body('metrics').isArray({ min: 1 }),
  body('timeframe').isString(),
  body('filters').optional().isArray(),
  validateRequest,
  analyticsController.getCustomReport.bind(analyticsController)
);

// Predictive Analytics
router.get('/predictive-analytics',
  query('metric').isString(),
  query('horizon').optional().isIn(['7d', '30d', '90d', '1y']),
  validateRequest,
  analyticsController.getPredictiveAnalytics.bind(analyticsController)
);

// Business KPIs
router.get('/business-kpis',
  query('timeframe').optional().isIn(['1d', '7d', '30d', '90d', '1y']),
  validateRequest,
  analyticsController.getBusinessKPIs.bind(analyticsController)
);

// Data Visualization
router.post('/visualization',
  body('chartType').isIn(['line', 'bar', 'pie', 'scatter', 'heatmap', 'gauge', 'funnel']),
  body('data').isArray(),
  body('config').isObject(),
  validateRequest,
  analyticsController.getDataVisualization.bind(analyticsController)
);

export default router;
