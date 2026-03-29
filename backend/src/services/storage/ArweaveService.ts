import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface ArweaveConfig {
  gatewayUrl: string;
  nodeUrl: string;
  wallet: {
    jwk: any;
    address: string;
  };
  timeout: number;
  retryAttempts: number;
  currency: string;
  rewardMultiplier: number;
}

export interface ArweaveReference {
  transactionId: string;
  dataHash: string;
  owner: string;
  contentType: string;
  size: number;
  timestamp: number;
  blockHeight: number;
  reward: number;
  tags: Array<{ name: string; value: string }>;
  gatewayUrl: string;
}

export interface ArweaveTransaction {
  id: string;
  owner: string;
  data: string;
  reward: number;
  tags: Array<{ name: string; value: string }>;
  signature: string;
  last_tx: string;
  quantity: number;
  target: string;
  data_size: string;
  data_root: string;
}

export interface ArweaveUploadResult {
  transactionId: string;
  size: number;
  reward: number;
  timestamp: number;
  blockHeight?: number;
  confirmed: boolean;
}

export interface ArweaveCost {
  costPerByte: number;
  estimatedReward: number;
  totalCost: number;
  currency: string;
}

export interface ArweaveStats {
  totalFiles: number;
  totalSize: number;
  totalRewards: number;
  confirmedFiles: number;
  pendingFiles: number;
  averageReward: number;
  storageUtilization: number;
}

export class ArweaveService extends EventEmitter {
  private client: AxiosInstance;
  private config: ArweaveConfig;
  private isInitialized = false;

  constructor(config: ArweaveConfig) {
    super();
    this.config = config;
    this.client = axios.create({
      baseURL: this.config.nodeUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Initialize Arweave service
   */
  async initialize(): Promise<void> {
    try {
      // Test connection
      const networkInfo = await this.getNetworkInfo();
      
      if (!networkInfo) {
        throw new Error('Failed to connect to Arweave network');
      }

      // Verify wallet
      if (!this.config.wallet || !this.config.wallet.address) {
        throw new Error('Valid wallet configuration required');
      }

      this.isInitialized = true;
      this.emit('initialized', { networkInfo });
    } catch (error) {
      console.error('Failed to initialize Arweave service:', error);
      throw new Error(`Arweave initialization failed: ${error.message}`);
    }
  }

  /**
   * Store data permanently on Arweave
   */
  async storeData(
    data: Buffer | Uint8Array | string,
    options: {
      contentType?: string;
      tags?: Array<{ name: string; value: string }>;
      reward?: number;
      target?: string;
    } = {}
  ): Promise<ArweaveUploadResult> {
    if (!this.isInitialized) {
      throw new Error('Arweave service not initialized');
    }

    const {
      contentType = 'application/octet-stream',
      tags = [],
      reward,
      target
    } = options;

    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const dataHash = this.calculateHash(buffer);
      
      // Calculate storage cost
      const cost = await this.calculateStorageCost(buffer.length, reward);
      
      // Create transaction
      const transaction = await this.createTransaction({
        data: buffer.toString('base64'),
        data_size: buffer.length.toString(),
        content_type: contentType,
        tags: [
          { name: 'App-Name', value: 'Verinode' },
          { name: 'App-Version', value: '1.0.0' },
          { name: 'Content-Type', value: contentType },
          { name: 'Data-Hash', value: dataHash },
          ...tags
        ],
        reward: cost.totalCost.toString(),
        target
      });

      // Sign transaction
      const signedTransaction = await this.signTransaction(transaction);

      // Submit transaction
      const response = await this.submitTransaction(signedTransaction);

      const result: ArweaveUploadResult = {
        transactionId: response.id,
        size: buffer.length,
        reward: cost.totalCost,
        timestamp: Date.now(),
        confirmed: false
      };

      this.emit('uploaded', result);
      return result;
    } catch (error) {
      this.emit('uploadError', { error: error.message });
      throw new Error(`Failed to upload to Arweave: ${error.message}`);
    }
  }

  /**
   * Store file with metadata
   */
  async storeFile(
    file: Buffer | Uint8Array,
    metadata: {
      name: string;
      mimeType: string;
      size: number;
      [key: string]: any;
    }
  ): Promise<ArweaveUploadResult> {
    const tags = [
      { name: 'File-Name', value: metadata.name },
      { name: 'File-Type', value: metadata.mimeType },
      { name: 'File-Size', value: metadata.size.toString() },
      { name: 'Upload-Timestamp', value: Date.now().toString() }
    ];

    return this.storeData(file, {
      contentType: metadata.mimeType,
      tags
    });
  }

  /**
   * Retrieve data from Arweave
   */
  async retrieveData(transactionId: string): Promise<Buffer> {
    if (!this.isInitialized) {
      throw new Error('Arweave service not initialized');
    }

    try {
      const response = await this.client.get(`/${transactionId}`, {
        responseType: 'arraybuffer',
        timeout: this.config.timeout
      });

      const data = Buffer.from(response.data);
      this.emit('retrieved', { transactionId, size: data.length });
      return data;
    } catch (error) {
      this.emit('retrieveError', { transactionId, error: error.message });
      throw new Error(`Failed to retrieve from Arweave: ${error.message}`);
    }
  }

  /**
   * Retrieve file with metadata
   */
  async retrieveFileWithMetadata(transactionId: string): Promise<{
    metadata: any;
    content: Buffer;
  }> {
    const transaction = await this.getTransaction(transactionId);
    const content = await this.retrieveData(transactionId);

    const metadata: any = {};
    
    // Extract metadata from tags
    if (transaction.tags) {
      for (const tag of transaction.tags) {
        metadata[tag.name] = tag.value;
      }
    }

    return {
      metadata,
      content
    };
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: string): Promise<ArweaveTransaction> {
    if (!this.isInitialized) {
      throw new Error('Arweave service not initialized');
    }

    try {
      const response: AxiosResponse<ArweaveTransaction> = await this.client.get(
        `/tx/${transactionId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get transaction: ${error.message}`);
    }
  }

  /**
   * Check if transaction is confirmed
   */
  async isConfirmed(transactionId: string): Promise<boolean> {
    try {
      const transaction = await this.getTransaction(transactionId);
      return transaction.block_height !== undefined && transaction.block_height > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    transactionId: string,
    maxWaitTime: number = 300000, // 5 minutes
    checkInterval: number = 10000 // 10 seconds
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const confirmed = await this.isConfirmed(transactionId);
      if (confirmed) {
        this.emit('confirmed', { transactionId });
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return false;
  }

  /**
   * Calculate storage cost for data
   */
  async calculateStorageCost(sizeBytes: number, customReward?: number): Promise<ArweaveCost> {
    try {
      // Get current network price per byte
      const priceResponse = await this.client.get('/price/1000');
      const pricePer1000Bytes = priceResponse.data;
      const costPerByte = pricePer1000Bytes / 1000;

      const baseCost = sizeBytes * costPerByte;
      const estimatedReward = customReward || (baseCost * this.config.rewardMultiplier);
      const totalCost = baseCost + estimatedReward;

      return {
        costPerByte,
        estimatedReward,
        totalCost,
        currency: this.config.currency
      };
    } catch (error) {
      // Fallback calculation
      const costPerByte = 1000000000; // 1 AR per GB as fallback
      const baseCost = sizeBytes * costPerByte;
      const estimatedReward = baseCost * this.config.rewardMultiplier;
      const totalCost = baseCost + estimatedReward;

      return {
        costPerByte,
        estimatedReward,
        totalCost,
        currency: this.config.currency
      };
    }
  }

  /**
   * Get cost estimate
   */
  async getCostEstimate(sizeBytes: number): Promise<ArweaveCost> {
    return this.calculateStorageCost(sizeBytes);
  }

  /**
   * Create transaction
   */
  private async createTransaction(data: any): Promise<any> {
    try {
      const response = await this.client.post('/tx', data);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
  }

  /**
   * Sign transaction
   */
  private async signTransaction(transaction: any): Promise<any> {
    try {
      // In a real implementation, this would use the Arweave JWK to sign
      // For now, we'll simulate the signing process
      const signature = this.simulateSignature(transaction);
      
      return {
        ...transaction,
        signature
      };
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error.message}`);
    }
  }

  /**
   * Submit transaction to network
   */
  private async submitTransaction(transaction: any): Promise<{ id: string }> {
    try {
      const response = await this.client.post('/tx', transaction);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to submit transaction: ${error.message}`);
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<any> {
    try {
      const response = await this.client.get('/info');
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<ArweaveStats> {
    if (!this.isInitialized) {
      throw new Error('Arweave service not initialized');
    }

    try {
      // Get wallet transactions
      const walletAddress = this.config.wallet.address;
      const response = await this.client.get(`/wallet/${walletAddress}/txs`);
      const transactions = response.data;

      let totalSize = 0;
      let totalRewards = 0;
      let confirmedFiles = 0;
      let pendingFiles = 0;

      for (const tx of transactions) {
        if (tx.data_size) {
          totalSize += parseInt(tx.data_size);
        }
        if (tx.reward) {
          totalRewards += parseFloat(tx.reward);
        }
        if (tx.block_height && tx.block_height > 0) {
          confirmedFiles++;
        } else {
          pendingFiles++;
        }
      }

      const averageReward = transactions.length > 0 ? totalRewards / transactions.length : 0;
      const storageUtilization = totalSize / (1024 * 1024 * 1024); // GB

      return {
        totalFiles: transactions.length,
        totalSize,
        totalRewards,
        confirmedFiles,
        pendingFiles,
        averageReward,
        storageUtilization
      };
    } catch (error) {
      throw new Error(`Failed to get Arweave stats: ${error.message}`);
    }
  }

  /**
   * Get files by content type
   */
  async getFilesByContentType(contentType: string): Promise<ArweaveReference[]> {
    if (!this.isInitialized) {
      throw new Error('Arweave service not initialized');
    }

    try {
      const walletAddress = this.config.wallet.address;
      const response = await this.client.get(`/wallet/${walletAddress}/txs`);
      const transactions = response.data;

      const files: ArweaveReference[] = [];

      for (const tx of transactions) {
        const contentTypeTag = tx.tags?.find((tag: any) => tag.name === 'Content-Type');
        if (contentTypeTag && contentTypeTag.value === contentType) {
          files.push({
            transactionId: tx.id,
            dataHash: tx.tags?.find((tag: any) => tag.name === 'Data-Hash')?.value || '',
            owner: tx.owner,
            contentType: contentTypeTag.value,
            size: parseInt(tx.data_size || '0'),
            timestamp: parseInt(tx.timestamp || Date.now().toString()),
            blockHeight: tx.block_height || 0,
            reward: parseFloat(tx.reward || '0'),
            tags: tx.tags || [],
            gatewayUrl: `${this.config.gatewayUrl}/${tx.id}`
          });
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to get files by content type: ${error.message}`);
    }
  }

  /**
   * Get files by tags
   */
  async getFilesByTags(searchTags: Array<{ name: string; value: string }>): Promise<ArweaveReference[]> {
    if (!this.isInitialized) {
      throw new Error('Arweave service not initialized');
    }

    try {
      const walletAddress = this.config.wallet.address;
      const response = await this.client.get(`/wallet/${walletAddress}/txs`);
      const transactions = response.data;

      const files: ArweaveReference[] = [];

      for (const tx of transactions) {
        if (!tx.tags) continue;

        let matches = true;
        for (const searchTag of searchTags) {
          const tagMatch = tx.tags.find((tag: any) => 
            tag.name === searchTag.name && tag.value === searchTag.value
          );
          if (!tagMatch) {
            matches = false;
            break;
          }
        }

        if (matches) {
          const contentTypeTag = tx.tags.find((tag: any) => tag.name === 'Content-Type');
          files.push({
            transactionId: tx.id,
            dataHash: tx.tags.find((tag: any) => tag.name === 'Data-Hash')?.value || '',
            owner: tx.owner,
            contentType: contentTypeTag?.value || 'application/octet-stream',
            size: parseInt(tx.data_size || '0'),
            timestamp: parseInt(tx.timestamp || Date.now().toString()),
            blockHeight: tx.block_height || 0,
            reward: parseFloat(tx.reward || '0'),
            tags: tx.tags,
            gatewayUrl: `${this.config.gatewayUrl}/${tx.id}`
          });
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to get files by tags: ${error.message}`);
    }
  }

  /**
   * Verify content integrity
   */
  async verifyContentIntegrity(transactionId: string, expectedHash?: string): Promise<boolean> {
    try {
      const data = await this.retrieveData(transactionId);
      const actualHash = this.calculateHash(data);

      if (expectedHash) {
        return actualHash === expectedHash;
      }

      // Get transaction and compare stored hash
      const transaction = await this.getTransaction(transactionId);
      const storedHash = transaction.tags?.find((tag: any) => tag.name === 'Data-Hash')?.value;
      
      return storedHash === actualHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate hash of data
   */
  private calculateHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Simulate signature (in production, use real Arweave signing)
   */
  private simulateSignature(transaction: any): string {
    const dataString = JSON.stringify(transaction);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Get gateway URL for content
   */
  getGatewayUrl(transactionId: string): string {
    return `${this.config.gatewayUrl}/${transactionId}`;
  }

  /**
   * Check service health
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      if (!this.isInitialized) {
        return { healthy: false, details: { error: 'Service not initialized' } };
      }

      const networkInfo = await this.getNetworkInfo();
      
      return {
        healthy: !!networkInfo,
        details: {
          networkInfo,
          walletAddress: this.config.wallet.address,
          nodeUrl: this.config.nodeUrl,
          gatewayUrl: this.config.gatewayUrl
        }
      };
    } catch (error) {
      return { healthy: false, details: { error: error.message } };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
    this.emit('cleanup');
  }
}
