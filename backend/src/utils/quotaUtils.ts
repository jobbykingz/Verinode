import { ResourceType, QuotaPeriod } from '../models/ResourceQuota';

/**
 * Common Resource Types across the platform.
 */
export const RESOURCES = ResourceType;

/**
 * Common Quota Periods.
 */
export const PERIODS = QuotaPeriod;

/**
 * Resource names for UI display.
 */
export const resourceDisplayNames: Record<ResourceType, string> = {
  [ResourceType.PROOFS]: 'Proof Issuance',
  [ResourceType.STORAGE_MB]: 'Cryptographic Storage (MB)',
  [ResourceType.API_CALLS]: 'API Rate Requests',
  [ResourceType.USERS]: 'Seat Allocation'
};

/**
 * Default limits for Free Tier if no quota is explicitly set.
 */
export const DEFAULT_FREE_LIMITS: Record<ResourceType, number> = {
  [ResourceType.PROOFS]: 50,
  [ResourceType.STORAGE_MB]: 100,
  [ResourceType.API_CALLS]: 1000,
  [ResourceType.USERS]: 5
};

/**
 * Formatter for human-friendly quota periods.
 */
export const formatPeriodLine = (period: QuotaPeriod): string => {
  switch(period) {
    case QuotaPeriod.DAILY: return 'per day';
    case QuotaPeriod.MONTHLY: return 'per month';
    case QuotaPeriod.PERPETUAL: return 'in total (no reset)';
    default: return 'per cycle';
  }
};

/**
 * Helper to calculate time remaining until quota reset.
 */
export const getTimeToReset = (resetAt: Date): string => {
  const diff = resetAt.getTime() - Date.now();
  if (diff <= 0) return 'Resetting...';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} days remaining`;
  if (hours > 0) return `${hours} hours remaining`;
  return 'Less than 1 hour remaining';
};
