import { useState, useEffect, useCallback } from 'react';
import { IWidget, IDashboard, IWidgetConfig } from '../types/dashboard';
import dashboardService from '../services/dashboard/DashboardService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook for managing dashboard state and interactions.
 */
export const useDashboard = (dashboardId?: string) => {
  const [currentDashboard, setCurrentDashboard] = useState<IDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  /**
   * Initialize or load a specific dashboard.
   */
  const loadDashboard = useCallback(async (id?: string) => {
    setIsLoading(true);
    if (id) {
      const dashboard = await dashboardService.getDashboardById(id);
      if (dashboard) {
        setCurrentDashboard(dashboard);
      }
    } else {
      // Default initial dashboard
      setCurrentDashboard({
        id: uuidv4(),
        name: 'My Dashboard',
        widgets: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    setIsLoading(false);
  }, []);

  /**
   * Save the current state of the dashboard.
   */
  const saveDashboard = useCallback(async () => {
    if (!currentDashboard) return;
    setIsLoading(true);
    const saved = await dashboardService.saveDashboard(currentDashboard);
    setCurrentDashboard(saved);
    setIsLoading(false);
    setIsEditing(false);
  }, [currentDashboard]);

  /**
   * Add a widget to the dashboard.
   */
  const addWidget = useCallback((type: IWidget['type'], config: IWidgetConfig = { title: 'New Widget' }) => {
    if (!currentDashboard) return;

    const newWidget: IWidget = {
      id: uuidv4(),
      type,
      x: 0,
      y: Infinity, // Standard behavior for adding at bottom
      w: type === 'USAGE_STATS' ? 12 : 4,
      h: type === 'PROOF_CHART' ? 4 : 3,
      config
    };

    setCurrentDashboard({
      ...currentDashboard,
      widgets: [...currentDashboard.widgets, newWidget]
    });
  }, [currentDashboard]);

  /**
   * Remove a widget from the dashboard.
   */
  const removeWidget = useCallback((id: string) => {
    if (!currentDashboard) return;

    setCurrentDashboard({
      ...currentDashboard,
      widgets: currentDashboard.widgets.filter(w => w.id !== id)
    });
  }, [currentDashboard]);

  /**
   * Update widget layout or configuration.
   */
  const updateWidget = useCallback((id: string, updates: Partial<IWidget>) => {
    if (!currentDashboard) return;

    setCurrentDashboard({
      ...currentDashboard,
      widgets: currentDashboard.widgets.map(w => w.id === id ? { ...w, ...updates } : w)
    });
  }, [currentDashboard]);

  /**
   * Load from a template.
   */
  const useTemplate = useCallback((templateId: string) => {
    const template = dashboardService.getTemplates().find(t => t.id === templateId);
    if (!template) return;

    setCurrentDashboard({
      id: uuidv4(),
      name: template.name,
      widgets: template.widgets.map(w => ({ ...w, id: uuidv4() })) as IWidget[],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }, []);

  useEffect(() => {
    loadDashboard(dashboardId);
  }, [dashboardId, loadDashboard]);

  return {
    currentDashboard,
    isLoading,
    isEditing,
    setIsEditing,
    saveDashboard,
    addWidget,
    removeWidget,
    updateWidget,
    useTemplate,
    setCurrentDashboard
  };
};
