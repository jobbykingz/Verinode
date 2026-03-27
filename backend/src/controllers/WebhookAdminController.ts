import { Request, Response } from 'express';
import { WebhookManager } from '../services/webhooks/WebhookManager';
import { WebhookQueue } from '../services/webhooks/WebhookQueue';
import { WebhookRetry } from '../services/webhooks/WebhookRetry';
import { WebhookAnalytics } from '../services/webhooks/WebhookAnalytics';
import { WebhookFilter } from '../services/webhooks/WebhookFilter';
import { WebhookEvent } from '../models/WebhookEvent';
import { WebhookDelivery } from '../models/WebhookDelivery';
import { logger } from '../services/monitoringService';

export class WebhookAdminController {
  private webhookManager: WebhookManager;
  private queue: WebhookQueue;
  private retry: WebhookRetry;
  private analytics: WebhookAnalytics;
  private filter: WebhookFilter;

  constructor() {
    this.webhookManager = WebhookManager.getInstance();
    this.queue = new WebhookQueue();
    this.retry = new WebhookRetry();
    this.analytics = new WebhookAnalytics();
    this.filter = new WebhookFilter();
  }

  async createWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookConfig = req.body;
      
      const validationErrors = this.validateWebhookConfig(webhookConfig);
      if (validationErrors.length > 0) {
        res.status(400).json({
          error: 'Validation failed',
          details: validationErrors
        });
        return;
      }

      await this.webhookManager.registerWebhook(webhookConfig);
      
      logger.info(`Webhook created: ${webhookConfig.id}`, {
        webhookId: webhookConfig.id,
        url: webhookConfig.url
      });

      res.status(201).json({
        message: 'Webhook created successfully',
        webhook: webhookConfig
      });
    } catch (error) {
      logger.error('Error creating webhook', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async updateWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const updates = req.body;

      const validationErrors = this.validateWebhookConfig(updates, true);
      if (validationErrors.length > 0) {
        res.status(400).json({
          error: 'Validation failed',
          details: validationErrors
        });
        return;
      }

      await this.webhookManager.unregisterWebhook(webhookId);
      await this.webhookManager.registerWebhook({ ...updates, id: webhookId });
      
      logger.info(`Webhook updated: ${webhookId}`, { updates });

      res.json({
        message: 'Webhook updated successfully',
        webhook: { ...updates, id: webhookId }
      });
    } catch (error) {
      logger.error('Error updating webhook', { error: error.message, webhookId: req.params.webhookId });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async deleteWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      
      await this.webhookManager.unregisterWebhook(webhookId);
      
      logger.info(`Webhook deleted: ${webhookId}`);

      res.json({
        message: 'Webhook deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting webhook', { error: error.message, webhookId: req.params.webhookId });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async getWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const stats = await this.webhookManager.getWebhookStats(webhookId);
      const deliveryHistory = await this.webhookManager.getDeliveryHistory(webhookId, 10);

      res.json({
        webhookId,
        stats,
        recentDeliveries: deliveryHistory
      });
    } catch (error) {
      logger.error('Error getting webhook', { error: error.message, webhookId: req.params.webhookId });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async listWebhooks(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const globalMetrics = await this.analytics.getGlobalMetrics();
      
      res.json({
        webhooks: globalMetrics,
        pagination: {
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (error) {
      logger.error('Error listing webhooks', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async testWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const testEvent = req.body;

      const result = await this.webhookManager.testWebhook(webhookId, testEvent);
      
      logger.info(`Webhook test completed: ${webhookId}`, { result });

      res.json({
        message: 'Webhook test completed',
        result
      });
    } catch (error) {
      logger.error('Error testing webhook', { error: error.message, webhookId: req.params.webhookId });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async bulkTestWebhooks(req: Request, res: Response): Promise<void> {
    try {
      const { webhookIds, testEvent } = req.body;

      if (!Array.isArray(webhookIds) || webhookIds.length === 0) {
        res.status(400).json({
          error: 'webhookIds must be a non-empty array'
        });
        return;
      }

      const results = await this.webhookManager.bulkTestWebhooks(webhookIds, testEvent);
      
      logger.info(`Bulk webhook test completed`, { 
        webhookCount: webhookIds.length,
        successful: Object.values(results).filter(r => r.success).length
      });

      res.json({
        message: 'Bulk webhook test completed',
        results
      });
    } catch (error) {
      logger.error('Error bulk testing webhooks', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async getQueueStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.queue.getQueueStats();
      
      res.json({
        message: 'Queue statistics retrieved',
        stats
      });
    } catch (error) {
      logger.error('Error getting queue stats', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async getPendingJobs(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50 } = req.query;
      const jobs = await this.queue.getPendingJobs(Number(limit));
      
      res.json({
        message: 'Pending jobs retrieved',
        jobs
      });
    } catch (error) {
      logger.error('Error getting pending jobs', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async getProcessingJobs(req: Request, res: Response): Promise<void> {
    try {
      const jobs = await this.queue.getProcessingJobs();
      
      res.json({
        message: 'Processing jobs retrieved',
        jobs
      });
    } catch (error) {
      logger.error('Error getting processing jobs', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async getDeadLetterJobs(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50 } = req.query;
      const jobs = await this.retry.getDeadLetterJobs(Number(limit));
      
      res.json({
        message: 'Dead letter jobs retrieved',
        jobs
      });
    } catch (error) {
      logger.error('Error getting dead letter jobs', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async retryDeadLetterJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      await this.retry.retryDeadLetterJob(jobId);
      
      logger.info(`Dead letter job retried: ${jobId}`);

      res.json({
        message: 'Dead letter job retried successfully'
      });
    } catch (error) {
      logger.error('Error retrying dead letter job', { error: error.message, jobId: req.params.jobId });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async bulkRetryDeadLetterJobs(req: Request, res: Response): Promise<void> {
    try {
      const { jobIds } = req.body;

      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        res.status(400).json({
          error: 'jobIds must be a non-empty array'
        });
        return;
      }

      await this.retry.bulkRetryDeadLetterJobs(jobIds);
      
      logger.info(`Bulk dead letter retry completed`, { jobCount: jobIds.length });

      res.json({
        message: 'Bulk dead letter retry completed'
      });
    } catch (error) {
      logger.error('Error bulk retrying dead letter jobs', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async clearDeadLetterQueue(req: Request, res: Response): Promise<void> {
    try {
      await this.retry.clearDeadLetterQueue();
      
      logger.info('Dead letter queue cleared');

      res.json({
        message: 'Dead letter queue cleared successfully'
      });
    } catch (error) {
      logger.error('Error clearing dead letter queue', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId, startDate, endDate } = req.query;
      
      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }

      let analytics;
      if (webhookId) {
        analytics = await this.analytics.getWebhookStats(webhookId as string, timeRange);
      } else {
        analytics = await this.analytics.getGlobalMetrics(timeRange);
      }

      res.json({
        message: 'Analytics retrieved',
        analytics
      });
    } catch (error) {
      logger.error('Error getting analytics', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async getPerformanceReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'startDate and endDate are required'
        });
        return;
      }

      const timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };

      const report = await this.analytics.getPerformanceReport(timeRange);

      res.json({
        message: 'Performance report generated',
        report
      });
    } catch (error) {
      logger.error('Error generating performance report', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async createFilterRule(req: Request, res: Response): Promise<void> {
    try {
      const filterRule = req.body;
      
      const validationErrors = this.filter.validateFilterRule(filterRule);
      if (validationErrors.length > 0) {
        res.status(400).json({
          error: 'Validation failed',
          details: validationErrors
        });
        return;
      }

      this.filter.createFilterRule(filterRule);
      
      logger.info(`Filter rule created: ${filterRule.id}`, { filterRule });

      res.status(201).json({
        message: 'Filter rule created successfully',
        filterRule
      });
    } catch (error) {
      logger.error('Error creating filter rule', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async updateFilterRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;
      const updates = req.body;

      this.filter.updateFilterRule(ruleId, updates);
      
      logger.info(`Filter rule updated: ${ruleId}`, { updates });

      res.json({
        message: 'Filter rule updated successfully',
        filterRule: { ...updates, id: ruleId }
      });
    } catch (error) {
      logger.error('Error updating filter rule', { error: error.message, ruleId: req.params.ruleId });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async deleteFilterRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;
      
      this.filter.deleteFilterRule(ruleId);
      
      logger.info(`Filter rule deleted: ${ruleId}`);

      res.json({
        message: 'Filter rule deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting filter rule', { error: error.message, ruleId: req.params.ruleId });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async listFilterRules(req: Request, res: Response): Promise<void> {
    try {
      const rules = this.filter.getAllFilterRules();
      
      res.json({
        message: 'Filter rules retrieved',
        rules
      });
    } catch (error) {
      logger.error('Error listing filter rules', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async testFilterRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;
      const testEvent = req.body;

      const result = this.filter.testFilterRule(ruleId, testEvent);
      
      logger.info(`Filter rule test completed: ${ruleId}`, { result });

      res.json({
        message: 'Filter rule test completed',
        result
      });
    } catch (error) {
      logger.error('Error testing filter rule', { error: error.message, ruleId: req.params.ruleId });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const { type, source, limit = 50, offset = 0 } = req.query;
      
      let events;
      if (type) {
        events = await WebhookEvent.findByType(type as string, Number(limit));
      } else if (source) {
        events = await WebhookEvent.findBySource(source as string, Number(limit));
      } else {
        events = await WebhookEvent.find()
          .sort({ timestamp: -1 })
          .limit(Number(limit))
          .skip(Number(offset))
          .exec();
      }

      res.json({
        message: 'Events retrieved',
        events
      });
    } catch (error) {
      logger.error('Error getting events', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  async getDeliveries(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId, status, limit = 50 } = req.query;
      
      let deliveries;
      if (webhookId) {
        deliveries = await WebhookDelivery.findByWebhookId(webhookId as string, Number(limit));
      } else if (status) {
        deliveries = await WebhookDelivery.findByStatus(status as string, Number(limit));
      } else {
        deliveries = await WebhookDelivery.find()
          .sort({ createdAt: -1 })
          .limit(Number(limit))
          .exec();
      }

      res.json({
        message: 'Deliveries retrieved',
        deliveries
      });
    } catch (error) {
      logger.error('Error getting deliveries', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  private validateWebhookConfig(config: any, isUpdate = false): string[] {
    const errors: string[] = [];

    if (!isUpdate && !config.id) {
      errors.push('Webhook ID is required');
    }

    if (!config.url) {
      errors.push('Webhook URL is required');
    } else {
      try {
        new URL(config.url);
      } catch {
        errors.push('Invalid webhook URL format');
      }
    }

    if (!config.events || !Array.isArray(config.events)) {
      errors.push('Events must be an array');
    }

    if (config.retryPolicy) {
      if (typeof config.retryPolicy.maxRetries !== 'number' || config.retryPolicy.maxRetries < 0) {
        errors.push('maxRetries must be a non-negative number');
      }
      if (typeof config.retryPolicy.initialDelay !== 'number' || config.retryPolicy.initialDelay < 0) {
        errors.push('initialDelay must be a non-negative number');
      }
    }

    if (config.rateLimit) {
      if (typeof config.rateLimit.requestsPerSecond !== 'number' || config.rateLimit.requestsPerSecond <= 0) {
        errors.push('requestsPerSecond must be a positive number');
      }
      if (typeof config.rateLimit.burstSize !== 'number' || config.rateLimit.burstSize <= 0) {
        errors.push('burstSize must be a positive number');
      }
    }

    return errors;
  }
}
