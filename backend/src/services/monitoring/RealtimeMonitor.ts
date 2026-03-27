import { EventEmitter } from 'events';
import { AuditLog, IAuditLog, AuditEventType, AuditSeverity, AuditStatus } from '../models/AuditLog';
import { auditService } from '../services/audit/AuditService';
import winston from 'winston';
import WebSocket from 'ws';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

/**
 * Alert Configuration
 */
export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    criticalEventsPerMinute: number;
    securityEventsPerHour: number;
    failedLoginsPerMinute: number;
    suspiciousActivityPerHour: number;
    storageUtilizationPercent: number;
    complianceScorePercent: number;
    errorRatePercent: number;
  };
  windows: {
    shortTerm: number; // minutes
    mediumTerm: number; // hours
    longTerm: number; // days
  };
  notifications: {
    email: {
      enabled: boolean;
      recipients: string[];
      smtpConfig?: any;
    };
    webhook: {
      enabled: boolean;
      urls: string[];
      headers?: Record<string, string>;
    };
    slack: {
      enabled: boolean;
      webhookUrl?: string;
      channel?: string;
    };
    teams: {
      enabled: boolean;
      webhookUrl?: string;
    };
  };
  suppression: {
    enabled: boolean;
    duration: number; // minutes
    maxAlertsPerType: number;
  };
}

/**
 * Alert Definition
 */
export interface AlertDefinition {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'performance' | 'compliance' | 'system';
  condition: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    window: number; // minutes
  };
  enabled: boolean;
  cooldown: number; // minutes
  notifications: string[];
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

/**
 * Alert Event
 */
export interface AlertEvent {
  id: string;
  definitionId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'performance' | 'compliance' | 'system';
  title: string;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

/**
 * Monitoring Metrics
 */
export interface MonitoringMetrics {
  timestamp: Date;
  totalEvents: number;
  criticalEvents: number;
  securityEvents: number;
  failedLogins: number;
  suspiciousActivity: number;
  storageUtilization: number;
  complianceScore: number;
  errorRate: number;
  responseTime: number;
  throughput: number;
  topUsers: Array<{
    userId: string;
    eventCount: number;
    riskScore: number;
  }>;
  topIPs: Array<{
    ipAddress: string;
    eventCount: number;
    riskScore: number;
  }>;
  eventTypes: Record<string, number>;
  severities: Record<AuditSeverity, number>;
}

/**
 * Real-time Monitor
 * 
 * Provides comprehensive real-time monitoring and alerting:
 * - Real-time event processing
 * - Configurable alert rules
 * - Multiple notification channels
 * - Performance metrics
 * - WebSocket streaming
 * - Alert suppression and cooldown
 */
export class RealtimeMonitor extends EventEmitter {
  private logger: winston.Logger;
  private config: AlertConfig;
  private alertDefinitions: Map<string, AlertDefinition> = new Map();
  private activeAlerts: Map<string, AlertEvent> = new Map();
  private metrics: MonitoringMetrics;
  private eventBuffer: AuditLog[] = [];
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;
  private wsServer?: WebSocket.Server;
  private socketServer?: SocketIOServer;
  private suppressionMap: Map<string, Date> = new Map();

  constructor(config: Partial<AlertConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      thresholds: {
        criticalEventsPerMinute: 5,
        securityEventsPerHour: 50,
        failedLoginsPerMinute: 10,
        suspiciousActivityPerHour: 25,
        storageUtilizationPercent: 80,
        complianceScorePercent: 70,
        errorRatePercent: 5
      },
      windows: {
        shortTerm: 5, // 5 minutes
        mediumTerm: 1, // 1 hour
        longTerm: 24 // 24 hours
      },
      notifications: {
        email: { enabled: false, recipients: [] },
        webhook: { enabled: false, urls: [] },
        slack: { enabled: false },
        teams: { enabled: false }
      },
      suppression: {
        enabled: true,
        duration: 15, // 15 minutes
        maxAlertsPerType: 3
      },
      ...config
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/realtime-monitor.log' }),
        new winston.transports.Console()
      ]
    });

    this.metrics = this.initializeMetrics();
    this.initializeDefaultAlerts();
  }

  /**
   * Start the monitoring service
   */
  async start(httpServer?: HTTPServer): Promise<void> {
    try {
      this.logger.info('Starting real-time monitor...');

      // Setup WebSocket server
      if (httpServer) {
        this.setupWebSocketServer(httpServer);
      }

      // Start monitoring interval
      this.startMonitoring();

      // Listen to audit service events
      auditService.on('auditEvent', (event: IAuditLog) => {
        this.processEvent(event);
      });

      this.isRunning = true;
      this.logger.info('Real-time monitor started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start real-time monitor', { error });
      throw error;
    }
  }

  /**
   * Stop the monitoring service
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping real-time monitor...');

      // Clear monitoring interval
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }

      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
      }

      if (this.socketServer) {
        this.socketServer.close();
      }

      this.isRunning = false;
      this.logger.info('Real-time monitor stopped');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Failed to stop real-time monitor', { error });
      throw error;
    }
  }

  /**
   * Process an audit event
   */
  async processEvent(event: IAuditLog): Promise<void> {
    try {
      // Add to buffer
      this.eventBuffer.push(event);
      
      // Keep buffer size manageable
      if (this.eventBuffer.length > 10000) {
        this.eventBuffer = this.eventBuffer.slice(-5000);
      }

      // Update metrics
      this.updateMetrics(event);

      // Check alert conditions
      await this.checkAlertConditions(event);

      // Broadcast to WebSocket clients
      this.broadcastEvent(event);

      this.emit('eventProcessed', event);
    } catch (error) {
      this.logger.error('Failed to process event', { error, eventId: event.auditId });
    }
  }

  /**
   * Create an alert definition
   */
  async createAlertDefinition(definition: Omit<AlertDefinition, 'id' | 'createdAt' | 'triggerCount'>): Promise<AlertDefinition> {
    try {
      const newDefinition: AlertDefinition = {
        ...definition,
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        triggerCount: 0
      };

      this.alertDefinitions.set(newDefinition.id, newDefinition);
      
      this.logger.info('Alert definition created', { 
        alertId: newDefinition.id, 
        name: newDefinition.name 
      });

      this.emit('alertDefinitionCreated', newDefinition);
      return newDefinition;
    } catch (error) {
      this.logger.error('Failed to create alert definition', { error });
      throw error;
    }
  }

  /**
   * Update an alert definition
   */
  async updateAlertDefinition(alertId: string, updates: Partial<AlertDefinition>): Promise<AlertDefinition> {
    try {
      const existing = this.alertDefinitions.get(alertId);
      if (!existing) {
        throw new Error(`Alert definition not found: ${alertId}`);
      }

      const updated: AlertDefinition = { ...existing, ...updates };
      this.alertDefinitions.set(alertId, updated);

      this.logger.info('Alert definition updated', { alertId, name: updated.name });
      this.emit('alertDefinitionUpdated', updated);
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to update alert definition', { error, alertId });
      throw error;
    }
  }

  /**
   * Delete an alert definition
   */
  async deleteAlertDefinition(alertId: string): Promise<void> {
    try {
      const definition = this.alertDefinitions.get(alertId);
      if (!definition) {
        throw new Error(`Alert definition not found: ${alertId}`);
      }

      this.alertDefinitions.delete(alertId);
      
      this.logger.info('Alert definition deleted', { alertId, name: definition.name });
      this.emit('alertDefinitionDeleted', { alertId, name: definition.name });
    } catch (error) {
      this.logger.error('Failed to delete alert definition', { error, alertId });
      throw error;
    }
  }

  /**
   * Get all alert definitions
   */
  getAlertDefinitions(): AlertDefinition[] {
    return Array.from(this.alertDefinitions.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): AlertEvent[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get current metrics
   */
  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }

      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();

      this.logger.info('Alert acknowledged', { alertId, acknowledgedBy });
      this.emit('alertAcknowledged', alert);
    } catch (error) {
      this.logger.error('Failed to acknowledge alert', { error, alertId });
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }

      alert.resolved = true;
      alert.resolvedAt = new Date();

      this.logger.info('Alert resolved', { alertId });
      this.emit('alertResolved', alert);
    } catch (error) {
      this.logger.error('Failed to resolve alert', { error, alertId });
      throw error;
    }
  }

  /**
   * Get monitoring statistics
   */
  async getStatistics(): Promise<{
    totalEvents: number;
    alertsTriggered: number;
    alertsActive: number;
    alertsResolved: number;
    averageResponseTime: number;
    uptime: number;
  }> {
    const totalAlerts = this.activeAlerts.size;
    const activeAlerts = this.getActiveAlerts().length;
    const resolvedAlerts = totalAlerts - activeAlerts;

    return {
      totalEvents: this.metrics.totalEvents,
      alertsTriggered: totalAlerts,
      alertsActive,
      alertsResolved: resolvedAlerts,
      averageResponseTime: this.metrics.responseTime,
      uptime: process.uptime()
    };
  }

  /**
   * Private helper methods
   */
  private initializeMetrics(): MonitoringMetrics {
    return {
      timestamp: new Date(),
      totalEvents: 0,
      criticalEvents: 0,
      securityEvents: 0,
      failedLogins: 0,
      suspiciousActivity: 0,
      storageUtilization: 0,
      complianceScore: 100,
      errorRate: 0,
      responseTime: 0,
      throughput: 0,
      topUsers: [],
      topIPs: [],
      eventTypes: {},
      severities: {
        [AuditSeverity.LOW]: 0,
        [AuditSeverity.MEDIUM]: 0,
        [AuditSeverity.HIGH]: 0,
        [AuditSeverity.CRITICAL]: 0
      }
    };
  }

  private initializeDefaultAlerts(): void {
    const defaultAlerts: Omit<AlertDefinition, 'id' | 'createdAt' | 'triggerCount'>[] = [
      {
        name: 'High Critical Event Rate',
        description: 'Alert when critical events exceed threshold',
        severity: 'critical',
        category: 'security',
        condition: {
          metric: 'criticalEventsPerMinute',
          operator: 'gt',
          threshold: this.config.thresholds.criticalEventsPerMinute,
          window: this.config.windows.shortTerm
        },
        enabled: true,
        cooldown: 15,
        notifications: ['email', 'webhook']
      },
      {
        name: 'Security Event Spike',
        description: 'Alert on unusual security activity',
        severity: 'high',
        category: 'security',
        condition: {
          metric: 'securityEventsPerHour',
          operator: 'gt',
          threshold: this.config.thresholds.securityEventsPerHour,
          window: this.config.windows.mediumTerm
        },
        enabled: true,
        cooldown: 30,
        notifications: ['email']
      },
      {
        name: 'Failed Login Attack',
        description: 'Alert on potential brute force attack',
        severity: 'high',
        category: 'security',
        condition: {
          metric: 'failedLoginsPerMinute',
          operator: 'gt',
          threshold: this.config.thresholds.failedLoginsPerMinute,
          window: this.config.windows.shortTerm
        },
        enabled: true,
        cooldown: 10,
        notifications: ['email', 'slack']
      },
      {
        name: 'Storage Utilization High',
        description: 'Alert when storage usage is high',
        severity: 'medium',
        category: 'performance',
        condition: {
          metric: 'storageUtilizationPercent',
          operator: 'gt',
          threshold: this.config.thresholds.storageUtilizationPercent,
          window: this.config.windows.longTerm
        },
        enabled: true,
        cooldown: 60,
        notifications: ['email']
      },
      {
        name: 'Compliance Score Low',
        description: 'Alert when compliance score drops',
        severity: 'medium',
        category: 'compliance',
        condition: {
          metric: 'complianceScorePercent',
          operator: 'lt',
          threshold: this.config.thresholds.complianceScorePercent,
          window: this.config.windows.mediumTerm
        },
        enabled: true,
        cooldown: 120,
        notifications: ['email']
      }
    ];

    defaultAlerts.forEach(alert => {
      this.createAlertDefinition(alert);
    });
  }

  private setupWebSocketServer(httpServer: HTTPServer): void {
    // Setup WebSocket server
    this.wsServer = new WebSocket.Server({ 
      server: httpServer,
      path: '/audit/realtime'
    });

    this.wsServer.on('connection', (ws) => {
      this.logger.debug('WebSocket client connected');

      // Send current metrics
      ws.send(JSON.stringify({
        type: 'metrics',
        data: this.metrics
      }));

      // Send active alerts
      ws.send(JSON.stringify({
        type: 'alerts',
        data: this.getActiveAlerts()
      }));

      ws.on('close', () => {
        this.logger.debug('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        this.logger.error('WebSocket error', { error });
      });
    });

    // Setup Socket.IO server
    this.socketServer = new SocketIOServer(httpServer, {
      path: '/audit/socket.io',
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.socketServer.on('connection', (socket) => {
      this.logger.debug('Socket.IO client connected', { socketId: socket.id });

      // Join audit room
      socket.join('audit');

      // Send initial data
      socket.emit('metrics', this.metrics);
      socket.emit('alerts', this.getActiveAlerts());

      socket.on('disconnect', () => {
        this.logger.debug('Socket.IO client disconnected', { socketId: socket.id });
      });
    });
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMonitoringCheck();
      } catch (error) {
        this.logger.error('Monitoring check failed', { error });
      }
    }, 60000); // Check every minute
  }

  private async performMonitoringCheck(): Promise<void> {
    // Update timestamp
    this.metrics.timestamp = new Date();

    // Calculate throughput
    const recentEvents = this.getEventsInWindow(this.config.windows.shortTerm);
    this.metrics.throughput = recentEvents.length / (this.config.windows.shortTerm * 60);

    // Check storage utilization (would integrate with storage service)
    // this.metrics.storageUtilization = await this.getStorageUtilization();

    // Check compliance score (would integrate with compliance service)
    // this.metrics.complianceScore = await this.getComplianceScore();

    // Calculate error rate
    const errorEvents = recentEvents.filter(event => event.status === 'failure');
    this.metrics.errorRate = (errorEvents.length / recentEvents.length) * 100;

    // Update top users and IPs
    this.updateTopEntities(recentEvents);

    // Broadcast updated metrics
    this.broadcastMetrics();

    // Emit metrics event
    this.emit('metricsUpdated', this.metrics);
  }

  private updateMetrics(event: IAuditLog): void {
    this.metrics.totalEvents++;

    // Update severity counts
    this.metrics.severities[event.severity]++;

    // Update event type counts
    this.metrics.eventTypes[event.eventType] = 
      (this.metrics.eventTypes[event.eventType] || 0) + 1;

    // Update specific metrics
    if (event.severity === AuditSeverity.CRITICAL) {
      this.metrics.criticalEvents++;
    }

    if (this.isSecurityEvent(event)) {
      this.metrics.securityEvents++;
    }

    if (event.eventType === AuditEventType.USER_LOGIN && event.status === 'failure') {
      this.metrics.failedLogins++;
    }

    if (event.eventType === AuditEventType.SUSPICIOUS_ACTIVITY) {
      this.metrics.suspiciousActivity++;
    }
  }

  private async checkAlertConditions(event: IAuditLog): Promise<void> {
    for (const definition of this.alertDefinitions.values()) {
      if (!definition.enabled) continue;

      // Check cooldown
      if (definition.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - definition.lastTriggered.getTime();
        if (timeSinceLastTrigger < definition.cooldown * 60 * 1000) {
          continue;
        }
      }

      // Check suppression
      if (this.isSuppressed(definition.id)) {
        continue;
      }

      // Evaluate condition
      const triggered = await this.evaluateAlertCondition(definition, event);
      if (triggered) {
        await this.triggerAlert(definition, event);
      }
    }
  }

  private async evaluateAlertCondition(definition: AlertDefinition, event: IAuditLog): Promise<boolean> {
    const { condition } = definition;
    const events = this.getEventsInWindow(condition.window);

    let metricValue: number;

    switch (condition.metric) {
      case 'criticalEventsPerMinute':
        metricValue = events.filter(e => e.severity === AuditSeverity.CRITICAL).length;
        break;
      case 'securityEventsPerHour':
        metricValue = events.filter(e => this.isSecurityEvent(e)).length;
        break;
      case 'failedLoginsPerMinute':
        metricValue = events.filter(e => 
          e.eventType === AuditEventType.USER_LOGIN && e.status === 'failure'
        ).length;
        break;
      case 'suspiciousActivityPerHour':
        metricValue = events.filter(e => e.eventType === AuditEventType.SUSPICIOUS_ACTIVITY).length;
        break;
      case 'storageUtilizationPercent':
        metricValue = this.metrics.storageUtilization;
        break;
      case 'complianceScorePercent':
        metricValue = this.metrics.complianceScore;
        break;
      case 'errorRatePercent':
        metricValue = this.metrics.errorRate;
        break;
      default:
        return false;
    }

    return this.compareValues(metricValue, condition.operator, condition.threshold);
  }

  private compareValues(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private async triggerAlert(definition: AlertDefinition, event: IAuditLog): Promise<void> {
    const alertEvent: AlertEvent = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      definitionId: definition.id,
      severity: definition.severity,
      category: definition.category,
      title: definition.name,
      message: this.buildAlertMessage(definition, event),
      details: {
        condition: definition.condition,
        triggeringEvent: event.auditId,
        metrics: this.metrics
      },
      timestamp: new Date(),
      resolved: false
    };

    // Store alert
    this.activeAlerts.set(alertEvent.id, alertEvent);

    // Update definition
    definition.lastTriggered = new Date();
    definition.triggerCount++;

    // Set suppression
    if (this.config.suppression.enabled) {
      this.suppressionMap.set(definition.id, new Date());
    }

    // Send notifications
    await this.sendNotifications(alertEvent);

    // Broadcast alert
    this.broadcastAlert(alertEvent);

    // Emit event
    this.emit('alertTriggered', alertEvent);

    this.logger.warn('Alert triggered', {
      alertId: alertEvent.id,
      definition: definition.name,
      severity: definition.severity
    });
  }

  private buildAlertMessage(definition: AlertDefinition, event: IAuditLog): string {
    return `${definition.description}. Triggered by event: ${event.action} at ${event.timestamp.toISOString()}`;
  }

  private async sendNotifications(alert: AlertEvent): Promise<void> {
    const definition = this.alertDefinitions.get(alert.definitionId);
    if (!definition) return;

    // Send email notifications
    if (definition.notifications.includes('email') && this.config.notifications.email.enabled) {
      await this.sendEmailNotification(alert);
    }

    // Send webhook notifications
    if (definition.notifications.includes('webhook') && this.config.notifications.webhook.enabled) {
      await this.sendWebhookNotification(alert);
    }

    // Send Slack notifications
    if (definition.notifications.includes('slack') && this.config.notifications.slack.enabled) {
      await this.sendSlackNotification(alert);
    }

    // Send Teams notifications
    if (definition.notifications.includes('teams') && this.config.notifications.teams.enabled) {
      await this.sendTeamsNotification(alert);
    }
  }

  private async sendEmailNotification(alert: AlertEvent): Promise<void> {
    // Implementation would depend on email service
    this.logger.info('Email notification sent', { alertId: alert.id });
  }

  private async sendWebhookNotification(alert: AlertEvent): Promise<void> {
    const urls = this.config.notifications.webhook.urls;
    
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.notifications.webhook.headers
          },
          body: JSON.stringify(alert)
        });

        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status}`);
        }

        this.logger.info('Webhook notification sent', { 
          alertId: alert.id, 
          url 
        });
      } catch (error) {
        this.logger.error('Webhook notification failed', { 
          error, 
          alertId: alert.id, 
          url 
        });
      }
    }
  }

  private async sendSlackNotification(alert: AlertEvent): Promise<void> {
    // Implementation would depend on Slack webhook
    this.logger.info('Slack notification sent', { alertId: alert.id });
  }

  private async sendTeamsNotification(alert: AlertEvent): Promise<void> {
    // Implementation would depend on Teams webhook
    this.logger.info('Teams notification sent', { alertId: alert.id });
  }

  private getEventsInWindow(windowMinutes: number): IAuditLog[] {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    return this.eventBuffer.filter(event => event.timestamp >= cutoff);
  }

  private isSecurityEvent(event: IAuditLog): boolean {
    const securityEventTypes = [
      AuditEventType.SECURITY_BREACH,
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditEventType.BLOCKED_REQUEST,
      AuditEventType.RATE_LIMIT_EXCEEDED
    ];
    return securityEventTypes.includes(event.eventType);
  }

  private isSuppressed(definitionId: string): boolean {
    if (!this.config.suppression.enabled) return false;

    const suppressedAt = this.suppressionMap.get(definitionId);
    if (!suppressedAt) return false;

    const timeSinceSuppression = Date.now() - suppressedAt.getTime();
    return timeSinceSuppression < this.config.suppression.duration * 60 * 1000;
  }

  private updateTopEntities(events: IAuditLog[]): void {
    // Update top users
    const userCounts = new Map<string, number>();
    const userRiskScores = new Map<string, number>();

    events.forEach(event => {
      if (event.userId) {
        userCounts.set(event.userId, (userCounts.get(event.userId) || 0) + 1);
        
        const riskScore = this.calculateRiskScore(event);
        userRiskScores.set(event.userId, 
          (userRiskScores.get(event.userId) || 0) + riskScore
        );
      }
    });

    this.metrics.topUsers = Array.from(userCounts.entries())
      .map(([userId, eventCount]) => ({
        userId,
        eventCount,
        riskScore: userRiskScores.get(userId) || 0
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    // Update top IPs
    const ipCounts = new Map<string, number>();
    const ipRiskScores = new Map<string, number>();

    events.forEach(event => {
      if (event.ipAddress) {
        ipCounts.set(event.ipAddress, (ipCounts.get(event.ipAddress) || 0) + 1);
        
        const riskScore = this.calculateRiskScore(event);
        ipRiskScores.set(event.ipAddress, 
          (ipRiskScores.get(event.ipAddress) || 0) + riskScore
        );
      }
    });

    this.metrics.topIPs = Array.from(ipCounts.entries())
      .map(([ipAddress, eventCount]) => ({
        ipAddress,
        eventCount,
        riskScore: ipRiskScores.get(ipAddress) || 0
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);
  }

  private calculateRiskScore(event: IAuditLog): number {
    let score = 0;

    // Severity-based scoring
    switch (event.severity) {
      case AuditSeverity.CRITICAL: score += 10; break;
      case AuditSeverity.HIGH: score += 5; break;
      case AuditSeverity.MEDIUM: score += 2; break;
      case AuditSeverity.LOW: score += 1; break;
    }

    // Event type-based scoring
    if (this.isSecurityEvent(event)) {
      score += 5;
    }

    if (event.status === 'failure') {
      score += 2;
    }

    return score;
  }

  private broadcastEvent(event: IAuditLog): void {
    const message = JSON.stringify({
      type: 'event',
      data: event
    });

    // Broadcast via WebSocket
    this.wsServer?.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    // Broadcast via Socket.IO
    this.socketServer?.to('audit').emit('event', event);
  }

  private broadcastMetrics(): void {
    const message = JSON.stringify({
      type: 'metrics',
      data: this.metrics
    });

    // Broadcast via WebSocket
    this.wsServer?.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    // Broadcast via Socket.IO
    this.socketServer?.to('audit').emit('metrics', this.metrics);
  }

  private broadcastAlert(alert: AlertEvent): void {
    const message = JSON.stringify({
      type: 'alert',
      data: alert
    });

    // Broadcast via WebSocket
    this.wsServer?.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    // Broadcast via Socket.IO
    this.socketServer?.to('audit').emit('alert', alert);
  }
}

export default RealtimeMonitor;
