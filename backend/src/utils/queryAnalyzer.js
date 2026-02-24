const crypto = require('crypto');
const { performance } = require('perf_hooks');

class QueryAnalyzer {
  constructor() {
    this.slowQueryThreshold = 1000; // 1 second
    this.complexityPatterns = {
      highComplexity: [
        /\$lookup/gi,
        /\$facet/gi,
        /\$graphLookup/gi,
        /\$unwind.*\$unwind/gi,
        /\$group.*\$group/gi,
        /or.*or/gi,
        /\$where/gi
      ],
      mediumComplexity: [
        /\$group/gi,
        /\$sort/gi,
        /\$skip.*\$limit/gi,
        /or/gi,
        /and.*and/gi
      ]
    };
  }

  /**
   * Analyze a query for performance characteristics
   */
  analyzeQuery(query, collection = 'unknown') {
    const analysis = {
      queryHash: this.generateQueryHash(query),
      queryText: typeof query === 'string' ? query : JSON.stringify(query),
      complexity: this.assessComplexity(query),
      estimatedCost: this.estimateQueryCost(query, collection),
      recommendations: this.generateRecommendations(query, collection),
      potentialIndexes: this.suggestIndexes(query),
      cacheable: this.isCacheable(query)
    };

    return analysis;
  }

  /**
   * Generate a consistent hash for a query
   */
  generateQueryHash(query) {
    const normalizedQuery = this.normalizeQuery(query);
    return crypto.createHash('sha256').update(normalizedQuery).digest('hex').substring(0, 16);
  }

  /**
   * Normalize query for consistent hashing
   */
  normalizeQuery(query) {
    if (typeof query === 'string') {
      return query.toLowerCase().replace(/\s+/g, ' ').trim();
    }
    
    // For MongoDB queries, sort keys and remove values that don't affect execution plan
    const normalized = JSON.parse(JSON.stringify(query, Object.keys(query).sort()));
    return JSON.stringify(normalized);
  }

  /**
   * Assess query complexity
   */
  assessComplexity(query) {
    const queryText = typeof query === 'string' ? query : JSON.stringify(query);
    
    // Check for high complexity patterns
    for (const pattern of this.complexityPatterns.highComplexity) {
      if (pattern.test(queryText)) {
        return 'high';
      }
    }
    
    // Check for medium complexity patterns
    for (const pattern of this.complexityPatterns.mediumComplexity) {
      if (pattern.test(queryText)) {
        return 'medium';
      }
    }
    
    return 'low';
  }

  /**
   * Estimate query execution cost
   */
  estimateQueryCost(query, collection) {
    let cost = 1;
    const queryText = typeof query === 'string' ? query : JSON.stringify(query);
    
    // Base cost factors
    if (this.complexityPatterns.highComplexity.some(pattern => pattern.test(queryText))) {
      cost *= 10;
    } else if (this.complexityPatterns.mediumComplexity.some(pattern => pattern.test(queryText))) {
      cost *= 5;
    }
    
    // Collection-specific cost factors
    const collectionCosts = {
      'ipfscontents': 2, // Likely large collection
      'customtemplates': 1.5,
      'auditlogs': 3, // Very large collection
      'compliancereports': 2
    };
    
    cost *= (collectionCosts[collection.toLowerCase()] || 1);
    
    // Query-specific factors
    if (typeof query === 'object') {
      // Large array operations
      if (query.$in && Array.isArray(query.$in) && query.$in.length > 100) {
        cost *= 1.5;
      }
      
      // Regex queries (expensive)
      Object.values(query).forEach(value => {
        if (value && value.$regex) {
          cost *= 2;
        }
      });
      
      // Text searches
      if (query.$text) {
        cost *= 1.5;
      }
    }
    
    return Math.round(cost * 100) / 100;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(query, collection) {
    const recommendations = [];
    const queryText = typeof query === 'string' ? query : JSON.stringify(query);
    
    // Check for missing indexes
    if (typeof query === 'object') {
      Object.keys(query).forEach(field => {
        if (!field.startsWith('$') && field !== '_id') {
          recommendations.push({
            type: 'index',
            priority: 'high',
            description: `Add index on field '${field}' in collection '${collection}'`,
            field,
            collection
          });
        }
      });
    }
    
    // Check for expensive operations
    if (queryText.includes('$regex')) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: 'Consider using indexed text search instead of regex for better performance'
      });
    }
    
    if (queryText.includes('$where')) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        description: 'Avoid $where operator - it cannot use indexes and is very slow'
      });
    }
    
    if (queryText.includes('$lookup')) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: 'Consider denormalizing data to avoid $lookup operations'
      });
    }
    
    // Check for large $in arrays
    if (typeof query === 'object' && query.$in && Array.isArray(query.$in) && query.$in.length > 1000) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: 'Large $in arrays detected. Consider using $or with multiple queries or batching'
      });
    }
    
    return recommendations;
  }

  /**
   * Suggest indexes for the query
   */
  suggestIndexes(query) {
    const indexes = [];
    
    if (typeof query === 'object') {
      // Single field indexes
      Object.keys(query).forEach(field => {
        if (!field.startsWith('$') && field !== '_id') {
          indexes.push({
            fields: { [field]: 1 },
            type: 'single',
            reason: `Query filters on ${field}`
          });
        }
      });
      
      // Compound indexes for multiple fields
      const filterFields = Object.keys(query).filter(field => !field.startsWith('$'));
      if (filterFields.length > 1) {
        const compoundFields = {};
        filterFields.forEach(field => {
          compoundFields[field] = 1;
        });
        
        indexes.push({
          fields: compoundFields,
          type: 'compound',
          reason: `Multiple filter fields: ${filterFields.join(', ')}`
        });
      }
      
      // Text indexes for text searches
      if (query.$text) {
        indexes.push({
          fields: { '$**': 'text' },
          type: 'text',
          reason: 'Text search operation detected'
        });
      }
    }
    
    return indexes;
  }

  /**
   * Check if query is cacheable
   */
  isCacheable(query) {
    const queryText = typeof query === 'string' ? query : JSON.stringify(query);
    
    // Non-cacheable operations
    const nonCacheablePatterns = [
      /\$currentDate/gi,
      /\$inc/gi,
      /\$mul/gi,
      /\$min/gi,
      /\$max/gi,
      /\$push/gi,
      /\$pull/gi,
      /\$pop/gi,
      /\$addToSet/gi,
      /\$bit/gi,
      /updateOne/gi,
      /updateMany/gi,
      /replaceOne/gi,
      /deleteOne/gi,
      /deleteMany/gi
    ];
    
    return !nonCacheablePatterns.some(pattern => pattern.test(queryText));
  }

  /**
   * Measure query execution time
   */
  async measureQueryExecution(queryFunction, query, collection) {
    const startTime = performance.now();
    const analysis = this.analyzeQuery(query, collection);
    
    try {
      const result = await queryFunction();
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      return {
        result,
        metrics: {
          ...analysis,
          executionTime,
          slowQuery: executionTime > this.slowQueryThreshold,
          timestamp: new Date()
        }
      };
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      return {
        error,
        metrics: {
          ...analysis,
          executionTime,
          slowQuery: executionTime > this.slowQueryThreshold,
          timestamp: new Date(),
          error: error.message,
          stackTrace: error.stack
        }
      };
    }
  }

  /**
   * Analyze aggregation pipeline
   */
  analyzeAggregationPipeline(pipeline, collection) {
    const analysis = {
      stages: pipeline.length,
      complexity: 'low',
      recommendations: [],
      potentialIndexes: []
    };
    
    // Analyze each stage
    pipeline.forEach((stage, index) => {
      const stageType = Object.keys(stage)[0];
      
      switch (stageType) {
        case '$match':
          analysis.potentialIndexes.push(...this.suggestIndexes(stage[stageType]));
          break;
          
        case '$lookup':
          analysis.complexity = 'high';
          analysis.recommendations.push({
            type: 'optimization',
            priority: 'medium',
            description: `Stage ${index + 1}: Consider denormalization to avoid $lookup`
          });
          break;
          
        case '$group':
          if (analysis.complexity === 'low') analysis.complexity = 'medium';
          break;
          
        case '$facet':
        case '$graphLookup':
          analysis.complexity = 'high';
          break;
          
        case '$sort':
          // Suggest index for sort
          const sortFields = Object.keys(stage[stageType]);
          if (sortFields.length > 0) {
            analysis.potentialIndexes.push({
              fields: sortFields.reduce((acc, field) => {
                acc[field] = stage[stageType][field];
                return acc;
              }, {}),
              type: 'sort',
              reason: `Sort operation on ${sortFields.join(', ')}`
            });
          }
          break;
      }
    });
    
    return analysis;
  }
}

module.exports = QueryAnalyzer;
