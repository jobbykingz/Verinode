/**
 * Search Index Model
 * Defines the structure for search index documents and metadata
 */

import { Proof, Course } from './Course';

export interface SearchIndexDocument {
  id: string;
  type: 'proof' | 'course' | 'template' | 'user' | 'audit';
  title: string;
  description: string;
  content: string;
  tags: string[];
  category?: string;
  metadata: Record<string, any>;
  timestamp: Date;
  tenantId?: string;
  language: string;
  status: 'active' | 'inactive' | 'archived';
  visibility: 'public' | 'private' | 'restricted';
  searchVector?: number[];
  popularity?: number;
  rating?: number;
  lastIndexed: Date;
  version: number;
}

export interface SearchIndexStats {
  totalDocuments: number;
  documentsByType: Record<string, number>;
  lastIndexed: Date;
  indexSize: number;
  indexingTime: number;
  queryCount: number;
  averageQueryTime: number;
}

export interface SearchIndexConfig {
  name: string;
  fields: string[];
  analyzers: Record<string, string>;
  filters: Record<string, any>;
  boostings: Record<string, number>;
  refreshInterval: string;
  maxResultWindow: number;
  numberOfShards: number;
  numberOfReplicas: number;
}

export interface IndexMapping {
  properties: Record<string, {
    type: string;
    analyzer?: string;
    boost?: number;
    fields?: Record<string, {
      type: string;
      analyzer?: string;
    }>;
  }>;
}

export interface IndexingResult {
  success: boolean;
  indexed: number;
  failed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
  duration: number;
}

export interface BulkIndexOperation {
  action: 'index' | 'update' | 'delete';
  document: Partial<SearchIndexDocument>;
  documentId?: string;
}

export interface SearchSuggestion {
  text: string;
  type: 'completion' | 'correction' | 'related';
  score: number;
  source: string;
  metadata?: Record<string, any>;
}

export interface SearchHighlight {
  field: string;
  fragments: string[];
  score: number;
}

export interface SearchAggregation {
  name: string;
  type: 'terms' | 'range' | 'date_histogram' | 'filters';
  field: string;
  buckets: Array<{
    key: string;
    doc_count: number;
    sub_aggregations?: Record<string, any>;
  }>;
}

export interface SearchIndexResponse {
  took: number;
  timed_out: boolean;
  hits: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number;
    hits: Array<{
      _index: string;
      _id: string;
      _score: number;
      _source: SearchIndexDocument;
      highlight?: Record<string, string[]>;
    }>;
  };
  aggregations?: Record<string, SearchAggregation>;
}

export class SearchIndex {
  private documents: Map<string, SearchIndexDocument> = new Map();
  private config: SearchIndexConfig;
  private stats: SearchIndexStats;

  constructor(config: SearchIndexConfig) {
    this.config = config;
    this.stats = {
      totalDocuments: 0,
      documentsByType: {},
      lastIndexed: new Date(),
      indexSize: 0,
      indexingTime: 0,
      queryCount: 0,
      averageQueryTime: 0
    };
  }

  /**
   * Add or update a document in the index
   */
  async indexDocument(document: SearchIndexDocument): Promise<boolean> {
    try {
      document.lastIndexed = new Date();
      document.version = (this.documents.get(document.id)?.version || 0) + 1;
      
      this.documents.set(document.id, document);
      this.updateStats(document);
      
      return true;
    } catch (error) {
      console.error('Error indexing document:', error);
      return false;
    }
  }

  /**
   * Remove a document from the index
   */
  async removeDocument(documentId: string): Promise<boolean> {
    try {
      const document = this.documents.get(documentId);
      if (document) {
        this.documents.delete(documentId);
        this.stats.totalDocuments--;
        this.stats.documentsByType[document.type]--;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing document:', error);
      return false;
    }
  }

  /**
   * Bulk index multiple documents
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
          const success = await this.removeDocument(operation.documentId);
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
  getDocument(documentId: string): SearchIndexDocument | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Get all documents
   */
  getAllDocuments(): SearchIndexDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get documents by type
   */
  getDocumentsByType(type: string): SearchIndexDocument[] {
    return Array.from(this.documents.values()).filter(doc => doc.type === type);
  }

  /**
   * Get index statistics
   */
  getStats(): SearchIndexStats {
    return { ...this.stats };
  }

  /**
   * Get index configuration
   */
  getConfig(): SearchIndexConfig {
    return { ...this.config };
  }

  /**
   * Update index statistics
   */
  private updateStats(document: SearchIndexDocument): void {
    const isNew = !this.documents.has(document.id);
    
    if (isNew) {
      this.stats.totalDocuments++;
      this.stats.documentsByType[document.type] = 
        (this.stats.documentsByType[document.type] || 0) + 1;
    }

    this.stats.lastIndexed = new Date();
    this.stats.indexSize = this.documents.size;
  }

  /**
   * Generate mapping for Elasticsearch
   */
  generateMapping(): IndexMapping {
    const properties: Record<string, any> = {};

    for (const field of this.config.fields) {
      properties[field] = {
        type: this.getFieldType(field),
        analyzer: this.config.analyzers[field] || 'standard',
        boost: this.config.boostings[field] || 1.0
      };

      // Add keyword field for exact matching
      if (field === 'id' || field === 'type' || field === 'category') {
        properties[field].fields = {
          keyword: {
            type: 'keyword',
            ignore_above: 256
          }
        };
      }
    }

    return { properties };
  }

  /**
   * Get field type for mapping
   */
  private getFieldType(field: string): string {
    const textFields = ['title', 'description', 'content'];
    const dateFields = ['timestamp', 'lastIndexed'];
    const numericFields = ['popularity', 'rating', 'version'];

    if (textFields.includes(field)) return 'text';
    if (dateFields.includes(field)) return 'date';
    if (numericFields.includes(field)) return 'number';
    return 'keyword';
  }

  /**
   * Clear all documents from index
   */
  async clear(): Promise<void> {
    this.documents.clear();
    this.stats = {
      totalDocuments: 0,
      documentsByType: {},
      lastIndexed: new Date(),
      indexSize: 0,
      indexingTime: 0,
      queryCount: 0,
      averageQueryTime: 0
    };
  }

  /**
   * Optimize index for better performance
   */
  async optimize(): Promise<void> {
    // In a real implementation, this would optimize the underlying search engine
    console.log('Optimizing search index...');
    this.stats.lastIndexed = new Date();
  }
}

export default SearchIndex;
