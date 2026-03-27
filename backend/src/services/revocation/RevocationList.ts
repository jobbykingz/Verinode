import { ProofRevocation, RevocationReason, RevocationStatus } from '../../models/ProofRevocation';
import { WinstonLogger } from '../../utils/logger';

// Stub DatabaseService for now - would be implemented separately
class DatabaseService {
  async query(sql: string, params?: any[]): Promise<any[]> {
    // Stub implementation
    return [];
  }
}

export interface CRLConfig {
  maxEntries: number;
  retentionPeriod: number; // in days
  compressionEnabled: boolean;
  signatureEnabled: boolean;
  publicKey?: string;
  privateKey?: string;
}

export interface CRLMetadata {
  version: string;
  thisUpdate: Date;
  nextUpdate: Date;
  signatureAlgorithm: string;
  totalEntries: number;
  fingerprint: string;
}

export interface CRLExport {
  metadata: CRLMetadata;
  revocations: ProofRevocation[];
  signature?: string;
}

export interface RevocationFilter {
  reason?: RevocationReason;
  status?: RevocationStatus;
  startDate?: Date;
  endDate?: Date;
  revokedBy?: string;
  bulkId?: string;
}

export interface RevocationStats {
  totalRevocations: number;
  activeRevocations: number;
  expiredRevocations: number;
  restoredRevocations: number;
  revocationsByReason: Map<RevocationReason, number>;
  revocationsByDay: Map<string, number>;
  averageRetentionTime: number;
}

export class RevocationList {
  private db: DatabaseService;
  private logger: WinstonLogger;
  private config: CRLConfig;

  constructor(config: CRLConfig) {
    this.config = config;
    this.db = new DatabaseService();
    this.logger = new WinstonLogger();
    this.initializeDatabase();
  }

  /**
   * Initialize database tables for revocation list
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS proof_revocations (
          id VARCHAR(36) PRIMARY KEY,
          proof_id VARCHAR(255) NOT NULL UNIQUE,
          reason ENUM('COMPROMISED', 'EXPIRED', 'FRAUDULENT', 'INVALIDATED', 'SUPERSEDED', 'WITHDRAWN') NOT NULL,
          description TEXT NOT NULL,
          revoked_by VARCHAR(255) NOT NULL,
          revoked_at TIMESTAMP NOT NULL,
          status ENUM('ACTIVE', 'EXPIRED', 'RESTORED') DEFAULT 'ACTIVE',
          evidence JSON,
          bulk_id VARCHAR(255),
          restored_at TIMESTAMP NULL,
          restored_by VARCHAR(255) NULL,
          restore_reason TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_proof_id (proof_id),
          INDEX idx_status (status),
          INDEX idx_reason (reason),
          INDEX idx_revoked_at (revoked_at),
          INDEX idx_bulk_id (bulk_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await this.db.query(`
        CREATE TABLE IF NOT EXISTS crl_cache (
          id INT AUTO_INCREMENT PRIMARY KEY,
          crl_data JSON NOT NULL,
          signature VARCHAR(2048) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          INDEX idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      this.logger.info('Revocation list database initialized');
    } catch (error) {
      this.logger.error('Error initializing revocation list database', error);
      throw error;
    }
  }

  /**
   * Add a revocation to the list
   */
  async addRevocation(revocation: ProofRevocation): Promise<void> {
    try {
      await this.db.query(
        `
        INSERT INTO proof_revocations (
          id, proof_id, reason, description, revoked_by, 
          revoked_at, status, evidence, bulk_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          revocation.id,
          revocation.proofId,
          revocation.reason,
          revocation.description,
          revocation.revokedBy,
          revocation.revokedAt,
          revocation.status,
          JSON.stringify(revocation.evidence || []),
          revocation.bulkId || null,
        ],
      );

      // Invalidate CRL cache
      await this.invalidateCRLCache();

      this.logger.info(`Revocation added to list: ${revocation.proofId}`, {
        reason: revocation.reason,
        revokedBy: revocation.revokedBy,
      });
    } catch (error) {
      this.logger.error('Error adding revocation to list', error);
      throw error;
    }
  }

  /**
   * Update a revocation in the list
   */
  async updateRevocation(revocation: ProofRevocation): Promise<void> {
    try {
      await this.db.query(
        `
        UPDATE proof_revocations SET
          reason = ?, description = ?, status = ?, 
          restored_at = ?, restored_by = ?, restore_reason = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE proof_id = ?
      `,
        [
          revocation.reason,
          revocation.description,
          revocation.status,
          revocation.restoredAt || null,
          revocation.restoredBy || null,
          revocation.restoreReason || null,
          revocation.proofId,
        ],
      );

      // Invalidate CRL cache
      await this.invalidateCRLCache();

      this.logger.info(`Revocation updated: ${revocation.proofId}`, {
        status: revocation.status,
      });
    } catch (error) {
      this.logger.error('Error updating revocation in list', error);
      throw error;
    }
  }

  /**
   * Get a revocation by proof ID
   */
  async getRevocation(proofId: string): Promise<ProofRevocation | null> {
    try {
      const rows = await this.db.query(
        `
        SELECT * FROM proof_revocations WHERE proof_id = ?
      `,
        [proofId],
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return new ProofRevocation({
        id: row.id,
        proofId: row.proof_id,
        reason: row.reason as RevocationReason,
        description: row.description,
        revokedBy: row.revoked_by,
        revokedAt: new Date(row.revoked_at),
        status: row.status as RevocationStatus,
        evidence: row.evidence ? JSON.parse(row.evidence) : [],
        bulkId: row.bulk_id,
        restoredAt: row.restored_at ? new Date(row.restored_at) : undefined,
        restoredBy: row.restored_by || undefined,
        restoreReason: row.restore_reason || undefined,
      });
    } catch (error) {
      this.logger.error('Error getting revocation from list', error);
      return null;
    }
  }

  /**
   * Get all active revocations
   */
  async getActiveRevocations(limit?: number, offset?: number): Promise<ProofRevocation[]> {
    try {
      let query = `
        SELECT * FROM proof_revocations 
        WHERE status = 'ACTIVE' 
        ORDER BY revoked_at DESC
      `;

      const params: any[] = [];

      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }

      if (offset) {
        query += ' OFFSET ?';
        params.push(offset);
      }

      const rows = await this.db.query(query, params);
      return rows.map(this.mapRowToRevocation);
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
      const rows = await this.db.query(
        `
        SELECT * FROM proof_revocations 
        WHERE reason = ? 
        ORDER BY revoked_at DESC
      `,
        [reason],
      );

      return rows.map(this.mapRowToRevocation);
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
      const rows = await this.db.query(
        `
        SELECT * FROM proof_revocations 
        WHERE revoked_at BETWEEN ? AND ?
        ORDER BY revoked_at DESC
      `,
        [startDate, endDate],
      );

      return rows.map(this.mapRowToRevocation);
    } catch (error) {
      this.logger.error('Error getting revocations by date range', error);
      return [];
    }
  }

  /**
   * Get revocations by filter
   */
  async getRevocationsByFilter(
    filter: RevocationFilter,
    limit?: number,
    offset?: number,
  ): Promise<ProofRevocation[]> {
    try {
      let query = 'SELECT * FROM proof_revocations WHERE 1=1';
      const params: any[] = [];

      if (filter.reason) {
        query += ' AND reason = ?';
        params.push(filter.reason);
      }

      if (filter.status) {
        query += ' AND status = ?';
        params.push(filter.status);
      }

      if (filter.startDate) {
        query += ' AND revoked_at >= ?';
        params.push(filter.startDate);
      }

      if (filter.endDate) {
        query += ' AND revoked_at <= ?';
        params.push(filter.endDate);
      }

      if (filter.revokedBy) {
        query += ' AND revoked_by = ?';
        params.push(filter.revokedBy);
      }

      if (filter.bulkId) {
        query += ' AND bulk_id = ?';
        params.push(filter.bulkId);
      }

      query += ' ORDER BY revoked_at DESC';

      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }

      if (offset) {
        query += ' OFFSET ?';
        params.push(offset);
      }

      const rows = await this.db.query(query, params);
      return rows.map(this.mapRowToRevocation);
    } catch (error) {
      this.logger.error('Error getting revocations by filter', error);
      return [];
    }
  }

  /**
   * Get total number of revocations
   */
  async getTotalRevocations(): Promise<number> {
    try {
      const result = await this.db.query(`
        SELECT COUNT(*) as total FROM proof_revocations
      `);
      return result[0].total;
    } catch (error) {
      this.logger.error('Error getting total revocations', error);
      return 0;
    }
  }

  /**
   * Get count of active revocations
   */
  async getActiveRevocationsCount(): Promise<number> {
    try {
      const result = await this.db.query(`
        SELECT COUNT(*) as total FROM proof_revocations WHERE status = 'ACTIVE'
      `);
      return result[0].total;
    } catch (error) {
      this.logger.error('Error getting active revocations count', error);
      return 0;
    }
  }

  /**
   * Get revocations count by reason
   */
  async getRevocationsByReasonCount(): Promise<Map<RevocationReason, number>> {
    try {
      const rows = await this.db.query(`
        SELECT reason, COUNT(*) as count 
        FROM proof_revocations 
        GROUP BY reason
      `);

      const resultMap = new Map<RevocationReason, number>();
      rows.forEach((row) => {
        resultMap.set(row.reason as RevocationReason, row.count);
      });

      return resultMap;
    } catch (error) {
      this.logger.error('Error getting revocations by reason count', error);
      return new Map();
    }
  }

  /**
   * Get revocations by time range (for analytics)
   */
  async getRevocationsByTimeRange(): Promise<Map<string, number>> {
    try {
      const rows = await this.db.query(`
        SELECT 
          DATE(revoked_at) as date,
          COUNT(*) as count
        FROM proof_revocations 
        WHERE revoked_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
        GROUP BY DATE(revoked_at)
        ORDER BY date DESC
      `);

      const resultMap = new Map<string, number>();
      rows.forEach((row) => {
        resultMap.set(row.date, row.count);
      });

      return resultMap;
    } catch (error) {
      this.logger.error('Error getting revocations by time range', error);
      return new Map();
    }
  }

  /**
   * Get average processing time
   */
  async getAverageProcessingTime(): Promise<number> {
    try {
      // This is a simplified implementation
      // In practice, you'd track actual processing times
      const result = await this.db.query(`
        SELECT AVG(TIMESTAMPDIFF(MICROSECOND, created_at, updated_at)) / 1000 as avg_time
        FROM proof_revocations 
        WHERE created_at != updated_at
      `);
      return result[0].avg_time || 0;
    } catch (error) {
      this.logger.error('Error getting average processing time', error);
      return 0;
    }
  }

  /**
   * Get success rate
   */
  async getSuccessRate(): Promise<number> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(CASE WHEN status != 'ACTIVE' THEN 1 END) as failed,
          COUNT(*) as total
        FROM proof_revocations
      `);

      const { failed, total } = result[0];
      return total > 0 ? ((total - failed) / total) * 100 : 100;
    } catch (error) {
      this.logger.error('Error getting success rate', error);
      return 0;
    }
  }

  /**
   * Generate Certificate Revocation List (CRL)
   */
  async generateCRL(): Promise<CRLExport> {
    try {
      // Check cache first
      const cachedCRL = await this.getCachedCRL();
      if (cachedCRL) {
        return cachedCRL;
      }

      const activeRevocations = await this.getActiveRevocations();

      const metadata: CRLMetadata = {
        version: '1.0',
        thisUpdate: new Date(),
        nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        signatureAlgorithm: 'SHA256withRSA',
        totalEntries: activeRevocations.length,
        fingerprint: this.generateFingerprint(activeRevocations),
      };

      const crlExport: CRLExport = {
        metadata,
        revocations: activeRevocations,
      };

      // Add signature if enabled
      if (this.config.signatureEnabled && this.config.privateKey) {
        crlExport.signature = await this.signCRL(crlExport);
      }

      // Cache the CRL
      await this.cacheCRL(crlExport);

      return crlExport;
    } catch (error) {
      this.logger.error('Error generating CRL', error);
      throw error;
    }
  }

  /**
   * Export CRL in different formats
   */
  async exportCRL(format: 'json' | 'der' | 'pem' = 'json'): Promise<string | Buffer> {
    try {
      const crl = await this.generateCRL();

      switch (format) {
        case 'json':
          return JSON.stringify(crl, null, 2);

        case 'der':
          return this.exportCRLAsDER(crl);

        case 'pem':
          return this.exportCRLAsPEM(crl);

        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      this.logger.error('Error exporting CRL', error);
      throw error;
    }
  }

  /**
   * Verify CRL signature
   */
  async verifyCRLSignature(crl: CRLExport): Promise<boolean> {
    try {
      if (!this.config.signatureEnabled || !crl.signature || !this.config.publicKey) {
        return true; // No signature to verify
      }

      const message = JSON.stringify({
        metadata: crl.metadata,
        revocations: crl.revocations,
      });

      return this.verifySignature(message, crl.signature, this.config.publicKey);
    } catch (error) {
      this.logger.error('Error verifying CRL signature', error);
      return false;
    }
  }

  /**
   * Clean up old revocations
   */
  async cleanupOldRevocations(): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - this.config.retentionPeriod * 24 * 60 * 60 * 1000);

      const result = await this.db.query(
        `
        DELETE FROM proof_revocations 
        WHERE status = 'EXPIRED' AND revoked_at < ?
      `,
        [cutoffDate],
      );

      const deletedCount = Array.isArray(result) ? result.length : result.affectedRows || 0;

      if (deletedCount > 0) {
        await this.invalidateCRLCache();
        this.logger.info(`Cleaned up ${deletedCount} old revocations`);
      }

      return deletedCount;
    } catch (error) {
      this.logger.error('Error cleaning up old revocations', error);
      return 0;
    }
  }

  /**
   * Get comprehensive statistics
   */
  async getStatistics(): Promise<RevocationStats> {
    try {
      const totalRevocations = await this.getTotalRevocations();
      const activeRevocations = await this.getActiveRevocationsCount();
      const revocationsByReason = await this.getRevocationsByReasonCount();
      const revocationsByDay = await this.getRevocationsByTimeRange();
      const averageRetentionTime = await this.getAverageProcessingTime();

      // Calculate expired and restored counts
      const expiredRevocations = Array.from(revocationsByReason.values())
        .filter((_, reason) => reason === RevocationReason.EXPIRED)
        .reduce((sum, count) => sum + count, 0);

      const restoredRevocations = totalRevocations - activeRevocations - expiredRevocations;

      return {
        totalRevocations,
        activeRevocations,
        expiredRevocations,
        restoredRevocations,
        revocationsByReason,
        revocationsByDay,
        averageRetentionTime,
      };
    } catch (error) {
      this.logger.error('Error getting statistics', error);
      return {
        totalRevocations: 0,
        activeRevocations: 0,
        expiredRevocations: 0,
        restoredRevocations: 0,
        revocationsByReason: new Map(),
        revocationsByDay: new Map(),
        averageRetentionTime: 0,
      };
    }
  }

  // Private helper methods

  private mapRowToRevocation = (row: any): ProofRevocation => {
    return new ProofRevocation({
      id: row.id,
      proofId: row.proof_id,
      reason: row.reason as RevocationReason,
      description: row.description,
      revokedBy: row.revoked_by,
      revokedAt: new Date(row.revoked_at),
      status: row.status as RevocationStatus,
      evidence: row.evidence ? JSON.parse(row.evidence) : [],
      bulkId: row.bulk_id,
      restoredAt: row.restored_at ? new Date(row.restored_at) : undefined,
      restoredBy: row.restored_by || undefined,
      restoreReason: row.restore_reason || undefined,
    });
  };

  private async invalidateCRLCache(): Promise<void> {
    try {
      await this.db.query('DELETE FROM crl_cache');
    } catch (error) {
      this.logger.error('Error invalidating CRL cache', error);
    }
  }

  private async getCachedCRL(): Promise<CRLExport | null> {
    try {
      const rows = await this.db.query(`
        SELECT crl_data, signature FROM crl_cache 
        WHERE expires_at > NOW() 
        ORDER BY created_at DESC 
        LIMIT 1
      `);

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      const crlData = JSON.parse(row.crl_data);

      return {
        ...crlData,
        signature: row.signature || undefined,
      };
    } catch (error) {
      this.logger.error('Error getting cached CRL', error);
      return null;
    }
  }

  private async cacheCRL(crl: CRLExport): Promise<void> {
    try {
      await this.db.query(
        `
        INSERT INTO crl_cache (crl_data, signature, expires_at) 
        VALUES (?, ?, ?)
      `,
        [
          JSON.stringify({
            metadata: crl.metadata,
            revocations: crl.revocations,
          }),
          crl.signature || null,
          crl.metadata.nextUpdate,
        ],
      );
    } catch (error) {
      this.logger.error('Error caching CRL', error);
    }
  }

  private generateFingerprint(revocations: ProofRevocation[]): string {
    const data = revocations
      .sort((a, b) => a.proofId.localeCompare(b.proofId))
      .map((r) => `${r.proofId}:${r.revokedAt.getTime()}:${r.reason}`)
      .join('|');

    // Simple hash implementation - in practice, use crypto
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private async signCRL(crl: CRLExport): Promise<string> {
    // Simplified signature implementation
    // In practice, use proper cryptographic signing
    const message = JSON.stringify({
      metadata: crl.metadata,
      revocations: crl.revocations,
    });

    return `signature_${Buffer.from(message).toString('base64')}`;
  }

  private async verifySignature(
    message: string,
    signature: string,
    publicKey: string,
  ): Promise<boolean> {
    // Simplified verification implementation
    // In practice, use proper cryptographic verification
    return signature.startsWith('signature_');
  }

  private exportCRLAsDER(crl: CRLExport): Buffer {
    // Simplified DER encoding
    // In practice, use proper ASN.1 DER encoding
    return Buffer.from(JSON.stringify(crl));
  }

  private exportCRLAsPEM(crl: CRLExport): string {
    // Simplified PEM encoding
    // In practice, use proper PEM encoding
    const der = this.exportCRLAsDER(crl);
    const base64 = der.toString('base64');

    return `-----BEGIN X509 CRL-----\n${base64.match(/.{1,64}/g)?.join('\n') || ''}\n-----END X509 CRL-----`;
  }
}
