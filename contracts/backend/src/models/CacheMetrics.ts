export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalRequests: number;
  averageResponseTime: number;
  memoryUsage: number;
  lastUpdated: Date;
}

export interface CacheHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  redisConnected: boolean;
  responseTime: number;
  errorRate: number;
  uptime: number;
}

export interface CachePerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  metrics: CacheMetrics;
  health: CacheHealth;
  topKeys: Array<{
    key: string;
    hits: number;
    size: number;
  }>;
  recommendations: string[];
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  evictionPolicy: 'LRU' | 'LFU' | 'RANDOM';
  compression: boolean;
  clustering: boolean;
  persistence: boolean;
}

export interface CacheEntry {
  key: string;
  value: any;
  ttl: number;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  size: number;
  tags: string[];
}

export interface CacheAnalytics {
  dailyStats: Array<{
    date: string;
    hits: number;
    misses: number;
    hitRate: number;
  }>;
  hourlyStats: Array<{
    hour: number;
    hits: number;
    misses: number;
    hitRate: number;
  }>;
  keyPatterns: Array<{
    pattern: string;
    count: number;
    hitRate: number;
  }>;
  tagPerformance: Array<{
    tag: string;
    hits: number;
    invalidations: number;
    hitRate: number;
  }>;
}

export interface CacheAlert {
  id: string;
  type: 'hit_rate_low' | 'memory_high' | 'error_rate_high' | 'connection_lost';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}
