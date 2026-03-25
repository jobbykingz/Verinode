import mongoose from 'mongoose';
import ResourceUsage from '../../models/ResourceUsage';
import ResourceQuota, { QuotaPeriod, ResourceType } from '../../models/ResourceQuota';

export class UsageTrackingService {
  /**
   * Increments current resource usage for a tenant.
   * Also performs a reset if the period has expired.
   */
  public async trackUsage(tenantId: string, resourceType: ResourceType, amount: number = 1) {
    // 1. Find or create the usage record
    let usage = await ResourceUsage.findOne({ 
      tenant: new mongoose.Types.ObjectId(tenantId), 
      resourceType: resourceType 
    });

    if (!usage) {
      // Find quota to know how to set resetAt initially
      const quota = await ResourceQuota.findOne({ tenant: tenantId, resourceType });
      const resetAt = this.calculateNextReset(quota?.period || QuotaPeriod.MONTHLY);
      
      usage = new ResourceUsage({
        tenant: tenantId,
        resourceType: resourceType,
        currentValue: 0,
        resetAt: resetAt
      });
    }

    // 2. Check for manual reset if current period ended
    if (new Date() > usage.resetAt) {
      await this.resetUsage(usage);
    }

    // 3. Increment the usage
    usage.currentValue += amount;
    usage.lastUsedAt = new Date();
    
    // 4. Archive to history occasionally (or every time for small-scale datasets)
    usage.history.push({ value: usage.currentValue, timestamp: new Date() });
    
    // Prune history to keep only last 100 entries per usage record for performance
    if (usage.history.length > 100) {
      usage.history.shift();
    }

    return await usage.save();
  }

  /**
   * Resets usage for the next period.
   */
  private async resetUsage(usage: any) {
    const quota = await ResourceQuota.findOne({ tenant: usage.tenant, resourceType: usage.resourceType });
    const period = quota?.period || QuotaPeriod.MONTHLY;
    
    // Set next reset point
    usage.resetAt = this.calculateNextReset(period);
    usage.currentValue = 0;
    
    console.log(`[QUOTA] Reset usage counter for tenant ${usage.tenant} (${usage.resourceType})`);
    return usage;
  }

  /**
   * Calculates the next reset date based on the period.
   */
  private calculateNextReset(period: QuotaPeriod): Date {
    const now = new Date();
    switch (period) {
      case QuotaPeriod.DAILY:
        // Set to start of tomorrow
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      case QuotaPeriod.MONTHLY:
        // Set to start of next month
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      case QuotaPeriod.PERPETUAL:
        // Set to 100 years into the future
        return new Date(now.getFullYear() + 100, now.getMonth(), now.getDate());
      default:
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }

  /**
   * Provides raw historical usage data.
   */
  public async getHistory(tenantId: string, resourceType: ResourceType) {
    const usage = await ResourceUsage.findOne({ tenant: tenantId, resourceType });
    return usage?.history || [];
  }
}

export default new UsageTrackingService();
