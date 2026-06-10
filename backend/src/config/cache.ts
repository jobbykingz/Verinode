export interface CacheConfig {
  // Redis Configuration
  redis: {
    cluster: {
      enabled: boolean;
      nodes: RedisNode[];
      options: RedisClusterOptions;
    };
    standalone: {
      host: string;
      port: number;
      password?: string;
      db: number;
    };
    connection: {
      maxRetriesPerRequest: number;
      retryDelayOnFailover: number;
      enableOfflineQueue: boolean;
      lazyConnect: boolean;
      keepAlive: boolean;
      connectTimeout: number;
      commandTimeout: number;
    };
  };

  // Cache Levels Configuration
  levels: {
    l1: {
      enabled: boolean;
      maxSize: number; // in MB
      ttl: number; // in seconds
      algorithm: 'LRU' | 'LFU' | 'FIFO' | 'LIFO';
      compressionEnabled: boolean;
      compressionThreshold: number; // in bytes
    };
    l2: {
      enabled: boolean;
      ttl: number; // in seconds
      maxMemory: string; // e.g., '256mb'
      keyPrefix: string;
      evictionPolicy: 'allkeys-lru' | 'allkeys-lfu' | 'volatile-lru' | 'volatile-lfu';
    };
  };

  // Cache Warming Configuration
  warming: {
    enabled: boolean;
    strategies: WarmingStrategy[];
    schedule: string; // cron expression
    batchSize: number;
    concurrency: number;
    priority: CachePriority[];
  };

  // Cache Invalidation Configuration
  invalidation: {
    strategies: InvalidationStrategy[];
    propagationDelay: number; // in milliseconds
    maxRetries: number;
    batchSize: number;
    eventQueueSize: number;
  };

  // Performance Configuration
  performance: {
    metricsEnabled: boolean;
    analyticsEnabled: boolean;
    hitRateThreshold: number; // minimum acceptable hit rate
    responseTimeThreshold: number; // in milliseconds
    optimizationInterval: number; // in seconds
    compressionLevel: number; // 0-9
    serializationFormat: 'json' | 'msgpack' | 'protobuf' | 'avro';
  };

  // Security Configuration
  security: {
    encryptionEnabled: boolean;
    encryptionKey: string;
    keyRotationInterval: number; // in hours
    accessControl: boolean;
    allowedOrigins: string[];
    rateLimiting: {
      enabled: boolean;
      maxRequestsPerSecond: number;
      burstSize: number;
    };
  };

  // Monitoring Configuration
  monitoring: {
    enabled: boolean;
    metricsInterval: number; // in seconds
    alerting: {
      enabled: boolean;
      thresholds: AlertThresholds;
      channels: AlertChannel[];
    };
    logging: {
      level: 'debug' | 'info' | 'warn' | 'error';
      slowQueryThreshold: number; // in milliseconds
      errorSampling: number; // 0-1
    };
  };
}

export interface RedisNode {
  host: string;
  port: number;
  password?: string;
  weight?: number;
  role?: 'master' | 'slave';
}

export interface RedisClusterOptions {
  redisOptions?: {
    password?: string;
    connectTimeout?: number;
    commandTimeout?: number;
    maxRetriesPerRequest?: number;
  };
  maxRedirections?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  scaleReads?: boolean;
}

export interface WarmingStrategy {
  name: string;
  type: 'precompute' | 'predictive' | 'scheduled' | 'event-driven';
  config: {
    dataSources: string[];
    priority: number;
    frequency: string;
    batchSize: number;
    conditions?: any[];
  };
}

export interface InvalidationStrategy {
  name: string;
  type: 'time-based' | 'event-driven' | 'dependency-based' | 'manual';
  config: {
    ttl?: number;
    dependencies?: string[];
    events?: string[];
    cascade?: boolean;
  };
}

export enum CachePriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  BACKGROUND = 'background',
}

export interface AlertThresholds {
  hitRate: number;
  memoryUsage: number;
  responseTime: number;
  errorRate: number;
  connectionCount: number;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: any;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  errors: number;
  avgResponseTime: number;
  memoryUsage: number;
  keyCount: number;
  hitRate: number;
  missRate: number;
  timestamp: Date;
}

export interface CacheAnalytics {
  topKeys: Array<{
    key: string;
    hits: number;
    size: number;
    ttl: number;
  }>;
  patterns: {
    access: Array<{
      pattern: string;
      frequency: number;
      avgResponseTime: number;
    }>;
    errors: Array<{
      type: string;
      count: number;
      lastOccurred: Date;
    }>;
  };
  performance: {
    avgHitRate: number;
    avgResponseTime: number;
    peakMemoryUsage: number;
    optimizationSuggestions: string[];
  };
}

export interface AlertThresholds {
  hitRate: number;
  memoryUsage: number;
  responseTime: number;
  errorRate: number;
  connectionCount: number;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: any;
}

export interface PerformanceAlert {
  id: string;
  type: 'hit_rate' | 'response_time' | 'memory_usage' | 'error_rate' | 'connection_count';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
}

export interface OptimizationSuggestion {
  type: 'cache_size' | 'ttl_adjustment' | 'compression' | 'serialization' | 'eviction_policy';
  priority: 'low' | 'medium' | 'high';
  description: string;
  expectedImprovement: string;
  implementation: string;
}

export const defaultCacheConfig: CacheConfig = {
  redis: {
    cluster: {
      enabled: false,
      nodes: [{ host: 'localhost', port: 6379 }],
      options: {
        redisOptions: {
          connectTimeout: 10000,
          commandTimeout: 5000,
          maxRetriesPerRequest: 3,
        },
        maxRedirections: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        scaleReads: false,
      },
    },
    standalone: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    },
    connection: {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      lazyConnect: true,
      keepAlive: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
    },
  },
  levels: {
    l1: {
      enabled: true,
      maxSize: 256, // 256MB
      ttl: 300, // 5 minutes
      algorithm: 'LRU',
      compressionEnabled: true,
      compressionThreshold: 1024, // 1KB
    },
    l2: {
      enabled: true,
      ttl: 3600, // 1 hour
      maxMemory: '512mb',
      keyPrefix: 'verinode:',
      evictionPolicy: 'allkeys-lru',
    },
  },
  warming: {
    enabled: true,
    strategies: [
      {
        name: 'user-profiles',
        type: 'predictive',
        config: {
          dataSources: ['user_profiles', 'user_preferences'],
          priority: 1,
          frequency: '0 */5 * * * *', // every 5 minutes
          batchSize: 100,
        },
      },
      {
        name: 'popular-proofs',
        type: 'precompute',
        config: {
          dataSources: ['proofs', 'proof_metadata'],
          priority: 2,
          frequency: '0 */15 * * * *', // every 15 minutes
          batchSize: 50,
        },
      },
    ],
    schedule: '0 */10 * * * *', // every 10 minutes
    batchSize: 100,
    concurrency: 5,
    priority: [CachePriority.CRITICAL, CachePriority.HIGH],
  },
  invalidation: {
    strategies: [
      {
        name: 'time-based',
        type: 'time-based',
        config: {
          ttl: 3600,
        },
      },
      {
        name: 'event-driven',
        type: 'event-driven',
        config: {
          events: ['proof_updated', 'user_modified', 'proof_revoked'],
          cascade: true,
        },
      },
    ],
    propagationDelay: 100,
    maxRetries: 3,
    batchSize: 50,
    eventQueueSize: 1000,
  },
  performance: {
    metricsEnabled: true,
    analyticsEnabled: true,
    hitRateThreshold: 0.8, // 80%
    responseTimeThreshold: 100, // 100ms
    optimizationInterval: 300, // 5 minutes
    compressionLevel: 6,
    serializationFormat: 'json',
  },
  security: {
    encryptionEnabled: false,
    encryptionKey: process.env.CACHE_ENCRYPTION_KEY || '',
    keyRotationInterval: 24,
    accessControl: true,
    allowedOrigins: ['http://localhost:3000'],
    rateLimiting: {
      enabled: true,
      maxRequestsPerSecond: 1000,
      burstSize: 100,
    },
  },
  monitoring: {
    enabled: true,
    metricsInterval: 60, // 1 minute
    alerting: {
      enabled: true,
      thresholds: {
        hitRate: 0.7,
        memoryUsage: 0.9,
        responseTime: 200,
        errorRate: 0.05,
        connectionCount: 100,
      },
      channels: [{ type: 'webhook', config: { url: process.env.WEBHOOK_URL } }],
    },
    logging: {
      level: 'info',
      slowQueryThreshold: 100,
      errorSampling: 0.1,
    },
  },
};
