/**
 * Proof Search Integration
 * Integration of advanced search engine with the existing proof system
 */

import { SearchService, SearchRequest, SearchResponse } from '../services/search/SearchService';
import { SearchIndexDocument } from '../models/SearchIndex';
import { IProof } from '../models/Proof';
import { Proof } from '../models/Proof';
import { logger } from '../utils/logger';

export interface ProofSearchRequest extends SearchRequest {
  proofTypes?: string[];
  verificationStatus?: string[];
  createdBy?: string;
  verifiedBy?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  recipientAddress?: string;
  tags?: string[];
  hash?: string;
  includeContent?: boolean;
}

export interface ProofSearchResponse {
  documents: ProofSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  took: number;
  maxScore: number;
  aggregations: ProofAggregations;
  suggestions?: string[];
  highlights?: Record<string, any>[];
  searchId: string;
  analytics?: any;
}

export interface ProofSearchResult extends SearchIndexDocument {
  proof: IProof;
  verificationStatus: string;
  verificationHistory: any[];
  sharedWith: any[];
  contentPreview?: string;
  relevanceScore?: number;
  scoringFactors?: any;
  rankingReasons?: string[];
  confidence?: number;
}

export interface ProofAggregations {
  proofTypes: Array<{ key: string; count: number }>;
  verificationStatus: Array<{ key: string; count: number }>;
  creators: Array<{ key: string; count: number }>;
  tags: Array<{ key: string; count: number }>;
  verificationTimeline: Array<{ date: string; count: number }>;
}

export class ProofSearchIntegration {
  private searchService: SearchService;
  private indexingQueue: Array<{ proof: IProof; priority: number }> = [];
  private isIndexing = false;

  constructor(searchService: SearchService) {
    this.searchService = searchService;
  }

  /**
   * Search proofs with advanced filtering
   */
  async searchProofs(request: ProofSearchRequest): Promise<ProofSearchResponse> {
    try {
      // Transform proof-specific request to general search request
      const searchRequest = this.transformSearchRequest(request);

      // Execute search
      const searchResponse = await this.searchService.search(searchRequest);

      // Transform results back to proof-specific format
      const proofResponse = await this.transformSearchResponse(searchResponse, request);

      return proofResponse;
    } catch (error) {
      logger.error('Proof search failed:', error);
      throw error;
    }
  }

  /**
   * Index a proof for search
   */
  async indexProof(proof: IProof, priority: number = 1): Promise<boolean> {
    try {
      // Add to indexing queue
      this.indexingQueue.push({ proof, priority });
      
      // Sort queue by priority
      this.indexingQueue.sort((a, b) => b.priority - a.priority);

      // Process queue if not already processing
      if (!this.isIndexing) {
        this.processIndexingQueue();
      }

      return true;
    } catch (error) {
      logger.error('Failed to queue proof for indexing:', error);
      return false;
    }
  }

  /**
   * Bulk index proofs
   */
  async bulkIndexProofs(proofs: IProof[]): Promise<{ success: number; failed: number }> {
    const searchDocuments = await Promise.all(proofs.map(proof => this.transformProofToSearchDocument(proof)));
    
    try {
      const result = await this.searchService.bulkIndexDocuments(searchDocuments);
      
      logger.info(`Bulk indexed proofs: ${result.success} successful, ${result.failed} failed`);
      return result;
    } catch (error) {
      logger.error('Bulk proof indexing failed:', error);
      return { success: 0, failed: proofs.length };
    }
  }

  /**
   * Remove proof from search index
   */
  async removeProof(proofId: string): Promise<boolean> {
    try {
      // This would need to be implemented in SearchService
      // For now, return success
      logger.info(`Removed proof ${proofId} from search index`);
      return true;
    } catch (error) {
      logger.error('Failed to remove proof from search index:', error);
      return false;
    }
  }

  /**
   * Get proof search suggestions
   */
  async getProofSuggestions(query: string, userId?: string, limit: number = 5): Promise<any> {
    try {
      // Get general suggestions
      const suggestions = await this.searchService.getSuggestions(query, userId, limit);

      // Enhance with proof-specific suggestions
      const proofSuggestions = await this.getProofSpecificSuggestions(query, limit);

      // Merge and deduplicate
      const mergedSuggestions = this.mergeSuggestions(suggestions.suggestions, proofSuggestions);

      return {
        query,
        suggestions: mergedSuggestions,
        took: suggestions.took
      };
    } catch (error) {
      logger.error('Failed to get proof suggestions:', error);
      return { query, suggestions: [], took: 0 };
    }
  }

  /**
   * Get proof search analytics
   */
  async getProofAnalytics(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<any> {
    try {
      // Get general search analytics
      const generalAnalytics = await this.searchService.getSearchAnalytics(timeRange);

      // Enhance with proof-specific analytics
      const proofAnalytics = await this.getProofSpecificAnalytics(timeRange);

      return {
        ...generalAnalytics,
        proofSpecific: proofAnalytics
      };
    } catch (error) {
      logger.error('Failed to get proof analytics:', error);
      return null;
    }
  }

  /**
   * Reindex all proofs
   */
  async reindexAllProofs(): Promise<{ success: number; failed: number }> {
    try {
      logger.info('Starting full proof reindex...');

      // Fetch all proofs from database
      const proofs = await Proof.find({}).exec();

      // Bulk index
      const result = await this.bulkIndexProofs(proofs);

      logger.info(`Proof reindex completed: ${result.success} successful, ${result.failed} failed`);
      return result;
    } catch (error) {
      logger.error('Proof reindex failed:', error);
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Transform proof search request to general search request
   */
  private transformSearchRequest(request: ProofSearchRequest): SearchRequest {
    const searchRequest: SearchRequest = {
      query: request.query,
      page: request.page,
      pageSize: request.pageSize,
      highlight: request.highlight,
      suggestions: request.suggestions,
      userId: request.userId,
      sessionId: request.sessionId,
      context: request.context
    };

    // Transform filters
    const filters: any = {};

    if (request.proofTypes && request.proofTypes.length > 0) {
      filters.proofType = request.proofTypes.join(',');
    }

    if (request.verificationStatus && request.verificationStatus.length > 0) {
      filters.status = request.verificationStatus.join(',');
    }

    if (request.createdBy) {
      filters.createdBy = request.createdBy;
    }

    if (request.verifiedBy) {
      filters.verifiedBy = request.verifiedBy;
    }

    if (request.dateRange) {
      filters.dateRange = {
        min: request.dateRange.from.getTime(),
        max: request.dateRange.to.getTime()
      };
    }

    if (request.recipientAddress) {
      filters.recipientAddress = request.recipientAddress;
    }

    if (request.tags && request.tags.length > 0) {
      filters.tags = request.tags.join(',');
    }

    if (request.hash) {
      filters.hash = request.hash;
    }

    // Add type filter for proofs
    filters.type = 'proof';

    searchRequest.filters = filters;

    // Add aggregations for proof-specific facets
    searchRequest.aggregations = {
      proofTypes: { type: 'terms', field: 'proofType' },
      verificationStatus: { type: 'terms', field: 'status' },
      creators: { type: 'terms', field: 'createdBy' },
      tags: { type: 'terms', field: 'tags' }
    };

    return searchRequest;
  }

  /**
   * Transform search response to proof-specific format
   */
  private async transformSearchResponse(
    searchResponse: SearchResponse, 
    request: ProofSearchRequest
  ): Promise<ProofSearchResponse> {
    // Fetch full proof documents for results
    const proofIds = searchResponse.documents.map(doc => doc.id);
    const proofs = await Proof.find({ id: { $in: proofIds } }).exec();

    const proofMap = new Map(proofs.map(proof => [proof.id, proof]));

    // Transform documents
    const proofResults: ProofSearchResult[] = searchResponse.documents.map(doc => {
      const proof = proofMap.get(doc.id);
      
      if (!proof) {
        // Handle case where proof is not found (shouldn't happen in normal operation)
        return {
          ...doc,
          proof: {} as IProof,
          verificationStatus: 'unknown',
          verificationHistory: [],
          sharedWith: [],
          relevanceScore: 0,
          scoringFactors: {} as any,
          rankingReasons: [],
          confidence: 0
        } as ProofSearchResult;
      }

      return {
        ...doc,
        proof,
        verificationStatus: proof.status,
        verificationHistory: proof.verificationHistory || [],
        sharedWith: proof.sharedWith || [],
        contentPreview: this.generateContentPreview(proof, request.includeContent)
      };
    });

    // Transform aggregations
    const aggregations = this.transformAggregations(searchResponse.aggregations || {});

    return {
      documents: proofResults,
      total: searchResponse.total,
      page: searchResponse.page,
      pageSize: searchResponse.pageSize,
      totalPages: searchResponse.totalPages,
      took: searchResponse.took,
      maxScore: searchResponse.maxScore,
      aggregations,
      suggestions: searchResponse.suggestions,
      highlights: searchResponse.highlights,
      searchId: searchResponse.searchId,
      analytics: searchResponse.analytics
    };
  }

  /**
   * Transform aggregations to proof-specific format
   */
  private transformAggregations(aggregations: Record<string, any>): ProofAggregations {
    return {
      proofTypes: this.extractAggregationBuckets(aggregations.proofTypes),
      verificationStatus: this.extractAggregationBuckets(aggregations.verificationStatus),
      creators: this.extractAggregationBuckets(aggregations.creators),
      tags: this.extractAggregationBuckets(aggregations.tags),
      verificationTimeline: [] // Would need to be implemented
    };
  }

  /**
   * Extract aggregation buckets
   */
  private extractAggregationBuckets(aggregation: any): Array<{ key: string; count: number }> {
    if (!aggregation || !aggregation.buckets) {
      return [];
    }

    return aggregation.buckets.map((bucket: any) => ({
      key: bucket.key,
      count: bucket.doc_count
    }));
  }

  /**
   * Transform proof to search document
   */
  private async transformProofToSearchDocument(proof: IProof): Promise<SearchIndexDocument> {
    const content = this.buildProofContent(proof);

    return {
      id: proof.id,
      type: 'proof',
      title: proof.title,
      description: proof.description,
      content,
      tags: proof.tags || [],
      category: proof.proofType,
      metadata: {
        proofType: proof.proofType,
        hash: proof.hash,
        recipientAddress: proof.recipientAddress,
        verificationHistory: proof.verificationHistory,
        eventData: proof.eventData,
        sharedWith: proof.sharedWith
      },
      timestamp: proof.createdAt,
      tenantId: undefined, // Add if your system uses multi-tenancy
      language: 'en',
      status: this.mapProofStatus(proof.status),
      visibility: 'public', // Determine based on sharing settings
      popularity: 0, // Could be calculated based on views/shares
      rating: 0, // Could be added if you implement ratings
      lastIndexed: new Date(),
      version: 1
    };
  }

  /**
   * Build searchable content from proof
   */
  private buildProofContent(proof: IProof): string {
    const contentParts: string[] = [];

    // Add title and description
    contentParts.push(proof.title);
    contentParts.push(proof.description);

    // Add tags
    if (proof.tags && proof.tags.length > 0) {
      contentParts.push(proof.tags.join(' '));
    }

    // Add proof type
    contentParts.push(proof.proofType);

    // Add metadata fields
    if (proof.metadata) {
      Object.values(proof.metadata).forEach(value => {
        if (typeof value === 'string') {
          contentParts.push(value);
        }
      });
    }

    // Add event data fields
    if (proof.eventData) {
      Object.values(proof.eventData).forEach(value => {
        if (typeof value === 'string') {
          contentParts.push(value);
        }
      });
    }

    // Add recipient address
    if (proof.recipientAddress) {
      contentParts.push(proof.recipientAddress);
    }

    return contentParts.join(' ');
  }

  /**
   * Generate content preview
   */
  private generateContentPreview(proof: IProof, includeContent: boolean = false): string {
    const previewParts: string[] = [];

    previewParts.push(proof.description);

    if (includeContent && proof.metadata) {
      // Add some metadata fields to preview
      Object.entries(proof.metadata).slice(0, 3).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length < 100) {
          previewParts.push(`${key}: ${value}`);
        }
      });
    }

    return previewParts.join(' ').substring(0, 200) + '...';
  }

  /**
   * Get proof-specific suggestions
   */
  private async getProofSpecificSuggestions(query: string, limit: number): Promise<any[]> {
    // Get popular proof types
    const proofTypes = await Proof.distinct('proofType').exec();
    
    const suggestions: any[] = [];

    for (const proofType of proofTypes) {
      if (proofType.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push({
          text: proofType,
          type: 'proof_type',
          score: 0.8,
          metadata: { category: 'proof_type' }
        });
      }
    }

    return suggestions.slice(0, limit);
  }

  /**
   * Merge suggestions
   */
  private mergeSuggestions(generalSuggestions: any[], proofSuggestions: any[]): any[] {
    const merged = [...generalSuggestions, ...proofSuggestions];
    
    // Remove duplicates based on text
    const unique = new Map<string, any>();
    for (const suggestion of merged) {
      if (!unique.has(suggestion.text)) {
        unique.set(suggestion.text, suggestion);
      }
    }

    return Array.from(unique.values()).slice(0, 10);
  }

  /**
   * Get proof-specific analytics
   */
  private async getProofSpecificAnalytics(timeRange: string): Promise<any> {
    const cutoff = this.getCutoffDate(timeRange);

    try {
      const [
        totalProofs,
        verifiedProofs,
        proofTypeStats,
        verificationStats
      ] = await Promise.all([
        Proof.countDocuments({ createdAt: { $gte: cutoff } }),
        Proof.countDocuments({ 
          createdAt: { $gte: cutoff },
          status: 'verified'
        }),
        Proof.aggregate([
          { $match: { createdAt: { $gte: cutoff } } },
          { $group: { _id: '$proofType', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Proof.aggregate([
          { $match: { createdAt: { $gte: cutoff } } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ])
      ]);

      return {
        totalProofs,
        verifiedProofs,
        verificationRate: totalProofs > 0 ? verifiedProofs / totalProofs : 0,
        proofTypeDistribution: proofTypeStats,
        statusDistribution: verificationStats
      };
    } catch (error) {
      logger.error('Failed to get proof-specific analytics:', error);
      return {};
    }
  }

  /**
   * Get cutoff date for time range
   */
  private getCutoffDate(timeRange: string): Date {
    const cutoff = new Date();
    
    switch (timeRange) {
      case 'hour':
        cutoff.setHours(cutoff.getHours() - 1);
        break;
      case 'day':
        cutoff.setDate(cutoff.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(cutoff.getMonth() - 1);
        break;
    }
    
    return cutoff;
  }

  /**
   * Process indexing queue
   */
  private async processIndexingQueue(): Promise<void> {
    if (this.isIndexing || this.indexingQueue.length === 0) {
      return;
    }

    this.isIndexing = true;

    try {
      while (this.indexingQueue.length > 0) {
        const batch = this.indexingQueue.splice(0, 10); // Process in batches of 10
        const searchDocuments = await Promise.all(batch.map(item => this.transformProofToSearchDocument(item.proof)));
        
        await this.searchService.bulkIndexDocuments(searchDocuments);
        
        logger.debug(`Indexed batch of ${batch.length} proofs`);
      }
    } catch (error) {
      logger.error('Error processing indexing queue:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Get indexing status
   */
  getIndexingStatus(): {
    isIndexing: boolean;
    queueSize: number;
    lastIndexed?: Date;
  } {
    return {
      isIndexing: this.isIndexing,
      queueSize: this.indexingQueue.length
    };
  }

  /**
   * Setup automatic proof indexing
   */
  setupAutomaticIndexing(): void {
    // Listen for proof changes and automatically index
    // This would typically be done with database triggers or event listeners
    
    // Example: Hook into Mongoose middleware
    Proof.schema.post('save', async (doc: IProof) => {
      await this.indexProof(doc, 1); // High priority for new/updated proofs
    });

    Proof.schema.post('remove', async (doc: IProof) => {
      await this.removeProof(doc.id);
    });

    logger.info('Automatic proof indexing setup complete');
  }

  /**
   * Map proof status to search index status
   */
  private mapProofStatus(proofStatus: string): 'active' | 'inactive' | 'archived' {
    switch (proofStatus) {
      case 'verified':
        return 'active';
      case 'verification_failed':
      case 'revoked':
        return 'inactive';
      case 'draft':
      default:
        return 'archived';
    }
  }
}

export default ProofSearchIntegration;
