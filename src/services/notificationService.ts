// Issue #31: Proof expiration and renewal system
// notificationService.ts — Sends renewal reminders and expiration notifications

import { ExpirationNotification, ProofExpiration } from '../types';

export class NotificationService {
  private notifications: Map<string, ExpirationNotification[]> = new Map();

  /**
   * Send a renewal reminder for a proof expiring soon.
   */
  sendRenewalReminder(
    proofId: string,
    userId: string,
    expiration: ProofExpiration
  ): ExpirationNotification {
    const daysLeft = Math.ceil(
      (expiration.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    return this.createNotification(proofId, userId, 'reminder',
      `Your proof expires in ${daysLeft} day(s). Renew now to avoid interruption.`
    );
  }

  /**
   * Send a grace period notification.
   */
  sendGracePeriodNotification(
    proofId: string,
    userId: string,
    expiration: ProofExpiration
  ): ExpirationNotification {
    const daysLeft = Math.ceil(
      (expiration.gracePeriodEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    return this.createNotification(proofId, userId, 'grace_period',
      `Your proof has expired but is in a ${daysLeft}-day grace period. Renew immediately.`
    );
  }

  /**
   * Send an expiration notification.
   */
  sendExpirationNotification(proofId: string, userId: string): ExpirationNotification {
    return this.createNotification(proofId, userId, 'expired',
      `Your proof has expired and is no longer valid. Renew to restore verification.`
    );
  }

  /**
   * Send a renewal confirmation.
   */
  sendRenewalConfirmation(proofId: string, userId: string, newExpiry: Date): ExpirationNotification {
    return this.createNotification(proofId, userId, 'renewed',
      `Your proof has been renewed. New expiration: ${newExpiry.toDateString()}.`
    );
  }

  /**
   * Get all notifications for a user.
   */
  getNotifications(userId: string): ExpirationNotification[] {
    return this.notifications.get(userId) ?? [];
  }

  /**
   * Get unread notifications for a user.
   */
  getUnreadNotifications(userId: string): ExpirationNotification[] {
    return (this.notifications.get(userId) ?? []).filter(n => !n.read);
  }

  /**
   * Mark a notification as read.
   */
  markAsRead(notificationId: string, userId: string): void {
    const userNotifications = this.notifications.get(userId) ?? [];
    const notification = userNotifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  private createNotification(
    proofId: string,
    userId: string,
    type: ExpirationNotification['type'],
    message: string
  ): ExpirationNotification {
    const notification: ExpirationNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      proofId,
      userId,
      type,
      message,
      sentAt: new Date(),
      read: false,
    };

    const existing = this.notifications.get(userId) ?? [];
    existing.push(notification);
    this.notifications.set(userId, existing);

    return notification;
  }
}

export const notificationService = new NotificationService();
