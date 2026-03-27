const mongoose = require('mongoose');
const ConnectionPool = require('../services/connectionPool');
const QueryCache = require('../middleware/queryCache');
const QueryOptimizer = require('../services/queryOptimizer');
const DatabaseIndexer = require('../services/databaseIndexer');

// Optimized database configuration for Verinode
const databaseConfig = {
  // MongoDB connection options
  connection: {
    // URI construction
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/verinode',
    
    // Connection pool settings
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 50,
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 5,
    maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000,
    
    // Connection timeout settings
    serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 10000,
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
    connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 30000,
    
    // Retry settings
    retryWrites: true,
    retryReads: true,
    
    // Read preferences
    readPreference: process.env.DB_READ_PREFERENCE || 'secondaryPreferred',
    readConcern: {
      level: process.env.DB_READ_CONCERN || 'majority'
    },
    
    // Write concerns
    writeConcern: {
      w: process.env.DB_WRITE_CONCERN || 'majority',
      j: true,
      wtimeout: 5000
    },
    
    // Compression
    compressors: ['snappy', 'zlib'],
    
    // Monitoring
    monitorCommands: process.env.NODE_ENV === 'development'
  },

  // Query optimization settings
  optimization: {
    // Enable automatic query optimization
    enableAutoOptimization: process.env.DB_AUTO_OPTIMIZE !== 'false',
    
    // Slow query threshold (milliseconds)
    slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD) || 1000,
    
    // Enable automatic index creation
    enableAutoIndexing: process.env.DB_AUTO_INDEX !== 'false',
    
    // Query analysis settings
    enableQueryAnalysis: process.env.DB_QUERY_ANALYSIS !== 'false',
    
    // Performance monitoring
    enablePerformanceMonitoring: process.env.DB_PERFORMANCE_MONITORING !== 'false'
  },

  // Caching configuration
  cache: {
    // Enable query result caching
    enabled: process.env.DB_CACHE_ENABLED !== 'false',
    
    // Cache settings
    maxSize: parseInt(process.env.DB_CACHE_MAX_SIZE) || 1000,
    ttl: parseInt(process.env.DB_CACHE_TTL) || 300000, // 5 minutes
    maxSizeBytes: parseInt(process.env.DB_CACHE_MAX_BYTES) || 100 * 1024 * 1024, // 100MB
    
    // Compression
    enableCompression: process.env.DB_CACHE_COMPRESSION !== 'false',
    compressionThreshold: parseInt(process.env.DB_CACHE_COMPRESSION_THRESHOLD) || 1024,
    
    // Cleanup
    cleanupInterval: parseInt(process.env.DB_CACHE_CLEANUP_INTERVAL) || 60000
  },

  // Indexing configuration
  indexing: {
    // Enable automatic index management
    enableAutoManagement: process.env.DB_AUTO_INDEX_MANAGEMENT !== 'false',
    
    // Index analysis interval (milliseconds)
    analysisInterval: parseInt(process.env.DB_INDEX_ANALYSIS_INTERVAL) || 3600000, // 1 hour
    
    // Unused index cleanup
    enableUnusedIndexCleanup: process.env.DB_UNUSED_INDEX_CLEANUP !== 'false',
    unusedIndexThreshold: parseInt(process.env.DB_UNUSED_INDEX_THRESHOLD) || 30, // days
    
    // Index creation options
    backgroundIndexing: process.env.DB_BACKGROUND_INDEXING !== 'false',
    indexBuildTimeout: parseInt(process.env.DB_INDEX_BUILD_TIMEOUT) || 300000 // 5 minutes
  },

  // Sharding and partitioning
  sharding: {
    // Enable sharding for large collections
    enabled: process.env.DB_SHARDING_ENABLED === 'true',
    
    // Shard key configuration
    shardKeys: {
      ipfscontents: 'cid',
      auditlogs: 'timestamp',
      performancemetrics: 'timestamp',
      customtemplates: 'createdBy',
      searchhistory: 'userId'
    },
    
    // Chunk size (MB)
    chunkSize: parseInt(process.env.DB_CHUNK_SIZE) || 32,
    
    // Auto-splitting
    enableAutoSplit: process.env.DB_AUTO_SPLIT !== 'false'
  }
};

class DatabaseManager {
  constructor() {
    this.connectionPool = null;
    this.queryCache = null;
    this.queryOptimizer = null;
    this.databaseIndexer = null;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Initialize database connection and services
   */
  async initialize() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._initialize();
    return this.connectionPromise;
  }

  async _initialize() {
    try {
      console.log('Initializing optimized database connection...');
      
      // Initialize connection pool
      if (databaseConfig.connection.maxPoolSize > 0) {
        this.connectionPool = new ConnectionPool({
          minConnections: databaseConfig.connection.minPoolSize,
          maxConnections: databaseConfig.connection.maxPoolSize,
          maxIdleTime: databaseConfig.connection.maxIdleTimeMS,
          acquireTimeout: databaseConfig.connection.serverSelectionTimeoutMS
        });
      }

      // Connect to MongoDB with optimized settings
      await mongoose.connect(databaseConfig.connection.uri, {
        maxPoolSize: databaseConfig.connection.maxPoolSize,
        minPoolSize: databaseConfig.connection.minPoolSize,
        maxIdleTimeMS: databaseConfig.connection.maxIdleTimeMS,
        serverSelectionTimeoutMS: databaseConfig.connection.serverSelectionTimeoutMS,
        socketTimeoutMS: databaseConfig.connection.socketTimeoutMS,
        connectTimeoutMS: databaseConfig.connection.connectTimeoutMS,
        retryWrites: databaseConfig.connection.retryWrites,
        retryReads: databaseConfig.connection.retryReads,
        readPreference: databaseConfig.connection.readPreference,
        readConcern: databaseConfig.connection.readConcern,
        writeConcern: databaseConfig.connection.writeConcern,
        compressors: databaseConfig.connection.compressors,
        monitorCommands: databaseConfig.connection.monitorCommands
      });

      // Initialize query cache
      if (databaseConfig.cache.enabled) {
        this.queryCache = new QueryCache({
          maxSize: databaseConfig.cache.maxSize,
          ttl: databaseConfig.cache.ttl,
          maxSizeBytes: databaseConfig.cache.maxSizeBytes,
          enableCompression: databaseConfig.cache.enableCompression,
          compressionThreshold: databaseConfig.cache.compressionThreshold,
          cleanupInterval: databaseConfig.cache.cleanupInterval
        });
      }

      // Initialize query optimizer
      if (databaseConfig.optimization.enableAutoOptimization) {
        this.queryOptimizer = new QueryOptimizer();
      }

      // Initialize database indexer
      if (databaseConfig.indexing.enableAutoManagement) {
        this.databaseIndexer = new DatabaseIndexer();
        
        // Start periodic index analysis
        this.startIndexAnalysis();
      }

      this.isConnected = true;
      
      // Set up event listeners
      this.setupEventListeners();
      
      console.log('Database connection initialized successfully');
      console.log(`Connection pool: ${this.connectionPool ? 'Enabled' : 'Disabled'}`);
      console.log(`Query cache: ${this.queryCache ? 'Enabled' : 'Disabled'}`);
      console.log(`Query optimizer: ${this.queryOptimizer ? 'Enabled' : 'Disabled'}`);
      console.log(`Database indexer: ${this.databaseIndexer ? 'Enabled' : 'Disabled'}`);
      
      return true;
      
    } catch (error) {
      console.error('Database initialization failed:', error);
      this.connectionPromise = null;
      throw error;
    }
  }

  /**
   * Set up database event listeners
   */
  setupEventListeners() {
    const db = mongoose.connection;

    db.on('connected', () => {
      console.log('MongoDB connected');
      this.isConnected = true;
    });

    db.on('error', (error) => {
      console.error('MongoDB connection error:', error);
      this.isConnected = false;
    });

    db.on('disconnected', () => {
      console.log('MongoDB disconnected');
      this.isConnected = false;
    });

    db.on('reconnected', () => {
      console.log('MongoDB reconnected');
      this.isConnected = true;
    });

    // Monitor slow queries
    if (databaseConfig.optimization.enablePerformanceMonitoring) {
      mongoose.set('debug', (collectionName, method, query, doc) => {
        // This would be integrated with the performance monitoring system
        console.log(`MongoDB Debug: ${collectionName}.${method}`, JSON.stringify(query));
      });
    }
  }

  /**
   * Start periodic index analysis
   */
  startIndexAnalysis() {
    if (!this.databaseIndexer) return;

    setInterval(async () => {
      try {
        if (this.isConnected) {
          await this.analyzeAndOptimizeIndexes();
        }
      } catch (error) {
        console.error('Index analysis failed:', error);
      }
    }, databaseConfig.indexing.analysisInterval);
  }

  /**
   * Analyze and optimize indexes
   */
  async analyzeAndOptimizeIndexes() {
    if (!this.databaseIndexer) return;

    const collections = ['ipfscontents', 'customtemplates', 'auditlogs', 'compliancereports'];
    
    for (const collection of collections) {
      try {
        const analysis = await this.databaseIndexer.analyzeCollectionIndexes(collection);
        
        // Apply high-priority index recommendations automatically
        const highPriorityRecommendations = analysis.recommendations.filter(
          rec => rec.priority === 'high'
        );
        
        if (highPriorityRecommendations.length > 0) {
          console.log(`Applying ${highPriorityRecommendations.length} high-priority index recommendations for ${collection}`);
          
          const results = await this.databaseIndexer.createIndexes(
            collection, 
            highPriorityRecommendations,
            { autoApply: true }
          );
          
          console.log(`Index creation results for ${collection}:`, {
            successful: results.successful.length,
            failed: results.failed.length,
            skipped: results.skipped.length
          });
        }
        
      } catch (error) {
        console.error(`Failed to analyze indexes for ${collection}:`, error);
      }
    }
  }

  /**
   * Execute query with optimization and caching
   */
  async executeQuery(model, query, options = {}) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const collection = model.collection.name;
    const startTime = Date.now();
    
    try {
      // Check cache first
      if (this.queryCache && options.cache !== false) {
        const cachedResult = await this.queryCache.get(query, collection, options);
        if (cachedResult) {
          return cachedResult;
        }
      }

      // Optimize query if enabled
      let optimizedQuery = query;
      if (this.queryOptimizer && options.optimize !== false) {
        const optimization = await this.queryOptimizer.applyAutoOptimizations(query, collection, model);
        optimizedQuery = optimization.optimizedQuery;
        
        if (optimization.appliedOptimizations.length > 0) {
          console.log(`Applied ${optimization.appliedOptimizations.length} optimizations to query on ${collection}`);
        }
      }

      // Execute query
      let result;
      if (options.aggregate) {
        result = await model.aggregate(optimizedQuery).allowDiskUse(true);
      } else {
        result = await model.find(optimizedQuery, options.projection)
          .sort(options.sort || {})
          .limit(options.limit)
          .skip(options.skip)
          .lean(options.lean !== false);
      }

      // Cache result if enabled
      if (this.queryCache && options.cache !== false) {
        await this.queryCache.set(query, collection, result, {
          ttl: options.cacheTTL
        });
      }

      // Log performance metrics
      const executionTime = Date.now() - startTime;
      if (databaseConfig.optimization.enablePerformanceMonitoring) {
        await this.logQueryMetrics(query, collection, executionTime, result);
      }

      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Log error metrics
      if (databaseConfig.optimization.enablePerformanceMonitoring) {
        await this.logQueryMetrics(query, collection, executionTime, null, error);
      }
      
      throw error;
    }
  }

  /**
   * Log query performance metrics
   */
  async logQueryMetrics(query, collection, executionTime, result, error = null) {
    try {
      const PerformanceMetrics = require('../models/PerformanceMetrics');
      
      await PerformanceMetrics.create({
        queryHash: require('crypto').createHash('md5')
          .update(JSON.stringify(query)).digest('hex').substring(0, 16),
        queryText: JSON.stringify(query),
        executionTime,
        databaseName: mongoose.connection.name,
        collectionName: collection,
        documentsScanned: result ? result.length : 0,
        documentsReturned: result ? result.length : 0,
        slowQuery: executionTime > databaseConfig.optimization.slowQueryThreshold,
        cacheHit: false, // This would be set to true if served from cache
        error: error ? error.message : null,
        stackTrace: error ? error.stack : null
      });
    } catch (metricsError) {
      // Don't let metrics logging errors break the main flow
      console.warn('Failed to log query metrics:', metricsError.message);
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus() {
    const status = {
      connected: this.isConnected,
      mongoose: mongoose.connection.readyState === 1,
      services: {
        connectionPool: !!this.connectionPool,
        queryCache: !!this.queryCache,
        queryOptimizer: !!this.queryOptimizer,
        databaseIndexer: !!this.databaseIndexer
      },
      stats: {}
    };

    // Add connection pool stats
    if (this.connectionPool) {
      status.stats.connectionPool = this.connectionPool.getStats();
    }

    // Add cache stats
    if (this.queryCache) {
      status.stats.queryCache = this.queryCache.getStats();
    }

    // Add indexing stats
    if (this.databaseIndexer) {
      status.stats.indexing = await this.databaseIndexer.getIndexingStats();
    }

    return status;
  }

  /**
   * Gracefully shutdown database connections
   */
  async shutdown() {
    console.log('Shutting down database connections...');
    
    try {
      // Stop index analysis
      if (this.indexAnalysisTimer) {
        clearInterval(this.indexAnalysisTimer);
      }

      // Shutdown query cache
      if (this.queryCache) {
        this.queryCache.shutdown();
      }

      // Shutdown connection pool
      if (this.connectionPool) {
        await this.connectionPool.shutdown();
      }

      // Close mongoose connection
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }

      this.isConnected = false;
      console.log('Database shutdown complete');
      
    } catch (error) {
      console.error('Error during database shutdown:', error);
      throw error;
    }
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Export configuration and manager
module.exports = {
  config: databaseConfig,
  manager: databaseManager,
  
  // Convenience methods
  connect: () => databaseManager.initialize(),
  disconnect: () => databaseManager.shutdown(),
  getHealth: () => databaseManager.getHealthStatus(),
  executeQuery: (model, query, options) => databaseManager.executeQuery(model, query, options)
};
