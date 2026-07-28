// Issue #31: Proof expiration and renewal system
// renewalService.ts — Handles proof renewal workflow and bulk renewals

import { Proof, RenewalRecord, RenewalOptions, BulkRenewalResult, ProofExpiration } from '../types';
import { expirationService } from './expirationService';

export class RenewalService {
  private renewals: Map<string, RenewalRecord[]> = new Map();

  /**
   * Renew a single proof, extending its expiration date.
   */
  renewProof(
    proofId: string,
    renewedBy: string,
    options: RenewalOptions = { durationDays: 365, notifyUser: true }
  ): RenewalRecord {
    const currentExpiration = expirationService.getExpiration(proofId);
    const previousExpiry = currentExpiration?.expiresAt ?? new Date();

    // Update the expiration
    const newExpiration = expirationService.setExpiration(proofId, options.durationDays);
    newExpiration.lastRenewedAt = new Date();
    newExpiration.renewalCount += 1;

    const renewal: RenewalRecord = {
      id: `renewal-${Date.now()}-${proofId}`,
      proofId,
      renewedAt: new Date(),
      renewedBy,
      previousExpiry,
      newExpiry: newExpiration.expiresAt,
      duration: options.durationDays,
    };

    const existing = this.renewals.get(proofId) ?? [];
    existing.push(renewal);
    this.renewals.set(proofId, existing);

    return renewal;
  }

  /**
   * Renew multiple proofs in bulk.
   */
  bulkRenew(
    proofIds: string[],
    renewedBy: string,
    options: RenewalOptions = { durationDays: 365, notifyUser: true }
  ): BulkRenewalResult {
    const successful: string[] = [];
    const failed: { proofId: string; error: string }[] = [];

    for (const proofId of proofIds) {
      try {
        this.renewProof(proofId, renewedBy, options);
        successful.push(proofId);
      } catch (err) {
        failed.push({
          proofId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      successful,
      failed,
      totalProcessed: proofIds.length,
    };
  }

  /**
   * Get renewal history for a proof.
   */
  getRenewalHistory(proofId: string): RenewalRecord[] {
    return this.renewals.get(proofId) ?? [];
  }

  /**
   * Check if a proof is eligible for renewal (exists and is expired or expiring soon).
   */
  isEligibleForRenewal(proofId: string): boolean {
    const expiration = expirationService.getExpiration(proofId);
    if (!expiration) return false;
    return expiration.isExpired || expiration.isInGracePeriod;
  }
}

export const renewalService = new RenewalService();
