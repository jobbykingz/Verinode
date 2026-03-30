import { EventEmitter } from 'events';
import { TestGenerator, testGenerator, GeneratedTest } from '../testing/TestGenerator';
import { ContractTester, contractTester, ValidationResult } from '../testing/ContractTester';
import { PerformanceBenchmark, performanceBenchmark, BenchmarkResult } from '../testing/PerformanceBenchmark';

export interface TestSuite {
  name: string;
  tests: GeneratedTest[];
  config?: {
    baseUrl: string;
    timeout?: number;
    retries?: number;
  };
}

export interface TestExecutionResult {
  testId: string;
  success: boolean;
  duration: number;
  error?: string;
  response?: any;
  validation?: ValidationResult;
}

export interface TestReport {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  passRate: number;
  results: TestExecutionResult[];
  benchmark?: BenchmarkResult;
  timestamp: Date;
}

/**
 * TestingService - Comprehensive API testing service
 */
export class TestingService extends EventEmitter {
  private testGenerator: TestGenerator;
  private contractTester: ContractTester;
  private performanceBenchmark: PerformanceBenchmark;
  private testSuites: Map<string, TestSuite> = new Map();
  private testResults: Map<string, TestReport> = new Map();

  constructor(
    testGeneratorInstance?: TestGenerator,
    contractTesterInstance?: ContractTester,
    performanceBenchmarkInstance?: PerformanceBenchmark
  ) {
    super();
    
    this.testGenerator = testGeneratorInstance || testGenerator;
    this.contractTester = contractTesterInstance || contractTester;
    this.performanceBenchmark = performanceBenchmarkInstance || performanceBenchmark;
  }

  /**
   * Create a test suite from API specifications
   */
  createTestSuite(name: string, apiSpecs: any[], config: TestSuite['config']): TestSuite {
    // Load API specs into test generator
    this.testGenerator.loadAPISpecs(apiSpecs);

    // Generate tests
    const tests = this.testGenerator.generateAllTests();

    const suite: TestSuite = {
      name,
      tests,
      config,
    };

    this.testSuites.set(name, suite);
    console.log(`Test suite created: ${name} with ${tests.length} tests`);
    this.emit('testSuiteCreated', { name, testCount: tests.length });

    return suite;
  }

  /**
   * Run a test suite
   */
  async runTestSuite(suiteName: string): Promise<TestReport> {
    const suite = this.testSuites.get(suiteName);
    
    if (!suite) {
      throw new Error(`Test suite not found: ${suiteName}`);
    }

    console.log(`Running test suite: ${suiteName}`);
    this.emit('testSuiteStarted', { suiteName });

    const startTime = Date.now();
    const results: TestExecutionResult[] = [];
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;

    for (const test of suite.tests) {
      try {
        const result = await this.executeTest(test, suite.config);
        results.push(result);

        if (result.success) {
          passedTests++;
        } else {
          failedTests++;
        }
      } catch (error) {
        const result: TestExecutionResult = {
          testId: test.id,
          success: false,
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        results.push(result);
        failedTests++;
      }
    }

    const totalDuration = Date.now() - startTime;
    const totalTests = passedTests + failedTests + skippedTests;

    const report: TestReport = {
      suiteName,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      totalDuration,
      passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      results,
      timestamp: new Date(),
    };

    this.testResults.set(suiteName, report);
    
    console.log(`Test suite completed: ${suiteName}`);
    console.log(`Passed: ${passedTests}, Failed: ${failedTests}, Pass Rate: ${report.passRate}%`);
    
    this.emit('testSuiteCompleted', { suiteName, report });

    return report;
  }

  /**
   * Execute a single test
   */
  private async executeTest(
    test: GeneratedTest,
    config: TestSuite['config']
  ): Promise<TestExecutionResult> {
    const startTime = Date.now();
    const baseUrl = config?.baseUrl || '';
    const url = `${baseUrl}${test.request.url}`;

    try {
      const fetchOptions: RequestInit = {
        method: test.request.method,
        headers: test.request.headers,
      };

      if (test.request.body && test.request.method !== 'GET') {
        fetchOptions.body = typeof test.request.body === 'string'
          ? test.request.body
          : JSON.stringify(test.request.body);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config?.timeout || 30000);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      const responseBody = await response.json().catch(() => response.text());

      // Validate response
      const validationResult = await this.contractTester.validateResponse(
        test.request.url,
        test.request.method,
        {
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        }
      );

      const success = response.status === test.expectedResponse.statusCode && validationResult.valid;

      return {
        testId: test.id,
        success,
        duration,
        response: responseBody,
        validation: validationResult,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        testId: test.id,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run performance benchmark
   */
  async runBenchmark(
    suiteName: string,
    endpoint: string,
    options?: Parameters<typeof performanceBenchmark.runBenchmark>[2]
  ): Promise<BenchmarkResult> {
    const suite = this.testSuites.get(suiteName);
    
    if (!suite) {
      throw new Error(`Test suite not found: ${suiteName}`);
    }

    console.log(`Running performance benchmark for suite: ${suiteName}`);
    this.emit('benchmarkStarted', { suiteName, endpoint });

    const result = await this.performanceBenchmark.runBenchmark(
      `${suiteName}_benchmark`,
      `${suite?.config?.baseUrl || ''}${endpoint}`,
      options
    );

    // Update test report with benchmark results
    const report = this.testResults.get(suiteName);
    if (report) {
      report.benchmark = result;
    }

    this.emit('benchmarkComplete', { suiteName, result });

    return result;
  }

  /**
   * Register API contract
   */
  registerContract(contract: any): void {
    this.contractTester.registerContract(contract);
  }

  /**
   * Get test report
   */
  getTestReport(suiteName?: string): TestReport | Map<string, TestReport> | null {
    if (suiteName) {
      return this.testResults.get(suiteName) || null;
    }
    return new Map(this.testResults);
  }

  /**
   * Get testing statistics
   */
  getStatistics(): {
    totalSuites: number;
    totalTests: number;
    totalExecutions: number;
    averagePassRate: number;
    totalBenchmarks: number;
  } {
    const reports = Array.from(this.testResults.values());
    
    const totalExecutions = reports.reduce((sum, r) => sum + r.totalTests, 0);
    const totalPassed = reports.reduce((sum, r) => sum + r.passedTests, 0);
    const averagePassRate = reports.length > 0
      ? reports.reduce((sum, r) => sum + r.passRate, 0) / reports.length
      : 0;

    const benchmarkResults = this.performanceBenchmark.getResults();
    const totalBenchmarks = benchmarkResults instanceof Map ? benchmarkResults.size : benchmarkResults ? 1 : 0;

    return {
      totalSuites: this.testSuites.size,
      totalTests: this.testGenerator.getGeneratedTests().length,
      totalExecutions,
      averagePassRate,
      totalBenchmarks,
    };
  }

  /**
   * Generate comprehensive test report
   */
  generateReport(suiteName?: string): string {
    const stats = this.getStatistics();
    let report = `
=== API Testing Report ===

Test Suites: ${stats.totalSuites}
Total Tests: ${stats.totalTests}
Total Executions: ${stats.totalExecutions}
Average Pass Rate: ${stats.averagePassRate.toFixed(2)}%
Total Benchmarks: ${stats.totalBenchmarks}

`;

    if (suiteName) {
      const report_data = this.testResults.get(suiteName);
      if (report_data) {
        report += `
Suite: ${suiteName}
------------------------
Total Tests: ${report_data.totalTests}
Passed: ${report_data.passedTests}
Failed: ${report_data.failedTests}
Pass Rate: ${report_data.passRate.toFixed(2)}%
Duration: ${report_data.totalDuration}ms

`;

        if (report_data.benchmark) {
          report += `
Performance Metrics:
- Requests/sec: ${report_data.benchmark.requestsPerSecond.toFixed(2)}
- Avg Latency: ${report_data.benchmark.latency.avg.toFixed(2)}ms
- P95 Latency: ${report_data.benchmark.latency.p95.toFixed(2)}ms
- Success Rate: ${(report_data.benchmark.successfulRequests / report_data.benchmark.totalRequests) * 100}%
`;
        }
      }
    }

    return report;
  }

  /**
   * Clear test results
   */
  clearResults(suiteName?: string): void {
    if (suiteName) {
      this.testResults.delete(suiteName);
    } else {
      this.testResults.clear();
    }
    
    this.performanceBenchmark.clearResults();
    this.contractTester.clearHistory();
  }
}

export const testingService = new TestingService();
