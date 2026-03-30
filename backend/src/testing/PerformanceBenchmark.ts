import { EventEmitter } from 'events';

export interface BenchmarkConfig {
  duration: number; // in seconds
  requestsPerSecond: number;
  concurrentUsers: number;
  rampUpTime: number; // in seconds
  enableLatencyTracking: boolean;
}

export interface BenchmarkResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerSecond: number;
  latency: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  errors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
  startTime: number;
  endTime: number;
}

/**
 * PerformanceBenchmark - Performance benchmarking and load testing
 */
export class PerformanceBenchmark extends EventEmitter {
  private config: BenchmarkConfig;
  private results: Map<string, BenchmarkResult> = new Map();
  private isRunning: boolean = false;
  private latencySamples: Map<string, number[]> = new Map();

  constructor(config?: Partial<BenchmarkConfig>) {
    super();
    
    this.config = {
      duration: 60,
      requestsPerSecond: 100,
      concurrentUsers: 10,
      rampUpTime: 10,
      enableLatencyTracking: true,
      ...config,
    };
  }

  /**
   * Run benchmark for an endpoint
   */
  async runBenchmark(
    name: string,
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ): Promise<BenchmarkResult> {
    if (this.isRunning) {
      throw new Error('Benchmark is already running');
    }

    this.isRunning = true;
    this.latencySamples.set(name, []);
    
    console.log(`Starting benchmark: ${name}`);
    this.emit('benchmarkStarted', { name, endpoint, config: this.config });

    const startTime = Date.now();
    const result: BenchmarkResult = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      requestsPerSecond: 0,
      latency: {
        min: Infinity,
        max: 0,
        avg: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      },
      errors: [],
      startTime,
      endTime: 0,
    };

    const errorCounts = new Map<string, number>();
    const requestPromises: Promise<void>[] = [];

    // Calculate total requests
    const totalRequests = this.config.requestsPerSecond * this.config.duration;
    const delayBetweenRequests = 1000 / this.config.requestsPerSecond;

    // Ramp up phase
    const rampUpDelay = this.config.rampUpTime / this.config.concurrentUsers;
    
    for (let i = 0; i < totalRequests; i++) {
      // Apply ramp up delay
      if (i < this.config.concurrentUsers) {
        await new Promise(resolve => setTimeout(resolve, rampUpDelay * i));
      }

      const promise = this.executeRequest(
        endpoint,
        {
          method: options.method || 'GET',
          headers: options.headers,
          body: options.body,
        },
        name,
        errorCounts
      ).then((latency) => {
        result.totalRequests++;
        
        if (latency >= 0) {
          result.successfulRequests++;
          
          if (this.config.enableLatencyTracking && latency !== null) {
            this.recordLatency(name, latency);
          }
        } else {
          result.failedRequests++;
        }
      });

      requestPromises.push(promise);

      // Control request rate
      if (delayBetweenRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }

    // Wait for all requests to complete
    await Promise.all(requestPromises);

    // Calculate final statistics
    const endTime = Date.now();
    result.endTime = endTime;
    result.requestsPerSecond = result.totalRequests / ((endTime - startTime) / 1000);

    // Calculate latency percentiles
    if (this.config.enableLatencyTracking) {
      result.latency = this.calculateLatencyPercentiles(name);
    }

    // Format errors
    result.errors = this.formatErrors(errorCounts, result.totalRequests);

    this.results.set(name, result);
    this.isRunning = false;

    console.log(`Benchmark completed: ${name}`);
    console.log(`Total requests: ${result.totalRequests}`);
    console.log(`Requests/sec: ${result.requestsPerSecond}`);
    console.log(`Success rate: ${(result.successfulRequests / result.totalRequests) * 100}%`);

    this.emit('benchmarkComplete', { name, result });

    return result;
  }

  /**
   * Execute a single request
   */
  private async executeRequest(
    endpoint: string,
    options: {
      method: string;
      headers?: Record<string, string>;
      body?: any;
    },
    benchmarkName: string,
    errorCounts: Map<string, number>
  ): Promise<number> {
    const startTime = Date.now();

    try {
      const fetchOptions: RequestInit = {
        method: options.method,
        headers: options.headers,
      };

      if (options.body && options.method !== 'GET') {
        fetchOptions.body = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
      }

      const response = await fetch(endpoint, fetchOptions);
      const latency = Date.now() - startTime;

      if (!response.ok) {
        const error = `HTTP ${response.status}`;
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
        return -1;
      }

      return latency;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errorCounts.set(errorMessage, (errorCounts.get(errorMessage) || 0) + 1);
      return -1;
    }
  }

  /**
   * Record latency sample
   */
  private recordLatency(benchmarkName: string, latency: number): void {
    const samples = this.latencySamples.get(benchmarkName) || [];
    samples.push(latency);
    this.latencySamples.set(benchmarkName, samples);
  }

  /**
   * Calculate latency percentiles
   */
  private calculateLatencyPercentiles(benchmarkName: string): BenchmarkResult['latency'] {
    const samples = this.latencySamples.get(benchmarkName) || [];
    
    if (samples.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      };
    }

    // Sort samples
    samples.sort((a, b) => a - b);

    const min = samples[0];
    const max = samples[samples.length - 1];
    const avg = samples.reduce((sum, val) => sum + val, 0) / samples.length;

    return {
      min,
      max,
      avg,
      p50: this.percentile(samples, 50),
      p90: this.percentile(samples, 90),
      p95: this.percentile(samples, 95),
      p99: this.percentile(samples, 99),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedSamples: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedSamples.length) - 1;
    return sortedSamples[Math.max(0, index)];
  }

  /**
   * Format error statistics
   */
  private formatErrors(
    errorCounts: Map<string, number>,
    totalRequests: number
  ): BenchmarkResult['errors'] {
    const errors: BenchmarkResult['errors'] = [];

    for (const [error, count] of errorCounts.entries()) {
      errors.push({
        error,
        count,
        percentage: (count / totalRequests) * 100,
      });
    }

    return errors;
  }

  /**
   * Get benchmark results
   */
  getResults(benchmarkName?: string): BenchmarkResult | Map<string, BenchmarkResult> | null {
    if (benchmarkName) {
      return this.results.get(benchmarkName) || null;
    }
    return new Map(this.results);
  }

  /**
   * Compare two benchmark results
   */
  compareBenchmarks(name1: string, name2: string): {
    improvement: number;
    rpsChange: number;
    latencyChange: number;
  } | null {
    const result1 = this.results.get(name1);
    const result2 = this.results.get(name2);

    if (!result1 || !result2) {
      return null;
    }

    const rpsChange = result2.requestsPerSecond - result1.requestsPerSecond;
    const latencyChange = result2.latency.avg - result1.latency.avg;
    const improvement = ((result2.requestsPerSecond / result1.requestsPerSecond) - 1) * 100;

    return {
      improvement,
      rpsChange,
      latencyChange,
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    totalBenchmarks: number;
    averageRPS: number;
    averageLatency: number;
    overallSuccessRate: number;
  } {
    const results = Array.from(this.results.values());
    
    if (results.length === 0) {
      return {
        totalBenchmarks: 0,
        averageRPS: 0,
        averageLatency: 0,
        overallSuccessRate: 0,
      };
    }

    const totalRPS = results.reduce((sum, r) => sum + r.requestsPerSecond, 0);
    const totalLatency = results.reduce((sum, r) => sum + r.latency.avg, 0);
    const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalSuccessful = results.reduce((sum, r) => sum + r.successfulRequests, 0);

    return {
      totalBenchmarks: results.length,
      averageRPS: totalRPS / results.length,
      averageLatency: totalLatency / results.length,
      overallSuccessRate: (totalSuccessful / totalRequests) * 100,
    };
  }

  /**
   * Clear benchmark results
   */
  clearResults(benchmarkName?: string): void {
    if (benchmarkName) {
      this.results.delete(benchmarkName);
      this.latencySamples.delete(benchmarkName);
    } else {
      this.results.clear();
      this.latencySamples.clear();
    }
  }

  /**
   * Check if benchmark is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Update benchmark configuration
   */
  updateConfig(config: Partial<BenchmarkConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('Benchmark configuration updated');
    this.emit('configUpdated', { config: this.config });
  }
}

export const performanceBenchmark = new PerformanceBenchmark();
