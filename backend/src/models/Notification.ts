export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  WEBSOCKET = 'WEBSOCKET'
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED'
}

export interface UserPreference {
  userId: string;
  optOutChannels: NotificationChannel[];
  customRules?: Record<string, any>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  defaultChannels: NotificationChannel[];
}

export interface Notification {
  id: string;
  userId: string;
  templateId: string;
  channel: NotificationChannel;
  content: string;
  status: DeliveryStatus;
  metadata?: Record<string, any>;
  createdAt: Date;
  sentAt?: Date;
}