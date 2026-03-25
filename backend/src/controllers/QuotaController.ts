import { Request, Response } from 'express';
import QuotaService from '../services/tenant/QuotaService';
import UsageTrackingService from '../services/tenant/UsageTrackingService';
import { ResourceType, QuotaPeriod } from '../models/ResourceQuota';

/**
 * Controller for managing per-tenant resource quotas and tracking usage.
 */
export class QuotaController {
  /**
   * @route GET /api/quotas/status/:tenantId
   * @desc Get current usage status for a tenant
   */
  public async getStatus(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId || (req as any).user?.tenantId;
      if (!tenantId) return res.status(400).json({ error: 'Tenant context missing' });

      const status = await QuotaService.getStatus(tenantId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * @route GET /api/quotas/:tenantId/history/:resourceType
   * @desc Get historical usage for analytics
   */
  public async getHistory(req: Request, res: Response) {
    try {
      const { tenantId, resourceType } = req.params;
      const history = await UsageTrackingService.getHistory(tenantId, resourceType as ResourceType);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * @route POST /api/quotas/set
   * @desc Admin sets or updates a quota
   */
  public async setQuota(req: Request, res: Response) {
    try {
      const { tenantId, resourceType, limit, period, isSoftLimit } = req.body;
      const result = await QuotaService.setQuota(tenantId, { 
        resourceType: resourceType as ResourceType, 
        limit, 
        period: period as QuotaPeriod, 
        isSoftLimit 
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * @route POST /api/quotas/override
   * @desc Emergency override for specific resource quota
   */
  public async overrideQuota(req: Request, res: Response) {
    try {
      const { tenantId, resourceType, newLimit } = req.body;
      const adminId = (req as any).user?.id;
      
      const result = await QuotaService.overrideQuota(tenantId, resourceType as ResourceType, newLimit, adminId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export default new QuotaController();
