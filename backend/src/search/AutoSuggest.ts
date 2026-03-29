/**
 * Auto-suggestion and Autocomplete
 * Intelligent search suggestions and autocomplete functionality
 */

import { SearchIndexDocument } from '../models/SearchIndex';
import { logger } from '../utils/logger';

export interface SuggestionRequest {
  query: string;
  limit?: number;
  userId?: string;
  context?: SuggestionContext;
  types?: SuggestionType[];
}

export interface SuggestionContext {
  previousQueries?: string[];
  userPreferences?: Record<string, any>;
  currentFilters?: Record<string, any>;
  searchHistory?: string[];
  location?: string;
  language?: string;
}

export interface SuggestionType {
  name: string;
  enabled: boolean;
  weight: number;
  maxSuggestions: number;
}

export interface SuggestionResponse {
  query: string;
  suggestions: Suggestion[];
  took: number;
  totalAvailable: number;
  corrected?: string;
  spellings?: SpellingSuggestion[];
}

export interface Suggestion {
  text: string;
  type: 'query' | 'completion' | 'correction' | 'related' | 'trending' | 'personalized';
  score: number;
  source: string;
  metadata?: Record<string, any>;
  highlight?: string;
}

export interface SpellingSuggestion {
  original: string;
  corrected: string;
  confidence: number;
  suggestions: string[];
}

export interface AutocompleteConfig {
  enableQueryCompletion: boolean;
  enableSpellCorrection: boolean;
  enablePersonalizedSuggestions: boolean;
  enableTrendingSuggestions: boolean;
  enableRelatedSuggestions: boolean;
  maxSuggestions: number;
  minQueryLength: number;
  suggestionWeights: Record<string, number>;
  cacheEnabled: boolean;
  cacheTTL: number;
  popularityDecay: number;
}

export class AutoSuggestEngine {
  private documents: SearchIndexDocument[] = [];
  private queryHistory: Map<string, QueryHistoryEntry[]> = new Map();
  private popularQueries: Map<string, number> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private config: AutocompleteConfig;
  private cache: Map<string, SuggestionResponse> = new Map();

  constructor(config?: Partial<AutocompleteConfig>) {
    this.config = {
      enableQueryCompletion: true,
      enableSpellCorrection: true,
      enablePersonalizedSuggestions: true,
      enableTrendingSuggestions: true,
      enableRelatedSuggestions: true,
      maxSuggestions: 10,
      minQueryLength: 2,
      suggestionWeights: {
        query_completion: 0.4,
        spell_correction: 0.2,
        personalized: 0.2,
        trending: 0.1,
        related: 0.1
      },
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      popularityDecay: 0.1,
      ...config
    };
  }

  /**
   * Set documents for suggestion generation
   */
  setDocuments(documents: SearchIndexDocument[]): void {
    this.documents = documents;
    this.buildPopularQueries();
  }

  /**
   * Get suggestions for query
   */
  async getSuggestions(request: SuggestionRequest): Promise<SuggestionResponse> {
    const startTime = Date.now();
    const query = request.query.toLowerCase().trim();

    // Validate query
    if (query.length < this.config.minQueryLength) {
      return {
        query: request.query,
        suggestions: [],
        took: Date.now() - startTime,
        totalAvailable: 0
      };
    }

    // Check cache
    if (this.config.cacheEnabled) {
      const cacheKey = this.generateCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const suggestions: Suggestion[] = [];
    const suggestionTypes = request.types || this.getDefaultSuggestionTypes();

    // Generate different types of suggestions
    for (const type of suggestionTypes) {
      if (this.isSuggestionTypeEnabled(type.name)) {
        const typeSuggestions = await this.generateSuggestionsByType(type, query, request);
        suggestions.push(...typeSuggestions);
      }
    }

    // Sort and limit suggestions
    const sortedSuggestions = this.sortAndLimitSuggestions(suggestions, request.limit || this.config.maxSuggestions);

    // Check for spell corrections
    const spellings = this.config.enableSpellCorrection ? this.getSpellSuggestions(query) : undefined;
    const corrected = spellings && spellings.length > 0 ? spellings[0].corrected : undefined;

    const response: SuggestionResponse = {
      query: request.query,
      suggestions: sortedSuggestions,
      took: Date.now() - startTime,
      totalAvailable: suggestions.length,
      corrected,
      spellings
    };

    // Cache response
    if (this.config.cacheEnabled) {
      const cacheKey = this.generateCacheKey(request);
      this.cache.set(cacheKey, response);
      setTimeout(() => this.cache.delete(cacheKey), this.config.cacheTTL);
    }

    return response;
  }

  /**
   * Record query for history and popularity
   */
  recordQuery(query: string, userId?: string, results?: number): void {
    const queryLower = query.toLowerCase();
    const timestamp = new Date();

    // Update global popularity
    this.popularQueries.set(queryLower, (this.popularQueries.get(queryLower) || 0) + 1);

    // Update user history
    if (userId) {
      if (!this.queryHistory.has(userId)) {
        this.queryHistory.set(userId, []);
      }

      const userHistory = this.queryHistory.get(userId)!;
      userHistory.push({
        query: queryLower,
        timestamp,
        results: results || 0
      });

      // Keep only last 100 queries per user
      if (userHistory.length > 100) {
        userHistory.shift();
      }

      // Update user profile
      this.updateUserProfile(userId, queryLower);
    }
  }

  /**
   * Get trending queries
   */
  getTrendingQueries(limit: number = 10, timeWindow: 'hour' | 'day' | 'week' = 'day'): string[] {
    const cutoff = this.getCutoffTime(timeWindow);
    const trending = new Map<string, number>();

    // In a real implementation, this would filter by timestamp
    for (const [query, count] of this.popularQueries) {
      if (count > 1) { // Minimum threshold
        trending.set(query, count);
      }
    }

    return Array.from(trending.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([query]) => query);
  }

  /**
   * Get user-specific suggestions
   */
  getUserSuggestions(userId: string, limit: number = 5): string[] {
    const userHistory = this.queryHistory.get(userId) || [];
    const userProfile = this.userProfiles.get(userId);

    if (!userProfile) {
      // Return recent queries if no profile exists
      return userHistory
        .slice(-limit)
        .map(entry => entry.query);
    }

    const suggestions: string[] = [];

    // Add favorite categories/queries
    if (userProfile.favoriteQueries) {
      suggestions.push(...userProfile.favoriteQueries.slice(0, limit));
    }

    // Add recent queries
    suggestions.push(...userHistory.slice(-limit).map(entry => entry.query));

    // Remove duplicates and limit
    return Array.from(new Set(suggestions)).slice(0, limit);
  }

  /**
   * Generate suggestions by type
   */
  private async generateSuggestionsByType(
    type: SuggestionType,
    query: string,
    request: SuggestionRequest
  ): Promise<Suggestion[]> {
    switch (type.name) {
      case 'query_completion':
        return this.generateQueryCompletions(query, request);
      case 'spell_correction':
        return this.generateSpellCorrections(query, request);
      case 'personalized':
        return this.generatePersonalizedSuggestions(query, request);
      case 'trending':
        return this.generateTrendingSuggestions(query, request);
      case 'related':
        return this.generateRelatedSuggestions(query, request);
      default:
        return [];
    }
  }

  /**
   * Generate query completions
   */
  private generateQueryCompletions(query: string, request: SuggestionRequest): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const terms = query.split(/\s+/);
    const lastTerm = terms[terms.length - 1];

    // Complete from document titles and content
    const completions = new Map<string, number>();

    for (const doc of this.documents) {
      const title = doc.title.toLowerCase();
      const description = doc.description.toLowerCase();
      const content = doc.content.toLowerCase();
      const tags = doc.tags?.map(tag => tag.toLowerCase()) || [];

      // Find completions in title
      this.findCompletions(title, lastTerm, completions, 3); // Higher weight for title

      // Find completions in description
      this.findCompletions(description, lastTerm, completions, 2);

      // Find completions in content
      this.findCompletions(content, lastTerm, completions, 1);

      // Find completions in tags
      for (const tag of tags) {
        this.findCompletions(tag, lastTerm, completions, 2);
      }
    }

    // Convert to suggestions
    for (const [completion, score] of completions) {
      suggestions.push({
        text: completion,
        type: 'completion',
        score: score * this.config.suggestionWeights.query_completion,
        source: 'query_completion',
        highlight: this.highlightMatch(completion, lastTerm)
      });
    }

    return suggestions;
  }

  /**
   * Find completions in text
   */
  private findCompletions(text: string, prefix: string, completions: Map<string, number>, weight: number): void {
    const words = text.split(/\s+/);
    
    for (const word of words) {
      if (word.startsWith(prefix) && word.length > prefix.length) {
        const existingScore = completions.get(word) || 0;
        completions.set(word, existingScore + weight);
      }
    }
  }

  /**
   * Generate spell corrections
   */
  private generateSpellCorrections(query: string, request: SuggestionRequest): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const corrections = this.getSpellSuggestions(query);

    for (const correction of corrections) {
      suggestions.push({
        text: correction.corrected,
        type: 'correction',
        score: correction.confidence * this.config.suggestionWeights.spell_correction,
        source: 'spell_correction',
        metadata: {
          original: correction.original,
          confidence: correction.confidence
        }
      });
    }

    return suggestions;
  }

  /**
   * Generate personalized suggestions
   */
  private generatePersonalizedSuggestions(query: string, request: SuggestionRequest): Suggestion[] {
    const suggestions: Suggestion[] = [];

    if (!request.userId) {
      return suggestions;
    }

    const userProfile = this.userProfiles.get(request.userId);
    if (!userProfile) {
      return suggestions;
    }

    // Suggest from user's favorite queries
    if (userProfile.favoriteQueries) {
      for (const favQuery of userProfile.favoriteQueries) {
        if (favQuery.includes(query)) {
          suggestions.push({
            text: favQuery,
            type: 'personalized',
            score: 0.8 * this.config.suggestionWeights.personalized,
            source: 'user_favorites'
          });
        }
      }
    }

    // Suggest from user's preferred categories
    if (userProfile.preferredCategories) {
      for (const category of userProfile.preferredCategories) {
        const categoryQuery = `${query} ${category}`;
        suggestions.push({
          text: categoryQuery,
          type: 'personalized',
          score: 0.6 * this.config.suggestionWeights.personalized,
          source: 'user_categories'
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate trending suggestions
   */
  private generateTrendingSuggestions(query: string, request: SuggestionRequest): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const trendingQueries = this.getTrendingQueries(20);

    for (const trendingQuery of trendingQueries) {
      if (trendingQuery.includes(query)) {
        const popularity = this.popularQueries.get(trendingQuery) || 0;
        const score = Math.min(popularity / 100, 1) * this.config.suggestionWeights.trending;
        
        suggestions.push({
          text: trendingQuery,
          type: 'trending',
          score,
          source: 'trending_queries',
          metadata: { popularity }
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate related suggestions
   */
  private generateRelatedSuggestions(query: string, request: SuggestionRequest): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Find documents that match the query
    const matchingDocs = this.documents.filter(doc => 
      doc.title.toLowerCase().includes(query) || 
      doc.description.toLowerCase().includes(query) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(query))
    );

    // Extract related terms from matching documents
    const relatedTerms = new Map<string, number>();

    for (const doc of matchingDocs) {
      // Extract terms from title
      this.extractRelatedTerms(doc.title, query, relatedTerms, 3);

      // Extract terms from description
      this.extractRelatedTerms(doc.description, query, relatedTerms, 2);

      // Extract terms from tags
      if (doc.tags) {
        for (const tag of doc.tags) {
          this.extractRelatedTerms(tag, query, relatedTerms, 2);
        }
      }
    }

    // Convert to suggestions
    for (const [term, score] of relatedTerms) {
      if (term !== query && term.length > query.length) {
        suggestions.push({
          text: term,
          type: 'related',
          score: (score / 10) * this.config.suggestionWeights.related,
          source: 'related_content'
        });
      }
    }

    return suggestions;
  }

  /**
   * Extract related terms from text
   */
  private extractRelatedTerms(text: string, query: string, relatedTerms: Map<string, number>, weight: number): void {
    const words = text.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (word.includes(query) && word !== query && word.length > query.length) {
        const existingScore = relatedTerms.get(word) || 0;
        relatedTerms.set(word, existingScore + weight);
      }
    }
  }

  /**
   * Get spell suggestions
   */
  private getSpellSuggestions(query: string): SpellingSuggestion[] {
    const suggestions: SpellingSuggestion[] = [];
    const commonMisspellings: Record<string, string[]> = {
      'verfiy': ['verify'],
      'proff': ['proof', 'profile'],
      'cource': ['course'],
      'templat': ['template'],
      'serch': ['search'],
      'blokchain': ['blockchain'],
      'crupto': ['crypto'],
      'defi': ['defi'],
      'nft': ['nft'],
      'dao': ['dao']
    };

    const words = query.split(/\s+/);
    
    for (const word of words) {
      const corrections = commonMisspellings[word.toLowerCase()];
      if (corrections) {
        suggestions.push({
          original: word,
          corrected: corrections[0],
          confidence: 0.8,
          suggestions: corrections
        });
      }
    }

    return suggestions;
  }

  /**
   * Sort and limit suggestions
   */
  private sortAndLimitSuggestions(suggestions: Suggestion[], limit: number): Suggestion[] {
    // Remove duplicates
    const uniqueSuggestions = new Map<string, Suggestion>();
    for (const suggestion of suggestions) {
      const existing = uniqueSuggestions.get(suggestion.text);
      if (!existing || suggestion.score > existing.score) {
        uniqueSuggestions.set(suggestion.text, suggestion);
      }
    }

    // Sort by score
    const sorted = Array.from(uniqueSuggestions.values()).sort((a, b) => b.score - a.score);

    // Limit results
    return sorted.slice(0, limit);
  }

  /**
   * Highlight match in suggestion
   */
  private highlightMatch(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Check if suggestion type is enabled
   */
  private isSuggestionTypeEnabled(typeName: string): boolean {
    switch (typeName) {
      case 'query_completion':
        return this.config.enableQueryCompletion;
      case 'spell_correction':
        return this.config.enableSpellCorrection;
      case 'personalized':
        return this.config.enablePersonalizedSuggestions;
      case 'trending':
        return this.config.enableTrendingSuggestions;
      case 'related':
        return this.config.enableRelatedSuggestions;
      default:
        return false;
    }
  }

  /**
   * Get default suggestion types
   */
  private getDefaultSuggestionTypes(): SuggestionType[] {
    return [
      { name: 'query_completion', enabled: true, weight: 0.4, maxSuggestions: 5 },
      { name: 'spell_correction', enabled: true, weight: 0.2, maxSuggestions: 3 },
      { name: 'personalized', enabled: true, weight: 0.2, maxSuggestions: 3 },
      { name: 'trending', enabled: true, weight: 0.1, maxSuggestions: 2 },
      { name: 'related', enabled: true, weight: 0.1, maxSuggestions: 2 }
    ];
  }

  /**
   * Build popular queries from documents
   */
  private buildPopularQueries(): void {
    // Extract popular terms from documents
    const termCounts = new Map<string, number>();

    for (const doc of this.documents) {
      // Extract terms from title
      this.extractTerms(doc.title, termCounts, 3);

      // Extract terms from description
      this.extractTerms(doc.description, termCounts, 2);

      // Extract terms from tags
      if (doc.tags) {
        for (const tag of doc.tags) {
          this.extractTerms(tag, termCounts, 2);
        }
      }
    }

    // Update popular queries
    for (const [term, count] of termCounts) {
      if (count > 1) {
        this.popularQueries.set(term, count);
      }
    }
  }

  /**
   * Extract terms from text
   */
  private extractTerms(text: string, termCounts: Map<string, number>, weight: number): void {
    const terms = text.toLowerCase().split(/\s+/);
    
    for (const term of terms) {
      if (term.length >= 3) {
        const existingCount = termCounts.get(term) || 0;
        termCounts.set(term, existingCount + weight);
      }
    }
  }

  /**
   * Update user profile
   */
  private updateUserProfile(userId: string, query: string): void {
    let profile = this.userProfiles.get(userId);
    
    if (!profile) {
      profile = {
        userId,
        favoriteQueries: [],
        preferredCategories: [],
        searchFrequency: 0,
        lastSearch: new Date()
      };
      this.userProfiles.set(userId, profile);
    }

    // Update search frequency
    profile.searchFrequency++;
    profile.lastSearch = new Date();

    // Update favorite queries (simplified)
    if (!profile.favoriteQueries.includes(query)) {
      profile.favoriteQueries.push(query);
      if (profile.favoriteQueries.length > 10) {
        profile.favoriteQueries.shift();
      }
    }
  }

  /**
   * Get cutoff time for trending
   */
  private getCutoffTime(timeWindow: 'hour' | 'day' | 'week'): Date {
    const cutoff = new Date();
    switch (timeWindow) {
      case 'hour':
        cutoff.setHours(cutoff.getHours() - 1);
        break;
      case 'day':
        cutoff.setDate(cutoff.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(cutoff.getDate() - 7);
        break;
    }
    return cutoff;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(request: SuggestionRequest): string {
    return `${request.query}:${request.userId || 'anonymous'}:${JSON.stringify(request.context || {})}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalQueries: number;
    uniqueQueries: number;
    totalUsers: number;
    averageQueriesPerUser: number;
    cacheSize: number;
    topQueries: Array<{ query: string; count: number }>;
  } {
    const totalQueries = Array.from(this.popularQueries.values()).reduce((sum, count) => sum + count, 0);
    const uniqueQueries = this.popularQueries.size;
    const totalUsers = this.userProfiles.size;
    const averageQueriesPerUser = totalUsers > 0 ? totalQueries / totalUsers : 0;

    const topQueries = Array.from(this.popularQueries.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      totalQueries,
      uniqueQueries,
      totalUsers,
      averageQueriesPerUser,
      cacheSize: this.cache.size,
      topQueries
    };
  }
}

interface QueryHistoryEntry {
  query: string;
  timestamp: Date;
  results: number;
}

interface UserProfile {
  userId: string;
  favoriteQueries: string[];
  preferredCategories: string[];
  searchFrequency: number;
  lastSearch: Date;
}

export default AutoSuggestEngine;
