import { ethers } from 'ethers';
import { CrossChainService } from './crossChainService';

export interface GasOptimization {
  originalGasPrice: number;
  optimizedGasPrice: number;
  savings: number;
  savingsPercentage: number;
  optimizationStrategy: string;
}

export interface GasEstimate {
  gasLimit: number;
  gasPrice: number;
  totalCost: string;
  optimizedCost: string;
  optimization: GasOptimization;
}

export interface ChainGasData {
  chainId: number;
  currentGasPrice: number;
  baseFee: number;
  priorityFee: number;
  blockNumber: number;
  utilization: number;
  historicalPrices: number[];
}

export interface OptimizationStrategy {
  name: string;
  description: string;
  minSavings: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  applicableChains: number[];
}

export class GasOptimizer {
  private crossChainService: CrossChainService;
  private gasData: Map<number, ChainGasData> = new Map();
  private optimizationStrategies: OptimizationStrategy[] = [];
  private historicalData: Map<number, number[]> = new Map();

  constructor(crossChainService: CrossChainService) {
    this.crossChainService = crossChainService;
    this.initializeOptimizationStrategies();
    this.startGasDataCollection();
  }

  private initializeOptimizationStrategies() {
    this.optimizationStrategies = [
      {
        name: 'EIP-1559 Dynamic Fee',
        description: 'Use EIP-1559 base fee with dynamic priority fee',
        minSavings: 10,
        riskLevel: 'Low',
        applicableChains: [1, 137, 56]
      },
      {
        name: 'Off-Peak Timing',
        description: 'Execute transactions during low network utilization',
        minSavings: 25,
        riskLevel: 'Low',
        applicableChains: [1, 137, 56]
      },
      {
        name: 'Batch Processing',
        description: 'Combine multiple operations into single transaction',
        minSavings: 40,
        riskLevel: 'Medium',
        applicableChains: [1, 137, 56]
      },
      {
        name: 'Layer 2 Routing',
        description: 'Route through cheaper layer 2 solutions when possible',
        minSavings: 50,
        riskLevel: 'Medium',
        applicableChains: [1]
      },
      {
        name: 'Predictive Pricing',
        description: 'Use ML to predict optimal gas prices',
        minSavings: 35,
        riskLevel: 'High',
        applicableChains: [1, 137, 56]
      }
    ];
  }

  private startGasDataCollection() {
    // Collect gas data every 30 seconds
    setInterval(async () => {
      await this.collectGasData();
    }, 30000);
  }

  private async collectGasData() {
    const supportedChains = this.crossChainService.getSupportedChains();
    
    for (const chainId of supportedChains) {
      try {
        const chainStatus = await this.crossChainService.getChainStatus(chainId);
        const gasPrice = parseFloat(chainStatus.gasPrice);
        
        // Update historical data
        const historical = this.historicalData.get(chainId) || [];
        historical.push(gasPrice);
        
        // Keep only last 100 data points
        if (historical.length > 100) {
          historical.shift();
        }
        
        this.historicalData.set(chainId, historical);
        
        // Update current gas data
        this.gasData.set(chainId, {
          chainId,
          currentGasPrice: gasPrice,
          baseFee: Math.floor(gasPrice * 0.7), // Simplified base fee calculation
          priorityFee: Math.floor(gasPrice * 0.3), // Simplified priority fee calculation
          blockNumber: chainStatus.blockNumber,
          utilization: this.calculateUtilization(gasPrice, historical),
          historicalPrices: [...historical]
        });
      } catch (error) {
        console.error(`Failed to collect gas data for chain ${chainId}:`, error);
      }
    }
  }

  private calculateUtilization(currentPrice: number, historical: number[]): number {
    if (historical.length < 10) return 50; // Default utilization
    
    const avg = historical.reduce((sum, price) => sum + price, 0) / historical.length;
    const max = Math.max(...historical);
    const min = Math.min(...historical);
    
    // Normalize utilization between 0-100
    const utilization = ((currentPrice - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, utilization));
  }

  public async optimizeGasPrice(
    chainId: number,
    urgency: 'Low' | 'Medium' | 'High' = 'Medium',
    maxWaitTime: number = 300 // 5 minutes
  ): Promise<GasOptimization> {
    try {
      const gasData = this.gasData.get(chainId);
      if (!gasData) {
        throw new Error(`Gas data not available for chain ${chainId}`);
      }

      const originalGasPrice = gasData.currentGasPrice;
      let optimizedGasPrice = originalGasPrice;
      let bestStrategy = 'None';

      // Apply optimization strategies based on urgency and chain
      for (const strategy of this.optimizationStrategies) {
        if (!strategy.applicableChains.includes(chainId)) continue;
        
        const optimizedPrice = await this.applyOptimizationStrategy(
          strategy,
          gasData,
          urgency,
          maxWaitTime
        );
        
        if (optimizedPrice < optimizedGasPrice) {
          optimizedGasPrice = optimizedPrice;
          bestStrategy = strategy.name;
        }
      }

      const savings = originalGasPrice - optimizedGasPrice;
      const savingsPercentage = (savings / originalGasPrice) * 100;

      return {
        originalGasPrice,
        optimizedGasPrice,
        savings,
        savingsPercentage,
        optimizationStrategy: bestStrategy
      };
    } catch (error) {
      console.error('Failed to optimize gas price:', error);
      throw error;
    }
  }

  private async applyOptimizationStrategy(
    strategy: OptimizationStrategy,
    gasData: ChainGasData,
    urgency: 'Low' | 'Medium' | 'High',
    maxWaitTime: number
  ): Promise<number> {
    switch (strategy.name) {
      case 'EIP-1559 Dynamic Fee':
        return this.optimizeEIP1559(gasData, urgency);
      
      case 'Off-Peak Timing':
        return this.optimizeOffPeak(gasData, urgency, maxWaitTime);
      
      case 'Batch Processing':
        return this.optimizeBatch(gasData);
      
      case 'Layer 2 Routing':
        return this.optimizeLayer2(gasData);
      
      case 'Predictive Pricing':
        return this.optimizePredictive(gasData, urgency);
      
      default:
        return gasData.currentGasPrice;
    }
  }

  private optimizeEIP1559(gasData: ChainGasData, urgency: 'Low' | 'Medium' | 'High'): number {
    const baseFee = gasData.baseFee;
    let priorityFee = gasData.priorityFee;
    
    // Adjust priority fee based on urgency
    switch (urgency) {
      case 'Low':
        priorityFee = Math.floor(priorityFee * 0.5);
        break;
      case 'Medium':
        priorityFee = Math.floor(priorityFee * 0.8);
        break;
      case 'High':
        priorityFee = Math.floor(priorityFee * 1.2);
        break;
    }
    
    return baseFee + priorityFee;
  }

  private optimizeOffPeak(gasData: ChainGasData, urgency: 'Low' | 'Medium' | 'High', maxWaitTime: number): number {
    const utilization = gasData.utilization;
    let discount = 0;
    
    // Calculate discount based on utilization
    if (utilization < 30) {
      discount = 0.5; // 50% discount
    } else if (utilization < 50) {
      discount = 0.3; // 30% discount
    } else if (utilization < 70) {
      discount = 0.15; // 15% discount
    }
    
    // Adjust for urgency
    switch (urgency) {
      case 'Low':
        discount *= 1.5;
        break;
      case 'Medium':
        discount *= 1.0;
        break;
      case 'High':
        discount *= 0.5;
        break;
    }
    
    return Math.floor(gasData.currentGasPrice * (1 - discount));
  }

  private optimizeBatch(gasData: ChainGasData): number {
    // Batch transactions can share gas costs
    const batchDiscount = 0.4; // 40% discount for batching
    return Math.floor(gasData.currentGasPrice * (1 - batchDiscount));
  }

  private optimizeLayer2(gasData: ChainGasData): number {
    // Route through layer 2 solutions (simplified)
    const l2Discount = 0.7; // 70% discount for L2
    return Math.floor(gasData.currentGasPrice * (1 - l2Discount));
  }

  private optimizePredictive(gasData: ChainGasData, urgency: 'Low' | 'Medium' | 'High'): number {
    // Simplified predictive pricing using historical data
    const historical = gasData.historicalPrices;
    if (historical.length < 10) return gasData.currentGasPrice;
    
    // Calculate trend
    const recent = historical.slice(-5);
    const older = historical.slice(-10, -5);
    const recentAvg = recent.reduce((sum, price) => sum + price, 0) / recent.length;
    const olderAvg = older.reduce((sum, price) => sum + price, 0) / older.length;
    
    let predictedPrice = gasData.currentGasPrice;
    
    if (recentAvg < olderAvg) {
      // Prices are trending down, predict lower price
      predictedPrice = Math.floor(gasData.currentGasPrice * 0.85);
    } else if (recentAvg > olderAvg) {
      // Prices are trending up, predict higher price
      predictedPrice = Math.floor(gasData.currentGasPrice * 1.1);
    }
    
    // Adjust for urgency
    switch (urgency) {
      case 'Low':
        predictedPrice = Math.floor(predictedPrice * 0.8);
        break;
      case 'Medium':
        predictedPrice = Math.floor(predictedPrice * 0.95);
        break;
      case 'High':
        predictedPrice = Math.floor(predictedPrice * 1.1);
        break;
    }
    
    return predictedPrice;
  }

  public async estimateGasWithOptimization(
    chainId: number,
    functionName: string,
    params: any[],
    urgency: 'Low' | 'Medium' | 'High' = 'Medium'
  ): Promise<GasEstimate> {
    try {
      // Get original gas estimate
      const originalCost = await this.crossChainService.estimateGasCost(chainId, functionName, params);
      const gasData = this.gasData.get(chainId);
      
      if (!gasData) {
        throw new Error(`Gas data not available for chain ${chainId}`);
      }

      // Get optimized gas price
      const optimization = await this.optimizeGasPrice(chainId, urgency);
      
      // Calculate optimized cost
      const gasLimit = 200000; // Simplified gas limit
      const originalTotalCost = parseFloat(originalCost);
      const optimizedTotalCost = (optimization.optimizedGasPrice / gasData.currentGasPrice) * originalTotalCost;
      
      return {
        gasLimit,
        gasPrice: gasData.currentGasPrice,
        totalCost: originalCost,
        optimizedCost: optimizedTotalCost.toFixed(6),
        optimization
      };
    } catch (error) {
      console.error('Failed to estimate gas with optimization:', error);
      throw error;
    }
  }

  public async getGasSavingsReport(chainId: number, timeRange: number = 24): Promise<any> {
    try {
      const gasData = this.gasData.get(chainId);
      if (!gasData) {
        throw new Error(`Gas data not available for chain ${chainId}`);
      }

      const historical = gasData.historicalPrices.slice(-timeRange);
      if (historical.length === 0) {
        return {
          chainId,
          timeRange,
          totalSavings: 0,
          averageSavings: 0,
          optimizationOpportunities: 0
        };
      }

      // Calculate potential savings for each historical point
      let totalSavings = 0;
      let optimizationOpportunities = 0;

      for (const price of historical) {
        const optimization = await this.optimizeGasPrice(chainId, 'Medium');
        const savings = price - optimization.optimizedGasPrice;
        
        if (savings > 0) {
          totalSavings += savings;
          optimizationOpportunities++;
        }
      }

      const averageSavings = optimizationOpportunities > 0 ? totalSavings / optimizationOpportunities : 0;

      return {
        chainId,
        timeRange,
        totalSavings,
        averageSavings,
        optimizationOpportunities,
        dataPoints: historical.length,
        averageGasPrice: historical.reduce((sum, price) => sum + price, 0) / historical.length
      };
    } catch (error) {
      console.error('Failed to get gas savings report:', error);
      throw error;
    }
  }

  public getGasData(chainId: number): ChainGasData | undefined {
    return this.gasData.get(chainId);
  }

  public getOptimizationStrategies(): OptimizationStrategy[] {
    return this.optimizationStrategies;
  }

  public async getBestOptimizationTime(chainId: number, timeWindow: number = 24): Promise<any> {
    try {
      const gasData = this.gasData.get(chainId);
      if (!gasData) {
        throw new Error(`Gas data not available for chain ${chainId}`);
      }

      const historical = gasData.historicalPrices.slice(-timeWindow);
      if (historical.length === 0) {
        return { bestTime: 'Unknown', expectedSavings: 0 };
      }

      // Find the time with lowest gas prices (simplified)
      const minPrice = Math.min(...historical);
      const minIndex = historical.indexOf(minPrice);
      
      // Calculate expected savings
      const currentPrice = gasData.currentGasPrice;
      const expectedSavings = ((currentPrice - minPrice) / currentPrice) * 100;

      return {
        bestTime: `Hour ${minIndex}`,
        expectedSavings,
        minPrice,
        currentPrice
      };
    } catch (error) {
      console.error('Failed to get best optimization time:', error);
      throw error;
    }
  }

  public async setCustomOptimizationStrategy(
    chainId: number,
    strategy: Partial<OptimizationStrategy>
  ): Promise<void> {
    const customStrategy: OptimizationStrategy = {
      name: strategy.name || 'Custom',
      description: strategy.description || 'Custom optimization strategy',
      minSavings: strategy.minSavings || 10,
      riskLevel: strategy.riskLevel || 'Medium',
      applicableChains: strategy.applicableChains || [chainId]
    };

    this.optimizationStrategies.push(customStrategy);
  }

  public getHistoricalGasData(chainId: number, limit: number = 100): number[] {
    const historical = this.historicalData.get(chainId) || [];
    return historical.slice(-limit);
  }
}
