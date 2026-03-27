import { ethers } from 'ethers';

export interface GasOptimizationResult {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
  optimizedCost: string;
  savings: string;
  savingsPercentage: number;
  optimizationStrategy: 'conservative' | 'balanced' | 'aggressive';
  confidence: number;
}

export interface ChainGasConfig {
  chainId: number;
  baseGasPrice: number;
  priorityFee: number;
  maxGasPrice: number;
  gasMultiplier: number;
  optimizationEnabled: boolean;
  eip1559Enabled: boolean;
  blockTime: number;
  targetBlockTime: number;
}

export interface GasHistory {
  timestamp: number;
  gasPrice: number;
  blockNumber: number;
  utilization: number;
}

export interface GasPrediction {
  predictedGasPrice: number;
  confidence: number;
  timeWindow: number;
  recommendation: 'wait' | 'proceed' | 'urgent';
}

export class GasOptimizer {
  private chainConfigs: Map<number, ChainGasConfig> = new Map();
  private gasHistory: Map<number, GasHistory[]> = new Map();
  private providers: Map<number, ethers.providers.JsonRpcProvider> = new Map();
  private optimizationCache: Map<string, GasOptimizationResult> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor() {
    this.initializeChainConfigs();
  }

  private initializeChainConfigs(): void {
    const configs: ChainGasConfig[] = [
      {
        chainId: 1, // Ethereum
        baseGasPrice: 20e9, // 20 gwei
        priorityFee: 2e9, // 2 gwei
        maxGasPrice: 100e9, // 100 gwei
        gasMultiplier: 1.1,
        optimizationEnabled: true,
        eip1559Enabled: true,
        blockTime: 12000,
        targetBlockTime: 12000
      },
      {
        chainId: 137, // Polygon
        baseGasPrice: 30e9, // 30 gwei
        priorityFee: 30e9, // 30 gwei
        maxGasPrice: 200e9, // 200 gwei
        gasMultiplier: 1.2,
        optimizationEnabled: true,
        eip1559Enabled: true,
        blockTime: 2000,
        targetBlockTime: 2000
      },
      {
        chainId: 56, // BSC
        baseGasPrice: 5e9, // 5 gwei
        priorityFee: 1e9, // 1 gwei
        maxGasPrice: 20e9, // 20 gwei
        gasMultiplier: 1.05,
        optimizationEnabled: true,
        eip1559Enabled: false,
        blockTime: 3000,
        targetBlockTime: 3000
      }
    ];

    configs.forEach(config => {
      this.chainConfigs.set(config.chainId, config);
      this.gasHistory.set(config.chainId, []);
      this.initializeProvider(config.chainId);
    });
  }

  private initializeProvider(chainId: number): void {
    const rpcUrls: { [key: number]: string } = {
      1: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
      137: 'https://polygon-rpc.com',
      56: 'https://bsc-dataseed.binance.org'
    };

    const rpcUrl = rpcUrls[chainId];
    if (rpcUrl) {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      this.providers.set(chainId, provider);
    }
  }

  public async optimizeGas(
    chainId: number,
    amount: string,
    strategy: 'conservative' | 'balanced' | 'aggressive' = 'balanced'
  ): Promise<GasOptimizationResult> {
    const cacheKey = `${chainId}_${amount}_${strategy}`;
    const cached = this.optimizationCache.get(cacheKey);

    if (cached && Date.now() - cached.estimatedCost.length < this.CACHE_DURATION) {
      return cached;
    }

    const config = this.chainConfigs.get(chainId);
    if (!config || !config.optimizationEnabled) {
      throw new Error(`Gas optimization not available for chain ${chainId}`);
    }

    try {
      const currentGasPrice = await this.getCurrentGasPrice(chainId);
      const predictedGasPrice = await this.predictGasPrice(chainId);
      
      const optimizedGasPrice = this.calculateOptimizedGasPrice(
        currentGasPrice,
        predictedGasPrice,
        config,
        strategy
      );

      const gasLimit = await this.estimateGasLimit(chainId, amount);
      const estimatedCost = this.calculateGasCost(gasLimit, currentGasPrice);
      const optimizedCost = this.calculateGasCost(gasLimit, optimizedGasPrice);

      const result: GasOptimizationResult = {
        gasLimit: gasLimit.toString(),
        gasPrice: optimizedGasPrice.toString(),
        maxFeePerGas: config.eip1559Enabled ? 
          (optimizedGasPrice + config.priorityFee).toString() : undefined,
        maxPriorityFeePerGas: config.eip1559Enabled ? 
          config.priorityFee.toString() : undefined,
        estimatedCost: ethers.utils.formatEther(estimatedCost),
        optimizedCost: ethers.utils.formatEther(optimizedCost),
        savings: ethers.utils.formatEther(estimatedCost.sub(optimizedCost)),
        savingsPercentage: Number(((estimatedCost.sub(optimizedCost)).mul(10000).div(estimatedCost)) / 100),
        optimizationStrategy: strategy,
        confidence: this.calculateConfidence(currentGasPrice, predictedGasPrice)
      };

      this.optimizationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      throw new Error(`Failed to optimize gas: ${error}`);
    }
  }

  public async estimateGasFee(
    fromChain: number,
    toChain: number,
    amount: string,
    tokenAddress: string
  ): Promise<{
    gasLimit: string;
    gasPrice: string;
    totalCost: string;
    optimizedCost: string;
  }> {
    const fromChainConfig = this.chainConfigs.get(fromChain);
    if (!fromChainConfig) {
      throw new Error(`Chain ${fromChain} not supported`);
    }

    try {
      const gasLimit = await this.estimateGasLimit(fromChain, amount);
      const currentGasPrice = await this.getCurrentGasPrice(fromChain);
      const optimized = await this.optimizeGas(fromChain, amount);

      const baseCost = this.calculateGasCost(gasLimit, currentGasPrice);
      const optimizedCost = this.calculateGasCost(gasLimit, BigInt(optimized.gasPrice));

      return {
        gasLimit: gasLimit.toString(),
        gasPrice: currentGasPrice.toString(),
        totalCost: ethers.utils.formatEther(baseCost),
        optimizedCost: ethers.utils.formatEther(optimizedCost)
      };
    } catch (error) {
      throw new Error(`Failed to estimate gas fee: ${error}`);
    }
  }

  private async getCurrentGasPrice(chainId: number): Promise<bigint> {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not found for chain ${chainId}`);
    }

    try {
      const gasPrice = await provider.getGasPrice();
      await this.recordGasHistory(chainId, Number(gasPrice));
      return gasPrice.toBigInt();
    } catch (error) {
      const config = this.chainConfigs.get(chainId);
      if (config) {
        return BigInt(config.baseGasPrice);
      }
      throw error;
    }
  }

  private async predictGasPrice(chainId: number): Promise<number> {
    const history = this.gasHistory.get(chainId);
    if (!history || history.length < 10) {
      const config = this.chainConfigs.get(chainId);
      return config ? config.baseGasPrice : 20e9;
    }

    const recentHistory = history.slice(-20);
    const avgGasPrice = recentHistory.reduce((sum, h) => sum + h.gasPrice, 0) / recentHistory.length;
    
    const trend = this.calculateGasTrend(recentHistory);
    const predictedPrice = avgGasPrice * (1 + trend);

    const config = this.chainConfigs.get(chainId);
    if (config) {
      return Math.min(Math.max(predictedPrice, config.baseGasPrice), config.maxGasPrice);
    }

    return predictedPrice;
  }

  private calculateGasTrend(history: GasHistory[]): number {
    if (history.length < 2) return 0;

    let trend = 0;
    for (let i = 1; i < history.length; i++) {
      const change = (history[i].gasPrice - history[i - 1].gasPrice) / history[i - 1].gasPrice;
      trend += change;
    }

    return trend / (history.length - 1);
  }

  private calculateOptimizedGasPrice(
    current: bigint,
    predicted: number,
    config: ChainGasConfig,
    strategy: 'conservative' | 'balanced' | 'aggressive'
  ): bigint {
    const predictedBigInt = BigInt(Math.floor(predicted));
    
    let multiplier: number;
    switch (strategy) {
      case 'conservative':
        multiplier = 0.95;
        break;
      case 'balanced':
        multiplier = config.gasMultiplier;
        break;
      case 'aggressive':
        multiplier = 1.25;
        break;
    }

    let optimizedPrice = current;
    
    if (predictedBigInt < current) {
      optimizedPrice = current * BigInt(Math.floor(multiplier * 10000)) / BigInt(10000);
    } else {
      optimizedPrice = predictedBigInt * BigInt(Math.floor(multiplier * 10000)) / BigInt(10000);
    }

    const maxPrice = BigInt(config.maxGasPrice);
    const minPrice = BigInt(config.baseGasPrice);

    return BigInt(Math.max(Number(minPrice), Math.min(Number(optimizedPrice), Number(maxPrice))));
  }

  private async estimateGasLimit(chainId: number, amount: string): Promise<bigint> {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    const baseGasLimit = BigInt(21000); // Base transfer
    const amountWei = ethers.utils.parseUnits(amount, 18);
    
    if (amountWei.gt(0)) {
      return baseGasLimit + BigInt(50000); // Additional gas for token transfers
    }

    return baseGasLimit;
  }

  private calculateGasCost(gasLimit: bigint, gasPrice: bigint): bigint {
    return gasLimit * gasPrice;
  }

  private calculateConfidence(current: bigint, predicted: number): number {
    const predictedBigInt = BigInt(Math.floor(predicted));
    const difference = Number(predictedBigInt > current ? 
      predictedBigInt - current : current - predictedBigInt);
    const percentage = difference / Number(current);
    
    return Math.max(0, Math.min(100, 100 - (percentage * 100)));
  }

  private async recordGasHistory(chainId: number, gasPrice: number): Promise<void> {
    const history = this.gasHistory.get(chainId) || [];
    const provider = this.providers.get(chainId);
    
    let blockNumber = 0;
    let utilization = 0;

    if (provider) {
      try {
        const block = await provider.getBlock('latest');
        if (block) {
          blockNumber = block.number;
          utilization = (block.gasUsed.toNumber() / block.gasLimit.toNumber()) * 100;
        }
      } catch (error) {
        console.warn('Failed to get block data for gas history:', error);
      }
    }

    const newEntry: GasHistory = {
      timestamp: Date.now(),
      gasPrice,
      blockNumber,
      utilization
    };

    history.push(newEntry);
    
    if (history.length > 100) {
      history.shift();
    }

    this.gasHistory.set(chainId, history);
  }

  public async getGasPrediction(
    chainId: number,
    timeWindow: number = 300000 // 5 minutes
  ): Promise<GasPrediction> {
    const predictedPrice = await this.predictGasPrice(chainId);
    const currentPrice = await this.getCurrentGasPrice(chainId);
    
    const priceDifference = Number(predictedPrice - currentPrice) / Number(currentPrice);
    const confidence = this.calculateConfidence(currentPrice, predictedPrice);

    let recommendation: 'wait' | 'proceed' | 'urgent';
    if (priceDifference > 0.1 && confidence > 70) {
      recommendation = 'wait';
    } else if (priceDifference < -0.05 && confidence > 60) {
      recommendation = 'proceed';
    } else {
      recommendation = 'urgent';
    }

    return {
      predictedGasPrice: predictedPrice,
      confidence,
      timeWindow,
      recommendation
    };
  }

  public getGasHistory(chainId: number): GasHistory[] {
    return this.gasHistory.get(chainId) || [];
  }

  public getChainConfig(chainId: number): ChainGasConfig | undefined {
    return this.chainConfigs.get(chainId);
  }

  public updateChainConfig(chainId: number, config: Partial<ChainGasConfig>): void {
    const existingConfig = this.chainConfigs.get(chainId);
    if (existingConfig) {
      this.chainConfigs.set(chainId, { ...existingConfig, ...config });
    }
  }

  public clearCache(): void {
    this.optimizationCache.clear();
  }

  public getOptimizationStats(): {
    totalOptimizations: number;
    averageSavings: number;
    cacheHitRate: number;
  } {
    const cacheSize = this.optimizationCache.size;
    const optimizations = Array.from(this.optimizationCache.values());
    
    const totalSavings = optimizations.reduce((sum, opt) => sum + opt.savingsPercentage, 0);
    const averageSavings = optimizations.length > 0 ? totalSavings / optimizations.length : 0;

    return {
      totalOptimizations: cacheSize,
      averageSavings,
      cacheHitRate: 0 // Would need to track cache hits/misses for accurate rate
    };
  }

  public async getOptimalTransactionTime(
    chainId: number,
    maxWaitTime: number = 3600000 // 1 hour
  ): Promise<{
    optimalTime: Date;
    expectedGasPrice: number;
    confidence: number;
  }> {
    const history = this.gasHistory.get(chainId);
    if (!history || history.length < 24) {
      const config = this.chainConfigs.get(chainId);
      return {
        optimalTime: new Date(),
        expectedGasPrice: config ? config.baseGasPrice : 20e9,
        confidence: 0
      };
    }

    const hourlyAverages = this.calculateHourlyGasAverages(history);
    const currentHour = new Date().getHours();
    
    let optimalHour = currentHour;
    let lowestAverage = hourlyAverages[currentHour] || Infinity;

    for (let hour = 0; hour < 24; hour++) {
      const average = hourlyAverages[hour];
      if (average < lowestAverage) {
        lowestAverage = average;
        optimalHour = hour;
      }
    }

    const optimalTime = new Date();
    optimalTime.setHours(optimalHour, 0, 0, 0);
    
    if (optimalTime <= new Date()) {
      optimalTime.setDate(optimalTime.getDate() + 1);
    }

    const waitTime = optimalTime.getTime() - Date.now();
    if (waitTime > maxWaitTime) {
      optimalTime.setTime(Date.now() + maxWaitTime);
    }

    return {
      optimalTime,
      expectedGasPrice: lowestAverage,
      confidence: Math.min(90, history.length * 2)
    };
  }

  private calculateHourlyGasAverages(history: GasHistory[]): { [hour: number]: number } {
    const hourlyData: { [hour: number]: number[] } = {};

    history.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = [];
      }
      hourlyData[hour].push(entry.gasPrice);
    });

    const averages: { [hour: number]: number } = {};
    for (const hour in hourlyData) {
      const prices = hourlyData[hour];
      averages[parseInt(hour)] = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    }

    return averages;
  }
}
