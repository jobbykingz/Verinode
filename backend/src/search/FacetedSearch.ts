/**
 * Faceted Search Implementation
 * Advanced faceted search and filtering capabilities
 */

import { SearchIndexDocument } from '../models/SearchIndex';
import { SearchFilter } from '../models/Course';
import { logger } from '../utils/logger';

export interface FacetDefinition {
  field: string;
  type: 'terms' | 'range' | 'date_histogram' | 'histogram';
  label: string;
  size?: number;
  order?: 'key' | 'count' | 'term';
  orderDirection?: 'asc' | 'desc';
  ranges?: Array<{ key: string; from?: number; to?: number }>;
  interval?: number;
  format?: string;
  showEmpty?: boolean;
}

export interface FacetResult {
  field: string;
  label: string;
  type: string;
  buckets: FacetBucket[];
  totalBuckets: number;
  showMore: boolean;
}

export interface FacetBucket {
  key: string;
  label: string;
  count: number;
  selected: boolean;
  subAggregations?: Record<string, FacetResult>;
}

export interface FacetedSearchRequest {
  query?: string;
  filters: SearchFilter;
  facets: FacetDefinition[];
  page?: number;
  pageSize?: number;
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
}

export interface FacetedSearchResponse {
  documents: SearchIndexDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: FacetResult[];
  appliedFilters: AppliedFilter[];
  suggestions?: string[];
  took: number;
}

export interface AppliedFilter {
  field: string;
  label: string;
  value: any;
  type: string;
  removable: boolean;
}

export class FacetedSearchEngine {
  private documents: SearchIndexDocument[] = [];
  private facetDefinitions: Map<string, FacetDefinition> = new Map();

  constructor() {
    this.initializeDefaultFacets();
  }

  /**
   * Initialize default facet definitions
   */
  private initializeDefaultFacets(): void {
    const defaultFacets: FacetDefinition[] = [
      {
        field: 'type',
        type: 'terms',
        label: 'Content Type',
        size: 10,
        order: 'count',
        orderDirection: 'desc'
      },
      {
        field: 'category',
        type: 'terms',
        label: 'Category',
        size: 20,
        order: 'count',
        orderDirection: 'desc'
      },
      {
        field: 'tags',
        type: 'terms',
        label: 'Tags',
        size: 50,
        order: 'count',
        orderDirection: 'desc'
      },
      {
        field: 'language',
        type: 'terms',
        label: 'Language',
        size: 10,
        order: 'count',
        orderDirection: 'desc'
      },
      {
        field: 'status',
        type: 'terms',
        label: 'Status',
        size: 10,
        order: 'key',
        orderDirection: 'asc'
      },
      {
        field: 'visibility',
        type: 'terms',
        label: 'Visibility',
        size: 10,
        order: 'key',
        orderDirection: 'asc'
      },
      {
        field: 'rating',
        type: 'range',
        label: 'Rating',
        ranges: [
          { key: '5', from: 4.5, to: 5 },
          { key: '4', from: 3.5, to: 4.5 },
          { key: '3', from: 2.5, to: 3.5 },
          { key: '2', from: 1.5, to: 2.5 },
          { key: '1', from: 0, to: 1.5 }
        ]
      },
      {
        field: 'popularity',
        type: 'range',
        label: 'Popularity',
        ranges: [
          { key: 'high', from: 100 },
          { key: 'medium', from: 10, to: 100 },
          { key: 'low', from: 0, to: 10 }
        ]
      },
      {
        field: 'timestamp',
        type: 'date_histogram',
        label: 'Date',
        interval: 30, // days
        format: 'YYYY-MM-DD',
        size: 12
      }
    ];

    for (const facet of defaultFacets) {
      this.facetDefinitions.set(facet.field, facet);
    }
  }

  /**
   * Set documents for faceted search
   */
  setDocuments(documents: SearchIndexDocument[]): void {
    this.documents = documents;
  }

  /**
   * Add facet definition
   */
  addFacetDefinition(facet: FacetDefinition): void {
    this.facetDefinitions.set(facet.field, facet);
  }

  /**
   * Remove facet definition
   */
  removeFacetDefinition(field: string): void {
    this.facetDefinitions.delete(field);
  }

  /**
   * Get facet definition
   */
  getFacetDefinition(field: string): FacetDefinition | undefined {
    return this.facetDefinitions.get(field);
  }

  /**
   * Get all facet definitions
   */
  getAllFacetDefinitions(): FacetDefinition[] {
    return Array.from(this.facetDefinitions.values());
  }

  /**
   * Perform faceted search
   */
  async search(request: FacetedSearchRequest): Promise<FacetedSearchResponse> {
    const startTime = Date.now();

    try {
      // Apply filters to documents
      let filteredDocuments = this.applyFilters(this.documents, request.filters);

      // Apply text search if query provided
      if (request.query) {
        filteredDocuments = this.applyTextSearch(filteredDocuments, request.query);
      }

      // Apply sorting
      if (request.sort) {
        filteredDocuments = this.applySorting(filteredDocuments, request.sort);
      }

      // Calculate facets
      const facets = await this.calculateFacets(filteredDocuments, request.facets, request.filters);

      // Apply pagination
      const paginatedDocuments = this.applyPagination(filteredDocuments, request.page, request.pageSize);

      // Get applied filters
      const appliedFilters = this.getAppliedFilters(request.filters);

      // Generate suggestions if needed
      const suggestions = this.generateSuggestions(request.query, filteredDocuments);

      const response: FacetedSearchResponse = {
        documents: paginatedDocuments,
        total: filteredDocuments.length,
        page: request.page || 1,
        pageSize: request.pageSize || 20,
        totalPages: Math.ceil(filteredDocuments.length / (request.pageSize || 20)),
        facets,
        appliedFilters,
        suggestions,
        took: Date.now() - startTime
      };

      logger.debug(`Faceted search completed: ${request.query} -> ${response.total} results in ${response.took}ms`);
      return response;

    } catch (error) {
      logger.error('Faceted search failed:', error);
      throw error;
    }
  }

  /**
   * Apply filters to documents
   */
  private applyFilters(documents: SearchIndexDocument[], filters: SearchFilter): SearchIndexDocument[] {
    return documents.filter(doc => {
      for (const [field, value] of Object.entries(filters)) {
        if (!this.matchesFilter(doc, field, value)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Check if document matches filter
   */
  private matchesFilter(doc: SearchIndexDocument, field: string, value: any): boolean {
    const docValue = (doc as any)[field];

    if (value === undefined || value === null) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.includes(docValue);
    }

    if (typeof value === 'object' && value !== null) {
      // Handle range filters
      if (value.from !== undefined && value.to !== undefined) {
        return docValue >= value.from && docValue <= value.to;
      }
      if (value.min !== undefined && docValue < value.min) {
        return false;
      }
      if (value.max !== undefined && docValue > value.max) {
        return false;
      }
      return true;
    }

    return docValue === value;
  }

  /**
   * Apply text search to documents
   */
  private applyTextSearch(documents: SearchIndexDocument[], query: string): SearchIndexDocument[] {
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/);

    return documents.filter(doc => {
      const searchableText = `${doc.title} ${doc.description} ${doc.content} ${doc.tags?.join(' ')}`.toLowerCase();
      
      // Simple OR search - any term matches
      return terms.some(term => searchableText.includes(term));
    });
  }

  /**
   * Apply sorting to documents
   */
  private applySorting(documents: SearchIndexDocument[], sort: Array<{ field: string; order: 'asc' | 'desc' }>): SearchIndexDocument[] {
    return documents.sort((a, b) => {
      for (const { field, order } of sort) {
        const aValue = (a as any)[field];
        const bValue = (b as any)[field];

        if (aValue !== bValue) {
          const comparison = aValue < bValue ? -1 : 1;
          return order === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Apply pagination to documents
   */
  private applyPagination(documents: SearchIndexDocument[], page?: number, pageSize?: number): SearchIndexDocument[] {
    const p = page || 1;
    const ps = pageSize || 20;
    const start = (p - 1) * ps;
    const end = start + ps;
    return documents.slice(start, end);
  }

  /**
   * Calculate facets for documents
   */
  private async calculateFacets(
    documents: SearchIndexDocument[], 
    facetDefs: FacetDefinition[], 
    appliedFilters: SearchFilter
  ): Promise<FacetResult[]> {
    const results: FacetResult[] = [];

    for (const facetDef of facetDefs) {
      const result = await this.calculateSingleFacet(documents, facetDef, appliedFilters);
      results.push(result);
    }

    return results;
  }

  /**
   * Calculate single facet
   */
  private async calculateSingleFacet(
    documents: SearchIndexDocument[], 
    facetDef: FacetDefinition, 
    appliedFilters: SearchFilter
  ): Promise<FacetResult> {
    const buckets: FacetBucket[] = [];

    switch (facetDef.type) {
      case 'terms':
        buckets.push(...this.calculateTermsFacet(documents, facetDef, appliedFilters));
        break;
      case 'range':
        buckets.push(...this.calculateRangeFacet(documents, facetDef, appliedFilters));
        break;
      case 'date_histogram':
        buckets.push(...this.calculateDateHistogramFacet(documents, facetDef, appliedFilters));
        break;
      case 'histogram':
        buckets.push(...this.calculateHistogramFacet(documents, facetDef, appliedFilters));
        break;
    }

    // Sort buckets
    this.sortBuckets(buckets, facetDef);

    // Limit to specified size
    const size = facetDef.size || 10;
    const showMore = buckets.length > size;
    const limitedBuckets = buckets.slice(0, size);

    return {
      field: facetDef.field,
      label: facetDef.label,
      type: facetDef.type,
      buckets: limitedBuckets,
      totalBuckets: buckets.length,
      showMore
    };
  }

  /**
   * Calculate terms facet
   */
  private calculateTermsFacet(
    documents: SearchIndexDocument[], 
    facetDef: FacetDefinition, 
    appliedFilters: SearchFilter
  ): FacetBucket[] {
    const counts = new Map<string, number>();

    for (const doc of documents) {
      const value = (doc as any)[facetDef.field];
      
      if (Array.isArray(value)) {
        for (const item of value) {
          counts.set(item, (counts.get(item) || 0) + 1);
        }
      } else if (value !== undefined && value !== null) {
        counts.set(String(value), (counts.get(String(value)) || 0) + 1);
      }
    }

    const buckets: FacetBucket[] = [];
    for (const [key, count] of counts) {
      const selected = this.isFilterApplied(facetDef.field, key, appliedFilters);
      buckets.push({
        key,
        label: this.formatBucketLabel(key, facetDef),
        count,
        selected
      });
    }

    return buckets;
  }

  /**
   * Calculate range facet
   */
  private calculateRangeFacet(
    documents: SearchIndexDocument[], 
    facetDef: FacetDefinition, 
    appliedFilters: SearchFilter
  ): FacetBucket[] {
    const buckets: FacetBucket[] = [];

    if (!facetDef.ranges) {
      return buckets;
    }

    for (const range of facetDef.ranges) {
      let count = 0;

      for (const doc of documents) {
        const value = (doc as any)[facetDef.field];
        
        if (value !== undefined && value !== null) {
          const inRange = 
            (range.from === undefined || value >= range.from) &&
            (range.to === undefined || value <= range.to);
          
          if (inRange) {
            count++;
          }
        }
      }

      const selected = this.isRangeFilterApplied(facetDef.field, range, appliedFilters);
      buckets.push({
        key: range.key,
        label: this.formatRangeLabel(range, facetDef),
        count,
        selected
      });
    }

    return buckets;
  }

  /**
   * Calculate date histogram facet
   */
  private calculateDateHistogramFacet(
    documents: SearchIndexDocument[], 
    facetDef: FacetDefinition, 
    appliedFilters: SearchFilter
  ): FacetBucket[] {
    const buckets: FacetBucket[] = [];
    const interval = facetDef.interval || 30; // days
    const counts = new Map<string, number>();

    for (const doc of documents) {
      const value = (doc as any)[facetDef.field];
      
      if (value instanceof Date) {
        const bucketKey = this.getDateBucket(value, interval);
        counts.set(bucketKey, (counts.get(bucketKey) || 0) + 1);
      }
    }

    for (const [key, count] of counts) {
      const selected = this.isFilterApplied(facetDef.field, key, appliedFilters);
      buckets.push({
        key,
        label: this.formatDateLabel(key, facetDef),
        count,
        selected
      });
    }

    return buckets.sort((a, b) => b.key.localeCompare(a.key));
  }

  /**
   * Calculate histogram facet
   */
  private calculateHistogramFacet(
    documents: SearchIndexDocument[], 
    facetDef: FacetDefinition, 
    appliedFilters: SearchFilter
  ): FacetBucket[] {
    const buckets: FacetBucket[] = [];
    const interval = facetDef.interval || 1;
    const counts = new Map<string, number>();

    for (const doc of documents) {
      const value = (doc as any)[facetDef.field];
      
      if (typeof value === 'number') {
        const bucketKey = String(Math.floor(value / interval) * interval);
        counts.set(bucketKey, (counts.get(bucketKey) || 0) + 1);
      }
    }

    for (const [key, count] of counts) {
      const selected = this.isFilterApplied(facetDef.field, key, appliedFilters);
      buckets.push({
        key,
        label: this.formatHistogramLabel(key, interval, facetDef),
        count,
        selected
      });
    }

    return buckets.sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Sort buckets according to facet definition
   */
  private sortBuckets(buckets: FacetBucket[], facetDef: FacetDefinition): void {
    const order = facetDef.order || 'count';
    const direction = facetDef.orderDirection || 'desc';

    buckets.sort((a, b) => {
      let comparison = 0;

      switch (order) {
        case 'key':
          comparison = a.key.localeCompare(b.key);
          break;
        case 'term':
          comparison = a.label.localeCompare(b.label);
          break;
        case 'count':
          comparison = a.count - b.count;
          break;
      }

      return direction === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Check if filter is applied
   */
  private isFilterApplied(field: string, value: string, appliedFilters: SearchFilter): boolean {
    const filterValue = appliedFilters[field as keyof SearchFilter];
    
    if (Array.isArray(filterValue)) {
      return filterValue.includes(value);
    }
    
    return filterValue === value;
  }

  /**
   * Check if range filter is applied
   */
  private isRangeFilterApplied(field: string, range: any, appliedFilters: SearchFilter): boolean {
    const filterValue = appliedFilters[field as keyof SearchFilter];
    
    if (typeof filterValue === 'object' && filterValue !== null) {
      const filter = filterValue as any;
      return filter.from === range.from && filter.to === range.to;
    }
    
    return false;
  }

  /**
   * Format bucket label
   */
  private formatBucketLabel(key: string, facetDef: FacetDefinition): string {
    // Simple formatting - can be enhanced
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  /**
   * Format range label
   */
  private formatRangeLabel(range: any, facetDef: FacetDefinition): string {
    if (range.from !== undefined && range.to !== undefined) {
      return `${range.from} - ${range.to}`;
    } else if (range.from !== undefined) {
      return `>= ${range.from}`;
    } else if (range.to !== undefined) {
      return `<= ${range.to}`;
    }
    return range.key;
  }

  /**
   * Format date label
   */
  private formatDateLabel(key: string, facetDef: FacetDefinition): string {
    const format = facetDef.format || 'YYYY-MM-DD';
    // Simple formatting - in production use a proper date library
    return key;
  }

  /**
   * Format histogram label
   */
  private formatHistogramLabel(key: string, interval: number, facetDef: FacetDefinition): string {
    const start = parseInt(key);
    const end = start + interval;
    return `${start} - ${end}`;
  }

  /**
   * Get date bucket
   */
  private getDateBucket(date: Date, intervalDays: number): string {
    const timestamp = date.getTime();
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    const bucketStart = Math.floor(timestamp / intervalMs) * intervalMs;
    return new Date(bucketStart).toISOString().split('T')[0];
  }

  /**
   * Get applied filters
   */
  private getAppliedFilters(filters: SearchFilter): AppliedFilter[] {
    const applied: AppliedFilter[] = [];

    for (const [field, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      const facetDef = this.facetDefinitions.get(field);
      const label = facetDef?.label || field;

      if (Array.isArray(value)) {
        for (const item of value) {
          applied.push({
            field,
            label,
            value: item,
            type: 'terms',
            removable: true
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        applied.push({
          field,
          label,
          value,
          type: 'range',
          removable: true
        });
      } else {
        applied.push({
          field,
          label,
          value,
          type: 'terms',
          removable: true
        });
      }
    }

    return applied;
  }

  /**
   * Generate search suggestions
   */
  private generateSuggestions(query?: string, documents?: SearchIndexDocument[]): string[] {
    if (!query || !documents) return [];

    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();

    // Extract popular tags from results
    const tagCounts = new Map<string, number>();
    for (const doc of documents) {
      if (doc.tags) {
        for (const tag of doc.tags) {
          if (tag.toLowerCase().includes(queryLower)) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        }
      }
    }

    // Sort by count and take top 5
    const sortedTags = Array.from(tagCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);

    suggestions.push(...sortedTags);

    return suggestions;
  }

  /**
   * Get facet statistics
   */
  getFacetStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [field, facetDef] of this.facetDefinitions) {
      stats[field] = {
        label: facetDef.label,
        type: facetDef.type,
        size: facetDef.size,
        totalDocuments: this.documents.length
      };
    }

    return stats;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.documents = [];
    this.facetDefinitions.clear();
    this.initializeDefaultFacets();
  }
}

export default FacetedSearchEngine;
