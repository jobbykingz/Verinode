const mongoose = require('mongoose');
const PerformanceMetrics = require('../models/PerformanceMetrics');

class DatabaseIndexer {
  constructor() {
    this.indexRegistry = new Map();
    this.indexingStats = {
      totalIndexes: 0,
      indexingOperations: 0,
      lastOptimization: null
    };
  }

  /**
   * Analyze collection and recommend indexes
   */
  async analyzeCollectionIndexes(collectionName) {
    try {
      const db = mongoose.connection.db;
      const collection = db.collection(collectionName);
      
      // Get existing indexes
      const existingIndexes = await collection.indexInformation();
      
      // Get collection statistics
      const stats = await collection.stats();
      
      // Analyze query patterns from performance metrics
      const queryPatterns = await this.analyzeQueryPatterns(collectionName);
      
      // Generate index recommendations
      const recommendations = await this.generateIndexRecommendations(
        collectionName,
        existingIndexes,
        stats,
        queryPatterns
      );
      
      return {
        collection: collectionName,
        existingIndexes: existingIndexes.map(idx => ({
          name: idx.name,
          fields: idx.key,
          unique: !!idx.unique,
          sparse: !!idx.sparse
        })),
        stats: {
          documentCount: stats.count,
          avgDocumentSize: stats.avgObjSize,
          totalIndexSize: stats.totalIndexSize,
          indexCount: existingIndexes.length
        },
        recommendations,
        queryPatterns
      };
      
    } catch (error) {
      throw new Error(`Failed to analyze indexes for ${collectionName}: ${error.message}`);
    }
  }

  /**
   * Analyze query patterns from performance metrics
   */
  async analyzeQueryPatterns(collectionName) {
    try {
      const patterns = await PerformanceMetrics.aggregate([
        { $match: { collectionName } },
        {
          $group: {
            _id: '$queryHash',
            queryText: { $first: '$queryText' },
            executionCount: { $sum: 1 },
            avgExecutionTime: { $avg: '$executionTime' },
            totalExecutionTime: { $sum: '$executionTime' },
            slowQueries: { $sum: { $cond: ['$slowQuery', 1, 0] } },
            lastExecuted: { $max: '$timestamp' },
            indexesUsed: { $first: '$indexesUsed' }
          }
        },
        {
          $project: {
            queryHash: '$_id',
            queryText: 1,
            executionCount: 1,
            avgExecutionTime: { $round: ['$avgExecutionTime', 2] },
            totalExecutionTime: { $round: ['$totalExecutionTime', 2] },
            slowQueries: 1,
            slowQueryRate: {
              $round: [
                { $divide: ['$slowQueries', '$executionCount'] },
                4
              ]
            },
            lastExecuted: 1,
            indexesUsed: 1,
            performanceScore: {
              $multiply: [
                '$executionCount',
                { $divide: ['$avgExecutionTime', 1000] }
              ]
            }
          }
        },
        { $sort: { performanceScore: -1 } },
        { $limit: 50 }
      ]);
      
      return patterns;
    } catch (error) {
      console.warn(`Failed to analyze query patterns for ${collectionName}:`, error.message);
      return [];
    }
  }

  /**
   * Generate index recommendations based on analysis
   */
  async generateIndexRecommendations(collectionName, existingIndexes, stats, queryPatterns) {
    const recommendations = [];
    const existingIndexFields = new Set();
    
    // Map existing index fields
    existingIndexes.forEach(idx => {
      Object.keys(idx.fields || {}).forEach(field => {
        existingIndexFields.add(field);
      });
    });
    
    // Analyze query patterns for missing indexes
    const fieldUsage = new Map();
    
    queryPatterns.forEach(pattern => {
      try {
        const queryObj = JSON.parse(pattern.queryText);
        this.extractQueryFields(queryObj, fieldUsage);
      } catch (error) {
        // Skip invalid queries
      }
    });
    
    // Generate single field index recommendations
    for (const [field, usage] of fieldUsage) {
      if (!existingIndexFields.has(field) && usage.frequency > 10) {
        recommendations.push({
          type: 'single_field',
          priority: this.calculatePriority(usage),
          fields: { [field]: 1 },
          reason: `Field used in ${usage.frequency} queries with avg execution time ${usage.avgTime}ms`,
          estimatedImprovement: this.estimateImprovement(usage),
          usage
        });
      }
    }
    
    // Generate compound index recommendations
    const compoundRecommendations = this.generateCompoundIndexRecommendations(
      fieldUsage,
      existingIndexFields,
      queryPatterns
    );
    recommendations.push(...compoundRecommendations);
    
    // Generate text index recommendations
    const textRecommendations = this.generateTextIndexRecommendations(
      queryPatterns,
      existingIndexes
    );
    recommendations.push(...textRecommendations);
    
    // Generate TTL index recommendations
    const ttlRecommendations = this.generateTTLIndexRecommendations(stats);
    recommendations.push(...ttlRecommendations);
    
    // Sort by priority and estimated improvement
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      
      if (priorityDiff !== 0) return priorityDiff;
      
      const improvementA = parseFloat(a.estimatedImprovement) || 0;
      const improvementB = parseFloat(b.estimatedImprovement) || 0;
      return improvementB - improvementA;
    });
  }

  /**
   * Extract field usage from query
   */
  extractQueryFields(query, fieldUsage, path = '') {
    Object.keys(query).forEach(key => {
      if (key.startsWith('$')) {
        // Handle operators
        if (key === '$and' || key === '$or') {
          query[key].forEach(subQuery => {
            this.extractQueryFields(subQuery, fieldUsage, path);
          });
        }
      } else {
        const fieldPath = path ? `${path}.${key}` : key;
        
        if (!fieldUsage.has(fieldPath)) {
          fieldUsage.set(fieldPath, {
            frequency: 0,
            totalTime: 0,
            avgTime: 0,
            queryTypes: new Set()
          });
        }
        
        const usage = fieldUsage.get(fieldPath);
        usage.frequency += 1;
        usage.queryTypes.add('filter');
        
        // Handle nested objects
        if (typeof query[key] === 'object' && query[key] !== null && !Array.isArray(query[key])) {
          this.extractQueryFields(query[key], fieldUsage, fieldPath);
        }
      }
    });
  }

  /**
   * Calculate priority for index recommendation
   */
  calculatePriority(usage) {
    if (usage.frequency > 100 && usage.avgTime > 500) return 'high';
    if (usage.frequency > 50 && usage.avgTime > 200) return 'medium';
    return 'low';
  }

  /**
   * Estimate performance improvement
   */
  estimateImprovement(usage) {
    const baseImprovement = Math.min(usage.avgTime / 10, 90); // Cap at 90%
    const frequencyMultiplier = Math.min(usage.frequency / 100, 2);
    const improvement = baseImprovement * frequencyMultiplier;
    
    return `${Math.round(improvement)}%`;
  }

  /**
   * Generate compound index recommendations
   */
  generateCompoundIndexRecommendations(fieldUsage, existingIndexFields, queryPatterns) {
    const recommendations = [];
    const fieldCombinations = new Map();
    
    // Analyze field combinations in queries
    queryPatterns.forEach(pattern => {
      try {
        const queryObj = JSON.parse(pattern.queryText);
        const fields = this.extractFilterFields(queryObj);
        
        if (fields.length > 1) {
          const combination = fields.sort().join(',');
          
          if (!fieldCombinations.has(combination)) {
            fieldCombinations.set(combination, {
              fields,
              frequency: 0,
              totalTime: 0,
              avgTime: 0
            });
          }
          
          const combo = fieldCombinations.get(combination);
          combo.frequency += 1;
          combo.totalTime += pattern.avgExecutionTime;
          combo.avgTime = combo.totalTime / combo.frequency;
        }
      } catch (error) {
        // Skip invalid queries
      }
    });
    
    // Generate compound index recommendations
    for (const [combination, usage] of fieldCombinations) {
      if (usage.frequency > 20 && usage.avgTime > 300) {
        // Check if compound index already exists
        const hasCompoundIndex = existingIndexFields.has(usage.fields[0]) && 
                                usage.fields.every(field => existingIndexFields.has(field));
        
        if (!hasCompoundIndex) {
          const indexFields = {};
          usage.fields.forEach(field => {
            indexFields[field] = 1;
          });
          
          recommendations.push({
            type: 'compound',
            priority: this.calculatePriority(usage),
            fields: indexFields,
            reason: `Field combination used in ${usage.frequency} queries with avg execution time ${usage.avgTime}ms`,
            estimatedImprovement: this.estimateImprovement(usage),
            usage
          });
        }
      }
    }
    
    return recommendations;
  }

  /**
   * Extract filter fields from query
   */
  extractFilterFields(query, fields = []) {
    Object.keys(query).forEach(key => {
      if (!key.startsWith('$')) {
        fields.push(key);
      } else if (key === '$and' || key === '$or') {
        query[key].forEach(subQuery => {
          this.extractFilterFields(subQuery, fields);
        });
      }
    });
    
    return [...new Set(fields)]; // Remove duplicates
  }

  /**
   * Generate text index recommendations
   */
  generateTextIndexRecommendations(queryPatterns, existingIndexes) {
    const recommendations = [];
    const textQueries = new Set();
    
    // Find text search queries
    queryPatterns.forEach(pattern => {
      try {
        const queryObj = JSON.parse(pattern.queryText);
        if (this.hasTextSearch(queryObj)) {
          const textFields = this.extractTextFields(queryObj);
          textFields.forEach(field => textQueries.add(field));
        }
      } catch (error) {
        // Skip invalid queries
      }
    });
    
    // Check if text index exists
    const hasTextIndex = existingIndexes.some(idx => 
      Object.keys(idx.fields || {}).some(field => field === '$**')
    );
    
    if (textQueries.size > 0 && !hasTextIndex) {
      recommendations.push({
        type: 'text',
        priority: 'medium',
        fields: { '$**': 'text' },
        reason: `Text search queries found on fields: ${Array.from(textQueries).join(', ')}`,
        estimatedImprovement: '70%'
      });
    }
    
    return recommendations;
  }

  /**
   * Check if query has text search
   */
  hasTextSearch(query) {
    return Object.values(query).some(value => 
      value && typeof value === 'object' && value.$text
    );
  }

  /**
   * Extract text fields from query
   */
  extractTextFields(query, fields = []) {
    Object.keys(query).forEach(key => {
      if (key === '$text' && query[key].$search) {
        fields.push('$text');
      } else if (typeof query[key] === 'object' && query[key] !== null) {
        this.extractTextFields(query[key], fields);
      }
    });
    
    return fields;
  }

  /**
   * Generate TTL index recommendations
   */
  generateTTLIndexRecommendations(stats) {
    const recommendations = [];
    
    // Recommend TTL for collections with time-based data
    const timeBasedCollections = ['auditlogs', 'performancemetrics', 'sessionlogs'];
    
    if (timeBasedCollections.includes(stats.collectionName.toLowerCase()) && 
        stats.count > 100000) {
      recommendations.push({
        type: 'ttl',
        priority: 'medium',
        fields: { createdAt: 1 },
        reason: 'Time-based data that could benefit from automatic expiration',
        estimatedImprovement: 'Storage reduction',
        ttlSeconds: 2592000 // 30 days
      });
    }
    
    return recommendations;
  }

  /**
   * Create recommended indexes
   */
  async createIndexes(collectionName, recommendations, options = {}) {
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };
    
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    
    for (const recommendation of recommendations) {
      try {
        // Skip if not in auto-apply mode and priority is low
        if (!options.autoApply && recommendation.priority === 'low') {
          results.skipped.push({
            recommendation,
            reason: 'Low priority - requires manual approval'
          });
          continue;
        }
        
        // Create index
        const indexOptions = {
          name: this.generateIndexName(collectionName, recommendation.fields, recommendation.type),
          background: true
        };
        
        // Add type-specific options
        if (recommendation.type === 'ttl' && recommendation.ttlSeconds) {
          indexOptions.expireAfterSeconds = recommendation.ttlSeconds;
        }
        
        if (recommendation.type === 'text') {
          indexOptions.default_language = 'none';
        }
        
        await collection.createIndex(recommendation.fields, indexOptions);
        
        results.successful.push({
          recommendation,
          indexName: indexOptions.name,
          created: new Date()
        });
        
        // Update registry
        this.indexRegistry.set(indexOptions.name, {
          collection: collectionName,
          fields: recommendation.fields,
          type: recommendation.type,
          created: new Date()
        });
        
        this.indexingStats.totalIndexes++;
        this.indexingStats.indexingOperations++;
        
      } catch (error) {
        results.failed.push({
          recommendation,
          error: error.message
        });
        
        console.error(`Failed to create index for ${collectionName}:`, error.message);
      }
    }
    
    this.indexingStats.lastOptimization = new Date();
    
    return results;
  }

  /**
   * Generate index name
   */
  generateIndexName(collectionName, fields, type) {
    const fieldNames = Object.keys(fields).join('_');
    const prefix = type === 'text' ? 'text' : type === 'ttl' ? 'ttl' : 'idx';
    return `${prefix}_${collectionName}_${fieldNames}`;
  }

  /**
   * Get indexing statistics
   */
  async getIndexingStats() {
    return {
      ...this.indexingStats,
      registrySize: this.indexRegistry.size,
      registeredIndexes: Array.from(this.indexRegistry.entries()).map(([name, info]) => ({
        name,
        ...info
      }))
    };
  }

  /**
   * Drop unused indexes
   */
  async dropUnusedIndexes(collectionName, daysThreshold = 30) {
    const results = {
      dropped: [],
      failed: [],
      retained: []
    };
    
    try {
      const db = mongoose.connection.db;
      const collection = db.collection(collectionName);
      
      // Get existing indexes
      const existingIndexes = await collection.indexInformation();
      
      // Get index usage from performance metrics
      const cutoffDate = new Date(Date.now() - (daysThreshold * 24 * 60 * 60 * 1000));
      
      const usedIndexes = await PerformanceMetrics.aggregate([
        {
          $match: {
            collectionName,
            timestamp: { $gte: cutoffDate },
            indexesUsed: { $exists: true, $ne: [] }
          }
        },
        { $unwind: '$indexesUsed' },
        { $group: { _id: '$indexesUsed.name', lastUsed: { $max: '$timestamp' } } }
      ]);
      
      const usedIndexNames = new Set(usedIndexes.map(idx => idx._id));
      
      // Drop unused indexes (except _id index)
      for (const index of existingIndexes) {
        if (index.name !== '_id_' && !usedIndexNames.has(index.name)) {
          try {
            await collection.dropIndex(index.name);
            results.dropped.push({
              name: index.name,
              fields: index.key,
              dropped: new Date()
            });
            
            // Remove from registry
            this.indexRegistry.delete(index.name);
            this.indexingStats.totalIndexes--;
            
          } catch (error) {
            results.failed.push({
              name: index.name,
              error: error.message
            });
          }
        } else {
          results.retained.push({
            name: index.name,
            fields: index.key,
            lastUsed: usedIndexNames.has(index.name) ? 'Recently used' : 'System index'
          });
        }
      }
      
    } catch (error) {
      throw new Error(`Failed to drop unused indexes for ${collectionName}: ${error.message}`);
    }
    
    return results;
  }
}

module.exports = DatabaseIndexer;
