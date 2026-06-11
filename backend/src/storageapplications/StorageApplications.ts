import { EventEmitter } from 'events';
import { Buffer } from 'buffer';
import {
  DecentralizedStorageService,
  StorageType,
  StorageConfig,
  StoragePolicy,
} from '../services/storage/DecentralizedStorageService';
import {
  DataPersistence,
  PersistenceConfig,
  ProofDataRecord,
  PersistenceResult,
} from './DataPersistence';
import {
  DistributedStorage,
  DistributedStorageConfig,
  DistributionResult,
} from './DistributedStorage';
import { IntegrityVerifier, IntegrityVerifierConfig, IntegrityResult } from './IntegrityVerifier';

/**
 * Top-level configuration for storage applications.
 */
export interface StorageApplicationsConfig {
  persistence: PersistenceConfig;
  distribution: DistributedStorageConfig;
  integrity: IntegrityVerifierConfig;
  storage: StorageConfig;
  policy: StoragePolicy;
}

/**
 * Storage application metrics aggregating all subsystems.
 */
export interface StorageApplicationMetrics {
  persistence: {
    totalProofs: number;
    totalSize: number;
    averagePersistTime: number;
    persistenceSuccessRate: number;
  };
  distribution: {
    totalNodes: number;
    onlineNodes: number;
    totalChunks: number;
    totalDataStored: number;
    averageRedundancy: number;
  };
  integrity: {
    totalVerifications: number;
    verifiedCount: number;
    failedCount: number;
    verificationRate: number;
    blockHeight: number;
  };
  overall: {
    totalOperations: number;
    successRate: number;
    uptime: number;
    startTime: number;
  };
}

/**
 * StorageApplications is the main orchestration class that ties together
 * all decentralized storage application subsystems:
 * - DataPersistence: For proof data persistence
 * - DistributedStorage: For distributed file storage across nodes
 * - IntegrityVerifier: For blockchain-verified storage integrity
 *
 * GIVEN storage application, WHEN used, THEN proof data is stored persistently.
 */
export class StorageApplications extends EventEmitter {
  private storageService: DecentralizedStorageService;
  private persistence: DataPersistence;
  private distribution: DistributedStorage;
  private integrity: IntegrityVerifier;
  private config: StorageApplicationsConfig;
  private isInitialized = false;
  private startTime: number;
  private operationCount = 0;
  private successCount = 0;

  constructor(config: StorageApplicationsConfig) {
    super();
    this.config = config;
    this.startTime = Date.now();

    // Initialize underlying storage service
    this.storageService = new DecentralizedStorageService(config.storage, config.policy);

    // Initialize subsystems
    this.persistence = new DataPersistence(this.storageService, config.persistence);
    this.distribution = new DistributedStorage(this.storageService, config.distribution);
    this.integrity = new IntegrityVerifier(this.storageService, config.integrity);

    // Proxy events from subsystems
    this.proxyEvents();
  }

  /**
   * Initialize all storage application subsystems.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.storageService.initialize();
      this.integrity.startPeriodicVerification();
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('initError', { error: (error as Error).message });
      throw new Error(`Storage applications initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Store proof data with full persistence.
   *
   * GIVEN storage application, WHEN used, THEN proof data is stored persistently.
   */
  async storeProofData(record: ProofDataRecord): Promise<PersistenceResult> {
    this.assertInitialized();
    this.operationCount++;

    const result = await this.persistence.persistProofData(record);

    if (result.verified) this.successCount++;
    return result;
  }

  /**
   * Distribute large data across storage nodes.
   *
   * GIVEN distributed storage, WHEN implemented, THEN data is available across network nodes.
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
    this.assertInitialized();
    this.operationCount++;

    const result = await this.distribution.distributeData(data, options);

    // Verify distribution after storage
    await this.integrity.verifyIntegrity(result.storageId);

    this.successCount++;
    return result;
  }

  /**
   * Verify storage integrity with blockchain proof.
   *
   * GIVEN blockchain verification, WHEN applied, THEN storage integrity is cryptographically proven.
   */
  async verifyIntegrity(storageId: string): Promise<IntegrityResult> {
    this.assertInitialized();
    this.operationCount++;

    const result = await this.integrity.verifyIntegrity(storageId);

    if (result.verified) this.successCount++;
    return result;
  }

  /**
   * Retrieve proof data from persistent storage.
   */
  async retrieveProofData(proofId: string): Promise<ProofDataRecord | null> {
    this.assertInitialized();
    return this.persistence.retrieveProofData(proofId);
  }

  /**
   * Register a storage node for distributed storage.
   */
  registerStorageNode(node: Parameters<DistributedStorage['registerNode']>[0]): void {
    this.distribution.registerNode(node);
  }

  /**
   * Distribute incentives to storage providers.
   *
   * GIVEN incentive mechanisms, WHEN active, THEN storage providers are rewarded.
   */
  async distributeIncentives(): Promise<void> {
    this.assertInitialized();
    await this.distribution.distributeIncentives();
    await this.distribution.processPayouts();
  }

  /**
   * Perform a full storage health check including integrity verification.
   */
  async performHealthCheck(): Promise<{
    persistence: boolean;
    distribution: boolean;
    integrity: boolean;
    details: string[];
  }> {
    this.assertInitialized();

    const details: string[] = [];

    // Check persistence
    const persistenceMetrics = this.persistence.getPersistenceMetrics();
    const persistenceHealthy = persistenceMetrics.persistenceSuccessRate > 0.9;
    details.push(`Persistence: ${persistenceHealthy ? 'healthy' : 'degraded'} (success rate: ${(persistenceMetrics.persistenceSuccessRate * 100).toFixed(1)}%)`);

    // Check distribution
    const distributionMetrics = this.distribution.getDistributionMetrics();
    const distributionHealthy = distributionMetrics.onlineNodes > 0;
    details.push(`Distribution: ${distributionHealthy ? 'healthy' : 'no nodes'} (nodes: ${distributionMetrics.onlineNodes}/${distributionMetrics.totalNodes})`);

    // Check integrity
    const integritySummary = this.integrity.getIntegritySummary();
    const integrityHealthy = integritySummary.verificationRate > 0.9;
    details.push(`Integrity: ${integrityHealthy ? 'healthy' : 'degraded'} (verification rate: ${(integritySummary.verificationRate * 100).toFixed(1)}%)`);

    return {
      persistence: persistenceHealthy,
      distribution: distributionHealthy,
      integrity: integrityHealthy,
      details,
    };
  }

  /**
   * Get aggregated metrics from all subsystems.
   */
  getMetrics(): StorageApplicationMetrics {
    const persistMetrics = this.persistence.getPersistenceMetrics();
    const distMetrics = this.distribution.getDistributionMetrics();
    const integSummary = this.integrity.getIntegritySummary();

    return {
      persistence: {
        totalProofs: persistMetrics.totalProofs,
        totalSize: persistMetrics.totalSize,
        averagePersistTime: persistMetrics.averagePersistTime,
        persistenceSuccessRate: persistMetrics.persistenceSuccessRate,
      },
      distribution: {
        totalNodes: distMetrics.totalNodes,
        onlineNodes: distMetrics.onlineNodes,
        totalChunks: distMetrics.totalChunks,
        totalDataStored: distMetrics.totalDataStored,
        averageRedundancy: distMetrics.averageRedundancy,
      },
      integrity: {
        totalVerifications: integSummary.totalVerifications,
        verifiedCount: integSummary.verifiedCount,
        failedCount: integSummary.failedCount,
        verificationRate: integSummary.verificationRate,
        blockHeight: integSummary.lastBlockHeight,
      },
      overall: {
        totalOperations: this.operationCount,
        successRate: this.operationCount > 0 ? this.successCount / this.operationCount : 0,
        uptime: Date.now() - this.startTime,
        startTime: this.startTime,
      },
    };
  }

  /**
   * Backup all proof records.
   */
  async backup(): Promise<void> {
    this.assertInitialized();
    await this.persistence.backupProofRecords();
  }

  /**
   * Get access to the underlying distributed storage (for node registration, etc.).
   */
  getDistributedStorage(): DistributedStorage {
    return this.distribution;
  }

  /**
   * Get access to the integrity verifier (for blockchain proofs, etc.).
   */
  getIntegrityVerifier(): IntegrityVerifier {
    return this.integrity;
  }

  /**
   * Get access to the data persistence layer.
   */
  getDataPersistence(): DataPersistence {
    return this.persistence;
  }

  /**
   * Get access to the underlying storage service.
   */
  getStorageService(): DecentralizedStorageService {
    return this.storageService;
  }

  /**
   * Ensure the application is initialized before performing operations.
   */
  private assertInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Storage applications not initialized. Call initialize() first.');
    }
  }

  /**
   * Proxy events from subsystems to the parent.
   */
  private proxyEvents(): void {
    // Persistence events
    this.persistence.on('persisted', (result) => this.emit('persisted', result));
    this.persistence.on('persistFailed', (result) => this.emit('persistFailed', result));
    this.persistence.on('deduplicated', (result) => this.emit('deduplicated', result));
    this.persistence.on('retrieved', (result) => this.emit('retrieved', result));
    this.persistence.on('backupComplete', (result) => this.emit('backupComplete', result));

    // Distribution events
    this.distribution.on('distributed', (result) => this.emit('distributed', result));
    this.distribution.on('nodeRegistered', (result) => this.emit('nodeRegistered', result));
    this.distribution.on('nodeOffline', (result) => this.emit('nodeOffline', result));
    this.distribution.on('payoutComplete', (result) => this.emit('payoutComplete', result));

    // Integrity events
    this.integrity.on('verified', (result) => this.emit('verified', result));
    this.integrity.on('verificationFailed', (result) => this.emit('verificationFailed', result));
    this.integrity.on('blockchainProofRecorded', (result) => this.emit('blockchainProofRecorded', result));
  }

  /**
   * Cleanup all resources.
   */
  async cleanup(): Promise<void> {
    await Promise.all([
      this.persistence.cleanup(),
      this.distribution.cleanup(),
      this.integrity.cleanup(),
      this.storageService.cleanup(),
    ]);

    this.isInitialized = false;
    this.emit('cleanup');
  }
}
