import { Request, Response } from 'express';
import { TenantService } from '../tenant/tenantService';
import { BrandingService } from '../tenant/brandingService';
import { ResourceManager } from '../tenant/resourceManager';

const tenantService = new TenantService();
const brandingService = new BrandingService();
const resourceManager = new ResourceManager();

export const createTenant = async (req: Request, res: Response) => {
  try {
    const tenant = await tenantService.createTenant(req.body);
    res.status(201).json(tenant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tenant' });
  }
};

export const getTenantConfig = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenant._id;
    const branding = await brandingService.getBranding(tenantId);
    res.json({ branding });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
};

export const updateBranding = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenant._id;
    const config = await brandingService.updateBranding(tenantId, req.body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update branding' });
  }
};

export const updateResources = async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const config = await resourceManager.updateQuota(tenantId, req.body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update resources' });
  }
};