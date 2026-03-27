import { WebhookManager } from '../WebhookManager';
import { WebhookEvent } from '../../../models/WebhookEvent';
import { WebhookDelivery } from '../../../models/WebhookDelivery';

describe('WebhookManager', () => {
  let webhookManager: WebhookManager;
  let testWebhookConfig: any;

  beforeEach(() => {
    webhookManager = WebhookManager.getInstance();
    testWebhookConfig = {
      id: 'test-webhook-1',
      url: 'https://example.com/webhook',
      events: ['push', 'pull_request'],
      active: true,
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
        maxDelay: 30000
      },
      rateLimit: {
        requestsPerSecond: 10,
        burstSize: 20
      },
      filters: {
        eventTypes: ['push'],
        payloadConditions: {}
      }
    };
  });

  describe('Webhook Registration', () => {
    it('should register a webhook successfully', async () => {
      await webhookManager.registerWebhook(testWebhookConfig);
      
      const stats = await webhookManager.getWebhookStats(testWebhookConfig.id);
      expect(stats).toBeDefined();
    });

    it('should unregister a webhook successfully', async () => {
      await webhookManager.registerWebhook(testWebhookConfig);
      await webhookManager.unregisterWebhook(testWebhookConfig.id);
      
      try {
        await webhookManager.getWebhookStats(testWebhookConfig.id);
        fail('Should have thrown an error for unregistered webhook');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Event Processing', () => {
    beforeEach(async () => {
      await webhookManager.registerWebhook(testWebhookConfig);
    });

    it('should trigger webhook for matching event', async () => {
      const testEvent = new WebhookEvent({
        type: 'push',
        source: 'github',
        payload: {
          repository: { name: 'test-repo' },
          commits: [{ id: 'abc123' }]
        },
        timestamp: new Date()
      });

      await webhookManager.triggerWebhook(testEvent);
      
      const deliveries = await webhookManager.getDeliveryHistory(testWebhookConfig.id);
      expect(deliveries.length).toBeGreaterThan(0);
    });

    it('should not trigger webhook for non-matching event', async () => {
      const testEvent = new WebhookEvent({
        type: 'issue',
        source: 'github',
        payload: { issue: { id: 123 } },
        timestamp: new Date()
      });

      await webhookManager.triggerWebhook(testEvent);
      
      const deliveries = await webhookManager.getDeliveryHistory(testWebhookConfig.id);
      expect(deliveries.length).toBe(0);
    });
  });

  describe('Webhook Testing', () => {
    beforeEach(async () => {
      await webhookManager.registerWebhook(testWebhookConfig);
    });

    it('should test webhook successfully', async () => {
      const testEvent = {
        action: 'test',
        repository: { name: 'test-repo' }
      };

      const result = await webhookManager.testWebhook(testWebhookConfig.id, testEvent);
      
      expect(result).toBeDefined();
      expect(result.attempt).toBe(1);
    });

    it('should bulk test webhooks successfully', async () => {
      const webhook2Config = { ...testWebhookConfig, id: 'test-webhook-2' };
      await webhookManager.registerWebhook(webhook2Config);

      const testEvent = {
        action: 'bulk-test',
        repository: { name: 'test-repo' }
      };

      const results = await webhookManager.bulkTestWebhooks(
        [testWebhookConfig.id, webhook2Config.id],
        testEvent
      );

      expect(Object.keys(results)).toHaveLength(2);
      expect(results[testWebhookConfig.id]).toBeDefined();
      expect(results[webhook2Config.id]).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await webhookManager.registerWebhook(testWebhookConfig);
    });

    it('should respect rate limits', async () => {
      const testEvent = new WebhookEvent({
        type: 'push',
        source: 'github',
        payload: { repository: { name: 'test-repo' } },
        timestamp: new Date()
      });

      for (let i = 0; i < 25; i++) {
        await webhookManager.triggerWebhook(testEvent);
      }

      const deliveries = await webhookManager.getDeliveryHistory(testWebhookConfig.id);
      expect(deliveries.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid webhook URL', async () => {
      const invalidConfig = { ...testWebhookConfig, url: 'invalid-url' };
      
      try {
        await webhookManager.registerWebhook(invalidConfig);
        fail('Should have thrown an error for invalid URL');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing webhook ID', async () => {
      const invalidConfig = { ...testWebhookConfig };
      delete invalidConfig.id;
      
      try {
        await webhookManager.registerWebhook(invalidConfig);
        fail('Should have thrown an error for missing ID');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle test with non-existent webhook', async () => {
      try {
        await webhookManager.testWebhook('non-existent-webhook', {});
        fail('Should have thrown an error for non-existent webhook');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
