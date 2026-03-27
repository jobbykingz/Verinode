export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  status: NotificationStatus;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  scheduledFor?: Date;
  expiresAt?: Date;
  metadata?: NotificationMetadata;
}

export interface NotificationMetadata {
  source: string;
  correlationId?: string;
  tags?: string[];
  imageUrl?: string;
  actionUrl?: string;
  actionText?: string;
  dismissible?: boolean;
  persistent?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  SYSTEM = 'system',
  SECURITY = 'security',
  TRANSACTION = 'transaction',
  PROOF = 'proof',
  BILLING = 'billing',
  USER = 'user',
  TEAM = 'team',
  ENTERPRISE = 'enterprise',
  ANALYTICS = 'analytics',
  MAINTENANCE = 'maintenance',
  FEATURE = 'feature',
  ANNOUNCEMENT = 'announcement'
}

export enum NotificationCategory {
  GENERAL = 'general',
  SECURITY = 'security',
  TRANSACTIONS = 'transactions',
  PROOFS = 'proofs',
  BILLING = 'billing',
  USER_MANAGEMENT = 'user_management',
  TEAM_MANAGEMENT = 'team_management',
  SYSTEM = 'system',
  ANALYTICS = 'analytics',
  MAINTENANCE = 'maintenance',
  FEATURES = 'features',
  ANNOUNCEMENTS = 'announcements'
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  DISCORD = 'discord'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface NotificationPreferences {
  userId: string;
  channels: ChannelPreferences;
  categories: CategoryPreferences;
  types: TypePreferences;
  doNotDisturb: DoNotDisturbSettings;
  frequency: FrequencySettings;
  quietHours: QuietHoursSettings;
  batching: BatchingSettings;
}

export interface ChannelPreferences {
  inApp: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    badge: boolean;
  };
  email: {
    enabled: boolean;
    digest: 'immediate' | 'hourly' | 'daily' | 'weekly';
    types: NotificationType[];
  };
  push: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    badge: boolean;
    types: NotificationType[];
  };
  sms: {
    enabled: boolean;
    types: NotificationType[];
  };
  webhook: {
    enabled: boolean;
    url?: string;
    types: NotificationType[];
  };
  slack: {
    enabled: boolean;
    channelId?: string;
    types: NotificationType[];
  };
  discord: {
    enabled: boolean;
    channelId?: string;
    types: NotificationType[];
  };
}

export interface CategoryPreferences {
  [key in NotificationCategory]: {
    enabled: boolean;
    priority: NotificationPriority;
    channels: NotificationChannel[];
  };
}

export interface TypePreferences {
  [key in NotificationType]: {
    enabled: boolean;
    priority: NotificationPriority;
    channels: NotificationChannel[];
  };
}

export interface DoNotDisturbSettings {
  enabled: boolean;
  allowUrgent: boolean;
  allowCritical: boolean;
  schedule?: {
    start: string; // HH:mm format
    end: string;   // HH:mm format
    days: number[]; // 0-6 (Sunday-Saturday)
  };
}

export interface QuietHoursSettings {
  enabled: boolean;
  start: string; // HH:mm format
  end: string;   // HH:mm format
  timezone: string;
  allowUrgent: boolean;
  allowCritical: boolean;
}

export interface FrequencySettings {
  maxPerHour: number;
  maxPerDay: number;
  maxPerWeek: number;
  cooldownMinutes: number;
}

export interface BatchingSettings {
  enabled: boolean;
  batchSize: number;
  batchIntervalMinutes: number;
  categories: NotificationCategory[];
}

export interface NotificationFilter {
  search?: string;
  types?: NotificationType[];
  categories?: NotificationCategory[];
  channels?: NotificationChannel[];
  priorities?: NotificationPriority[];
  status?: NotificationStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  read?: boolean;
  tags?: string[];
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
  byChannel: Record<NotificationChannel, number>;
  byStatus: Record<NotificationStatus, number>;
  engagementRate: number;
  averageReadTime: number;
  deliveryRate: number;
  failureRate: number;
}

export interface NotificationAnalytics {
  id: string;
  notificationId: string;
  userId: string;
  event: AnalyticsEvent;
  timestamp: Date;
  data?: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
}

export enum AnalyticsEvent {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  CLICKED = 'clicked',
  DISMISSED = 'dismissed',
  FAILED = 'failed',
  RETRIED = 'retried',
  BOUNCED = 'bounced',
  UNSUBSCRIBED = 'unsubscribed'
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  variables: TemplateVariable[];
  channels: NotificationChannel[];
  priority: NotificationPriority;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'url';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface WebSocketNotificationMessage {
  type: 'notification';
  data: Notification;
  timestamp: Date;
}

export interface NotificationBatch {
  id: string;
  userId: string;
  notifications: Notification[];
  createdAt: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
}

export interface NotificationSchedule {
  id: string;
  notificationId: string;
  scheduledFor: Date;
  timezone: string;
  recurring?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Date;
  };
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
}

export interface NotificationError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  retryable: boolean;
}

export interface NotificationDeliveryReceipt {
  id: string;
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  timestamp: Date;
  error?: NotificationError;
  metadata?: Record<string, any>;
}
