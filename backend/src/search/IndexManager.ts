/**
 * Index Manager
 * Manages search indices, synchronization, and maintenance operations
 */

import { SearchIndexDocument, SearchIndexStats, SearchIndexConfig, BulkIndexOperation, IndexingResult } from '../models/SearchIndex';
import { SearchEngineConfig } from './SearchEngine';
import logger from '../utils/logger';

export interface IndexSyncResult {
  success: boolean;
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
  duration: number;
}

export interface IndexMaintenanceResult {
  success: boolean;
  optimized: boolean;
  compacted: boolean;
  refreshed: boolean;
  errors: string[];
  duration: number;
}

export interface IndexSnapshot {
  id: string;
  timestamp: Date;
  documentCount: number;
  size: number;
  checksum: string;
  metadata: Record<string, any>;
}

export class IndexManager {
  private config: SearchEngineConfig;
  private indices: Map<string, SearchIndexDocument[]> = new Map();
  private stats: Map<string, SearchIndexStats> = new Map();
  private snapshots: Map<string, IndexSnapshot> = new Map();
  private syncQueue: BulkIndexOperation[] = [];
  private isSyncing = false;

  constructor(config: SearchEngineConfig) {
    this.config = config;
    this.initializeIndices();
  }

  /**
   * Initialize default indices
   */
  private async initializeIndices(): Promise<void> {
    const defaultIndices = ['proofs', 'courses', 'templates', 'users', 'audit'];
    
    for (const indexName of defaultIndices) {
      this.indices.set(indexName, []);
      this.stats.set(indexName, {
        totalDocuments: 0,
        documentsByType: {},
        lastIndexed: new Date(),
        indexSize: 0,
        indexingTime: 0,
        queryCount: 0,
        averageQueryTime: 0
      });
    }

    logger.info('Index manager initialized with default indices');
  }

  /**
   * Index a document
   */
  async indexDocument(document: SearchIndexDocument): Promise<boolean> {
    try {
      const indexName = this.getIndexName(document.type);
      const documents = this.indices.get(indexName) || [];
      
      const existingIndex = documents.findIndex(doc => doc.id === document.id);
      
      if (existingIndex >= 0) {
        documents[existingIndex] = document;
      } else {
        documents.push(document);
      }

      this.indices.set(indexName, documents);
      this.updateStats(indexName, document, existingIndex < 0);
      
      logger.debug(`Document indexed: ${document.id} in ${indexName}`);
      return true;
    } catch (error) {
      logger.error('Failed to index document:', error);
      return false;
    }
  }

  /**
   * Remove a document
   */
  async removeDocument(documentId: string, type: string): Promise<boolean> {
    try {
      const indexName = this.getIndexName(type);
      const documents = this.indices.get(indexName) || [];
      
      const index = documents.findIndex(doc => doc.id === documentId);
      
      if (index >= 0) {
        documents.splice(index, 1);
        this.indices.set(indexName, documents);
        this.updateStats(indexName, { id: documentId, type } as SearchIndexDocument, false);
        
        logger.debug(`Document removed: ${documentId} from ${indexName}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to remove document:', error);
      return false;
    }
  }

  /**
   * Bulk index operations
   */
  async bulkIndex(operations: BulkIndexOperation[]): Promise<IndexingResult> {
    const startTime = Date.now();
    const result: IndexingResult = {
      success: true,
      indexed: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    for (const operation of operations) {
      try {
        if (operation.action === 'index' && operation.document) {
          const success = await this.indexDocument(operation.document as SearchIndexDocument);
          if (success) {
            result.indexed++;
          } else {
            result.failed++;
            result.errors.push({
              id: operation.document.id || 'unknown',
              error: 'Indexing failed'
            });
          }
        } else if (operation.action === 'delete' && operation.documentId) {
          const success = await this.removeDocument(operation.documentId, operation.document.type || 'unknown');
          if (success) {
            result.indexed++;
          } else {
            result.failed++;
            result.errors.push({
              id: operation.documentId,
              error: 'Deletion failed'
            });
          }
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: operation.documentId || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    result.duration = Date.now() - startTime;
    result.success = result.failed === 0;

    return result;
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<SearchIndexDocument | null> {
    for (const documents of this.indices.values()) {
      const document = documents.find(doc => doc.id === documentId);
      if (document) {
        return document;
      }
    }
    return null;
  }

  /**
   * Get all documents from an index
   */
  async getAllDocuments(indexName?: string): Promise<SearchIndexDocument[]> {
    if (indexName) {
      return this.indices.get(indexName) || [];
    }

    const allDocuments: SearchIndexDocument[] = [];
    for (const documents of this.indices.values()) {
      allDocuments.push(...documents);
    }
    return allDocuments;
  }

  /**
   * Get documents by type
   */
  async getDocumentsByType(type: string): Promise<SearchIndexDocument[]> {
    const indexName = this.getIndexName(type);
    return this.indices.get(indexName) || [];
  }

  /**
   * Search within an index
   */
  async searchInIndex(indexName: string, query: string, options?: {
    fields?: string[];
    limit?: number;
    offset?: number;
  }): Promise<SearchIndexDocument[]> {
    const documents = this.indices.get(indexName) || [];
    const searchQuery = query.toLowerCase();
    const fields = options?.fields || ['title', 'description', 'content'];
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const results = documents.filter(doc => {
      return fields.some(field => {
        const value = doc[field as keyof SearchIndexDocument];
        return value && typeof value === 'string' && 
               value.toLowerCase().includes(searchQuery);
      });
    });

    return results.slice(offset, offset + limit);
  }

  /**
   * Synchronize indices with data source
   */
  async syncWithDataSource(): Promise<IndexSyncResult> {
    const startTime = Date.now();
    const result: IndexSyncResult = {
      success: true,
      added: 0,
      updated: 0,
      deleted: 0,
      errors: [],
      duration: 0
    };

    try {
      this.isSyncing = true;
      
      // This would integrate with your actual data sources
      // For now, we'll simulate a sync process
      for (const [indexName, documents] of this.indices) {
        const syncResult = await this.syncIndex(indexName, documents);
        result.added += syncResult.added;
        result.updated += syncResult.updated;
        result.deleted += syncResult.deleted;
        result.errors.push(...syncResult.errors);
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    } finally {
      this.isSyncing = false;
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Sync individual index
   */
  private async syncIndex(indexName: string, documents: SearchIndexDocument[]): Promise<IndexSyncResult> {
    const result: IndexSyncResult = {
      success: true,
      added: 0,
      updated: 0,
      deleted: 0,
      errors: [],
      duration: 0
    };

    // Simulate sync process - in real implementation, this would:
    // 1. Fetch data from source (database, API, etc.)
    // 2. Compare with existing documents
    // 3. Add new documents
    // 4. Update existing documents
    // 5. Remove deleted documents

    return result;
  }

  /**
   * Create index snapshot
   */
  async createSnapshot(indexName?: string): Promise<IndexSnapshot> {
    const snapshotId = `snapshot_${Date.now()}`;
    const timestamp = new Date();
    
    let documents: SearchIndexDocument[] = [];
    let documentCount = 0;
    
    if (indexName) {
      documents = this.indices.get(indexName) || [];
      documentCount = documents.length;
    } else {
      for (const docs of this.indices.values()) {
        documents.push(...docs);
      }
      documentCount = documents.length;
    }

    const size = JSON.stringify(documents).length;
    const checksum = this.generateChecksum(documents);

    const snapshot: IndexSnapshot = {
      id: snapshotId,
      timestamp,
      documentCount,
      size,
      checksum,
      metadata: {
        indexName,
        provider: this.config.provider,
        version: '1.0.0'
      }
    };

    this.snapshots.set(snapshotId, snapshot);
    logger.info(`Snapshot created: ${snapshotId} with ${documentCount} documents`);

    return snapshot;
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(snapshotId: string): Promise<boolean> {
    try {
      const snapshot = this.snapshots.get(snapshotId);
      if (!snapshot) {
        throw new Error(`Snapshot not found: ${snapshotId}`);
      }

      // In a real implementation, this would restore from persistent storage
      logger.info(`Restored from snapshot: ${snapshotId}`);
      return true;
    } catch (error) {
      logger.error('Failed to restore from snapshot:', error);
      return false;
    }
  }

  /**
   * Perform index maintenance
   */
  async performMaintenance(): Promise<IndexMaintenanceResult> {
    const startTime = Date.now();
    const result: IndexMaintenanceResult = {
      success: true,
      optimized: false,
      compacted: false,
      refreshed: false,
      errors: [],
      duration: 0
    };

    try {
      // Optimize indices
      result.optimized = await this.optimizeIndices();
      
      // Compact indices
      result.compacted = await this.compactIndices();
      
      // Refresh indices
      result.refreshed = await this.refreshIndices();
      
      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Maintenance failed');
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Optimize indices
   */
  private async optimizeIndices(): Promise<boolean> {
    try {
      for (const [indexName, documents] of this.indices) {
        // Sort documents for better performance
        documents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        this.indices.set(indexName, documents);
      }
      
      logger.info('Indices optimized');
      return true;
    } catch (error) {
      logger.error('Failed to optimize indices:', error);
      return false;
    }
  }

  /**
   * Compact indices
   */
  private async compactIndices(): Promise<boolean> {
    try {
      // Remove old/deleted documents and optimize storage
      for (const [indexName, documents] of this.indices) {
        const activeDocuments = documents.filter(doc => 
          doc.status !== 'inactive' && doc.status !== 'archived'
        );
        this.indices.set(indexName, activeDocuments);
      }
      
      logger.info('Indices compacted');
      return true;
    } catch (error) {
      logger.error('Failed to compact indices:', error);
      return false;
    }
  }

  /**
   * Refresh indices
   */
  private async refreshIndices(): Promise<boolean> {
    try {
      // Update statistics and metadata
      for (const [indexName, documents] of this.indices) {
        const stats = this.stats.get(indexName);
        if (stats) {
          stats.totalDocuments = documents.length;
          stats.lastIndexed = new Date();
          stats.indexSize = JSON.stringify(documents).length;
        }
      }
      
      logger.info('Indices refreshed');
      return true;
    } catch (error) {
      logger.error('Failed to refresh indices:', error);
      return false;
    }
  }

  /**
   * Get index statistics
   */
  async getStats(indexName?: string): Promise<SearchIndexStats | Record<string, SearchIndexStats>> {
    if (indexName) {
      return this.stats.get(indexName) || {
        totalDocuments: 0,
        documentsByType: {},
        lastIndexed: new Date(),
        indexSize: 0,
        indexingTime: 0,
        queryCount: 0,
        averageQueryTime: 0
      };
    }

    const allStats: Record<string, SearchIndexStats> = {};
    for (const [name, stats] of this.stats) {
      allStats[name] = { ...stats };
    }
    return allStats;
  }

  /**
   * Get index health
   */
  async getHealth(): Promise<Record<string, any>> {
    const health: Record<string, any> = {
      status: 'healthy',
      indices: {},
      snapshots: this.snapshots.size,
      isSyncing: this.isSyncing,
      queueSize: this.syncQueue.length
    };

    for (const [indexName, documents] of this.indices) {
      const stats = this.stats.get(indexName);
      health.indices[indexName] = {
        documentCount: documents.length,
        lastIndexed: stats?.lastIndexed,
        status: stats ? 'healthy' : 'unhealthy'
      };
    }

    return health;
  }

  /**
   * Get index name from document type
   */
  private getIndexName(type: string): string {
    const typeToIndex: Record<string, string> = {
      'proof': 'proofs',
      'course': 'courses',
      'template': 'templates',
      'user': 'users',
      'audit': 'audit'
    };
    
    return typeToIndex[type] || type + 's';
  }

  /**
   * Update index statistics
   */
  private updateStats(indexName: string, document: SearchIndexDocument, isNew: boolean): void {
    const stats = this.stats.get(indexName);
    if (!stats) return;

    if (isNew) {
      stats.totalDocuments++;
      stats.documentsByType[document.type] = 
        (stats.documentsByType[document.type] || 0) + 1;
    }

    stats.lastIndexed = new Date();
    stats.indexSize = this.indices.get(indexName)?.length || 0;
  }

  /**
   * Generate checksum for documents
   */
  private generateChecksum(documents: SearchIndexDocument[]): string {
    const content = documents
      .map(doc => `${doc.id}:${doc.version}:${doc.lastIndexed.getTime()}`)
      .join('|');
    
    // Simple hash function - in production, use crypto module
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(16);
  }

  /**
   * Clear all indices
   */
  async clear(): Promise<void> {
    this.indices.clear();
    this.stats.clear();
    this.snapshots.clear();
    this.syncQueue = [];
    
    await this.initializeIndices();
    logger.info('All indices cleared');
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): IndexSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Delete snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    return this.snapshots.delete(snapshotId);
  }
}

export default IndexManager;
