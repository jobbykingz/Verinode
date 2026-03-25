import { IDashboard, IDashboardTemplate, IWidget } from '../../types/dashboard';

const STORAGE_KEY = 'verinode_dashboards';

class DashboardService {
  /**
   * Save a dashboard to local storage or API.
   */
  async saveDashboard(dashboard: IDashboard): Promise<IDashboard> {
    const dashboards = await this.getDashboards();
    const index = dashboards.findIndex(d => d.id === dashboard.id);
    
    if (index >= 0) {
      dashboards[index] = { ...dashboard, updatedAt: new Date().toISOString() };
    } else {
      dashboards.push({ ...dashboard, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards));
    return dashboard;
  }

  /**
   * Retrieve all user dashboards.
   */
  async getDashboards(): Promise<IDashboard[]> {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Get a single dashboard by ID.
   */
  async getDashboardById(id: string): Promise<IDashboard | undefined> {
    const dashboards = await this.getDashboards();
    return dashboards.find(d => d.id === id);
  }

  /**
   * Delete a dashboard.
   */
  async deleteDashboard(id: string): Promise<boolean> {
    const dashboards = await this.getDashboards();
    const filtered = dashboards.filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }

  /**
   * Load dashboard templates.
   */
  getTemplates(): IDashboardTemplate[] {
    return [
      {
        id: 'overview',
        name: 'Operational Overview',
        description: 'Key performance indicators and recent activity',
        widgets: [
          { type: 'USAGE_STATS', x: 0, y: 0, w: 12, h: 2, config: { title: 'Network Intensity' } },
          { type: 'PROOF_CHART', x: 0, y: 2, w: 8, h: 4, config: { title: 'Issuance Trends' } },
          { type: 'RECENT_ACTIVITY', x: 8, y: 2, w: 4, h: 4, config: { title: 'Audit Trail' } },
        ]
      },
      {
        id: 'analytics',
        name: 'Deep Analytics',
        description: 'Focused on resource consumption and data insights',
        widgets: [
          { type: 'PROOF_CHART', x: 0, y: 0, w: 6, h: 4, config: { title: 'Success Rate' } },
          { type: 'PROOF_CHART', x: 6, y: 0, w: 6, h: 4, config: { title: 'Volume Growth' } },
          { type: 'USAGE_STATS', x: 0, y: 4, w: 12, h: 3, config: { title: 'Resource Heatmap' } },
        ]
      }
    ];
  }
}

export default new DashboardService();
