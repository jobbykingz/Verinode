const CustomTemplate = require('../models/CustomTemplate');
const { v4: uuidv4 } = require('uuid');

class TemplateBuilderService {
  /**
   * Create a new custom template
   */
  static async createTemplate(templateData, userId) {
    try {
      // Generate unique IDs for fields and validation rules
      const processedTemplate = this.processTemplateData(templateData);
      
      const template = new CustomTemplate({
        ...processedTemplate,
        createdBy: userId,
        status: 'draft'
      });
      
      // Validate template structure
      const validation = template.validateTemplate();
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }
      
      const savedTemplate = await template.save();
      return savedTemplate;
    } catch (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Update an existing template
   */
  static async updateTemplate(templateId, templateData, userId) {
    try {
      const template = await CustomTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Check ownership
      if (template.createdBy !== userId) {
        throw new Error('Unauthorized: You can only update your own templates');
      }
      
      // Only allow updates to draft templates
      if (template.status !== 'draft') {
        throw new Error('Only draft templates can be updated');
      }
      
      const processedTemplate = this.processTemplateData(templateData);
      
      // Update template fields
      Object.assign(template, processedTemplate);
      template.status = 'draft'; // Reset to draft when updated
      
      // Validate updated template
      const validation = template.validateTemplate();
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }
      
      const updatedTemplate = await template.save();
      return updatedTemplate;
    } catch (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplate(templateId, userId = null) {
    try {
      const template = await CustomTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Check if user can access this template
      if (!template.isPublic && template.createdBy !== userId) {
        throw new Error('Unauthorized: This template is not public');
      }
      
      return template;
    } catch (error) {
      throw new Error(`Failed to get template: ${error.message}`);
    }
  }

  /**
   * List templates with filtering and pagination
   */
  static async listTemplates(filters = {}, pagination = {}) {
    try {
      const {
        category,
        status = 'approved',
        isPublic = true,
        tags,
        createdBy,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;
      
      const {
        page = 1,
        limit = 20
      } = pagination;
      
      // Build query
      const query = {};
      
      if (category) query.category = category;
      if (status) query.status = status;
      if (isPublic !== undefined) query.isPublic = isPublic;
      if (createdBy) query.createdBy = createdBy;
      
      if (tags && Array.isArray(tags) && tags.length > 0) {
        query.tags = { $in: tags };
      }
      
      if (search) {
        query.$text = { $search: search };
      }
      
      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      // Execute query with pagination
      const skip = (page - 1) * limit;
      
      const [templates, totalCount] = await Promise.all([
        CustomTemplate.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit),
        CustomTemplate.countDocuments(query)
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      
      return {
        templates,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to list templates: ${error.message}`);
    }
  }

  /**
   * Delete template
   */
  static async deleteTemplate(templateId, userId) {
    try {
      const template = await CustomTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Check ownership
      if (template.createdBy !== userId) {
        throw new Error('Unauthorized: You can only delete your own templates');
      }
      
      // Only allow deletion of draft templates
      if (template.status !== 'draft') {
        throw new Error('Only draft templates can be deleted');
      }
      
      await CustomTemplate.findByIdAndDelete(templateId);
      return { success: true, message: 'Template deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Submit template for approval
   */
  static async submitForApproval(templateId, userId) {
    try {
      const template = await CustomTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      if (template.createdBy !== userId) {
        throw new Error('Unauthorized: You can only submit your own templates');
      }
      
      if (template.status !== 'draft') {
        throw new Error('Template must be in draft status to submit for approval');
      }
      
      // Validate template before submission
      const validation = template.validateTemplate();
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }
      
      template.status = 'pending';
      const updatedTemplate = await template.save();
      
      return updatedTemplate;
    } catch (error) {
      throw new Error(`Failed to submit template for approval: ${error.message}`);
    }
  }

  /**
   * Moderate template (admin only)
   */
  static async moderateTemplate(templateId, decision, moderatorId, rejectionReason = null) {
    try {
      const template = await CustomTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      if (template.status !== 'pending') {
        throw new Error('Template is not pending approval');
      }
      
      if (decision === 'approve') {
        template.status = 'approved';
      } else if (decision === 'reject') {
        template.status = 'rejected';
        template.rejectionReason = rejectionReason;
      } else {
        throw new Error('Invalid decision. Must be "approve" or "reject"');
      }
      
      template.moderatedBy = moderatorId;
      template.moderatedAt = new Date();
      
      const updatedTemplate = await template.save();
      return updatedTemplate;
    } catch (error) {
      throw new Error(`Failed to moderate template: ${error.message}`);
    }
  }

  /**
   * Fork (copy) an existing template
   */
  static async forkTemplate(templateId, userId, newName = null) {
    try {
      const originalTemplate = await this.getTemplate(templateId, userId);
      
      // Create a copy with new IDs
      const forkedTemplate = {
        name: newName || `${originalTemplate.name} (Copy)`,
        description: originalTemplate.description,
        category: originalTemplate.category,
        fields: originalTemplate.fields.map(field => ({
          ...field,
          id: uuidv4()
        })),
        validationRules: originalTemplate.validationRules.map(rule => ({
          ...rule,
          id: uuidv4(),
          fieldId: originalTemplate.fields.find(f => f.id === rule.fieldId)?.id || rule.fieldId
        })),
        layout: originalTemplate.layout,
        templateSchema: originalTemplate.templateSchema,
        sampleData: originalTemplate.sampleData,
        tags: originalTemplate.tags,
        price: 0, // Forked templates are free by default
        forkedFrom: templateId
      };
      
      const newTemplate = await this.createTemplate(forkedTemplate, userId);
      return newTemplate;
    } catch (error) {
      throw new Error(`Failed to fork template: ${error.message}`);
    }
  }

  /**
   * Get template statistics
   */
  static async getTemplateStats(templateId) {
    try {
      const template = await CustomTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      return template.getStatistics();
    } catch (error) {
      throw new Error(`Failed to get template statistics: ${error.message}`);
    }
  }

  /**
   * Process template data before saving
   */
  static processTemplateData(templateData) {
    const processed = { ...templateData };
    
    // Generate IDs for fields if not provided
    if (processed.fields && Array.isArray(processed.fields)) {
      processed.fields = processed.fields.map(field => ({
        ...field,
        id: field.id || uuidv4()
      }));
    }
    
    // Generate IDs for validation rules if not provided
    if (processed.validationRules && Array.isArray(processed.validationRules)) {
      processed.validationRules = processed.validationRules.map(rule => ({
        ...rule,
        id: rule.id || uuidv4()
      }));
    }
    
    // Set default layout if not provided
    if (!processed.layout) {
      processed.layout = {
        sections: processed.fields ? [{
          id: 'main',
          title: 'Main Information',
          fields: processed.fields.map(field => ({
            fieldId: field.id,
            width: 'full'
          })),
          order: 0
        }] : [],
        theme: {
          primaryColor: '#3b82f6',
          secondaryColor: '#6b7280',
          backgroundColor: '#ffffff',
          textColor: '#1f2937'
        }
      };
    }
    
    return processed;
  }

  /**
   * Validate template structure
   */
  static validateTemplateStructure(templateData) {
    const errors = [];
    
    // Check required fields
    if (!templateData.name || templateData.name.trim().length === 0) {
      errors.push('Template name is required');
    }
    
    if (!templateData.description || templateData.description.trim().length === 0) {
      errors.push('Template description is required');
    }
    
    if (!templateData.templateSchema) {
      errors.push('Template schema is required');
    }
    
    // Validate fields
    if (templateData.fields && Array.isArray(templateData.fields)) {
      const fieldIds = templateData.fields.map(f => f.id);
      const duplicateFieldIds = fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index);
      if (duplicateFieldIds.length > 0) {
        errors.push(`Duplicate field IDs found: ${duplicateFieldIds.join(', ')}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = TemplateBuilderService;
