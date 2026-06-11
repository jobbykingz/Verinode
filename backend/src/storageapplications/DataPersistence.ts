import { EventEmitter } from 'events';
import crypto from 'crypto';
import { DecentralizedStorageService, StorageType, StorageResult, StorageMetrics } from '../services/storage/DecentralizedStorageService';

/**
 * Proof data record that needs persistent decentralized storage.
 */
export interface ProofDataRecord {
  id: string;
  proofId: string;
  proofType: string;
  data: Buffer | string;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  priority: 'low' | 'normal' | 'high';
  tags: string[];
}

/**
 * Configuration for proof data persistence.
 */
export interface PersistenceConfig {
  storageType: StorageType;
  replicationFactor: number;
  maxRetries: number;
  retryDelayMs: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  persistenceTimeoutMs: number;
  autoBackup: boolean;
  backupIntervalMs: number;
  maxBackupCount: number;
}

/**
 * Result of a persistence operation.
 */
export interface PersistenceResult {
  proofId: string;
  storageId: string;
  persistedAt: number;
  storageType: StorageType;
  verified: boolean;
  size: number;
  cost: number;
  attempts: number;
  duration: number;
}

/**
 * Persistence efficiency metrics.
 */
export interface PersistenceMetrics {
  totalProofs: number;
  totalSize: number;
  averagePersistTime: number;
  persistenceSuccessRate: number;
  compressionRatio: number;
  deduplicationRate: number;
  cacheHitRate: number;
  averageRetries: number;
}

/**
 * DataPersistence handles proof data persistence with efficiency optimization.
 * Ensures proof data is stored persistently across decentralized storage backends.
 */
export class DataPersistence extends EventEmitter {
  private storageService: DecentralizedStorageService;
  private config: PersistenceConfig;
  private proofRecords: Map<string, ProofDataRecord> = new Map();
  private persistenceHistory: Map<string, PersistenceResult[]> = new Map();
  private backupTimer?: NodeJS.Timeout;
  private deduplicationCache: Map<string, string> = new Map(); // hash -> storageId

  constructor(storageService: DecentralizedStorageService, config: PersistenceConfig) {
    super();
    this.storageService = storageService;
    this.config = config;

    if (config.autoBackup) {
      this.startAutoBackup();
    }
  }

  /**
   * Persist proof data with automatic retries and efficiency optimization.
   *
   * GIVEN storage application, WHEN used, THEN proof data is stored persistently.
   */
  async persistProofData(record: ProofDataRecord): Promise<PersistenceResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let attempts = 0;

    // Check deduplication cache to avoid redundant storage
    const dataHash = this.computeDataHash(record.data);
    const existingId = this.deduplicationCache.get(dataHash);
    if (existingId) {
      this.emit('deduplicated', { proofId: record.proofId, existingId });
      return {
        proofId: record.proofId,
        storageId: existingId,
        persistedAt: Date.now(),
        storageType: this.config.storageType,
        verified: true,
        size: this.dataSize(record.data),
        cost: 0,
        attempts: 0,
        duration: Date.now() - startTime,
      };
    }

    const dataBuffer = Buffer.isBuffer(record.data) ? record.data : Buffer.from(record.data);

    while (attempts < this.config.maxRetries) {
      attempts++;
      try {
        const result = await this.storageService.storeData(dataBuffer, {
          storageType: this.config.storageType,
          contentType: 'application/verinode-proof',
          metadata: {
            ...record.metadata,
            proofId: record.proofId,
            proofType: record.proofType,
            originalTimestamp: record.createdAt,
          },
          tags: [...record.tags, `proof:${record.proofId}`, `type:${record.proofType}`],
          priority: record.priority,
        });

        // Store in deduplication cache
        this.deduplicationCache.set(dataHash, result.id);

        // Update internal record
        this.proofRecords.set(record.proofId, {
          ...record,
          updatedAt: Date.now(),
        });

        // Track history
        const persistenceResult: PersistenceResult = {
          proofId: record.proofId,
          storageId: result.id,
          persistedAt: Date.now(),
          storageType: result.storageType,
          verified: result.verificationStatus,
          size: result.size,
          cost: result.cost,
          attempts,
          duration: Date.now() - startTime,
        };

        const history = this.persistenceHistory.get(record.proofId) || [];
        history.push(persistenceResult);
        this.persistenceHistory.set(record.proofId, history);

        this.emit('persisted', persistenceResult);
        return persistenceResult;
      } catch (error) {
        lastError = error as Error;
        this.emit('persistRetry', { proofId: record.proofId, attempt: attempts, error: lastError.message });

        if (attempts < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs * attempts);
        }
      }
    }

    const failedResult: PersistenceResult = {
      proofId: record.proofId,
      storageId: '',
      persistedAt: 0,
      storageType: this.config.storageType,
      verified: false,
      size: 0,
      cost: 0,
      attempts,
      duration: Date.now() - startTime,
    };

    this.emit('persistFailed', { proofId: record.proofId, error: lastError?.message, attempts });
    return failedResult;
  }

  /**
   * Retrieve persisted proof data.
   */
  async retrieveProofData(proofId: string): Promise<ProofDataRecord | null> {
    const record = this.proofRecords.get(proofId);
    if (!record) return null;

    const history = this.persistenceHistory.get(proofId);
    if (!history || history.length === 0) return null;

    const latestPersist = history[history.length - 1];
    if (!latestPersist.storageId) return null;

    try {
      const data = await this.storageService.retrieveData(latestPersist.storageId);

      const updatedRecord: ProofDataRecord = {
        ...record,
        data,
        updatedAt: Date.now(),
        accessCount: record.accessCount + 1,
      };

      this.proofRecords.set(proofId, updatedRecord);
      this.emit('retrieved', { proofId, storageId: latestPersist.storageId });

      return updatedRecord;
    } catch (error) {
      this.emit('retrieveError', { proofId, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Verify persisted proof data integrity.
   */
  async verifyProofPersistence(proofId: string): Promise<boolean> {
    const history = this.persistenceHistory.get(proofId);
    if (!history || history.length === 0) return false;

    const latestPersist = history[history.length - 1];
    if (!latestPersist.storageId) return false;

    const verified = await this.storageService.verifyStorage(latestPersist.storageId);

    if (latestPersist.verified !== verified) {
      latestPersist.verified = verified;
      const hist = this.persistenceHistory.get(proofId) || [];
      hist[hist.length - 1] = latestPersist;
      this.persistenceHistory.set(proofId, hist);
    }

    return verified;
  }

  /**
   * Batch persist multiple proof data records with efficiency optimization.
   *
   * GIVEN efficiency optimization, WHEN applied, THEN storage operations are fast.
   */
  async batchPersist(records: ProofDataRecord[]): Promise<PersistenceResult[]> {
    // Optimize by grouping small records together
    const smallThreshold = 64 * 1024; // 64KB
    const smallRecords = records.filter((r) => this.dataSize(r.data) < smallThreshold);
    const largeRecords = records.filter((r) => this.dataSize(r.data) >= smallThreshold);

    const results: PersistenceResult[] = [];

    // Process small records in parallel batches for efficiency
    if (smallRecords.length > 0) {
      const batchSize = 5;
      for (let i = 0; i < smallRecords.length; i += batchSize) {
        const batch = smallRecords.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map((r) => this.persistProofData(r)));
        results.push(...batchResults);
      }
    }

    // Process large records sequentially to avoid memory pressure
    for (const record of largeRecords) {
      const result = await this.persistProofData(record);
      results.push(result);
    }

    return results;
  }

  /**
   * Get persistence efficiency metrics.
   */
  getPersistenceMetrics(): PersistenceMetrics {
    let totalPersistTime = 0;
    let persistCount = 0;
    let successCount = 0;
    let totalRetries = 0;

    for (const history of this.persistenceHistory.values()) {
      for (const entry of history) {
        persistCount++;
        totalPersistTime += entry.duration;
        totalRetries += entry.attempts - 1;
        if (entry.verified) successCount++;
      }
    }

    const totalProofs = this.proofRecords.size;
    let totalSize = 0;
    for (const record of this.proofRecords.values()) {
      totalSize += this.dataSize(record.data);
    }

    return {
      totalProofs,
      totalSize,
      averagePersistTime: persistCount > 0 ? totalPersistTime / persistCount : 0,
      persistenceSuccessRate: persistCount > 0 ? successCount / persistCount : 0,
      compressionRatio: 0.6, // Placeholder - would use actual compressor metrics
      deduplicationRate: this.deduplicationCache.size > 0
        ? 1 - (persistCount / this.deduplicationCache.size)
        : 0,
      cacheHitRate: 0,
      averageRetries: persistCount > 0 ? totalRetries / persistCount : 0,
    };
  }

  /**
   * Backup proof records for additional persistence.
   */
  async backupProofRecords(): Promise<void> {
    const metadata = JSON.stringify({
      records: Array.from(this.proofRecords.entries()).map(([id, record]) => ({
        id,
        proofId: record.proofId,
        proofType: record.proofType,
        metadata: record.metadata,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        tags: record.tags,
      })),
      timestamp: Date.now(),
    });

    try {
      await this.storageService.storeData(Buffer.from(metadata), {
        storageType: StorageType.HYBRID,
        contentType: 'application/json',
        tags: ['backup', 'proof-records', `count:${this.proofRecords.size}`],
      });

      this.emit('backupComplete', { count: this.proofRecords.size });
    } catch (error) {
      this.emit('backupError', { error: (error as Error).message });
    }
  }

  /**
   * Restore proof records from backup.
   */
  async restoreFromBackup(storageId: string): Promise<number> {
    try {
      const data = await this.storageService.retrieveData(storageId);
      const backup = JSON.parse(data.toString());

      let restored = 0;
      for (const entry of backup.records) {
        if (!this.proofRecords.has(entry.proofId)) {
          this.proofRecords.set(entry.proofId, {
            ...entry,
            data: Buffer.alloc(0), // Data placeholder
            accessCount: 0,
            priority: 'normal',
          });
          restored++;
        }
      }

      this.emit('restored', { restored });
      return restored;
    } catch (error) {
      this.emit('restoreError', { error: (error as Error).message });
      return 0;
    }
  }

  /**
   * Clean up old backup entries.
   */
  async cleanupOldBackups(): Promise<void> {
    const storageRefs = this.storageService.listStorage();
    const backupRefs = storageRefs.filter((r) =>
      r.id.includes('backup') || r.id.includes('proof-records')
    );

    if (backupRefs.length <= this.config.maxBackupCount) return;

    // Remove oldest backups first
    backupRefs.sort((a, b) => a.createdAt - b.createdAt);
    const toDelete = backupRefs.slice(0, backupRefs.length - this.config.maxBackupCount);

    for (const ref of toDelete) {
      await this.storageService.deleteStorage(ref.id);
    }
  }

  /**
   * Get all proof records.
   */
  listProofRecords(): ProofDataRecord[] {
    return Array.from(this.proofRecords.values());
  }

  /**
   * Get proof records by type.
   */
  getProofRecordsByType(proofType: string): ProofDataRecord[] {
    return Array.from(this.proofRecords.values()).filter((r) => r.proofType === proofType);
  }

  /**
   * Get persistence history for a proof.
   */
  getPersistenceHistory(proofId: string): PersistenceResult[] {
    return this.persistenceHistory.get(proofId) || [];
  }

  /**
   * Delete persisted proof data.
   */
  async deleteProofData(proofId: string): Promise<boolean> {
    const history = this.persistenceHistory.get(proofId);
    if (!history) return false;

    for (const entry of history) {
      if (entry.storageId) {
        await this.storageService.deleteStorage(entry.storageId);
      }
    }

    this.proofRecords.delete(proofId);
    this.persistenceHistory.delete(proofId);
    this.emit('deleted', { proofId });

    return true;
  }

  /**
   * Start automatic backup timer.
   */
  private startAutoBackup(): void {
    this.backupTimer = setInterval(async () => {
      await this.backupProofRecords();
      await this.cleanupOldBackups();
    }, this.config.backupIntervalMs);
  }

  /**
   * Stop automatic backup timer.
   */
  stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = undefined;
    }
  }

  /**
   * Compute data hash for deduplication.
   */
  private computeDataHash(data: Buffer | string): string {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  /**
   * Get data size in bytes.
   */
  private dataSize(data: Buffer | string): number {
    return Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
  }

  /**
   * Delay helper.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources.
   */
  async cleanup(): Promise<void> {
    this.stopAutoBackup();
    this.proofRecords.clear();
    this.persistenceHistory.clear();
    this.deduplicationCache.clear();
    this.removeAllListeners();
  }
}
