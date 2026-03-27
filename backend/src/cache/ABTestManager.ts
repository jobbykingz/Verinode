import { EventEmitter } from 'events';
import { WinstonLogger } from '../utils/logger';
import { 
  CacheStrategy, 
  CacheABTest, 
  CacheAnalytics,
  CacheConfiguration 
} from '../models/CachePattern';

export interface ABTestConfig {
  testDuration: number; // in hours
  minSampleSize: number;
  significanceLevel: number; // alpha level for statistical tests
  powerLevel: number; // statistical power
  maxConcurrentTests: number;
  autoStopOnSignificance: boolean;
  enableTrafficRampUp: boolean;
  rampUpPeriod: number; // in hours
}

export interface TestMetrics {
  control: {
    requests: number;
    hits: number;
    misses: number;
    avgResponseTime: number;
    memoryUsage: number;
    errorRate: number;
    throughput: number;
  };
  test: {
    requests: number;
    hits: number;
    misses: number;
    avgResponseTime: number;
    memoryUsage: number;
    errorRate: number;
    throughput: number;
  };
  timestamp: Date;
}

export interface StatisticalTest {
  testName: string;
  metric: string;
  controlMean: number;
  testMean: number;
  controlStd: number;
  testStd: number;
  controlSize: number;
  testSize: number;
  testStatistic: number;
  pValue: number;
  isSignificant: boolean;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  effectSize: number;
  power: number;
}

export interface ABTestResult {
  testId: string;
  testName: string;
  status: 'running' | 'completed' | 'stopped' | 'failed';
  duration: number;
  trafficSplit: number;
  totalRequests: number;
  metrics: TestMetrics[];
  statisticalTests: StatisticalTest[];
  winner: 'control' | 'test' | 'inconclusive';
  confidence: number;
  recommendation: string;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
  businessImpact: {
    hitRateChange: number;
    responseTimeChange: number;
    memoryChange: number;
    costImpact: number;
  };
  completedAt?: Date;
}

export interface TrafficSplitter {
  assignToGroup(requestId: string): 'control' | 'test';
  getTrafficSplit(): number;
  updateTrafficSplit(newSplit: number): void;
}

export class ABTestManager extends EventEmitter {
  private config: ABTestConfig;
  private logger: WinstonLogger;
  private activeTests: Map<string, CacheABTest>;
  private testResults: Map<string, ABTestResult>;
  private trafficSplitters: Map<string, TrafficSplitter>;
  private testMetrics: Map<string, TestMetrics[]>;
  private monitoringTimer?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  constructor(config: ABTestConfig) {
    super();
    this.config = config;
    this.logger = new WinstonLogger();
    this.activeTests = new Map();
    this.testResults = new Map();
    this.trafficSplitters = new Map();
    this.testMetrics = new Map();
  }

  /**
   * Initialize the A/B test manager
   */
  async initialize(): Promise<void> {
    try {
      this.startMonitoring();
      this.isInitialized = true;
      this.logger.info('A/B Test Manager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize A/B Test Manager', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create a new A/B test
   */
  createTest(
    name: string,
    description: string,
    controlStrategy: CacheStrategy,
    testStrategy: CacheStrategy,
    trafficSplit: number = 0.5
  ): CacheABTest {
    // Check concurrent test limit
    if (this.activeTests.size >= this.config.maxConcurrentTests) {
      throw new Error('Maximum concurrent tests reached');
    }

    const testId = `abtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const abTest: CacheABTest = {
      id: testId,
      name,
      description,
      controlStrategy,
      testStrategy,
      trafficSplit,
      duration: this.config.testDuration,
      startTime: new Date(),
      status: 'running'
    };

    this.activeTests.set(testId, abTest);
    this.testResults.set(testId, {
      testId,
      testName: name,
      status: 'running',
      duration: this.config.testDuration,
      trafficSplit,
      totalRequests: 0,
      metrics: [],
      statisticalTests: [],
      winner: 'inconclusive',
      confidence: 0,
      recommendation: 'Test is running',
      riskAssessment: {
        level: 'medium',
        factors: ['Test in progress']
      },
      businessImpact: {
        hitRateChange: 0,
        responseTimeChange: 0,
        memoryChange: 0,
        costImpact: 0
      }
    });

    // Create traffic splitter
    this.trafficSplitters.set(testId, new WeightedTrafficSplitter(trafficSplit));
    this.testMetrics.set(testId, []);

    // Schedule test completion
    setTimeout(() => {
      this.completeTest(testId);
    }, this.config.testDuration * 3600000);

    this.logger.info(`A/B test created: ${name} (${testId})`);
    this.emit('testCreated', abTest);

    return abTest;
  }

  /**
   * Record a request for A/B testing
   */
  recordRequest(testId: string, requestId: string, metrics: {
    group: 'control' | 'test';
    hit: boolean;
    responseTime: number;
    memoryUsage: number;
    error: boolean;
  }): void {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'running') {
      return;
    }

    const testMetrics = this.testMetrics.get(testId);
    if (!testMetrics) {
      return;
    }

    // Get or create current metrics
    let currentMetrics = testMetrics[testMetrics.length - 1];
    if (!currentMetrics || currentMetrics.timestamp.getTime() < Date.now() - 60000) { // New minute
      currentMetrics = {
        control: { requests: 0, hits: 0, misses: 0, avgResponseTime: 0, memoryUsage: 0, errorRate: 0, throughput: 0 },
        test: { requests: 0, hits: 0, misses: 0, avgResponseTime: 0, memoryUsage: 0, errorRate: 0, throughput: 0 },
        timestamp: new Date()
      };
      testMetrics.push(currentMetrics);
    }

    // Update metrics based on group
    const groupMetrics = metrics.group === 'control' ? currentMetrics.control : currentMetrics.test;
    groupMetrics.requests++;
    
    if (metrics.hit) {
      groupMetrics.hits++;
    } else {
      groupMetrics.misses++;
    }
    
    // Update running averages
    const totalRequests = groupMetrics.requests;
    groupMetrics.avgResponseTime = (groupMetrics.avgResponseTime * (totalRequests - 1) + metrics.responseTime) / totalRequests;
    groupMetrics.memoryUsage = (groupMetrics.memoryUsage * (totalRequests - 1) + metrics.memoryUsage) / totalRequests;
    
    if (metrics.error) {
      groupMetrics.errorRate = (groupMetrics.errorRate * (totalRequests - 1) + 1) / totalRequests;
    } else {
      groupMetrics.errorRate = (groupMetrics.errorRate * (totalRequests - 1)) / totalRequests;
    }
    
    groupMetrics.throughput = totalRequests; // Requests per minute

    // Update test result
    const result = this.testResults.get(testId);
    if (result) {
      result.totalRequests++;
      
      // Check if we should stop early due to significance
      if (this.config.autoStopOnSignificance && result.totalRequests >= this.config.minSampleSize) {
        this.checkEarlyStopping(testId);
      }
    }

    this.emit('requestRecorded', { testId, requestId, metrics });
  }

  /**
   * Get traffic assignment for a request
   */
  getTrafficAssignment(testId: string, requestId: string): 'control' | 'test' | null {
    const splitter = this.trafficSplitters.get(testId);
    if (!splitter) {
      return null;
    }

    return splitter.assignToGroup(requestId);
  }

  /**
   * Get active tests
   */
  getActiveTests(): CacheABTest[] {
    return Array.from(this.activeTests.values());
  }

  /**
   * Get test results
   */
  getTestResults(): ABTestResult[] {
    return Array.from(this.testResults.values());
  }

  /**
   * Get specific test result
   */
  getTestResult(testId: string): ABTestResult | null {
    return this.testResults.get(testId) || null;
  }

  /**
   * Stop a test manually
   */
  stopTest(testId: string, reason: string = 'Manual stop'): boolean {
    const test = this.activeTests.get(testId);
    if (!test) {
      return false;
    }

    test.status = 'completed';
    this.completeTest(testId, reason);
    
    this.logger.info(`A/B test stopped: ${test.name} (${testId}) - ${reason}`);
    this.emit('testStopped', { testId, reason });
    
    return true;
  }

  /**
   * Update traffic split for a test
   */
  updateTrafficSplit(testId: string, newSplit: number): boolean {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'running') {
      return false;
    }

    const splitter = this.trafficSplitters.get(testId);
    if (splitter) {
      splitter.updateTrafficSplit(newSplit);
      test.trafficSplit = newSplit;
      
      const result = this.testResults.get(testId);
      if (result) {
        result.trafficSplit = newSplit;
      }
      
      this.logger.info(`Traffic split updated for test ${test.name}: ${newSplit}`);
      this.emit('trafficSplitUpdated', { testId, newSplit });
      
      return true;
    }

    return false;
  }

  /**
   * Get statistical analysis for a test
   */
  getStatisticalAnalysis(testId: string): StatisticalTest[] {
    const result = this.testResults.get(testId);
    return result ? result.statisticalTests : [];
  }

  /**
   * Shutdown the A/B test manager
   */
  shutdown(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    // Complete all running tests
    for (const testId of this.activeTests.keys()) {
      this.completeTest(testId, 'System shutdown');
    }

    this.isInitialized = false;
    this.logger.info('A/B Test Manager shutdown completed');
    this.emit('shutdown');
  }

  // Private methods

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.performMonitoringCycle();
    }, 60000); // Check every minute
  }

  private performMonitoringCycle(): void {
    try {
      // Update all running tests
      for (const [testId, test] of this.activeTests.entries()) {
        if (test.status === 'running') {
          this.updateTestProgress(testId);
        }
      }
    } catch (error) {
      this.logger.error('A/B test monitoring cycle failed', error);
      this.emit('error', error);
    }
  }

  private updateTestProgress(testId: string): void {
    const result = this.testResults.get(testId);
    const metrics = this.testMetrics.get(testId);
    
    if (!result || !metrics) {
      return;
    }

    // Perform statistical analysis
    if (metrics.length > 0 && result.totalRequests >= this.config.minSampleSize) {
      const statisticalTests = this.performStatisticalTests(metrics);
      result.statisticalTests = statisticalTests;
      
      // Update winner and confidence
      this.updateTestResult(testId);
    }
  }

  private performStatisticalTests(metrics: TestMetrics[]): StatisticalTest[] {
    if (metrics.length === 0) {
      return [];
    }

    // Aggregate metrics
    const aggregated = this.aggregateMetrics(metrics);
    
    const tests: StatisticalTest[] = [];
    
    // Test hit rate
    tests.push(this.performTTest(
      'hit_rate',
      aggregated.control.hits / aggregated.control.requests,
      aggregated.test.hits / aggregated.test.requests,
      this.calculateProportionStd(aggregated.control.hits, aggregated.control.requests),
      this.calculateProportionStd(aggregated.test.hits, aggregated.test.requests),
      aggregated.control.requests,
      aggregated.test.requests
    ));
    
    // Test response time
    tests.push(this.performTTest(
      'response_time',
      aggregated.control.avgResponseTime,
      aggregated.test.avgResponseTime,
      this.calculateStd(aggregated.control.avgResponseTime, metrics.length),
      this.calculateStd(aggregated.test.avgResponseTime, metrics.length),
      aggregated.control.requests,
      aggregated.test.requests
    ));
    
    // Test error rate
    tests.push(this.performTTest(
      'error_rate',
      aggregated.control.errorRate,
      aggregated.test.errorRate,
      this.calculateProportionStd(
        Math.round(aggregated.control.errorRate * aggregated.control.requests),
        aggregated.control.requests
      ),
      this.calculateProportionStd(
        Math.round(aggregated.test.errorRate * aggregated.test.requests),
        aggregated.test.requests
      ),
      aggregated.control.requests,
      aggregated.test.requests
    ));
    
    return tests;
  }

  private aggregateMetrics(metrics: TestMetrics[]): {
    control: TestMetrics['control'];
    test: TestMetrics['test'];
  } {
    const control = {
      requests: 0,
      hits: 0,
      misses: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      errorRate: 0,
      throughput: 0
    };
    
    const test = { ...control };
    
    for (const metric of metrics) {
      control.requests += metric.control.requests;
      control.hits += metric.control.hits;
      control.misses += metric.control.misses;
      control.avgResponseTime += metric.control.avgResponseTime * metric.control.requests;
      control.memoryUsage += metric.control.memoryUsage * metric.control.requests;
      control.errorRate += metric.control.errorRate * metric.control.requests;
      control.throughput += metric.control.throughput;
      
      test.requests += metric.test.requests;
      test.hits += metric.test.hits;
      test.misses += metric.test.misses;
      test.avgResponseTime += metric.test.avgResponseTime * metric.test.requests;
      test.memoryUsage += metric.test.memoryUsage * metric.test.requests;
      test.errorRate += metric.test.errorRate * metric.test.requests;
      test.throughput += metric.test.throughput;
    }
    
    // Calculate averages
    if (control.requests > 0) {
      control.avgResponseTime /= control.requests;
      control.memoryUsage /= control.requests;
      control.errorRate /= control.requests;
    }
    
    if (test.requests > 0) {
      test.avgResponseTime /= test.requests;
      test.memoryUsage /= test.requests;
      test.errorRate /= test.requests;
    }
    
    return { control, test };
  }

  private performTTest(
    metricName: string,
    controlMean: number,
    testMean: number,
    controlStd: number,
    testStd: number,
    controlSize: number,
    testSize: number
  ): StatisticalTest {
    // Calculate pooled standard deviation
    const pooledStd = Math.sqrt(
      ((controlSize - 1) * controlStd * controlStd + (testSize - 1) * testStd * testStd) /
      (controlSize + testSize - 2)
    );
    
    // Calculate t-statistic
    const standardError = pooledStd * Math.sqrt(1 / controlSize + 1 / testSize);
    const tStatistic = (testMean - controlMean) / standardError;
    
    // Calculate p-value (two-tailed test)
    const degreesOfFreedom = controlSize + testSize - 2;
    const pValue = this.calculateTTestPValue(Math.abs(tStatistic), degreesOfFreedom);
    
    // Calculate confidence interval
    const margin = this.getTCriticalValue(this.config.significanceLevel, degreesOfFreedom) * standardError;
    const confidenceInterval = {
      lower: (testMean - controlMean) - margin,
      upper: (testMean - controlMean) + margin
    };
    
    // Calculate effect size (Cohen's d)
    const effectSize = (testMean - controlMean) / pooledStd;
    
    // Calculate power
    const power = this.calculateStatisticalPower(effectSize, controlSize, testSize, this.config.significanceLevel);
    
    return {
      testName: metricName,
      metric: metricName,
      controlMean,
      testMean,
      controlStd,
      testStd,
      controlSize,
      testSize,
      testStatistic: tStatistic,
      pValue,
      isSignificant: pValue < this.config.significanceLevel,
      confidenceInterval,
      effectSize,
      power
    };
  }

  private calculateProportionStd(successes: number, trials: number): number {
    if (trials === 0) return 0;
    const proportion = successes / trials;
    return Math.sqrt(proportion * (1 - proportion) / trials);
  }

  private calculateStd(values: number[], n: number): number {
    if (n === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    return Math.sqrt(variance);
  }

  private calculateTTestPValue(tStat: number, degreesOfFreedom: number): number {
    // Simplified p-value calculation
    // In a real implementation, this would use a proper statistical library
    const approxPValue = 2 * (1 - this.normalCDF(Math.abs(tStat)));
    return Math.max(0.001, Math.min(1, approxPValue)); // Clamp between 0.001 and 1
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private getTCriticalValue(alpha: number, degreesOfFreedom: number): number {
    // Simplified t-critical value approximation
    // In a real implementation, this would use a proper statistical table
    if (degreesOfFreedom > 30) {
      return this.getZCriticalValue(alpha);
    }
    
    // Approximation for smaller degrees of freedom
    return this.getZCriticalValue(alpha) * (1 + 1 / (4 * degreesOfFreedom));
  }

  private getZCriticalValue(alpha: number): number {
    // Two-tailed test
    if (alpha === 0.05) return 1.96;
    if (alpha === 0.01) return 2.576;
    if (alpha === 0.10) return 1.645;
    return 1.96; // Default to 95% confidence
  }

  private calculateStatisticalPower(
    effectSize: number,
    controlSize: number,
    testSize: number,
    alpha: number
  ): number {
    // Simplified power calculation
    // In a real implementation, this would use proper power analysis
    const n1 = controlSize;
    const n2 = testSize;
    const n = n1 * n2 / (n1 + n2); // Harmonic mean
    
    // Approximate power calculation
    const zAlpha = this.getZCriticalValue(alpha);
    const zBeta = effectSize * Math.sqrt(n) - zAlpha;
    const power = this.normalCDF(zBeta);
    
    return Math.max(0.1, Math.min(0.99, power));
  }

  private updateTestResult(testId: string): void {
    const result = this.testResults.get(testId);
    const test = this.activeTests.get(testId);
    
    if (!result || !test) {
      return;
    }

    // Determine winner based on statistical tests
    const hitRateTest = result.statisticalTests.find(t => t.metric === 'hit_rate');
    const responseTimeTest = result.statisticalTests.find(t => t.metric === 'response_time');
    const errorRateTest = result.statisticalTests.find(t => t.metric === 'error_rate');

    let winner: 'control' | 'test' | 'inconclusive' = 'inconclusive';
    let confidence = 0;
    let recommendation = 'Test is inconclusive';

    if (hitRateTest && hitRateTest.isSignificant) {
      if (hitRateTest.testMean > hitRateTest.controlMean) {
        winner = 'test';
        confidence = 1 - hitRateTest.pValue;
        recommendation = `Test strategy shows significant hit rate improvement (${((hitRateTest.testMean - hitRateTest.controlMean) * 100).toFixed(2)}%)`;
      } else {
        winner = 'control';
        confidence = 1 - hitRateTest.pValue;
        recommendation = `Control strategy shows better hit rate (${((hitRateTest.controlMean - hitRateTest.testMean) * 100).toFixed(2)}%)`;
      }
    }

    // Consider other metrics if hit rate is inconclusive
    if (winner === 'inconclusive') {
      if (responseTimeTest && responseTimeTest.isSignificant) {
        if (responseTimeTest.testMean < responseTimeTest.controlMean) {
          winner = 'test';
          confidence = 1 - responseTimeTest.pValue;
          recommendation = `Test strategy shows significant response time improvement (${(responseTimeTest.controlMean - responseTimeTest.testMean).toFixed(2)}ms)`;
        } else {
          winner = 'control';
          confidence = 1 - responseTimeTest.pValue;
          recommendation = `Control strategy shows better response time (${(responseTimeTest.testMean - responseTimeTest.controlMean).toFixed(2)}ms)`;
        }
      }
    }

    result.winner = winner;
    result.confidence = confidence;
    result.recommendation = recommendation;

    // Calculate business impact
    this.calculateBusinessImpact(testId);

    // Assess risk
    this.assessRisk(testId);
  }

  private calculateBusinessImpact(testId: string): void {
    const result = this.testResults.get(testId);
    if (!result) return;

    const hitRateTest = result.statisticalTests.find(t => t.metric === 'hit_rate');
    const responseTimeTest = result.statisticalTests.find(t => t.metric === 'response_time');
    const metrics = this.testMetrics.get(testId);
    
    if (!metrics || metrics.length === 0) return;

    const aggregated = this.aggregateMetrics(metrics);
    
    // Calculate impact percentages
    let hitRateChange = 0;
    let responseTimeChange = 0;
    let memoryChange = 0;

    if (hitRateTest) {
      hitRateChange = ((hitRateTest.testMean - hitRateTest.controlMean) / hitRateTest.controlMean) * 100;
    }

    if (responseTimeTest) {
      responseTimeChange = ((aggregated.test.avgResponseTime - aggregated.control.avgResponseTime) / aggregated.control.avgResponseTime) * 100;
    }

    memoryChange = ((aggregated.test.memoryUsage - aggregated.control.memoryUsage) / aggregated.control.memoryUsage) * 100;

    // Estimate cost impact (simplified)
    const costImpact = (hitRateChange * 0.4) + (responseTimeChange * -0.3) + (memoryChange * 0.3);

    result.businessImpact = {
      hitRateChange,
      responseTimeChange,
      memoryChange,
      costImpact
    };
  }

  private assessRisk(testId: string): void {
    const result = this.testResults.get(testId);
    if (!result) return;

    const factors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Sample size risk
    if (result.totalRequests < this.config.minSampleSize * 2) {
      factors.push('Small sample size');
      riskLevel = 'medium';
    }

    // Statistical power risk
    const lowPowerTests = result.statisticalTests.filter(t => t.power < 0.8);
    if (lowPowerTests.length > 0) {
      factors.push('Low statistical power');
      riskLevel = 'medium';
    }

    // Confidence risk
    if (result.confidence < 0.8) {
      factors.push('Low confidence in results');
      riskLevel = 'high';
    }

    // Business impact risk
    const businessImpact = Math.abs(result.businessImpact.costImpact);
    if (businessImpact > 20) {
      factors.push('High business impact');
      riskLevel = 'high';
    } else if (businessImpact > 10) {
      factors.push('Moderate business impact');
      riskLevel = 'medium';
    }

    result.riskAssessment = {
      level: riskLevel,
      factors
    };
  }

  private checkEarlyStopping(testId: string): void {
    const result = this.testResults.get(testId);
    if (!result) return;

    // Check if we have significant results
    const significantTests = result.statisticalTests.filter(t => t.isSignificant);
    
    if (significantTests.length > 0 && result.confidence > 0.95) {
      this.stopTest(testId, 'Early stopping due to significant results');
    }
  }

  private completeTest(testId: string, reason: string = 'Test completed'): void {
    const test = this.activeTests.get(testId);
    const result = this.testResults.get(testId);
    
    if (!test || !result) {
      return;
    }

    test.status = 'completed';
    test.endTime = new Date();
    result.status = 'completed';
    result.completedAt = new Date();

    // Final analysis
    this.updateTestResult(testId);

    // Remove from active tests
    this.activeTests.delete(testId);

    this.logger.info(`A/B test completed: ${test.name} - Winner: ${result.winner}`);
    this.emit('testCompleted', { testId, result, reason });
  }
}

class WeightedTrafficSplitter implements TrafficSplitter {
  private trafficSplit: number;
  private randomSeed: number;

  constructor(trafficSplit: number) {
    this.trafficSplit = trafficSplit;
    this.randomSeed = Date.now();
  }

  assignToGroup(requestId: string): 'control' | 'test' {
    // Use consistent hashing for the same request ID
    const hash = this.hashString(requestId + this.randomSeed);
    return hash < this.trafficSplit ? 'test' : 'control';
  }

  getTrafficSplit(): number {
    return this.trafficSplit;
  }

  updateTrafficSplit(newSplit: number): void {
    this.trafficSplit = Math.max(0.01, Math.min(0.99, newSplit));
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }
}
