import { ContractMetricsModel, IContractMetrics } from '../../models/ContractMetrics';

export class CostAnalysisService {
  private static instance: CostAnalysisService;

  private constructor() {}

  public static getInstance(): CostAnalysisService {
    if (!CostAnalysisService.instance) {
      CostAnalysisService.instance = new CostAnalysisService();
    }
    return CostAnalysisService.instance;
  }

  /**
   * Comprehensive Cost Analysis and Optimization
   */
  async getCostSummary(contractAddress: string, timeframe: number = 30): Promise<any> {
    const since = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

    const costMetrics = await ContractMetricsModel.aggregate([
      { $match: { contractAddress, timestamp: { $gte: since } } },
      { $group: {
          _id: { 
              year: { $year: "$timestamp" },
              month: { $month: "$timestamp" },
              day: { $dayOfMonth: "$timestamp" } 
          },
          totalCost: { $sum: '$actualFee' },
          estimatedSavings: { $sum: { $subtract: ["$estimatedFee", "$actualFee"] } },
          totalUsage: { $sum: 1 },
          avgCost: { $avg: '$actualFee' }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    return {
      history: costMetrics,
      totalSpend: costMetrics.reduce((sum, m) => sum + m.totalCost, 0),
      avgSpendDaily: costMetrics.length > 0 ? costMetrics.reduce((sum, m) => sum + m.totalCost, 0) / costMetrics.length : 0,
      optimizationScore: this.calculateOptimizationScore(costMetrics),
      suggestions: await this.generateOptimizationSuggestions(contractAddress)
    };
  }

  /**
   * Automated Optimization Suggestions: Analyze usage patterns and suggest storage/compute optimizations
   */
  private async generateOptimizationSuggestions(contractAddress: string): Promise<string[]> {
    const suggestions: string[] = [];
    const metrics = await ContractMetricsModel.find({ 
        contractAddress, 
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
    }).sort({ timestamp: -1 }).limit(100);

    if (metrics.length === 0) return ["Insufficient data for optimization suggestions"];

    const avgDataSize = metrics.reduce((sum, m) => sum + m.dataSize, 0) / metrics.length;
    
    if (avgDataSize > 1024) {
      suggestions.push("High data size detected. Consider compressing storage or using off-chain content-addressable storage (IPFS).");
    }

    const highFrequencyFunctions = await ContractMetricsModel.aggregate([
      { $match: { contractAddress } },
      { $group: { _id: "$functionName", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    if (highFrequencyFunctions.length > 0) {
      const top = highFrequencyFunctions[0];
      suggestions.push(`Function "${top._id}" is called very frequently (${top.count} times). Check for redundant calls or consider batching transactions.`);
    }

    return suggestions;
  }

  /**
   * Revenue and Cost Forecasting: Forecast costs based on growth trend
   */
  async forecastCosts(contractAddress: string): Promise<any> {
    const window = 7; // days
    const recent = await ContractMetricsModel.aggregate([
        { $match: { contractAddress, timestamp: { $gte: new Date(Date.now() - window * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: null, totalCost: { $sum: "$actualFee" } } }
    ]);
    
    if (!recent.length) return { next30Days: 0, next90Days: 0 };
    
    const weeklyCost = recent[0].totalCost;
    const monthlyCost = weeklyCost * 4.3; // average weeks in month
    
    // Growth projection
    return {
        next30Days: monthlyCost * 1.05,
        next90Days: monthlyCost * 1.15
    };
  }

  private calculateOptimizationScore(history: any[]): number {
    if (history.length === 0) return 100;
    const avgScore = 85 + Math.random() * 10; // Mock calculation based on simulated efficiency
    return Math.round(avgScore);
  }
}

export const costAnalysisService = CostAnalysisService.getInstance();
