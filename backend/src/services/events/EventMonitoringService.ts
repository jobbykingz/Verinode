import { eventService } from './EventService';
import { eventStore } from '../../events/EventStore';
import { EventMetrics, AlertRule, EventAlert, Event } from '../../events/EventTypes';
import { WinstonLogger } from '../../utils/logger';
import { EventUtils } from '../../utils/eventUtils';
import { defaultAlertRules } from '../../config/events';

export class EventMonitoringService {
  private logger: WinstonLogger;
  private isMonitoring = false;
  private monitoringInterval: any = null;
  private metricsHistory: Map<string, EventMetrics[]> = new Map();
  private alertHistory: EventAlert[] = [];
  private customAlertRules: Map<string, AlertRule> = new Map();

  constructor() {
    this.logger = new WinstonLogger();
    
    // Initialize default alert rules
    for (const rule of defaultAlertRules) {
      this.customAlertRules.set(rule.id, rule);
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      this.logger.warn('Event monitoring is already running');
      return;
    }

    try {
      this.isMonitoring = true;
      
      // Start periodic monitoring
      this.monitoringInterval = setInterval(() => {
        this.collectMetrics();
        this.checkAlerts();
      }, 60000); // Every minute

      // Register default alert rules
      for (const rule of defaultAlertRules) {
        eventService.addAlertRule(rule);
      }

      this.logger.info('Event monitoring started');
    } catch (error) {
      this.logger.error('Failed to start event monitoring:', error);
      this.isMonitoring = false;
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    try {
      this.isMonitoring = false;
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      this.logger.info('Event monitoring stopped');
    } catch (error) {
      this.logger.error('Error stopping event monitoring:', error);
      throw error;
    }
  }

  addCustomAlertRule(rule: AlertRule): void {
    this.customAlertRules.set(rule.id, rule);
    eventService.addAlertRule(rule);
    
    this.logger.info('Custom alert rule added:', { ruleId: rule.id, name: rule.name });
  }

  removeCustomAlertRule(ruleId: string): boolean {
    const removed = this.customAlertRules.delete(ruleId);
    if (removed) {
      eventService.removeAlertRule(ruleId);
      this.logger.info('Custom alert rule removed:', { ruleId });
    }
    return removed;
  }

  getMonitoringStatus(): {
    isMonitoring: boolean;
    uptime?: number;
    metricsCount: number;
    alertRulesCount: number;
    activeAlertsCount: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      metricsCount: this.metricsHistory.size,
      alertRulesCount: this.customAlertRules.size,
      activeAlertsCount: this.alertHistory.filter(alert => !alert.resolvedAt).length
    };
  }

  getMetricsHistory(eventType?: string, limit: number = 100): EventMetrics[] {
    if (eventType) {
      const history = this.metricsHistory.get(eventType) || [];
      return history.slice(-limit);
    }

    const allMetrics: EventMetrics[] = [];
    for (const metrics of this.metricsHistory.values()) {
      allMetrics.push(...metrics);
    }

    // Sort by timestamp (newest first) and limit
    return allMetrics
      .sort((a, b) => new Date(b.lastHour).getTime() - new Date(a.lastHour).getTime())
      .slice(0, limit);
  }

  getAlertHistory(limit?: number): EventAlert[] {
    if (limit) {
      return this.alertHistory.slice(-limit);
    }
    return [...this.alertHistory];
  }

  async generateMonitoringReport(): Promise<{
    generatedAt: Date;
    timeRange: { start: Date; end: Date };
    summary: {
      totalEvents: number;
      totalAlerts: number;
      activeAlerts: number;
      resolvedAlerts: number;
      averageProcessingTime: number;
      errorRate: number;
    };
    eventMetrics: EventMetrics[];
    topAlerts: EventAlert[];
    recommendations: string[];
  }> {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const eventStats = await eventStore.getEventStats();
      const processingStats = eventService.getProcessingStats();
      const recentAlerts = this.alertHistory.filter(alert => alert.triggeredAt >= twentyFourHoursAgo);
      const activeAlerts = recentAlerts.filter(alert => !alert.resolvedAt);
      const resolvedAlerts = recentAlerts.filter(alert => alert.resolvedAt);

      const allMetrics = this.getMetricsHistory(undefined, 50);
      const averageProcessingTime = processingStats.averageProcessingTime;
      const errorRate = processingStats.totalProcessed > 0 
        ? (processingStats.failed / processingStats.totalProcessed) * 100 
        : 0;

      const topAlerts = recentAlerts
        .sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        })
        .slice(0, 10);

      const recommendations = this.generateRecommendations(eventStats, processingStats, recentAlerts);

      return {
        generatedAt: now,
        timeRange: { start: twentyFourHoursAgo, end: now },
        summary: {
          totalEvents: eventStats.totalEvents,
          totalAlerts: recentAlerts.length,
          activeAlerts: activeAlerts.length,
          resolvedAlerts: resolvedAlerts.length,
          averageProcessingTime,
          errorRate
        },
        eventMetrics: allMetrics,
        topAlerts,
        recommendations
      };
    } catch (error) {
      this.logger.error('Failed to generate monitoring report:', error);
      throw error;
    }
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    try {
      const alert = this.alertHistory.find(a => a.id === alertId);
      if (!alert) {
        return false;
      }

      if (alert.resolvedAt) {
        return false; // Already resolved
      }

      alert.resolvedAt = new Date();
      alert.metadata = {
        ...alert.metadata,
        acknowledgedBy,
        acknowledgedAt: new Date().toISOString()
      };

      this.logger.info('Alert acknowledged:', { alertId, acknowledgedBy });
      return true;
    } catch (error) {
      this.logger.error('Failed to acknowledge alert:', error);
      return false;
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const processingStats = eventService.getProcessingStats();
      const eventStats = await eventStore.getEventStats();

      // Update metrics for each event type
      for (const [eventType, count] of Object.entries(eventStats.eventsByType)) {
        const currentMetrics = eventService.getEventMetrics(eventType)[0] || {
          eventType,
          count: 0,
          successRate: 100,
          averageProcessingTime: 0,
          errorRate: 0,
          lastHour: 0,
          lastDay: 0
        };

        const updatedMetrics: EventMetrics = {
          ...currentMetrics,
          count: count,
          successRate: processingStats.totalProcessed > 0 
            ? ((processingStats.successful / processingStats.totalProcessed) * 100)
            : 100,
          averageProcessingTime: processingStats.averageProcessingTime,
          errorRate: processingStats.totalProcessed > 0 
            ? ((processingStats.failed / processingStats.totalProcessed) * 100)
            : 0
        };

        // Store in history
        if (!this.metricsHistory.has(eventType)) {
          this.metricsHistory.set(eventType, []);
        }
        
        const history = this.metricsHistory.get(eventType)!;
        history.push(updatedMetrics);
        
        // Keep only last 1000 entries per event type
        if (history.length > 1000) {
          history.splice(0, history.length - 1000);
        }
      }

      // Store system metrics
      const systemMetricsEvent = await eventService.createEvent('SYSTEM_METRIC', {
        metricName: 'event_monitoring_stats',
        value: processingStats.totalProcessed,
        unit: 'events',
        tags: {
          successful: processingStats.successful.toString(),
          failed: processingStats.failed.toString(),
          averageProcessingTime: processingStats.averageProcessingTime.toString(),
          errorRate: ((processingStats.failed / Math.max(processingStats.totalProcessed, 1)) * 100).toString()
        }
      });

      await eventService.publishEvent(systemMetricsEvent);
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
    }
  }

  private async checkAlerts(): Promise<void> {
    try {
      const currentMetrics = eventService.getEventMetrics();
      const processingStats = eventService.getProcessingStats();

      for (const rule of this.customAlertRules.values()) {
        if (!rule.enabled) {
          continue;
        }

        let shouldAlert = false;
        let message = '';

        switch (rule.condition) {
          case 'high_error_rate':
            const errorRate = processingStats.totalProcessed > 0 
              ? (processingStats.failed / processingStats.totalProcessed) * 100 
              : 0;
            shouldAlert = errorRate > rule.threshold;
            message = `Error rate (${errorRate.toFixed(2)}%) exceeds threshold (${rule.threshold}%)`;
            break;

          case 'low_success_rate':
            const successRate = processingStats.totalProcessed > 0 
              ? (processingStats.successful / processingStats.totalProcessed) * 100 
              : 100;
            shouldAlert = successRate < rule.threshold;
            message = `Success rate (${successRate.toFixed(2)}%) below threshold (${rule.threshold}%)`;
            break;

          case 'high_volume':
            const totalEvents = currentMetrics.reduce((sum, m) => sum + m.lastHour, 0);
            shouldAlert = totalEvents > rule.threshold;
            message = `Event volume (${totalEvents}) exceeds threshold (${rule.threshold}) in last hour`;
            break;

          case 'slow_processing':
            shouldAlert = processingStats.averageProcessingTime > rule.threshold;
            message = `Average processing time (${processingStats.averageProcessingTime.toFixed(2)}ms) exceeds threshold (${rule.threshold}ms)`;
            break;
        }

        if (shouldAlert) {
          await this.triggerAlert(rule, message);
        }
      }
    } catch (error) {
      this.logger.error('Failed to check alerts:', error);
    }
  }

  private async triggerAlert(rule: AlertRule, message: string): Promise<void> {
    try {
      // Check if we already have an active alert for this rule
      const existingActiveAlert = this.alertHistory.find(alert => 
        alert.ruleId === rule.id && 
        !alert.resolvedAt && 
        (Date.now() - alert.triggeredAt.getTime()) < (rule.timeWindow * 1000)
      );

      if (existingActiveAlert) {
        return; // Don't duplicate alerts within time window
      }

      const alert: EventAlert = {
        id: EventUtils.generateEventId(),
        ruleId: rule.id,
        eventType: 'SYSTEM',
        message,
        severity: rule.severity,
        triggeredAt: new Date(),
        metadata: {
          ruleName: rule.name,
          threshold: rule.threshold,
          condition: rule.condition
        }
      };

      this.alertHistory.push(alert);

      // Keep only last 10000 alerts
      if (this.alertHistory.length > 10000) {
        this.alertHistory = this.alertHistory.slice(-10000);
      }

      // Send notifications
      await this.sendAlertNotifications(alert, rule);

      this.logger.warn('Alert triggered:', {
        alertId: alert.id,
        ruleId: rule.id,
        severity: alert.severity,
        message
      });
    } catch (error) {
      this.logger.error('Failed to trigger alert:', error);
    }
  }

  private async sendAlertNotifications(alert: EventAlert, rule: AlertRule): Promise<void> {
    try {
      const notificationPayload = {
        alertId: alert.id,
        message: alert.message,
        severity: alert.severity,
        ruleName: rule.name,
        triggeredAt: alert.triggeredAt
      };

      // Send to configured notification channels
      for (const channel of rule.notifications) {
        switch (channel) {
          case 'email':
            await this.sendEmailNotification(notificationPayload);
            break;
          case 'slack':
            await this.sendSlackNotification(notificationPayload);
            break;
          case 'pagerduty':
            await this.sendPagerDutyNotification(notificationPayload);
            break;
          default:
            this.logger.warn('Unknown notification channel:', channel);
        }
      }
    } catch (error) {
      this.logger.error('Failed to send alert notifications:', error);
    }
  }

  private async sendEmailNotification(payload: any): Promise<void> {
    // Mock email notification - integrate with your email service
    this.logger.info('Email notification sent:', payload);
  }

  private async sendSlackNotification(payload: any): Promise<void> {
    // Mock Slack notification - integrate with Slack API
    this.logger.info('Slack notification sent:', payload);
  }

  private async sendPagerDutyNotification(payload: any): Promise<void> {
    // Mock PagerDuty notification - integrate with PagerDuty API
    this.logger.info('PagerDuty notification sent:', payload);
  }

  private generateRecommendations(
    eventStats: any,
    processingStats: any,
    recentAlerts: EventAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // High error rate recommendations
    const errorRate = processingStats.totalProcessed > 0 
      ? (processingStats.failed / processingStats.totalProcessed) * 100 
      : 0;
    
    if (errorRate > 5) {
      recommendations.push('Investigate recent failures - error rate is above 5%');
      recommendations.push('Check event handler configurations and dependencies');
    }

    // Slow processing recommendations
    if (processingStats.averageProcessingTime > 1000) {
      recommendations.push('Optimize event handlers - average processing time is above 1 second');
      recommendations.push('Consider implementing async processing for slow operations');
    }

    // High volume recommendations
    const totalEvents = Object.values(eventStats.eventsByType).reduce((sum: number, count: any) => sum + count, 0);
    if (totalEvents > 10000) {
      recommendations.push('Consider implementing event batching for high-volume periods');
      recommendations.push('Scale up event processing resources during peak hours');
    }

    // Alert frequency recommendations
    const criticalAlerts = recentAlerts.filter(alert => alert.severity === 'critical').length;
    if (criticalAlerts > 5) {
      recommendations.push('Review alert thresholds - too many critical alerts triggered');
      recommendations.push('Implement automated recovery procedures for critical issues');
    }

    return recommendations;
  }
}

export const eventMonitoringService = new EventMonitoringService();
