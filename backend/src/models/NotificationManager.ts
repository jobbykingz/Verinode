import { Notification, NotificationChannel, DeliveryStatus, UserPreference } from '../models/Notification';
import { TemplateEngine } from './TemplateEngine';
import { ChannelManager } from './ChannelManager';

export class NotificationManager {
  private preferences: Map<string, UserPreference> = new Map();
  private analytics: { sent: number; failed: number } = { sent: 0, failed: 0 };

  constructor(
    private templateEngine: TemplateEngine,
    private channelManager: ChannelManager
  ) {}

  public setUserPreference(preference: UserPreference): void {
    this.preferences.set(preference.userId, preference);
  }

  public async sendNotification(
    userId: string,
    templateId: string,
    data: Record<string, any>,
    overrideChannels?: NotificationChannel[]
  ): Promise<Notification[]> {
    const template = this.templateEngine.getTemplate(templateId);
    if (!template) throw new Error('Template not found');

    const userPref = this.preferences.get(userId);
    const targetChannels = overrideChannels || template.defaultChannels;
    const allowedChannels = targetChannels.filter(
      (ch) => !userPref?.optOutChannels.includes(ch)
    );

    const content = this.templateEngine.render(templateId, data);
    const results: Notification[] = [];

    for (const channel of allowedChannels) {
      const notification: Notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        templateId,
        channel,
        content,
        status: DeliveryStatus.PENDING,
        createdAt: new Date(),
      };

      const success = await this.channelManager.send(channel, notification);
      
      notification.status = success ? DeliveryStatus.SENT : DeliveryStatus.FAILED;
      if (success) {
        notification.sentAt = new Date();
        this.analytics.sent++;
      } else {
        this.analytics.failed++;
      }
      
      results.push(notification);
    }

    return results;
  }

  public async sendBulk(
    userIds: string[],
    templateId: string,
    data: Record<string, any>
  ): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map(userId => this.sendNotification(userId, templateId, data))
      );
    }
  }

  public getAnalytics() { return this.analytics; }
}