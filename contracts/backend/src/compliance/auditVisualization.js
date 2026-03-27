const ComplianceService = require('../services/complianceService');

class AuditTrailVisualization {
  /**
   * Generate timeline visualization data
   */
  static async generateTimelineData(options = {}) {
    const {
      resourceId,
      userId,
      eventType,
      startDate,
      endDate,
      limit = 100
    } = options;

    let auditEvents;
    
    if (resourceId) {
      auditEvents = await ComplianceService.getAuditTrail(resourceId, {
        eventType,
        startDate,
        endDate,
        limit
      });
    } else if (userId) {
      auditEvents = await ComplianceService.getUserAuditTrail(userId, {
        eventType,
        startDate,
        endDate,
        limit
      });
    } else {
      auditEvents = await ComplianceService.getComplianceEvents([], {
        startDate,
        endDate,
        limit
      });
    }

    // Transform data for timeline visualization
    const timelineData = auditEvents.map(event => ({
      id: event.eventId,
      timestamp: event.timestamp,
      type: event.eventType,
      actor: event.actor.name,
      action: event.action,
      resource: event.resource?.name || 'N/A',
      status: event.status,
      severity: this.getEventSeverity(event),
      category: this.getEventCategory(event.eventType),
      details: event.eventData
    }));

    return {
      events: timelineData,
      metadata: {
        totalEvents: timelineData.length,
        dateRange: {
          start: startDate || auditEvents[auditEvents.length - 1]?.timestamp,
          end: endDate || auditEvents[0]?.timestamp
        },
        filtersApplied: {
          resourceId,
          userId,
          eventType
        }
      }
    };
  }

  /**
   * Generate activity heatmap data
   */
  static async generateHeatmapData(options = {}) {
    const {
      startDate,
      endDate,
      granularity = 'hour' // hour, day, week
    } = options;

    const auditEvents = await ComplianceService.getComplianceEvents([], {
      startDate,
      endDate
    });

    const heatmapData = this.aggregateEventsByTime(auditEvents, granularity);
    
    return {
      data: heatmapData,
      metadata: {
        granularity,
        totalEvents: auditEvents.length,
        dateRange: { start: startDate, end: endDate }
      }
    };
  }

  /**
   * Generate user activity analysis
   */
  static async generateUserActivityData(options = {}) {
    const {
      startDate,
      endDate,
      limit = 20
    } = options;

    const auditEvents = await ComplianceService.getComplianceEvents([], {
      startDate,
      endDate
    });

    // Group by user
    const userActivity = {};
    
    auditEvents.forEach(event => {
      const userId = event.actor.id;
      if (!userActivity[userId]) {
        userActivity[userId] = {
          userId,
          userName: event.actor.name,
          totalActions: 0,
          eventTypes: {},
          complianceEvents: 0,
          securityEvents: 0,
          firstActivity: event.timestamp,
          lastActivity: event.timestamp
        };
      }

      const user = userActivity[userId];
      user.totalActions++;
      
      // Count event types
      user.eventTypes[event.eventType] = (user.eventTypes[event.eventType] || 0) + 1;
      
      // Categorize events
      if (event.compliance?.gdprRelevant || event.compliance?.hipaaRelevant) {
        user.complianceEvents++;
      }
      
      if (event.eventType.includes('SECURITY') || event.status === 'FAILURE') {
        user.securityEvents++;
      }
      
      // Update activity timestamps
      if (new Date(event.timestamp) < new Date(user.firstActivity)) {
        user.firstActivity = event.timestamp;
      }
      if (new Date(event.timestamp) > new Date(user.lastActivity)) {
        user.lastActivity = event.timestamp;
      }
    });

    // Convert to array and sort
    const activityArray = Object.values(userActivity)
      .sort((a, b) => b.totalActions - a.totalActions)
      .slice(0, limit);

    return {
      users: activityArray,
      metadata: {
        totalUsers: Object.keys(userActivity).length,
        dateRange: { start: startDate, end: endDate },
        topUsers: limit
      }
    };
  }

  /**
   * Generate compliance metrics dashboard
   */
  static async generateComplianceMetrics() {
    const dashboard = await ComplianceService.getComplianceDashboard();
    
    // Add additional metrics
    const additionalMetrics = await this.calculateAdditionalMetrics();
    
    return {
      ...dashboard,
      additionalMetrics,
      trends: await this.getComplianceTrends()
    };
  }

  /**
   * Generate event correlation analysis
   */
  static async generateCorrelationAnalysis(options = {}) {
    const {
      startDate,
      endDate,
      correlationWindow = 3600000 // 1 hour
    } = options;

    const auditEvents = await ComplianceService.getComplianceEvents([], {
      startDate,
      endDate
    });

    const correlations = this.findEventCorrelations(auditEvents, correlationWindow);
    
    return {
      correlations,
      metadata: {
        totalEvents: auditEvents.length,
        correlationWindow,
        dateRange: { start: startDate, end: endDate }
      }
    };
  }

  /**
   * Generate geographic distribution data
   */
  static async generateGeographicData(options = {}) {
    const {
      startDate,
      endDate
    } = options;

    const auditEvents = await ComplianceService.getComplianceEvents([], {
      startDate,
      endDate
    });

    const geoData = this.aggregateByLocation(auditEvents);
    
    return {
      locations: geoData,
      metadata: {
        totalEvents: auditEvents.length,
        eventsWithLocation: geoData.reduce((sum, loc) => sum + loc.eventCount, 0),
        dateRange: { start: startDate, end: endDate }
      }
    };
  }

  /**
   * Generate access pattern analysis
   */
  static async generateAccessPatternData(options = {}) {
    const {
      startDate,
      endDate,
      resourceId
    } = options;

    const query = { eventType: 'ACCESS_REQUEST' };
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    if (resourceId) {
      query['resource.id'] = resourceId;
    }

    const accessEvents = await ComplianceService.getComplianceEvents([], {
      startDate,
      endDate
    }).then(events => events.filter(e => e.eventType === 'ACCESS_REQUEST'));

    const patternData = this.analyzeAccessPatterns(accessEvents);
    
    return {
      patterns: patternData,
      metadata: {
        totalAccessRequests: accessEvents.length,
        successfulRequests: accessEvents.filter(e => e.status === 'SUCCESS').length,
        failedRequests: accessEvents.filter(e => e.status === 'FAILURE').length,
        dateRange: { start: startDate, end: endDate }
      }
    };
  }

  /**
   * Get event severity level
   */
  static getEventSeverity(event) {
    if (event.status === 'FAILURE') return 'HIGH';
    if (event.compliance?.classification === 'RESTRICTED') return 'HIGH';
    if (event.compliance?.classification === 'CONFIDENTIAL') return 'MEDIUM';
    if (event.eventType.includes('SECURITY') || event.eventType.includes('COMPROMISE')) return 'HIGH';
    return 'LOW';
  }

  /**
   * Get event category
   */
  static getEventCategory(eventType) {
    if (eventType.includes('PROOF')) return 'Proof Management';
    if (eventType.includes('PRIVACY') || eventType.includes('CONSENT')) return 'Privacy Controls';
    if (eventType.includes('KEY') || eventType.includes('ENCRYPT')) return 'Security';
    if (eventType.includes('ACCESS') || eventType.includes('LOGIN')) return 'Access Control';
    if (eventType.includes('SYSTEM') || eventType.includes('CONFIG')) return 'System';
    return 'Other';
  }

  /**
   * Aggregate events by time for heatmap
   */
  static aggregateEventsByTime(events, granularity) {
    const aggregated = {};
    
    events.forEach(event => {
      const timestamp = new Date(event.timestamp);
      let key;
      
      switch (granularity) {
        case 'hour':
          key = `${timestamp.getFullYear()}-${timestamp.getMonth() + 1}-${timestamp.getDate()} ${timestamp.getHours()}:00`;
          break;
        case 'day':
          key = `${timestamp.getFullYear()}-${timestamp.getMonth() + 1}-${timestamp.getDate()}`;
          break;
        case 'week':
          const week = Math.floor(timestamp.getDate() / 7) + 1;
          key = `${timestamp.getFullYear()}-${timestamp.getMonth() + 1}-W${week}`;
          break;
        default:
          key = `${timestamp.getFullYear()}-${timestamp.getMonth() + 1}-${timestamp.getDate()} ${timestamp.getHours()}:00`;
      }
      
      if (!aggregated[key]) {
        aggregated[key] = {
          time: key,
          count: 0,
          events: []
        };
      }
      
      aggregated[key].count++;
      aggregated[key].events.push({
        id: event.eventId,
        type: event.eventType,
        severity: this.getEventSeverity(event)
      });
    });
    
    return Object.values(aggregated);
  }

  /**
   * Calculate additional compliance metrics
   */
  static async calculateAdditionalMetrics() {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const weeklyEvents = await ComplianceService.getComplianceEvents([], {
      startDate: lastWeek
    });
    
    const monthlyEvents = await ComplianceService.getComplianceEvents([], {
      startDate: lastMonth
    });

    return {
      weeklyActivity: {
        totalEvents: weeklyEvents.length,
        complianceEvents: weeklyEvents.filter(e => 
          e.compliance?.gdprRelevant || e.compliance?.hipaaRelevant
        ).length,
        securityEvents: weeklyEvents.filter(e => 
          e.eventType.includes('SECURITY') || e.status === 'FAILURE'
        ).length
      },
      monthlyActivity: {
        totalEvents: monthlyEvents.length,
        complianceEvents: monthlyEvents.filter(e => 
          e.compliance?.gdprRelevant || e.compliance?.hipaaRelevant
        ).length,
        securityEvents: monthlyEvents.filter(e => 
          e.eventType.includes('SECURITY') || e.status === 'FAILURE'
        ).length
      },
      trendingUp: weeklyEvents.length > (monthlyEvents.length / 4) // More than average weekly activity
    };
  }

  /**
   * Get compliance trends
   */
  static async getComplianceTrends() {
    const trends = {};
    
    // Get data for last 30 days, grouped by week
    for (let i = 4; i >= 0; i--) {
      const endDate = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const weekEvents = await ComplianceService.getComplianceEvents([], {
        startDate,
        endDate
      });
      
      trends[`week_${i}`] = {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        totalEvents: weekEvents.length,
        complianceEvents: weekEvents.filter(e => 
          e.compliance?.gdprRelevant || e.compliance?.hipaaRelevant
        ).length,
        violations: weekEvents.filter(e => e.status === 'FAILURE').length
      };
    }
    
    return trends;
  }

  /**
   * Find correlations between events
   */
  static findEventCorrelations(events, window) {
    const correlations = [];
    const eventMap = new Map();
    
    // Index events by ID for quick lookup
    events.forEach(event => {
      eventMap.set(event.eventId, event);
    });
    
    // Look for related events within time window
    events.forEach(event => {
      if (event.correlationId) {
        const relatedEvents = events.filter(e => 
          e.correlationId === event.correlationId && 
          e.eventId !== event.eventId &&
          Math.abs(new Date(e.timestamp) - new Date(event.timestamp)) <= window
        );
        
        if (relatedEvents.length > 0) {
          correlations.push({
            primaryEvent: event.eventId,
            relatedEvents: relatedEvents.map(e => e.eventId),
            timeDifference: Math.max(...relatedEvents.map(e => 
              Math.abs(new Date(e.timestamp) - new Date(event.timestamp))
            )),
            correlationId: event.correlationId
          });
        }
      }
    });
    
    return correlations;
  }

  /**
   * Aggregate events by location
   */
  static aggregateByLocation(events) {
    const locations = {};
    
    events.forEach(event => {
      if (event.location) {
        const locationKey = `${event.location.country || 'Unknown'}-${event.location.city || 'Unknown'}`;
        
        if (!locations[locationKey]) {
          locations[locationKey] = {
            country: event.location.country || 'Unknown',
            city: event.location.city || 'Unknown',
            eventCount: 0,
            eventTypes: {},
            severityLevels: { LOW: 0, MEDIUM: 0, HIGH: 0 }
          };
        }
        
        const loc = locations[locationKey];
        loc.eventCount++;
        loc.eventTypes[event.eventType] = (loc.eventTypes[event.eventType] || 0) + 1;
        loc.severityLevels[this.getEventSeverity(event)]++;
      }
    });
    
    return Object.values(locations);
  }

  /**
   * Analyze access patterns
   */
  static analyzeAccessPatterns(accessEvents) {
    const patterns = {
      byTimeOfDay: {},
      byDayOfWeek: {},
      byResource: {},
      successRate: 0
    };
    
    const totalRequests = accessEvents.length;
    const successfulRequests = accessEvents.filter(e => e.status === 'SUCCESS').length;
    
    patterns.successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    
    accessEvents.forEach(event => {
      const timestamp = new Date(event.timestamp);
      
      // By time of day
      const hour = timestamp.getHours();
      patterns.byTimeOfDay[hour] = (patterns.byTimeOfDay[hour] || 0) + 1;
      
      // By day of week
      const day = timestamp.getDay();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      patterns.byDayOfWeek[dayNames[day]] = (patterns.byDayOfWeek[dayNames[day]] || 0) + 1;
      
      // By resource
      if (event.resource?.id) {
        patterns.byResource[event.resource.id] = {
          name: event.resource.name,
          count: (patterns.byResource[event.resource.id]?.count || 0) + 1,
          successRate: 0 // Would be calculated separately
        };
      }
    });
    
    return patterns;
  }

  /**
   * Export visualization data
   */
  static async exportVisualizationData(type, options = {}) {
    let data;
    
    switch (type) {
      case 'timeline':
        data = await this.generateTimelineData(options);
        break;
      case 'heatmap':
        data = await this.generateHeatmapData(options);
        break;
      case 'user-activity':
        data = await this.generateUserActivityData(options);
        break;
      case 'compliance-metrics':
        data = await this.generateComplianceMetrics();
        break;
      case 'correlation':
        data = await this.generateCorrelationAnalysis(options);
        break;
      case 'geographic':
        data = await this.generateGeographicData(options);
        break;
      case 'access-patterns':
        data = await this.generateAccessPatternData(options);
        break;
      default:
        throw new Error(`Unsupported visualization type: ${type}`);
    }
    
    return JSON.stringify(data, null, 2);
  }
}

module.exports = AuditTrailVisualization;