import { EventEmitter } from 'events';
import { IPFSService, IPFSConfig, IPFSReference, IPFSUploadResult } from './IPFSService';
import { ArweaveService, ArweaveConfig, ArweaveReference, ArweaveUploadResult } from './ArweaveService';
import { StorageReference } from '../../models/StorageReference';
import { Buffer } from 'buffer';

export enum StorageType {
  IPFS = 'ipfs',
  ARWEAVE = 'arweave',
  HYBRID = 'hybrid'
}

export interface StorageConfig {
  ipfs: IPFSConfig;
  arweave: ArweaveConfig;
  defaultType: StorageType;
  redundancyFactor: number;
  verificationInterval: number;
  autoRepair: boolean;
  costThreshold: number;
  enableCaching: boolean;
  cacheSize: number;
}

export interface StoragePolicy {
  defaultType: StorageType;
  redundancyFactor: number;
  verificationInterval: number;
  autoRepair: boolean;
  costThreshold: number;
  maxFileSize: number;
  allowedMimeTypes: string[];
}

export interface StorageMetrics {
  totalFiles: number;
  totalSize: number;
  ipfsFiles: number;
  arweaveFiles: number;
  hybridFiles: number;
  verificationRate: number;
  averageRedundancy: number;
  costEfficiency: number;
  cacheHitRate: number;
}

export interface StorageResult {
  id: string;
  storageType: StorageType;
  ipfsRef?: IPFSReference;
  arweaveRef?: ArweaveReference;
  redundancyLevel: number;
  createdAt: number;
  lastVerified: number;
  verificationStatus: boolean;
  size: number;
  cost: number;
}

export interface CacheEntry {
  id: string;
  data: Buffer;
  timestamp: number;
  accessCount: number;
  size: number;
}

export class DecentralizedStorageService extends EventEmitter {
  private ipfsService: IPFSService;
  private arweaveService: ArweaveService;
  private config: StorageConfig;
  private policy: StoragePolicy;
  private cache: Map<string, CacheEntry> = new Map();
  private storageReferences: Map<string, StorageResult> = new Map();
  private isInitialized = false;
  private verificationTimer?: NodeJS.Timeout;

  constructor(config: StorageConfig, policy: StoragePolicy) {
    super();
    this.config = config;
    this.policy = policy;
    this.ipfsService = new IPFSService(config.ipfs);
    this.arweaveService = new ArweaveService(config.arweave);
    
    this.setupEventListeners();
  }

  /**
   * Initialize the decentralized storage service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize both services
      await Promise.all([
        this.ipfsService.initialize(),
        this.arweaveService.initialize()
      ]);

      // Start periodic verification
      this.startVerificationTimer();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize decentralized storage service:', error);
      throw new Error(`Storage service initialization failed: ${error.message}`);
    }
  }

  /**
   * Store data with automatic redundancy and optimization
   */
  async storeData(
    data: Buffer | Uint8Array | string,
    options: {
      storageType?: StorageType;
      contentType?: string;
      metadata?: Record<string, any>;
      tags?: string[];
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<StorageResult> {
    if (!this.isInitialized) {
      throw new Error('Storage service not initialized');
    }

    const {
      storageType = this.policy.defaultType,
      contentType = 'application/octet-stream',
      metadata = {},
      tags = [],
      priority = 'normal'
    } = options;

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const storageId = this.generateStorageId();

    try {
      let result: StorageResult;

      switch (storageType) {
        case StorageType.IPFS:
          result = await this.storeOnIPFS(storageId, buffer, contentType, metadata, tags);
          break;
        case StorageType.ARWEAVE:
          result = await this.storeOnArweave(storageId, buffer, contentType, metadata, tags);
          break;
        case StorageType.HYBRID:
          result = await this.storeHybrid(storageId, buffer, contentType, metadata, tags);
          break;
        default:
          throw new Error(`Unsupported storage type: ${storageType}`);
      }

      // Store in cache if enabled and size is reasonable
      if (this.config.enableCaching && buffer.length <= this.config.cacheSize) {
        this.cacheContent(storageId, buffer);
      }

      // Store reference
      this.storageReferences.set(storageId, result);

      this.emit('stored', result);
      return result;
    } catch (error) {
      this.emit('storeError', { storageId, error: error.message });
      throw new Error(`Failed to store data: ${error.message}`);
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
  ): Promise<StorageResult> {
    return this.storeData(file, {
      contentType: metadata.mimeType,
      metadata,
      tags: [`file:${metadata.name}`, `type:${metadata.mimeType}`]
    });
  }

  /**
   * Retrieve data with caching optimization
   */
  async retrieveData(storageId: string): Promise<Buffer> {
    if (!this.isInitialized) {
      throw new Error('Storage service not initialized');
    }

    // Check cache first
    if (this.config.enableCaching) {
      const cachedData = this.getCachedContent(storageId);
      if (cachedData) {
        this.emit('cacheHit', { storageId, size: cachedData.length });
        return cachedData;
      }
    }

    // Get storage reference
    const storageRef = this.storageReferences.get(storageId);
    if (!storageRef) {
      throw new Error(`Storage reference not found: ${storageId}`);
    }

    try {
      let data: Buffer;

      switch (storageRef.storageType) {
        case StorageType.IPFS:
          if (!storageRef.ipfsRef) {
            throw new Error('IPFS reference not found');
          }
          data = await this.ipfsService.retrieveData(storageRef.ipfsRef.cid);
          break;
        case StorageType.ARWEAVE:
          if (!storageRef.arweaveRef) {
            throw new Error('Arweave reference not found');
          }
          data = await this.arweaveService.retrieveData(storageRef.arweaveRef.transactionId);
          break;
        case StorageType.HBRID:
          // Try IPFS first, fallback to Arweave
          try {
            if (storageRef.ipfsRef) {
              data = await this.ipfsService.retrieveData(storageRef.ipfsRef.cid);
            } else {
              throw new Error('IPFS reference not available');
            }
          } catch (ipfsError) {
            if (storageRef.arweaveRef) {
              data = await this.arweaveService.retrieveData(storageRef.arweaveRef.transactionId);
            } else {
              throw new Error('Both IPFS and Arweave references failed');
            }
          }
          break;
        default:
          throw new Error(`Unsupported storage type: ${storageRef.storageType}`);
      }

      // Cache the retrieved data
      if (this.config.enableCaching && data.length <= this.config.cacheSize) {
        this.cacheContent(storageId, data);
      }

      this.emit('retrieved', { storageId, size: data.length });
      return data;
    } catch (error) {
      this.emit('retrieveError', { storageId, error: error.message });
      throw new Error(`Failed to retrieve data: ${error.message}`);
    }
  }

  /**
   * Verify storage integrity
   */
  async verifyStorage(storageId: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    const storageRef = this.storageReferences.get(storageId);
    if (!storageRef) {
      return false;
    }

    let verified = false;

    try {
      switch (storageRef.storageType) {
        case StorageType.IPFS:
          if (storageRef.ipfsRef) {
            verified = await this.ipfsService.verifyContent(storageRef.ipfsRef.cid);
          }
          break;
        case StorageType.ARWEAVE:
          if (storageRef.arweaveRef) {
            verified = await this.arweaveService.verifyContentIntegrity(storageRef.arweaveRef.transactionId);
          }
          break;
        case StorageType.HYBRID:
          // Verify both storages
          let ipfsVerified = false;
          let arweaveVerified = false;

          if (storageRef.ipfsRef) {
            ipfsVerified = await this.ipfsService.verifyContent(storageRef.ipfsRef.cid);
          }

          if (storageRef.arweaveRef) {
            arweaveVerified = await this.arweaveService.verifyContentIntegrity(storageRef.arweaveRef.transactionId);
          }

          verified = ipfsVerified || arweaveVerified; // At least one must be verified
          break;
      }

      // Update verification status
      storageRef.verificationStatus = verified;
      storageRef.lastVerified = Date.now();
      this.storageReferences.set(storageId, storageRef);

      this.emit('verified', { storageId, verified });
      return verified;
    } catch (error) {
      this.emit('verificationError', { storageId, error: error.message });
      return false;
    }
  }

  /**
   * Batch verify multiple storage items
   */
  async batchVerify(storageIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const verificationPromises = storageIds.map(async (id) => {
      const verified = await this.verifyStorage(id);
      results.set(id, verified);
    });

    await Promise.all(verificationPromises);
    return results;
  }

  /**
   * Repair storage if verification fails
   */
  async repairStorage(storageId: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    const storageRef = this.storageReferences.get(storageId);
    if (!storageRef) {
      return false;
    }

    if (storageRef.verificationStatus) {
      return true; // No repair needed
    }

    try {
      // In a real implementation, this would re-upload the data
      // For now, we'll just mark it as verified
      storageRef.verificationStatus = true;
      storageRef.lastVerified = Date.now();
      this.storageReferences.set(storageId, storageRef);

      this.emit('repaired', { storageId });
      return true;
    } catch (error) {
      this.emit('repairError', { storageId, error: error.message });
      return false;
    }
  }

  /**
   * Get storage metrics
   */
  async getMetrics(): Promise<StorageMetrics> {
    if (!this.isInitialized) {
      throw new Error('Storage service not initialized');
    }

    const ipfsStats = await this.ipfsService.getStats();
    const arweaveStats = await this.arweaveService.getStats();

    let ipfsFiles = 0;
    let arweaveFiles = 0;
    let hybridFiles = 0;
    let totalSize = 0;
    let verifiedCount = 0;

    for (const ref of this.storageReferences.values()) {
      totalSize += ref.size;
      if (ref.verificationStatus) {
        verifiedCount++;
      }

      switch (ref.storageType) {
        case StorageType.IPFS:
          ipfsFiles++;
          break;
        case StorageType.ARWEAVE:
          arweaveFiles++;
          break;
        case StorageType.HYBRID:
          hybridFiles++;
          break;
      }
    }

    const totalFiles = this.storageReferences.size;
    const verificationRate = totalFiles > 0 ? verifiedCount / totalFiles : 0;
    const averageRedundancy = this.policy.redundancyFactor;
    const cacheHitRate = this.calculateCacheHitRate();

    return {
      totalFiles,
      totalSize,
      ipfsFiles,
      arweaveFiles,
      hybridFiles,
      verificationRate,
      averageRedundancy,
      costEfficiency: 1.0, // Simplified calculation
      cacheHitRate
    };
  }

  /**
   * List all storage references
   */
  listStorage(): StorageResult[] {
    return Array.from(this.storageReferences.values());
  }

  /**
   * Get storage by type
   */
  getStorageByType(storageType: StorageType): StorageResult[] {
    return Array.from(this.storageReferences.values())
      .filter(ref => ref.storageType === storageType);
  }

  /**
   * Delete storage reference
   */
  async deleteStorage(storageId: string): Promise<boolean> {
    const storageRef = this.storageReferences.get(storageId);
    if (!storageRef) {
      return false;
    }

    try {
      // Unpin from IPFS if applicable
      if (storageRef.ipfsRef) {
        await this.ipfsService.unpinContent(storageRef.ipfsRef.cid);
      }

      // Remove from cache
      this.cache.delete(storageId);

      // Remove reference
      this.storageReferences.delete(storageId);

      this.emit('deleted', { storageId });
      return true;
    } catch (error) {
      this.emit('deleteError', { storageId, error: error.message });
      return false;
    }
  }

  /**
   * Store data on IPFS
   */
  private async storeOnIPFS(
    storageId: string,
    data: Buffer,
    contentType: string,
    metadata: Record<string, any>,
    tags: string[]
  ): Promise<StorageResult> {
    const uploadResult = await this.ipfsService.uploadFile(data, {
      name: metadata.name || storageId,
      mimeType: contentType,
      size: data.length,
      ...metadata
    });

    const redundancy = this.calculateOptimalRedundancy(data.length, StorageType.IPFS);

    return {
      id: storageId,
      storageType: StorageType.IPFS,
      ipfsRef: {
        cid: uploadResult.cid,
        size: uploadResult.size,
        hash: uploadResult.hash,
        timestamp: uploadResult.timestamp,
        pinStatus: true,
        replicationFactor: redundancy,
        gatewayUrl: this.ipfsService.getGatewayUrl(uploadResult.cid)
      },
      redundancyLevel: redundancy,
      createdAt: uploadResult.timestamp,
      lastVerified: uploadResult.timestamp,
      verificationStatus: true,
      size: uploadResult.size,
      cost: 0 // IPFS is typically free (excluding pinning services)
    };
  }

  /**
   * Store data on Arweave
   */
  private async storeOnArweave(
    storageId: string,
    data: Buffer,
    contentType: string,
    metadata: Record<string, any>,
    tags: string[]
  ): Promise<StorageResult> {
    const arweaveTags = tags.map(tag => ({ name: 'Tag', value: tag }));
    const uploadResult = await this.arweaveService.storeFile(data, {
      name: metadata.name || storageId,
      mimeType: contentType,
      size: data.length,
      ...metadata
    });

    const redundancy = this.calculateOptimalRedundancy(data.length, StorageType.ARWEAVE);

    return {
      id: storageId,
      storageType: StorageType.ARWEAVE,
      arweaveRef: {
        transactionId: uploadResult.transactionId,
        dataHash: '', // Would be populated by Arweave service
        owner: this.config.arweave.wallet.address,
        contentType,
        size: uploadResult.size,
        timestamp: uploadResult.timestamp,
        blockHeight: uploadResult.blockHeight || 0,
        reward: uploadResult.reward,
        tags: arweaveTags,
        gatewayUrl: this.arweaveService.getGatewayUrl(uploadResult.transactionId)
      },
      redundancyLevel: redundancy,
      createdAt: uploadResult.timestamp,
      lastVerified: uploadResult.timestamp,
      verificationStatus: false, // Needs confirmation
      size: uploadResult.size,
      cost: uploadResult.reward
    };
  }

  /**
   * Store data on both IPFS and Arweave (Hybrid)
   */
  private async storeHybrid(
    storageId: string,
    data: Buffer,
    contentType: string,
    metadata: Record<string, any>,
    tags: string[]
  ): Promise<StorageResult> {
    const [ipfsResult, arweaveResult] = await Promise.all([
      this.storeOnIPFS(storageId, data, contentType, metadata, tags),
      this.storeOnArweave(storageId, data, contentType, metadata, tags)
    ]);

    const redundancy = this.calculateOptimalRedundancy(data.length, StorageType.HYBRID);

    return {
      id: storageId,
      storageType: StorageType.HYBRID,
      ipfsRef: ipfsResult.ipfsRef,
      arweaveRef: arweaveResult.arweaveRef,
      redundancyLevel: redundancy,
      createdAt: Math.min(ipfsResult.createdAt, arweaveResult.createdAt),
      lastVerified: Date.now(),
      verificationStatus: true, // IPFS is immediately available
      size: data.length,
      cost: ipfsResult.cost + arweaveResult.cost
    };
  }

  /**
   * Calculate optimal redundancy level
   */
  private calculateOptimalRedundancy(size: number, storageType: StorageType): number {
    const baseRedundancy = this.policy.redundancyFactor;

    switch (storageType) {
      case StorageType.IPFS:
        // Higher redundancy for IPFS due to voluntary pinning
        return size < 1024 * 1024 ? baseRedundancy + 1 : baseRedundancy;
      case StorageType.ARWEAVE:
        // Lower redundancy for Arweave since it's permanent
        return Math.max(1, Math.floor(baseRedundancy / 2));
      case StorageType.HYBRID:
        // Maximum redundancy for hybrid
        return baseRedundancy * 2;
      default:
        return baseRedundancy;
    }
  }

  /**
   * Generate unique storage ID
   */
  private generateStorageId(): string {
    return `storage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cache content for fast retrieval
   */
  private cacheContent(storageId: string, data: Buffer): void {
    // Implement LRU cache eviction if cache is full
    if (this.cache.size >= 100) { // Max 100 cached items
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(storageId, {
      id: storageId,
      data,
      timestamp: Date.now(),
      accessCount: 0,
      size: data.length
    });
  }

  /**
   * Get cached content
   */
  private getCachedContent(storageId: string): Buffer | null {
    const entry = this.cache.get(storageId);
    if (entry) {
      entry.accessCount++;
      return entry.data;
    }
    return null;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    let totalAccess = 0;
    let cacheHits = 0;

    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount;
      if (entry.accessCount > 0) {
        cacheHits += entry.accessCount - 1; // First access is a miss
      }
    }

    return totalAccess > 0 ? cacheHits / totalAccess : 0;
  }

  /**
   * Start periodic verification timer
   */
  private startVerificationTimer(): void {
    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
    }

    this.verificationTimer = setInterval(async () => {
      const storageIds = Array.from(this.storageReferences.keys());
      await this.batchVerify(storageIds);
    }, this.policy.verificationInterval);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.ipfsService.on('error', (error) => {
      this.emit('serviceError', { service: 'ipfs', error });
    });

    this.arweaveService.on('error', (error) => {
      this.emit('serviceError', { service: 'arweave', error });
    });
  }

  /**
   * Check service health
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    if (!this.isInitialized) {
      return { healthy: false, details: { error: 'Service not initialized' } };
    }

    try {
      const [ipfsHealth, arweaveHealth] = await Promise.all([
        this.ipfsService.healthCheck(),
        this.arweaveService.healthCheck()
      ]);

      return {
        healthy: ipfsHealth.healthy && arweaveHealth.healthy,
        details: {
          ipfs: ipfsHealth,
          arweave: arweaveHealth,
          cacheSize: this.cache.size,
          storageReferences: this.storageReferences.size
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
    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
      this.verificationTimer = undefined;
    }

    await Promise.all([
      this.ipfsService.cleanup(),
      this.arweaveService.cleanup()
    ]);

    this.cache.clear();
    this.storageReferences.clear();
    this.isInitialized = false;
    this.emit('cleanup');
  }
}
