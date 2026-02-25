import Tenant, { ITenant } from '../models/Tenant';
import TenantConfig from '../models/TenantConfig';

export class TenantService {
  async createTenant(data: { name: string; subdomain: string; ownerId: string }): Promise<ITenant> {
    const tenant = new Tenant(data);
    await tenant.save();
    
    // Initialize default config
    const config = new TenantConfig({ tenantId: tenant._id });
    await config.save();
    
    return tenant;
  }

  async getTenantBySubdomain(subdomain: string): Promise<ITenant | null> {
    return Tenant.findOne({ subdomain });
  }

  async getTenantById(id: string): Promise<ITenant | null> {
    return Tenant.findById(id);
  }

  async updateTenantStatus(id: string, status: 'active' | 'suspended'): Promise<ITenant | null> {
    return Tenant.findByIdAndUpdate(id, { status }, { new: true });
  }
}