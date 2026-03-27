/**
 * Advanced Search Engine
 * Core search engine with full-text search, faceted filtering, and relevance scoring
 */

import { Client } from '@elastic/elasticsearch';
import lunr from 'lunr';
import Fuse from 'fuse.js';
import { SearchIndexDocument, SearchIndexResponse, SearchAggregation, SearchHighlight } from '../models/SearchIndex';
import { QueryProcessor } from './QueryProcessor';
import { RelevanceScorer } from './RelevanceScorer';
import { IndexManager } from './IndexManager';
import logger from '../utils/logger';

export interface SearchQuery {
  query?: string;
  filters?: Record<string, any>;
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  highlight?: boolean;
  aggregations?: Record<string, { type: string; field: string }>;
  suggestions?: boolean;
  offset?: number;
  limit?: number;
  boost?: Record<string, number>;
  fuzzy?: boolean | number;
  operator?: 'and' | 'or';
  minimumShouldMatch?: string;
}

export interface SearchResult {
  documents: SearchIndexDocument[];
  total: number;
  took: number;
  maxScore: number;
  aggregations?: Record<string, SearchAggregation>;
  suggestions?: string[];
  highlights?: Record<string, SearchHighlight>[];
  scrollId?: string;
}

export interface SearchEngineConfig {
  provider: 'elasticsearch' | 'lunr' | 'fuse';
  elasticsearch?: {
    node: string;
    auth?: { username: string; password: string };
    maxRetries: number;
    requestTimeout: number;
    sniffOnStart: boolean;
  };
  lunr?: {
    fields: string[];
    ref: string;
    boost?: Record<string, number>;
  };
  fuse?: {
    keys: string[];
    threshold: number;
    includeScore: boolean;
    includeMatches: boolean;
    minMatchCharLength: number;
    shouldSort: boolean;
    findAllMatches: boolean;
  };
  cache?: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };
  analytics?: {
    enabled: boolean;
    logQueries: boolean;
    logResults: boolean;
    trackClicks: boolean;
  };
}

export class SearchEngine {
  private client?: Client;
  private lunrIndex?: lunr.Index;
  private fuseSearch?: Fuse<SearchIndexDocument>;
  private queryProcessor: QueryProcessor;
  private relevanceScorer: RelevanceScorer;
  private indexManager: IndexManager;
  private config: SearchEngineConfig;
  private cache: Map<string, SearchResult> = new Map();

  constructor(config: SearchEngineConfig) {
    this.config = config;
    this.queryProcessor = new QueryProcessor();
    this.relevanceScorer = new RelevanceScorer();
    this.indexManager = new IndexManager(config);
    this.initialize();
  }

  /**
   * Initialize the search engine
   */
  private async initialize(): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'elasticsearch':
          await this.initializeElasticsearch();
          break;
        case 'lunr':
          await this.initializeLunr();
          break;
        case 'fuse':
          await this.initializeFuse();
          break;
        default:
          throw new Error(`Unsupported search provider: ${this.config.provider}`);
      }

      logger.info(`Search engine initialized with provider: ${this.config.provider}`);
    } catch (error) {
      logger.error('Failed to initialize search engine:', error);
      throw error;
    }
  }

  /**
   * Initialize Elasticsearch client
   */
  private async initializeElasticsearch(): Promise<void> {
    if (!this.config.elasticsearch) {
      throw new Error('Elasticsearch configuration is required');
    }

    this.client = new Client({
      node: this.config.elasticsearch.node,
      auth: this.config.elasticsearch.auth,
      maxRetries: this.config.elasticsearch.maxRetries,
      requestTimeout: this.config.elasticsearch.requestTimeout,
      sniffOnStart: this.config.elasticsearch.sniffOnStart
    });

    // Test connection
    await this.client.ping();
    logger.info('Elasticsearch client connected successfully');
  }

  /**
   * Initialize Lunr search
   */
  private async initializeLunr(): Promise<void> {
    if (!this.config.lunr) {
      throw new Error('Lunr configuration is required');
    }

    const documents = await this.indexManager.getAllDocuments();
    
    this.lunrIndex = lunr(function () {
      this.ref(this.config.lunr!.ref);
      
      for (const field of this.config.lunr!.fields) {
        this.field(field);
      }

      documents.forEach((doc) => {
        this.add(doc);
      });
    });

    logger.info('Lunr search index created successfully');
  }

  /**
   * Initialize Fuse search
   */
  private async initializeFuse(): Promise<void> {
    if (!this.config.fuse) {
      throw new Error('Fuse configuration is required');
    }

    const documents = await this.indexManager.getAllDocuments();
    
    this.fuseSearch = new Fuse(documents, {
      keys: this.config.fuse.keys,
      threshold: this.config.fuse.threshold,
      includeScore: this.config.fuse.includeScore,
      includeMatches: this.config.fuse.includeMatches,
      minMatchCharLength: this.config.fuse.minMatchCharLength,
      shouldSort: this.config.fuse.shouldSort,
      findAllMatches: this.config.fuse.findAllMatches
    });

    logger.info('Fuse search index created successfully');
  }

  /**
   * Search for documents
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query);

    // Check cache first
    if (this.config.cache?.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit for search query');
        return cached;
      }
    }

    try {
      let result: SearchResult;

      switch (this.config.provider) {
        case 'elasticsearch':
          result = await this.searchElasticsearch(query);
          break;
        case 'lunr':
          result = await this.searchLunr(query);
          break;
        case 'fuse':
          result = await this.searchFuse(query);
          break;
        default:
          throw new Error(`Unsupported search provider: ${this.config.provider}`);
      }

      // Apply relevance scoring
      result.documents = this.relevanceScorer.scoreResults(result.documents, query);

      // Apply post-processing
      result = await this.postProcessResults(result, query);

      // Cache results
      if (this.config.cache?.enabled) {
        this.cache.set(cacheKey, result);
        setTimeout(() => this.cache.delete(cacheKey), this.config.cache.ttl);
      }

      // Log analytics
      if (this.config.analytics?.enabled) {
        await this.logSearchAnalytics(query, result, Date.now() - startTime);
      }

      return result;
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Search using Elasticsearch
   */
  private async searchElasticsearch(query: SearchQuery): Promise<SearchResult> {
    if (!this.client) {
      throw new Error('Elasticsearch client not initialized');
    }

    const esQuery = this.buildElasticsearchQuery(query);
    const response = await this.client.search<SearchIndexResponse>({
      index: 'verinode_search',
      body: esQuery
    });

    return this.transformElasticsearchResponse(response.body);
  }

  /**
   * Search using Lunr
   */
  private async searchLunr(query: SearchQuery): Promise<SearchResult> {
    if (!this.lunrIndex) {
      throw new Error('Lunr index not initialized');
    }

    const processedQuery = this.queryProcessor.process(query.query || '');
    const results = this.lunrIndex.search(processedQuery);

    const documents = await Promise.all(
      results.slice(query.offset || 0, (query.offset || 0) + (query.limit || 10))
        .map(async (result) => {
          const doc = await this.indexManager.getDocument(result.ref);
          if (doc) {
            return { ...doc, searchScore: result.score };
          }
          return null;
        })
    );

    return {
      documents: documents.filter(Boolean) as SearchIndexDocument[],
      total: results.length,
      took: 0,
      maxScore: Math.max(...results.map(r => r.score))
    };
  }

  /**
   * Search using Fuse
   */
  private async searchFuse(query: SearchQuery): Promise<SearchResult> {
    if (!this.fuseSearch) {
      throw new Error('Fuse search not initialized');
    }

    const results = this.fuseSearch.search(query.query || '', {
      limit: query.limit || 10
    });

    const documents = results.map(result => ({
      ...result.item,
      searchScore: 1 - (result.score || 0),
      matches: result.matches
    }));

    return {
      documents,
      total: results.length,
      took: 0,
      maxScore: Math.max(...documents.map(d => d.searchScore || 0))
    };
  }

  /**
   * Build Elasticsearch query
   */
  private buildElasticsearchQuery(query: SearchQuery): any {
    const esQuery: any = {
      query: {
        bool: {
          must: [],
          filter: [],
          should: []
        }
      },
      highlight: query.highlight ? {
        fields: {
          title: {},
          description: {},
          content: {}
        }
      } : undefined,
      aggs: {},
      sort: [],
      from: query.offset || 0,
      size: query.limit || 10
    };

    // Add main query
    if (query.query) {
      const searchQuery = {
        multi_match: {
          query: query.query,
          fields: ['title^3', 'description^2', 'content', 'tags^2'],
          type: 'best_fields',
          operator: query.operator || 'or',
          fuzziness: query.fuzzy ? 'AUTO' : undefined,
          minimum_should_match: query.minimumShouldMatch
        }
      };

      if (query.boost) {
        searchQuery.multi_match.fields = searchQuery.multi_match.fields.map(field => {
          const boost = query.boost![field.replace(/\^.*$/, '')];
          return boost ? `${field}^${boost}` : field;
        });
      }

      esQuery.query.bool.must.push(searchQuery);
    }

    // Add filters
    if (query.filters) {
      for (const [field, value] of Object.entries(query.filters)) {
        if (Array.isArray(value)) {
          esQuery.query.bool.filter.push({
            terms: { [field]: value }
          });
        } else {
          esQuery.query.bool.filter.push({
            term: { [field]: value }
          });
        }
      }
    }

    // Add aggregations
    if (query.aggregations) {
      for (const [name, agg] of Object.entries(query.aggregations)) {
        esQuery.aggs[name] = {
          [agg.type]: {
            field: agg.field
          }
        };
      }
    }

    // Add sorting
    if (query.sort) {
      esQuery.sort = query.sort.map(sort => ({
        [sort.field]: { order: sort.order }
      }));
    } else {
      esQuery.sort = [{ _score: { order: 'desc' } }];
    }

    return esQuery;
  }

  /**
   * Transform Elasticsearch response
   */
  private transformElasticsearchResponse(response: SearchIndexResponse): SearchResult {
    const documents = response.hits.hits.map(hit => ({
      ...hit._source,
      searchScore: hit._score,
      highlights: hit.highlight
    }));

    const aggregations: Record<string, SearchAggregation> = {};
    if (response.aggregations) {
      for (const [name, agg] of Object.entries(response.aggregations)) {
        aggregations[name] = agg;
      }
    }

    return {
      documents,
      total: response.hits.total.value,
      took: response.took,
      maxScore: response.hits.max_score,
      aggregations
    };
  }

  /**
   * Post-process search results
   */
  private async postProcessResults(result: SearchResult, query: SearchQuery): Promise<SearchResult> {
    // Apply pagination
    if (query.offset || query.limit) {
      const start = query.offset || 0;
      const end = start + (query.limit || 10);
      result.documents = result.documents.slice(start, end);
    }

    // Add suggestions if requested
    if (query.suggestions && result.documents.length === 0) {
      result.suggestions = await this.generateSuggestions(query.query || '');
    }

    // Add highlights
    if (query.highlight) {
      result.highlights = this.generateHighlights(result.documents, query.query || '');
    }

    return result;
  }

  /**
   * Generate search suggestions
   */
  private async generateSuggestions(query: string): Promise<string[]> {
    // Implementation would depend on the search provider
    // For now, return basic suggestions
    return [
      `${query} tutorial`,
      `${query} guide`,
      `${query} examples`,
      `${query} best practices`
    ];
  }

  /**
   * Generate search highlights
   */
  private generateHighlights(documents: SearchIndexDocument[], query: string): Record<string, SearchHighlight>[] {
    return documents.map(doc => {
      const highlights: Record<string, SearchHighlight> = {};

      // Simple highlighting implementation
      const terms = query.toLowerCase().split(/\s+/);
      
      ['title', 'description', 'content'].forEach(field => {
        const text = doc[field as keyof SearchIndexDocument] as string;
        if (text) {
          const highlightedText = this.highlightTerms(text, terms);
          if (highlightedText !== text) {
            highlights[field] = {
              field,
              fragments: [highlightedText],
              score: 1.0
            };
          }
        }
      });

      return highlights;
    });
  }

  /**
   * Highlight terms in text
   */
  private highlightTerms(text: string, terms: string[]): string {
    let highlighted = text;
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    return highlighted;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: SearchQuery): string {
    return JSON.stringify(query);
  }

  /**
   * Log search analytics
   */
  private async logSearchAnalytics(query: SearchQuery, result: SearchResult, duration: number): Promise<void> {
    if (!this.config.analytics?.enabled) return;

    const analytics = {
      query: query.query,
      filters: query.filters,
      resultsCount: result.total,
      searchTime: duration,
      timestamp: new Date(),
      provider: this.config.provider
    };

    // Log to analytics service
    logger.info('Search analytics:', analytics);
  }

  /**
   * Index a document
   */
  async indexDocument(document: SearchIndexDocument): Promise<boolean> {
    try {
      await this.indexManager.indexDocument(document);
      
      // Update search indices
      switch (this.config.provider) {
        case 'elasticsearch':
          await this.indexDocumentElasticsearch(document);
          break;
        case 'lunr':
          await this.indexDocumentLunr(document);
          break;
        case 'fuse':
          await this.indexDocumentFuse(document);
          break;
      }

      // Clear cache
      this.cache.clear();
      
      return true;
    } catch (error) {
      logger.error('Failed to index document:', error);
      return false;
    }
  }

  /**
   * Index document in Elasticsearch
   */
  private async indexDocumentElasticsearch(document: SearchIndexDocument): Promise<void> {
    if (!this.client) return;

    await this.client.index({
      index: 'verinode_search',
      id: document.id,
      body: document
    });
  }

  /**
   * Index document in Lunr
   */
  private async indexDocumentLunr(document: SearchIndexDocument): Promise<void> {
    // Rebuild the entire index (Lunr doesn't support incremental updates)
    await this.initializeLunr();
  }

  /**
   * Index document in Fuse
   */
  private async indexDocumentFuse(document: SearchIndexDocument): Promise<void> {
    // Rebuild the entire index (Fuse doesn't support incremental updates easily)
    await this.initializeFuse();
  }

  /**
   * Get search statistics
   */
  async getStats(): Promise<any> {
    return {
      provider: this.config.provider,
      cacheSize: this.cache.size,
      indexStats: await this.indexManager.getStats()
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      switch (this.config.provider) {
        case 'elasticsearch':
          if (!this.client) return false;
          await this.client.ping();
          return true;
        case 'lunr':
          return !!this.lunrIndex;
        case 'fuse':
          return !!this.fuseSearch;
        default:
          return false;
      }
    } catch (error) {
      logger.error('Health check failed:', error);
      return false;
    }
  }
}

export default SearchEngine;
