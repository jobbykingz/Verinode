import { ValidationScore, IValidationScore } from '../models/ValidationScore';

export interface Alert {
  id: string;
  proofId: string;
  proofHash: string;
  issuerAddress: string;
  alertType: 'suspicious_pattern' | 'high_risk' | 'critical_threat' | 'fraud_detected' | 'anomaly_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suspiciousPatterns: string[];
  riskScore: number;
  confidence: number;
  evidence: {
    validationScore: IValidationScore;
    patternMatches: Array<{
      pattern: string;
      confidence: number;
      description: string;
    }>;
    similarCases: Array<{
      proofId: string;
      similarity: number;
      outcome: string;
    }>;
  };
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: {
    riskLevelThreshold?: number;
    suspiciousPatterns?: string[];
    frequencyThreshold?: number;
    timeWindow?: number; // minutes
    issuerReputationThreshold?: number;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  autoResolve?: boolean;
  notificationChannels: string[];
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'slack' | 'discord' | 'sms';
  config: {
    endpoint?: string;
    recipients?: string[];
    template?: string;
    headers?: { [key: string]: string };
  };
  enabled: boolean;
}

export class AlertService {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private alertCounter: number = 1;

  constructor() {
    this.initializeDefaultRules();
    this.initializeNotificationChannels();
  }

  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'critical_risk',
        name: 'Critical Risk Detection',
        description: 'Alert when proof validation score indicates critical risk',
        conditions: {
          riskLevelThreshold: 0.2
        },
        severity: 'critical',
        enabled: true,
        notificationChannels: ['email', 'slack']
      },
      {
        id: 'high_risk',
        name: 'High Risk Detection',
        description: 'Alert when proof validation score indicates high risk',
        conditions: {
          riskLevelThreshold: 0.4
        },
        severity: 'high',
        enabled: true,
        notificationChannels: ['email']
      },
      {
        id: 'suspicious_patterns',
        name: 'Suspicious Pattern Detection',
        description: 'Alert when multiple suspicious patterns are detected',
        conditions: {
          suspiciousPatterns: ['high_frequency_activity', 'low_issuer_reputation', 'unusual_timestamp']
        },
        severity: 'medium',
        enabled: true,
        notificationChannels: ['email']
      },
      {
        id: 'frequency_anomaly',
        name: 'High Frequency Activity',
        description: 'Alert when issuer submits proofs at unusually high frequency',
        conditions: {
          frequencyThreshold: 50,
          timeWindow: 60 // 1 hour
        },
        severity: 'medium',
        enabled: true,
        notificationChannels: ['email']
      },
      {
        id: 'reputation_risk',
        name: 'Low Reputation Issuer',
        description: 'Alert when proof is from issuer with low reputation',
        conditions: {
          issuerReputationThreshold: 0.3
        },
        severity: 'low',
        enabled: true,
        notificationChannels: []
      }
    ];

    defaultRules.forEach(rule => this.rules.set(rule.id, rule));
  }

  private initializeNotificationChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'email',
        name: 'Email Notifications',
        type: 'email',
        config: {
          recipients: ['admin@verinode.com', 'security@verinode.com'],
          template: 'security_alert'
        },
        enabled: true
      },
      {
        id: 'slack',
        name: 'Slack Notifications',
        type: 'slack',
        config: {
          endpoint: process.env.SLACK_WEBHOOK_URL || '',
          template: 'security_alert_slack'
        },
        enabled: true
      },
      {
        id: 'webhook',
        name: 'Webhook Notifications',
        type: 'webhook',
        config: {
          endpoint: process.env.SECURITY_WEBHOOK_URL || '',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.WEBHOOK_AUTH_TOKEN || ''}`
          }
        },
        enabled: false
      }
    ];

    defaultChannels.forEach(channel => this.notificationChannels.set(channel.id, channel));
  }

  async evaluateAndCreateAlert(validationScore: IValidationScore): Promise<Alert | null> {
    try {
      // Check all enabled rules
      for (const rule of Array.from(this.rules.values()).filter(r => r.enabled)) {
        const alert = await this.evaluateRule(rule, validationScore);
        if (alert) {
          await this.createAlert(alert);
          return alert;
        }
      }

      return null;
    } catch (error) {
      console.error('Alert evaluation failed:', error);
      return null;
    }
  }

  private async evaluateRule(rule: AlertRule, validationScore: IValidationScore): Promise<Alert | null> {
    const conditions = rule.conditions;
    let matches = false;
    let reasons: string[] = [];

    // Check risk level threshold
    if (conditions.riskLevelThreshold !== undefined) {
      const score = validationScore.validationScore;
      if (score <= conditions.riskLevelThreshold) {
        matches = true;
        reasons.push(`Validation score ${score.toFixed(3)} below threshold ${conditions.riskLevelThreshold}`);
      }
    }

    // Check suspicious patterns
    if (conditions.suspiciousPatterns && conditions.suspiciousPatterns.length > 0) {
      const matchingPatterns = validationScore.suspiciousPatterns.filter(pattern =>
        conditions.suspiciousPatterns!.includes(pattern)
      );
      
      if (matchingPatterns.length >= Math.ceil(conditions.suspiciousPatterns.length / 2)) {
        matches = true;
        reasons.push(`Suspicious patterns detected: ${matchingPatterns.join(', ')}`);
      }
    }

    // Check frequency threshold
    if (conditions.frequencyThreshold && conditions.timeWindow) {
      const recentCount = await this.getRecentProofCount(
        validationScore.issuerAddress,
        conditions.timeWindow
      );
      
      if (recentCount >= conditions.frequencyThreshold) {
        matches = true;
        reasons.push(`High frequency activity: ${recentCount} proofs in ${conditions.timeWindow} minutes`);
      }
    }

    // Check issuer reputation
    if (conditions.issuerReputationThreshold !== undefined) {
      const reputation = validationScore.features.issuerReputation;
      if (reputation <= conditions.issuerReputationThreshold) {
        matches = true;
        reasons.push(`Low issuer reputation: ${reputation.toFixed(3)}`);
      }
    }

    if (matches) {
      return this.buildAlert(rule, validationScore, reasons);
    }

    return null;
  }

  private async getRecentProofCount(issuerAddress: string, timeWindowMinutes: number): Promise<number> {
    const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    
    return ValidationScore.countDocuments({
      issuerAddress,
      createdAt: { $gte: timeWindow }
    });
  }

  private buildAlert(rule: AlertRule, validationScore: IValidationScore, reasons: string[]): Alert {
    const alertId = `alert_${this.alertCounter++}`;
    const alertType = this.determineAlertType(rule, validationScore);
    
    return {
      id: alertId,
      proofId: validationScore.proofId,
      proofHash: validationScore.proofHash,
      issuerAddress: validationScore.issuerAddress,
      alertType,
      severity: rule.severity,
      title: this.generateAlertTitle(rule, validationScore),
      description: reasons.join('; '),
      suspiciousPatterns: validationScore.suspiciousPatterns,
      riskScore: validationScore.validationScore,
      confidence: validationScore.confidenceLevel,
      evidence: {
        validationScore,
        patternMatches: validationScore.suspiciousPatterns.map(pattern => ({
          pattern,
          confidence: 0.8 + Math.random() * 0.2,
          description: this.getPatternDescription(pattern)
        })),
        similarCases: validationScore.explainability.similarCases
      },
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private determineAlertType(rule: AlertRule, validationScore: IValidationScore): Alert['alertType'] {
    if (validationScore.validationScore <= 0.2) return 'critical_threat';
    if (validationScore.validationScore <= 0.4) return 'high_risk';
    if (validationScore.suspiciousPatterns.length > 0) return 'suspicious_pattern';
    return 'anomaly_detected';
  }

  private generateAlertTitle(rule: AlertRule, validationScore: IValidationScore): string {
    const riskLevel = validationScore.riskLevel.toUpperCase();
    const patterns = validationScore.suspiciousPatterns.length;
    
    return `${riskLevel} Risk Alert - ${patterns} suspicious patterns detected for proof ${validationScore.proofId}`;
  }

  private getPatternDescription(pattern: string): string {
    const descriptions: { [key: string]: string } = {
      'unusual_timestamp': 'Proof submitted at unusual time indicating potential automated activity',
      'high_frequency_activity': 'High frequency of proof submissions from this issuer',
      'regular_submission_pattern': 'Regular time intervals between submissions suggesting automation',
      'low_issuer_reputation': 'Issuer has history of suspicious or fraudulent activity',
      'suspicious_hash_pattern': 'Hash pattern indicates potential manipulation or forgery',
      'unusual_content_size': 'Content size deviates significantly from normal patterns'
    };
    
    return descriptions[pattern] || 'Suspicious pattern detected';
  }

  private async createAlert(alert: Alert): Promise<void> {
    this.alerts.set(alert.id, alert);
    
    // Send notifications
    await this.sendNotifications(alert);
    
    console.log(`Alert created: ${alert.id} - ${alert.title}`);
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const rule = Array.from(this.rules.values()).find(r => 
      r.conditions.riskLevelThreshold !== undefined && 
      alert.riskScore <= r.conditions.riskLevelThreshold
    );

    if (!rule) return;

    for (const channelId of rule.notificationChannels) {
      const channel = this.notificationChannels.get(channelId);
      if (channel && channel.enabled) {
        try {
          await this.sendNotification(channel, alert);
        } catch (error) {
          console.error(`Failed to send notification via ${channelId}:`, error);
        }
      }
    }
  }

  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const message = this.formatNotificationMessage(channel, alert);

    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(channel, alert, message);
        break;
      case 'slack':
        await this.sendSlackNotification(channel, alert, message);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel, alert, message);
        break;
      default:
        console.warn(`Unsupported notification channel type: ${channel.type}`);
    }
  }

  private formatNotificationMessage(channel: NotificationChannel, alert: Alert): string {
    if (channel.type === 'slack') {
      return `🚨 *${alert.severity.toUpperCase()} Alert*\n` +
        `*Proof ID:* ${alert.proofId}\n` +
        `*Issuer:* ${alert.issuerAddress}\n` +
        `*Risk Score:* ${alert.riskScore.toFixed(3)}\n` +
        `*Description:* ${alert.description}\n` +
        `*Time:* ${alert.createdAt.toISOString()}`;
    }

    return `Security Alert - ${alert.severity.toUpperCase()}\n` +
      `Proof ID: ${alert.proofId}\n` +
      `Issuer: ${alert.issuerAddress}\n` +
      `Risk Score: ${alert.riskScore.toFixed(3)}\n` +
      `Description: ${alert.description}\n` +
      `Time: ${alert.createdAt.toISOString()}`;
  }

  private async sendEmailNotification(channel: NotificationChannel, alert: Alert, message: string): Promise<void> {
    // Mock email sending
    console.log(`[EMAIL] To: ${channel.config.recipients?.join(', ')}`);
    console.log(`[EMAIL] Subject: Security Alert - ${alert.proofId}`);
    console.log(`[EMAIL] Body: ${message}`);
  }

  private async sendSlackNotification(channel: NotificationChannel, alert: Alert, message: string): Promise<void> {
    // Mock Slack notification
    console.log(`[SLACK] Webhook: ${channel.config.endpoint}`);
    console.log(`[SLACK] Message: ${message}`);
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert, message: string): Promise<void> {
    // Mock webhook call
    console.log(`[WEBHOOK] URL: ${channel.config.endpoint}`);
    console.log(`[WEBHOOK] Payload: ${JSON.stringify({ alert, message })}`);
  }

  async getAlerts(filters?: {
    severity?: string;
    status?: string;
    issuerAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      if (filters.severity) {
        alerts = alerts.filter(alert => alert.severity === filters.severity);
      }
      if (filters.status) {
        alerts = alerts.filter(alert => alert.status === filters.status);
      }
      if (filters.issuerAddress) {
        alerts = alerts.filter(alert => alert.issuerAddress === filters.issuerAddress);
      }
    }

    // Sort by creation date (newest first)
    alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    
    return alerts.slice(offset, offset + limit);
  }

  async updateAlertStatus(
    alertId: string,
    status: Alert['status'],
    assignedTo?: string,
    resolutionNotes?: string
  ): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.status = status;
    alert.assignedTo = assignedTo;
    alert.resolutionNotes = resolutionNotes;
    alert.updatedAt = new Date();

    if (status === 'resolved') {
      alert.resolvedAt = new Date();
    }

    this.alerts.set(alertId, alert);
    return alert;
  }

  async getAlertStats(timeRange: string = '24h'): Promise<any> {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const alerts = Array.from(this.alerts.values())
      .filter(alert => alert.createdAt >= startDate);

    const severityStats = {
      low: alerts.filter(a => a.severity === 'low').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      high: alerts.filter(a => a.severity === 'high').length,
      critical: alerts.filter(a => a.severity === 'critical').length
    };

    const statusStats = {
      open: alerts.filter(a => a.status === 'open').length,
      investigating: alerts.filter(a => a.status === 'investigating').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      false_positive: alerts.filter(a => a.status === 'false_positive').length
    };

    const typeStats = alerts.reduce((acc, alert) => {
      acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return {
      timeRange,
      totalAlerts: alerts.length,
      severityDistribution: severityStats,
      statusDistribution: statusStats,
      typeDistribution: typeStats,
      averageResolutionTime: this.calculateAverageResolutionTime(alerts)
    };
  }

  private calculateAverageResolutionTime(alerts: Alert[]): number {
    const resolvedAlerts = alerts.filter(a => a.resolvedAt);
    if (resolvedAlerts.length === 0) return 0;

    const totalTime = resolvedAlerts.reduce((sum, alert) => {
      return sum + (alert.resolvedAt!.getTime() - alert.createdAt.getTime());
    }, 0);

    return totalTime / resolvedAlerts.length / (1000 * 60); // Return in minutes
  }

  async createCustomRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const newRule: AlertRule = {
      ...rule,
      id: `rule_${Date.now()}`
    };

    this.rules.set(newRule.id, newRule);
    return newRule;
  }

  async updateRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    return updatedRule;
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    return this.rules.delete(ruleId);
  }

  async getRules(): Promise<AlertRule[]> {
    return Array.from(this.rules.values());
  }
}
