import { CustomReport, ReportFilter, ReportData } from '../models/BusinessMetrics';

export class ReportBuilder {
  
  async createCustomReport(config: {
    name: string;
    description: string;
    metrics: string[];
    timeframe: string;
    filters: ReportFilter[];
    visualization: {
      type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge' | 'funnel';
      config: any;
    };
  }): Promise<CustomReport> {
    const report: CustomReport = {
      id: `report_${Date.now()}`,
      name: config.name,
      description: config.description,
      metrics: config.metrics,
      timeframe: config.timeframe,
      filters: config.filters,
      data: await this.generateReportData(config.metrics, config.timeframe, config.filters),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system'
    };

    return report;
  }

  async getReportTemplates(): Promise<{
    category: string;
    templates: {
      id: string;
      name: string;
      description: string;
      metrics: string[];
      timeframe: string;
      visualization: string;
    }[];
  }[]> {
    return [
      {
        category: 'Business Overview',
        templates: [
          {
            id: 'executive_dashboard',
            name: 'Executive Dashboard',
            description: 'High-level business metrics for executive reporting',
            metrics: ['total_users', 'revenue', 'proofs_verified', 'system_uptime'],
            timeframe: '30d',
            visualization: 'gauge'
          },
          {
            id: 'growth_analysis',
            name: 'Growth Analysis',
            description: 'User and revenue growth trends over time',
            metrics: ['user_growth_rate', 'revenue_growth', 'retention_rate'],
            timeframe: '90d',
            visualization: 'line'
          }
        ]
      },
      {
        category: 'User Analytics',
        templates: [
          {
            id: 'user_behavior',
            name: 'User Behavior Report',
            description: 'Detailed user engagement and behavior patterns',
            metrics: ['daily_active_users', 'session_duration', 'feature_usage', 'conversion_rate'],
            timeframe: '30d',
            visualization: 'bar'
          },
          {
            id: 'retention_analysis',
            name: 'Retention Analysis',
            description: 'User retention and churn analysis',
            metrics: ['retention_rate', 'churn_rate', 'cohort_analysis'],
            timeframe: '180d',
            visualization: 'line'
          }
        ]
      },
      {
        category: 'Performance',
        templates: [
          {
            id: 'system_performance',
            name: 'System Performance',
            description: 'Infrastructure and application performance metrics',
            metrics: ['response_time', 'error_rate', 'cpu_usage', 'memory_usage'],
            timeframe: '24h',
            visualization: 'heatmap'
          },
          {
            id: 'api_performance',
            name: 'API Performance',
            description: 'API endpoint performance and usage statistics',
            metrics: ['api_response_time', 'request_volume', 'error_rate', 'cache_hit_rate'],
            timeframe: '7d',
            visualization: 'scatter'
          }
        ]
      }
    ];
  }

  async scheduleReport(config: {
    reportId: string;
    schedule: 'hourly' | 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    format: 'pdf' | 'excel' | 'csv';
    filters?: ReportFilter[];
  }): Promise<{
    id: string;
    reportId: string;
    schedule: string;
    nextRun: Date;
    recipients: string[];
    status: 'active' | 'paused' | 'error';
  }> {
    const scheduledReport = {
      id: `schedule_${Date.now()}`,
      reportId: config.reportId,
      schedule: config.schedule,
      nextRun: this.calculateNextRun(config.schedule),
      recipients: config.recipients,
      status: 'active' as const
    };

    return scheduledReport;
  }

  async exportReport(reportId: string, format: 'pdf' | 'excel' | 'csv'): Promise<{
    downloadUrl: string;
    filename: string;
    size: number;
    expiresAt: Date;
  }> {
    // Mock implementation - would generate actual file
    const filename = `report_${reportId}_${Date.now()}.${format}`;
    const size = Math.floor(Math.random() * 1000000) + 100000; // Random size between 100KB - 1MB
    
    return {
      downloadUrl: `/api/reports/download/${filename}`,
      filename,
      size,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    };
  }

  async getReportHistory(reportId: string): Promise<{
    id: string;
    generatedAt: Date;
    format: string;
    size: number;
    generatedBy: string;
    downloadUrl: string;
  }[]> {
    const history = [];
    
    for (let i = 0; i < 10; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      history.push({
        id: `history_${reportId}_${i}`,
        generatedAt: date,
        format: ['pdf', 'excel', 'csv'][Math.floor(Math.random() * 3)],
        size: Math.floor(Math.random() * 1000000) + 100000,
        generatedBy: ['system', 'user_123', 'admin'][Math.floor(Math.random() * 3)],
        downloadUrl: `/api/reports/download/history_${reportId}_${i}`
      });
    }
    
    return history;
  }

  async shareReport(reportId: string, config: {
    recipients: string[];
    permissions: ('view' | 'edit' | 'share')[];
    expiresAt?: Date;
    message?: string;
  }): Promise<{
    shareId: string;
    shareUrl: string;
    expiresAt: Date;
    permissions: string[];
  }> {
    const shareId = `share_${Date.now()}`;
    const expiresAt = config.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default
    
    return {
      shareId,
      shareUrl: `/analytics/reports/shared/${shareId}`,
      expiresAt,
      permissions: config.permissions
    };
  }

  async getReportMetrics(reportId: string): Promise<{
    views: number;
    downloads: number;
    shares: number;
    lastViewed: Date;
    averageViewTime: number;
    popularSections: { section: string; views: number }[];
  }> {
    return {
      views: Math.floor(Math.random() * 1000) + 100,
      downloads: Math.floor(Math.random() * 100) + 10,
      shares: Math.floor(Math.random() * 50) + 5,
      lastViewed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      averageViewTime: Math.floor(Math.random() * 300) + 60, // 1-5 minutes
      popularSections: [
        { section: 'Overview', views: 450 },
        { section: 'User Analytics', views: 320 },
        { section: 'Performance Metrics', views: 280 },
        { section: 'Trends', views: 195 }
      ]
    };
  }

  private async generateReportData(
    metrics: string[], 
    timeframe: string, 
    filters: ReportFilter[]
  ): Promise<ReportData[]> {
    const data: ReportData[] = [];
    const days = parseInt(timeframe) || 30;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const dataPoint: ReportData = {
        timestamp: date,
        metrics: {},
        dimensions: {}
      };
      
      // Generate mock data for each requested metric
      metrics.forEach(metric => {
        switch (metric) {
          case 'total_users':
            dataPoint.metrics[metric] = Math.floor(Math.random() * 1000) + 15000;
            break;
          case 'daily_active_users':
            dataPoint.metrics[metric] = Math.floor(Math.random() * 500) + 1000;
            break;
          case 'revenue':
            dataPoint.metrics[metric] = Math.floor(Math.random() * 10000) + 50000;
            break;
          case 'proofs_verified':
            dataPoint.metrics[metric] = Math.floor(Math.random() * 2000) + 40000;
            break;
          case 'response_time':
            dataPoint.metrics[metric] = Math.floor(Math.random() * 100) + 200;
            break;
          case 'error_rate':
            dataPoint.metrics[metric] = Math.random() * 5;
            break;
          default:
            dataPoint.metrics[metric] = Math.floor(Math.random() * 1000);
        }
      });
      
      // Apply filters to dimensions
      if (filters.length > 0) {
        filters.forEach(filter => {
          dataPoint.dimensions[filter.field] = filter.value;
        });
      }
      
      data.push(dataPoint);
    }
    
    return data;
  }

  private calculateNextRun(schedule: 'hourly' | 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    
    switch (schedule) {
      case 'hourly':
        now.setHours(now.getHours() + 1);
        now.setMinutes(0, 0, 0);
        break;
      case 'daily':
        now.setDate(now.getDate() + 1);
        now.setHours(9, 0, 0, 0); // 9 AM next day
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        now.setHours(9, 0, 0, 0); // 9 AM next week
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        now.setDate(1);
        now.setHours(9, 0, 0, 0); // 9 AM first day of next month
        break;
    }
    
    return now;
  }
}
