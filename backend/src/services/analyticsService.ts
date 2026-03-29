import { StreamProcessor } from '../analytics/StreamProcessor.ts';
import { EventAggregator } from '../analytics/EventAggregator.ts';
import { MetricsCalculator } from '../analytics/MetricsCalculator.ts';

export class AnalyticsService {
  private static instance: AnalyticsService;
  private stream = StreamProcessor.getInstance();
  private aggregator = EventAggregator.getInstance();
  private calculator = MetricsCalculator.getInstance();

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  public async trackEvent(name: string, payload: any, metadata: { latency?: number; error?: boolean }): Promise<void> {
    const timestamp = Date.now();
    
    // 1. Publish to Real-time stream
    await this.stream.publishEvent('events', { type: name, payload, timestamp });

    // 2. Window-based aggregation for latency/errors
    if (metadata.latency) {
       await this.aggregator.aggregateWindow(`latency:${name}`, metadata.latency, 300);
    }
    await this.aggregator.aggregateWindow(`request:${name}`, 1, 300);

    if (metadata.error) {
       await this.aggregator.aggregateWindow(`error:${name}`, 1, 300);
    }

    // 3. Simple per-minute frequency counts
    await this.aggregator.trackEventFrequency(name);
  }

  public async getDashboardData(path: string): Promise<{
    throughput: number;
    latencyP95: number;
    errorRate: number;
    uptime: number;
    summary: string;
  }> {
    const throughput = await this.calculator.calculateThroughput(path);
    const latencyP95 = await this.calculator.calculateResponseTimePercentile(path, 95);
    const errorRate = await this.calculator.calculateErrorRate(path);
    const uptime = await this.calculator.getUptimeScore();

    let summary = 'Normal Performance';
    if (errorRate > 5) summary = 'High Error Rate Detected';
    if (latencyP95 > 2000) summary = 'Slow Response (Latency > 2s)';

    return {
      throughput,
      latencyP95,
      errorRate,
      uptime,
      summary
    };
  }

  public async getRecentEvents(stream: string = 'events'): Promise<any[]> {
    return this.stream.consumeStream(stream, 'dashboard', 'worker-1', 20);
  }
}
