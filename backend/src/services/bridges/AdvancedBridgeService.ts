import { StellarSdk } from '@stellar/stellar-sdk';
import { BridgeTransaction } from '../../models/BridgeTransaction';
import { ChainConfiguration, RelayerInfo, FeeTier } from '../../types/BridgeTypes';
import { logger } from '../../utils/logger';
import { config } from '../../config';

export class AdvancedBridgeService {
  private stellarServer: StellarSdk.Server;
  private contractId: string;

  constructor(contractId: string) {
    this.contractId = contractId;
    this.stellarServer = new StellarSdk.Server(config.stellar.horizonUrl);
  }

  /**
   * Initialize the advanced bridge contract
   */
  async initialize(adminPublicKey: string, adminSecretKey: string): Promise<void> {
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
            ...StellarSdk.nativeToScVal(adminPublicKey, { type: "address" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Advanced bridge contract initialized', { 
        transactionHash: result.hash,
        contractId: this.contractId 
      });
    } catch (error) {
      logger.error('Failed to initialize advanced bridge contract', error);
      throw error;
    }
  }

  /**
   * Initiate a cross-chain bridge transaction
   */
  async initiateBridge(
    sourceChain: number,
    targetChain: number,
    tokenAddress: string,
    toAddress: string,
    amount: string,
    fromPublicKey: string,
    fromSecretKey: string,
    metadata?: string
  ): Promise<string> {
    try {
      const fromKeypair = StellarSdk.Keypair.fromSecret(fromSecretKey);
      const account = await this.stellarServer.loadAccount(fromPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "initiate_bridge",
            ...StellarSdk.nativeToScVal(sourceChain, { type: "u32" }),
            ...StellarSdk.nativeToScVal(targetChain, { type: "u32" }),
            ...StellarSdk.nativeToScVal(tokenAddress, { type: "address" }),
            ...StellarSdk.nativeToScVal(toAddress, { type: "address" }),
            ...StellarSdk.nativeToScVal(amount, { type: "u128" }),
            ...StellarSdk.nativeToScVal(fromPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(metadata || "", { type: "bytes" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(fromKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Bridge transaction initiated', {
        transactionHash: result.hash,
        sourceChain,
        targetChain,
        amount,
        fromAddress: fromPublicKey,
        toAddress
      });

      return result.hash;
    } catch (error) {
      logger.error('Failed to initiate bridge transaction', error);
      throw error;
    }
  }

  /**
   * Confirm a bridge transaction
   */
  async confirmTransaction(
    transactionId: string,
    relayerPublicKey: string,
    relayerSecretKey: string
  ): Promise<boolean> {
    try {
      const relayerKeypair = StellarSdk.Keypair.fromSecret(relayerSecretKey);
      const account = await this.stellarServer.loadAccount(relayerPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "confirm_transaction",
            ...StellarSdk.nativeToScVal(transactionId, { type: "u64" }),
            ...StellarSdk.nativeToScVal(relayerPublicKey, { type: "address" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(relayerKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Bridge transaction confirmed', {
        transactionHash: result.hash,
        transactionId,
        relayer: relayerPublicKey
      });

      return true;
    } catch (error) {
      logger.error('Failed to confirm bridge transaction', error);
      throw error;
    }
  }

  /**
   * Complete a bridge transaction
   */
  async completeTransaction(
    transactionId: string,
    relayerPublicKey: string,
    relayerSecretKey: string,
    proof: string
  ): Promise<boolean> {
    try {
      const relayerKeypair = StellarSdk.Keypair.fromSecret(relayerSecretKey);
      const account = await this.stellarServer.loadAccount(relayerPublicKey);

      const contract = new StellarSdk.Contract(this.contractId);
      
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "complete_transaction",
            ...StellarSdk.nativeToScVal(transactionId, { type: "u64" }),
            ...StellarSdk.nativeToScVal(relayerPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(proof, { type: "bytes" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(relayerKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Bridge transaction completed', {
        transactionHash: result.hash,
        transactionId,
        relayer: relayerPublicKey
      });

      return true;
    } catch (error) {
      logger.error('Failed to complete bridge transaction', error);
      throw error;
    }
  }

  /**
   * Register a new relayer
   */
  async registerRelayer(
    adminPublicKey: string,
    adminSecretKey: string,
    relayerAddress: string,
    stake: string
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
            "register_relayer",
            ...StellarSdk.nativeToScVal(adminPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(relayerAddress, { type: "address" }),
            ...StellarSdk.nativeToScVal(stake, { type: "u128" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Relayer registered', {
        transactionHash: result.hash,
        relayerAddress,
        stake
      });
    } catch (error) {
      logger.error('Failed to register relayer', error);
      throw error;
    }
  }

  /**
   * Update chain configuration
   */
  async updateChainConfig(
    adminPublicKey: string,
    adminSecretKey: string,
    chainConfig: ChainConfiguration
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
            "update_chain_config",
            ...StellarSdk.nativeToScVal(adminPublicKey, { type: "address" }),
            ...StellarSdk.nativeToScVal(chainConfig, { type: "ChainConfiguration" })
          )
        )
        .setTimeout(30)
        .build();

      tx.sign(adminKeypair);
      const result = await this.stellarServer.sendTransaction(tx);
      
      logger.info('Chain configuration updated', {
        transactionHash: result.hash,
        chainId: chainConfig.chain_id
      });
    } catch (error) {
      logger.error('Failed to update chain configuration', error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: string): Promise<BridgeTransaction | null> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call(
        "get_transaction",
        ...StellarSdk.nativeToScVal(transactionId, { type: "u64" })
      );

      const transactionData = StellarSdk.scValToNative(result);
      
      return this.mapToBridgeTransaction(transactionData);
    } catch (error) {
      logger.error('Failed to get transaction details', error);
      return null;
    }
  }

  /**
   * Get chain configuration
   */
  async getChainConfig(chainId: number): Promise<ChainConfiguration | null> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call(
        "get_chain_config",
        ...StellarSdk.nativeToScVal(chainId, { type: "u32" })
      );

      return StellarSdk.scValToNative(result);
    } catch (error) {
      logger.error('Failed to get chain configuration', error);
      return null;
    }
  }

  /**
   * Get relayer information
   */
  async getRelayer(relayerAddress: string): Promise<RelayerInfo | null> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call(
        "get_relayer",
        ...StellarSdk.nativeToScVal(relayerAddress, { type: "address" })
      );

      return StellarSdk.scValToNative(result);
    } catch (error) {
      logger.error('Failed to get relayer information', error);
      return null;
    }
  }

  /**
   * Get total transaction count
   */
  async getTransactionCount(): Promise<number> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call("get_transaction_count");
      
      return StellarSdk.scValToNative(result);
    } catch (error) {
      logger.error('Failed to get transaction count', error);
      return 0;
    }
  }

  /**
   * Get total volume
   */
  async getTotalVolume(): Promise<string> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call("get_total_volume");
      
      return StellarSdk.scValToNative(result);
    } catch (error) {
      logger.error('Failed to get total volume', error);
      return "0";
    }
  }

  /**
   * Get total fees
   */
  async getTotalFees(): Promise<string> {
    try {
      const contract = new StellarSdk.Contract(this.contractId);
      
      const result = await contract.call("get_total_fees");
      
      return StellarSdk.scValToNative(result);
    } catch (error) {
      logger.error('Failed to get total fees', error);
      return "0";
    }
  }

  /**
   * Emergency pause/unpause the bridge
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
      
      logger.info('Bridge pause status updated', {
        transactionHash: result.hash,
        paused
      });
    } catch (error) {
      logger.error('Failed to update pause status', error);
      throw error;
    }
  }

  /**
   * Get bridge statistics
   */
  async getBridgeStatistics(): Promise<{
    totalTransactions: number;
    totalVolume: string;
    totalFees: string;
    activeRelayers: number;
    supportedChains: number[];
  }> {
    try {
      const [transactionCount, totalVolume, totalFees] = await Promise.all([
        this.getTransactionCount(),
        this.getTotalVolume(),
        this.getTotalFees()
      ]);

      return {
        totalTransactions: transactionCount,
        totalVolume,
        totalFees,
        activeRelayers: 0, // Would need additional method to get this
        supportedChains: [1, 137, 56] // Default supported chains
      };
    } catch (error) {
      logger.error('Failed to get bridge statistics', error);
      throw error;
    }
  }

  /**
   * Map contract data to BridgeTransaction model
   */
  private mapToBridgeTransaction(data: any): BridgeTransaction {
    return {
      transactionId: data.transaction_id.toString(),
      sourceChain: data.source_chain,
      targetChain: data.target_chain,
      tokenAddress: data.token_address,
      fromAddress: data.from_address,
      toAddress: data.to_address,
      amount: data.amount.toString(),
      fee: data.fee.toString(),
      nonce: data.nonce.toString(),
      status: data.status,
      timestamp: new Date(data.timestamp * 1000),
      gasUsed: data.gas_used,
      relayerFee: data.relayer_fee.toString(),
      metadata: data.metadata,
      createdAt: new Date(data.timestamp * 1000),
      updatedAt: new Date(data.timestamp * 1000)
    };
  }

  /**
   * Monitor bridge transactions
   */
  async monitorTransactions(): Promise<void> {
    try {
      logger.info('Starting bridge transaction monitoring');
      
      // Set up event listener for bridge events
      // This would typically use webhooks or subscription services
      // For now, we'll implement a polling mechanism
      
      setInterval(async () => {
        try {
          const transactionCount = await this.getTransactionCount();
          logger.debug('Bridge monitoring check', { transactionCount });
        } catch (error) {
          logger.error('Error during bridge monitoring', error);
        }
      }, 30000); // Check every 30 seconds
      
    } catch (error) {
      logger.error('Failed to start bridge monitoring', error);
      throw error;
    }
  }

  /**
   * Validate bridge transaction parameters
   */
  validateBridgeParams(
    sourceChain: number,
    targetChain: number,
    amount: string,
    tokenAddress: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (sourceChain === targetChain) {
      errors.push('Source and target chains must be different');
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      errors.push('Amount must be a positive number');
    }

    if (!tokenAddress || tokenAddress.length === 0) {
      errors.push('Token address is required');
    }

    const supportedChains = [1, 137, 56]; // Ethereum, Polygon, BSC
    if (!supportedChains.includes(sourceChain)) {
      errors.push('Source chain is not supported');
    }

    if (!supportedChains.includes(targetChain)) {
      errors.push('Target chain is not supported');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
