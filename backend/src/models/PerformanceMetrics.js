const mongoose = require('mongoose');

const performanceMetricsSchema = new mongoose.Schema({
  // Query performance metrics
  queryHash: {
    type: String,
    required: true,
    index: true
  },
  
  queryText: {
    type: String,
    required: true
  },
  
  executionTime: {
    type: Number,
    required: true,
    min: 0
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Database connection metrics
  connectionId: {
    type: String,
    required: true
  },
  
  databaseName: {
    type: String,
    required: true,
    index: true
  },
  
  collectionName: {
    type: String,
    required: true,
    index: true
  },
  
  // Query analysis metrics
  documentsScanned: {
    type: Number,
    default: 0,
    min: 0
  },
  
  documentsReturned: {
    type: Number,
    default: 0,
    min: 0
  },
  
  indexesUsed: [{
    name: String,
    fields: [String]
  }],
  
  // Cache metrics
  cacheHit: {
    type: Boolean,
    default: false,
    index: true
  },
  
  cacheKey: {
    type: String
  },
  
  // Performance optimization metrics
  slowQuery: {
    type: Boolean,
    default: false,
    index: true
  },
  
  optimizationApplied: {
    type: String,
    enum: ['none', 'index_added', 'query_rewritten', 'cached', 'partitioned'],
    default: 'none'
  },
  
  // System metrics
  memoryUsage: {
    type: Number,
    default: 0
  },
  
  cpuUsage: {
    type: Number,
    default: 0
  },
  
  // Error metrics
  error: {
    type: String
  },
  
  stackTrace: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'performance_metrics'
});

// Indexes for performance monitoring
performanceMetricsSchema.index({ queryHash: 1, timestamp: -1 });
performanceMetricsSchema.index({ databaseName: 1, collectionName: 1, timestamp: -1 });
performanceMetricsSchema.index({ slowQuery: 1, timestamp: -1 });
performanceMetricsSchema.index({ executionTime: -1 });
performanceMetricsSchema.index({ cacheHit: 1, timestamp: -1 });

// TTL index to automatically remove old metrics (30 days)
performanceMetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

// Static methods for performance analysis
performanceMetricsSchema.statics.getSlowQueries = function(limit = 100, timeThreshold = 1000) {
  return this.find({ 
    slowQuery: true,
    executionTime: { $gte: timeThreshold }
  })
  .sort({ executionTime: -1, timestamp: -1 })
  .limit(limit);
};

performanceMetricsSchema.statics.getQueryStats = function(queryHash) {
  return this.aggregate([
    { $match: { queryHash } },
    {
      $group: {
        _id: '$queryHash',
        avgExecutionTime: { $avg: '$executionTime' },
        minExecutionTime: { $min: '$executionTime' },
        maxExecutionTime: { $max: '$executionTime' },
        totalExecutions: { $sum: 1 },
        cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } },
        slowQueries: { $sum: { $cond: ['$slowQuery', 1, 0] } },
        lastExecuted: { $max: '$timestamp' }
      }
    }
  ]);
};

performanceMetricsSchema.statics.getDatabaseStats = function(databaseName) {
  return this.aggregate([
    { $match: { databaseName } },
    {
      $group: {
        _id: {
          database: '$databaseName',
          collection: '$collectionName'
        },
        totalQueries: { $sum: 1 },
        avgExecutionTime: { $avg: '$executionTime' },
        slowQueries: { $sum: { $cond: ['$slowQuery', 1, 0] } },
        cacheHitRate: {
          $avg: { $cond: ['$cacheHit', 1, 0] }
        },
        totalDocumentsScanned: { $sum: '$documentsScanned' },
        totalDocumentsReturned: { $sum: '$documentsReturned' }
      }
    },
    { $sort: { totalQueries: -1 } }
  ]);
};

performanceMetricsSchema.statics.getPerformanceReport = function(startDate, endDate) {
  const matchStage = {};
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = startDate;
    if (endDate) matchStage.timestamp.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalQueries: { $sum: 1 },
        avgExecutionTime: { $avg: '$executionTime' },
        slowQueries: { $sum: { $cond: ['$slowQuery', 1, 0] } },
        cacheHitRate: { $avg: { $cond: ['$cacheHit', 1, 0] } },
        uniqueQueries: { $addToSet: '$queryHash' },
        databases: { $addToSet: '$databaseName' },
        collections: { $addToSet: '$collectionName' }
      }
    },
    {
      $project: {
        totalQueries: 1,
        avgExecutionTime: { $round: ['$avgExecutionTime', 2] },
        slowQueries: 1,
        cacheHitRate: { $round: ['$cacheHitRate', 4] },
        uniqueQueriesCount: { $size: '$uniqueQueries' },
        databasesCount: { $size: '$databases' },
        collectionsCount: { $size: '$collections' },
        slowQueryRate: {
          $round: [
            { $divide: ['$slowQueries', '$totalQueries'] },
            4
          ]
        }
      }
    }
  ]);
};

module.exports = mongoose.model('PerformanceMetrics', performanceMetricsSchema);
