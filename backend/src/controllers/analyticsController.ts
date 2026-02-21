import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { BusinessMetrics } from '../models/BusinessMetrics';

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  async getUsageTrends(req: Request, res: Response) {
    try {
      const { timeframe = '30d', granularity = 'daily' } = req.query;
      const trends = await this.analyticsService.getUsageTrends(
        timeframe as string,
        granularity as string
      );
      res.json(trends);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch usage trends' });
    }
  }

  async getUserBehavior(req: Request, res: Response) {
    try {
      const { userId, timeframe = '30d' } = req.query;
      const behavior = await this.analyticsService.getUserBehavior(
        userId as string,
        timeframe as string
      );
      res.json(behavior);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user behavior' });
    }
  }

  async getPerformanceMetrics(req: Request, res: Response) {
    try {
      const { timeframe = '24h' } = req.query;
      const metrics = await this.analyticsService.getPerformanceMetrics(
        timeframe as string
      );
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch performance metrics' });
    }
  }

  async getCustomReport(req: Request, res: Response) {
    try {
      const { metrics, timeframe, filters } = req.body;
      const report = await this.analyticsService.generateCustomReport(
        metrics,
        timeframe,
        filters
      );
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate custom report' });
    }
  }

  async getPredictiveAnalytics(req: Request, res: Response) {
    try {
      const { metric, horizon = '30d' } = req.query;
      const predictions = await this.analyticsService.getPredictiveAnalytics(
        metric as string,
        horizon as string
      );
      res.json(predictions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch predictive analytics' });
    }
  }

  async getBusinessKPIs(req: Request, res: Response) {
    try {
      const { timeframe = '30d' } = req.query;
      const kpis = await this.analyticsService.getBusinessKPIs(
        timeframe as string
      );
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch business KPIs' });
    }
  }

  async getDataVisualization(req: Request, res: Response) {
    try {
      const { chartType, data, config } = req.body;
      const visualization = await this.analyticsService.generateVisualization(
        chartType,
        data,
        config
      );
      res.json(visualization);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate data visualization' });
    }
  }
}
