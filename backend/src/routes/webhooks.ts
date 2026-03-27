import { Router } from 'express';
import { WebhookAdminController } from '../controllers/WebhookAdminController';
import { WebhookManager } from '../services/webhooks/WebhookManager';
import { WebhookEvent } from '../models/WebhookEvent';
import { WebhookDelivery } from '../models/WebhookDelivery';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validation';

const router = Router();
const adminController = new WebhookAdminController();
const webhookManager = WebhookManager.getInstance();

router.post('/webhooks', [
  body('id').notEmpty().withMessage('Webhook ID is required'),
  body('url').isURL().withMessage('Valid webhook URL is required'),
  body('events').isArray().withMessage('Events must be an array'),
  body('active').isBoolean().withMessage('Active status must be boolean'),
  body('retryPolicy.maxRetries').isInt({ min: 0 }).withMessage('Max retries must be non-negative integer'),
  body('retryPolicy.initialDelay').isInt({ min: 0 }).withMessage('Initial delay must be non-negative integer'),
  body('retryPolicy.backoffMultiplier').isFloat({ min: 1 }).withMessage('Backoff multiplier must be >= 1'),
  body('rateLimit.requestsPerSecond').isInt({ min: 1 }).withMessage('Requests per second must be positive integer'),
  body('rateLimit.burstSize').isInt({ min: 1 }).withMessage('Burst size must be positive integer'),
  validateRequest
], adminController.createWebhook.bind(adminController));

router.put('/webhooks/:webhookId', [
  param('webhookId').notEmpty().withMessage('Webhook ID is required'),
  body('url').optional().isURL().withMessage('Valid webhook URL is required'),
  body('events').optional().isArray().withMessage('Events must be an array'),
  body('active').optional().isBoolean().withMessage('Active status must be boolean'),
  validateRequest
], adminController.updateWebhook.bind(adminController));

router.delete('/webhooks/:webhookId', [
  param('webhookId').notEmpty().withMessage('Webhook ID is required'),
  validateRequest
], adminController.deleteWebhook.bind(adminController));

router.get('/webhooks/:webhookId', [
  param('webhookId').notEmpty().withMessage('Webhook ID is required'),
  validateRequest
], adminController.getWebhook.bind(adminController));

router.get('/webhooks', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  validateRequest
], adminController.listWebhooks.bind(adminController));

router.post('/webhooks/:webhookId/test', [
  param('webhookId').notEmpty().withMessage('Webhook ID is required'),
  body().notEmpty().withMessage('Test event data is required'),
  validateRequest
], adminController.testWebhook.bind(adminController));

router.post('/webhooks/bulk-test', [
  body('webhookIds').isArray({ min: 1 }).withMessage('Webhook IDs must be a non-empty array'),
  body('testEvent').notEmpty().withMessage('Test event data is required'),
  validateRequest
], adminController.bulkTestWebhooks.bind(adminController));

router.get('/queue/stats', adminController.getQueueStats.bind(adminController));

router.get('/queue/pending', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validateRequest
], adminController.getPendingJobs.bind(adminController));

router.get('/queue/processing', adminController.getProcessingJobs.bind(adminController));

router.get('/queue/dead-letter', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validateRequest
], adminController.getDeadLetterJobs.bind(adminController));

router.post('/queue/dead-letter/:jobId/retry', [
  param('jobId').notEmpty().withMessage('Job ID is required'),
  validateRequest
], adminController.retryDeadLetterJob.bind(adminController));

router.post('/queue/dead-letter/bulk-retry', [
  body('jobIds').isArray({ min: 1 }).withMessage('Job IDs must be a non-empty array'),
  validateRequest
], adminController.bulkRetryDeadLetterJobs.bind(adminController));

router.delete('/queue/dead-letter', adminController.clearDeadLetterQueue.bind(adminController));

router.get('/analytics', [
  query('webhookId').optional().isString().withMessage('Webhook ID must be a string'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  validateRequest
], adminController.getAnalytics.bind(adminController));

router.get('/analytics/performance-report', [
  query('startDate').isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').isISO8601().withMessage('End date must be a valid date'),
  validateRequest
], adminController.getPerformanceReport.bind(adminController));

router.post('/filters', [
  body('id').notEmpty().withMessage('Filter rule ID is required'),
  body('name').notEmpty().withMessage('Filter rule name is required'),
  body('conditions').isArray({ min: 1 }).withMessage('Conditions must be a non-empty array'),
  body('logic').isIn(['AND', 'OR']).withMessage('Logic must be AND or OR'),
  body('priority').isInt({ min: 1 }).withMessage('Priority must be a positive integer'),
  validateRequest
], adminController.createFilterRule.bind(adminController));

router.put('/filters/:ruleId', [
  param('ruleId').notEmpty().withMessage('Filter rule ID is required'),
  validateRequest
], adminController.updateFilterRule.bind(adminController));

router.delete('/filters/:ruleId', [
  param('ruleId').notEmpty().withMessage('Filter rule ID is required'),
  validateRequest
], adminController.deleteFilterRule.bind(adminController));

router.get('/filters', adminController.listFilterRules.bind(adminController));

router.post('/filters/:ruleId/test', [
  param('ruleId').notEmpty().withMessage('Filter rule ID is required'),
  body().notEmpty().withMessage('Test event data is required'),
  validateRequest
], adminController.testFilterRule.bind(adminController));

router.get('/events', [
  query('type').optional().isString().withMessage('Type must be a string'),
  query('source').optional().isString().withMessage('Source must be a string'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  validateRequest
], adminController.getEvents.bind(adminController));

router.get('/deliveries', [
  query('webhookId').optional().isString().withMessage('Webhook ID must be a string'),
  query('status').optional().isIn(['pending', 'processing', 'delivered', 'failed', 'retrying', 'dead_letter']).withMessage('Invalid status'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validateRequest
], adminController.getDeliveries.bind(adminController));

router.post('/events', [
  body('type').notEmpty().withMessage('Event type is required'),
  body('source').notEmpty().withMessage('Event source is required'),
  body('payload').notEmpty().withMessage('Event payload is required'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'critical']).withMessage('Invalid priority'),
  validateRequest
], async (req, res) => {
  try {
    const { type, source, payload, priority = 'normal', tags = [] } = req.body;

    const event = new WebhookEvent({
      type,
      source,
      payload,
      priority,
      tags,
      timestamp: new Date(),
      metadata: {
        requestId: req.headers['x-request-id'] as string,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      }
    });

    await event.save();
    await webhookManager.triggerWebhook(event);

    res.status(201).json({
      message: 'Event created and webhook triggers initiated',
      eventId: event.id,
      event: {
        id: event.id,
        type: event.type,
        source: event.source,
        timestamp: event.timestamp,
        priority: event.priority
      }
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/events/:eventId', [
  param('eventId').notEmpty().withMessage('Event ID is required'),
  validateRequest
], async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await WebhookEvent.findOne({ id: eventId });

    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    const deliveries = await WebhookDelivery.find({ eventId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      event,
      deliveries
    });
  } catch (error) {
    console.error('Error getting event:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/deliveries/:deliveryId', [
  param('deliveryId').notEmpty().withMessage('Delivery ID is required'),
  validateRequest
], async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const delivery = await WebhookDelivery.findOne({ id: deliveryId });

    if (!delivery) {
      return res.status(404).json({
        error: 'Delivery not found'
      });
    }

    const event = await WebhookEvent.findOne({ id: delivery.eventId });

    res.json({
      delivery,
      event
    });
  } catch (error) {
    console.error('Error getting delivery:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/deliveries/:deliveryId/retry', [
  param('deliveryId').notEmpty().withMessage('Delivery ID is required'),
  validateRequest
], async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const delivery = await WebhookDelivery.findOne({ id: deliveryId });

    if (!delivery) {
      return res.status(404).json({
        error: 'Delivery not found'
      });
    }

    if (delivery.status === 'delivered') {
      return res.status(400).json({
        error: 'Cannot retry a delivered webhook'
      });
    }

    if (!delivery.canRetry()) {
      return res.status(400).json({
        error: 'Webhook delivery cannot be retried (max attempts reached or expired)'
      });
    }

    delivery.markForRetry(new Date());
    await delivery.save();

    res.json({
      message: 'Webhook delivery marked for retry',
      deliveryId: delivery.id,
      nextRetryAt: delivery.nextRetryAt
    });
  } catch (error) {
    console.error('Error retrying delivery:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/health', async (req, res) => {
  try {
    const queueStats = await adminController['queue'].getQueueStats();
    const retryStats = await adminController['retry'].getRetryStats();
    
    const isHealthy = queueStats.pending < 1000 && queueStats.deadLetter < 100;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      queue: queueStats,
      retry: retryStats,
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Error getting health status:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const globalMetrics = await adminController['analytics'].getGlobalMetrics();
    const queueStats = await adminController['queue'].getQueueStats();
    const retryStats = await adminController['retry'].getRetryStats();
    const filterStats = adminController['filter'].getFilterStatistics();

    res.json({
      timestamp: new Date().toISOString(),
      analytics: globalMetrics,
      queue: queueStats,
      retry: retryStats,
      filters: filterStats
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
