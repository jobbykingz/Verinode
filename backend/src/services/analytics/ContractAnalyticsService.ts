import { ContractMetricsModel, IContractMetrics } from '../../models/ContractMetrics';
import { EventEmitter } from 'events';

export class ContractAnalyticsService extends EventEmitter {
  private static instance: ContractAnalyticsService;

  private constructor() {
    super();
  }

  public static getInstance(): ContractAnalyticsService {
    if (!ContractAnalyticsService.instance) {
      ContractAnalyticsService.instance = new ContractAnalyticsService();
    }
    return ContractAnalyticsService.instance;
  }

  /**
   * Process and store metrics coming from Stellar/Soroban events
   */
  async processEventMetric(eventData: any): Promise<void> {
    const { user, functionName, timestamp, dataSize, contractAddress } = eventData;
    
    const metric = new ContractMetricsModel({
      contractAddress,
      userAddress: user,
      functionName,
      dataSize,
      timestamp: new Date(timestamp * 1000),
      success: true,
    });
    
    await metric.save();
    this.emit('metric:processed', metric);
  }

  /**
   * Get usage summary for a user
   */
  async getUserUsage(userAddress: string, days: number = 30): Promise<any> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const metrics = await ContractMetricsModel.aggregate([
      { $match: { userAddress, timestamp: { $gte: since } } },
      { $group: {
          _id: '$functionName',
          count: { $sum: 1 },
          totalBytes: { $sum: '$dataSize' },
          avgLatency: { $avg: '$latency_ms' }
        }
      }
    ]);

    return metrics;
  }

  /**
   * Predictive Insights: Forecast next month usage
   * This is a simple linear regression / moving average forecast
   */
  async forecastUsage(contractAddress: string): Promise<number> {
    const last3Months = await ContractMetricsModel.aggregate([
      { $match: { 
          contractAddress, 
          timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } 
      } },
      { $group: {
          _id: { 
              month: { $month: "$timestamp" },
              year: { $year: "$timestamp" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    if (last3Months.length < 2) return (last3Months[0]?.count || 0) * 1.05; // default 5% growth

    // Basic trend projection
    const counts = last3Months.map(m => m.count);
    const growth = counts[counts.length-1] / counts[counts.length-2];
    return Math.round(counts[counts.length-1] * growth);
  }

  /**
   * Automated Health Monitoring: Trigger alert on sudden latency spikes
   */
  async checkContractHealth(contractAddress: string): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    latencyTrend: number;
    errorRate: number;
  }> {
    const window = 60 * 60 * 1000; // 1 hour
    const recentMetrics = await ContractMetricsModel.find({
        contractAddress,
        timestamp: { $gte: new Date(Date.now() - window) }
    }).sort({ timestamp: -1 }).limit(10);
    
    if (recentMetrics.length === 0) return { status: 'HEALTHY', latencyTrend: 0, errorRate: 0 };
    
    const errors = recentMetrics.filter(m => !m.success).length;
    const errorRate = errors / recentMetrics.length;
    
    const avgLatency = recentMetrics.reduce((sum, m) => sum + m.latency_ms, 0) / recentMetrics.length;
    
    let status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    if (errorRate > 0.2 || avgLatency > 500) status = 'CRITICAL';
    else if (errorRate > 0.05 || avgLatency > 200) status = 'DEGRADED';
    
    return { status, latencyTrend: avgLatency, errorRate };
  }
}

export const contractAnalyticsService = ContractAnalyticsService.getInstance();
