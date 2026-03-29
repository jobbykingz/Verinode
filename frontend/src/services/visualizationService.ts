import axios from 'axios';

export interface VisualizationData {
  id: string;
  type: 'chart' | 'heatmap' | 'metric' | 'table';
  title: string;
  data: any;
  metadata: {
    createdAt: string;
    updatedAt: string;
    source: string;
    tags: string[];
  };
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }>;
}

export interface HeatMapData {
  x: string;
  y: string;
  value: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface MetricData {
  name: string;
  value: number;
  trend?: number;
  unit?: string;
  format?: 'number' | 'percentage' | 'currency' | 'time';
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface FilterOptions {
  dateRange?: {
    start: string;
    end: string;
  };
  categories?: string[];
  tags?: string[];
  sources?: string[];
}

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'png' | 'svg';
  filename?: string;
  includeMetadata?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

class VisualizationService {
  private baseUrl: string;
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(baseUrl: string = '/api/visualization') {
    this.baseUrl = baseUrl;
  }

  // Cache management
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  // Data fetching methods
  async getChartData(chartId: string, filters?: FilterOptions): Promise<ChartData> {
    const cacheKey = `chart-${chartId}-${JSON.stringify(filters)}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/charts/${chartId}`, {
        params: filters,
      });
      const data = response.data;
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching chart data:', error);
      throw error;
    }
  }

  async getHeatMapData(heatMapId: string, filters?: FilterOptions): Promise<HeatMapData[]> {
    const cacheKey = `heatmap-${heatMapId}-${JSON.stringify(filters)}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/heatmaps/${heatMapId}`, {
        params: filters,
      });
      const data = response.data;
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      throw error;
    }
  }

  async getMetricsData(metricsId: string, filters?: FilterOptions): Promise<MetricData[]> {
    const cacheKey = `metrics-${metricsId}-${JSON.stringify(filters)}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/metrics/${metricsId}`, {
        params: filters,
      });
      const data = response.data;
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching metrics data:', error);
      throw error;
    }
  }

  async getTimeSeriesData(seriesId: string, filters?: FilterOptions): Promise<TimeSeriesData[]> {
    const cacheKey = `timeseries-${seriesId}-${JSON.stringify(filters)}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/timeseries/${seriesId}`, {
        params: filters,
      });
      const data = response.data;
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching time series data:', error);
      throw error;
    }
  }

  // Real-time data streaming
  subscribeToRealTimeUpdates(
    dataType: string,
    callback: (data: any) => void
  ): () => void {
    const eventSource = new EventSource(`${this.baseUrl}/realtime/${dataType}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('Error parsing real-time data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
    };

    // Return unsubscribe function
    return () => {
      eventSource.close();
    };
  }

  // Data aggregation and processing
  async aggregateData(
    dataId: string,
    aggregation: {
      type: 'sum' | 'average' | 'count' | 'min' | 'max';
      groupBy?: string[];
      timeInterval?: 'hour' | 'day' | 'week' | 'month';
    },
    filters?: FilterOptions
  ): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/aggregate/${dataId}`, {
        aggregation,
        filters,
      });
      return response.data;
    } catch (error) {
      console.error('Error aggregating data:', error);
      throw error;
    }
  }

  // Export functionality
  async exportData(
    dataId: string,
    options: ExportOptions
  ): Promise<Blob> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/export/${dataId}`,
        options,
        {
          responseType: 'blob',
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  // Template management
  async getVisualizationTemplates(): Promise<VisualizationData[]> {
    const cacheKey = 'templates';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/templates`);
      const data = response.data;
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  async saveVisualizationTemplate(template: Omit<VisualizationData, 'id' | 'metadata'>): Promise<VisualizationData> {
    try {
      const response = await axios.post(`${this.baseUrl}/templates`, template);
      this.cache.clear(); // Clear cache to ensure fresh data
      return response.data;
    } catch (error) {
      console.error('Error saving template:', error);
      throw error;
    }
  }

  async updateVisualizationTemplate(
    templateId: string,
    updates: Partial<VisualizationData>
  ): Promise<VisualizationData> {
    try {
      const response = await axios.put(`${this.baseUrl}/templates/${templateId}`, updates);
      this.cache.clear(); // Clear cache to ensure fresh data
      return response.data;
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  async deleteVisualizationTemplate(templateId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/templates/${templateId}`);
      this.cache.clear(); // Clear cache to ensure fresh data
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  // Data validation and quality checks
  async validateData(dataId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    quality: number;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/validate/${dataId}`);
      return response.data;
    } catch (error) {
      console.error('Error validating data:', error);
      throw error;
    }
  }

  // Performance monitoring
  async getPerformanceMetrics(): Promise<{
    responseTime: number;
    cacheHitRate: number;
    errorRate: number;
    activeConnections: number;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/performance`);
      return response.data;
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      throw error;
    }
  }

  // Data transformation utilities
  transformToChartFormat(data: any[], options: {
    xField: string;
    yField: string;
    groupBy?: string;
    aggregation?: 'sum' | 'average' | 'count';
  }): ChartData {
    const { xField, yField, groupBy, aggregation = 'sum' } = options;

    if (!groupBy) {
      const labels = [...new Set(data.map(item => item[xField]))];
      const dataset = {
        label: yField,
        data: labels.map(label => {
          const items = data.filter(item => item[xField] === label);
          return aggregation === 'sum' 
            ? items.reduce((sum, item) => sum + Number(item[yField]), 0)
            : aggregation === 'average'
            ? items.reduce((sum, item) => sum + Number(item[yField]), 0) / items.length
            : items.length;
        }),
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      };

      return { labels, datasets: [dataset] };
    }

    // Group by logic
    const groups = [...new Set(data.map(item => item[groupBy]))];
    const labels = [...new Set(data.map(item => item[xField]))];
    
    const datasets = groups.map((group, index) => {
      const colors = [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(147, 51, 234, 0.8)',
        'rgba(236, 72, 153, 0.8)',
      ];
      
      return {
        label: String(group),
        data: labels.map(label => {
          const items = data.filter(item => item[xField] === label && item[groupBy] === group);
          return aggregation === 'sum'
            ? items.reduce((sum, item) => sum + Number(item[yField]), 0)
            : aggregation === 'average'
            ? items.reduce((sum, item) => sum + Number(item[yField]), 0) / items.length
            : items.length;
        }),
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 2,
        fill: false,
        tension: 0.4,
      };
    });

    return { labels, datasets };
  }

  // Utility methods
  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  setCacheTimeout(timeout: number): void {
    this.cacheTimeout = timeout;
  }
}

// Singleton instance
export const visualizationService = new VisualizationService();

// Export types and service
export { VisualizationService };
export default visualizationService;
