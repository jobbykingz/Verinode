export interface CachePattern {
  id: string;
  key: string;
  pattern: string;
  frequency: number;
  accessTimes: Date[];
  avgResponseTime: number;
  size: number;
  ttl: number;
  priority: number;
  seasonal: boolean;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  lastUpdated: Date;
}

export interface AccessPattern {
  pattern: string;
  frequency: number;
  hourlyDistribution: number[];
  weeklyDistribution: number[];
  seasonalTrend: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none';
  correlation: number;
  prediction: {
    nextAccess: Date;
    confidence: number;
    probability: number;
  };
}

export interface CachePrediction {
  key: string;
  probability: number;
  nextAccess: Date;
  confidence: number;
  recommendedTTL: number;
  recommendedPriority: number;
  riskLevel: 'low' | 'medium' | 'high';
  strategy: 'cache' | 'bypass' | 'prefetch';
}

export interface CacheStrategy {
  name: string;
  algorithm: 'lru' | 'lfu' | 'arc' | '2q' | 'ml_adaptive';
  parameters: Record<string, any>;
  performance: {
    hitRate: number;
    avgResponseTime: number;
    memoryUsage: number;
    evictionRate: number;
  };
  confidence: number;
  lastEvaluated: Date;
}

export interface CacheOptimization {
  id: string;
  type: 'sizing' | 'eviction' | 'prefetch' | 'compression' | 'partitioning';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImpact: {
    hitRateImprovement: number;
    responseTimeImprovement: number;
    memorySavings: number;
  };
  implementation: {
    steps: string[];
    estimatedTime: number;
    rollbackPlan: string[];
  };
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface MLModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  trainingLoss: number;
  validationLoss: number;
  modelVersion: string;
  lastTrained: Date;
  trainingDataSize: number;
  validationDataSize: number;
}

export interface CacheAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  performance: {
    totalRequests: number;
    hitRate: number;
    missRate: number;
    avgResponseTime: number;
    peakMemoryUsage: number;
    errorRate: number;
  };
  patterns: {
    topPatterns: AccessPattern[];
    seasonalPatterns: AccessPattern[];
    anomalousPatterns: AccessPattern[];
  };
  predictions: {
    accuracy: number;
    totalPredictions: number;
    correctPredictions: number;
    modelPerformance: MLModelMetrics;
  };
  optimizations: {
    applied: CacheOptimization[];
    pending: CacheOptimization[];
    failed: CacheOptimization[];
  };
  recommendations: string[];
}

export interface CacheABTest {
  id: string;
  name: string;
  description: string;
  controlStrategy: CacheStrategy;
  testStrategy: CacheStrategy;
  trafficSplit: number;
  duration: number;
  startTime: Date;
  endTime?: Date;
  status: 'planned' | 'running' | 'completed' | 'failed';
  results?: {
    controlMetrics: CacheStrategy['performance'];
    testMetrics: CacheStrategy['performance'];
    significance: number;
    winner: 'control' | 'test' | 'inconclusive';
    confidence: number;
  };
}

export interface CacheWarmupPlan {
  id: string;
  name: string;
  patterns: CachePattern[];
  priority: number;
  estimatedTime: number;
  memoryRequirement: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  startTime?: Date;
  completedAt?: Date;
}

export interface CacheEvictionPolicy {
  name: string;
  algorithm: 'lru' | 'lfu' | 'arc' | '2q' | 'random' | 'ml_based';
  parameters: {
    threshold?: number;
    sampleSize?: number;
    agingFactor?: number;
    windowSize?: number;
  };
  performance: {
    evictionRate: number;
    hitRateAfterEviction: number;
    memoryRecovery: number;
  };
}

export interface CacheConfiguration {
  maxSize: number;
  currentSize: number;
  hitRateThreshold: number;
  responseTimeThreshold: number;
  memoryThreshold: number;
  evictionPolicy: CacheEvictionPolicy;
  warmupEnabled: boolean;
  predictionEnabled: boolean;
  optimizationEnabled: boolean;
  abTestingEnabled: boolean;
}

export interface CacheEvent {
  id: string;
  type: 'hit' | 'miss' | 'set' | 'delete' | 'eviction' | 'warming' | 'optimization';
  key: string;
  timestamp: Date;
  metadata: {
    size?: number;
    ttl?: number;
    responseTime?: number;
    strategy?: string;
    reason?: string;
  };
}

export interface CacheInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'optimization' | 'prediction';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  data: any;
  recommendations: string[];
  timestamp: Date;
  acknowledged: boolean;
}
