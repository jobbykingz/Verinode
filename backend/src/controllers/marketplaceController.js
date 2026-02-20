const { templateService } = require('../services/templateService');
const { paymentService } = require('../services/paymentService');
const AuditLogger = require('../compliance/auditLogger');

// Get all templates with filtering and pagination
const getTemplates = async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      minRating,
      tags,
      search,
      page,
      limit,
      sortBy,
      sortOrder
    } = req.query;

    const filters = {};
    const pagination = {};

    // Build filters
    if (category) filters.category = category;
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (minRating) filters.minRating = parseFloat(minRating);
    if (tags) filters.tags = tags.split(',');
    if (search) filters.search = search;

    // Build pagination
    if (page) pagination.page = parseInt(page);
    if (limit) pagination.limit = parseInt(limit);
    if (sortBy) pagination.sortBy = sortBy;
    if (sortOrder) pagination.sortOrder = sortOrder;

    const result = await templateService.getTemplates(filters, pagination);

    res.status(200).json({
      success: true,
      data: result.templates,
      pagination: {
        currentPage: pagination.page || 1,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasNext: pagination.page ? pagination.page < result.totalPages : false,
        hasPrev: pagination.page ? pagination.page > 1 : false
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch templates'
    });
  }
};

// Get template by ID
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await templateService.getTemplateById(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.status(200).json({
      success: true,
      data: template
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch template'
    });
  }
};

// Create new template
const createTemplate = async (req, res) => {
  try {
    // In a real implementation, get userId from authenticated user
    const userId = req.user?.id || 'mock-user-id';
    
    const templateData = req.body;
    
    const template = await templateService.createTemplate(templateData, userId);

    // Log compliance event for template creation
    await AuditLogger.logProofEvent(
      'TEMPLATE_CREATED',
      {
        id: template._id,
        name: template.name,
        category: template.category,
        price: template.price,
        sensitive: template.category === 'financial' || template.category === 'healthcare'
      },
      {
        id: userId,
        name: req.user?.name || 'Unknown User',
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent')
      },
      {
        purpose: 'marketplace_template_creation',
        templateTags: template.tags
      }
    );

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create template'
    });
  }
};

// Update template
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    // In a real implementation, get userId from authenticated user
    const userId = req.user?.id || 'mock-user-id';
    
    const updateData = req.body;
    
    const template = await templateService.updateTemplate(id, updateData, userId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.status(200).json({
      success: true,
      data: template,
      message: 'Template updated successfully'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update template'
    });
  }
};

// Delete template
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    // In a real implementation, get userId from authenticated user
    const userId = req.user?.id || 'mock-user-id';
    
    const deleted = await templateService.deleteTemplate(id, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Template not found or unauthorized'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete template'
    });
  }
};

// Rate template
const rateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    // In a real implementation, get userId from authenticated user
    const userId = req.user?.id || 'mock-user-id';
    
    const { rating, review } = req.body;
    
    const templateRating = await templateService.rateTemplate(id, userId, rating, review);

    res.status(201).json({
      success: true,
      data: templateRating,
      message: 'Template rated successfully'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to rate template'
    });
  }
};

// Get template ratings
const getTemplateRatings = async (req, res) => {
  try {
    const { id } = req.params;
    
    const ratings = await templateService.getTemplateRatings(id);

    res.status(200).json({
      success: true,
      data: ratings
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch template ratings'
    });
  }
};

// Purchase template
const purchaseTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    // In a real implementation, get userId from authenticated user
    const userId = req.user?.id || 'mock-user-id';
    
    const { paymentMethod, amount, transactionHash } = req.body;

    // Process payment
    const paymentResult = await paymentService.processTemplatePayment({
      templateId: id,
      userId,
      amount,
      paymentMethod,
      transactionHash
    });

    if (!paymentResult.success) {
      // Log failed payment attempt
      await AuditLogger.logAccessEvent(
        'PAYMENT_FAILED',
        {
          resourceId: id,
          resourceType: 'TEMPLATE',
          resourceName: 'Template Purchase',
          requestedActions: ['PURCHASE'],
          grantedActions: [],
          reason: 'payment_processing_failed'
        },
        {
          id: userId,
          name: req.user?.name || 'Unknown User',
          ipAddress: req.ip || req.connection?.remoteAddress
        },
        {
          status: 'FAILURE',
          error: paymentResult.message,
          amount: amount
        }
      );

      return res.status(400).json({
        success: false,
        message: paymentResult.message
      });
    }

    // Log successful payment and template access
    await AuditLogger.logAccessEvent(
      'TEMPLATE_PURCHASED',
      {
        resourceId: id,
        resourceType: 'TEMPLATE',
        resourceName: paymentResult.template.name,
        requestedActions: ['PURCHASE', 'ACCESS'],
        grantedActions: ['PURCHASE', 'ACCESS'],
        reason: 'template_purchase_completed'
      },
      {
        id: userId,
        name: req.user?.name || 'Unknown User',
        ipAddress: req.ip || req.connection?.remoteAddress
      },
      {
        amount: amount,
        transactionId: paymentResult.transactionId,
        paymentMethod: paymentMethod
      }
    );

    res.status(200).json({
      success: true,
      data: {
        transactionId: paymentResult.transactionId,
        template: paymentResult.template
      },
      message: 'Template purchased successfully'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to purchase template'
    });
  }
};

// Get user's templates
const getUserTemplates = async (req, res) => {
  try {
    // In a real implementation, get userId from authenticated user
    const userId = req.user?.id || 'mock-user-id';
    
    const templates = await templateService.getUserTemplates(userId);

    res.status(200).json({
      success: true,
      data: templates
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch user templates'
    });
  }
};

// Search templates
const searchTemplates = async (req, res) => {
  try {
    const { q, category, tags } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const filters = {
      search: q
    };

    if (category) filters.category = category;
    if (tags) filters.tags = tags.split(',');

    const result = await templateService.getTemplates(filters);

    res.status(200).json({
      success: true,
      data: result.templates,
      totalCount: result.totalCount
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to search templates'
    });
  }
};

// Get template categories
const getTemplateCategories = async (req, res) => {
  try {
    // Return predefined categories
    const categories = [
      { id: 'identity', name: 'Identity Verification', description: 'Templates for identity and KYC verification' },
      { id: 'credential', name: 'Credentials', description: 'Academic and professional credential templates' },
      { id: 'document', name: 'Document Verification', description: 'Document authenticity and verification templates' },
      { id: 'transaction', name: 'Transaction Proofs', description: 'Financial transaction verification templates' },
      { id: 'custom', name: 'Custom Templates', description: 'Specialized and custom verification templates' }
    ];

    res.status(200).json({
      success: true,
      data: categories
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch categories'
    });
  }
};

// Get marketplace statistics
const getMarketplaceStats = async (req, res) => {
  try {
    // In a real implementation, these would be calculated from the database
    const stats = {
      totalTemplates: 156,
      totalPurchases: 342,
      averageRating: 4.2,
      totalCreators: 89,
      featuredTemplates: 12,
      newTemplatesThisWeek: 23
    };

    const paymentStats = await paymentService.getPaymentStats();

    res.status(200).json({
      success: true,
      data: {
        ...stats,
        ...paymentStats
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch marketplace stats'
    });
  }
};

module.exports = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  rateTemplate,
  getTemplateRatings,
  purchaseTemplate,
  getUserTemplates,
  searchTemplates,
  getTemplateCategories,
  getMarketplaceStats
};