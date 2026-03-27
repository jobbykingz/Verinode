module.exports = {
  // IPFS Node Configuration
  ipfs: {
    // Connection settings
    host: process.env.IPFS_HOST || 'localhost',
    port: parseInt(process.env.IPFS_PORT) || 5001,
    protocol: process.env.IPFS_PROTOCOL || 'http',
    
    // Repository settings
    repo: process.env.IPFS_REPO || './ipfs-repo',
    
    // Network configuration
    config: {
      Addresses: {
        Swarm: [
          '/ip4/0.0.0.0/tcp/4001',
          '/ip4/0.0.0.0/udp/4001/quic',
          '/ip6/::/tcp/4001',
          '/ip6/::/udp/4001/quic'
        ],
        API: `/ip4/127.0.0.1/tcp/${process.env.IPFS_PORT || 5001}`,
        Gateway: '/ip4/127.0.0.1/tcp/8080'
      },
      
      // Swarm connection management
      Swarm: {
        ConnMgr: {
          HighWater: parseInt(process.env.IPFS_CONN_HIGH_WATER) || 1000,
          LowWater: parseInt(process.env.IPFS_CONN_LOW_WATER) || 100,
          GracePeriod: process.env.IPFS_CONN_GRACE_PERIOD || '20s'
        },
        
        // Bandwidth limits
        Bandwidth: {
          MaxInboundConnections: parseInt(process.env.IPFS_MAX_INBOUND) || 200,
          MaxOutboundConnections: parseInt(process.env.IPFS_MAX_OUTBOUND) || 100
        }
      },
      
      // Discovery settings
      Discovery: {
        MDNS: {
          Enabled: process.env.IPFS_MDNS_ENABLED !== 'false',
          Interval: process.env.IPFS_MDNS_INTERVAL || '10s'
        },
        
        DHT: {
          Enabled: process.env.IPFS_DHT_ENABLED !== 'false',
          Client: {
            RefreshInterval: process.env.IPFS_DHT_REFRESH || '1m'
          }
        }
      },
      
      // PubSub settings
      Pubsub: {
        Enabled: process.env.IPFS_PUBSUB_ENABLED === 'true',
        Router: process.env.IPFS_PUBSUB_ROUTER || 'floodsub',
        DisableSigning: process.env.IPFS_PUBSUB_NO_SIGNING === 'true'
      },
      
      // Gateway settings
      Gateway: {
        HTTPHeaders: {
          'Access-Control-Allow-Origin': process.env.IPFS_GATEWAY_CORS_ORIGIN || ['*'],
          'Access-Control-Allow-Methods': process.env.IPFS_GATEWAY_CORS_METHODS || ['GET', 'POST', 'OPTIONS']
        },
        
        RootRedirect: process.env.IPFS_GATEWAY_ROOT_REDIRECT || '',
        WriteRedirect: process.env.IPFS_GATEWAY_WRITE_REDIRECT || true,
        PathPrefixes: process.env.IPFS_GATEWAY_PATH_PREFIXES || ['/ipfs', '/ipns']
      },
      
      // API settings
      API: {
        HTTPHeaders: {
          'Access-Control-Allow-Origin': process.env.IPFS_API_CORS_ORIGIN || ['*'],
          'Access-Control-Allow-Methods': process.env.IPFS_API_CORS_METHODS || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        }
      },
      
      // Experimental features
      Experimental: {
        FilestoreEnabled: process.env.IPFS_FILESTORE_ENABLED === 'true',
        UrlstoreEnabled: process.env.IPFS_URLSTORE_ENABLED === 'true',
        ShardingEnabled: process.env.IPFS_SHARDING_ENABLED === 'true',
        GraphsyncEnabled: process.env.IPFS_GRAPHSYNC_ENABLED === 'true',
        P2pHttpProxy: process.env.IPFS_P2P_HTTP_PROXY === 'true'
      },
      
      // Datastore settings
      Datastore: {
        StorageMax: process.env.IPFS_STORAGE_MAX || '10GB',
        StorageGCWatermark: parseInt(process.env.IPFS_GC_WATERMARK) || 90,
        GCPeriod: process.env.IPFS_GC_PERIOD || '1h',
        
        // BadgerDB configuration
        BadgerFS: {
          SyncWrites: process.env.IPFS_BADGER_SYNC_WRITES !== 'false'
        }
      },
      
      // Plugin configuration
      Plugins: {
        Plugins: process.env.IPFS_PLUGINS ? process.env.IPFS_PLUGINS.split(',') : []
      }
    }
  },

  // Pinning Service Configuration
  pinning: {
    // Local pinning settings
    maxRetries: parseInt(process.env.PINNING_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.PINNING_RETRY_DELAY) || 5000,
    autoPinCritical: process.env.PINNING_AUTO_CRITICAL !== 'false',
    
    // Pinning strategies
    strategies: {
      immediate: {
        enabled: true,
        priority: 'high'
      },
      delayed: {
        enabled: true,
        delay: parseInt(process.env.PINNING_DELAY) || 30000,
        priority: 'normal'
      },
      conditional: {
        enabled: true,
        conditions: {
          maxFileSize: process.env.PINNING_MAX_FILE_SIZE || '100MB',
          minFileSize: process.env.PINNING_MIN_FILE_SIZE || '0',
          contentTypes: process.env.PINNING_CONTENT_TYPES ? 
            process.env.PINNING_CONTENT_TYPES.split(',') : []
        }
      },
      backup: {
        enabled: process.env.PINNING_BACKUP_ENABLED === 'true',
        services: process.env.PINNING_BACKUP_SERVICES ? 
          process.env.PINNING_BACKUP_SERVICES.split(',') : []
      }
    },
    
    // Queue settings
    queue: {
      maxSize: parseInt(process.env.PINNING_QUEUE_MAX_SIZE) || 1000,
      processingInterval: parseInt(process.env.PINNING_PROCESSING_INTERVAL) || 5000,
      batchSize: parseInt(process.env.PINNING_BATCH_SIZE) || 10
    }
  },

  // Gateway Service Configuration
  gateway: {
    port: parseInt(process.env.IPFS_GATEWAY_PORT) || 8080,
    host: process.env.IPFS_GATEWAY_HOST || '0.0.0.0',
    
    // CORS settings
    cors: {
      enabled: process.env.IPFS_GATEWAY_CORS !== 'false',
      allowedOrigins: process.env.IPFS_GATEWAY_ALLOWED_ORIGINS ? 
        process.env.IPFS_GATEWAY_ALLOWED_ORIGINS.split(',') : ['*'],
      allowedMethods: process.env.IPFS_GATEWAY_ALLOWED_METHODS ? 
        process.env.IPFS_GATEWAY_ALLOWED_METHODS.split(',') : ['GET', 'OPTIONS'],
      allowedHeaders: process.env.IPFS_GATEWAY_ALLOWED_HEADERS ? 
        process.env.IPFS_GATEWAY_ALLOWED_HEADERS.split(',') : ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Range']
    },
    
    // Rate limiting
    rateLimit: {
      enabled: process.env.IPFS_GATEWAY_RATE_LIMIT !== 'false',
      windowMs: parseInt(process.env.IPFS_GATEWAY_RATE_WINDOW) || 60000,
      maxRequests: parseInt(process.env.IPFS_GATEWAY_RATE_MAX) || 100
    },
    
    // Caching
    cache: {
      enabled: process.env.IPFS_GATEWAY_CACHE !== 'false',
      maxAge: parseInt(process.env.IPFS_GATEWAY_CACHE_MAX_AGE) || 3600000,
      maxSize: parseInt(process.env.IPFS_GATEWAY_CACHE_MAX_SIZE) || 1000
    },
    
    // Content limits
    limits: {
      maxContentSize: parseInt(process.env.IPFS_GATEWAY_MAX_SIZE) || 100 * 1024 * 1024, // 100MB
      timeout: parseInt(process.env.IPFS_GATEWAY_TIMEOUT) || 30000
    },
    
    // Features
    features: {
      directoryListing: process.env.IPFS_GATEWAY_DIR_LISTING !== 'false',
      ipnsResolution: process.env.IPFS_GATEWAY_IPNS !== 'false',
      contentNegotiation: process.env.IPFS_GATEWAY_CONTENT_NEG !== 'false'
    }
  },

  // IPNS Service Configuration
  ipns: {
    // Key management
    keyType: process.env.IPNS_KEY_TYPE || 'ed25519',
    recordLifetime: process.env.IPNS_RECORD_LIFETIME || '24h',
    
    // Resolution settings
    resolve: {
      timeout: parseInt(process.env.IPNS_RESOLVE_TIMEOUT) || 30000,
      nocache: process.env.IPNS_NOCACHE === 'true',
      recursive: process.env.IPNS_RECURSIVE === 'true'
    },
    
    // Publishing settings
    publish: {
      timeout: parseInt(process.env.IPNS_PUBLISH_TIMEOUT) || 60000,
      ttl: process.env.IPNS_TTL || '24h',
      resolve: process.env.IPNS_PUBLISH_RESOLVE !== 'false'
    },
    
    // Auto-refresh
    autoRefresh: {
      enabled: process.env.IPNS_AUTO_REFRESH === 'true',
      interval: parseInt(process.env.IPNS_REFRESH_INTERVAL) || 3600000, // 1 hour
      cleanupInterval: parseInt(process.env.IPNS_CLEANUP_INTERVAL) || 86400000 // 24 hours
    },
    
    // Record management
    records: {
      maxHistory: parseInt(process.env.IPNS_MAX_HISTORY) || 100,
      cacheTimeout: parseInt(process.env.IPNS_CACHE_TIMEOUT) || 300000 // 5 minutes
    }
  },

  // Content Verification Configuration
  verification: {
    // Algorithm settings
    algorithm: process.env.VERIFICATION_ALGORITHM || 'SHA256',
    algorithms: ['SHA256', 'SHA512', 'MD5'],
    
    // Performance settings
    timeout: parseInt(process.env.VERIFICATION_TIMEOUT) || 30000,
    maxRetries: parseInt(process.env.VERIFICATION_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.VERIFICATION_RETRY_DELAY) || 1000,
    
    // Batch processing
    batch: {
      concurrency: parseInt(process.env.VERIFICATION_BATCH_CONCURRENCY) || 5,
      maxBatchSize: parseInt(process.env.VERIFICATION_BATCH_MAX_SIZE) || 100
    },
    
    // Deep verification
    deepVerification: {
      enabled: process.env.VERIFICATION_DEEP === 'true',
      contentAnalysis: process.env.VERIFICATION_ANALYSIS === 'true',
      signatureVerification: process.env.VERIFICATION_SIGNATURE === 'true'
    },
    
    // Verification intervals
    intervals: {
      periodic: parseInt(process.env.VERIFICATION_PERIODIC_INTERVAL) || 86400000, // 24 hours
      critical: parseInt(process.env.VERIFICATION_CRITICAL_INTERVAL) || 3600000, // 1 hour
      failed: parseInt(process.env.VERIFICATION_FAILED_INTERVAL) || 300000 // 5 minutes
    }
  },

  // Backup Service Configuration
  backup: {
    enabled: process.env.IPFS_BACKUP_ENABLED === 'true',
    
    // Backup services
    services: {
      pinata: {
        enabled: !!(process.env.PINATA_API_KEY && process.env.PINATA_SECRET_API_KEY),
        apiKey: process.env.PINATA_API_KEY,
        secretApiKey: process.env.PINATA_SECRET_API_KEY,
        endpoint: 'https://api.pinata.cloud',
        timeout: parseInt(process.env.PINATA_TIMEOUT) || 30000
      },
      
      infura: {
        enabled: !!(process.env.INFURA_PROJECT_ID && process.env.INFURA_PROJECT_SECRET),
        projectId: process.env.INFURA_PROJECT_ID,
        projectSecret: process.env.INFURA_PROJECT_SECRET,
        endpoint: 'https://ipfs.infura.io:5001',
        timeout: parseInt(process.env.INFURA_TIMEOUT) || 30000
      },
      
      filebase: {
        enabled: !!(process.env.FILEBASE_ACCESS_KEY && process.env.FILEBASE_SECRET_KEY),
        accessKey: process.env.FILEBASE_ACCESS_KEY,
        secretKey: process.env.FILEBASE_SECRET_KEY,
        bucket: process.env.FILEBASE_BUCKET || 'verinode-backup',
        endpoint: process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com',
        timeout: parseInt(process.env.FILEBASE_TIMEOUT) || 30000
      }
    },
    
    // Backup strategy
    strategy: {
      mode: process.env.BACKUP_STRATEGY_MODE || 'immediate', // immediate, delayed, conditional
      delay: parseInt(process.env.BACKUP_STRATEGY_DELAY) || 60000,
      conditions: {
        minFileSize: process.env.BACKUP_MIN_FILE_SIZE || '1MB',
        contentTypes: process.env.BACKUP_CONTENT_TYPES ? 
          process.env.BACKUP_CONTENT_TYPES.split(',') : ['proof', 'document'],
        tags: process.env.BACKUP_REQUIRED_TAGS ? 
          process.env.BACKUP_REQUIRED_TAGS.split(',') : []
      }
    },
    
    // Redundancy settings
    redundancy: {
      minCopies: parseInt(process.env.BACKUP_MIN_COPIES) || 2,
      maxCopies: parseInt(process.env.BACKUP_MAX_COPIES) || 3,
      verifyIntegrity: process.env.BACKUP_VERIFY_INTEGRITY !== 'false',
      healthCheckInterval: parseInt(process.env.BACKUP_HEALTH_CHECK_INTERVAL) || 3600000 // 1 hour
    }
  },

  // Performance and Monitoring
  performance: {
    // Metrics collection
    metrics: {
      enabled: process.env.IPFS_METRICS_ENABLED !== 'false',
      interval: parseInt(process.env.IPFS_METRICS_INTERVAL) || 60000, // 1 minute
      retention: parseInt(process.env.IPFS_METRICS_RETENTION) || 86400000 // 24 hours
    },
    
    // Logging
    logging: {
      level: process.env.IPFS_LOG_LEVEL || 'info',
      file: process.env.IPFS_LOG_FILE || './logs/ipfs.log',
      maxSize: process.env.IPFS_LOG_MAX_SIZE || '100MB',
      maxFiles: parseInt(process.env.IPFS_LOG_MAX_FILES) || 5
    },
    
    // Health checks
    healthCheck: {
      enabled: process.env.IPFS_HEALTH_CHECK_ENABLED !== 'false',
      interval: parseInt(process.env.IPFS_HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
      timeout: parseInt(process.env.IPFS_HEALTH_CHECK_TIMEOUT) || 5000
    }
  },

  // Security Configuration
  security: {
    // Access control
    accessControl: {
      enabled: process.env.IPFS_ACCESS_CONTROL_ENABLED === 'true',
      defaultPolicy: process.env.IPFS_DEFAULT_POLICY || 'allow',
      rules: process.env.IPFS_ACCESS_RULES ? 
        JSON.parse(process.env.IPFS_ACCESS_RULES) : []
    },
    
    // Rate limiting
    rateLimiting: {
      enabled: process.env.IPFS_RATE_LIMITING_ENABLED !== 'false',
      globalLimit: parseInt(process.env.IPFS_GLOBAL_RATE_LIMIT) || 1000,
      perIPLimit: parseInt(process.env.IPFS_PER_IP_RATE_LIMIT) || 100,
      windowMs: parseInt(process.env.IPFS_RATE_WINDOW) || 60000
    },
    
    // Content filtering
    contentFiltering: {
      enabled: process.env.IPFS_CONTENT_FILTERING_ENABLED === 'true',
      blockedTypes: process.env.IPFS_BLOCKED_TYPES ? 
        process.env.IPFS_BLOCKED_TYPES.split(',') : [],
      maxFileSize: process.env.IPFS_MAX_FILE_SIZE || '1GB',
      scanForMalware: process.env.IPFS_MALWARE_SCAN === 'true'
    }
  },

  // Development and Testing
  development: {
    // Test mode
    testMode: process.env.NODE_ENV === 'test' || process.env.IPFS_TEST_MODE === 'true',
    
    // Mock services
    mockServices: process.env.IPFS_MOCK_SERVICES === 'true',
    
    // Debug settings
    debug: {
      enabled: process.env.IPFS_DEBUG === 'true',
      verboseLogging: process.env.IPFS_VERBOSE_LOGGING === 'true',
      saveDebugInfo: process.env.IPFS_SAVE_DEBUG === 'true'
    },
    
    // Test data
    testData: {
      autoGenerate: process.env.IPFS_AUTO_GENERATE_TEST_DATA === 'true',
      testDataPath: process.env.IPFS_TEST_DATA_PATH || './test-data',
      cleanupAfterTests: process.env.IPFS_CLEANUP_TESTS !== 'false'
    }
  }
};
