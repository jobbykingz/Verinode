const SearchService = require('../services/searchService');
const IndexingService = require('../services/indexingService');
const SearchQuery = require('../models/SearchQuery');
const SearchHistory = require('../models/SearchHistory');

class SearchController {
  constructor() {
    this.searchService = new SearchService();
    this.indexingService = new IndexingService();
  }

  // Main search endpoint
  async search(req, res) {
    try {
      const { q, ...filters } = req.query;
      const userId = req.user?.id || null; // Get from auth middleware

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const searchResults = await this.searchService.search(q, filters, userId);

      res.status(200).json({
        success: true,
        data: searchResults.results,
        pagination: {
          totalCount: searchResults.totalCount,
          searchDuration: searchResults.searchDuration
        },
        query: searchResults.query,
        filters: searchResults.filters
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Search failed: ${error.message}`
      });
    }
  }

  // Auto-complete suggestions
  async autoComplete(req, res) {
    try {
      const { q, limit = 10 } = req.query;

      if (!q || q.length < 2) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'Query too short for suggestions'
        });
      }

      const suggestions = await this.searchService.getAutoCompleteSuggestions(q, parseInt(limit));

      res.status(200).json({
        success: true,
        data: suggestions,
        query: q
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Auto-complete failed: ${error.message}`
      });
    }
  }

  // Get user search history
  async getSearchHistory(req, res) {
    try {
      const userId = req.user?.id;
      const { 
        limit = 20, 
        skip = 0, 
        sort = 'timestamp', 
        order = 'desc',
        dateFrom,
        dateTo
      } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const options = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        sort: { [sort]: order === 'desc' ? -1 : 1 }
      };

      if (dateFrom) options.dateFrom = dateFrom;
      if (dateTo) options.dateTo = dateTo;

      const history = await this.searchService.getUserSearchHistory(userId, options);
      const totalCount = await SearchHistory.countDocuments({ userId });

      res.status(200).json({
        success: true,
        data: history,
        pagination: {
          totalCount,
          currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to fetch search history: ${error.message}`
      });
    }
  }

  // Delete search history item
  async deleteSearchHistory(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const result = await SearchHistory.deleteOne({ id, userId });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Search history item not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Search history item deleted successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to delete search history: ${error.message}`
      });
    }
  }

  // Clear all search history
  async clearSearchHistory(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const result = await SearchHistory.deleteMany({ userId });

      res.status(200).json({
        success: true,
        message: `Deleted ${result.deletedCount} search history items`,
        deletedCount: result.deletedCount
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to clear search history: ${error.message}`
      });
    }
  }

  // Save search query
  async saveSearchQuery(req, res) {
    try {
      const userId = req.user?.id;
      const { query, filters, name } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const savedQuery = await this.searchService.saveSearchQuery(userId, {
        query,
        filters: filters || {},
        name: name || query
      });

      res.status(201).json({
        success: true,
        data: savedQuery,
        message: 'Search query saved successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to save search query: ${error.message}`
      });
    }
  }

  // Get saved queries
  async getSavedQueries(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const savedQueries = await this.searchService.getUserSavedQueries(userId);

      res.status(200).json({
        success: true,
        data: savedQueries
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to fetch saved queries: ${error.message}`
      });
    }
  }

  // Delete saved query
  async deleteSavedQuery(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const result = await SearchQuery.deleteOne({ id, userId, isSaved: true });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Saved query not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Saved query deleted successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to delete saved query: ${error.message}`
      });
    }
  }

  // Get search analytics
  async getSearchAnalytics(req, res) {
    try {
      // Only allow admins to access analytics
      const userId = req.user?.id;
      const userRole = req.user?.role || 'user';

      if (userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const analytics = await this.searchService.getSearchAnalytics();

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to fetch search analytics: ${error.message}`
      });
    }
  }

  // Get index statistics
  async getIndexStats(req, res) {
    try {
      const stats = await this.indexingService.getIndexStats();

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to fetch index statistics: ${error.message}`
      });
    }
  }

  // Rebuild indexes
  async rebuildIndexes(req, res) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role || 'user';

      if (userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const result = await this.indexingService.rebuildIndexes();

      res.status(200).json({
        success: true,
        data: result,
        message: 'Search indexes rebuilt successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to rebuild indexes: ${error.message}`
      });
    }
  }

  // Check index health
  async checkIndexHealth(req, res) {
    try {
      const health = await this.indexingService.checkIndexHealth();

      res.status(200).json({
        success: true,
        data: health
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to check index health: ${error.message}`
      });
    }
  }

  // Get index suggestions
  async getIndexSuggestions(req, res) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role || 'user';

      if (userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const suggestions = await this.indexingService.suggestIndexImprovements();

      res.status(200).json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to get index suggestions: ${error.message}`
      });
    }
  }

  // Recent searches
  async getRecentSearches(req, res) {
    try {
      const userId = req.user?.id;
      const { limit = 5 } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const recentSearches = await this.searchService.getUserSearchHistory(userId, {
        limit: parseInt(limit),
        sort: { timestamp: -1 }
      });

      res.status(200).json({
        success: true,
        data: recentSearches
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to fetch recent searches: ${error.message}`
      });
    }
  }

  // Popular searches
  async getPopularSearches(req, res) {
    try {
      // Get popular searches from analytics
      const analytics = await this.searchService.getSearchAnalytics();
      const popularQueries = analytics.queryAnalytics.popularQueries || [];

      res.status(200).json({
        success: true,
        data: popularQueries.slice(0, 10) // Top 10 popular searches
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to fetch popular searches: ${error.message}`
      });
    }
  }
}

module.exports = new SearchController();