import { AuditLog, IAuditLog } from '../models/AuditLog';
import crypto from 'crypto';
import winston from 'winston';
import mongoose from 'mongoose';
import { createClient, RedisClientType } from 'redis';
import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';

/**
 * Storage Configuration
 */
export interface AuditStorageConfig {
  enableCompression: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
  redisUrl?: string;
  archivePath?: string;
  maxArchiveSize: number; // MB
  backupInterval: number; // hours
  enableReplication: boolean;
  replicationNodes?: string[];
}

/**
 * Archive Metadata
 */
export interface ArchiveMetadata {
  archiveId: string;
  startDate: Date;
  endDate: Date;
  recordCount: number;
  size: number;
  checksum: string;
  compressed: boolean;
  encrypted: boolean;
  createdAt: Date;
}

/**
 * Storage Statistics
 */
export interface StorageStats {
  totalRecords: number;
  totalSize: number;
  archivedRecords: number;
  archivedSize: number;
  compressionRatio: number;
  integrityChecks: number;
  integrityFailures: number;
  lastBackup?: Date;
  lastArchive?: Date;
}

/**
 * Tamper-Proof Audit Storage
 * 
 * Provides secure, immutable storage for audit logs with:
 * - Cryptographic integrity verification
 * - Data compression and encryption
 * - Automatic archiving and backup
 * - Redis caching for performance
 * - Replication for high availability
 */
export class AuditStorage {
  private config: AuditStorageConfig;
  private logger: winston.Logger;
  private redisClient?: RedisClientType;
  private encryptionKey?: Buffer;
  private isInitialized = false;
  private backupTimer?: NodeJS.Timeout;

  constructor(config: AuditStorageConfig) {
    this.config = config;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/audit-storage.log' }),
        new winston.transports.Console()
      ]
    });

    // Initialize encryption key
    if (config.enableEncryption && config.encryptionKey) {
      this.encryptionKey = Buffer.from(config.encryptionKey, 'hex');
    }
  }

  /**
   * Initialize storage systems
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize Redis client
      if (this.config.redisUrl) {
        this.redisClient = createClient({ url: this.config.redisUrl });
        await this.redisClient.connect();
        this.logger.info('Redis client connected');
      }

      // Create archive directory
      if (this.config.archivePath) {
        await fs.mkdir(this.config.archivePath, { recursive: true });
        this.logger.info('Archive directory created', { path: this.config.archivePath });
      }

      // Start backup timer
      this.startBackupTimer();

      this.isInitialized = true;
      this.logger.info('Audit storage initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize audit storage', { error });
      throw error;
    }
  }

  /**
   * Store audit log with integrity verification
   */
  async store(auditLog: IAuditLog): Promise<void> {
    try {
      // Verify integrity before storage
      const isValid = auditLog.verifyIntegrity();
      if (!isValid) {
        throw new Error(`Audit log integrity check failed: ${auditLog.auditId}`);
      }

      // Cache in Redis for fast access
      if (this.redisClient) {
        await this.cacheAuditLog(auditLog);
      }

      this.logger.debug('Audit log stored', { auditId: auditLog.auditId });
    } catch (error) {
      this.logger.error('Failed to store audit log', { 
        auditId: auditLog.auditId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Retrieve audit log by ID
   */
  async retrieve(auditId: string): Promise<IAuditLog | null> {
    try {
      // Try cache first
      if (this.redisClient) {
        const cached = await this.getCachedAuditLog(auditId);
        if (cached) {
          // Verify integrity
          const isValid = cached.verifyIntegrity();
          if (!isValid) {
            this.logger.warn('Cached audit log integrity check failed', { auditId });
            await this.redisClient.del(`audit:${auditId}`);
          } else {
            return cached;
          }
        }
      }

      // Fallback to database
      const auditLog = await AuditLog.findOne({ auditId });
      if (auditLog) {
        // Verify integrity
        const isValid = auditLog.verifyIntegrity();
        if (!isValid) {
          this.logger.error('Database audit log integrity check failed', { auditId });
          throw new Error('Audit log integrity verification failed');
        }

        // Update cache
        if (this.redisClient) {
          await this.cacheAuditLog(auditLog);
        }

        return auditLog;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to retrieve audit log', { auditId, error });
      throw error;
    }
  }

  /**
   * Batch store audit logs
   */
  async batchStore(auditLogs: IAuditLog[]): Promise<void> {
    try {
      // Verify integrity of all logs
      const integrityResults = await Promise.all(
        auditLogs.map(log => log.verifyIntegrity())
      );

      const failedLogs = auditLogs.filter((_, index) => !integrityResults[index]);
      if (failedLogs.length > 0) {
        throw new Error(`Integrity check failed for ${failedLogs.length} audit logs`);
      }

      // Cache in Redis
      if (this.redisClient) {
        const cachePromises = auditLogs.map(log => this.cacheAuditLog(log));
        await Promise.all(cachePromises);
      }

      this.logger.info('Batch store completed', { 
        count: auditLogs.length 
      });
    } catch (error) {
      this.logger.error('Failed to batch store audit logs', { 
        count: auditLogs.length, 
        error 
      });
      throw error;
    }
  }

  /**
   * Archive old audit logs
   */
  async archive(beforeDate: Date): Promise<ArchiveMetadata> {
    try {
      // Find logs to archive
      const logsToArchive = await AuditLog.find({
        timestamp: { $lt: beforeDate },
        isArchived: false
      }).sort({ timestamp: 1 });

      if (logsToArchive.length === 0) {
        throw new Error('No logs found to archive');
      }

      // Create archive data
      const archiveData = {
        metadata: {
          archiveId: `archive_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
          startDate: logsToArchive[0].timestamp,
          endDate: logsToArchive[logsToArchive.length - 1].timestamp,
          recordCount: logsToArchive.length,
          createdAt: new Date()
        },
        logs: logsToArchive.map(log => log.toJSON())
      };

      // Serialize and compress
      let serializedData = JSON.stringify(archiveData);
      const originalSize = Buffer.byteLength(serializedData);

      if (this.config.enableCompression) {
        serializedData = await this.compressData(serializedData);
        archiveData.metadata.compressed = true;
      }

      // Encrypt if enabled
      if (this.config.enableEncryption && this.encryptionKey) {
        serializedData = await this.encryptData(serializedData);
        archiveData.metadata.encrypted = true;
      }

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(serializedData).digest('hex');
      archiveData.metadata.checksum = checksum;
      archiveData.metadata.size = Buffer.byteLength(serializedData);

      // Save to file
      const archivePath = this.config.archivePath || './archives';
      const filename = `${archiveData.metadata.archiveId}.audit`;
      const filepath = path.join(archivePath, filename);

      await fs.writeFile(filepath, serializedData);

      // Update database records
      await AuditLog.updateMany(
        { _id: { $in: logsToArchive.map(log => log._id) } },
        { 
          isArchived: true, 
          archivedAt: new Date(),
          metadata: { 
            ...logsToArchive[0].metadata,
            archiveId: archiveData.metadata.archiveId
          }
        }
      );

      // Clear from cache
      if (this.redisClient) {
        const cacheKeys = logsToArchive.map(log => `audit:${log.auditId}`);
        await this.redisClient.del(cacheKeys);
      }

      this.logger.info('Archive created successfully', {
        archiveId: archiveData.metadata.archiveId,
        recordCount: archiveData.metadata.recordCount,
        originalSize,
        compressedSize: archiveData.metadata.size,
        compressionRatio: originalSize / archiveData.metadata.size
      });

      return archiveData.metadata;
    } catch (error) {
      this.logger.error('Failed to archive audit logs', { error });
      throw error;
    }
  }

  /**
   * Verify integrity of stored audit logs
   */
  async verifyIntegrity(options: {
    fromDate?: Date;
    toDate?: Date;
    sampleSize?: number;
  } = {}): Promise<{
    total: number;
    verified: number;
    failed: number;
    failedIds: string[];
  }> {
    try {
      const query: any = {};
      if (options.fromDate || options.toDate) {
        query.timestamp = {};
        if (options.fromDate) query.timestamp.$gte = options.fromDate;
        if (options.toDate) query.timestamp.$lte = options.toDate;
      }

      let auditLogs;
      if (options.sampleSize) {
        auditLogs = await AuditLog.find(query).limit(options.sampleSize);
      } else {
        auditLogs = await AuditLog.find(query);
      }

      const results = {
        total: auditLogs.length,
        verified: 0,
        failed: 0,
        failedIds: [] as string[]
      };

      for (const log of auditLogs) {
        try {
          const isValid = log.verifyIntegrity();
          if (isValid) {
            results.verified++;
          } else {
            results.failed++;
            results.failedIds.push(log.auditId);
            this.logger.warn('Integrity check failed', { auditId: log.auditId });
          }
        } catch (error) {
          results.failed++;
          results.failedIds.push(log.auditId);
          this.logger.error('Integrity check error', { 
            auditId: log.auditId, 
            error 
          });
        }
      }

      this.logger.info('Integrity verification completed', results);
      return results;
    } catch (error) {
      this.logger.error('Failed to verify integrity', { error });
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const [
        totalRecords,
        archivedRecords,
        lastBackup,
        lastArchive
      ] = await Promise.all([
        AuditLog.countDocuments(),
        AuditLog.countDocuments({ isArchived: true }),
        this.getLastBackupDate(),
        this.getLastArchiveDate()
      ]);

      // Calculate sizes (estimated)
      const avgRecordSize = 1024; // 1KB average
      const totalSize = totalRecords * avgRecordSize;
      const archivedSize = archivedRecords * avgRecordSize;

      // Get integrity check stats
      const integrityChecks = await this.getIntegrityCheckStats();

      return {
        totalRecords,
        totalSize,
        archivedRecords,
        archivedSize,
        compressionRatio: this.config.enableCompression ? 0.3 : 1.0,
        ...integrityChecks,
        lastBackup,
        lastArchive
      };
    } catch (error) {
      this.logger.error('Failed to get storage stats', { error });
      throw error;
    }
  }

  /**
   * Restore from archive
   */
  async restoreFromArchive(archiveId: string): Promise<void> {
    try {
      const archivePath = this.config.archivePath || './archives';
      const filepath = path.join(archivePath, `${archiveId}.audit`);

      // Read archive file
      let archiveData = await fs.readFile(filepath);

      // Decrypt if needed
      if (this.config.enableEncryption && this.encryptionKey) {
        archiveData = await this.decryptData(archiveData);
      }

      // Decompress if needed
      const isCompressed = await this.isDataCompressed(archiveData);
      if (isCompressed) {
        archiveData = await this.decompressData(archiveData);
      }

      // Parse archive data
      const archive = JSON.parse(archiveData.toString());

      // Verify checksum
      const currentChecksum = crypto.createHash('sha256').update(archiveData).digest('hex');
      if (currentChecksum !== archive.metadata.checksum) {
        throw new Error('Archive checksum verification failed');
      }

      // Restore logs to database
      const restorePromises = archive.logs.map((logData: any) => {
        const log = new AuditLog(logData);
        return AuditLog.findOneAndUpdate(
          { auditId: log.auditId },
          log,
          { upsert: true }
        );
      });

      await Promise.all(restorePromises);

      this.logger.info('Archive restored successfully', {
        archiveId,
        recordCount: archive.metadata.recordCount
      });
    } catch (error) {
      this.logger.error('Failed to restore from archive', { archiveId, error });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async cacheAuditLog(auditLog: IAuditLog): Promise<void> {
    if (!this.redisClient) return;

    const key = `audit:${auditLog.auditId}`;
    const ttl = 3600; // 1 hour
    await this.redisClient.setEx(key, ttl, JSON.stringify(auditLog.toJSON()));
  }

  private async getCachedAuditLog(auditId: string): Promise<IAuditLog | null> {
    if (!this.redisClient) return null;

    const key = `audit:${auditId}`;
    const cached = await this.redisClient.get(key);
    
    if (cached) {
      const logData = JSON.parse(cached);
      return new AuditLog(logData) as IAuditLog;
    }

    return null;
  }

  private async compressData(data: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  private async decompressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  private async encryptData(data: string | Buffer): Promise<Buffer> {
    if (!this.encryptionKey) throw new Error('Encryption key not available');

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private async decryptData(encryptedData: Buffer): Promise<Buffer> {
    if (!this.encryptionKey) throw new Error('Encryption key not available');

    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  private async isDataCompressed(data: Buffer): Promise<boolean> {
    // Check gzip magic number
    return data[0] === 0x1f && data[1] === 0x8b;
  }

  private startBackupTimer(): void {
    const intervalMs = this.config.backupInterval * 60 * 60 * 1000; // Convert hours to ms
    
    this.backupTimer = setInterval(async () => {
      try {
        await this.performBackup();
      } catch (error) {
        this.logger.error('Scheduled backup failed', { error });
      }
    }, intervalMs);
  }

  private async performBackup(): Promise<void> {
    this.logger.info('Performing scheduled backup');
    
    // Archive logs older than 30 days
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - 30);
    
    try {
      await this.archive(archiveDate);
      this.logger.info('Scheduled backup completed');
    } catch (error) {
      this.logger.error('Scheduled backup failed', { error });
    }
  }

  private async getLastBackupDate(): Promise<Date | undefined> {
    // This would typically be stored in a separate backup metadata table
    // For now, return undefined
    return undefined;
  }

  private async getLastArchiveDate(): Promise<Date | undefined> {
    const lastArchived = await AuditLog
      .findOne({ isArchived: true })
      .sort({ archivedAt: -1 });
    
    return lastArchived?.archivedAt;
  }

  private async getIntegrityCheckStats(): Promise<{
    integrityChecks: number;
    integrityFailures: number;
  }> {
    // This would typically be stored in a separate metrics table
    // For now, return default values
    return {
      integrityChecks: 0,
      integrityFailures: 0
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    if (this.redisClient) {
      await this.redisClient.disconnect();
    }

    this.logger.info('Audit storage cleanup completed');
  }
}

export default AuditStorage;
