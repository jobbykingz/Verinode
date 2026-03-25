import mongoose from 'mongoose';
import ResourceQuota, { QuotaPeriod, ResourceType } from '../../models/ResourceQuota';
import ResourceUsage from '../../models/ResourceUsage';

/**
 * Core service for the Quota System.
 */
export class QuotaService {
  /**
   * Check if a tenant has remaining quota for a specific resource.
   */
  public async canConsume(tenantId: string, resourceType: ResourceType, amount: number = 1) {
    // 1. Get the current quota for the tenant and resource type
    const quota = await ResourceQuota.findOne({ 
      tenant: new mongoose.Types.ObjectId(tenantId), 
      resourceType: resourceType,
      isActive: true 
    });

    if (!quota) {
      // Default behavior if no quota is defined (could be a fail-safe limit or no limit)
      return { canConsume: true, remaining: Infinity, limit: Infinity };
    }

    // 2. Get the current usage
    const usage = await ResourceUsage.findOne({ 
      tenant: tenantId, 
      resourceType: resourceType 
    });

    const currentUsageValue = usage ? usage.currentValue : 0;
    const canConsume = (currentUsageValue + amount) <= quota.limit;

    return { 
      canConsume: canConsume || quota.isSoftLimit, // Soft limits allow usage but with warnings
      exceeded: (currentUsageValue + amount) > quota.limit,
      remaining: Math.max(0, quota.limit - currentUsageValue),
      limit: quota.limit,
      isSoftLimit: quota.isSoftLimit
    };
  }

  /**
   * Defines or updates a resource quota for a tenant.
   */
  public async setQuota(tenantId: string, data: { resourceType: ResourceType, limit: number, period: QuotaPeriod, isSoftLimit?: boolean }) {
    const filter = { tenant: tenantId, resourceType: data.resourceType };
    const update = { 
      limit: data.limit, 
      period: data.period, 
      isSoftLimit: data.isSoftLimit ?? false,
      isActive: true
    };
    
    return await ResourceQuota.findOneAndUpdate(filter, update, { upsert: true, new: true });
  }

  /**
   * Gets a snapshot of current status for a tenant.
   */
  public async getStatus(tenantId: string) {
    const quotas = await ResourceQuota.find({ tenant: tenantId, isActive: true });
    const usages = await ResourceUsage.find({ tenant: tenantId });

    return quotas.map(q => {
      const u = usages.find(val => val.resourceType === q.resourceType);
      return {
        resourceType: q.resourceType,
        limit: q.limit,
        currentUsage: u ? u.currentValue : 0,
        period: q.period,
        resetAt: u ? u.resetAt : null,
        remaining: Math.max(0, q.limit - (u ? u.currentValue : 0)),
        percentageUsed: q.limit > 0 ? (Math.min(100, ((u ? u.currentValue : 0) / q.limit) * 100)) : 0
      };
    });
  }

  /**
   * Overrides an existing quota for a premium tenant or emergency.
   */
  public async overrideQuota(tenantId: string, resourceType: ResourceType, newLimit: number, adminId?: string) {
    return await ResourceQuota.findOneAndUpdate(
      { tenant: tenantId, resourceType: resourceType },
      { limit: newLimit, overriddenBy: adminId, overriddenAt: new Date() },
      { new: true }
    );
  }
}

export default new QuotaService();
