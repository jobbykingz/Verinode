import { ethers } from 'ethers';
import { CrossChainService } from './crossChainService';

export interface BridgeMessage {
  messageId: string;
  sourceChain: number;
  targetChain: number;
  sender: string;
  recipient: string;
  messageType: 'ProofVerification' | 'AssetTransfer' | 'AtomicSwap' | 'Generic';
  payload: string;
  nonce: number;
  signature: string;
  status: 'Pending' | 'InTransit' | 'Delivered' | 'Failed' | 'Expired';
  createdAt: number;
  processedAt?: number;
  gasUsed: number;
}

export interface BridgeTransaction {
  txHash: string;
  sourceChain: number;
  targetChain: number;
  asset: string;
  amount: string;
  recipient: string;
  status: 'Pending' | 'Completed' | 'Failed';
  timestamp: number;
}

export interface BridgeConfig {
  minConfirmations: number;
  gasLimit: number;
  relayerFee: string;
  timeoutPeriod: number;
  supportedAssets: string[];
}

export class BridgeService {
  private crossChainService: CrossChainService;
  private bridgeConfigs: Map<number, BridgeConfig> = new Map();
  private pendingMessages: Map<string, BridgeMessage> = new Map();
  private activeTransactions: Map<string, BridgeTransaction> = new Map();

  constructor(crossChainService: CrossChainService) {
    this.crossChainService = crossChainService;
    this.initializeBridgeConfigs();
  }

  private initializeBridgeConfigs() {
    // Ethereum Bridge Config
    this.bridgeConfigs.set(1, {
      minConfirmations: 12,
      gasLimit: 300000,
      relayerFee: '0.001',
      timeoutPeriod: 3600, // 1 hour
      supportedAssets: ['ETH', 'USDC', 'USDT', 'WBTC']
    });

    // Polygon Bridge Config
    this.bridgeConfigs.set(137, {
      minConfirmations: 20,
      gasLimit: 500000,
      relayerFee: '0.01',
      timeoutPeriod: 1800, // 30 minutes
      supportedAssets: ['MATIC', 'USDC', 'USDT', 'WBTC']
    });

    // BSC Bridge Config
    this.bridgeConfigs.set(56, {
      minConfirmations: 3,
      gasLimit: 200000,
      relayerFee: '0.0005',
      timeoutPeriod: 2400, // 40 minutes
      supportedAssets: ['BNB', 'USDC', 'USDT', 'BUSD']
    });
  }

  public async sendMessage(
    sourceChain: number,
    targetChain: number,
    recipient: string,
    messageType: BridgeMessage['messageType'],
    payload: string,
    privateKey: string
  ): Promise<string> {
    try {
      const messageId = this.generateMessageId();
      const nonce = await this.getNextNonce(sourceChain);
      const signature = await this.signMessage(messageId, payload, privateKey);

      const message: BridgeMessage = {
        messageId,
        sourceChain,
        targetChain,
        sender: this.getAddressFromPrivateKey(privateKey),
        recipient,
        messageType,
        payload,
        nonce,
        signature,
        status: 'Pending',
        createdAt: Math.floor(Date.now() / 1000),
        gasUsed: 0
      };

      // Store message locally
      this.pendingMessages.set(messageId, message);

      // Submit to cross-chain service
      const txHash = await this.crossChainService.submitCrossChainProof(
        sourceChain,
        targetChain,
        JSON.stringify(message),
        privateKey
      );

      // Update message status
      message.status = 'InTransit';
      this.pendingMessages.set(messageId, message);

      return messageId;
    } catch (error) {
      console.error('Failed to send bridge message:', error);
      throw error;
    }
  }

  public async processMessage(
    messageId: string,
    privateKey: string
  ): Promise<boolean> {
    try {
      const message = this.pendingMessages.get(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // Process message on target chain
      const success = await this.crossChainService.verifyProofOnChain(
        message.targetChain,
        messageId,
        privateKey
      );

      if (success) {
        message.status = 'Delivered';
        message.processedAt = Math.floor(Date.now() / 1000);
        this.pendingMessages.set(messageId, message);
      }

      return success;
    } catch (error) {
      console.error('Failed to process bridge message:', error);
      throw error;
    }
  }

  public async bridgeAsset(
    sourceChain: number,
    targetChain: number,
    asset: string,
    amount: string,
    recipient: string,
    privateKey: string
  ): Promise<string> {
    try {
      const config = this.bridgeConfigs.get(sourceChain);
      if (!config) {
        throw new Error('Bridge config not found for source chain');
      }

      if (!config.supportedAssets.includes(asset)) {
        throw new Error(`Asset ${asset} not supported on chain ${sourceChain}`);
      }

      const txHash = await this.executeAssetTransfer(
        sourceChain,
        targetChain,
        asset,
        amount,
        recipient,
        privateKey
      );

      const transaction: BridgeTransaction = {
        txHash,
        sourceChain,
        targetChain,
        asset,
        amount,
        recipient,
        status: 'Pending',
        timestamp: Math.floor(Date.now() / 1000)
      };

      this.activeTransactions.set(txHash, transaction);

      // Wait for confirmations
      await this.waitForConfirmations(sourceChain, txHash, config.minConfirmations);

      // Update status
      transaction.status = 'Completed';
      this.activeTransactions.set(txHash, transaction);

      return txHash;
    } catch (error) {
      console.error('Failed to bridge asset:', error);
      throw error;
    }
  }

  public async getBridgeMessage(messageId: string): Promise<BridgeMessage | null> {
    return this.pendingMessages.get(messageId) || null;
  }

  public async getBridgeTransaction(txHash: string): Promise<BridgeTransaction | null> {
    return this.activeTransactions.get(txHash) || null;
  }

  public async getPendingMessages(chainId: number): Promise<BridgeMessage[]> {
    const messages: BridgeMessage[] = [];
    
    for (const message of this.pendingMessages.values()) {
      if (message.targetChain === chainId && message.status === 'Pending') {
        messages.push(message);
      }
    }

    return messages;
  }

  public async getActiveTransactions(chainId: number): Promise<BridgeTransaction[]> {
    const transactions: BridgeTransaction[] = [];
    
    for (const transaction of this.activeTransactions.values()) {
      if (transaction.targetChain === chainId && transaction.status === 'Pending') {
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  public async estimateBridgeFee(
    sourceChain: number,
    targetChain: number,
    asset: string,
    amount: string
  ): Promise<string> {
    try {
      const config = this.bridgeConfigs.get(sourceChain);
      if (!config) {
        throw new Error('Bridge config not found');
      }

      // Estimate gas cost
      const gasCost = await this.crossChainService.estimateGasCost(
        sourceChain,
        'submitCrossChainProof',
        [sourceChain, targetChain, amount]
      );

      // Add relayer fee
      const totalFee = (parseFloat(gasCost) + parseFloat(config.relayerFee)).toString();

      return totalFee;
    } catch (error) {
      console.error('Failed to estimate bridge fee:', error);
      return '0';
    }
  }

  public async getBridgeStatus(sourceChain: number, targetChain: number): Promise<any> {
    try {
      const [sourceStatus, targetStatus] = await Promise.all([
        this.crossChainService.getChainStatus(sourceChain),
        this.crossChainService.getChainStatus(targetChain)
      ]);

      const pendingMessages = await this.getPendingMessages(targetChain);
      const activeTransactions = await this.getActiveTransactions(targetChain);

      return {
        sourceChain,
        targetChain,
        sourceStatus,
        targetStatus,
        pendingMessages: pendingMessages.length,
        activeTransactions: activeTransactions.length,
        bridgeConfig: this.bridgeConfigs.get(sourceChain)
      };
    } catch (error) {
      console.error('Failed to get bridge status:', error);
      throw error;
    }
  }

  public async validateBridgeMessage(message: BridgeMessage): Promise<boolean> {
    try {
      // Verify signature
      const isValidSignature = await this.verifyMessageSignature(
        message.messageId,
        message.payload,
        message.signature,
        message.sender
      );

      if (!isValidSignature) {
        return false;
      }

      // Check if message has expired
      const config = this.bridgeConfigs.get(message.sourceChain);
      if (config && (Date.now() / 1000 - message.createdAt) > config.timeoutPeriod) {
        return false;
      }

      // Verify chain support
      const supportedChains = this.crossChainService.getSupportedChains();
      if (!supportedChains.includes(message.sourceChain) || !supportedChains.includes(message.targetChain)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to validate bridge message:', error);
      return false;
    }
  }

  public async retryFailedMessage(messageId: string, privateKey: string): Promise<boolean> {
    try {
      const message = this.pendingMessages.get(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      if (message.status !== 'Failed') {
        throw new Error('Message is not in failed state');
      }

      // Reset message status
      message.status = 'Pending';
      message.gasUsed = 0;
      this.pendingMessages.set(messageId, message);

      // Retry processing
      return await this.processMessage(messageId, privateKey);
    } catch (error) {
      console.error('Failed to retry message:', error);
      throw error;
    }
  }

  public async cancelMessage(messageId: string, privateKey: string): Promise<boolean> {
    try {
      const message = this.pendingMessages.get(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      const senderAddress = this.getAddressFromPrivateKey(privateKey);
      if (message.sender !== senderAddress) {
        throw new Error('Only message sender can cancel');
      }

      if (message.status !== 'Pending') {
        throw new Error('Cannot cancel message in current state');
      }

      message.status = 'Failed';
      this.pendingMessages.set(messageId, message);

      return true;
    } catch (error) {
      console.error('Failed to cancel message:', error);
      throw error;
    }
  }

  // Helper methods
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getNextNonce(chainId: number): Promise<number> {
    // Simplified nonce generation
    return Math.floor(Date.now() / 1000);
  }

  private async signMessage(messageId: string, payload: string, privateKey: string): Promise<string> {
    const wallet = new ethers.Wallet(privateKey);
    const messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(messageId + payload));
    return await wallet.signMessage(ethers.utils.arrayify(messageHash));
  }

  private async verifyMessageSignature(
    messageId: string,
    payload: string,
    signature: string,
    signerAddress: string
  ): Promise<boolean> {
    try {
      const messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(messageId + payload));
      const recoveredAddress = ethers.utils.verifyMessage(ethers.utils.arrayify(messageHash), signature);
      return recoveredAddress.toLowerCase() === signerAddress.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  private getAddressFromPrivateKey(privateKey: string): string {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
  }

  private async executeAssetTransfer(
    sourceChain: number,
    targetChain: number,
    asset: string,
    amount: string,
    recipient: string,
    privateKey: string
  ): Promise<string> {
    // Simplified asset transfer execution
    // In practice, this would interact with the actual bridge contract
    const payload = JSON.stringify({
      asset,
      amount,
      recipient,
      targetChain
    });

    return await this.crossChainService.submitCrossChainProof(
      sourceChain,
      targetChain,
      payload,
      privateKey
    );
  }

  private async waitForConfirmations(chainId: number, txHash: string, requiredConfirmations: number): Promise<void> {
    // Simplified confirmation waiting
    // In practice, this would poll the blockchain for confirmations
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
  }

  public getBridgeConfig(chainId: number): BridgeConfig | undefined {
    return this.bridgeConfigs.get(chainId);
  }

  public getSupportedAssets(chainId: number): string[] {
    const config = this.bridgeConfigs.get(chainId);
    return config ? config.supportedAssets : [];
  }
}
