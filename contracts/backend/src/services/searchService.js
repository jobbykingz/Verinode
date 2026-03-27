const SearchQuery = require('../models/SearchQuery');
const SearchHistory = require('../models/SearchHistory');

class SearchService {
  constructor() {
    // Mock data sources - in real implementation these would be actual database collections
    this.proofs = [
      {
        id: 1,
        title: 'University Degree Verification',
        description: 'Verify academic credentials and university degrees',
        category: 'credential',
        tags: ['education', 'academic', 'degree', 'university'],
        status: 'verified',
        createdAt: '2024-01-10T10:00:00Z',
        issuer: 'university-issuer-123',
        rating: 4.5
      },
      {
        id: 2,
        title: 'Government ID Verification',
        description: 'Verify government-issued identity documents',
        category: 'identity',
        tags: ['identity', 'government', 'id', 'kyc'],
        status: 'verified',
        createdAt: '2024-01-09T15:30:00Z',
        issuer: 'gov-issuer-456',
        rating: 4.8
      },
      {
        id: 3,
        title: 'Employment Certificate',
        description: 'Verify employment history and certificates',
        category: 'credential',
        tags: ['employment', 'work', 'certificate', 'professional'],
        status: 'pending',
        createdAt: '2024-01-08T09:15:00Z',
        issuer: 'company-issuer-789',
        rating: 4.2
      },
      {
        id: 4,
        title: 'Document Authenticity Check',
        description: 'Verify authenticity of important documents',
        category: 'document',
        tags: ['document', 'authenticity', 'verification', 'legal'],
        status: 'verified',
        createdAt: '2024-01-07T14:20:00Z',
        issuer: 'doc-issuer-321',
        rating: 4.6
      }
    ];

    this.templates = [
      {
        id: 't1',
        title: 'Identity Verification Template',
        description: 'Template for verifying user identities with KYC compliance',
        category: 'identity',
        tags: ['identity', 'kyc', 'verification'],
        price: 15.99,
        averageRating: 4.5,
        purchaseCount: 156,
        createdAt: '2024-01-05T10:30:00Z'
      },
      {
        id: 't2',
        title: 'Academic Credential Verifier',
        description: 'Template for verifying academic degrees and certifications',
        category: 'credential',
        tags: ['education', 'credential', 'academic'],
        price: 9.99,
        averageRating: 4.2,
        purchaseCount: 89,
        createdAt: '2024-01-04T14:20:00Z'
      }
    ];

    this.users = [
      {
        id: 'user123',
        username: 'john_doe',
        email: 'john@example.com',
        role: 'creator',
        joinDate: '2023-12-01T00:00:00Z',
        reputation: 4.7
      },
      {
        id: 'user456',
        username: 'jane_smith',
        email: 'jane@example.com',
        role: 'verifier',
        joinDate: '2023-11-15T00:00:00Z',
        reputation: 4.3
      }
    ];
  }

  // Main search function
  async search(query, filters = {}, userId = null) {
    const startTime = Date.now();
    
    try {
      // Validate and normalize search parameters
      const normalizedQuery = this.normalizeQuery(query);
      const normalizedFilters = this.normalizeFilters(filters);

      // Perform search across all data sources
      const proofResults = await this.searchProofs(normalizedQuery, normalizedFilters);
      const templateResults = await this.searchTemplates(normalizedQuery, normalizedFilters);
      const userResults = await this.searchUsers(normalizedQuery, normalizedFilters);

      // Combine and rank results
      const allResults = [
        ...proofResults.map(item => ({ ...item, type: 'proof' })),
        ...templateResults.map(item => ({ ...item, type: 'template' })),
        ...userResults.map(item => ({ ...item, type: 'user' }))
      ];

      // Apply ranking algorithm
      const rankedResults = this.rankResults(allResults, normalizedQuery, normalizedFilters);

      // Record search history
      if (userId) {
        await this.recordSearchHistory(userId, query, filters, rankedResults.length, Date.now() - startTime);
      }

      // Update search query analytics
      await this.updateSearchQueryAnalytics(query, filters);

      return {
        results: rankedResults,
        totalCount: rankedResults.length,
        searchDuration: Date.now() - startTime,
        query: normalizedQuery,
        filters: normalizedFilters
      };

    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  // Search proofs
  async searchProofs(query, filters) {
    return this.proofs.filter(proof => {
      // Text search
      if (query) {
        const searchText = `${proof.title} ${proof.description} ${proof.tags.join(' ')}`.toLowerCase();
        if (!searchText.includes(query.toLowerCase())) {
          return false;
        }
      }

      // Apply filters
      if (filters.category && proof.category !== filters.category) return false;
      if (filters.status && proof.status !== filters.status) return false;
      if (filters.minRating && proof.rating < filters.minRating) return false;
      if (filters.dateFrom && new Date(proof.createdAt) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(proof.createdAt) > new Date(filters.dateTo)) return false;
      if (filters.tags && filters.tags.length > 0) {
        const hasAllTags = filters.tags.every(tag => proof.tags.includes(tag));
        if (!hasAllTags) return false;
      }

      return true;
    });
  }

  // Search templates
  async searchTemplates(query, filters) {
    return this.templates.filter(template => {
      // Text search
      if (query) {
        const searchText = `${template.title} ${template.description} ${template.tags.join(' ')}`.toLowerCase();
        if (!searchText.includes(query.toLowerCase())) {
          return false;
        }
      }

      // Apply filters
      if (filters.category && template.category !== filters.category) return false;
      if (filters.minPrice && template.price < filters.minPrice) return false;
      if (filters.maxPrice && template.price > filters.maxPrice) return false;
      if (filters.minRating && template.averageRating < filters.minRating) return false;
      if (filters.minPurchases && template.purchaseCount < filters.minPurchases) return false;
      if (filters.dateFrom && new Date(template.createdAt) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(template.createdAt) > new Date(filters.dateTo)) return false;
      if (filters.tags && filters.tags.length > 0) {
        const hasAllTags = filters.tags.every(tag => template.tags.includes(tag));
        if (!hasAllTags) return false;
      }

      return true;
    });
  }

  // Search users
  async searchUsers(query, filters) {
    return this.users.filter(user => {
      // Text search
      if (query) {
        const searchText = `${user.username} ${user.email}`.toLowerCase();
        if (!searchText.includes(query.toLowerCase())) {
          return false;
        }
      }

      // Apply filters
      if (filters.role && user.role !== filters.role) return false;
      if (filters.minReputation && user.reputation < filters.minReputation) return false;
      if (filters.dateFrom && new Date(user.joinDate) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(user.joinDate) > new Date(filters.dateTo)) return false;

      return true;
    });
  }

  // Ranking algorithm
  rankResults(results, query, filters) {
    return results.map(item => {
      let score = 0;

      // Exact match bonus
      if (item.title && item.title.toLowerCase() === query.toLowerCase()) {
        score += 100;
      }

      // Partial match scoring
      if (item.title && item.title.toLowerCase().includes(query.toLowerCase())) {
        score += 50;
      }

      // Description match
      if (item.description && item.description.toLowerCase().includes(query.toLowerCase())) {
        score += 30;
      }

      // Tag match bonus
      if (item.tags) {
        const matchingTags = item.tags.filter(tag => tag.toLowerCase().includes(query.toLowerCase()));
        score += matchingTags.length * 20;
      }

      // Category filter bonus
      if (filters.category && item.category === filters.category) {
        score += 25;
      }

      // Rating boost
      if (item.rating || item.averageRating) {
        const rating = item.rating || item.averageRating;
        score += rating * 5; // Boost based on rating
      }

      // Recency bonus
      const createdAt = new Date(item.createdAt);
      const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 20 - daysOld * 0.1); // Decreasing bonus for newer items

      // Purchase count for templates
      if (item.purchaseCount) {
        score += Math.log(item.purchaseCount + 1) * 3; // Logarithmic boost
      }

      return { ...item, relevanceScore: score };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Auto-complete suggestions
  async getAutoCompleteSuggestions(query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    const suggestions = new Set();

    // Get suggestions from titles
    [...this.proofs, ...this.templates].forEach(item => {
      if (item.title.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(item.title);
      }
    });

    // Get suggestions from tags
    [...this.proofs, ...this.templates].forEach(item => {
      if (item.tags) {
        item.tags.forEach(tag => {
          if (tag.toLowerCase().includes(query.toLowerCase())) {
            suggestions.add(tag);
          }
        });
      }
    });

    // Get suggestions from categories
    const categories = [...new Set([...this.proofs, ...this.templates].map(item => item.category))];
    categories.forEach(category => {
      if (category.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(category);
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }

  // Get search history for user
  async getUserSearchHistory(userId, options = {}) {
    const query = { userId };
    
    // Add date range filter if provided
    if (options.dateFrom || options.dateTo) {
      query.timestamp = {};
      if (options.dateFrom) query.timestamp.$gte = options.dateFrom;
      if (options.dateTo) query.timestamp.$lte = options.dateTo;
    }

    const sort = options.sort || { timestamp: -1 };
    const limit = options.limit || 20;
    const skip = options.skip || 0;

    return await SearchHistory.find(query, { sort, limit, skip });
  }

  // Save search query
  async saveSearchQuery(userId, queryData) {
    const existingQuery = await SearchQuery.findOne({
      userId,
      query: queryData.query,
      filters: queryData.filters
    });

    if (existingQuery) {
      // Update existing saved query
      return await SearchQuery.updateOne(
        { id: existingQuery.id },
        { 
          searchCount: existingQuery.searchCount + 1,
          lastUsed: new Date().toISOString(),
          name: queryData.name || existingQuery.name
        }
      );
    } else {
      // Create new saved query
      return await SearchQuery.create({
        userId,
        ...queryData,
        isSaved: true,
        searchCount: 1,
        lastUsed: new Date().toISOString()
      });
    }
  }

  // Get saved queries for user
  async getUserSavedQueries(userId) {
    return await SearchQuery.find({ userId, isSaved: true });
  }

  // Get search analytics
  async getSearchAnalytics(options = {}) {
    const pipeline = [
      // In real implementation, this would be a proper aggregation pipeline
    ];
    
    const queryAnalytics = await SearchQuery.aggregate(pipeline);
    const historyAnalytics = await SearchHistory.aggregate(pipeline);
    
    return {
      queryAnalytics: queryAnalytics[0] || {},
      historyAnalytics: historyAnalytics[0] || {}
    };
  }

  // Helper methods
  normalizeQuery(query) {
    return query ? query.trim() : '';
  }

  normalizeFilters(filters) {
    const normalized = { ...filters };
    
    // Convert string dates to Date objects
    if (normalized.dateFrom) {
      normalized.dateFrom = new Date(normalized.dateFrom);
    }
    if (normalized.dateTo) {
      normalized.dateTo = new Date(normalized.dateTo);
    }
    
    // Ensure tags is an array
    if (typeof normalized.tags === 'string') {
      normalized.tags = normalized.tags.split(',').map(tag => tag.trim());
    }
    
    return normalized;
  }

  async recordSearchHistory(userId, query, filters, resultsCount, searchDuration) {
    await SearchHistory.create({
      userId,
      query,
      filters,
      resultsCount,
      searchDuration,
      timestamp: new Date().toISOString()
    });
  }

  async updateSearchQueryAnalytics(query, filters) {
    // Update or create search query record for analytics
    const existingQuery = await SearchQuery.findOne({ query, filters });
    
    if (existingQuery) {
      await SearchQuery.updateOne(
        { id: existingQuery.id },
        { 
          searchCount: existingQuery.searchCount + 1,
          lastUsed: new Date().toISOString()
        }
      );
    } else {
      await SearchQuery.create({
        query,
        filters,
        searchCount: 1,
        lastUsed: new Date().toISOString()
      });
    }
  }
}

module.exports = SearchService;