import { WinstonLogger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface PushNotificationPayload {
  to: string | string[]; // Device tokens or topics
  title: string;
  body: string;
  data?: Record<string, any>;
  actions?: NotificationAction[];
  imageUrl?: string;
  sound?: string;
  vibrate?: boolean;
  priority?: 'normal' | 'high';
  ttl?: number; // Time to live in seconds
  category?: string;
  collapseKey?: string;
}

export interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
  input?: boolean;
  placeholder?: string;
  url?: string; // Deep link URL
}

export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android';
  userId: string;
  deviceId: string;
  appVersion: string;
  osVersion: string;
  isActive: boolean;
  registeredAt: Date;
  lastSeen: Date;
  metadata?: Record<string, any>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  actions?: NotificationAction[];
  imageUrl?: string;
  sound?: string;
  category?: string;
  variables?: string[]; // Template variables
}

export interface NotificationCampaign {
  id: string;
  name: string;
  description: string;
  templateId: string;
  targetCriteria: {
    platforms?: ('ios' | 'android')[];
    appVersions?: string[];
    userSegments?: string[];
    customCriteria?: Record<string, any>;
  };
  schedule?: {
    type: 'immediate' | 'scheduled' | 'recurring';
    sendAt?: Date;
    recurrence?: {
      type: 'daily' | 'weekly' | 'monthly';
      time: string;
      daysOfWeek?: number[]; // For weekly
      dayOfMonth?: number; // For monthly
    };
  };
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
  };
}

export interface PushNotificationConfig {
  fcm: {
    serverKey: string;
    projectId: string;
    senderId: string;
  };
  apns: {
    keyId: string;
    teamId: string;
    privateKey: string;
    bundleId: string;
    isProduction: boolean;
  };
  rateLimit: {
    maxPerSecond: number;
    maxPerMinute: number;
    maxPerHour: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
    maxDelay: number;
  };
  analytics: {
    enabled: boolean;
    retentionDays: number;
  };
}

export class PushNotificationService extends EventEmitter {
  private config: PushNotificationConfig;
  private logger: WinstonLogger;
  private deviceTokens: Map<string, DeviceToken>;
  private templates: Map<string, NotificationTemplate>;
  private campaigns: Map<string, NotificationCampaign>;
  private rateLimiters: Map<string, number[]>;
  private retryQueues: Map<string, { payload: PushNotificationPayload; attempts: number; nextRetry: Date }[]>;

  constructor(config: PushNotificationConfig) {
    super();
    this.config = config;
    this.logger = new WinstonLogger();
    this.deviceTokens = new Map();
    this.templates = new Map();
    this.campaigns = new Map();
    this.rateLimiters = new Map();
    this.retryQueues = new Map();
    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.loadDeviceTokens();
      await this.loadTemplates();
      await this.loadCampaigns();
      this.startRetryProcessor();
      this.startCleanupTasks();
      
      this.logger.info('Push Notification Service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Push Notification Service', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Register a device token for push notifications
   */
  async registerDeviceToken(tokenData: Omit<DeviceToken, 'registeredAt' | 'lastSeen'>): Promise<boolean> {
    try {
      const deviceToken: DeviceToken = {
        ...tokenData,
        registeredAt: new Date(),
        lastSeen: new Date(),
      };

      // Update or insert device token
      this.deviceTokens.set(tokenData.token, deviceToken);
      
      // Save to database (simplified - would use actual database)
      await this.saveDeviceToken(deviceToken);
      
      this.logger.info(`Device token registered: ${tokenData.token.substring(0, 20)}...`);
      this.emit('deviceRegistered', deviceToken);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to register device token', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Unregister a device token
   */
  async unregisterDeviceToken(token: string): Promise<boolean> {
    try {
      const removed = this.deviceTokens.delete(token);
      
      if (removed) {
        // Remove from database
        await this.removeDeviceToken(token);
        
        this.logger.info(`Device token unregistered: ${token.substring(0, 20)}...`);
        this.emit('deviceUnregistered', { token });
      }
      
      return removed;
    } catch (error) {
      this.logger.error('Failed to unregister device token', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Send push notification to specific devices
   */
  async sendNotification(payload: PushNotificationPayload): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    errors: string[];
  }> {
    try {
      const tokens = Array.isArray(payload.to) ? payload.to : [payload.to];
      const validTokens = tokens.filter(token => this.deviceTokens.has(token));
      
      if (validTokens.length === 0) {
        return {
          success: false,
          sent: 0,
          failed: tokens.length,
          errors: ['No valid device tokens found'],
        };
      }

      // Check rate limits
      const rateLimitResult = this.checkRateLimit(validTokens.length);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          sent: 0,
          failed: tokens.length,
          errors: [`Rate limit exceeded: ${rateLimitResult.reason}`],
        };
      }

      const results = await this.sendToPlatforms(payload, validTokens);
      
      // Update rate limiter
      this.updateRateLimit(validTokens.length);
      
      // Log analytics
      this.logNotificationAnalytics(payload, results);
      
      return results;
    } catch (error) {
      this.logger.error('Failed to send notification', error);
      this.emit('error', error);
      return {
        success: false,
        sent: 0,
        failed: Array.isArray(payload.to) ? payload.to.length : 1,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Send notification to topic
   */
  async sendToTopic(topic: string, payload: Omit<PushNotificationPayload, 'to'>): Promise<{
    success: boolean;
    topic: string;
    errors: string[];
  }> {
    try {
      // For FCM, we can send to topics directly
      const fcmPayload = {
        ...payload,
        to: `/topics/${topic}`,
      };

      const results = await this.sendToFCM(fcmPayload, [topic]);
      
      return {
        success: results.success,
        topic,
        errors: results.errors,
      };
    } catch (error) {
      this.logger.error('Failed to send to topic', error);
      this.emit('error', error);
      return {
        success: false,
        topic,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Create notification template
   */
  async createTemplate(template: Omit<NotificationTemplate, 'id'>): Promise<string> {
    try {
      const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTemplate: NotificationTemplate = {
        ...template,
        id: templateId,
      };

      this.templates.set(templateId, newTemplate);
      await this.saveTemplate(newTemplate);
      
      this.logger.info(`Template created: ${templateId} - ${template.name}`);
      this.emit('templateCreated', newTemplate);
      
      return templateId;
    } catch (error) {
      this.logger.error('Failed to create template', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Send notification using template
   */
  async sendFromTemplate(
    templateId: string,
    recipients: string | string[],
    variables: Record<string, any> = {}
  ): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    errors: string[];
  }> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        return {
          success: false,
          sent: 0,
          failed: Array.isArray(recipients) ? recipients.length : 1,
          errors: [`Template not found: ${templateId}`],
        };
      }

      // Process template variables
      const processedTitle = this.processTemplate(template.title, variables);
      const processedBody = this.processTemplate(template.body, variables);
      const processedData = template.data ? 
        this.processTemplateData(template.data, variables) : undefined;

      const payload: PushNotificationPayload = {
        to: recipients,
        title: processedTitle,
        body: processedBody,
        data: processedData,
        actions: template.actions,
        imageUrl: template.imageUrl,
        sound: template.sound,
        category: template.category,
      };

      return await this.sendNotification(payload);
    } catch (error) {
      this.logger.error('Failed to send from template', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create notification campaign
   */
  async createCampaign(campaign: Omit<NotificationCampaign, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): Promise<string> {
    try {
      const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newCampaign: NotificationCampaign = {
        ...campaign,
        id: campaignId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stats: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          failed: 0,
        },
      };

      this.campaigns.set(campaignId, newCampaign);
      await this.saveCampaign(newCampaign);
      
      // Schedule campaign if needed
      if (campaign.schedule?.type === 'scheduled') {
        await this.scheduleCampaign(campaignId, campaign.schedule.sendAt!);
      } else if (campaign.schedule?.type === 'immediate') {
        await this.executeCampaign(campaignId);
      }

      this.logger.info(`Campaign created: ${campaignId} - ${campaign.name}`);
      this.emit('campaignCreated', newCampaign);
      
      return campaignId;
    } catch (error) {
      this.logger.error('Failed to create campaign', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get device tokens for user
   */
  async getDeviceTokensForUser(userId: string): Promise<DeviceToken[]> {
    try {
      const userTokens: DeviceToken[] = [];
      
      for (const token of this.deviceTokens.values()) {
        if (token.userId === userId && token.isActive) {
          userTokens.push(token);
        }
      }
      
      return userTokens;
    } catch (error) {
      this.logger.error('Failed to get device tokens for user', error);
      return [];
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(timeRange?: { start: Date; end: Date }): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalFailed: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  }> {
    try {
      // This would query analytics database
      // For now, return aggregated stats from campaigns
      let totalSent = 0;
      let totalDelivered = 0;
      let totalOpened = 0;
      let totalClicked = 0;
      let totalFailed = 0;

      for (const campaign of this.campaigns.values()) {
        totalSent += campaign.stats.sent;
        totalDelivered += campaign.stats.delivered;
        totalOpened += campaign.stats.opened;
        totalClicked += campaign.stats.clicked;
        totalFailed += campaign.stats.failed;
      }

      const deliveryRate = totalSent > 0 ? totalDelivered / totalSent : 0;
      const openRate = totalDelivered > 0 ? totalOpened / totalDelivered : 0;
      const clickRate = totalOpened > 0 ? totalClicked / totalOpened : 0;

      return {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalFailed,
        deliveryRate,
        openRate,
        clickRate,
      };
    } catch (error) {
      this.logger.error('Failed to get notification stats', error);
      throw error;
    }
  }

  /**
   * Handle notification feedback
   */
  async handleNotificationFeedback(token: string, messageId: string, feedback: {
    delivered?: boolean;
    opened?: boolean;
    clicked?: boolean;
    error?: string;
  }): Promise<void> {
    try {
      // Log feedback for analytics
      this.logger.info(`Notification feedback: ${messageId} - ${JSON.stringify(feedback)}`);
      
      // Update campaign stats if applicable
      for (const campaign of this.campaigns.values()) {
        if (feedback.delivered) campaign.stats.delivered++;
        if (feedback.opened) campaign.stats.opened++;
        if (feedback.clicked) campaign.stats.clicked++;
        if (feedback.error) campaign.stats.failed++;
      }
      
      this.emit('notificationFeedback', { token, messageId, feedback });
    } catch (error) {
      this.logger.error('Failed to handle notification feedback', error);
    }
  }

  // Private methods

  private async sendToPlatforms(payload: PushNotificationPayload, tokens: string[]): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    errors: string[];
  }> {
    const iosTokens = tokens.filter(token => {
      const deviceToken = this.deviceTokens.get(token);
      return deviceToken?.platform === 'ios';
    });

    const androidTokens = tokens.filter(token => {
      const deviceToken = this.deviceTokens.get(token);
      return deviceToken?.platform === 'android';
    });

    const results = {
      success: true,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Send to Android via FCM
      if (androidTokens.length > 0) {
        const fcmResult = await this.sendToFCM(payload, androidTokens);
        results.sent += fcmResult.sent;
        results.failed += fcmResult.failed;
        results.errors.push(...fcmResult.errors);
      }

      // Send to iOS via APNS
      if (iosTokens.length > 0) {
        const apnsResult = await this.sendToAPNS(payload, iosTokens);
        results.sent += apnsResult.sent;
        results.failed += apnsResult.failed;
        results.errors.push(...apnsResult.errors);
      }

      results.success = results.failed === 0;
      return results;
    } catch (error) {
      this.logger.error('Failed to send to platforms', error);
      results.success = false;
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return results;
    }
  }

  private async sendToFCM(payload: PushNotificationPayload, tokens: string[]): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    try {
      const fcmPayload = {
        registration_ids: tokens,
        notification: {
          title: payload.title,
          body: payload.body,
          image: payload.imageUrl,
          sound: payload.sound || 'default',
          badge: 1,
          click_action: payload.data?.deepLink,
        },
        data: payload.data || {},
        priority: payload.priority || 'normal',
        ttl: payload.ttl,
        collapse_key: payload.collapseKey,
      };

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${this.config.fcm.serverKey}`,
        },
        body: JSON.stringify(fcmPayload),
      });

      if (!response.ok) {
        throw new Error(`FCM request failed: ${response.status}`);
      }

      const result = await response.json();
      
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      if (result.results) {
        for (let i = 0; i < result.results.length; i++) {
          const tokenResult = result.results[i];
          if (tokenResult.message_id) {
            sent++;
          } else {
            failed++;
            errors.push(`Token ${i}: ${tokenResult.error || 'Unknown error'}`);
          }
        }
      }

      return { sent, failed, errors };
    } catch (error) {
      this.logger.error('Failed to send to FCM', error);
      return {
        sent: 0,
        failed: tokens.length,
        errors: [error instanceof Error ? error.message : 'FCM send failed'],
      };
    }
  }

  private async sendToAPNS(payload: PushNotificationPayload, tokens: string[]): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    try {
      // This would use actual APNS library like node-apn
      // For now, simulate APNS send
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const token of tokens) {
        try {
          // Simulate APNS send
          const success = Math.random() > 0.1; // 90% success rate
          
          if (success) {
            sent++;
          } else {
            failed++;
            errors.push(`APNS send failed for token: ${token.substring(0, 20)}...`);
          }
        } catch (error) {
          failed++;
          errors.push(`APNS error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { sent, failed, errors };
    } catch (error) {
      this.logger.error('Failed to send to APNS', error);
      return {
        sent: 0,
        failed: tokens.length,
        errors: [error instanceof Error ? error.message : 'APNS send failed'],
      };
    }
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      processed = processed.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    return processed;
  }

  private processTemplateData(data: Record<string, any>, variables: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        processed[key] = this.processTemplate(value, variables);
      } else {
        processed[key] = value;
      }
    }
    
    return processed;
  }

  private checkRateLimit(requestCount: number): {
    allowed: boolean;
    reason?: string;
  } {
    const now = Date.now();
    const window = 60 * 1000; // 1 minute window
    
    // Clean old entries
    for (const [key, timestamps] of this.rateLimiters.entries()) {
      const validTimestamps = timestamps.filter(timestamp => now - timestamp < window);
      if (validTimestamps.length === 0) {
        this.rateLimiters.delete(key);
      } else {
        this.rateLimiters.set(key, validTimestamps);
      }
    }
    
    // Check current rate
    const currentTimestamps = this.rateLimiters.get('global') || [];
    const requestCountInWindow = currentTimestamps.length + requestCount;
    
    if (requestCountInWindow > this.config.rateLimit.maxPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${requestCountInWindow}/${this.config.rateLimit.maxPerMinute} per minute`,
      };
    }
    
    return { allowed: true };
  }

  private updateRateLimit(requestCount: number): void {
    const now = Date.now();
    const currentTimestamps = this.rateLimiters.get('global') || [];
    
    for (let i = 0; i < requestCount; i++) {
      currentTimestamps.push(now);
    }
    
    this.rateLimiters.set('global', currentTimestamps);
  }

  private async scheduleCampaign(campaignId: string, sendAt: Date): Promise<void> {
    const delay = sendAt.getTime() - Date.now();
    
    if (delay <= 0) {
      // Schedule immediately
      await this.executeCampaign(campaignId);
    } else {
      // Schedule for later
      setTimeout(() => {
        this.executeCampaign(campaignId);
      }, delay);
      
      const campaign = this.campaigns.get(campaignId);
      if (campaign) {
        campaign.status = 'scheduled';
        this.emit('campaignScheduled', campaign);
      }
    }
  }

  private async executeCampaign(campaignId: string): Promise<void> {
    try {
      const campaign = this.campaigns.get(campaignId);
      if (!campaign) return;

      campaign.status = 'running';
      campaign.updatedAt = new Date();

      const template = this.templates.get(campaign.templateId);
      if (!template) {
        throw new Error(`Template not found: ${campaign.templateId}`);
      }

      // Get target devices based on criteria
      const targetTokens = await this.getTargetDevices(campaign.targetCriteria);
      
      if (targetTokens.length === 0) {
        campaign.status = 'completed';
        this.emit('campaignCompleted', campaign);
        return;
      }

      // Send notifications
      const results = await this.sendFromTemplate(
        campaign.templateId,
        targetTokens,
        {}
      );

      // Update campaign stats
      campaign.stats.sent += results.sent;
      campaign.stats.failed += results.failed;
      campaign.status = 'completed';
      campaign.updatedAt = new Date();

      this.emit('campaignCompleted', campaign);
    } catch (error) {
      this.logger.error('Failed to execute campaign', error);
      
      const campaign = this.campaigns.get(campaignId);
      if (campaign) {
        campaign.status = 'failed';
        campaign.updatedAt = new Date();
      }
      
      this.emit('campaignFailed', { campaignId, error });
    }
  }

  private async getTargetDevices(criteria: NotificationCampaign['targetCriteria']): Promise<string[]> {
    const allTokens = Array.from(this.deviceTokens.values());
    
    let targetTokens = allTokens.map(token => token.token);
    
    // Filter by platform
    if (criteria.platforms) {
      targetTokens = targetTokens.filter(token => {
        const deviceToken = this.deviceTokens.get(token);
        return deviceToken && criteria.platforms!.includes(deviceToken.platform);
      });
    }
    
    // Filter by app version
    if (criteria.appVersions) {
      targetTokens = targetTokens.filter(token => {
        const deviceToken = this.deviceTokens.get(token);
        return deviceToken && criteria.appVersions!.includes(deviceToken.appVersion);
      });
    }
    
    // Filter by user segments (would need user data integration)
    if (criteria.userSegments) {
      // This would integrate with user service
      // For now, return all tokens
    }
    
    return targetTokens;
  }

  private async loadDeviceTokens(): Promise<void> {
    try {
      // Load from database (simplified)
      // In production, would load from actual database
    } catch (error) {
      this.logger.error('Failed to load device tokens', error);
    }
  }

  private async saveDeviceToken(token: DeviceToken): Promise<void> {
    try {
      // Save to database (simplified)
      // In production, would save to actual database
    } catch (error) {
      this.logger.error('Failed to save device token', error);
    }
  }

  private async removeDeviceToken(token: string): Promise<void> {
    try {
      // Remove from database (simplified)
      // In production, would remove from actual database
    } catch (error) {
      this.logger.error('Failed to remove device token', error);
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      // Load from database (simplified)
      // In production, would load from actual database
    } catch (error) {
      this.logger.error('Failed to load templates', error);
    }
  }

  private async saveTemplate(template: NotificationTemplate): Promise<void> {
    try {
      // Save to database (simplified)
      // In production, would save to actual database
    } catch (error) {
      this.logger.error('Failed to save template', error);
    }
  }

  private async loadCampaigns(): Promise<void> {
    try {
      // Load from database (simplified)
      // In production, would load from actual database
    } catch (error) {
      this.logger.error('Failed to load campaigns', error);
    }
  }

  private async saveCampaign(campaign: NotificationCampaign): Promise<void> {
    try {
      // Save to database (simplified)
      // In production, would save to actual database
    } catch (error) {
      this.logger.error('Failed to save campaign', error);
    }
  }

  private startRetryProcessor(): void {
    setInterval(async () => {
      await this.processRetryQueue();
    }, 60000); // Process every minute
  }

  private async processRetryQueue(): Promise<void> {
    const now = Date.now();
    
    for (const [token, queue] of this.retryQueues.entries()) {
      const readyItems = queue.filter(item => item.nextRetry <= now);
      
      for (const item of readyItems) {
        try {
          const result = await this.sendNotification(item.payload);
          
          if (result.success) {
            // Remove from queue
            const updatedQueue = queue.filter(q => q !== item);
            this.retryQueues.set(token, updatedQueue);
          } else {
            // Update retry count and schedule next retry
            item.attempts++;
            
            if (item.attempts >= this.config.retryPolicy.maxRetries) {
              // Remove from queue after max retries
              const updatedQueue = queue.filter(q => q !== item);
              this.retryQueues.set(token, updatedQueue);
            } else {
              // Schedule next retry
              const delay = Math.min(
                this.config.retryPolicy.initialDelay * 
                Math.pow(this.config.retryPolicy.backoffMultiplier, item.attempts - 1),
                this.config.retryPolicy.maxDelay
              );
              
              item.nextRetry = new Date(now + delay);
            }
          }
        } catch (error) {
          this.logger.error('Failed to retry notification', error);
        }
      }
    }
  }

  private startCleanupTasks(): void {
    // Clean up inactive device tokens
    setInterval(async () => {
      await this.cleanupInactiveTokens();
    }, 24 * 60 * 60 * 1000); // Daily
    
    // Clean up old analytics data
    setInterval(async () => {
      await this.cleanupAnalyticsData();
    }, 60 * 60 * 1000); // Hourly
  }

  private async cleanupInactiveTokens(): Promise<void> {
    const now = Date.now();
    const inactiveThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    for (const [token, deviceToken] of this.deviceTokens.entries()) {
      if (now - deviceToken.lastSeen.getTime() > inactiveThreshold) {
        this.deviceTokens.delete(token);
        await this.removeDeviceToken(token);
      }
    }
  }

  private async cleanupAnalyticsData(): Promise<void> {
    // Clean up old analytics data based on retention policy
    // In production, would clean up from actual database
  }

  private logNotificationAnalytics(payload: PushNotificationPayload, results: {
    success: boolean;
    sent: number;
    failed: number;
    errors: string[];
  }): void {
    try {
      const analyticsData = {
        timestamp: new Date(),
        payload: {
          title: payload.title,
          category: payload.category,
          hasActions: !!payload.actions,
          hasData: !!payload.data,
        },
        results,
        platform: 'push_notification',
      };

      this.logger.info('Notification analytics', analyticsData);
      this.emit('notificationAnalytics', analyticsData);
    } catch (error) {
      this.logger.error('Failed to log notification analytics', error);
    }
  }
}
