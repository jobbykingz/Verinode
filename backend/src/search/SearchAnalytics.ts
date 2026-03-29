/**
 * Search Analytics and Insights
 * Comprehensive analytics, monitoring, and insights for search performance
 */

import { logger } from '../utils/logger';

export interface SearchEvent {
  id: string;
  type: 'search' | 'click' | 'view' | 'convert' | 'filter' | 'sort' | 'facet';
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  searchId?: string;
  documentId?: string;
  query?: string;
  filters?: Record<string, any>;
  results?: number;
  duration?: number;
  position?: number;
  metadata?: Record<string, any>;
}

export interface SearchMetrics {
  totalSearches: number;
  uniqueQueries: number;
  averageResults: number;
  averageDuration: number;
  clickThroughRate: number;
  conversionRate: number;
  zeroResultsRate: number;
  topQueries: QueryMetric[];
  topFilters: FilterMetric[];
  topDocuments: DocumentMetric[];
  userEngagement: UserEngagementMetric;
  performanceMetrics: PerformanceMetric;
  contentGaps: ContentGapMetric[];
}

export interface QueryMetric {
  query: string;
  count: number;
  averageResults: number;
  averageDuration: number;
  clickThroughRate: number;
  conversionRate: number;
  zeroResultsRate: number;
  trend: 'up' | 'down' | 'stable';
}

export interface FilterMetric {
  field: string;
  value: string;
  count: number;
  clickThroughRate: number;
  conversionRate: number;
}

export interface DocumentMetric {
  documentId: string;
  title: string;
  impressions: number;
  clicks: number;
  clickThroughRate: number;
  conversions: number;
  conversionRate: number;
  averagePosition: number;
  lastClicked: Date;
}

export interface UserEngagementMetric {
  totalUsers: number;
  activeUsers: number;
  averageSearchesPerUser: number;
  averageSessionDuration: number;
  bounceRate: number;
  returnUserRate: number;
  topUserSegments: UserSegment[];
}

export interface UserSegment {
  segment: string;
  users: number;
  searches: number;
  averageResults: number;
  clickThroughRate: number;
  conversionRate: number;
}

export interface PerformanceMetric {
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  indexSize: number;
  queryComplexity: QueryComplexityMetric;
}

export interface QueryComplexityMetric {
  simple: number;
  medium: number;
  complex: number;
  averageTerms: number;
  averageFilters: number;
}

export interface ContentGapMetric {
  type: 'missing_content' | 'outdated_content' | 'poor_performing' | 'high_demand';
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  queries: string[];
  estimatedImpact: number;
}

export interface SearchInsight {
  id: string;
  type: 'performance' | 'content' | 'user_behavior' | 'technical';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  recommendation: string;
  data: Record<string, any>;
  createdAt: Date;
  acknowledged: boolean;
}

export interface AnalyticsConfig {
  retentionDays: number;
  batchSize: number;
  enableRealTime: boolean;
  enablePredictions: boolean;
  alertThresholds: {
    slowQuery: number;
    highErrorRate: number;
    lowCTR: number;
    lowConversionRate: number;
  };
}

export class SearchAnalytics {
  private events: SearchEvent[] = [];
  private config: AnalyticsConfig;
  private insights: SearchInsight[] = [];
  private alerts: SearchAlert[] = [];

  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = {
      retentionDays: 30,
      batchSize: 1000,
      enableRealTime: true,
      enablePredictions: true,
      alertThresholds: {
        slowQuery: 2000, // 2 seconds
        highErrorRate: 0.05, // 5%
        lowCTR: 0.02, // 2%
        lowConversionRate: 0.01 // 1%
      },
      ...config
    };
  }

  /**
   * Record search event
   */
  recordEvent(event: SearchEvent): void {
    this.events.push(event);

    // Process in real-time if enabled
    if (this.config.enableRealTime) {
      this.processEvent(event);
    }

    // Batch processing
    if (this.events.length >= this.config.batchSize) {
      this.processBatch();
    }

    // Clean old events
    this.cleanOldEvents();
  }

  /**
   * Get comprehensive search metrics
   */
  getMetrics(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): SearchMetrics {
    const cutoff = this.getCutoffDate(timeRange);
    const relevantEvents = this.events.filter(event => event.timestamp >= cutoff);

    return {
      totalSearches: this.getTotalSearches(relevantEvents),
      uniqueQueries: this.getUniqueQueries(relevantEvents),
      averageResults: this.getAverageResults(relevantEvents),
      averageDuration: this.getAverageDuration(relevantEvents),
      clickThroughRate: this.getClickThroughRate(relevantEvents),
      conversionRate: this.getConversionRate(relevantEvents),
      zeroResultsRate: this.getZeroResultsRate(relevantEvents),
      topQueries: this.getTopQueries(relevantEvents),
      topFilters: this.getTopFilters(relevantEvents),
      topDocuments: this.getTopDocuments(relevantEvents),
      userEngagement: this.getUserEngagementMetrics(relevantEvents),
      performanceMetrics: this.getPerformanceMetrics(relevantEvents),
      contentGaps: this.getContentGaps(relevantEvents)
    };
  }

  /**
   * Generate search insights
   */
  generateInsights(): SearchInsight[] {
    const insights: SearchInsight[] = [];
    const cutoff = this.getCutoffDate('week');
    const recentEvents = this.events.filter(event => event.timestamp >= cutoff);

    // Performance insights
    insights.push(...this.generatePerformanceInsights(recentEvents));

    // Content insights
    insights.push(...this.generateContentInsights(recentEvents));

    // User behavior insights
    insights.push(...this.generateUserBehaviorInsights(recentEvents));

    // Technical insights
    insights.push(...this.generateTechnicalInsights(recentEvents));

    // Store insights
    this.insights = insights;
    return insights;
  }

  /**
   * Get search alerts
   */
  getAlerts(): SearchAlert[] {
    return this.alerts;
  }

  /**
   * Acknowledge insight
   */
  acknowledgeInsight(insightId: string): void {
    const insight = this.insights.find(i => i.id === insightId);
    if (insight) {
      insight.acknowledged = true;
    }
  }

  /**
   * Get query trends
   */
  getQueryTrends(timeRange: 'day' | 'week' | 'month' = 'week'): QueryTrend[] {
    const cutoff = this.getCutoffDate(timeRange);
    const searchEvents = this.events.filter(event => 
      event.type === 'search' && event.timestamp >= cutoff
    );

    const queryCounts = new Map<string, number[]>();
    
    // Group by day
    for (const event of searchEvents) {
      if (event.query) {
        const day = event.timestamp.toISOString().split('T')[0];
        
        if (!queryCounts.has(event.query)) {
          queryCounts.set(event.query, []);
        }
        
        const counts = queryCounts.get(event.query)!;
        const dayIndex = this.getDayIndex(cutoff, event.timestamp);
        
        while (counts.length <= dayIndex) {
          counts.push(0);
        }
        
        counts[dayIndex]++;
      }
    }

    const trends: QueryTrend[] = [];
    for (const [query, counts] of queryCounts) {
      const trend = this.calculateTrend(counts);
      trends.push({
        query,
        counts,
        trend: trend.direction,
        change: trend.change,
        significance: trend.significance
      });
    }

    return trends.sort((a, b) => b.significance - a.significance);
  }

  /**
   * Get user journey analysis
   */
  getUserJourney(userId: string): UserJourney {
    const userEvents = this.events.filter(event => event.userId === userId);
    
    return {
      userId,
      totalSearches: userEvents.filter(e => e.type === 'search').length,
      totalClicks: userEvents.filter(e => e.type === 'click').length,
      totalConversions: userEvents.filter(e => e.type === 'convert').length,
      averageSessionDuration: this.calculateAverageSessionDuration(userEvents),
      topQueries: this.getTopQueriesForUser(userEvents),
      searchPatterns: this.analyzeSearchPatterns(userEvents),
      journey: this.buildJourneyTimeline(userEvents)
    };
  }

  /**
   * Export analytics data
   */
  exportData(format: 'json' | 'csv' | 'xlsx' = 'json'): string {
    const metrics = this.getMetrics();
    
    switch (format) {
      case 'json':
        return JSON.stringify(metrics, null, 2);
      case 'csv':
        return this.convertToCSV(metrics);
      case 'xlsx':
        return this.convertToXLSX(metrics);
      default:
        return JSON.stringify(metrics, null, 2);
    }
  }

  /**
   * Process individual event
   */
  private processEvent(event: SearchEvent): void {
    // Check for alerts
    this.checkAlerts(event);

    // Update real-time metrics
    this.updateRealTimeMetrics(event);
  }

  /**
   * Process batch of events
   */
  private processBatch(): void {
    // Process events in batch for efficiency
    // This is where you would update aggregated tables, send to external systems, etc.
    logger.debug(`Processing batch of ${this.events.length} events`);
  }

  /**
   * Clean old events
   */
  private cleanOldEvents(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.retentionDays);
    
    const beforeCount = this.events.length;
    this.events = this.events.filter(event => event.timestamp >= cutoff);
    
    if (this.events.length < beforeCount) {
      logger.debug(`Cleaned ${beforeCount - this.events.length} old events`);
    }
  }

  /**
   * Check for alerts
   */
  private checkAlerts(event: SearchEvent): void {
    // Slow query alert
    if (event.type === 'search' && event.duration && event.duration > this.config.alertThresholds.slowQuery) {
      this.createAlert('slow_query', `Slow query detected: ${event.query} took ${event.duration}ms`, event);
    }

    // High error rate alert (would need error tracking)
    // Low CTR alert (would need aggregate calculation)
    // Low conversion rate alert (would need aggregate calculation)
  }

  /**
   * Create alert
   */
  private createAlert(type: string, message: string, event: SearchEvent): void {
    const alert: SearchAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      severity: this.getAlertSeverity(type),
      timestamp: new Date(),
      eventId: event.id,
      acknowledged: false
    };

    this.alerts.push(alert);
    logger.warn(`Search alert: ${message}`);
  }

  /**
   * Get alert severity
   */
  private getAlertSeverity(type: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'slow_query': 'medium',
      'high_error_rate': 'high',
      'low_ctr': 'low',
      'low_conversion_rate': 'medium',
      'index_down': 'critical'
    };

    return severityMap[type] || 'low';
  }

  /**
   * Update real-time metrics
   */
  private updateRealTimeMetrics(event: SearchEvent): void {
    // Update real-time counters and metrics
    // This would be used for dashboards and monitoring
  }

  /**
   * Generate performance insights
   */
  private generatePerformanceInsights(events: SearchEvent[]): SearchInsight[] {
    const insights: SearchInsight[] = [];
    const searchEvents = events.filter(e => e.type === 'search');

    // Slow queries insight
    const slowQueries = searchEvents.filter(e => e.duration && e.duration > this.config.alertThresholds.slowQuery);
    if (slowQueries.length > searchEvents.length * 0.1) { // More than 10% slow queries
      insights.push({
        id: `insight_${Date.now()}_slow_queries`,
        type: 'performance',
        title: 'High Number of Slow Queries',
        description: `${slowQueries.length} queries (${(slowQueries.length / searchEvents.length * 100).toFixed(1)}%) are taking longer than ${this.config.alertThresholds.slowQuery}ms`,
        impact: 'high',
        confidence: 0.9,
        recommendation: 'Consider optimizing search queries, adding indexes, or scaling search infrastructure',
        data: { slowQueries: slowQueries.length, totalQueries: searchEvents.length },
        createdAt: new Date(),
        acknowledged: false
      });
    }

    return insights;
  }

  /**
   * Generate content insights
   */
  private generateContentInsights(events: SearchEvent[]): SearchInsight[] {
    const insights: SearchInsight[] = [];
    const searchEvents = events.filter(e => e.type === 'search');

    // Zero results queries
    const zeroResultsQueries = searchEvents.filter(e => e.results === 0);
    if (zeroResultsQueries.length > searchEvents.length * 0.2) { // More than 20% zero results
      insights.push({
        id: `insight_${Date.now()}_zero_results`,
        type: 'content',
        title: 'High Zero Results Rate',
        description: `${zeroResultsQueries.length} queries (${(zeroResultsQueries.length / searchEvents.length * 100).toFixed(1)}%) are returning zero results`,
        impact: 'medium',
        confidence: 0.8,
        recommendation: 'Review content gaps and improve content coverage for common queries',
        data: { zeroResultsQueries: zeroResultsQueries.length, totalQueries: searchEvents.length },
        createdAt: new Date(),
        acknowledged: false
      });
    }

    return insights;
  }

  /**
   * Generate user behavior insights
   */
  private generateUserBehaviorInsights(events: SearchEvent[]): SearchInsight[] {
    const insights: SearchInsight[] = [];
    
    // Low click-through rate
    const clickEvents = events.filter(e => e.type === 'click');
    const searchEvents = events.filter(e => e.type === 'search');
    
    if (searchEvents.length > 0) {
      const ctr = clickEvents.length / searchEvents.length;
      if (ctr < this.config.alertThresholds.lowCTR) {
        insights.push({
          id: `insight_${Date.now()}_low_ctr`,
          type: 'user_behavior',
          title: 'Low Click-Through Rate',
          description: `Click-through rate is ${(ctr * 100).toFixed(1)}%, which is below the threshold of ${(this.config.alertThresholds.lowCTR * 100).toFixed(1)}%`,
          impact: 'medium',
          confidence: 0.7,
          recommendation: 'Improve search result relevance, titles, and descriptions to increase engagement',
          data: { ctr, clicks: clickEvents.length, searches: searchEvents.length },
          createdAt: new Date(),
          acknowledged: false
        });
      }
    }

    return insights;
  }

  /**
   * Generate technical insights
   */
  private generateTechnicalInsights(events: SearchEvent[]): SearchInsight[] {
    const insights: SearchInsight[] = [];
    
    // Query complexity analysis
    const searchEvents = events.filter(e => e.type === 'search');
    const complexQueries = searchEvents.filter(e => 
      e.query && e.query.split(' ').length > 5
    );
    
    if (complexQueries.length > searchEvents.length * 0.3) { // More than 30% complex queries
      insights.push({
        id: `insight_${Date.now()}_complex_queries`,
        type: 'technical',
        title: 'High Number of Complex Queries',
        description: `${complexQueries.length} queries (${(complexQueries.length / searchEvents.length * 100).toFixed(1)}%) contain more than 5 terms`,
        impact: 'low',
        confidence: 0.6,
        recommendation: 'Consider implementing query simplification or better query processing for complex searches',
        data: { complexQueries: complexQueries.length, totalQueries: searchEvents.length },
        createdAt: new Date(),
        acknowledged: false
      });
    }

    return insights;
  }

  // Helper methods for metric calculations
  private getTotalSearches(events: SearchEvent[]): number {
    return events.filter(e => e.type === 'search').length;
  }

  private getUniqueQueries(events: SearchEvent[]): number {
    const queries = new Set(events.filter(e => e.type === 'search' && e.query).map(e => e.query));
    return queries.size;
  }

  private getAverageResults(events: SearchEvent[]): number {
    const searchEvents = events.filter(e => e.type === 'search' && e.results !== undefined);
    if (searchEvents.length === 0) return 0;
    return searchEvents.reduce((sum, e) => sum + (e.results || 0), 0) / searchEvents.length;
  }

  private getAverageDuration(events: SearchEvent[]): number {
    const searchEvents = events.filter(e => e.type === 'search' && e.duration !== undefined);
    if (searchEvents.length === 0) return 0;
    return searchEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / searchEvents.length;
  }

  private getClickThroughRate(events: SearchEvent[]): number {
    const searches = events.filter(e => e.type === 'search').length;
    const clicks = events.filter(e => e.type === 'click').length;
    return searches > 0 ? clicks / searches : 0;
  }

  private getConversionRate(events: SearchEvent[]): number {
    const searches = events.filter(e => e.type === 'search').length;
    const conversions = events.filter(e => e.type === 'convert').length;
    return searches > 0 ? conversions / searches : 0;
  }

  private getZeroResultsRate(events: SearchEvent[]): number {
    const searches = events.filter(e => e.type === 'search');
    const zeroResults = searches.filter(e => e.results === 0);
    return searches.length > 0 ? zeroResults.length / searches.length : 0;
  }

  private getTopQueries(events: SearchEvent[]): QueryMetric[] {
    const queryCounts = new Map<string, { count: number; totalResults: number; totalDuration: number; clicks: number; conversions: number; zeroResults: number }>();
    
    for (const event of events) {
      if (event.type === 'search' && event.query) {
        const existing = queryCounts.get(event.query) || { count: 0, totalResults: 0, totalDuration: 0, clicks: 0, conversions: 0, zeroResults: 0 };
        existing.count++;
        existing.totalResults += event.results || 0;
        existing.totalDuration += event.duration || 0;
        if (event.results === 0) existing.zeroResults++;
        queryCounts.set(event.query, existing);
      } else if (event.type === 'click' && event.searchId) {
        // Find the corresponding search
        const searchEvent = events.find(e => e.id === event.searchId && e.type === 'search');
        if (searchEvent && searchEvent.query) {
          const existing = queryCounts.get(searchEvent.query) || { count: 0, totalResults: 0, totalDuration: 0, clicks: 0, conversions: 0, zeroResults: 0 };
          existing.clicks++;
          queryCounts.set(searchEvent.query, existing);
        }
      } else if (event.type === 'convert' && event.searchId) {
        const searchEvent = events.find(e => e.id === event.searchId && e.type === 'search');
        if (searchEvent && searchEvent.query) {
          const existing = queryCounts.get(searchEvent.query) || { count: 0, totalResults: 0, totalDuration: 0, clicks: 0, conversions: 0, zeroResults: 0 };
          existing.conversions++;
          queryCounts.set(searchEvent.query, existing);
        }
      }
    }

    const metrics: QueryMetric[] = [];
    for (const [query, stats] of queryCounts) {
      metrics.push({
        query,
        count: stats.count,
        averageResults: stats.totalResults / stats.count,
        averageDuration: stats.totalDuration / stats.count,
        clickThroughRate: stats.clicks / stats.count,
        conversionRate: stats.conversions / stats.count,
        zeroResultsRate: stats.zeroResults / stats.count,
        trend: 'stable' // Would need historical data for trend
      });
    }

    return metrics.sort((a, b) => b.count - a.count).slice(0, 10);
  }

  private getTopFilters(events: SearchEvent[]): FilterMetric[] {
    // Implementation for top filters
    return [];
  }

  private getTopDocuments(events: SearchEvent[]): DocumentMetric[] {
    // Implementation for top documents
    return [];
  }

  private getUserEngagementMetrics(events: SearchEvent[]): UserEngagementMetric {
    // Implementation for user engagement metrics
    return {
      totalUsers: 0,
      activeUsers: 0,
      averageSearchesPerUser: 0,
      averageSessionDuration: 0,
      bounceRate: 0,
      returnUserRate: 0,
      topUserSegments: []
    };
  }

  private getPerformanceMetrics(events: SearchEvent[]): PerformanceMetric {
    const searchEvents = events.filter(e => e.type === 'search' && e.duration !== undefined);
    const durations = searchEvents.map(e => e.duration!).sort((a, b) => a - b);
    
    return {
      averageResponseTime: this.getAverageDuration(events),
      p50ResponseTime: durations[Math.floor(durations.length * 0.5)] || 0,
      p95ResponseTime: durations[Math.floor(durations.length * 0.95)] || 0,
      p99ResponseTime: durations[Math.floor(durations.length * 0.99)] || 0,
      errorRate: 0, // Would need error tracking
      cacheHitRate: 0, // Would need cache tracking
      indexSize: 0, // Would need index size tracking
      queryComplexity: {
        simple: 0,
        medium: 0,
        complex: 0,
        averageTerms: 0,
        averageFilters: 0
      }
    };
  }

  private getContentGaps(events: SearchEvent[]): ContentGapMetric[] {
    // Implementation for content gaps analysis
    return [];
  }

  private getCutoffDate(timeRange: string): Date {
    const cutoff = new Date();
    switch (timeRange) {
      case 'hour':
        cutoff.setHours(cutoff.getHours() - 1);
        break;
      case 'day':
        cutoff.setDate(cutoff.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(cutoff.getMonth() - 1);
        break;
    }
    return cutoff;
  }

  private getDayIndex(startDate: Date, currentDate: Date): number {
    const diffTime = currentDate.getTime() - startDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  private calculateTrend(counts: number[]): { direction: 'up' | 'down' | 'stable'; change: number; significance: number } {
    if (counts.length < 2) return { direction: 'stable', change: 0, significance: 0 };
    
    const firstHalf = counts.slice(0, Math.floor(counts.length / 2));
    const secondHalf = counts.slice(Math.floor(counts.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, count) => sum + count, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, count) => sum + count, 0) / secondHalf.length;
    
    const change = firstAvg > 0 ? (secondAvg - firstAvg) / firstAvg : 0;
    const significance = Math.abs(change);
    
    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (change > 0.1) direction = 'up';
    else if (change < -0.1) direction = 'down';
    
    return { direction, change, significance };
  }

  private calculateAverageSessionDuration(userEvents: SearchEvent[]): number {
    // Implementation for average session duration
    return 0;
  }

  private getTopQueriesForUser(userEvents: SearchEvent[]): string[] {
    // Implementation for top queries per user
    return [];
  }

  private analyzeSearchPatterns(userEvents: SearchEvent[]): any {
    // Implementation for search pattern analysis
    return {};
  }

  private buildJourneyTimeline(userEvents: SearchEvent[]): any {
    // Implementation for journey timeline
    return {};
  }

  private convertToCSV(metrics: SearchMetrics): string {
    // Implementation for CSV conversion
    return '';
  }

  private convertToXLSX(metrics: SearchMetrics): string {
    // Implementation for XLSX conversion
    return '';
  }
}

interface SearchAlert {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  eventId: string;
  acknowledged: boolean;
}

interface QueryTrend {
  query: string;
  counts: number[];
  trend: 'up' | 'down' | 'stable';
  change: number;
  significance: number;
}

interface UserJourney {
  userId: string;
  totalSearches: number;
  totalClicks: number;
  totalConversions: number;
  averageSessionDuration: number;
  topQueries: string[];
  searchPatterns: any;
  journey: any;
}

export default SearchAnalytics;
