import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface ChartDataPoint {
  x: string | number | Date;
  y: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'scatter' | 'bubble';
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors?: string[];
  theme?: 'light' | 'dark';
  animation?: boolean;
  responsive?: boolean;
  legend?: boolean;
  tooltip?: boolean;
}

export interface ExportOptions {
  format: 'png' | 'svg' | 'pdf' | 'excel' | 'csv';
  filename?: string;
  quality?: number;
  scale?: number;
  backgroundColor?: string;
}

// Color palettes
export const colorPalettes = {
  default: [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
  ],
  pastel: [
    '#93C5FD', '#86EFAC', '#FCD34D', '#FCA5A5', '#C4B5FD',
    '#F9A8D4', '#5EEAD4', '#FDBA74', '#67E8F9', '#BEF264'
  ],
  dark: [
    '#1E40AF', '#047857', '#B45309', '#B91C1C', '#6B21A8',
    '#BE185D', '#0F766E', '#C2410C', '#0E7490', '#4D7C0F'
  ],
  monochrome: [
    '#111827', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB',
    '#E5E7EB', '#F3F4F6', '#F9FAFB', '#FFFFFF', '#000000'
  ]
};

// Data transformation utilities
export const transformData = {
  // Convert raw data to chart.js format
  toChartJsFormat: (data: ChartDataPoint[], config: Partial<ChartConfig>) => {
    const labels = data.map(point => {
      if (typeof point.x === 'string') return point.x;
      if (point.x instanceof Date) return format(point.x, 'MMM dd, yyyy');
      return String(point.x);
    });

    const values = data.map(point => point.y);

    const colors = config.colors || colorPalettes.default;

    return {
      labels,
      datasets: [{
        label: config.title || 'Data',
        data: values,
        backgroundColor: config.type === 'line' ? `${colors[0]}20` : colors,
        borderColor: colors[0],
        borderWidth: 2,
        fill: config.type === 'line',
        tension: 0.4,
      }]
    };
  },

  // Group data by category
  groupByCategory: (data: ChartDataPoint[]) => {
    const groups = data.reduce((acc, point) => {
      const category = point.category || 'default';
      if (!acc[category]) acc[category] = [];
      acc[category].push(point);
      return acc;
    }, {} as Record<string, ChartDataPoint[]>);

    return groups;
  },

  // Aggregate data by time interval
  aggregateByTime: (
    data: ChartDataPoint[],
    interval: 'hour' | 'day' | 'week' | 'month'
  ): ChartDataPoint[] => {
    const grouped = data.reduce((acc, point) => {
      let key: string;
      const date = new Date(point.x);
      
      switch (interval) {
        case 'hour':
          key = format(date, 'yyyy-MM-dd HH:00');
          break;
        case 'day':
          key = format(date, 'yyyy-MM-dd');
          break;
        case 'week':
          key = format(date, 'yyyy-\'W\'ww');
          break;
        case 'month':
          key = format(date, 'yyyy-MM');
          break;
      }

      if (!acc[key]) {
        acc[key] = { x: key, y: 0, count: 0 };
      }
      acc[key].y += point.y;
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map(item => ({
      x: item.x,
      y: item.y / item.count, // Average
    }));
  },

  // Calculate moving average
  movingAverage: (data: ChartDataPoint[], windowSize: number): ChartDataPoint[] => {
    const result: ChartDataPoint[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = data.slice(start, i + 1);
      const average = window.reduce((sum, point) => sum + point.y, 0) / window.length;
      
      result.push({
        ...data[i],
        y: average,
      });
    }

    return result;
  },

  // Normalize data to 0-100 scale
  normalize: (data: ChartDataPoint[]): ChartDataPoint[] => {
    const values = data.map(point => point.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) return data;

    return data.map(point => ({
      ...point,
      y: ((point.y - min) / range) * 100,
    }));
  },

  // Calculate percentage change
  percentageChange: (data: ChartDataPoint[]): ChartDataPoint[] => {
    if (data.length < 2) return data;

    return data.map((point, index) => {
      if (index === 0) return { ...point, y: 0 };
      
      const previousValue = data[index - 1].y;
      const change = ((point.y - previousValue) / previousValue) * 100;
      
      return {
        ...point,
        y: change,
      };
    });
  }
};

// Chart configuration generators
export const generateChartConfig = {
  line: (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
    type: 'line',
    animation: true,
    responsive: true,
    legend: true,
    tooltip: true,
    ...overrides,
  }),

  bar: (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
    type: 'bar',
    animation: true,
    responsive: true,
    legend: true,
    tooltip: true,
    ...overrides,
  }),

  pie: (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
    type: 'pie',
    animation: true,
    responsive: true,
    legend: true,
    tooltip: true,
    ...overrides,
  }),

  doughnut: (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
    type: 'doughnut',
    animation: true,
    responsive: true,
    legend: true,
    tooltip: true,
    ...overrides,
  }),

  radar: (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
    type: 'radar',
    animation: true,
    responsive: true,
    legend: true,
    tooltip: true,
    ...overrides,
  }),

  scatter: (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
    type: 'scatter',
    animation: true,
    responsive: true,
    legend: true,
    tooltip: true,
    ...overrides,
  }),

  bubble: (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
    type: 'bubble',
    animation: true,
    responsive: true,
    legend: true,
    tooltip: true,
    ...overrides,
  }),
};

// Export utilities
export const exportChart = {
  // Export chart as PNG
  async asPNG(
    element: HTMLElement,
    options: ExportOptions = { format: 'png' }
  ): Promise<void> {
    const canvas = await html2canvas(element, {
      backgroundColor: options.backgroundColor || '#ffffff',
      scale: options.scale || 2,
      quality: options.quality || 1,
    });

    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, options.filename || `chart-${Date.now()}.png`);
      }
    }, 'image/png');
  },

  // Export chart as SVG (if available)
  async asSVG(
    element: HTMLElement,
    options: ExportOptions = { format: 'svg' }
  ): Promise<void> {
    const svgElement = element.querySelector('svg');
    if (!svgElement) {
      throw new Error('No SVG element found');
    }

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    saveAs(blob, options.filename || `chart-${Date.now()}.svg`);
  },

  // Export chart as PDF
  async asPDF(
    element: HTMLElement,
    options: ExportOptions = { format: 'pdf' }
  ): Promise<void> {
    const canvas = await html2canvas(element, {
      backgroundColor: options.backgroundColor || '#ffffff',
      scale: options.scale || 2,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = (pdfHeight - imgHeight * ratio) / 2;

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    pdf.save(options.filename || `chart-${Date.now()}.pdf`);
  },

  // Export data as Excel
  async asExcel(
    data: any[],
    options: ExportOptions = { format: 'excel' }
  ): Promise<void> {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, options.filename || `data-${Date.now()}.xlsx`);
  },

  // Export data as CSV
  async asCSV(
    data: any[],
    options: ExportOptions = { format: 'csv' }
  ): Promise<void> {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, options.filename || `data-${Date.now()}.csv`);
  },
};

// Chart validation utilities
export const validateChart = {
  // Validate chart data structure
  validateData: (data: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!Array.isArray(data)) {
      errors.push('Data must be an array');
      return { isValid: false, errors };
    }

    if (data.length === 0) {
      errors.push('Data array cannot be empty');
      return { isValid: false, errors };
    }

    data.forEach((point, index) => {
      if (typeof point !== 'object' || point === null) {
        errors.push(`Data point ${index} must be an object`);
        return;
      }

      if (!('x' in point) || !('y' in point)) {
        errors.push(`Data point ${index} must have 'x' and 'y' properties`);
      }

      if (typeof point.y !== 'number') {
        errors.push(`Data point ${index} 'y' value must be a number`);
      }
    });

    return { isValid: errors.length === 0, errors };
  },

  // Validate chart configuration
  validateConfig: (config: Partial<ChartConfig>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (config.type && !['line', 'bar', 'pie', 'doughnut', 'radar', 'scatter', 'bubble'].includes(config.type)) {
      errors.push('Invalid chart type');
    }

    if (config.colors && !Array.isArray(config.colors)) {
      errors.push('Colors must be an array');
    }

    if (config.theme && !['light', 'dark'].includes(config.theme)) {
      errors.push('Theme must be either "light" or "dark"');
    }

    return { isValid: errors.length === 0, errors };
  },
};

// Performance utilities
export const performance = {
  // Debounce function for chart updates
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Throttle function for real-time updates
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // Measure chart render performance
  measureRenderTime: async (renderFunction: () => Promise<void> | void): Promise<number> => {
    const start = performance.now();
    await renderFunction();
    const end = performance.now();
    return end - start;
  },

  // Check if data is too large for smooth rendering
  isDataTooLarge: (data: any[], threshold = 1000): boolean => {
    return data.length > threshold;
  },

  // Sample data for performance
  sampleData: (data: ChartDataPoint[], sampleSize = 1000): ChartDataPoint[] => {
    if (data.length <= sampleSize) return data;
    
    const step = Math.floor(data.length / sampleSize);
    return data.filter((_, index) => index % step === 0);
  },
};

// Accessibility utilities
export const accessibility = {
  // Generate ARIA labels for charts
  generateAriaLabel: (config: ChartConfig, data: any[]): string => {
    const type = config.type;
    const title = config.title || 'Chart';
    const dataPoints = data.length;
    
    return `${title} - ${type} chart showing ${dataPoints} data points`;
  },

  // Generate keyboard navigation hints
  generateKeyboardHints: (): string => {
    return 'Use Tab to navigate between chart elements, Enter to select, and Arrow keys to explore data points';
  },

  // Generate screen reader description
  generateScreenReaderDescription: (data: ChartDataPoint[]): string => {
    const total = data.length;
    const max = Math.max(...data.map(point => point.y));
    const min = Math.min(...data.map(point => point.y));
    const average = data.reduce((sum, point) => sum + point.y, 0) / total;
    
    return `Chart contains ${total} data points. Maximum value: ${max.toFixed(2)}. Minimum value: ${min.toFixed(2)}. Average value: ${average.toFixed(2)}.`;
  },

  // Check color contrast for accessibility
  checkColorContrast: (foreground: string, background: string): boolean => {
    // Simple contrast check - in production, use a proper contrast calculation library
    const getLuminance = (color: string): number => {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      return luminance;
    };

    const fgLuminance = getLuminance(foreground);
    const bgLuminance = getLuminance(background);
    const contrast = (Math.max(fgLuminance, bgLuminance) + 0.05) / (Math.min(fgLuminance, bgLuminance) + 0.05);
    
    return contrast >= 4.5; // WCAG AA standard
  },
};

export default {
  transformData,
  generateChartConfig,
  exportChart,
  validateChart,
  performance,
  accessibility,
  colorPalettes,
};
