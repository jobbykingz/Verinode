import { Request, Response } from 'express';
import {
  RevocationService,
  RevocationConfig,
  RevocationRequest,
  BulkRevocationRequest,
} from '../services/revocation/RevocationService';
import { RevocationList, CRLConfig } from '../services/revocation/RevocationList';
import { ProofRevocation, RevocationReason } from '../models/ProofRevocation';
import { WinstonLogger } from '../utils/logger';

export class RevocationController {
  private revocationService: RevocationService;
  private logger: WinstonLogger;

  constructor() {
    const revocationConfig: RevocationConfig = {
      cacheEnabled: true,
      cacheTTL: 3600, // 1 hour
      batchSize: 100,
      notificationEnabled: true,
      auditEnabled: true,
      autoCleanup: true,
      cleanupInterval: 3600, // 1 hour
      maxRevocationsPerBatch: 1000,
      rateLimiting: {
        enabled: true,
        maxRevocationsPerMinute: 10,
        maxBulkRevocationsPerHour: 5,
      },
    };

    const crlConfig: CRLConfig = {
      maxEntries: 10000,
      retentionPeriod: 30, // 30 days
      compressionEnabled: true,
      signatureEnabled: false,
    };

    this.revocationService = new RevocationService(revocationConfig);
    this.logger = new WinstonLogger();
  }

  /**
   * Revoke a single proof
   */
  async revokeProof(req: Request, res: Response): Promise<void> {
    try {
      const { proofId, reason, description, evidence, notifyStakeholders } = req.body;
      const revokedBy = req.user?.id || 'anonymous';

      // Validate required fields
      if (!proofId || !reason || !description) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: proofId, reason, description',
        });
        return;
      }

      // Validate reason
      if (!Object.values(RevocationReason).includes(reason)) {
        res.status(400).json({
          success: false,
          error: 'Invalid revocation reason',
          validReasons: Object.values(RevocationReason),
        });
        return;
      }

      const request: RevocationRequest = {
        proofId,
        reason,
        description,
        revokedBy,
        revokedAt: new Date(),
        evidence: evidence || [],
        notifyStakeholders: notifyStakeholders || false,
      };

      const result = await this.revocationService.revokeProof(request);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: {
            revocationId: result.revocationId,
            proofId: result.proofId,
            message: 'Proof revoked successfully',
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      this.logger.error('Error in revokeProof controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Revoke multiple proofs in bulk
   */
  async bulkRevokeProofs(req: Request, res: Response): Promise<void> {
    try {
      const { proofIds, reason, description, notifyStakeholders } = req.body;
      const revokedBy = req.user?.id || 'anonymous';

      // Validate required fields
      if (!proofIds || !Array.isArray(proofIds) || proofIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'proofIds must be a non-empty array',
        });
        return;
      }

      if (!reason || !description) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: reason, description',
        });
        return;
      }

      // Validate reason
      if (!Object.values(RevocationReason).includes(reason)) {
        res.status(400).json({
          success: false,
          error: 'Invalid revocation reason',
          validReasons: Object.values(RevocationReason),
        });
        return;
      }

      const request: BulkRevocationRequest = {
        proofIds,
        reason,
        description,
        revokedBy,
        notifyStakeholders: notifyStakeholders || false,
      };

      const results = await this.revocationService.bulkRevokeProofs(request);

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      res.status(201).json({
        success: true,
        data: {
          totalProcessed: results.length,
          successCount,
          failureCount,
          results: results.map((r) => ({
            proofId: r.proofId,
            success: r.success,
            error: r.error,
          })),
          message: `Bulk revocation completed: ${successCount} successful, ${failureCount} failed`,
        },
      });
    } catch (error) {
      this.logger.error('Error in bulkRevokeProofs controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Check if a proof is revoked
   */
  async checkRevocationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { proofId } = req.params;

      if (!proofId) {
        res.status(400).json({
          success: false,
          error: 'proofId is required',
        });
        return;
      }

      const isRevoked = await this.revocationService.isProofRevoked(proofId);

      res.json({
        success: true,
        data: {
          proofId,
          isRevoked,
        },
      });
    } catch (error) {
      this.logger.error('Error in checkRevocationStatus controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get revocation details
   */
  async getRevocationDetails(req: Request, res: Response): Promise<void> {
    try {
      const { proofId } = req.params;

      if (!proofId) {
        res.status(400).json({
          success: false,
          error: 'proofId is required',
        });
        return;
      }

      const revocation = await this.revocationService.getRevocation(proofId);

      if (!revocation) {
        res.status(404).json({
          success: false,
          error: 'Revocation not found',
        });
        return;
      }

      res.json({
        success: true,
        data: revocation.toJSON(),
      });
    } catch (error) {
      this.logger.error('Error in getRevocationDetails controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get all active revocations
   */
  async getActiveRevocations(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt((req.query.limit as string) || '50') || 50;
      const offset = parseInt((req.query.offset as string) || '0') || 0;

      // Validate limits
      if (limit > 1000 || limit < 1) {
        res.status(400).json({
          success: false,
          error: 'Limit must be between 1 and 1000',
        });
        return;
      }

      const revocations = await this.revocationService.getActiveRevocations(limit, offset);

      res.json({
        success: true,
        data: {
          revocations: revocations.map((r) => r.toJSON()),
          pagination: {
            limit,
            offset,
            count: revocations.length,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error in getActiveRevocations controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get revocations by reason
   */
  async getRevocationsByReason(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.params;

      if (!reason || !Object.values(RevocationReason).includes(reason as RevocationReason)) {
        res.status(400).json({
          success: false,
          error: 'Invalid revocation reason',
          validReasons: Object.values(RevocationReason),
        });
        return;
      }

      const revocations = await this.revocationService.getRevocationsByReason(
        reason as RevocationReason,
      );

      res.json({
        success: true,
        data: {
          reason,
          revocations: revocations.map((r) => r.toJSON()),
          count: revocations.length,
        },
      });
    } catch (error) {
      this.logger.error('Error in getRevocationsByReason controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get revocation statistics
   */
  async getRevocationStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.revocationService.getRevocationStats();

      res.json({
        success: true,
        data: {
          totalRevocations: stats.totalRevocations,
          activeRevocations: stats.activeRevocations,
          revocationsByReason: Object.fromEntries(stats.revocationsByReason),
          revocationsByTimeRange: Object.fromEntries(stats.revocationsByTimeRange),
          averageProcessingTime: stats.averageProcessingTime,
          successRate: stats.successRate,
        },
      });
    } catch (error) {
      this.logger.error('Error in getRevocationStats controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Restore a revoked proof
   */
  async restoreRevocation(req: Request, res: Response): Promise<void> {
    try {
      const { proofId } = req.params;
      const { reason } = req.body;
      const restoredBy = req.user?.id || 'anonymous';

      if (!proofId) {
        res.status(400).json({
          success: false,
          error: 'proofId is required',
        });
        return;
      }

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Restoration reason is required',
        });
        return;
      }

      const success = await this.revocationService.restoreRevocation(proofId, restoredBy, reason);

      if (success) {
        res.json({
          success: true,
          data: {
            proofId,
            message: 'Revocation restored successfully',
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to restore revocation',
        });
      }
    } catch (error) {
      this.logger.error('Error in restoreRevocation controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Export Certificate Revocation List (CRL)
   */
  async exportCRL(req: Request, res: Response): Promise<void> {
    try {
      const { format = 'json' } = req.query;
      const formatStr = Array.isArray(format) ? format[0] : format;

      if (!['json', 'crl', 'csv'].includes(formatStr as string)) {
        res.status(400).json({
          success: false,
          error: 'Invalid format. Supported formats: json, crl, csv',
        });
        return;
      }

      const crlData = await this.revocationService.exportRevocationList(
        format as 'json' | 'crl' | 'csv',
      );

      // Set appropriate content type
      const contentTypes = {
        json: 'application/json',
        crl: 'application/pkix-crl',
        csv: 'text/csv',
      };

      res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
      res.setHeader('Content-Disposition', `attachment; filename="revocation-list.${format}"`);

      if (typeof crlData === 'string') {
        res.send(crlData);
      } else {
        res.send(crlData);
      }
    } catch (error) {
      this.logger.error('Error in exportCRL controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Import Certificate Revocation List (CRL)
   */
  async importCRL(req: Request, res: Response): Promise<void> {
    try {
      const { format = 'json' } = req.query;
      const formatStr = Array.isArray(format) ? format[0] : format;
      const data = req.body;

      if (!data) {
        res.status(400).json({
          success: false,
          error: 'Data is required',
        });
        return;
      }

      if (!['json', 'crl', 'csv'].includes(formatStr as string)) {
        res.status(400).json({
          success: false,
          error: 'Invalid format. Supported formats: json, crl, csv',
        });
        return;
      }

      const importedCount = await this.revocationService.importRevocationList(
        typeof data === 'string' ? data : JSON.stringify(data),
        format as 'json' | 'crl' | 'csv',
      );

      res.json({
        success: true,
        data: {
          importedCount,
          message: `Successfully imported ${importedCount} revocations`,
        },
      });
    } catch (error) {
      this.logger.error('Error in importCRL controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Auto-revoke expired proofs
   */
  async autoRevokeExpiredProofs(req: Request, res: Response): Promise<void> {
    try {
      const results = await this.revocationService.autoRevokeExpiredProofs();

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      res.json({
        success: true,
        data: {
          totalProcessed: results.length,
          successCount,
          failureCount,
          results: results.map((r) => ({
            proofId: r.proofId,
            success: r.success,
            error: r.error,
          })),
          message: `Auto-revocation completed: ${successCount} successful, ${failureCount} failed`,
        },
      });
    } catch (error) {
      this.logger.error('Error in autoRevokeExpiredProofs controller', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
