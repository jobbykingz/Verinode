export type WidgetType = 'PROOF_CHART' | 'USAGE_STATS' | 'RECENT_ACTIVITY' | 'QUICK_ACTIONS' | 'CUSTOM';

export interface IWidgetConfig {
  title: string;
  refreshInterval?: number; // in milliseconds
  dataSource?: string;
  colors?: string[];
  [key: string]: any;
}

export interface IWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  config: IWidgetConfig;
}

export interface IDashboard {
  id: string;
  name: string;
  description?: string;
  widgets: IWidget[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IDashboardTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  widgets: Omit<IWidget, 'id'>[];
}
