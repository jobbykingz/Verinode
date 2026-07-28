// Issue #31: Proof expiration and renewal system
// expirationService.ts — Manages proof expiration dates, grace periods, and status checks

import { Proof, ProofExpiration, ExpirationAnalytics } from '../types';

/** Default expiration duration in days. */
const DEFAULT_EXPIRATION_DAYS = 365;
/** Grace period in days after expiration before proof becomes fully invalid. */
const DEFAULT_GRACE_PERIOD_DAYS = 30;
/** Days before expiration to send a reminder. */
const REMINDER_DAYS_BEFORE = 7;

export class ExpirationService {
  private expirations: Map<string, ProofExpiration> = new Map();

  /**
   * Set or update the expiration date for a proof.
   */
  setExpiration(proofId: string, durationDays: number = DEFAULT_EXPIRATION_DAYS): ProofExpiration {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const gracePeriodEndsAt = new Date(expiresAt.getTime() + DEFAULT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    const existing = this.expirations.get(proofId);
    const expiration: ProofExpiration = {
      proofId,
      expiresAt,
      gracePeriodEndsAt,
      isExpired: false,
      isInGracePeriod: false,
      lastRenewedAt: existing?.lastRenewedAt ?? null,
      renewalCount: existing?.renewalCount ?? 0,
    };

    this.expirations.set(proofId, expiration);
    return expiration;
  }

  /**
   * Check and update the expiration status of a proof.
   */
  checkExpiration(proofId: string): ProofExpiration | null {
    const expiration = this.expirations.get(proofId);
    if (!expiration) return null;

    const now = new Date();
    expiration.isExpired = now > expiration.expiresAt;
    expiration.isInGracePeriod = expiration.isExpired && now <= expiration.gracePeriodEndsAt;

    return expiration;
  }

  /**
   * Check all proofs for expiration and return those needing attention.
   */
  checkAllExpirations(proofs: Proof[]): {
    expiringSoon: ProofExpiration[];
    inGracePeriod: ProofExpiration[];
    expired: ProofExpiration[];
  } {
    const now = new Date();
    const expiringSoon: ProofExpiration[] = [];
    const inGracePeriod: ProofExpiration[] = [];
    const expired: ProofExpiration[] = [];

    for (const proof of proofs) {
      const expiration = this.checkExpiration(proof.id);
      if (!expiration) continue;

      const daysUntilExpiry = Math.ceil(
        (expiration.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (expiration.isExpired && !expiration.isInGracePeriod) {
        expired.push(expiration);
      } else if (expiration.isInGracePeriod) {
        inGracePeriod.push(expiration);
      } else if (daysUntilExpiry <= REMINDER_DAYS_BEFORE) {
        expiringSoon.push(expiration);
      }
    }

    return { expiringSoon, inGracePeriod, expired };
  }

  /**
   * Get expiration analytics.
   */
  getAnalytics(proofs: Proof[]): ExpirationAnalytics {
    const checks = this.checkAllExpirations(proofs);
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let renewedThisMonth = 0;
    for (const exp of this.expirations.values()) {
      if (exp.lastRenewedAt && exp.lastRenewedAt > monthAgo) {
        renewedThisMonth++;
      }
    }

    return {
      totalProofs: proofs.length,
      activeProofs: proofs.length - checks.expired.length,
      expiringSoon: checks.expiringSoon.length,
      inGracePeriod: checks.inGracePeriod.length,
      expired: checks.expired.length,
      renewedThisMonth,
      averageRenewalTime: 0, // Calculated from renewal records
    };
  }

  /**
   * Get the expiration record for a proof.
   */
  getExpiration(proofId: string): ProofExpiration | null {
    return this.checkExpiration(proofId);
  }

  /**
   * Remove expiration tracking for a proof.
   */
  removeExpiration(proofId: string): void {
    this.expirations.delete(proofId);
  }
}

export const expirationService = new ExpirationService();
