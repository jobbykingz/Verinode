import { EventEmitter } from 'events';
import { RevocationList } from './RevocationList';
import { ProofRevocation, RevocationReason, RevocationStatus } from '../../models/ProofRevocation';
import { WinstonLogger } from '../../utils/logger';

// Stub services for now - would be implemented separately
class NotificationService {
  async sendNotification(notification: any): Promise<void> {
    // Stub implementation
  }
}

class AuditService {
  async logRevocation(revocation: ProofRevocation): Promise<void> {
    // Stub implementation
  }

  async logBulkRevocation(bulkId: string, request: any, results: any[]): Promise<void> {
    // Stub implementation
  }

  async logRevocationRestoration(revocation: ProofRevocation): Promise<void> {
    // Stub implementation
  }
}

class VerificationService {
  async invalidateProof(proofId: string): Promise<void> {
    // Stub implementation
  }

  async restoreProof(proofId: string): Promise<void> {
    // Stub implementation
  }

  async getExpiredProofs(): Promise<any[]> {
    // Stub implementation
    return [];
  }

  async proofExists(proofId: string): Promise<boolean> {
    // Stub implementation
    return true;
  }

  async getProofStakeholders(proofId: string): Promise<string[]> {
    // Stub implementation
    return [];
  }
}

class CacheService {
  async set(key: string, value: any, ttl: number): Promise<void> {
    // Stub implementation
  }

  async get(key: string): Promise<any> {
    // Stub implementation
    return null;
  }

  async delete(key: string): Promise<void> {
    // Stub implementation
  }

  async clearByPattern(pattern: string): Promise<void> {
    // Stub implementation
  }
}

export interface RevocationConfig {
  cacheEnabled: boolean;
  cacheTTL: number; // in seconds
  batchSize: number;
  notificationEnabled: boolean;
  auditEnabled: boolean;
  autoCleanup: boolean;
  cleanupInterval: number; // in seconds
  maxRevocationsPerBatch: number;
  rateLimiting: {
    enabled: boolean;
    maxRevocationsPerMinute: number;
    maxBulkRevocationsPerHour: number;
  };
}

export interface RevocationRequest {
  proofId: string;
  reason: RevocationReason;
  description: string;
  revokedBy: string;
  revokedAt: Date;
  evidence?: string[];
  notifyStakeholders?: boolean;
  bulkId?: string;
}

export interface BulkRevocationRequest {
  proofIds: string[];
  reason: RevocationReason;
  description: string;
  revokedBy: string;
  notifyStakeholders?: boolean;
}

export interface RevocationResult {
  success: boolean;
  revocationId?: string;
  error?: string;
  proofId?: string;
}

export interface RevocationStats {
  totalRevocations: number;
  activeRevocations: number;
  revocationsByReason: Map<RevocationReason, number>;
  revocationsByTimeRange: Map<string, number>;
  averageProcessingTime: number;
  successRate: number;
}

export class RevocationService extends EventEmitter {
  private revocationList: RevocationList;
  private notificationService: NotificationService;
  private auditService: AuditService;
  private verificationService: VerificationService;
  private cacheService: CacheService;
  private logger: WinstonLogger;
  private config: RevocationConfig;
  private rateLimitMap: Map<string, { count: number; resetTime: number }>;

  constructor(config: RevocationConfig) {
    super();
    this.config = config;
    this.revocationList = new RevocationList();
    this.notificationService = new NotificationService();
    this.auditService = new AuditService();
    this.verificationService = new VerificationService();
    this.cacheService = new CacheService();
    this.logger = new WinstonLogger();
    this.rateLimitMap = new Map();

    this.initializeCleanup();
  }

  /**
   * Revoke a single proof
   */
  async revokeProof(request: RevocationRequest): Promise<RevocationResult> {
    try {
      // Rate limiting check
      if (this.config.rateLimiting.enabled) {
        if (!this.checkRateLimit(request.revokedBy, 'single')) {
          return {
            success: false,
            error: 'Rate limit exceeded for single revocations',
            proofId: request.proofId,
          };
        }
      }

      // Validate the request
      const validationError = await this.validateRevocationRequest(request);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          proofId: request.proofId,
        };
      }

      // Check if proof is already revoked
      const existingRevocation = await this.revocationList.getRevocation(request.proofId);
      if (existingRevocation) {
        return {
          success: false,
          error: 'Proof is already revoked',
          proofId: request.proofId,
        };
      }

      // Create revocation record
      const revocation = new ProofRevocation({
        proofId: request.proofId,
        reason: request.reason,
        description: request.description,
        revokedBy: request.revokedBy,
        revokedAt: request.revokedAt,
        evidence: request.evidence || [],
        status: RevocationStatus.ACTIVE,
        bulkId: request.bulkId,
      });

      // Add to revocation list
      await this.revocationList.addRevocation(revocation);

      // Update cache
      if (this.config.cacheEnabled) {
        await this.cacheService.set(
          `revocation:${request.proofId}`,
          revocation,
          this.config.cacheTTL,
        );
      }

      // Update verification service
      await this.verificationService.invalidateProof(request.proofId);

      // Send notifications
      if (this.config.notificationEnabled && request.notifyStakeholders) {
        await this.sendRevocationNotifications(revocation);
      }

      // Log audit event
      if (this.config.auditEnabled) {
        await this.auditService.logRevocation(revocation);
      }

      // Emit event
      this.emit('proofRevoked', revocation);

      this.logger.info(`Proof revoked successfully: ${request.proofId}`, {
        reason: request.reason,
        revokedBy: request.revokedBy,
      });

      return {
        success: true,
        revocationId: revocation.id,
        proofId: request.proofId,
      };
    } catch (error) {
      this.logger.error('Error revoking proof', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        proofId: request.proofId,
      };
    }
  }

  /**
   * Revoke multiple proofs in bulk
   */
  async bulkRevokeProofs(request: BulkRevocationRequest): Promise<RevocationResult[]> {
    try {
      // Rate limiting check
      if (this.config.rateLimiting.enabled) {
        if (!this.checkRateLimit(request.revokedBy, 'bulk')) {
          return [
            {
              success: false,
              error: 'Rate limit exceeded for bulk revocations',
            },
          ];
        }
      }

      const results: RevocationResult[] = [];
      const bulkId = this.generateBulkId();
      const batchSize = Math.min(request.proofIds.length, this.config.maxRevocationsPerBatch);

      // Process in batches
      for (let i = 0; i < request.proofIds.length; i += batchSize) {
        const batch = request.proofIds.slice(i, i + batchSize);
        const batchPromises = batch.map((proofId) =>
          this.revokeProof({
            proofId,
            reason: request.reason,
            description: request.description,
            revokedBy: request.revokedBy,
            revokedAt: new Date(),
            notifyStakeholders: request.notifyStakeholders,
            bulkId,
          }),
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Small delay between batches to prevent overwhelming
        if (i + batchSize < request.proofIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Log bulk operation
      if (this.config.auditEnabled) {
        await this.auditService.logBulkRevocation(bulkId, request, results);
      }

      this.logger.info(`Bulk revocation completed`, {
        bulkId,
        totalProofs: request.proofIds.length,
        successCount: results.filter((r) => r.success).length,
      });

      return results;
    } catch (error) {
      this.logger.error('Error in bulk revocation', error);
      return [
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      ];
    }
  }

  /**
   * Check if a proof is revoked
   */
  async isProofRevoked(proofId: string): Promise<boolean> {
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = await this.cacheService.get(`revocation:${proofId}`);
        if (cached !== null) {
          return cached !== 'null';
        }
      }

      // Check revocation list
      const revocation = await this.revocationList.getRevocation(proofId);
      const isRevoked = revocation !== null;

      // Update cache
      if (this.config.cacheEnabled) {
        await this.cacheService.set(
          `revocation:${proofId}`,
          revocation || 'null',
          this.config.cacheTTL,
        );
      }

      return isRevoked;
    } catch (error) {
      this.logger.error('Error checking revocation status', error);
      return false;
    }
  }

  /**
   * Get revocation details
   */
  async getRevocation(proofId: string): Promise<ProofRevocation | null> {
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = await this.cacheService.get(`revocation:${proofId}`);
        if (cached && cached !== 'null') {
          return JSON.parse(cached);
        }
      }

      const revocation = await this.revocationList.getRevocation(proofId);

      // Update cache
      if (this.config.cacheEnabled && revocation) {
        await this.cacheService.set(
          `revocation:${proofId}`,
          JSON.stringify(revocation),
          this.config.cacheTTL,
        );
      }

      return revocation;
    } catch (error) {
      this.logger.error('Error getting revocation details', error);
      return null;
    }
  }

  /**
   * Get all active revocations
   */
  async getActiveRevocations(limit?: number, offset?: number): Promise<ProofRevocation[]> {
    try {
      return await this.revocationList.getActiveRevocations(limit, offset);
    } catch (error) {
      this.logger.error('Error getting active revocations', error);
      return [];
    }
  }

  /**
   * Get revocations by reason
   */
  async getRevocationsByReason(reason: RevocationReason): Promise<ProofRevocation[]> {
    try {
      return await this.revocationList.getRevocationsByReason(reason);
    } catch (error) {
      this.logger.error('Error getting revocations by reason', error);
      return [];
    }
  }

  /**
   * Get revocations by date range
   */
  async getRevocationsByDateRange(startDate: Date, endDate: Date): Promise<ProofRevocation[]> {
    try {
      return await this.revocationList.getRevocationsByDateRange(startDate, endDate);
    } catch (error) {
      this.logger.error('Error getting revocations by date range', error);
      return [];
    }
  }

  /**
   * Get revocation statistics
   */
  async getRevocationStats(): Promise<RevocationStats> {
    try {
      const totalRevocations = await this.revocationList.getTotalRevocations();
      const activeRevocations = await this.revocationList.getActiveRevocationsCount();
      const revocationsByReason = await this.revocationList.getRevocationsByReasonCount();
      const revocationsByTimeRange = await this.revocationList.getRevocationsByTimeRange();
      const averageProcessingTime = await this.revocationList.getAverageProcessingTime();
      const successRate = await this.revocationList.getSuccessRate();

      return {
        totalRevocations,
        activeRevocations,
        revocationsByReason,
        revocationsByTimeRange,
        averageProcessingTime,
        successRate,
      };
    } catch (error) {
      this.logger.error('Error getting revocation stats', error);
      return {
        totalRevocations: 0,
        activeRevocations: 0,
        revocationsByReason: new Map(),
        revocationsByTimeRange: new Map(),
        averageProcessingTime: 0,
        successRate: 0,
      };
    }
  }

  /**
   * Automatically revoke expired proofs
   */
  async autoRevokeExpiredProofs(): Promise<RevocationResult[]> {
    try {
      const expiredProofs = await this.verificationService.getExpiredProofs();
      const results: RevocationResult[] = [];

      for (const proof of expiredProofs) {
        const result = await this.revokeProof({
          proofId: proof.id,
          reason: RevocationReason.EXPIRED,
          description: 'Proof automatically revoked due to expiration',
          revokedBy: 'system',
          revokedAt: new Date(),
          notifyStakeholders: true,
        });
        results.push(result);
      }

      this.logger.info(`Auto-revoked ${expiredProofs.length} expired proofs`, {
        successCount: results.filter((r) => r.success).length,
      });

      return results;
    } catch (error) {
      this.logger.error('Error auto-revoking expired proofs', error);
      return [];
    }
  }

  /**
   * Restore a revoked proof (admin only)
   */
  async restoreRevocation(proofId: string, restoredBy: string, reason: string): Promise<boolean> {
    try {
      const revocation = await this.revocationList.getRevocation(proofId);
      if (!revocation) {
        return false;
      }

      // Update revocation status
      revocation.status = RevocationStatus.RESTORED;
      revocation.restoredAt = new Date();
      revocation.restoredBy = restoredBy;
      revocation.restoreReason = reason;

      await this.revocationList.updateRevocation(revocation);

      // Update cache
      if (this.config.cacheEnabled) {
        await this.cacheService.delete(`revocation:${proofId}`);
      }

      // Restore proof in verification service
      await this.verificationService.restoreProof(proofId);

      // Log audit event
      if (this.config.auditEnabled) {
        await this.auditService.logRevocationRestoration(revocation);
      }

      // Emit event
      this.emit('revocationRestored', revocation);

      this.logger.info(`Revocation restored: ${proofId}`, {
        restoredBy,
        reason,
      });

      return true;
    } catch (error) {
      this.logger.error('Error restoring revocation', error);
      return false;
    }
  }

  /**
   * Export revocation list (CRL format)
   */
  async exportRevocationList(format: 'json' | 'crl' | 'csv' = 'json'): Promise<string> {
    try {
      const activeRevocations = await this.revocationList.getActiveRevocations();

      switch (format) {
        case 'json':
          return JSON.stringify(activeRevocations, null, 2);

        case 'crl':
          return this.generateCRLFormat(activeRevocations);

        case 'csv':
          return this.generateCSVFormat(activeRevocations);

        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      this.logger.error('Error exporting revocation list', error);
      throw error;
    }
  }

  /**
   * Import revocation list
   */
  async importRevocationList(
    data: string,
    format: 'json' | 'crl' | 'csv' = 'json',
  ): Promise<number> {
    try {
      let revocations: any[];

      switch (format) {
        case 'json':
          revocations = JSON.parse(data);
          break;

        case 'crl':
          revocations = this.parseCRLFormat(data);
          break;

        case 'csv':
          revocations = this.parseCSVFormat(data);
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      let importedCount = 0;
      for (const revData of revocations) {
        try {
          const revocation = new ProofRevocation(revData);
          await this.revocationList.addRevocation(revocation);
          importedCount++;
        } catch (error) {
          this.logger.warn(`Failed to import revocation: ${revData.proofId}`, error);
        }
      }

      this.logger.info(`Imported ${importedCount} revocations`);
      return importedCount;
    } catch (error) {
      this.logger.error('Error importing revocation list', error);
      throw error;
    }
  }

  /**
   * Clear expired revocations from cache
   */
  async clearExpiredCache(): Promise<void> {
    if (!this.config.cacheEnabled) return;

    try {
      // This would depend on the cache implementation
      // For now, we'll clear all revocation cache entries
      // In a real implementation, you'd iterate through keys and check TTL
      await this.cacheService.clearByPattern('revocation:*');

      this.logger.debug('Cleared expired revocation cache entries');
    } catch (error) {
      this.logger.error('Error clearing expired cache', error);
    }
  }

  // Private helper methods

  private async validateRevocationRequest(request: RevocationRequest): Promise<string | null> {
    // Validate proof ID
    if (!request.proofId || request.proofId.trim() === '') {
      return 'Proof ID is required';
    }

    // Validate reason
    if (!Object.values(RevocationReason).includes(request.reason)) {
      return 'Invalid revocation reason';
    }

    // Validate description
    if (!request.description || request.description.trim() === '') {
      return 'Description is required';
    }

    // Validate revoked by
    if (!request.revokedBy || request.revokedBy.trim() === '') {
      return 'Revoked by is required';
    }

    // Check if proof exists
    try {
      const proofExists = await this.verificationService.proofExists(request.proofId);
      if (!proofExists) {
        return 'Proof does not exist';
      }
    } catch (error) {
      return 'Failed to verify proof existence';
    }

    return null;
  }

  private checkRateLimit(userId: string, type: 'single' | 'bulk'): boolean {
    const now = Date.now();
    const key = `${userId}:${type}`;
    const current = this.rateLimitMap.get(key);

    if (!current) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + 60000, // 1 minute
      });
      return true;
    }

    if (now > current.resetTime) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + 60000,
      });
      return true;
    }

    const maxRequests =
      type === 'single'
        ? this.config.rateLimiting.maxRevocationsPerMinute
        : this.config.rateLimiting.maxBulkRevocationsPerHour;

    if (current.count >= maxRequests) {
      return false;
    }

    current.count++;
    return true;
  }

  private async sendRevocationNotifications(revocation: ProofRevocation): Promise<void> {
    try {
      // Get proof stakeholders
      const stakeholders = await this.verificationService.getProofStakeholders(revocation.proofId);

      for (const stakeholder of stakeholders) {
        await this.notificationService.sendNotification({
          type: 'proof_revoked',
          recipient: stakeholder,
          data: {
            proofId: revocation.proofId,
            reason: revocation.reason,
            description: revocation.description,
            revokedAt: revocation.revokedAt,
          },
        });
      }
    } catch (error) {
      this.logger.error('Error sending revocation notifications', error);
    }
  }

  private generateBulkId(): string {
    return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCRLFormat(revocations: ProofRevocation[]): string {
    const crlEntries = revocations.map((r) => ({
      serialNumber: r.proofId,
      revocationDate: r.revokedAt.toISOString(),
      reason: r.reason,
    }));

    return JSON.stringify(
      {
        version: '1.0',
        signatureAlgorithm: 'SHA256withRSA',
        thisUpdate: new Date().toISOString(),
        nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        revokedCertificates: crlEntries,
      },
      null,
      2,
    );
  }

  private generateCSVFormat(revocations: ProofRevocation[]): string {
    const headers = ['Proof ID', 'Reason', 'Description', 'Revoked By', 'Revoked At', 'Status'];
    const rows = revocations.map((r) => [
      r.proofId,
      r.reason,
      r.description,
      r.revokedBy,
      r.revokedAt.toISOString(),
      r.status,
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  private parseCRLFormat(data: string): any[] {
    const crl = JSON.parse(data);
    return crl.revokedCertificates.map((entry: any) => ({
      proofId: entry.serialNumber,
      reason: entry.reason,
      revokedAt: new Date(entry.revocationDate),
      status: RevocationStatus.ACTIVE,
    }));
  }

  private parseCSVFormat(data: string): any[] {
    const lines = data.split('\n');
    const headers = lines[0].split(',');

    return lines
      .slice(1)
      .map((line) => {
        const values = line.split(',');
        return {
          proofId: values[0],
          reason: values[1],
          description: values[2],
          revokedBy: values[3],
          revokedAt: new Date(values[4]),
          status: values[5] as RevocationStatus,
        };
      })
      .filter((item) => item.proofId);
  }

  private initializeCleanup(): void {
    if (!this.config.autoCleanup) return;

    setInterval(async () => {
      try {
        await this.clearExpiredCache();
        await this.autoRevokeExpiredProofs();
      } catch (error) {
        this.logger.error('Error in cleanup process', error);
      }
    }, this.config.cleanupInterval * 1000);
  }
}
