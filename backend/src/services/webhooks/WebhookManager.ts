import { WebhookQueue } from './WebhookQueue';
import { WebhookRetry } from './WebhookRetry';
import { WebhookAnalytics } from './WebhookAnalytics';
import { WebhookFilter } from './WebhookFilter';
import { WebhookEvent } from '../../models/WebhookEvent';
import { WebhookDelivery } from '../../models/WebhookDelivery';
import { logger } from '../monitoringService';
import crypto from 'crypto';

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
    maxDelay: number;
  };
  rateLimit: {
    requestsPerSecond: number;
    burstSize: number;
  };
  filters: {
    eventTypes: string[];
    payloadConditions: Record<string, any>;
  };
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
  attempt: number;
}

export class WebhookManager {
  private static instance: WebhookManager;
  private queue: WebhookQueue;
  private retry: WebhookRetry;
  private analytics: WebhookAnalytics;
  private filter: WebhookFilter;
  private webhooks: Map<string, WebhookConfig> = new Map();
  private rateLimiters: Map<string, { tokens: number; lastRefill: number }> = new Map();

  private constructor() {
    this.queue = new WebhookQueue();
    this.retry = new WebhookRetry();
    this.analytics = new WebhookAnalytics();
    this.filter = new WebhookFilter();
  }

  static getInstance(): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager();
    }
    return WebhookManager.instance;
  }

  async registerWebhook(config: WebhookConfig): Promise<void> {
    this.webhooks.set(config.id, config);
    this.rateLimiters.set(config.id, {
      tokens: config.rateLimit.burstSize,
      lastRefill: Date.now()
    });
    
    logger.info(`Webhook registered: ${config.id}`, { config });
    await this.analytics.trackWebhookRegistration(config.id);
  }

  async unregisterWebhook(webhookId: string): Promise<void> {
    this.webhooks.delete(webhookId);
    this.rateLimiters.delete(webhookId);
    
    logger.info(`Webhook unregistered: ${webhookId}`);
    await this.analytics.trackWebhookUnregistration(webhookId);
  }

  async triggerWebhook(event: WebhookEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      const eligibleWebhooks = Array.from(this.webhooks.values())
        .filter(webhook => webhook.active && this.filter.shouldDeliver(webhook, event));

      for (const webhook of eligibleWebhooks) {
        if (this.checkRateLimit(webhook)) {
          const delivery = await this.createDeliveryRecord(webhook, event);
          await this.queue.enqueue({
            webhookId: webhook.id,
            deliveryId: delivery.id,
            event,
            webhook,
            attempt: 1
          });
        } else {
          await this.analytics.trackRateLimitExceeded(webhook.id);
        }
      }

      await this.analytics.trackEventProcessing(event.id, Date.now() - startTime);
    } catch (error) {
      logger.error('Error triggering webhooks', { error, eventId: event.id });
      throw error;
    }
  }

  private async createDeliveryRecord(webhook: WebhookConfig, event: WebhookEvent): Promise<WebhookDelivery> {
    const delivery = new WebhookDelivery({
      webhookId: webhook.id,
      eventId: event.id,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
      payload: event.payload
    });

    await delivery.save();
    return delivery;
  }

  private checkRateLimit(webhook: WebhookConfig): boolean {
    const limiter = this.rateLimiters.get(webhook.id);
    if (!limiter) return false;

    const now = Date.now();
    const timePassed = (now - limiter.lastRefill) / 1000;
    const tokensToAdd = Math.floor(timePassed * webhook.rateLimit.requestsPerSecond);
    
    limiter.tokens = Math.min(webhook.rateLimit.burstSize, limiter.tokens + tokensToAdd);
    limiter.lastRefill = now;

    if (limiter.tokens >= 1) {
      limiter.tokens--;
      return true;
    }

    return false;
  }

  async processWebhookDelivery(job: any): Promise<WebhookDeliveryResult> {
    const { webhookId, deliveryId, event, webhook, attempt } = job;
    const startTime = Date.now();

    try {
      const payload = this.createSignedPayload(webhook, event);
      const response = await this.sendWebhook(webhook.url, payload);

      const result: WebhookDeliveryResult = {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        responseTime: Date.now() - startTime,
        attempt
      };

      await this.updateDeliveryRecord(deliveryId, result);
      await this.analytics.trackDelivery(webhookId, result);

      if (!result.success && attempt < webhook.retryPolicy.maxRetries) {
        const delay = this.retry.calculateDelay(attempt, webhook.retryPolicy);
        await this.queue.enqueueWithDelay(job, delay);
      } else if (!result.success) {
        await this.retry.moveToDeadLetterQueue(job, result);
      }

      return result;
    } catch (error) {
      const result: WebhookDeliveryResult = {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message,
        attempt
      };

      await this.updateDeliveryRecord(deliveryId, result);
      await this.analytics.trackDelivery(webhookId, result);

      if (attempt < webhook.retryPolicy.maxRetries) {
        const delay = this.retry.calculateDelay(attempt, webhook.retryPolicy);
        await this.queue.enqueueWithDelay(job, delay);
      } else {
        await this.retry.moveToDeadLetterQueue(job, result);
      }

      return result;
    }
  }

  private createSignedPayload(webhook: WebhookConfig, event: WebhookEvent): any {
    const payload = {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      data: event.payload
    };

    if (webhook.secret) {
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      return {
        ...payload,
        signature
      };
    }

    return payload;
  }

  private async sendWebhook(url: string, payload: any): Promise<Response> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Verinode-Webhooks/1.0',
        'X-Webhook-Source': 'verinode'
      },
      body: JSON.stringify(payload),
      timeout: 30000
    });

    return response;
  }

  private async updateDeliveryRecord(deliveryId: string, result: WebhookDeliveryResult): Promise<void> {
    const updateData: any = {
      lastAttemptAt: new Date(),
      responseTime: result.responseTime,
      attempts: result.attempt
    };

    if (result.success) {
      updateData.status = 'delivered';
      updateData.deliveredAt = new Date();
      updateData.statusCode = result.statusCode;
    } else {
      updateData.status = 'failed';
      updateData.error = result.error;
      updateData.statusCode = result.statusCode;
    }

    await WebhookDelivery.findByIdAndUpdate(deliveryId, updateData);
  }

  async getWebhookStats(webhookId: string): Promise<any> {
    return this.analytics.getWebhookStats(webhookId);
  }

  async getDeliveryHistory(webhookId: string, limit: number = 50): Promise<WebhookDelivery[]> {
    return WebhookDelivery.find({ webhookId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async testWebhook(webhookId: string, testEvent: any): Promise<WebhookDeliveryResult> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    const event: WebhookEvent = new WebhookEvent({
      type: 'test',
      payload: testEvent,
      timestamp: new Date(),
      source: 'test'
    });

    const job = {
      webhookId,
      deliveryId: 'test-' + Date.now(),
      event,
      webhook,
      attempt: 1
    };

    return this.processWebhookDelivery(job);
  }

  async bulkTestWebhooks(webhookIds: string[], testEvent: any): Promise<Record<string, WebhookDeliveryResult>> {
    const results: Record<string, WebhookDeliveryResult> = {};
    
    await Promise.all(
      webhookIds.map(async (webhookId) => {
        try {
          results[webhookId] = await this.testWebhook(webhookId, testEvent);
        } catch (error) {
          results[webhookId] = {
            success: false,
            responseTime: 0,
            error: error.message,
            attempt: 1
          };
        }
      })
    );

    return results;
  }
}
