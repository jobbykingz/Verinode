import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface IQuotaStatus {
  resourceType: string;
  limit: number;
  currentUsage: number;
  period: string;
  resetAt: string | null;
  remaining: number;
  percentageUsed: number;
}

export interface IResourceHistory {
  value: number;
  timestamp: string;
}

class QuotaService {
  /**
   * Get current tenant quota status.
   */
  async getStatus(): Promise<IQuotaStatus[]> {
    const response = await axios.get(`${API_URL}/quotas/status`);
    return response.data;
  }

  /**
   * Admin: Get status for a specific tenant.
   */
  async getTenantStatus(tenantId: string): Promise<IQuotaStatus[]> {
    const response = await axios.get(`${API_URL}/quotas/status/${tenantId}`);
    return response.data;
  }

  /**
   * Admin: Set/Update a quota limit.
   */
  async setQuota(data: { tenantId: string, resourceType: string, limit: number, period: string, isSoftLimit: boolean }): Promise<any> {
    const response = await axios.post(`${API_URL}/quotas/set`, data);
    return response.data;
  }

  /**
   * Emergency override of a quota.
   */
  async overrideQuota(tenantId: string, resourceType: string, newLimit: number): Promise<any> {
    const response = await axios.post(`${API_URL}/quotas/override`, { tenantId, resourceType, newLimit });
    return response.data;
  }

  /**
   * Get historical usage for analytics.
   */
  async getUsageHistory(tenantId: string, resourceType: string): Promise<IResourceHistory[]> {
    const response = await axios.get(`${API_URL}/quotas/history/${tenantId}/${resourceType}`);
    return response.data;
  }
}

export default new QuotaService();
