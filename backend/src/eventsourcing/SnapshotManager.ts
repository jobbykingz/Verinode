import { Snapshot, ISnapshot } from '../models/Snapshot';
import { Event, IEvent } from '../models/Event';
import { EventEmitter } from 'events';
import { compress, decompress } from '../utils/compression';
import mongoose from 'mongoose';

export interface SnapshotOptions {
  compressionAlgorithm?: 'none' | 'gzip' | 'brotli' | 'lz4';
  retentionDays?: number;
  maxSnapshotsPerAggregate?: number;
  autoCleanup?: boolean;
  enableIntegrityCheck?: boolean;
}

export interface SnapshotCreationOptions {
  aggregateId: string;
  aggregateType: string;
  data: Record<string, any>;
  sequenceNumber: number;
  version?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SnapshotRestoreOptions {
  aggregateId: string;
  toSequence?: number;
  fromSnapshot?: string;
  validateIntegrity?: boolean;
}

export interface SnapshotMetrics {
  totalSnapshots: number;
  totalSize: number;
  compressionRatio: number;
  averageCreationTime: number;
  restoreSuccessRate: number;
  snapshotsPerAggregate: Map<string, number>;
}

export class SnapshotManager extends EventEmitter {
  private options: Required<SnapshotOptions>;
  private metrics: SnapshotMetrics;
  private isInitialized = false;

  constructor(options: SnapshotOptions = {}) {
    super();
    
    this.options = {
      compressionAlgorithm: options.compressionAlgorithm || 'gzip',
      retentionDays: options.retentionDays || 30,
      maxSnapshotsPerAggregate: options.maxSnapshotsPerAggregate || 10,
      autoCleanup: options.autoCleanup !== false,
      enableIntegrityCheck: options.enableIntegrityCheck !== false
    };

    this.metrics = {
      totalSnapshots: 0,
      totalSize: 0,
      compressionRatio: 1,
      averageCreationTime: 0,
      restoreSuccessRate: 1,
      snapshotsPerAggregate: new Map()
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure database connection is ready
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database connection not established');
      }

      // Start cleanup task if auto cleanup is enabled
      if (this.options.autoCleanup) {
        this.startCleanupTask();
      }

      // Load initial metrics
      await this.updateMetrics();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async createSnapshot(options: SnapshotCreationOptions): Promise<ISnapshot> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Validate sequence number
      const lastEvent = await Event.getLastEvent(options.aggregateId);
      if (!lastEvent || lastEvent.sequenceNumber < options.sequenceNumber) {
        throw new Error('Invalid sequence number for snapshot creation');
      }

      // Compress data if compression is enabled
      let compressedData = options.data;
      let actualSize = JSON.stringify(options.data).length;
      let compressedSize = actualSize;

      if (this.options.compressionAlgorithm !== 'none') {
        compressedData = await compress(options.data, this.options.compressionAlgorithm);
        compressedSize = JSON.stringify(compressedData).length;
      }

      // Create snapshot
      const snapshot = new Snapshot({
        snapshotId: this.generateSnapshotId(options.aggregateId, options.sequenceNumber),
        aggregateId: options.aggregateId,
        aggregateType: options.aggregateType,
        snapshotData: compressedData,
        snapshotMetadata: {
          version: options.version || 1,
          sequenceNumber: options.sequenceNumber,
          eventCount: options.sequenceNumber,
          lastEventId: lastEvent.eventId,
          lastEventTimestamp: lastEvent.createdAt,
          compressionAlgorithm: this.options.compressionAlgorithm,
          originalSize: actualSize,
          compressedSize: compressedSize,
          ...options.metadata
        },
        tags: options.tags || [],
        size: compressedSize
      });

      await snapshot.save();

      // Update metrics
      this.updateSnapshotMetrics(snapshot, Date.now() - startTime);

      // Cleanup old snapshots if needed
      if (this.options.maxSnapshotsPerAggregate > 0) {
        await this.cleanupOldSnapshots(options.aggregateId);
      }

      this.emit('snapshotCreated', snapshot);
      return snapshot;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async restoreSnapshot(options: SnapshotRestoreOptions): Promise<{
    data: Record<string, any>;
    snapshot: ISnapshot;
    fromSequence: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      let snapshot: ISnapshot | null = null;

      // Find the appropriate snapshot
      if (options.fromSnapshot) {
        snapshot = await Snapshot.findOne({
          snapshotId: options.fromSnapshot,
          aggregateId: options.aggregateId,
          isActive: true
        });
      } else if (options.toSequence) {
        snapshot = await Snapshot.findSnapshotAtSequence(
          options.aggregateId,
          options.toSequence
        );
      } else {
        snapshot = await Snapshot.findLatestSnapshot(options.aggregateId);
      }

      if (!snapshot) {
        throw new Error(`No snapshot found for aggregate ${options.aggregateId}`);
      }

      // Validate integrity if requested
      if (options.validateIntegrity !== false && this.options.enableIntegrityCheck) {
        if (!(snapshot as any).verifyIntegrity()) {
          throw new Error('Snapshot integrity check failed');
        }
      }

      // Decompress data if needed
      let data = snapshot.snapshotData;
      if (snapshot.snapshotMetadata.compressionAlgorithm !== 'none') {
        data = await decompress(
          snapshot.snapshotData,
          snapshot.snapshotMetadata.compressionAlgorithm as any
        );
      }

      this.emit('snapshotRestored', snapshot);
      return {
        data,
        snapshot,
        fromSequence: snapshot.snapshotMetadata.sequenceNumber
      };
    } catch (error) {
      this.emit('error', error);
      this.metrics.restoreSuccessRate = 
        (this.metrics.restoreSuccessRate * this.metrics.totalSnapshots) / 
        (this.metrics.totalSnapshots + 1);
      throw error;
    }
  }

  async getSnapshots(
    aggregateId: string,
    options: {
      activeOnly?: boolean;
      limit?: number;
      fromSequence?: number;
      toSequence?: number;
    } = {}
  ): Promise<ISnapshot[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const query: any = { aggregateId };
      
      if (options.activeOnly !== false) {
        query.isActive = true;
      }

      if (options.fromSequence !== undefined || options.toSequence !== undefined) {
        query['snapshotMetadata.sequenceNumber'] = {};
        if (options.fromSequence !== undefined) {
          query['snapshotMetadata.sequenceNumber'].$gte = options.fromSequence;
        }
        if (options.toSequence !== undefined) {
          query['snapshotMetadata.sequenceNumber'].$lte = options.toSequence;
        }
      }

      let dbQuery = Snapshot.find(query)
        .sort({ 'snapshotMetadata.sequenceNumber': -1 });
      
      if (options.limit) {
        dbQuery = dbQuery.limit(options.limit);
      }

      const snapshots = await dbQuery.exec();
      this.emit('snapshotsRetrieved', { aggregateId, count: snapshots.length });
      
      return snapshots;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const snapshot = await Snapshot.findOne({ snapshotId });
      if (!snapshot) {
        throw new Error(`Snapshot not found: ${snapshotId}`);
      }

      await snapshot.deactivate();
      this.emit('snapshotDeleted', snapshot);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async cleanupOldSnapshots(aggregateId: string): Promise<void> {
    try {
      const snapshots = await Snapshot.findByAggregate(aggregateId, { activeOnly: true });
      
      if (snapshots.length > this.options.maxSnapshotsPerAggregate) {
        // Keep the most recent snapshots
        const snapshotsToDelete = snapshots
          .sort((a: ISnapshot, b: ISnapshot) => b.snapshotMetadata.sequenceNumber - a.snapshotMetadata.sequenceNumber)
          .slice(this.options.maxSnapshotsPerAggregate);

        for (const snapshot of snapshotsToDelete) {
          await snapshot.deactivate();
          this.emit('snapshotCleanedUp', snapshot);
        }
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async cleanupExpiredSnapshots(): Promise<void> {
    try {
      const expiredSnapshots = await Snapshot.findExpiredSnapshots();
      
      for (const snapshot of expiredSnapshots) {
        await snapshot.deactivate();
        this.emit('snapshotExpired', snapshot);
      }

      this.emit('cleanupCompleted', { deletedCount: expiredSnapshots.length });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getSnapshotStats(aggregateType?: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return await Snapshot.getSnapshotStats(aggregateType);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async shouldCreateSnapshot(
    aggregateId: string,
    currentSequence: number,
    lastSnapshotSequence?: number
  ): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Check if we have enough events since last snapshot
      const eventsSinceSnapshot = lastSnapshotSequence 
        ? currentSequence - lastSnapshotSequence
        : currentSequence;

      // Create snapshot if we have enough events or if this is the first snapshot
      return eventsSinceSnapshot >= 100 || !lastSnapshotSequence;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  async getMetrics(): Promise<SnapshotMetrics> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.updateMetrics();
    return { ...this.metrics };
  }

  private async updateMetrics(): Promise<void> {
    try {
      const stats = await Snapshot.getSnapshotStats();
      
      this.metrics.totalSnapshots = stats.reduce((sum: number, stat: any) => sum + stat.count, 0);
      this.metrics.totalSize = stats.reduce((sum: number, stat: any) => sum + stat.totalSize, 0);
      
      // Calculate compression ratio
      const totalOriginalSize = stats.reduce((sum: number, stat: any) => 
        sum + (stat.avgSize * stat.count), 0);
      this.metrics.compressionRatio = totalOriginalSize > 0 
        ? this.metrics.totalSize / totalOriginalSize 
        : 1;

      // Update snapshots per aggregate
      this.metrics.snapshotsPerAggregate.clear();
      for (const stat of stats) {
        this.metrics.snapshotsPerAggregate.set(stat._id, stat.count);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  private updateSnapshotMetrics(snapshot: ISnapshot, creationTime: number): void {
    this.metrics.totalSnapshots++;
    this.metrics.totalSize += snapshot.size;
    
    // Update average creation time
    this.metrics.averageCreationTime = 
      (this.metrics.averageCreationTime * (this.metrics.totalSnapshots - 1) + creationTime) / 
      this.metrics.totalSnapshots;

    // Update snapshots per aggregate
    const current = this.metrics.snapshotsPerAggregate.get(snapshot.aggregateId) || 0;
    this.metrics.snapshotsPerAggregate.set(snapshot.aggregateId, current + 1);
  }

  private startCleanupTask(): void {
    // Run cleanup every 24 hours
    setInterval(async () => {
      try {
        await this.cleanupExpiredSnapshots();
      } catch (error) {
        this.emit('error', error);
      }
    }, 24 * 60 * 60 * 1000);
  }

  private generateSnapshotId(aggregateId: string, sequenceNumber: number): string {
    return `snap_${aggregateId}_${sequenceNumber}_${Date.now()}`;
  }

  async close(): Promise<void> {
    this.removeAllListeners();
    this.isInitialized = false;
    this.emit('closed');
  }
}

export default SnapshotManager;
