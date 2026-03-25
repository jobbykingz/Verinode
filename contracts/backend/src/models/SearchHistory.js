// SearchHistory model for tracking user search history

class SearchHistory {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.userId = data.userId || null;
    this.query = data.query || '';
    this.filters = data.filters || {};
    this.resultsCount = data.resultsCount || 0;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.searchDuration = data.searchDuration || 0; // in milliseconds
  }

  generateId() {
    return `sh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Mock database operations
  static async create(data) {
    const searchHistory = new SearchHistory(data);
    // In real implementation, this would save to database
    return searchHistory;
  }

  static async find(query = {}, options = {}) {
    // Mock data for demonstration
    const mockHistory = [
      new SearchHistory({
        userId: 'user123',
        query: 'identity verification',
        filters: { category: 'identity' },
        resultsCount: 12,
        searchDuration: 420,
        timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      }),
      new SearchHistory({
        userId: 'user123',
        query: 'academic credentials',
        filters: { category: 'credential', minRating: 4 },
        resultsCount: 8,
        searchDuration: 280,
        timestamp: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
      }),
      new SearchHistory({
        userId: 'user123',
        query: 'document verification',
        filters: { category: 'document', maxPrice: 10 },
        resultsCount: 15,
        searchDuration: 350,
        timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }),
      new SearchHistory({
        userId: 'user456',
        query: 'transaction proofs',
        filters: { category: 'transaction' },
        resultsCount: 5,
        searchDuration: 180,
        timestamp: new Date(Date.now() - 172800000).toISOString() // 2 days ago
      })
    ];

    // Filter mock data based on query
    let filtered = mockHistory.filter(sh => {
      if (query.userId && sh.userId !== query.userId) return false;
      
      // Filter by date range
      if (query.timestamp) {
        const searchDate = new Date(sh.timestamp);
        if (query.timestamp.$gte && searchDate < new Date(query.timestamp.$gte)) return false;
        if (query.timestamp.$lte && searchDate > new Date(query.timestamp.$lte)) return false;
      }
      
      // Filter by query text
      if (query.query && query.query.$regex) {
        const regex = new RegExp(query.query.$regex, query.query.$options || 'i');
        if (!regex.test(sh.query)) return false;
      }
      
      return true;
    });

    // Apply sorting
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField];
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (sortOrder === -1) {
          return new Date(bVal) - new Date(aVal); // Descending
        } else {
          return new Date(aVal) - new Date(bVal); // Ascending
        }
      });
    }

    // Apply pagination
    if (options.limit) {
      const skip = options.skip || 0;
      filtered = filtered.slice(skip, skip + options.limit);
    }

    return filtered;
  }

  static async findOne(query) {
    const results = await this.find(query);
    return results[0] || null;
  }

  static async findById(id) {
    const results = await this.find({ id });
    return results[0] || null;
  }

  static async countDocuments(query = {}) {
    const results = await this.find(query);
    return results.length;
  }

  static async deleteOne(query) {
    // Mock delete operation
    return { deletedCount: 1 };
  }

  static async deleteMany(query) {
    // Mock bulk delete operation
    const results = await this.find(query);
    return { deletedCount: results.length };
  }

  static async aggregate(pipeline) {
    // Mock aggregation for history analytics
    const mockHistoryAnalytics = [
      {
        _id: null,
        totalSearches: 47,
        averageSearchDuration: 307.5,
        mostActiveUser: 'user123',
        recentSearches: [
          { query: 'identity verification', count: 8 },
          { query: 'academic credentials', count: 5 },
          { query: 'document verification', count: 4 }
        ],
        searchTrends: [
          { date: '2024-01-15', count: 12 },
          { date: '2024-01-14', count: 8 },
          { date: '2024-01-13', count: 15 }
        ]
      }
    ];
    return mockHistoryAnalytics;
  }
}

module.exports = SearchHistory;