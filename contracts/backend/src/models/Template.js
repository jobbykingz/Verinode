// Mock model functions - will be implemented with actual database later

const TemplateModel = {
  create: async (data) => {
    // Mock implementation
    return {
      _id: 'mock-id',
      title: data.title || '',
      description: data.description || '',
      content: data.content || '',
      price: data.price || 0,
      creator: data.creator || '',
      version: data.version || '1.0.0',
      tags: data.tags || [],
      category: data.category || 'custom',
      isPublic: data.isPublic !== false,
      isActive: data.isActive !== false,
      purchaseCount: 0,
      averageRating: 0,
      totalRatings: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    };
  },

  findById: async (id) => {
    // Mock implementation
    return null;
  },

  find: async (query = {}, options) => {
    // Mock implementation
    return [];
  },

  findOneAndUpdate: async (query, update, options) => {
    // Mock implementation
    return null;
  },

  deleteOne: async (query) => {
    // Mock implementation
    return { deletedCount: 0 };
  },

  countDocuments: async (query = {}) => {
    // Mock implementation
    return 0;
  }
};

const TemplateRatingModel = {
  create: async (data) => {
    // Mock implementation
    return {
      _id: 'mock-rating-id',
      templateId: data.templateId || '',
      userId: data.userId || '',
      rating: data.rating || 0,
      review: data.review,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    };
  },

  find: async (query = {}, options) => {
    // Mock implementation
    return [];
  },

  findOne: async (query) => {
    // Mock implementation
    return null;
  },

  deleteOne: async (query) => {
    // Mock implementation
    return { deletedCount: 0 };
  }
};

module.exports = {
  TemplateModel,
  TemplateRatingModel
};