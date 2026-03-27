import { EventEmitter } from 'events';
import { WinstonLogger } from '../utils/logger';
import { 
  CachePattern, 
  CacheStrategy, 
  CacheOptimization, 
  CacheABTest,
  CacheAnalytics,
  CacheConfiguration,
  CacheInsight
} from '../models/CachePattern';
import { PatternAnalyzer } from './PatternAnalyzer';
import { MLCachePredictor } from './MLCachePredictor';

export interface CacheOptimizerConfig {
  optimizationInterval: number;
  minOptimizationScore: number;
  maxConcurrentOptimizations: number;
  abTestDuration: number;
  abTestTrafficSplit: number;
  optimizationHistorySize: number;
  performanceThreshold: number;
  riskThreshold: number;
}

export interface OptimizationCandidate {
  type: CacheOptimization['type'];
  key?: string;
  pattern?: string;
  score: number;
  expectedImpact: {
    hitRateImprovement: number;
    responseTimeImprovement: number;
    memorySavings: number;
  };
  risk: 'low' | 'medium' | 'high';
  implementation: {
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedTime: number;
    resources: string[];
  };
  reasoning: string;
}

export interface OptimizationResult {
  optimization: CacheOptimization;
  actualImpact: {
    hitRateImprovement: number;
    responseTimeImprovement: number;
    memorySavings: number;
  };
  success: boolean;
  error?: string;
  duration: number;
  timestamp: Date;
}

export interface StrategyEvaluation {
  strategy: CacheStrategy;
  performance: {
    hitRate: number;
    avgResponseTime: number;
    memoryUsage: number;
    evictionRate: number;
  };
  confidence: number;
  recommendation: 'adopt' | 'test' | 'reject';
  reasoning: string;
}

export class CacheOptimizer extends EventEmitter {
  private config: CacheOptimizerConfig;
  private logger: WinstonLogger;
  private analyzer: PatternAnalyzer;
  private predictor: MLCachePredictor;
  private optimizations: Map<string, CacheOptimization>;
  private abTests: Map<string, CacheABTest>;
  private optimizationHistory: OptimizationResult[];
  private strategyEvaluations: Map<string, StrategyEvaluation>;
  private optimizationTimer?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  constructor(
    config: CacheOptimizerConfig,
    analyzer: PatternAnalyzer,
    predictor: MLCachePredictor
  ) {
    super();
    this.config = config;
    this.logger = new WinstonLogger();
    this.analyzer = analyzer;
    this.predictor = predictor;
    this.optimizations = new Map();
    this.abTests = new Map();
    this.optimizationHistory = [];
    this.strategyEvaluations = new Map();
  }

  /**
   * Initialize the cache optimizer
   */
  async initialize(): Promise<void> {
    try {
      this.startOptimization();
      this.isInitialized = true;
      this.logger.info('Cache Optimizer initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Cache Optimizer', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Generate optimization candidates
   */
  async generateOptimizationCandidates(): Promise<OptimizationCandidate[]> {
    try {
      const candidates: OptimizationCandidate[] = [];
      
      // Analyze patterns for optimization opportunities
      const patternCandidates = await this.analyzePatternOptimizations();
      candidates.push(...patternCandidates);
      
      // Analyze performance for optimization opportunities
      const performanceCandidates = await this.analyzePerformanceOptimizations();
      candidates.push(...performanceCandidates);
      
      // Analyze configuration for optimization opportunities
      const configCandidates = await this.analyzeConfigurationOptimizations();
      candidates.push(...configCandidates);
      
      // Analyze strategies for optimization opportunities
      const strategyCandidates = await this.analyzeStrategyOptimizations();
      candidates.push(...strategyCandidates);
      
      // Sort by score and filter by minimum score
      const filteredCandidates = candidates
        .filter(candidate => candidate.score >= this.config.minOptimizationScore)
        .sort((a, b) => b.score - a.score);
      
      this.emit('candidatesGenerated', filteredCandidates);
      return filteredCandidates;

    } catch (error) {
      this.logger.error('Failed to generate optimization candidates', error);
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Apply optimization
   */
  async applyOptimization(candidate: OptimizationCandidate): Promise<OptimizationResult> {
    const startTime = Date.now();
    
    try {
      const optimization = this.createOptimization(candidate);
      
      // Check if we have capacity for more optimizations
      const runningOptimizations = Array.from(this.optimizations.values())
        .filter(opt => opt.status === 'in_progress').length;
      
      if (runningOptimizations >= this.config.maxConcurrentOptimizations) {
        throw new Error('Maximum concurrent optimizations reached');
      }
      
      this.optimizations.set(optimization.id, optimization);
      
      // Apply the optimization
      const result = await this.executeOptimization(optimization);
      
      // Record the result
      const optimizationResult: OptimizationResult = {
        optimization,
        actualImpact: result.impact,
        success: result.success,
        error: result.error,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
      
      this.optimizationHistory.push(optimizationResult);
      
      // Keep history size limited
      if (this.optimizationHistory.length > this.config.optimizationHistorySize) {
        this.optimizationHistory = this.optimizationHistory.slice(-this.config.optimizationHistorySize);
      }
      
      this.emit('optimizationApplied', optimizationResult);
      return optimizationResult;

    } catch (error) {
      this.logger.error('Failed to apply optimization', error);
      this.emit('error', error);
      
      return {
        optimization: this.createOptimization(candidate),
        actualImpact: { hitRateImprovement: 0, responseTimeImprovement: 0, memorySavings: 0 },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Evaluate cache strategies
   */
  async evaluateStrategies(): Promise<StrategyEvaluation[]> {
    try {
      const strategies = this.generateCandidateStrategies();
      const evaluations: StrategyEvaluation[] = [];
      
      for (const strategy of strategies) {
        const evaluation = await this.evaluateStrategy(strategy);
        evaluations.push(evaluation);
        this.strategyEvaluations.set(strategy.name, evaluation);
      }
      
      this.emit('strategiesEvaluated', evaluations);
      return evaluations;

    } catch (error) {
      this.logger.error('Failed to evaluate strategies', error);
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Create A/B test for strategies
   */
  async createABTest(name: string, description: string, controlStrategy: CacheStrategy, testStrategy: CacheStrategy): Promise<CacheABTest> {
    try {
      const abTest: CacheABTest = {
        id: `abtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        controlStrategy,
        testStrategy,
        trafficSplit: this.config.abTestTrafficSplit,
        duration: this.config.abTestDuration,
        startTime: new Date(),
        status: 'running'
      };
      
      this.abTests.set(abTest.id, abTest);
      
      // Schedule test completion
      setTimeout(() => {
        this.completeABTest(abTest.id);
      }, this.config.abTestDuration * 1000);
      
      this.emit('abTestCreated', abTest);
      return abTest;

    } catch (error) {
      this.logger.error('Failed to create A/B test', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): CacheInsight[] {
    const insights: CacheInsight[] = [];
    
    // High-impact optimizations
    const highImpactOptimizations = Array.from(this.optimizations.values())
      .filter(opt => opt.priority === 'high' || opt.priority === 'critical')
      .filter(opt => opt.status === 'pending');
    
    if (highImpactOptimizations.length > 0) {
      insights.push({
        id: `insight_high_impact_${Date.now()}`,
        type: 'optimization',
        severity: 'warning',
        title: 'High Impact Optimizations Available',
        description: `${highImpactOptimizations.length} high-priority optimizations ready for implementation`,
        data: { optimizations: highImpactOptimizations },
        recommendations: ['Review and apply high-priority optimizations', 'Monitor impact after implementation'],
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    // Strategy recommendations
    const strategyRecommendations = Array.from(this.strategyEvaluations.values())
      .filter(eval => eval.recommendation === 'adopt');
    
    if (strategyRecommendations.length > 0) {
      insights.push({
        id: `insight_strategy_${Date.now()}`,
        type: 'optimization',
        severity: 'info',
        title: 'Strategy Improvements Recommended',
        description: `${strategyRecommendations.length} strategies recommended for adoption`,
        data: { strategies: strategyRecommendations },
        recommendations: ['Consider adopting recommended strategies', 'Test strategies before full deployment'],
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    return insights;
  }

  /**
   * Get optimization analytics
   */
  getAnalytics(): CacheAnalytics {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 24 * 3600000); // Last 24 hours
    
    const periodOptimizations = this.optimizationHistory.filter(result => 
      result.timestamp >= periodStart
    );
    
    const successfulOptimizations = periodOptimizations.filter(result => result.success);
    
    const totalImpact = successfulOptimizations.reduce((acc, result) => ({
      hitRateImprovement: acc.hitRateImprovement + result.actualImpact.hitRateImprovement,
      responseTimeImprovement: acc.responseTimeImprovement + result.actualImpact.responseTimeImprovement,
      memorySavings: acc.memorySavings + result.actualImpact.memorySavings
    }), { hitRateImprovement: 0, responseTimeImprovement: 0, memorySavings: 0 });
    
    return {
      period: { start: periodStart, end: now },
      performance: {
        totalRequests: periodOptimizations.length,
        hitRate: successfulOptimizations.length / Math.max(1, periodOptimizations.length),
        missRate: (periodOptimizations.length - successfulOptimizations.length) / Math.max(1, periodOptimizations.length),
        avgResponseTime: periodOptimizations.reduce((sum, result) => sum + result.duration, 0) / Math.max(1, periodOptimizations.length),
        peakMemoryUsage: 0, // Would need to track this
        errorRate: (periodOptimizations.length - successfulOptimizations.length) / Math.max(1, periodOptimizations.length)
      },
      patterns: {
        topPatterns: [], // Would come from pattern analyzer
        seasonalPatterns: [],
        anomalousPatterns: []
      },
      predictions: {
        accuracy: 0, // Would come from predictor
        totalPredictions: 0,
        correctPredictions: 0,
        modelPerformance: this.predictor.getModelMetrics()
      },
      optimizations: {
        applied: successfulOptimizations.map(result => result.optimization),
        pending: Array.from(this.optimizations.values()).filter(opt => opt.status === 'pending'),
        failed: periodOptimizations.filter(result => !result.success).map(result => result.optimization)
      },
      recommendations: this.getRecommendations().map(insight => insight.description)
    };
  }

  /**
   * Get all optimizations
   */
  getOptimizations(): CacheOptimization[] {
    return Array.from(this.optimizations.values());
  }

  /**
   * Get all A/B tests
   */
  getABTests(): CacheABTest[] {
    return Array.from(this.abTests.values());
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): OptimizationResult[] {
    return [...this.optimizationHistory];
  }

  /**
   * Shutdown the optimizer
   */
  shutdown(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }
    
    this.isInitialized = false;
    this.logger.info('Cache Optimizer shutdown completed');
    this.emit('shutdown');
  }

  // Private methods

  private startOptimization(): void {
    this.optimizationTimer = setInterval(async () => {
      try {
        await this.runOptimizationCycle();
      } catch (error) {
        this.logger.error('Automatic optimization cycle failed', error);
      }
    }, this.config.optimizationInterval * 1000);
  }

  private async runOptimizationCycle(): Promise<void> {
    this.logger.info('Starting optimization cycle...');
    
    // Generate candidates
    const candidates = await this.generateOptimizationCandidates();
    
    // Apply top candidates
    const topCandidates = candidates.slice(0, 3); // Apply top 3 candidates
    
    for (const candidate of topCandidates) {
      try {
        await this.applyOptimization(candidate);
      } catch (error) {
        this.logger.warn(`Failed to apply optimization: ${candidate.type}`, error);
      }
    }
    
    // Evaluate strategies
    await this.evaluateStrategies();
    
    this.logger.info('Optimization cycle completed');
  }

  private async analyzePatternOptimizations(): Promise<OptimizationCandidate[]> {
    const candidates: OptimizationCandidate[] = [];
    const patterns = this.analyzer.getPatterns();
    
    for (const pattern of patterns) {
      // TTL optimization for patterns
      if (pattern.ttl < 300 && pattern.frequency > 50) {
        candidates.push({
          type: 'ttl_adjustment',
          key: pattern.key,
          score: 0.8,
          expectedImpact: {
            hitRateImprovement: 0.15,
            responseTimeImprovement: 0.1,
            memorySavings: -0.05
          },
          risk: 'low',
          implementation: {
            complexity: 'simple',
            estimatedTime: 5,
            resources: ['cache']
          },
          reasoning: `High-frequency pattern ${pattern.key} has short TTL`
        });
      }
      
      // Prefetch optimization for seasonal patterns
      if (pattern.seasonal && pattern.frequency > 20) {
        candidates.push({
          type: 'prefetch',
          pattern: pattern.pattern,
          score: 0.7,
          expectedImpact: {
            hitRateImprovement: 0.2,
            responseTimeImprovement: 0.15,
            memorySavings: -0.1
          },
          risk: 'medium',
          implementation: {
            complexity: 'moderate',
            estimatedTime: 15,
            resources: ['cache', 'predictor']
          },
          reasoning: `Seasonal pattern ${pattern.pattern} suitable for prefetching`
        });
      }
    }
    
    return candidates;
  }

  private async analyzePerformanceOptimizations(): Promise<OptimizationCandidate[]> {
    const candidates: OptimizationCandidate[] = [];
    const metrics = this.analyzer.getMetrics();
    
    // Compression optimization
    if (metrics.avgPatternStrength < 0.5) {
      candidates.push({
        type: 'compression',
        score: 0.6,
        expectedImpact: {
          hitRateImprovement: 0.05,
          responseTimeImprovement: -0.05,
          memorySavings: 0.3
        },
        risk: 'low',
        implementation: {
          complexity: 'simple',
          estimatedTime: 10,
          resources: ['cache']
        },
        reasoning: 'Low pattern strength indicates potential for compression optimization'
      });
    }
    
    // Partitioning optimization
    if (metrics.patternDiversity > 0.7) {
      candidates.push({
        type: 'partitioning',
        score: 0.7,
        expectedImpact: {
          hitRateImprovement: 0.1,
          responseTimeImprovement: 0.05,
          memorySavings: 0.1
        },
        risk: 'medium',
        implementation: {
          complexity: 'complex',
          estimatedTime: 30,
          resources: ['cache', 'configuration']
        },
        reasoning: 'High pattern diversity suggests benefit from cache partitioning'
      });
    }
    
    return candidates;
  }

  private async analyzeConfigurationOptimizations(): Promise<OptimizationCandidate[]> {
    const candidates: OptimizationCandidate[] = [];
    
    // Size optimization based on patterns
    const patterns = this.analyzer.getPatterns();
    const totalSize = patterns.reduce((sum, pattern) => sum + pattern.size, 0);
    
    if (totalSize > 1024 * 1024 * 100) { // 100MB
      candidates.push({
        type: 'sizing',
        score: 0.8,
        expectedImpact: {
          hitRateImprovement: 0.1,
          responseTimeImprovement: 0.05,
          memorySavings: 0.2
        },
        risk: 'low',
        implementation: {
          complexity: 'simple',
          estimatedTime: 5,
          resources: ['cache']
        },
        reasoning: 'Large cache size suggests opportunity for optimization'
      });
    }
    
    return candidates;
  }

  private async analyzeStrategyOptimizations(): Promise<OptimizationCandidate[]> {
    const candidates: OptimizationCandidate[] = [];
    
    // Eviction policy optimization
    const anomalies = this.analyzer.getAnomalies();
    const frequencyAnomalies = anomalies.filter(a => a.anomalyType === 'frequency');
    
    if (frequencyAnomalies.length > 5) {
      candidates.push({
        type: 'eviction',
        score: 0.7,
        expectedImpact: {
          hitRateImprovement: 0.12,
          responseTimeImprovement: 0.08,
          memorySavings: 0.05
        },
        risk: 'medium',
        implementation: {
          complexity: 'moderate',
          estimatedTime: 15,
          resources: ['cache', 'configuration']
        },
        reasoning: 'Multiple frequency anomalies suggest eviction policy optimization'
      });
    }
    
    return candidates;
  }

  private generateCandidateStrategies(): CacheStrategy[] {
    const strategies: CacheStrategy[] = [];
    
    // Generate variations of existing strategies
    const baseAlgorithms: CacheStrategy['algorithm'][] = ['lru', 'lfu', 'arc', '2q', 'ml_adaptive'];
    
    for (const algorithm of baseAlgorithms) {
      strategies.push({
        name: `${algorithm}_optimized`,
        algorithm,
        parameters: this.getOptimizedParameters(algorithm),
        performance: {
          hitRate: 0,
          avgResponseTime: 0,
          memoryUsage: 0,
          evictionRate: 0
        },
        confidence: 0.5,
        lastEvaluated: new Date()
      });
    }
    
    return strategies;
  }

  private getOptimizedParameters(algorithm: CacheStrategy['algorithm']): Record<string, any> {
    switch (algorithm) {
      case 'lru':
        return { threshold: 0.8, sampleSize: 100 };
      case 'lfu':
        return { threshold: 0.7, agingFactor: 0.9 };
      case 'arc':
        return { windowSize: 64, threshold: 0.75 };
      case '2q':
        return { hotQueueSize: 25, coldQueueSize: 75 };
      case 'ml_adaptive':
        return { predictionWeight: 0.6, patternWeight: 0.4 };
      default:
        return {};
    }
  }

  private async evaluateStrategy(strategy: CacheStrategy): Promise<StrategyEvaluation> {
    // Simulate strategy evaluation
    // In a real implementation, this would run actual tests
    
    const baseScore = Math.random() * 0.3 + 0.5; // 0.5 to 0.8
    const algorithmBonus = strategy.algorithm === 'ml_adaptive' ? 0.1 : 0;
    
    const performance = {
      hitRate: baseScore + algorithmBonus,
      avgResponseTime: 100 - (baseScore * 50), // Inverse relationship
      memoryUsage: 0.5 + Math.random() * 0.3,
      evictionRate: 0.1 + Math.random() * 0.2
    };
    
    const confidence = baseScore;
    let recommendation: StrategyEvaluation['recommendation'];
    let reasoning: string;
    
    if (performance.hitRate > 0.8 && confidence > 0.7) {
      recommendation = 'adopt';
      reasoning = 'High performance with good confidence';
    } else if (performance.hitRate > 0.6 && confidence > 0.5) {
      recommendation = 'test';
      reasoning = 'Moderate performance, requires A/B testing';
    } else {
      recommendation = 'reject';
      reasoning = 'Low performance or confidence';
    }
    
    return {
      strategy,
      performance,
      confidence,
      recommendation,
      reasoning
    };
  }

  private createOptimization(candidate: OptimizationCandidate): CacheOptimization {
    return {
      id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: candidate.type,
      priority: this.calculatePriority(candidate),
      description: this.generateDescription(candidate),
      expectedImpact: candidate.expectedImpact,
      implementation: {
        steps: this.generateImplementationSteps(candidate),
        estimatedTime: candidate.implementation.estimatedTime,
        rollbackPlan: this.generateRollbackPlan(candidate)
      },
      status: 'pending',
      createdAt: new Date()
    };
  }

  private calculatePriority(candidate: OptimizationCandidate): CacheOptimization['priority'] {
    if (candidate.score > 0.8) return 'critical';
    if (candidate.score > 0.6) return 'high';
    if (candidate.score > 0.4) return 'medium';
    return 'low';
  }

  private generateDescription(candidate: OptimizationCandidate): string {
    const typeDescriptions = {
      sizing: 'Optimize cache size based on usage patterns',
      eviction: 'Improve eviction policy for better hit rates',
      prefetch: 'Implement prefetching for frequently accessed items',
      compression: 'Enable compression to reduce memory usage',
      partitioning: 'Partition cache for better organization',
      ttl_adjustment: 'Adjust TTL values based on access patterns'
    };
    
    return typeDescriptions[candidate.type] || 'Generic optimization';
  }

  private generateImplementationSteps(candidate: OptimizationCandidate): string[] {
    const steps = [
      'Analyze current configuration',
      'Create backup of current settings',
      'Apply optimization changes',
      'Monitor performance metrics',
      'Validate optimization effectiveness'
    ];
    
    // Add type-specific steps
    switch (candidate.type) {
      case 'prefetch':
        steps.splice(2, 0, 'Configure prefetch rules', 'Set up prediction integration');
        break;
      case 'compression':
        steps.splice(2, 0, 'Enable compression algorithm', 'Configure compression settings');
        break;
      case 'partitioning':
        steps.splice(2, 0, 'Design partition scheme', 'Implement partition logic');
        break;
    }
    
    return steps;
  }

  private generateRollbackPlan(candidate: OptimizationCandidate): string[] {
    return [
      'Stop new optimization changes',
      'Restore previous configuration',
      'Clear affected cache entries',
      'Verify system stability',
      'Monitor performance post-rollback'
    ];
  }

  private async executeOptimization(optimization: CacheOptimization): Promise<{ success: boolean; impact: any; error?: string }> {
    try {
      // Update status
      optimization.status = 'in_progress';
      
      // Simulate optimization execution
      // In a real implementation, this would actually apply the changes
      await this.simulateOptimizationWork(optimization);
      
      // Calculate actual impact (simulated)
      const actualImpact = {
        hitRateImprovement: optimization.expectedImpact.hitRateImprovement * (0.8 + Math.random() * 0.4),
        responseTimeImprovement: optimization.expectedImpact.responseTimeImprovement * (0.8 + Math.random() * 0.4),
        memorySavings: optimization.expectedImpact.memorySavings * (0.8 + Math.random() * 0.4)
      };
      
      optimization.status = 'completed';
      optimization.completedAt = new Date();
      
      return { success: true, impact: actualImpact };

    } catch (error) {
      optimization.status = 'failed';
      return { 
        success: false, 
        impact: { hitRateImprovement: 0, responseTimeImprovement: 0, memorySavings: 0 },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async simulateOptimizationWork(optimization: CacheOptimization): Promise<void> {
    // Simulate work based on complexity
    const delay = optimization.implementation.estimatedTime * 100;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async completeABTest(testId: string): Promise<void> {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'running') {
      return;
    }
    
    // Simulate test results
    const controlMetrics = {
      hitRate: 0.6 + Math.random() * 0.2,
      avgResponseTime: 80 + Math.random() * 40,
      memoryUsage: 0.5 + Math.random() * 0.3,
      evictionRate: 0.1 + Math.random() * 0.2
    };
    
    const testMetrics = {
      hitRate: controlMetrics.hitRate + (Math.random() - 0.5) * 0.1,
      avgResponseTime: controlMetrics.avgResponseTime + (Math.random() - 0.5) * 20,
      memoryUsage: controlMetrics.memoryUsage + (Math.random() - 0.5) * 0.1,
      evictionRate: controlMetrics.evictionRate + (Math.random() - 0.5) * 0.05
    };
    
    // Determine winner
    const testScore = testMetrics.hitRate - testMetrics.avgResponseTime / 1000 - testMetrics.memoryUsage * 0.1;
    const controlScore = controlMetrics.hitRate - controlMetrics.avgResponseTime / 1000 - controlMetrics.memoryUsage * 0.1;
    
    let winner: CacheABTest['results']['winner'];
    if (testScore > controlScore * 1.05) {
      winner = 'test';
    } else if (controlScore > testScore * 1.05) {
      winner = 'control';
    } else {
      winner = 'inconclusive';
    }
    
    test.status = 'completed';
    test.endTime = new Date();
    test.results = {
      controlMetrics,
      testMetrics,
      significance: Math.abs(testScore - controlScore),
      winner,
      confidence: 0.8 + Math.random() * 0.2
    };
    
    this.emit('abTestCompleted', test);
  }
}
