const { TemplateModel, TemplateRatingModel } = require('../models/Template');
const { validateTemplateInput, validateRatingInput } = require('../utils/validation');

class TemplateService {
  // Create a new template
  async createTemplate(templateData, userId) {
    // Validate input
    const { error } = validateTemplateInput(templateData);
    if (error) {
      throw new Error(`Validation error: ${error.message}`);
    }

    // Add creator and default values
    const newTemplate = {
      ...templateData,
      creator: userId,
      version: templateData.version || '1.0.0',
      isPublic: templateData.isPublic !== false,
      isActive: true,
      purchaseCount: 0,
      averageRating: 0,
      totalRatings: 0
    };

    try {
      const template = await TemplateModel.create(newTemplate);
      return template;
    } catch (error) {
      throw new Error(`Failed to create template: ${error.message || 'Unknown error'}`);
    }
  }

  // Get all templates with filtering and pagination
  async getTemplates(filters = {}, pagination = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = pagination;

      const query = { isActive: true, isPublic: true };

      // Apply filters
      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.minPrice !== undefined) {
        query.price = { ...query.price, $gte: filters.minPrice };
      }

      if (filters.maxPrice !== undefined) {
        query.price = { ...query.price, $lte: filters.maxPrice };
      }

      if (filters.minRating !== undefined) {
        query.averageRating = { $gte: filters.minRating };
      }

      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }

      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { tags: { $in: [new RegExp(filters.search, 'i')] } }
        ];
      }

      // Get total count for pagination
      const totalCount = await TemplateModel.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limit);

      // Apply sorting and pagination
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const templates = await TemplateModel.find(query, {
        sort,
        skip: (page - 1) * limit,
        limit
      });

      return {
        templates,
        totalCount,
        totalPages
      };
    } catch (error) {
      throw new Error(`Failed to fetch templates: ${error.message || 'Unknown error'}`);
    }
  }

  // Get template by ID
  async getTemplateById(id) {
    try {
      const template = await TemplateModel.findById(id);
      return template;
    } catch (error) {
      throw new Error(`Failed to fetch template: ${error.message || 'Unknown error'}`);
    }
  }

  // Update template
  async updateTemplate(id, updateData, userId) {
    try {
      const template = await TemplateModel.findById(id);
      
      if (!template) {
        throw new Error('Template not found');
      }

      // Check if user is the creator
      if (template.creator !== userId) {
        throw new Error('Unauthorized: You can only update your own templates');
      }

      // Validate update data
      const { error } = validateTemplateInput(updateData);
      if (error) {
        throw new Error(`Validation error: ${error.message}`);
      }

      // Increment version if content changes
      if (updateData.content && updateData.content !== template.content) {
        const currentVersion = template.version.split('.');
        currentVersion[2] = (parseInt(currentVersion[2]) + 1).toString();
        updateData.version = currentVersion.join('.');
      }

      const updatedTemplate = await TemplateModel.findOneAndUpdate(
        { _id: id },
        { ...updateData, updatedAt: new Date() },
        { new: true }
      );

      return updatedTemplate;
    } catch (error) {
      throw new Error(`Failed to update template: ${error.message || 'Unknown error'}`);
    }
  }

  // Delete template
  async deleteTemplate(id, userId) {
    try {
      const template = await TemplateModel.findById(id);
      
      if (!template) {
        throw new Error('Template not found');
      }

      // Check if user is the creator
      if (template.creator !== userId) {
        throw new Error('Unauthorized: You can only delete your own templates');
      }

      const result = await TemplateModel.deleteOne({ _id: id });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Failed to delete template: ${error.message || 'Unknown error'}`);
    }
  }

  // Rate template
  async rateTemplate(templateId, userId, rating, review) {
    // Validate input
    const { error } = validateRatingInput({ rating, review });
    if (error) {
      throw new Error(`Validation error: ${error.message}`);
    }

    try {
      // Check if template exists
      const template = await TemplateModel.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Check if user already rated this template
      const existingRating = await TemplateRatingModel.findOne({ templateId, userId });
      if (existingRating) {
        throw new Error('You have already rated this template');
      }

      // Create rating
      const templateRating = await TemplateRatingModel.create({
        templateId,
        userId,
        rating,
        review
      });

      // Update template's average rating
      await this.updateTemplateRating(templateId);

      return templateRating;
    } catch (error) {
      throw new Error(`Failed to rate template: ${error.message || 'Unknown error'}`);
    }
  }

  // Update template's average rating
  async updateTemplateRating(templateId) {
    try {
      const ratings = await TemplateRatingModel.find({ templateId });
      const totalRatings = ratings.length;
      
      if (totalRatings > 0) {
        const averageRating = ratings.reduce((sum, rating) => sum + rating.rating, 0) / totalRatings;
        
        await TemplateModel.findOneAndUpdate(
          { _id: templateId },
          { 
            averageRating,
            totalRatings 
          }
        );
      }
    } catch (error) {
      // Log error but don't throw to prevent rating failure
      console.error('Failed to update template rating:', error);
    }
  }

  // Get template ratings
  async getTemplateRatings(templateId) {
    try {
      const ratings = await TemplateRatingModel.find({ templateId }, { sort: { createdAt: -1 } });
      return ratings;
    } catch (error) {
      throw new Error(`Failed to fetch template ratings: ${error.message || 'Unknown error'}`);
    }
  }

  // Get user's templates
  async getUserTemplates(userId) {
    try {
      const templates = await TemplateModel.find({ creator: userId }, { sort: { createdAt: -1 } });
      return templates;
    } catch (error) {
      throw new Error(`Failed to fetch user templates: ${error.message || 'Unknown error'}`);
    }
  }

  // Purchase template
  async purchaseTemplate(templateId, userId) {
    try {
      const template = await TemplateModel.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      if (template.creator === userId) {
        throw new Error('You cannot purchase your own template');
      }

      // Update purchase count
      const updatedTemplate = await TemplateModel.findOneAndUpdate(
        { _id: templateId },
        { 
          $inc: { purchaseCount: 1 },
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!updatedTemplate) {
        throw new Error('Failed to update template purchase count');
      }

      return updatedTemplate;
    } catch (error) {
      throw new Error(`Failed to purchase template: ${error.message || 'Unknown error'}`);
    }
  }
}

// Export singleton instance
const templateService = new TemplateService();
module.exports = { templateService };