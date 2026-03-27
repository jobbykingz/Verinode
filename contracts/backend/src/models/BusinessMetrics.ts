export interface BusinessMetrics {
  totalUsers: number;
  activeUsers: number;
  totalProofs: number;
  verifiedProofs: number;
  failedProofs: number;
  averageResponseTime: number;
  systemUptime: number;
  errorRate: number;
  revenue: number;
  costs: number;
  profit: number;
  userGrowthRate: number;
  proofGrowthRate: number;
  retentionRate: number;
  churnRate: number;
  customerAcquisitionCost: number;
  lifetimeValue: number;
  monthlyActiveUsers: number;
  dailyActiveUsers: number;
  bounceRate: number;
  conversionRate: number;
  averageSessionDuration: number;
  pageViews: number;
  uniqueVisitors: number;
  newUsers: number;
  returningUsers: number;
  topFeatures: FeatureUsage[];
  userSegments: UserSegment[];
  performanceBottlenecks: PerformanceBottleneck[];
}

export interface FeatureUsage {
  featureName: string;
  usageCount: number;
  uniqueUsers: number;
  averageTimeSpent: number;
  adoptionRate: number;
}

export interface UserSegment {
  segmentName: string;
  userCount: number;
  characteristics: string[];
  behavior: UserBehavior;
  value: number;
}

export interface UserBehavior {
  loginFrequency: number;
  proofCreationRate: number;
  verificationRate: number;
  featureUsage: Record<string, number>;
  sessionDuration: number;
  lastActivity: Date;
}

export interface PerformanceBottleneck {
  area: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  recommendations: string[];
  affectedUsers: number;
  frequency: number;
}

export interface UsageTrend {
  date: Date;
  metric: string;
  value: number;
  change: number;
  changePercent: number;
  forecast?: number;
}

export interface PredictiveModel {
  metric: string;
  predictions: Prediction[];
  confidence: number;
  accuracy: number;
  modelType: string;
  lastTrained: Date;
}

export interface Prediction {
  date: Date;
  value: number;
  confidence: number;
  range: {
    lower: number;
    upper: number;
  };
}

export interface CustomReport {
  id: string;
  name: string;
  description: string;
  metrics: string[];
  timeframe: string;
  filters: ReportFilter[];
  data: ReportData[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface ReportData {
  timestamp: Date;
  metrics: Record<string, number>;
  dimensions: Record<string, any>;
}

export interface DataVisualization {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge' | 'funnel';
  title: string;
  data: any[];
  config: VisualizationConfig;
  interactive: boolean;
  realtime: boolean;
}

export interface VisualizationConfig {
  xAxis?: string;
  yAxis?: string;
  colorScheme?: string[];
  legend?: boolean;
  grid?: boolean;
  tooltips?: boolean;
  animations?: boolean;
  responsive?: boolean;
  filters?: string[];
  drilldown?: boolean;
}

export interface AnalyticsEvent {
  id: string;
  userId?: string;
  sessionId: string;
  eventType: string;
  eventName: string;
  properties: Record<string, any>;
  timestamp: Date;
  userAgent: string;
  ipAddress: string;
  location?: {
    country: string;
    city: string;
    coordinates: [number, number];
  };
  device?: {
    type: 'desktop' | 'mobile' | 'tablet';
    os: string;
    browser: string;
  };
}

export interface KPIDashboard {
  id: string;
  name: string;
  description: string;
  kpis: KPI[];
  timeframe: string;
  refreshInterval: number;
  lastUpdated: Date;
  widgets: DashboardWidget[];
}

export interface KPI {
  id: string;
  name: string;
  value: number;
  target?: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
  changePercent: number;
  status: 'good' | 'warning' | 'critical';
  threshold?: {
    good: number;
    warning: number;
    critical: number;
  };
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'text';
  title: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: any;
  data: any;
}
