const mongoose = require('mongoose');
const QueryAnalyzer = require('../utils/queryAnalyzer');
const PerformanceMetrics = require('../models/PerformanceMetrics');

class QueryOptimizer {
  constructor() {
    this.queryAnalyzer = new QueryAnalyzer();
    this.optimizationStrategies = new Map();
    this.initializeStrategies();
  }

  /**
   * Initialize optimization strategies
   */
  initializeStrategies() {
    // Index optimization strategy
    this.optimizationStrategies.set('index', async (query, collection, analysis) => {
      const recommendations = [];
      
      // Check if suggested indexes exist
      for (const indexSuggestion of analysis.potentialIndexes) {
        const indexExists = await this.checkIndexExists(collection, indexSuggestion.fields);
        
        if (!indexExists) {
          recommendations.push({
            type: 'create_index',
            priority: 'high',
            collection,
            index: indexSuggestion,
            estimatedImprovement: this.estimateIndexImprovement(indexSuggestion, analysis)
          });
        }
      }
      
      return recommendations;
    });

    // Query rewriting strategy
    this.optimizationStrategies.set('rewrite', async (query, collection, analysis) => {
      const optimizations = [];
      
      // Convert expensive regex to text search
      if (this.hasExpensiveRegex(query)) {
        optimizations.push({
          type: 'regex_to_text',
          description: 'Replace regex with text search for better performance',
          originalQuery: query,
          optimizedQuery: this.convertRegexToTextSearch(query)
        });
      }
      
      // Optimize $in arrays
      if (this.hasLargeInArray(query)) {
        optimizations.push({
          type: 'optimize_in',
          description: 'Break down large $in array into smaller batches',
          originalQuery: query,
          optimizedQuery: this.optimizeInArray(query)
        });
      }
      
      // Remove unnecessary projections
      if (this.hasUnnecessaryProjection(query)) {
        optimizations.push({
          type: 'optimize_projection',
          description: 'Remove unnecessary fields from projection',
          originalQuery: query,
          optimizedQuery: this.optimizeProjection(query)
        });
      }
      
      return optimizations;
    });

    // Caching strategy
    this.optimizationStrategies.set('cache', async (query, collection, analysis) => {
      if (!analysis.cacheable) {
        return [];
      }
      
      return [{
        type: 'enable_cache',
        priority: 'medium',
        description: 'Enable query result caching',
        cacheKey: analysis.queryHash,
        estimatedImprovement: '90%+ for repeated queries'
      }];
    });

    // Partitioning strategy
    this.optimizationStrategies.set('partition', async (query, collection, analysis) => {
      const partitionRecommendations = [];
      
      // Check if collection would benefit from partitioning
      const shouldPartition = await this.shouldPartitionCollection(collection, analysis);
      
      if (shouldPartition) {
        partitionRecommendations.push({
          type: 'partition_collection',
          priority: 'low',
          description: `Consider partitioning ${collection} by ${shouldPartition.field}`,
          field: shouldPartition.field,
          strategy: shouldPartition.strategy,
          estimatedImprovement: shouldPartition.improvement
        });
      }
      
      return partitionRecommendations;
    });
  }

  /**
   * Optimize a query with all applicable strategies
   */
  async optimizeQuery(query, collection, options = {}) {
    const startTime = Date.now();
    
    try {
      // Analyze the query
      const analysis = this.queryAnalyzer.analyzeQuery(query, collection);
      
      // Apply optimization strategies
      const optimizations = [];
      const appliedStrategies = options.strategies || ['index', 'rewrite', 'cache', 'partition'];
      
      for (const strategy of appliedStrategies) {
        if (this.optimizationStrategies.has(strategy)) {
          const strategyOptimizations = await this.optimizationStrategies.get(strategy)(
            query, 
            collection, 
            analysis
          );
          optimizations.push(...strategyOptimizations);
        }
      }
      
      // Generate optimization plan
      const optimizationPlan = {
        originalQuery: query,
        collection,
        analysis,
        optimizations: optimizations.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        }),
        estimatedImprovement: this.calculateOverallImprovement(optimizations),
        generatedAt: new Date(),
        processingTime: Date.now() - startTime
      };
      
      // Log optimization metrics
      await this.logOptimizationMetrics(optimizationPlan);
      
      return optimizationPlan;
      
    } catch (error) {
      throw new Error(`Query optimization failed: ${error.message}`);
    }
  }

  /**
   * Apply automatic optimizations
   */
  async applyAutoOptimizations(query, collection, model) {
    const optimizationPlan = await this.optimizeQuery(query, collection);
    let optimizedQuery = query;
    const appliedOptimizations = [];
    
    // Apply safe automatic optimizations
    for (const optimization of optimizationPlan.optimizations) {
      if (optimization.priority === 'high' && this.isSafeToApply(optimization)) {
        try {
          switch (optimization.type) {
            case 'create_index':
              await this.createIndex(collection, optimization.index);
              appliedOptimizations.push(optimization);
              break;
              
            case 'regex_to_text':
              optimizedQuery = optimization.optimizedQuery;
              appliedOptimizations.push(optimization);
              break;
              
            case 'optimize_in':
              optimizedQuery = optimization.optimizedQuery;
              appliedOptimizations.push(optimization);
              break;
              
            case 'optimize_projection':
              optimizedQuery = optimization.optimizedQuery;
              appliedOptimizations.push(optimization);
              break;
          }
        } catch (error) {
          console.warn(`Failed to apply optimization ${optimization.type}:`, error.message);
        }
      }
    }
    
    return {
      optimizedQuery,
      appliedOptimizations,
      originalQuery: query,
      improvement: optimizationPlan.estimatedImprovement
    };
  }

  /**
   * Check if an index exists
   */
  async checkIndexExists(collection, indexFields) {
    try {
      const db = mongoose.connection.db;
      const indexes = await db.collection(collection).indexInformation();
      
      return indexes.some(index => {
        const indexKey = Object.keys(index.key || {});
        const requiredKeys = Object.keys(indexFields);
        
        return requiredKeys.every(key => indexKey.includes(key));
      });
    } catch (error) {
      console.warn(`Failed to check index existence for ${collection}:`, error.message);
      return false;
    }
  }

  /**
   * Create an index
   */
  async createIndex(collection, indexSpec) {
    try {
      const db = mongoose.connection.db;
      const indexOptions = {
        name: `idx_${collection}_${Object.keys(indexSpec.fields).join('_')}`,
        background: true
      };
      
      await db.collection(collection).createIndex(indexSpec.fields, indexOptions);
      
      console.log(`Created index ${indexOptions.name} on collection ${collection}`);
      return true;
    } catch (error) {
      console.error(`Failed to create index on ${collection}:`, error.message);
      throw error;
    }
  }

  /**
   * Estimate improvement from adding an index
   */
  estimateIndexImprovement(indexSpec, analysis) {
    const baseImprovement = analysis.complexity === 'high' ? '80%' : 
                          analysis.complexity === 'medium' ? '60%' : '40%';
    
    // Adjust based on query cost
    const costMultiplier = Math.min(analysis.estimatedCost / 5, 2);
    const improvement = parseFloat(baseImprovement) * costMultiplier;
    
    return `${Math.round(improvement)}%`;
  }

  /**
   * Check if query has expensive regex
   */
  hasExpensiveRegex(query) {
    if (typeof query === 'string') return false;
    
    return Object.values(query).some(value => 
      value && typeof value === 'object' && value.$regex && 
      !value.$regex.startsWith('^') // Non-anchored regex are expensive
    );
  }

  /**
   * Convert regex to text search
   */
  convertRegexToTextSearch(query) {
    const converted = JSON.parse(JSON.stringify(query));
    
    Object.keys(converted).forEach(key => {
      const value = converted[key];
      if (value && typeof value === 'object' && value.$regex) {
        // Simple conversion - in practice this would be more sophisticated
        delete converted[key].$regex;
        converted[key].$text = { $search: value.$regex.replace(/[^a-zA-Z0-9\s]/g, ' ') };
      }
    });
    
    return converted;
  }

  /**
   * Check if query has large $in array
   */
  hasLargeInArray(query) {
    if (typeof query === 'string') return false;
    
    return Object.values(query).some(value => 
      value && Array.isArray(value.$in) && value.$in.length > 1000
    );
  }

  /**
   * Optimize large $in arrays
   */
  optimizeInArray(query) {
    const optimized = JSON.parse(JSON.stringify(query));
    
    Object.keys(optimized).forEach(key => {
      const value = optimized[key];
      if (value && Array.isArray(value.$in) && value.$in.length > 1000) {
        // Break into chunks of 1000
        const chunks = [];
        for (let i = 0; i < value.$in.length; i += 1000) {
          chunks.push(value.$in.slice(i, i + 1000));
        }
        
        // Convert to $or queries (would need to be handled at execution level)
        optimized[key] = { $in: chunks[0] }; // Simplified for example
      }
    });
    
    return optimized;
  }

  /**
   * Check if query has unnecessary projections
   */
  hasUnnecessaryProjection(query) {
    // This would analyze the query and usage patterns to determine
    // if fields are being retrieved unnecessarily
    return false; // Simplified
  }

  /**
   * Optimize projection
   */
  optimizeProjection(query) {
    // Implementation would remove unused fields from projection
    return query; // Simplified
  }

  /**
   * Check if collection should be partitioned
   */
  async shouldPartitionCollection(collection, analysis) {
    // Check collection size and query patterns
    try {
      const db = mongoose.connection.db;
      const stats = await db.collection(collection).stats();
      
      // Large collections with time-based queries benefit from partitioning
      if (stats.count > 1000000) { // 1M+ documents
        // Check for time-based fields in queries
        const timeFields = ['createdAt', 'updatedAt', 'timestamp', 'date'];
        
        for (const field of timeFields) {
          const hasTimeQueries = await this.checkTimeBasedQueries(collection, field);
          if (hasTimeQueries) {
            return {
              field,
              strategy: 'range',
              improvement: '50-70% for time-based queries'
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to analyze collection ${collection} for partitioning:`, error.message);
      return null;
    }
  }

  /**
   * Check if collection has time-based queries
   */
  async checkTimeBasedQueries(collection, field) {
    // This would analyze query history to determine if time-based queries are common
    // Simplified implementation
    return field === 'createdAt' || field === 'timestamp';
  }

  /**
   * Check if optimization is safe to apply automatically
   */
  isSafeToApply(optimization) {
    const safeTypes = ['create_index', 'regex_to_text', 'optimize_in', 'optimize_projection'];
    return safeTypes.includes(optimization.type);
  }

  /**
   * Calculate overall improvement estimate
   */
  calculateOverallImprovement(optimizations) {
    if (optimizations.length === 0) return '0%';
    
    let totalImprovement = 0;
    let weightSum = 0;
    
    optimizations.forEach(opt => {
      const weight = opt.priority === 'high' ? 3 : opt.priority === 'medium' ? 2 : 1;
      const improvement = parseFloat(opt.estimatedImprovement) || 0;
      
      totalImprovement += improvement * weight;
      weightSum += weight;
    });
    
    const avgImprovement = weightSum > 0 ? totalImprovement / weightSum : 0;
    return `${Math.round(Math.min(avgImprovement, 95))}%`;
  }

  /**
   * Log optimization metrics
   */
  async logOptimizationMetrics(optimizationPlan) {
    try {
      await PerformanceMetrics.create({
        queryHash: optimizationPlan.analysis.queryHash,
        queryText: optimizationPlan.originalQuery,
        executionTime: optimizationPlan.processingTime,
        databaseName: mongoose.connection.name,
        collectionName: optimizationPlan.collection,
        optimizationApplied: 'query_analyzed',
        documentsScanned: 0,
        documentsReturned: 0,
        cacheHit: false
      });
    } catch (error) {
      console.warn('Failed to log optimization metrics:', error.message);
    }
  }
}

module.exports = QueryOptimizer;
