export enum StorageTier {
  HOT = 'HOT',     // Frequent access, high cost, low latency
  COOL = 'COOL',   // Infrequent access, medium cost
  ARCHIVE = 'ARCHIVE' // Rare access, lowest cost, high latency
}

export interface StorageMetrics {
  accessCount: number;
  lastAccessed: Date;
  size: number;
}

export class StorageOptimizer {
  private readonly HOT_THRESHOLD_DAYS = 30;
  private readonly COOL_THRESHOLD_DAYS = 90;

  /**
   * Determines the optimal storage tier based on access patterns
   */
  public determineTier(metrics: StorageMetrics): StorageTier {
    const now = new Date();
    const daysSinceLastAccess = (now.getTime() - metrics.lastAccessed.getTime()) / (1000 * 3600 * 24);

    if (daysSinceLastAccess < this.HOT_THRESHOLD_DAYS || metrics.accessCount > 50) {
      return StorageTier.HOT;
    } else if (daysSinceLastAccess < this.COOL_THRESHOLD_DAYS) {
      return StorageTier.COOL;
    } else {
      return StorageTier.ARCHIVE;
    }
  }

  /**
   * Calculates estimated cost savings by moving to a target tier
   */
  public estimateCostSavings(sizeGB: number, currentTier: StorageTier, targetTier: StorageTier): number {
    const rates = {
      [StorageTier.HOT]: 0.023,
      [StorageTier.COOL]: 0.01,
      [StorageTier.ARCHIVE]: 0.004
    };

    const currentMonthlyCost = sizeGB * rates[currentTier];
    const targetMonthlyCost = sizeGB * rates[targetTier];

    return Math.max(0, currentMonthlyCost - targetMonthlyCost);
  }

  public shouldOptimize(metrics: StorageMetrics): boolean {
    // Logic to decide if a migration is worth the API overhead
    const daysOld = (new Date().getTime() - metrics.lastAccessed.getTime()) / (1000 * 3600 * 24);
    return daysOld > this.HOT_THRESHOLD_DAYS;
  }
}