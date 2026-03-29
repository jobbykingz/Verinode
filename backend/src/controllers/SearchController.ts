/**
 * Search Controller
 * REST API endpoints for advanced search functionality
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { SearchService, SearchRequest, SearchResponse, SearchAutocomplete } from '../services/search/SearchService';
import { SearchIndexDocument } from '../models/SearchIndex';
import { logger } from '../utils/logger';

export class SearchController {
  private searchService: SearchService;

  constructor(searchService: SearchService) {
    this.searchService = searchService;
  }

  /**
   * Main search endpoint
   * GET /api/search
   */
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      // Build search request
      const searchRequest: SearchRequest = {
        query: req.query.q as string,
        filters: this.parseFilters(req.query),
        sort: this.parseSort(req.query.sort as string),
        page: parseInt(req.query.page as string) || 1,
        pageSize: Math.min(parseInt(req.query.pageSize as string) || 20, 100),
        highlight: req.query.highlight === 'true',
        aggregations: this.parseAggregations(req.query.aggregations as string),
        suggestions: req.query.suggestions === 'true',
        userId: (req as any).user?.id,
        sessionId: req.headers['x-session-id'] as string || 'anonymous',
        context: req.body.context || {}
      };

      // Execute search
      const result = await this.searchService.search(searchRequest);

      // Send response
      res.json({
        success: true,
        data: result,
        meta: {
          query: searchRequest.query,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
          took: result.took,
          searchId: result.searchId
        }
      });

      logger.info(`Search completed: ${searchRequest.query} -> ${result.total} results`);

    } catch (error) {
      logger.error('Search controller error:', error);
      next(error);
    }
  }

  /**
   * Search suggestions/autocomplete endpoint
   * GET /api/search/suggestions
   */
  async suggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        res.json({
          success: true,
          data: {
            query,
            suggestions: [],
            took: 0
          }
        });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
      const userId = (req as any).user?.id;

      const result = await this.searchService.getSuggestions(query, userId, limit);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Suggestions controller error:', error);
      next(error);
    }
  }

  /**
   * Index a document
   * POST /api/search/index
   */
  async indexDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      const document: SearchIndexDocument = req.body;
      
      const success = await this.searchService.indexDocument(document);

      if (success) {
        res.status(201).json({
          success: true,
          message: 'Document indexed successfully',
          data: { id: document.id }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to index document'
        });
      }

    } catch (error) {
      logger.error('Index document controller error:', error);
      next(error);
    }
  }

  /**
   * Bulk index documents
   * POST /api/search/index/bulk
   */
  async bulkIndexDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documents: SearchIndexDocument[] = req.body.documents;

      if (!Array.isArray(documents) || documents.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Documents array is required and cannot be empty'
        });
        return;
      }

      const result = await this.searchService.bulkIndexDocuments(documents);

      res.json({
        success: true,
        message: 'Bulk index completed',
        data: result
      });

    } catch (error) {
      logger.error('Bulk index controller error:', error);
      next(error);
    }
  }

  /**
   * Get search analytics
   * GET /api/search/analytics
   */
  async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeRange = (req.query.timeRange as string) || 'day';
      const validRanges = ['hour', 'day', 'week', 'month'];

      if (!validRanges.includes(timeRange)) {
        res.status(400).json({
          success: false,
          error: 'Invalid time range. Must be one of: ' + validRanges.join(', ')
        });
        return;
      }

      const analytics = await this.searchService.getSearchAnalytics(timeRange as any);

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Analytics controller error:', error);
      next(error);
    }
  }

  /**
   * Record search interaction
   * POST /api/search/interaction
   */
  async recordInteraction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { searchId, documentId, interactionType } = req.body;

      if (!searchId || !documentId || !interactionType) {
        res.status(400).json({
          success: false,
          error: 'searchId, documentId, and interactionType are required'
        });
        return;
      }

      const validTypes = ['click', 'view', 'convert'];
      if (!validTypes.includes(interactionType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid interactionType. Must be one of: ' + validTypes.join(', ')
        });
        return;
      }

      await this.searchService.recordInteraction(searchId, documentId, interactionType);

      res.json({
        success: true,
        message: 'Interaction recorded successfully'
      });

    } catch (error) {
      logger.error('Record interaction controller error:', error);
      next(error);
    }
  }

  /**
   * Get personalized recommendations
   * GET /api/search/recommendations
   */
  async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required for personalized recommendations'
        });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const recommendations = await this.searchService.getPersonalizedRecommendations(userId, limit);

      res.json({
        success: true,
        data: recommendations,
        meta: {
          userId,
          count: recommendations.length,
          limit
        }
      });

    } catch (error) {
      logger.error('Recommendations controller error:', error);
      next(error);
    }
  }

  /**
   * Get search health status
   * GET /api/search/health
   */
  async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await this.searchService.getHealthStatus();

      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        success: health.status === 'healthy',
        data: health
      });

    } catch (error) {
      logger.error('Health check controller error:', error);
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Advanced search with complex filters
   * POST /api/search/advanced
   */
  async advancedSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      const searchRequest: SearchRequest = {
        ...req.body,
        userId: (req as any).user?.id,
        sessionId: req.sessionID
      };

      const result = await this.searchService.search(searchRequest);

      res.json({
        success: true,
        data: result,
        meta: {
          query: searchRequest.query,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
          took: result.took,
          searchId: result.searchId
        }
      });

    } catch (error) {
      logger.error('Advanced search controller error:', error);
      next(error);
    }
  }

  /**
   * Delete document from index
   * DELETE /api/search/index/:id
   */
  async deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = req.params.id;

      if (!documentId) {
        res.status(400).json({
          success: false,
          error: 'Document ID is required'
        });
        return;
      }

      // Note: This would need to be implemented in SearchService
      // For now, return a placeholder response
      res.json({
        success: false,
        error: 'Delete functionality not yet implemented'
      });

    } catch (error) {
      logger.error('Delete document controller error:', error);
      next(error);
    }
  }

  /**
   * Get search statistics
   * GET /api/search/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Note: This would need to be implemented in SearchService
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          totalDocuments: 0,
          totalSearches: 0,
          averageResponseTime: 0,
          indexSize: 0,
          cacheHitRate: 0
        }
      });

    } catch (error) {
      logger.error('Get stats controller error:', error);
      next(error);
    }
  }

  /**
   * Parse filters from query parameters
   */
  private parseFilters(query: any): any {
    const filters: any = {};

    // Parse common filter patterns
    const filterParams = [
      'category', 'type', 'level', 'language', 'status', 'visibility',
      'tags', 'skills', 'instructor', 'rating', 'priceRange', 'duration'
    ];

    for (const param of filterParams) {
      if (query[param]) {
        if (param === 'tags' || param === 'skills') {
          // Handle array parameters
          filters[param] = Array.isArray(query[param]) 
            ? query[param] 
            : query[param].split(',').map((s: string) => s.trim());
        } else if (param === 'priceRange' || param === 'duration') {
          // Handle range parameters
          const range = query[param].split('-');
          if (range.length === 2) {
            filters[param] = {
              min: parseFloat(range[0]),
              max: parseFloat(range[1])
            };
          }
        } else {
          filters[param] = query[param];
        }
      }
    }

    return filters;
  }

  /**
   * Parse sort parameter
   */
  private parseSort(sortParam?: string): Array<{ field: string; order: 'asc' | 'desc' }> {
    if (!sortParam) return [];

    const sorts: Array<{ field: string; order: 'asc' | 'desc' }> = [];
    const sortFields = sortParam.split(',');

    for (const sortField of sortFields) {
      const parts = sortField.trim().split(':');
      const field = parts[0];
      const order = parts[1] === 'desc' ? 'desc' : 'asc';

      if (field) {
        sorts.push({ field, order });
      }
    }

    return sorts;
  }

  /**
   * Parse aggregations parameter
   */
  private parseAggregations(aggregationsParam?: string): Record<string, { type: string; field: string }> {
    if (!aggregationsParam) return {};

    const aggregations: Record<string, { type: string; field: string }> = {};
    const aggFields = aggregationsParam.split(',');

    for (const aggField of aggFields) {
      const parts = aggField.trim().split(':');
      const name = parts[0];
      const config = parts[1] || 'terms';

      if (name) {
        const [type, field] = config.split('.');
        aggregations[name] = {
          type: type || 'terms',
          field: field || name
        };
      }
    }

    return aggregations;
  }
}

export default SearchController;
