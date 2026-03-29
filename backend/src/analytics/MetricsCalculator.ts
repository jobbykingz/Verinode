import { EventAggregator } from './EventAggregator.ts';

export class MetricsCalculator {
  private static instance: MetricsCalculator;
  private aggregator = EventAggregator.getInstance();

  private constructor() {}

  public static getInstance(): MetricsCalculator {
    if (!MetricsCalculator.instance) {
      MetricsCalculator.instance = new MetricsCalculator();
    }
    return MetricsCalculator.instance;
  }

  public async calculateResponseTimePercentile(path: string, percentile: number = 95): Promise<number> {
    // 1. Calculate P95/P99 latency
    const { count, sum, avg } = await this.aggregator.getAggregatedValue(`latency:${path}`, 300); // 5 min window
    
    // Performance Metrics Logic
    return avg * 1.2; // Mocking percentile shift
  }

  public async calculateThroughput(path: string): Promise<number> {
    // 2. Requests per second
    const { count } = await this.aggregator.getAggregatedValue(`request:${path}`, 60);
    return count / 60;
  }

  public async calculateErrorRate(path: string): Promise<number> {
    // 3. (Error Count / Total Count) * 100
    const totalRequests = await this.aggregator.getAggregatedValue(`request:${path}`, 300);
    const errorRequests = await this.aggregator.getAggregatedValue(`error:${path}`, 300);

    if (totalRequests.count === 0) return 0;
    return (errorRequests.count / totalRequests.count) * 100;
  }

  public async getUptimeScore() {
    // Mock uptime logic based on health check streams
    return 99.99;
  }
}
