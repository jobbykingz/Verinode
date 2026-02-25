import { Request, Response, NextFunction } from 'express';
import { proofService } from '../services/proofService';
import { ApiResponse } from '../utils/apiResponse';
import { validationResult } from 'express-validator';
import { logger } from '../utils/logger';

/**
 * Proof Controller - Handles all proof-related HTTP requests
 */
export class ProofController {
  /**
   * Create a new proof
   * POST /api/proofs
   */
  static async createProof(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.validationError(res, errors.array());
      }

      const { 
        title, 
        description, 
        proofType, 
        metadata, 
        eventData,
        recipientAddress,
        tags 
      } = req.body;

      const userId = req.user?.id;
      if (!userId) {
        return ApiResponse.unauthorized(res, 'User authentication required');
      }

      const proof = await proofService.createProof({
        title,
        description,
        proofType,
        metadata: metadata || {},
        eventData: eventData || {},
        recipientAddress,
        tags: tags || [],
        createdBy: userId
      });

      logger.info(`Proof created: ${proof.id} by user ${userId}`);
      ApiResponse.success(res, proof, 'Proof created successfully', 201);

    } catch (error) {
      logger.error('Error creating proof:', error);
      next(error);
    }
  }

  /**
   * Verify a proof
   * POST /api/proofs/:id/verify
   */
  static async verifyProof(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { verificationMethod, additionalData } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.validationError(res, errors.array());
      }

      const userId = req.user?.id;
      if (!userId) {
        return ApiResponse.unauthorized(res, 'User authentication required');
      }

      const verificationResult = await proofService.verifyProof(id, {
        verifiedBy: userId,
        verificationMethod,
        additionalData: additionalData || {}
      });

      logger.info(`Proof verification attempted: ${id} by user ${userId}`);
      ApiResponse.success(res, verificationResult, 'Proof verification completed');

    } catch (error) {
      logger.error('Error verifying proof:', error);
      next(error);
    }
  }

  /**
   * Get user's proofs
   * GET /api/proofs/user
   */
  static async getUserProofs(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return ApiResponse.unauthorized(res, 'User authentication required');
      }

      const {
        page = 1,
        limit = 10,
        status,
        proofType,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search
      } = req.query;

      const filters = {
        status: status as string,
        proofType: proofType as string,
        search: search as string
      };

      const pagination = {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const sorting = {
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const result = await proofService.getUserProofs(userId, filters, pagination, sorting);

      ApiResponse.success(res, result, 'User proofs retrieved successfully');

    } catch (error) {
      logger.error('Error getting user proofs:', error);
      next(error);
    }
  }

  /**
   * Get proof by ID
   * GET /api/proofs/:id
   */
  static async getProofById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const proof = await proofService.getProofById(id, userId);

      if (!proof) {
        return ApiResponse.notFound(res, 'Proof not found');
      }

      ApiResponse.success(res, proof, 'Proof retrieved successfully');

    } catch (error) {
      logger.error('Error getting proof by ID:', error);
      next(error);
    }
  }

  /**
   * Update proof
   * PUT /api/proofs/:id
   */
  static async updateProof(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return ApiResponse.unauthorized(res, 'User authentication required');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.validationError(res, errors.array());
      }

      const updateData = req.body;
      const updatedProof = await proofService.updateProof(id, userId, updateData);

      if (!updatedProof) {
        return ApiResponse.notFound(res, 'Proof not found or access denied');
      }

      logger.info(`Proof updated: ${id} by user ${userId}`);
      ApiResponse.success(res, updatedProof, 'Proof updated successfully');

    } catch (error) {
      logger.error('Error updating proof:', error);
      next(error);
    }
  }

  /**
   * Delete proof
   * DELETE /api/proofs/:id
   */
  static async deleteProof(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return ApiResponse.unauthorized(res, 'User authentication required');
      }

      const deleted = await proofService.deleteProof(id, userId);

      if (!deleted) {
        return ApiResponse.notFound(res, 'Proof not found or access denied');
      }

      logger.info(`Proof deleted: ${id} by user ${userId}`);
      ApiResponse.success(res, null, 'Proof deleted successfully');

    } catch (error) {
      logger.error('Error deleting proof:', error);
      next(error);
    }
  }

  /**
   * Batch proof operations
   * POST /api/proofs/batch
   */
  static async batchOperations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return ApiResponse.unauthorized(res, 'User authentication required');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.validationError(res, errors.array());
      }

      const { operations } = req.body;

      if (!Array.isArray(operations) || operations.length === 0) {
        return ApiResponse.badRequest(res, 'Operations array is required');
      }

      if (operations.length > 100) {
        return ApiResponse.badRequest(res, 'Maximum 100 operations allowed per batch');
      }

      const result = await proofService.batchOperations(operations, userId);

      logger.info(`Batch operations completed: ${operations.length} operations by user ${userId}`);
      ApiResponse.success(res, result, 'Batch operations completed successfully');

    } catch (error) {
      logger.error('Error in batch operations:', error);
      next(error);
    }
  }

  /**
   * Get proof statistics
   * GET /api/proofs/stats
   */
  static async getProofStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return ApiResponse.unauthorized(res, 'User authentication required');
      }

      const { timeRange = '30d' } = req.query;

      const stats = await proofService.getProofStats(userId, timeRange as string);

      ApiResponse.success(res, stats, 'Proof statistics retrieved successfully');

    } catch (error) {
      logger.error('Error getting proof stats:', error);
      next(error);
    }
  }

  /**
   * Search proofs
   * GET /api/proofs/search
   */
  static async searchProofs(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        q,
        page = 1,
        limit = 10,
        proofType,
        status,
        tags,
        dateFrom,
        dateTo,
        sortBy = 'relevance',
        sortOrder = 'desc'
      } = req.query;

      if (!q) {
        return ApiResponse.badRequest(res, 'Search query is required');
      }

      const searchFilters = {
        query: q as string,
        proofType: proofType as string,
        status: status as string,
        tags: tags ? (tags as string).split(',') : undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined
      };

      const pagination = {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const sorting = {
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const result = await proofService.searchProofs(searchFilters, pagination, sorting);

      ApiResponse.success(res, result, 'Search results retrieved successfully');

    } catch (error) {
      logger.error('Error searching proofs:', error);
      next(error);
    }
  }

  /**
   * Export proofs
   * GET /api/proofs/export
   */
  static async exportProofs(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return ApiResponse.unauthorized(res, 'User authentication required');
      }

      const {
        format = 'json',
        proofType,
        status,
        dateFrom,
        dateTo
      } = req.query;

      const filters = {
        proofType: proofType as string,
        status: status as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined
      };

      const exportData = await proofService.exportProofs(userId, filters, format as string);

      // Set appropriate headers for file download
      const filename = `proofs_export_${new Date().toISOString().split('T')[0]}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
      } else {
        res.setHeader('Content-Type', 'application/json');
      }

      res.send(exportData);

    } catch (error) {
      logger.error('Error exporting proofs:', error);
      next(error);
    }
  }

  /**
   * Get proof history/audit trail
   * GET /api/proofs/:id/history
   */
  static async getProofHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return ApiResponse.unauthorized(res, 'User authentication required');
      }

      const history = await proofService.getProofHistory(id, userId);

      ApiResponse.success(res, history, 'Proof history retrieved successfully');

    } catch (error) {
      logger.error('Error getting proof history:', error);
      next(error);
    }
  }

  /**
   * Share proof
   * POST /api/proofs/:id/share
   */
  static async shareProof(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { recipientEmail, permissions, message } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return ApiResponse.unauthorized(res, 'User authentication required');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.validationError(res, errors.array());
      }

      const shareResult = await proofService.shareProof(id, userId, {
        recipientEmail,
        permissions: permissions || ['view'],
        message
      });

      logger.info(`Proof shared: ${id} by user ${userId} to ${recipientEmail}`);
      ApiResponse.success(res, shareResult, 'Proof shared successfully');

    } catch (error) {
      logger.error('Error sharing proof:', error);
      next(error);
    }
  }
}

export default ProofController;
