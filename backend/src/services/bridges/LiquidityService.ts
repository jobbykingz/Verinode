import { StellarSdk } from '@stellar/stellar-sdk';
import { logger } from '../../utils/logger';
import { config } from '../../config';

export interface LiquidityPool {
  poolId: string;
  tokenA: string;
  tokenB: string;
  reserveA: string;
  reserveB: string;
  totalLiquidity: string;
  feeRate: number;
  active: boolean;
  createdAt: Date;
  lastUpdated: Date;
  apr: number;
}

export interface LiquidityPosition {
  positionId: string;
  user: string;
  poolId: string;
  liquidityAmount: string;
  tokenAAmount: string;
  tokenBAmount: string;
  rewardsEarned: string;
  createdAt: Date;
  lastClaimed: Date;
}

export interface LiquidityReward {
  rewardId: string;
  poolId: string;
  user: string;
  amount: string;
  rewardType: 'TradingFee' | 'LiquidityMining' | 'Bonus';
  createdAt: Date;
  claimed: boolean;
}

export interface TokenPrice {
  token: string;
  price: string;
  timestamp: Date;
  chainId: number;
}

export class LiquidityService {
  private stellarServer: StellarSdk.Server;
  private contractId: string;

  constructor(contractId: string) {
    this.contractId = contractId;
    this.stellarServer = new StellarSdk.Server(config.stellar.horizonUrl);
  }

  /**
   * Initialize the liquidity manager contract
   */
  async initialize(adminPublicKey: string, adminSecretKey: string, feeCollector: string): Promise<void> {
    try {
      const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecretKey);
      const account = await this.stellarServer.loadAccount(adminPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "initialize",
            ...StellarSdk.nativeToScVal(adminPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(feeCollector, { type: "address" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Liquidity manager contract initialized', { 
        transactionHash: result.hash,
        contractId: this.contractId 
      });
    } catch (error) {
      logger.error('Failed to initialize liquidity manager contract', error);
      throw error;
    }
  }

  /**
   * Create a new liquidity pool
   */
  async createPool(
    adminPublicKey: string,
    adminSecretKey: string,
    tokenA: string,
    tokenB: string,
    feeRate: number
  ): Promise<string> {
    try {
      const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecretKey);
      const account = await this.stellarServer.loadAccount(adminPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "create_pool",
            ...StellarSdk.nativeToScVal(adminPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(tokenA, { type: "address" }),
            ...StellarSdk.nativeToScVal(tokenB, { type: "address" }),
            ...StellarSdk.nativeToScVal(feeRate, { type: "u32" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Liquidity pool created', {
        transactionHash: result.hash,
        tokenA,
        tokenB,
        feeRate
      });

      return result.hash;
    } catch (error) {
      logger.error('Failed to create liquidity pool', error);
      throw error;
    }
  }

  /**
   * Add liquidity to a pool
   */
  async addLiquidity(
    poolId: string,
    userPublicKey: string,
    userSecretKey: string,
    amountA: string,
    amountB: string,
    minLiquidity: string
  ): Promise<string> {
    try {
      const userKeypair = StellarSdk.Keypair.fromSecret(userSecretKey);
      const account = await this.stellarServer.loadAccount(userPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "add_liquidity",
            ...StellarSdk.nativeToScVal(poolId, { type: "u64" }),
            ...StellarSdk.nativeToScVal(userPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(amountA, { type: "u128" }),
            ...StellarSdk.nativeToScVal(amountB, { type: "u128" }),
            ...StellarSdk.nativeToScVal(minLiquidity, { type: "u128" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(userKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Liquidity added to pool', {
        transactionHash: result.hash,
        poolId,
        amountA,
        amountB,
        user: userPublicKey
      });

      return result.hash;
    } catch (error) {
      logger.error('Failed to add liquidity', error);
      throw error;
    }
  }

  /**
   * Remove liquidity from a pool
   */
  async removeLiquidity(
    positionId: string,
    userPublicKey: string,
    userSecretKey: string,
    liquidityAmount: string
  ): Promise<{ tokenAAmount: string; tokenBAmount: string }> {
    try {
      const userKeypair = StellarSdk.Keypair.fromSecret(userSecretKey);
      const account = await this.stellarServer.loadAccount(userPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "remove_liquidity",
            ...StellarSdk.nativeToScVal(positionId, { type: "u64" }),
            ...StellarSdk.nativeToScVal(userPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(liquidityAmount, { type: "u128" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(userKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      // Get the return values from the transaction result
      const returnValue = StellarSdk.scValToNative(result.result);
      
      logger.info('Liquidity removed from pool', {
        transactionHash: result.hash,
        positionId,
        liquidityAmount,
        user: userPublicKey
      });

      return returnValue;
    } catch (error) {
      logger.error('Failed to remove liquidity', error);
      throw error;
    }
  }

  /**
   * Swap tokens through a liquidity pool
   */
  async swap(
    poolId: string,
    userPublicKey: string,
    userSecretKey: string,
    tokenIn: string,
    amountIn: string,
    minAmountOut: string
  ): Promise<string> {
    try {
      const userKeypair = StellarSdk.Keypair.fromSecret(userSecretKey);
      const account = await this.stellarServer.loadAccount(userPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "swap",
            ...StellarSdk.nativeToScVal(poolId, { type: "u64" }),
            ...StellarSdk.nativeToScVal(userPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(tokenIn, { type: "address" }),
            ...StellarSdk.nativeToScVal(amountIn, { type: "u128" }),
            ...StellarSdk.nativeToScVal(minAmountOut, { type: "u128" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(userKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      const amountOut = StellarSdk.scValToNative(result.result);
      
      logger.info('Token swap completed', {
        transactionHash: result.hash,
        poolId,
        tokenIn,
        amountIn,
        amountOut,
        user: userPublicKey
      });

      return amountOut;
    } catch (error) {
      logger.error('Failed to swap tokens', error);
      throw error;
    }
  }

  /**
   * Claim rewards
   */
  async claimRewards(
    userPublicKey: string,
    userSecretKey: string,
    rewardIds: string[]
  ): Promise<string> {
    try {
      const userKeypair = StellarSdk.Keypair.fromSecret(userSecretKey);
      const account = await this.stellarServer.loadAccount(userPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "claim_rewards",
            ...StellarSdk.nativeToScVal(userPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(rewardIds, { type: "Vec" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(userKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      const totalClaimed = StellarSdk.scValToNative(result.result);
      
      logger.info('Rewards claimed', {
        transactionHash: result.hash,
        rewardIds,
        totalClaimed,
        user: userPublicKey
      });

      return totalClaimed;
    } catch (error) {
      logger.error('Failed to claim rewards', error);
      throw error;
    }
  }

  /**
   * Update token price
   */
  async updateTokenPrice(
    adminPublicKey: string,
    adminSecretKey: string,
    token: string,
    price: string,
    chainId: number
  ): Promise<void> {
    try {
      const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecretKey);
      const account = await this.stellarServer.loadAccount(adminPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "update_token_price",
            ...StellarSdk.nativeToScVal(adminPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(token, { type: "address" }),
            ...StellarSdk.nativeToScVal(price, { type: "u128" }),
            ...StellarSdk.nativeToScVal(chainId, { type: "u32" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Token price updated', {
        transactionHash: result.hash,
        token,
        price,
        chainId
      });
    } catch (error) {
      logger.error('Failed to update token price', error);
      throw error;
    }
  }

  /**
   * Get pool details
   */
  async getPool(poolId: string): Promise<LiquidityPool | null> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call(
        "get_pool",
        ...StellarSdk.nativeToScVal(poolId, { type: "u64" })
      );

      const poolData = StellarSdk.scValToNative(result);
      
      return this.mapToLiquidityPool(poolData);
    } catch (error) {
      logger.error('Failed to get pool details', error);
      return null;
    }
  }

  /**
   * Get position details
   */
  async getPosition(positionId: string): Promise<LiquidityPosition | null> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call(
        "get_position",
        ...StellarSdk.nativeToScVal(positionId, { type: "u64" })
      );

      const positionData = StellarSdk.scValToNative(result);
      
      return this.mapToLiquidityPosition(positionData);
    } catch (error) {
      logger.error('Failed to get position details', error);
      return null;
    }
  }

  /**
   * Get reward details
   */
  async getReward(rewardId: string): Promise<LiquidityReward | null> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call(
        "get_reward",
        ...StellarSdk.nativeToScVal(rewardId, { type: "u64" })
      );

      const rewardData = StellarSdk.scValToNative(result);
      
      return this.mapToLiquidityReward(rewardData);
    } catch (error) {
      logger.error('Failed to get reward details', error);
      return null;
    }
  }

  /**
   * Calculate APR for a pool
   */
  async calculateAPR(poolId: string): Promise<number> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call(
        "calculate_apr",
        ...StellarSdk.nativeToScVal(poolId, { type: "u64" })
      );

      return StellarSdk.scValToNative(result);
    } catch (error) {
      logger.error('Failed to calculate APR', error);
      return 0;
    }
  }

  /**
   * Get supported tokens
   */
  async getSupportedTokens(): Promise<string[]> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call("get_supported_tokens");
      
      return StellarSdk.scValToNative(result);
    } catch (error) {
      logger.error('Failed to get supported tokens', error);
      return [];
    }
  }

  /**
   * Get pool count
   */
  async getPoolCount(): Promise<number> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call("get_pool_count");
      
      return StellarSdk.scValToNative(result);
    } catch (error) {
      logger.error('Failed to get pool count', error);
      return 0;
    }
  }

  /**
   * Get total liquidity
   */
  async getTotalLiquidity(): Promise<string> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call("get_total_liquidity");
      
      return StellarSdk.scValToNative(result);
    } catch (error) {
      logger.error('Failed to get total liquidity', error);
      return "0";
    }
  }

  /**
   * Get 24h volume
   */
  async getVolume24h(): Promise<string> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call("get_volume_24h");
      
      return StellarSdk.scValToNative(result);
    } catch (error) {
      logger.error('Failed to get 24h volume', error);
      return "0";
    }
  }

  /**
   * Emergency pause/unpause
   */
  async setPause(
    adminPublicKey: string,
    adminSecretKey: string,
    paused: boolean
  ): Promise<void> {
    try {
      const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecretKey);
      const account = await this.stellarServer.loadAccount(adminPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "set_pause",
            ...StellarSdk.nativeToScVal(adminPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(paused, { type: "bool" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Liquidity manager pause status updated', {
        transactionHash: result.hash,
        paused
      });
    } catch (error) {
      logger.error('Failed to update pause status', error);
      throw error;
    }
  }

  /**
   * Get liquidity statistics
   */
  async getLiquidityStatistics(): Promise<{
    totalPools: number;
    totalLiquidity: string;
    volume24h: string;
    supportedTokens: string[];
    averageAPR: number;
  }> {
    try {
      const [poolCount, totalLiquidity, volume24h, supportedTokens] = await Promise.all([
        this.getPoolCount(),
        this.getTotalLiquidity(),
        this.getVolume24h(),
        this.getSupportedTokens()
      ]);

      // Calculate average APR across all pools
      let totalAPR = 0;
      let poolsWithAPR = 0;
      
      for (let i = 1; i <= poolCount; i++) {
        try {
          const apr = await this.calculateAPR(i.toString());
          totalAPR += apr;
          poolsWithAPR++;
        } catch (error) {
          // Skip pools that don't exist or have errors
        }
      }

      const averageAPR = poolsWithAPR > 0 ? totalAPR / poolsWithAPR : 0;

      return {
        totalPools: poolCount,
        totalLiquidity,
        volume24h,
        supportedTokens,
        averageAPR
      };
    } catch (error) {
      logger.error('Failed to get liquidity statistics', error);
      throw error;
    }
  }

  /**
   * Map contract data to LiquidityPool model
   */
  private mapToLiquidityPool(data: any): LiquidityPool {
    return {
      poolId: data.pool_id.toString(),
      tokenA: data.token_a,
      tokenB: data.token_b,
      reserveA: data.reserve_a.toString(),
      reserveB: data.reserve_b.toString(),
      totalLiquidity: data.total_liquidity.toString(),
      feeRate: data.fee_rate,
      active: data.active,
      createdAt: new Date(data.created_at * 1000),
      lastUpdated: new Date(data.last_updated * 1000),
      apr: data.apr
    };
  }

  /**
   * Map contract data to LiquidityPosition model
   */
  private mapToLiquidityPosition(data: any): LiquidityPosition {
    return {
      positionId: data.position_id.toString(),
      user: data.user,
      poolId: data.pool_id.toString(),
      liquidityAmount: data.liquidity_amount.toString(),
      tokenAAmount: data.token_a_amount.toString(),
      tokenBAmount: data.token_b_amount.toString(),
      rewardsEarned: data.rewards_earned.toString(),
      createdAt: new Date(data.created_at * 1000),
      lastClaimed: new Date(data.last_claimed * 1000)
    };
  }

  /**
   * Map contract data to LiquidityReward model
   */
  private mapToLiquidityReward(data: any): LiquidityReward {
    return {
      rewardId: data.reward_id.toString(),
      poolId: data.pool_id.toString(),
      user: data.user,
      amount: data.amount.toString(),
      rewardType: data.reward_type,
      createdAt: new Date(data.created_at * 1000),
      claimed: data.claimed
    };
  }

  /**
   * Calculate optimal amount for adding liquidity
   */
  calculateOptimalAmount(
    amountA: string,
    reserveA: string,
    reserveB: string
  ): string {
    if (reserveA === "0") return amountA;
    
    const amountANum = parseFloat(amountA);
    const reserveANum = parseFloat(reserveA);
    const reserveBNum = parseFloat(reserveB);
    
    const optimalAmountB = (amountANum * reserveBNum) / reserveANum;
    return optimalAmountB.toString();
  }

  /**
   * Calculate expected output for swap
   */
  calculateSwapOutput(
    amountIn: string,
    reserveIn: string,
    reserveOut: string,
    feeRate: number
  ): string {
    const amountInNum = parseFloat(amountIn);
    const reserveInNum = parseFloat(reserveIn);
    const reserveOutNum = parseFloat(reserveOut);
    
    const amountInWithFee = amountInNum * (10000 - feeRate);
    const numerator = amountInWithFee * reserveOutNum;
    const denominator = (reserveInNum * 10000) + amountInWithFee;
    
    return (numerator / denominator).toString();
  }

  /**
   * Validate liquidity parameters
   */
  validateLiquidityParams(
    tokenA: string,
    tokenB: string,
    amountA: string,
    amountB: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (tokenA === tokenB) {
      errors.push('Token addresses must be different');
    }

    const amountANum = parseFloat(amountA);
    const amountBNum = parseFloat(amountB);

    if (isNaN(amountANum) || amountANum <= 0) {
      errors.push('Amount A must be a positive number');
    }

    if (isNaN(amountBNum) || amountBNum <= 0) {
      errors.push('Amount B must be a positive number');
    }

    if (!tokenA || tokenA.length === 0) {
      errors.push('Token A address is required');
    }

    if (!tokenB || tokenB.length === 0) {
      errors.push('Token B address is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
