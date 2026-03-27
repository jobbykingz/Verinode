/**
 * Search Utilities
 * Utility functions for search operations, validation, and transformations
 */

import { SearchIndexDocument } from '../models/SearchIndex';
import { SearchFilter } from '../models/Course';
import { logger } from './logger';

/**
 * Text processing utilities
 */
export class TextProcessor {
  private static stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by',
    'for', 'if', 'in', 'into', 'is', 'it', 'no', 'not',
    'of', 'on', 'or', 'such', 'that', 'the', 'their',
    'then', 'there', 'these', 'they', 'this', 'to', 'was',
    'will', 'with', 'the', 'is', 'at', 'which', 'on'
  ]);

  /**
   * Clean and normalize text
   */
  static cleanText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract keywords from text
   */
  static extractKeywords(text: string, minLength: number = 3): string[] {
    const cleaned = this.cleanText(text);
    const words = cleaned.split(/\s+/);
    
    return words
      .filter(word => 
        word.length >= minLength && 
        !this.stopWords.has(word) &&
        !/^\d+$/.test(word)
      )
      .filter((word, index, array) => array.indexOf(word) === index);
  }

  /**
   * Calculate text similarity using Jaccard similarity
   */
  static calculateSimilarity(text1: string, text2: string): number {
    const keywords1 = new Set(this.extractKeywords(text1));
    const keywords2 = new Set(this.extractKeywords(text2));

    const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
    const union = new Set([...keywords1, ...keywords2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Generate text snippets
   */
  static generateSnippet(content: string, query: string, maxLength: number = 200): string {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const index = contentLower.indexOf(queryLower);

    if (index === -1) {
      return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 150);
    
    let snippet = content.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }

  /**
   * Highlight text with HTML tags
   */
  static highlightText(text: string, query: string, tag: string = 'mark'): string {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    const keywords = this.extractKeywords(query);
    
    let highlighted = text;
    
    for (const keyword of keywords) {
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlighted = highlighted.replace(regex, `<${tag}>$1</${tag}>`);
    }
    
    return highlighted;
  }

  /**
   * Truncate text to specified length
   */
  static truncateText(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Extract entities from text
   */
  static extractEntities(text: string): {
    emails: string[];
    urls: string[];
    numbers: string[];
    dates: string[];
  } {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const numberRegex = /\b\d+(?:\.\d+)?\b/g;
    const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;

    return {
      emails: text.match(emailRegex) || [],
      urls: text.match(urlRegex) || [],
      numbers: text.match(numberRegex) || [],
      dates: text.match(dateRegex) || []
    };
  }
}

/**
 * Search validation utilities
 */
export class SearchValidator {
  /**
   * Validate search query
   */
  static validateQuery(query: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!query || query.trim().length === 0) {
      errors.push('Query cannot be empty');
      return { valid: false, errors };
    }

    if (query.length > 1000) {
      errors.push('Query too long (max 1000 characters)');
    }

    // Check for potentially dangerous characters
    const dangerousChars = /[<>|\\]/;
    if (dangerousChars.test(query)) {
      errors.push('Query contains invalid characters');
    }

    // Check for balanced quotes
    const quoteCount = (query.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      errors.push('Unbalanced quotes in query');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate search filters
   */
  static validateFilters(filters: SearchFilter): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) {
        errors.push(`Filter ${key} cannot be null or undefined`);
        continue;
      }

      if (key === 'priceRange' || key === 'duration') {
        if (typeof value === 'object' && value !== null) {
          const range = value as any;
          if (range.min !== undefined && (typeof range.min !== 'number' || range.min < 0)) {
            errors.push(`Invalid minimum value for ${key}`);
          }
          if (range.max !== undefined && (typeof range.max !== 'number' || range.max < 0)) {
            errors.push(`Invalid maximum value for ${key}`);
          }
          if (range.min !== undefined && range.max !== undefined && range.min > range.max) {
            errors.push(`Minimum value cannot be greater than maximum value for ${key}`);
          }
        }
      }

      if (key === 'rating') {
        const rating = value as number;
        if (typeof rating !== 'number' || rating < 0 || rating > 5) {
          errors.push('Rating must be between 0 and 5');
        }
      }

      if (key === 'page' || key === 'pageSize') {
        const num = value as number;
        if (typeof num !== 'number' || num < 1) {
          errors.push(`${key} must be a positive number`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate search index document
   */
  static validateDocument(document: SearchIndexDocument): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!document.id || typeof document.id !== 'string') {
      errors.push('Document ID is required and must be a string');
    }

    if (!document.title || typeof document.title !== 'string') {
      errors.push('Document title is required and must be a string');
    }

    if (!document.type || !['proof', 'course', 'template', 'user', 'audit'].includes(document.type)) {
      errors.push('Document type is required and must be valid');
    }

    if (!document.timestamp || !(document.timestamp instanceof Date)) {
      errors.push('Document timestamp is required and must be a Date');
    }

    if (document.tags && !Array.isArray(document.tags)) {
      errors.push('Tags must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize search query
   */
  static sanitizeQuery(query: string): string {
    return query
      .replace(/[<>|\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * Search transformation utilities
 */
export class SearchTransformer {
  /**
   * Transform filter object to query string
   */
  static filtersToQueryString(filters: SearchFilter): string {
    const params: string[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle range objects
        const obj = value as any;
        for (const [subKey, subValue] of Object.entries(obj)) {
          params.push(`${key}[${subKey}]=${encodeURIComponent(String(subValue))}`);
        }
      } else if (Array.isArray(value)) {
        // Handle arrays
        for (const item of value) {
          params.push(`${key}[]=${encodeURIComponent(String(item))}`);
        }
      } else {
        // Handle simple values
        params.push(`${key}=${encodeURIComponent(String(value))}`);
      }
    }

    return params.join('&');
  }

  /**
   * Transform query string to filter object
   */
  static queryStringToFilters(queryString: string): SearchFilter {
    const filters: any = {};
    const params = new URLSearchParams(queryString);

    for (const [key, value] of params) {
      if (key.endsWith('[]')) {
        // Handle array parameters
        const arrayKey = key.slice(0, -2);
        if (!filters[arrayKey]) {
          filters[arrayKey] = [];
        }
        filters[arrayKey].push(decodeURIComponent(value));
      } else if (key.includes('[')) {
        // Handle nested objects
        const [mainKey, subKey] = key.split(/[\[\]]/).filter(Boolean);
        if (!filters[mainKey]) {
          filters[mainKey] = {};
        }
        filters[mainKey][subKey] = decodeURIComponent(value);
      } else {
        // Handle simple values
        filters[key] = decodeURIComponent(value);
      }
    }

    return filters as SearchFilter;
  }

  /**
   * Transform document to search index format
   */
  static documentToSearchIndex(doc: any, type: string): SearchIndexDocument {
    return {
      id: doc.id || doc._id,
      type: type as any,
      title: doc.title || doc.name || '',
      description: doc.description || doc.desc || '',
      content: doc.content || doc.body || doc.text || '',
      tags: doc.tags || doc.keywords || [],
      category: doc.category || doc.type || '',
      metadata: doc.metadata || {},
      timestamp: doc.createdAt || doc.timestamp || new Date(),
      tenantId: doc.tenantId,
      language: doc.language || 'en',
      status: doc.status || 'active',
      visibility: doc.visibility || 'public',
      popularity: doc.popularity || 0,
      rating: doc.rating || 0,
      lastIndexed: new Date(),
      version: doc.version || 1
    };
  }

  /**
   * Transform search results to API response format
   */
  static searchResultsToAPI(results: any[], total: number, page: number, pageSize: number) {
    return {
      data: results.map(doc => this.sanitizeDocumentForAPI(doc)),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Sanitize document for API response
   */
  static sanitizeDocumentForAPI(doc: any): any {
    const sanitized = { ...doc };

    // Remove sensitive fields
    delete sanitized.searchScore;
    delete sanitized.scoringFactors;
    delete sanitized.rankingReasons;
    delete sanitized.confidence;

    // Limit content length for API responses
    if (sanitized.content && sanitized.content.length > 500) {
      sanitized.content = TextProcessor.truncateText(sanitized.content, 500);
    }

    return sanitized;
  }
}

/**
 * Search performance utilities
 */
export class SearchPerformance {
  private static metrics: Map<string, number[]> = new Map();

  /**
   * Record search performance metric
   */
  static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * Get performance statistics
   */
  static getStatistics(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    median: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const average = sorted.reduce((sum, val) => sum + val, 0) / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    const median = sorted[Math.floor(count / 2)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    return {
      count,
      average,
      min,
      max,
      median,
      p95,
      p99
    };
  }

  /**
   * Get all metrics
   */
  static getAllMetrics(): Record<string, any> {
    const allMetrics: Record<string, any> = {};

    for (const [name] of this.metrics) {
      allMetrics[name] = this.getStatistics(name);
    }

    return allMetrics;
  }

  /**
   * Clear metrics
   */
  static clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(
    name: string,
    fn: () => Promise<T> | T
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;

    this.recordMetric(name, duration);
    logger.debug(`${name} took ${duration}ms`);

    return { result, duration };
  }
}

/**
 * Search cache utilities
 */
export class SearchCache {
  private static cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  /**
   * Set cache entry
   */
  static set(key: string, data: any, ttl: number = 300000): void { // 5 minutes default TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get cache entry
   */
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Delete cache entry
   */
  static delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear cache
   */
  static clear(): void {
    this.cache.clear();
  }

  /**
   * Clean expired entries
   */
  static cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  static getStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
  } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses separately
      memoryUsage: JSON.stringify([...this.cache]).length
    };
  }
}

/**
 * Search logging utilities
 */
export class SearchLogger {
  /**
   * Log search query
   */
  static logSearch(query: string, filters: SearchFilter, results: number, duration: number, userId?: string): void {
    logger.info('Search performed', {
      query,
      filters,
      results,
      duration,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log search error
   */
  static logError(error: Error, query?: string, userId?: string): void {
    logger.error('Search error', {
      error: error.message,
      stack: error.stack,
      query,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log search performance
   */
  static logPerformance(operation: string, duration: number, metadata?: any): void {
    logger.info('Search performance', {
      operation,
      duration,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log search interaction
   */
  static logInteraction(searchId: string, documentId: string, interactionType: string, userId?: string): void {
    logger.info('Search interaction', {
      searchId,
      documentId,
      interactionType,
      userId,
      timestamp: new Date().toISOString()
    });
  }
}

// All classes are already exported inline, no need for additional exports
