/**
 * Advanced Search Service
 * Main service layer that orchestrates all search functionality
 */

import { SearchEngine, SearchQuery, SearchResult, SearchEngineConfig } from '../../search/SearchEngine';
import { QueryProcessor, ParsedQuery } from '../../search/QueryProcessor';
import { RelevanceScorer, ScoredDocument } from '../../search/RelevanceScorer';
import { IndexManager } from '../../search/IndexManager';
import { SearchIndexDocument } from '../../models/SearchIndex';
import { Course, SearchFilter } from '../../models/Course';
import { Proof } from '../../models/Proof';
import { logger } from '../../utils/logger';

export interface SearchServiceConfig {
  engine: SearchEngineConfig;
  enableAnalytics: boolean;
  enableCaching: boolean;
  enablePersonalization: boolean;
  enableSuggestions: boolean;
  maxResults: number;
  defaultPageSize: number;
  cacheTimeout: number;
}

export interface SearchRequest {
  query?: string;
  filters?: SearchFilter;
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  page?: number;
  pageSize?: number;
  highlight?: boolean;
  aggregations?: Record<string, { type: string; field: string }>;
  suggestions?: boolean;
  userId?: string;
  sessionId?: string;
  context?: Record<string, any>;
}

export interface SearchResponse {
  documents: ScoredDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  took: number;
  maxScore: number;
  aggregations?: Record<string, any>;
  suggestions?: string[];
  highlights?: Record<string, any>[];
  searchId: string;
  analytics?: SearchAnalytics;
}

export interface SearchAnalytics {
  searchId: string;
  query: string;
  filters: Record<string, any>;
  resultsCount: number;
  searchTime: number;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  clickedDocuments?: string[];
  converted?: boolean;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'completion' | 'correction' | 'related';
  score: number;
  metadata?: Record<string, any>;
}

export interface SearchAutocomplete {
  query: string;
  suggestions: SearchSuggestion[];
  took: number;
}

export class SearchService {
  private searchEngine: SearchEngine;
  private queryProcessor: QueryProcessor;
  private relevanceScorer: RelevanceScorer;
  private indexManager: IndexManager;
  private config: SearchServiceConfig;
  private searchCache: Map<string, SearchResponse> = new Map();
  private userSessions: Map<string, UserSession> = new Map();
  private searchAnalytics: Map<string, SearchAnalytics> = new Map();

  constructor(config: SearchServiceConfig) {
    this.config = config;
    this.searchEngine = new SearchEngine(config.engine);
    this.queryProcessor = new QueryProcessor();
    this.relevanceScorer = new RelevanceScorer();
    this.indexManager = new IndexManager(config.engine);
  }

  /**
   * Main search method
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    const searchId = this.generateSearchId();
    const startTime = Date.now();

    try {
      // Validate request
      this.validateSearchRequest(request);

      // Check cache first
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(request);
        const cached = this.searchCache.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit for search request');
          return { ...cached, searchId };
        }
      }

      // Process query
      let parsedQuery: ParsedQuery | undefined;
      if (request.query) {
        parsedQuery = this.queryProcessor.process(request.query);
      }

      // Build search query for engine
      const searchQuery = this.buildSearchQuery(request, parsedQuery);

      // Execute search
      const engineResult = await this.searchEngine.search(searchQuery);

      // Apply relevance scoring
      const scoredDocuments = this.relevanceScorer.scoreResults(
        engineResult.documents,
        searchQuery,
        parsedQuery
      );

      // Apply pagination
      const paginatedDocuments = this.applyPagination(scoredDocuments, request);

      // Build response
      const response: SearchResponse = {
        documents: paginatedDocuments,
        total: engineResult.total,
        page: request.page || 1,
        pageSize: request.pageSize || this.config.defaultPageSize,
        totalPages: Math.ceil(engineResult.total / (request.pageSize || this.config.defaultPageSize)),
        took: Date.now() - startTime,
        maxScore: Math.max(...scoredDocuments.map(doc => doc.relevanceScore)),
        aggregations: engineResult.aggregations,
        suggestions: engineResult.suggestions,
        highlights: this.extractHighlights(paginatedDocuments),
        searchId
      };

      // Add analytics if enabled
      if (this.config.enableAnalytics) {
        response.analytics = this.createSearchAnalytics(searchId, request, response);
      }

      // Cache response
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(request);
        this.searchCache.set(cacheKey, response);
        setTimeout(() => this.searchCache.delete(cacheKey), this.config.cacheTimeout);
      }

      // Update user session
      this.updateUserSession(request, response);

      logger.info(`Search completed: ${request.query} -> ${response.total} results in ${response.took}ms`);
      return response;

    } catch (error) {
      logger.error('Search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(query: string, userId?: string, limit: number = 5): Promise<SearchAutocomplete> {
    const startTime = Date.now();

    try {
      const suggestions: SearchSuggestion[] = [];

      // Process the query
      const parsedQuery = this.queryProcessor.process(query);

      // Add completion suggestions
      if (parsedQuery.suggestions) {
        for (const suggestion of parsedQuery.suggestions.slice(0, limit)) {
          suggestions.push({
            text: suggestion,
            type: 'completion',
            score: 0.8,
            metadata: { source: 'query_processor' }
          });
        }
      }

      // Add popular queries
      const popularQueries = await this.getPopularQueries(userId, limit);
      for (const popularQuery of popularQueries) {
        if (popularQuery.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push({
            text: popularQuery,
            type: 'query',
            score: 0.7,
            metadata: { source: 'popular_queries' }
          });
        }
      }

      // Add spelling corrections
      const corrections = await this.getSpellingCorrections(query);
      for (const correction of corrections) {
        suggestions.push({
          text: correction,
          type: 'correction',
          score: 0.6,
          metadata: { source: 'spell_check' }
        });
      }

      // Sort and limit
      suggestions.sort((a, b) => b.score - a.score);
      const finalSuggestions = suggestions.slice(0, limit);

      return {
        query,
        suggestions: finalSuggestions,
        took: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Failed to get suggestions:', error);
      return {
        query,
        suggestions: [],
        took: Date.now() - startTime
      };
    }
  }

  /**
   * Index a document
   */
  async indexDocument(document: SearchIndexDocument): Promise<boolean> {
    try {
      const success = await this.searchEngine.indexDocument(document);
      if (success) {
        // Clear cache
        this.searchCache.clear();
        logger.info(`Document indexed: ${document.id}`);
      }
      return success;
    } catch (error) {
      logger.error('Failed to index document:', error);
      return false;
    }
  }

  /**
   * Bulk index documents
   */
  async bulkIndexDocuments(documents: SearchIndexDocument[]): Promise<{ success: number; failed: number }> {
    try {
      const result = await this.indexManager.bulkIndex(
        documents.map(doc => ({ action: 'index', document: doc }))
      );

      // Clear cache
      this.searchCache.clear();

      logger.info(`Bulk index completed: ${result.indexed} indexed, ${result.failed} failed`);
      return {
        success: result.indexed,
        failed: result.failed
      };
    } catch (error) {
      logger.error('Bulk index failed:', error);
      return { success: 0, failed: documents.length };
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<any> {
    try {
      const analytics = Array.from(this.searchAnalytics.values());
      const now = new Date();
      const cutoff = this.getCutoffDate(now, timeRange);

      const filteredAnalytics = analytics.filter(a => a.timestamp >= cutoff);

      return {
        totalSearches: filteredAnalytics.length,
        uniqueQueries: new Set(filteredAnalytics.map(a => a.query)).size,
        averageResults: filteredAnalytics.reduce((sum, a) => sum + a.resultsCount, 0) / filteredAnalytics.length,
        averageSearchTime: filteredAnalytics.reduce((sum, a) => sum + a.searchTime, 0) / filteredAnalytics.length,
        topQueries: this.getTopQueries(filteredAnalytics, 10),
        topFilters: this.getTopFilters(filteredAnalytics, 10),
        conversionRate: this.calculateConversionRate(filteredAnalytics),
        clickThroughRate: this.calculateClickThroughRate(filteredAnalytics)
      };
    } catch (error) {
      logger.error('Failed to get search analytics:', error);
      return null;
    }
  }

  /**
   * Record search interaction
   */
  async recordInteraction(searchId: string, documentId: string, interactionType: 'click' | 'view' | 'convert'): Promise<void> {
    try {
      const analytics = this.searchAnalytics.get(searchId);
      if (!analytics) return;

      if (interactionType === 'click') {
        if (!analytics.clickedDocuments) {
          analytics.clickedDocuments = [];
        }
        analytics.clickedDocuments.push(documentId);
      } else if (interactionType === 'convert') {
        analytics.converted = true;
      }

      // Update relevance scorer with click data
      this.relevanceScorer.updateClickData(documentId, interactionType === 'click');

      logger.debug(`Recorded interaction: ${interactionType} for search ${searchId}, document ${documentId}`);
    } catch (error) {
      logger.error('Failed to record interaction:', error);
    }
  }

  /**
   * Get personalized recommendations
   */
  async getPersonalizedRecommendations(userId: string, limit: number = 10): Promise<SearchIndexDocument[]> {
    try {
      const session = this.userSessions.get(userId);
      if (!session) {
        return [];
      }

      // Get user's search history and preferences
      const userQueries = session.searchHistory.map(s => s.query);
      const userCategories = this.extractUserCategories(session);
      const userTags = this.extractUserTags(session);

      // Build recommendation query
      const recommendationQuery: SearchRequest = {
        filters: {
          category: userCategories.length > 0 ? userCategories.join(',') : undefined,
          tags: userTags.length > 0 ? userTags : undefined
        } as SearchFilter,
        sort: [{ field: 'popularity', order: 'desc' }],
        pageSize: limit,
        userId
      };

      const response = await this.search(recommendationQuery);
      return response.documents;
    } catch (error) {
      logger.error('Failed to get personalized recommendations:', error);
      return [];
    }
  }

  /**
   * Get search health status
   */
  async getHealthStatus(): Promise<any> {
    try {
      const engineHealth = await this.searchEngine.healthCheck();
      const indexStats = await this.indexManager.getStats();
      const cacheSize = this.searchCache.size;

      return {
        status: engineHealth ? 'healthy' : 'unhealthy',
        engine: {
          provider: this.config.engine.provider,
          healthy: engineHealth
        },
        indices: indexStats,
        cache: {
          size: cacheSize,
          enabled: this.config.enableCaching
        },
        analytics: {
          enabled: this.config.enableAnalytics,
          searches: this.searchAnalytics.size
        }
      };
    } catch (error) {
      logger.error('Failed to get health status:', error);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate search request
   */
  private validateSearchRequest(request: SearchRequest): void {
    if (request.page && request.page < 1) {
      throw new Error('Page number must be greater than 0');
    }

    if (request.pageSize && (request.pageSize < 1 || request.pageSize > this.config.maxResults)) {
      throw new Error(`Page size must be between 1 and ${this.config.maxResults}`);
    }

    if (request.query && request.query.length > 1000) {
      throw new Error('Query too long');
    }
  }

  /**
   * Build search query for engine
   */
  private buildSearchQuery(request: SearchRequest, parsedQuery?: ParsedQuery): SearchQuery {
    const searchQuery: SearchQuery = {
      query: request.query,
      filters: this.transformFilters(request.filters),
      sort: request.sort,
      highlight: request.highlight,
      aggregations: request.aggregations,
      suggestions: request.suggestions,
      offset: request.page ? (request.page - 1) * (request.pageSize || this.config.defaultPageSize) : 0,
      limit: request.pageSize || this.config.defaultPageSize
    };

    // Add parsed query enhancements
    if (parsedQuery) {
      searchQuery.boost = this.extractBoosts(parsedQuery);
      searchQuery.fuzzy = true;
      searchQuery.operator = parsedQuery.boolean.should.length > 1 ? 'or' : 'and';
    }

    return searchQuery;
  }

  /**
   * Transform filters
   */
  private transformFilters(filters?: SearchFilter): Record<string, any> {
    if (!filters) return {};

    const transformed: Record<string, any> = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        transformed[key] = value;
      }
    }

    return transformed;
  }

  /**
   * Extract boosts from parsed query
   */
  private extractBoosts(parsedQuery: ParsedQuery): Record<string, number> {
    const boosts: Record<string, number> = {};

    for (const boosting of parsedQuery.boostings) {
      boosts[boosting.field] = boosting.boost;
    }

    return boosts;
  }

  /**
   * Apply pagination
   */
  private applyPagination(documents: ScoredDocument[], request: SearchRequest): ScoredDocument[] {
    const page = request.page || 1;
    const pageSize = request.pageSize || this.config.defaultPageSize;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return documents.slice(start, end);
  }

  /**
   * Extract highlights
   */
  private extractHighlights(documents: ScoredDocument[]): Record<string, any>[] {
    return documents.map(doc => ({
      documentId: doc.id,
      highlights: doc.rankingReasons
    }));
  }

  /**
   * Create search analytics
   */
  private createSearchAnalytics(searchId: string, request: SearchRequest, response: SearchResponse): SearchAnalytics {
    const analytics: SearchAnalytics = {
      searchId,
      query: request.query || '',
      filters: request.filters || {},
      resultsCount: response.total,
      searchTime: response.took,
      userId: request.userId,
      sessionId: request.sessionId,
      timestamp: new Date()
    };

    this.searchAnalytics.set(searchId, analytics);
    return analytics;
  }

  /**
   * Update user session
   */
  private updateUserSession(request: SearchRequest, response: SearchResponse): void {
    if (!request.userId && !request.sessionId) return;

    const sessionId = request.sessionId || request.userId!;
    let session = this.userSessions.get(sessionId);

    if (!session) {
      session = {
        id: sessionId,
        userId: request.userId,
        startTime: new Date(),
        searchHistory: [],
        preferences: {}
      };
      this.userSessions.set(sessionId, session);
    }

    session.searchHistory.push({
      query: request.query || '',
      timestamp: new Date(),
      resultsCount: response.total,
      searchId: response.searchId
    });

    // Keep only last 50 searches
    if (session.searchHistory.length > 50) {
      session.searchHistory = session.searchHistory.slice(-50);
    }
  }

  /**
   * Get popular queries
   */
  private async getPopularQueries(userId?: string, limit: number = 5): Promise<string[]> {
    const analytics = Array.from(this.searchAnalytics.values());
    const queryCounts = new Map<string, number>();

    for (const analytic of analytics) {
      if (analytic.query) {
        queryCounts.set(analytic.query, (queryCounts.get(analytic.query) || 0) + 1);
      }
    }

    return Array.from(queryCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([query]) => query);
  }

  /**
   * Get spelling corrections
   */
  private async getSpellingCorrections(query: string): Promise<string[]> {
    // Simple implementation - in production, use proper spell checking
    const commonMisspellings: Record<string, string> = {
      'verfiy': 'verify',
      'proff': 'proof',
      'cource': 'course',
      'templat': 'template',
      'serch': 'search'
    };

    const corrections: string[] = [];
    for (const [incorrect, correct] of Object.entries(commonMisspellings)) {
      if (query.toLowerCase().includes(incorrect)) {
        corrections.push(query.replace(incorrect, correct));
      }
    }

    return corrections;
  }

  /**
   * Extract user categories from session
   */
  private extractUserCategories(session: UserSession): string[] {
    const categories = new Set<string>();
    // In a real implementation, this would analyze clicked documents
    return Array.from(categories);
  }

  /**
   * Extract user tags from session
   */
  private extractUserTags(session: UserSession): string[] {
    const tags = new Set<string>();
    // In a real implementation, this would analyze clicked documents
    return Array.from(tags);
  }

  /**
   * Get cutoff date for time range
   */
  private getCutoffDate(now: Date, timeRange: string): Date {
    const cutoff = new Date(now);
    
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
   * Get top queries
   */
  private getTopQueries(analytics: SearchAnalytics[], limit: number): Array<{ query: string; count: number }> {
    const queryCounts = new Map<string, number>();
    
    for (const analytic of analytics) {
      if (analytic.query) {
        queryCounts.set(analytic.query, (queryCounts.get(analytic.query) || 0) + 1);
      }
    }
    
    return Array.from(queryCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }

  /**
   * Get top filters
   */
  private getTopFilters(analytics: SearchAnalytics[], limit: number): Array<{ filter: string; count: number }> {
    const filterCounts = new Map<string, number>();
    
    for (const analytic of analytics) {
      for (const [key, value] of Object.entries(analytic.filters)) {
        const filterKey = `${key}:${JSON.stringify(value)}`;
        filterCounts.set(filterKey, (filterCounts.get(filterKey) || 0) + 1);
      }
    }
    
    return Array.from(filterCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([filter, count]) => ({ filter, count }));
  }

  /**
   * Calculate conversion rate
   */
  private calculateConversionRate(analytics: SearchAnalytics[]): number {
    if (analytics.length === 0) return 0;
    
    const converted = analytics.filter(a => a.converted).length;
    return converted / analytics.length;
  }

  /**
   * Calculate click-through rate
   */
  private calculateClickThroughRate(analytics: SearchAnalytics[]): number {
    if (analytics.length === 0) return 0;
    
    const withClicks = analytics.filter(a => a.clickedDocuments && a.clickedDocuments.length > 0).length;
    return withClicks / analytics.length;
  }

  /**
   * Generate search ID
   */
  private generateSearchId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(request: SearchRequest): string {
    return JSON.stringify({
      query: request.query,
      filters: request.filters,
      sort: request.sort,
      page: request.page,
      pageSize: request.pageSize,
      userId: request.userId
    });
  }
}

interface UserSession {
  id: string;
  userId?: string;
  startTime: Date;
  searchHistory: Array<{
    query: string;
    timestamp: Date;
    resultsCount: number;
    searchId: string;
  }>;
  preferences: Record<string, any>;
}

export default SearchService;
