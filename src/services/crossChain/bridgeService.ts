import { ethers } from 'ethers';
import { config } from '../../config';

export interface BridgeTransfer {
  transferId: string;
  fromChain: number;
  toChain: number;
  sender: string;
  recipient: string;
  amount: string;
  tokenAddress: string;
  timestamp: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'refunded';
  proofHash: string;
  gasUsed?: string;
  txHash?: string;
  confirmations?: number;
  fee?: string;
}

export interface BridgeConfig {
  chainId: number;
  bridgeAddress: string;
  routerAddress: string;
  wrapperAddress: string;
  feeRate: number;
  minAmount: string;
  maxAmount: string;
  supportedTokens: string[];
  confirmationBlocks: number;
}

export interface BridgeStats {
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  totalVolume: string;
  averageTransferTime: number;
  chainStats: { [chainId: number]: { transfers: number; volume: string; successRate: number } };
}

export interface OptimizedGas {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
  optimizedCost: string;
  savings: string;
  savingsPercentage: number;
}

export class BridgeService {
  private bridgeConfigs: Map<number, BridgeConfig> = new Map();
  private providers: Map<number, ethers.providers.JsonRpcProvider> = new Map();
  private bridgeContracts: Map<number, ethers.Contract> = new Map();
  private pendingTransfers: Map<string, BridgeTransfer> = new Map();
  private transferHistory: BridgeTransfer[] = [];

  constructor() {
    if (config.features.enableCrossChainBridge) {
      this.initializeBridgeConfigs();
    } else {
      console.log('Cross-chain bridge is disabled via feature flag');
    }
  }

  private initializeBridgeConfigs(): void {
    const configs: BridgeConfig[] = [
      {
        chainId: 1, // Ethereum
        bridgeAddress: config.blockchain.ethereum.bridgeAddress,
        routerAddress: '0x1234567890123456789012345678901234567890',
        wrapperAddress: '0x1234567890123456789012345678901234567890',
        feeRate: 0.001, // 0.1%
        minAmount: '0.001',
        maxAmount: '10000',
        supportedTokens: [
          '0xA0b86a33E6441b8e8C7C7b0b8e8e8e8e8e8e8e8e', // Example token
          '0x1234567890123456789012345678901234567890'
        ],
        confirmationBlocks: 12
      },
      {
        chainId: 137, // Polygon
        bridgeAddress: config.blockchain.polygon.bridgeAddress,
        routerAddress: '0x1234567890123456789012345678901234567890',
        wrapperAddress: '0x1234567890123456789012345678901234567890',
        feeRate: 0.0005, // 0.05%
        minAmount: '0.01',
        maxAmount: '50000',
        supportedTokens: [
          '0x1234567890123456789012345678901234567890',
          '0x1234567890123456789012345678901234567891'
        ],
        confirmationBlocks: 20
      },
      {
        chainId: 56, // BSC
        bridgeAddress: config.blockchain.bsc.bridgeAddress,
        routerAddress: '0x1234567890123456789012345678901234567890',
        wrapperAddress: '0x1234567890123456789012345678901234567890',
        feeRate: 0.0008, // 0.08%
        minAmount: '0.005',
        maxAmount: '25000',
        supportedTokens: [
          '0x1234567890123456789012345678901234567890',
          '0x1234567890123456789012345678901234567892'
        ],
        confirmationBlocks: 15
      }
    ];

    configs.forEach(config => {
      this.bridgeConfigs.set(config.chainId, config);
      this.initializeProvider(config.chainId);
    });
  }

  private initializeProvider(chainId: number): void {
    const rpcUrls: { [key: number]: string } = {
      1: config.blockchain.ethereum.rpcUrl,
      137: config.blockchain.polygon.rpcUrl,
      56: config.blockchain.bsc.rpcUrl
    };

    const rpcUrl = rpcUrls[chainId];
    if (rpcUrl) {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      this.providers.set(chainId, provider);

      const bridgeConfig = this.bridgeConfigs.get(chainId);
      if (bridgeConfig) {
        const bridgeContract = new ethers.Contract(
          bridgeConfig.bridgeAddress,
          this.getBridgeABI(),
          provider
        );
        this.bridgeContracts.set(chainId, bridgeContract);
      }
    }
  }

  private getBridgeABI(): any[] {
    return [
      'function initiateTransfer(address recipient, uint256 amount, address token, uint256 targetChain) external returns (bytes32)',
      'function completeTransfer(bytes32 transferId, bytes calldata proof) external',
      'function refundTransfer(bytes32 transferId) external',
      'function getTransferStatus(bytes32 transferId) external view returns (uint8 status, uint256 timestamp)',
      'function estimateFee(uint256 amount, uint256 targetChain) external view returns (uint256)',
      'event TransferInitiated(bytes32 indexed transferId, address indexed sender, address indexed recipient, uint256 amount, address token, uint256 fromChain, uint256 toChain)',
      'event TransferCompleted(bytes32 indexed transferId, address indexed recipient, uint256 amount)',
      'event TransferRefunded(bytes32 indexed transferId, address indexed sender, uint256 amount)'
    ];
  }

  public async initiateTransfer(
    transfer: BridgeTransfer,
    optimizedGas: OptimizedGas
  ): Promise<string> {
    const config = this.bridgeConfigs.get(transfer.fromChain);
    if (!config) {
      throw new Error(`Bridge configuration not found for chain ${transfer.fromChain}`);
    }

    const provider = this.providers.get(transfer.fromChain);
    const bridgeContract = this.bridgeContracts.get(transfer.fromChain);

    if (!provider || !bridgeContract) {
      throw new Error(`Provider or contract not found for chain ${transfer.fromChain}`);
    }

    try {
      const amountWei = ethers.utils.parseUnits(transfer.amount, 18);
      const fee = amountWei.mul(Math.floor(config.feeRate * 10000)).div(10000);
      const totalAmount = amountWei.add(fee);

      if (amountWei.lt(ethers.utils.parseUnits(config.minAmount, 18))) {
        throw new Error(`Amount below minimum: ${config.minAmount}`);
      }

      if (amountWei.gt(ethers.utils.parseUnits(config.maxAmount, 18))) {
        throw new Error(`Amount above maximum: ${config.maxAmount}`);
      }

      if (!config.supportedTokens.includes(transfer.tokenAddress.toLowerCase())) {
        throw new Error(`Token ${transfer.tokenAddress} not supported on chain ${transfer.fromChain}`);
      }

      const tx = await bridgeContract.initiateTransfer(
        transfer.recipient,
        amountWei,
        transfer.tokenAddress,
        transfer.toChain,
        {
          gasLimit: optimizedGas.gasLimit,
          gasPrice: optimizedGas.gasPrice,
          maxFeePerGas: optimizedGas.maxFeePerGas,
          maxPriorityFeePerGas: optimizedGas.maxPriorityFeePerGas
        }
      );

      transfer.txHash = tx.hash;
      transfer.status = 'in_progress';
      transfer.fee = ethers.utils.formatEther(fee);

      this.pendingTransfers.set(transfer.transferId, transfer);
      this.transferHistory.push(transfer);

      await tx.wait();

      return tx.hash;
    } catch (error) {
      transfer.status = 'failed';
      this.pendingTransfers.set(transfer.transferId, transfer);
      throw new Error(`Failed to initiate transfer: ${error}`);
    }
  }

  public async completeTransfer(
    transferId: string,
    proof: string,
    chainId: number
  ): Promise<string> {
    const config = this.bridgeConfigs.get(chainId);
    if (!config) {
      throw new Error(`Bridge configuration not found for chain ${chainId}`);
    }

    const bridgeContract = this.bridgeContracts.get(chainId);
    if (!bridgeContract) {
      throw new Error(`Bridge contract not found for chain ${chainId}`);
    }

    try {
      const tx = await bridgeContract.completeTransfer(
        ethers.utils.formatBytes32String(transferId),
        proof
      );

      const receipt = await tx.wait();

      const transfer = this.pendingTransfers.get(transferId);
      if (transfer) {
        transfer.status = 'completed';
        transfer.confirmations = receipt.confirmations;
        this.pendingTransfers.delete(transferId);
      }

      return tx.hash;
    } catch (error) {
      const transfer = this.pendingTransfers.get(transferId);
      if (transfer) {
        transfer.status = 'failed';
      }
      throw new Error(`Failed to complete transfer: ${error}`);
    }
  }

  public async refundTransfer(transferId: string, chainId: number): Promise<string> {
    const config = this.bridgeConfigs.get(chainId);
    if (!config) {
      throw new Error(`Bridge configuration not found for chain ${chainId}`);
    }

    const bridgeContract = this.bridgeContracts.get(chainId);
    if (!bridgeContract) {
      throw new Error(`Bridge contract not found for chain ${chainId}`);
    }

    try {
      const tx = await bridgeContract.refundTransfer(
        ethers.utils.formatBytes32String(transferId)
      );

      const receipt = await tx.wait();

      const transfer = this.pendingTransfers.get(transferId);
      if (transfer) {
        transfer.status = 'refunded';
        transfer.confirmations = receipt.confirmations;
        this.pendingTransfers.delete(transferId);
      }

      return tx.hash;
    } catch (error) {
      throw new Error(`Failed to refund transfer: ${error}`);
    }
  }

  public async getTransferStatus(transferId: string): Promise<BridgeTransfer | null> {
    const cachedTransfer = this.pendingTransfers.get(transferId);
    if (cachedTransfer) {
      return cachedTransfer;
    }

    const historyTransfer = this.transferHistory.find(t => t.transferId === transferId);
    if (historyTransfer) {
      return historyTransfer;
    }

    for (const [chainId, bridgeContract] of this.bridgeContracts) {
      try {
        const status = await bridgeContract.getTransferStatus(
          ethers.utils.formatBytes32String(transferId)
        );

        const transfer: BridgeTransfer = {
          transferId,
          fromChain: 0,
          toChain: 0,
          sender: '',
          recipient: '',
          amount: '0',
          tokenAddress: '',
          timestamp: status.timestamp.toNumber(),
          status: this.convertStatus(status.status.toNumber()),
          proofHash: '',
          confirmations: 0
        };

        return transfer;
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  public async estimateBridgeFee(
    amount: string,
    fromChain: number,
    toChain: number
  ): Promise<string> {
    const config = this.bridgeConfigs.get(fromChain);
    if (!config) {
      throw new Error(`Bridge configuration not found for chain ${fromChain}`);
    }

    const bridgeContract = this.bridgeContracts.get(fromChain);
    if (!bridgeContract) {
      throw new Error(`Bridge contract not found for chain ${fromChain}`);
    }

    try {
      const amountWei = ethers.utils.parseUnits(amount, 18);
      const fee = await bridgeContract.estimateFee(amountWei, toChain);
      return ethers.utils.formatEther(fee);
    } catch (error) {
      const amountWei = ethers.utils.parseUnits(amount, 18);
      const fallbackFee = amountWei.mul(Math.floor(config.feeRate * 10000)).div(10000);
      return ethers.utils.formatEther(fallbackFee);
    }
  }

  public async getBridgeBalance(chainId: number, tokenAddress: string): Promise<string> {
    const config = this.bridgeConfigs.get(chainId);
    if (!config) {
      throw new Error(`Bridge configuration not found for chain ${chainId}`);
    }

    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not found for chain ${chainId}`);
    }

    try {
      const balance = await provider.getBalance(config.bridgeAddress);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      throw new Error(`Failed to get bridge balance: ${error}`);
    }
  }

  public async getBridgeStats(): Promise<BridgeStats> {
    const stats: BridgeStats = {
      totalTransfers: this.transferHistory.length,
      successfulTransfers: 0,
      failedTransfers: 0,
      totalVolume: '0',
      averageTransferTime: 0,
      chainStats: {}
    };

    let totalTransferTime = 0;
    let completedTransfers = 0;

    for (const transfer of this.transferHistory) {
      if (transfer.status === 'completed') {
        stats.successfulTransfers++;
        stats.totalVolume = (parseFloat(stats.totalVolume) + parseFloat(transfer.amount)).toString();
        completedTransfers++;
      } else if (transfer.status === 'failed') {
        stats.failedTransfers++;
      }

      const fromChainStats = stats.chainStats[transfer.fromChain] || {
        transfers: 0,
        volume: '0',
        successRate: 0
      };

      fromChainStats.transfers++;
      if (transfer.status === 'completed') {
        fromChainStats.volume = (parseFloat(fromChainStats.volume) + parseFloat(transfer.amount)).toString();
      }

      stats.chainStats[transfer.fromChain] = fromChainStats;
    }

    if (completedTransfers > 0) {
      stats.averageTransferTime = totalTransferTime / completedTransfers;
    }

    for (const chainId in stats.chainStats) {
      const chainStat = stats.chainStats[chainId];
      if (chainStat.transfers > 0) {
        const successful = this.transferHistory.filter(
          t => t.fromChain === parseInt(chainId) && t.status === 'completed'
        ).length;
        chainStat.successRate = (successful / chainStat.transfers) * 100;
      }
    }

    return stats;
  }

  public getSupportedTokens(chainId: number): string[] {
    const config = this.bridgeConfigs.get(chainId);
    return config ? config.supportedTokens : [];
  }

  public getBridgeConfig(chainId: number): BridgeConfig | undefined {
    return this.bridgeConfigs.get(chainId);
  }

  public getPendingTransfers(): BridgeTransfer[] {
    return Array.from(this.pendingTransfers.values());
  }

  public getTransferHistory(): BridgeTransfer[] {
    return this.transferHistory;
  }

  private convertStatus(statusNumber: number): BridgeTransfer['status'] {
    switch (statusNumber) {
      case 0:
        return 'pending';
      case 1:
        return 'in_progress';
      case 2:
        return 'completed';
      case 3:
        return 'failed';
      case 4:
        return 'refunded';
      default:
        return 'pending';
    }
  }

  public async validateTransfer(
    transferId: string,
    fromChain: number,
    toChain: number,
    amount: string,
    tokenAddress: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const fromConfig = this.bridgeConfigs.get(fromChain);
    const toConfig = this.bridgeConfigs.get(toChain);

    if (!fromConfig) {
      errors.push(`Chain ${fromChain} is not supported`);
    }

    if (!toConfig) {
      errors.push(`Chain ${toChain} is not supported`);
    }

    if (fromConfig && toConfig) {
      if (!fromConfig.supportedTokens.includes(tokenAddress.toLowerCase())) {
        errors.push(`Token ${tokenAddress} is not supported on chain ${fromChain}`);
      }

      const amountWei = ethers.utils.parseUnits(amount, 18);
      const minAmount = ethers.utils.parseUnits(fromConfig.minAmount, 18);
      const maxAmount = ethers.utils.parseUnits(fromConfig.maxAmount, 18);

      if (amountWei.lt(minAmount)) {
        errors.push(`Amount ${amount} is below minimum ${fromConfig.minAmount}`);
      }

      if (amountWei.gt(maxAmount)) {
        errors.push(`Amount ${amount} is above maximum ${fromConfig.maxAmount}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
