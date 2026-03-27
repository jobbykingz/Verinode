// SearchQuery model for tracking search analytics and saved queries

class SearchQuery {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.userId = data.userId || null;
    this.query = data.query || '';
    this.filters = data.filters || {};
    this.name = data.name || '';
    this.isSaved = data.isSaved || false;
    this.searchCount = data.searchCount || 1;
    this.lastUsed = data.lastUsed || new Date().toISOString();
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  generateId() {
    return `sq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Mock database operations
  static async create(data) {
    const searchQuery = new SearchQuery(data);
    // In real implementation, this would save to database
    return searchQuery;
  }

  static async find(query = {}) {
    // Mock data for demonstration
    const mockQueries = [
      new SearchQuery({
        userId: 'user123',
        query: 'identity verification',
        filters: { category: 'identity' },
        isSaved: true,
        name: 'Identity Templates',
        searchCount: 15
      }),
      new SearchQuery({
        userId: 'user123',
        query: 'academic credentials',
        filters: { category: 'credential' },
        isSaved: true,
        name: 'Academic Proofs',
        searchCount: 8
      })
    ];

    // Filter mock data based on query
    return mockQueries.filter(sq => {
      if (query.userId && sq.userId !== query.userId) return false;
      if (query.isSaved !== undefined && sq.isSaved !== query.isSaved) return false;
      return true;
    });
  }

  static async findOne(query) {
    const results = await this.find(query);
    return results[0] || null;
  }

  static async findById(id) {
    const results = await this.find({ id });
    return results[0] || null;
  }

  static async updateOne(query, update) {
    // Mock update operation
    const item = await this.findOne(query);
    if (item) {
      Object.assign(item, update, { updatedAt: new Date().toISOString() });
      return { modifiedCount: 1 };
    }
    return { modifiedCount: 0 };
  }

  static async deleteOne(query) {
    // Mock delete operation
    return { deletedCount: 1 };
  }

  static async aggregate(pipeline) {
    // Mock aggregation for analytics
    const mockAnalytics = [
      {
        _id: null,
        totalSearches: 127,
        uniqueUsers: 23,
        popularQueries: [
          { query: 'identity verification', count: 25 },
          { query: 'academic credentials', count: 18 },
          { query: 'document verification', count: 15 }
        ],
        averageResults: 12.5
      }
    ];
    return mockAnalytics;
  }
}

module.exports = SearchQuery;