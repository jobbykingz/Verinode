import {
  StorageApplications,
  StorageApplicationsConfig,
  StorageApplicationMetrics,
} from '../storageapplications/StorageApplications';
import { ProofDataRecord, PersistenceResult } from '../storageapplications/DataPersistence';
import { DistributionResult, StorageNode } from '../storageapplications/DistributedStorage';
import { IntegrityResult } from '../storageapplications/IntegrityVerifier';
import { StorageType, StorageConfig, StoragePolicy } from './storage/DecentralizedStorageService';
import { Buffer } from 'buffer';

/**
 * Factory configuration for creating StorageApplicationService.
 */
export interface StorageApplicationServiceConfig {
  ipfsApiUrl: string;
  ipfsGatewayUrl: string;
  ipfsProjectId: string;
  ipfsProjectSecret: string;
  arweaveGatewayUrl: string;
  arweaveNodeUrl: string;
  arweaveWallet: {
    jwk: any;
    address: string;
  };
  defaultStorageType: StorageType;
  redundancyFactor: number;
  enableBlockchainVerification: boolean;
  chainId: string;
}

/**
 * Service-layer wrapper around StorageApplications that provides
 * a simplified interface for use by API routes and controllers.
 *
 * Manages the lifecycle (initialization, health checks, cleanup)
 * and exposes the core storage operations.
 */
export class StorageApplicationService {
  private storageApps: StorageApplications | null = null;
  private config: StorageApplicationServiceConfig;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: StorageApplicationServiceConfig) {
    this.config = config;
  }

  /**
   * Initialize the storage applications service.
   * Idempotent — safe to call multiple times.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const storageConfig: StorageConfig = {
        ipfs: {
          apiUrl: this.config.ipfsApiUrl,
          gatewayUrl: this.config.ipfsGatewayUrl,
          projectSecret: this.config.ipfsProjectSecret,
          projectId: this.config.ipfsProjectId,
          timeout: 30000,
          retryAttempts: 3,
          enablePubSub: true,
        },
        arweave: {
          gatewayUrl: this.config.arweaveGatewayUrl,
          nodeUrl: this.config.arweaveNodeUrl,
          wallet: this.config.arweaveWallet,
          timeout: 60000,
          retryAttempts: 3,
          currency: 'AR',
          rewardMultiplier: 1.2,
        },
        defaultType: this.config.defaultStorageType,
        redundancyFactor: this.config.redundancyFactor,
        verificationInterval: 86400000, // 24 hours
        autoRepair: true,
        costThreshold: 1000000,
        enableCaching: true,
        cacheSize: 104857600, // 100 MB
      };

      const policy: StoragePolicy = {
        defaultType: this.config.defaultStorageType,
        redundancyFactor: this.config.redundancyFactor,
        verificationInterval: 86400000,
        autoRepair: true,
        costThreshold: 1000000,
        maxFileSize: 1073741824, // 1 GB
        allowedMimeTypes: ['*'],
      };

      const appsConfig: StorageApplicationsConfig = {
        persistence: {
          storageType: this.config.defaultStorageType,
          replicationFactor: this.config.redundancyFactor,
          maxRetries: 3,
          retryDelayMs: 1000,
          enableCompression: true,
          enableEncryption: false,
          persistenceTimeoutMs: 30000,
          autoBackup: true,
          backupIntervalMs: 3600000, // 1 hour
          maxBackupCount: 10,
        },
        distribution: {
          minReplicas: 2,
          maxReplicas: 5,
          targetRedundancy: this.config.redundancyFactor,
          replicationStrategy: 'adaptive',
          consistencyLevel: 'quorum',
          nodeHealthCheckIntervalMs: 30000,
          rebalanceThreshold: 0.5,
          maxChunkSize: 262144, // 256 KB
        },
        integrity: {
          proofType: 'merkle',
          verificationIntervalMs: 3600000, // 1 hour
          maxRetriesOnFailure: 3,
          autoRepair: true,
          blockchainEnabled: this.config.enableBlockchainVerification,
          chainId: this.config.chainId,
          consensusThreshold: 0.67,
        },
        storage: storageConfig,
        policy,
      };

      this.storageApps = new StorageApplications(appsConfig);
      await this.storageApps.initialize();
      this.initialized = true;
    })();

    return this.initPromise;
  }

  /**
   * Store proof data with full persistence.
   */
  async storeProofData(
    proofId: string,
    proofType: string,
    data: Buffer | string,
    metadata?: Record<string, any>,
    tags?: string[]
  ): Promise<PersistenceResult> {
    await this.initialize();

    const record: ProofDataRecord = {
      id: `proof_record_${proofId}`,
      proofId,
      proofType,
      data,
      metadata: metadata || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
      priority: 'normal',
      tags: tags || [],
    };

    return this.storageApps!.storeProofData(record);
  }

  /**
   * Distribute large data across storage nodes.
   */
  async distributeData(
    data: Buffer,
    options?: {
      storageType?: StorageType;
      metadata?: Record<string, any>;
      tags?: string[];
      contentType?: string;
    }
  ): Promise<DistributionResult> {
    await this.initialize();
    return this.storageApps!.distributeData(data, options);
  }

  /**
   * Verify storage integrity with blockchain proof.
   */
  async verifyIntegrity(storageId: string): Promise<IntegrityResult> {
    await this.initialize();
    return this.storageApps!.verifyIntegrity(storageId);
  }

  /**
   * Retrieve persisted proof data.
   */
  async retrieveProofData(proofId: string): Promise<ProofDataRecord | null> {
    await this.initialize();
    return this.storageApps!.retrieveProofData(proofId);
  }

  /**
   * Register a storage node.
   */
  registerStorageNode(node: StorageNode): void {
    if (!this.storageApps) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    this.storageApps.registerStorageNode(node);
  }

  /**
   * Distribute incentives to storage providers.
   */
  async distributeIncentives(): Promise<void> {
    await this.initialize();
    return this.storageApps!.distributeIncentives();
  }

  /**
   * Get aggregated metrics.
   */
  async getMetrics(): Promise<StorageApplicationMetrics> {
    await this.initialize();
    return this.storageApps!.getMetrics();
  }

  /**
   * Perform health check.
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: any;
  }> {
    try {
      await this.initialize();

      const check = await this.storageApps!.performHealthCheck();
      return {
        healthy: check.persistence && check.distribution && check.integrity,
        details: {
          ...check,
          metrics: this.storageApps!.getMetrics(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: (error as Error).message,
          initialized: this.initialized,
        },
      };
    }
  }

  /**
   * Create a backup of all proof records.
   */
  async backup(): Promise<void> {
    await this.initialize();
    await this.storageApps!.backup();
  }

  /**
   * Get the distributed storage layer.
   */
  getDistributedStorage() {
    if (!this.storageApps) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    return this.storageApps.getDistributedStorage();
  }

  /**
   * Get the integrity verifier.
   */
  getIntegrityVerifier() {
    if (!this.storageApps) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    return this.storageApps.getIntegrityVerifier();
  }

  /**
   * Cleanup all resources.
   */
  async cleanup(): Promise<void> {
    if (this.storageApps) {
      await this.storageApps.cleanup();
      this.storageApps = null;
    }
    this.initialized = false;
    this.initPromise = null;
  }
}

// Singleton instance for the application
let serviceInstance: StorageApplicationService | null = null;

/**
 * Get or create the singleton StorageApplicationService instance.
 */
export function getStorageApplicationService(
  config?: StorageApplicationServiceConfig
): StorageApplicationService {
  if (!serviceInstance) {
    if (!config) {
      throw new Error('StorageApplicationService config required for first initialization');
    }
    serviceInstance = new StorageApplicationService(config);
  }
  return serviceInstance;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetStorageApplicationService(): void {
  if (serviceInstance) {
    serviceInstance.cleanup().catch(console.error);
  }
  serviceInstance = null;
}
