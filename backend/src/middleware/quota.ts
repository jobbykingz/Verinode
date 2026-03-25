import { Request, Response, NextFunction } from 'express';
import QuotaService from '../services/tenant/QuotaService';
import { ResourceType } from '../models/ResourceQuota';

/**
 * Middleware to enforce quotas on specific routes.
 * Use it before your logic.
 * Example: router.post('/issue', enforceQuota(ResourceType.PROOFS), (req, res) => { ... })
 */
export const enforceQuota = (resourceType: ResourceType, amount: number = 1) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Extract tenantId from request user
      const user = (req as any).user;
      const tenantId = user?.tenantId || user?.id; // Fallback to id if not multi-tenant

      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required for quota enforcement' });
      }

      // 2. Check if usage is allowed
      const result = await QuotaService.canConsume(tenantId.toString(), resourceType, amount);

      if (!result.canConsume) {
        return res.status(403).json({ 
          error: 'Quota exceeded', 
          message: `Your tenant has reached its limit of ${result.limit} ${resourceType}.`,
          type: 'QUOTA_ERROR'
        });
      }

      // 3. Optional: Add warning headers if exceeded but allowed via soft limit
      if (result.exceeded && result.isSoftLimit) {
        res.setHeader('X-Quota-Warning', `Quota exceeded (${resourceType}). Currently in soft-limit mode.`);
      }

      // 4. Expose the usage status on the request for possible late-stage logging/responses
      (req as any).quotaStatus = {
        resourceType,
        remaining: result.remaining,
        limit: result.limit
      };

      next();
    } catch (error: any) {
      console.error(`[QUOTA] Middleware error for ${resourceType}:`, error);
      res.status(500).json({ error: 'Internal server error while enforcing quotas' });
    }
  };
};

export default enforceQuota;
