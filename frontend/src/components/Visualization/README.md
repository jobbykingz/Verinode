# Advanced Data Visualization Suite

A comprehensive data visualization suite for the Verinode platform, providing interactive charts, real-time analytics, and custom reporting capabilities.

## Overview

This visualization suite includes:

- **Interactive Charts**: Line, bar, pie, doughnut, radar, scatter, and bubble charts
- **Real-time Analytics**: Live dashboard with auto-refresh capabilities
- **Proof Metrics**: Detailed analytics for cryptographic proof verification
- **Trend Analysis**: Advanced trend visualization with drill-down capabilities
- **Heat Maps**: Interactive heat maps for usage pattern analysis
- **Custom Reports**: Drag-and-drop report builder with export functionality
- **Export Capabilities**: PDF, Excel, CSV, PNG, and SVG export options
- **Responsive Design**: Mobile-friendly and accessible components
- **Performance Optimization**: Efficient rendering for large datasets

## Components

### 1. ChartLibrary (`ChartLibrary.tsx`)

A flexible chart component supporting multiple chart types with Chart.js integration.

**Features:**
- Multiple chart types (line, bar, pie, doughnut, radar, polarArea, scatter, bubble)
- Interactive tooltips and legends
- Customizable themes (light/dark)
- Export to PNG functionality
- Responsive design
- Accessibility compliance (WCAG 2.1)

**Props:**
```typescript
interface ChartProps {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter' | 'bubble';
  data: ChartData;
  options?: any;
  width?: number;
  height?: number;
  responsive?: boolean;
  className?: string;
  onDataPointClick?: (data: any) => void;
  theme?: 'light' | 'dark';
  animationDuration?: number;
}
```

**Usage Example:**
```tsx
import ChartLibrary from './components/Visualization/ChartLibrary';

const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
  datasets: [{
    label: 'Monthly Data',
    data: [65, 59, 80, 81, 56],
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 1)',
    borderWidth: 2,
  }]
};

<ChartLibrary
  type="line"
  data={data}
  height={300}
  onDataPointClick={(data) => console.log('Clicked:', data)}
/>
```

### 2. AnalyticsDashboard (`AnalyticsDashboard.tsx`)

Main analytics dashboard with key metrics and visualizations.

**Features:**
- Real-time data updates
- Multiple metric cards with trend indicators
- Interactive charts for proofs, users, revenue, and success rates
- Time range selection
- Auto-refresh toggle
- Export functionality

**Props:**
```typescript
interface AnalyticsDashboardProps {
  className?: string;
  dateRange?: { start: Date; end: Date };
  refreshInterval?: number;
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
}
```

### 3. ProofMetrics (`ProofMetrics.tsx`)

Detailed analytics for cryptographic proof verification.

**Features:**
- Proof status distribution
- Type distribution analysis
- Processing time trends
- Gas usage patterns
- Recent proofs table
- Advanced filtering options

**Props:**
```typescript
interface ProofMetricsProps {
  className?: string;
  timeRange?: '24h' | '7d' | '30d' | '90d';
  filters?: {
    type?: string[];
    status?: string[];
    issuer?: string[];
  };
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
}
```

### 4. TrendAnalysis (`TrendAnalysis.tsx`)

Advanced trend visualization with comparison capabilities.

**Features:**
- Multiple trend metrics
- Comparison mode for side-by-side analysis
- Statistical summaries
- Drill-down capabilities
- Time range selection
- Interactive trend selection

**Props:**
```typescript
interface TrendAnalysisProps {
  className?: string;
  timeRange?: '7d' | '30d' | '90d' | '1y';
  data?: Record<string, TrendData[]>;
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
  onDrillDown?: (category: string, date: string) => void;
}
```

### 5. HeatMap (`HeatMap.tsx`)

Interactive heat map component using D3.js.

**Features:**
- Multiple color schemes
- Interactive cells with hover effects
- Customizable axes labels
- Legend and statistics
- Responsive design
- Export capabilities

**Props:**
```typescript
interface HeatMapProps {
  className?: string;
  data?: HeatMapData[];
  width?: number;
  height?: number;
  colorScheme?: 'blues' | 'reds' | 'greens' | 'viridis' | 'plasma';
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  valueLabel?: string;
  onCellClick?: (data: HeatMapData) => void;
  onCellHover?: (data: HeatMapData | null) => void;
  showTooltip?: boolean;
  showLegend?: boolean;
  interactive?: boolean;
}
```

### 6. CustomReports (`CustomReports.tsx`)

Drag-and-drop report builder for creating custom visualizations.

**Features:**
- Drag-and-drop widget arrangement
- Multiple widget types (charts, metrics, tables, text)
- Real-time preview
- Template saving and loading
- Export to multiple formats
- Responsive grid layout

**Props:**
```typescript
interface CustomReportsProps {
  className?: string;
  templates?: ReportTemplate[];
  onSave?: (template: ReportTemplate) => void;
  onLoad?: (templateId: string) => void;
  onExport?: (templateId: string, format: 'pdf' | 'excel' | 'csv') => void;
}
```

## Services

### VisualizationService (`visualizationService.ts`)

Service layer for data management and API interactions.

**Features:**
- Data fetching with caching
- Real-time data streaming
- Data aggregation and processing
- Export functionality
- Template management
- Performance monitoring

**Key Methods:**
```typescript
// Data fetching
getChartData(chartId: string, filters?: FilterOptions): Promise<ChartData>
getHeatMapData(heatMapId: string, filters?: FilterOptions): Promise<HeatMapData[]>
getMetricsData(metricsId: string, filters?: FilterOptions): Promise<MetricData[]>
getTimeSeriesData(seriesId: string, filters?: FilterOptions): Promise<TimeSeriesData[]>

// Real-time updates
subscribeToRealTimeUpdates(dataType: string, callback: (data: any) => void): () => void

// Data aggregation
aggregateData(dataId: string, aggregation: AggregationConfig, filters?: FilterOptions): Promise<any>

// Export functionality
exportData(dataId: string, options: ExportOptions): Promise<Blob>
```

## Utilities

### ChartUtils (`chartUtils.ts`)

Utility functions for chart data transformation, validation, and export.

**Features:**
- Data transformation utilities
- Chart configuration generators
- Export functionality (PNG, SVG, PDF, Excel, CSV)
- Data validation
- Performance optimization
- Accessibility utilities

**Key Functions:**
```typescript
// Data transformation
transformData.toChartJsFormat(data: ChartDataPoint[], config: Partial<ChartConfig>)
transformData.groupByCategory(data: ChartDataPoint[])
transformData.aggregateByTime(data: ChartDataPoint[], interval: string)

// Chart configuration
generateChartConfig.line(overrides?: Partial<ChartConfig>)
generateChartConfig.bar(overrides?: Partial<ChartConfig>)

// Export functionality
exportChart.asPNG(element: HTMLElement, options?: ExportOptions)
exportChart.asPDF(element: HTMLElement, options?: ExportOptions)
exportChart.asExcel(data: any[], options?: ExportOptions)

// Validation
validateChart.validateData(data: any): { isValid: boolean; errors: string[] }
validateChart.validateConfig(config: Partial<ChartConfig>): { isValid: boolean; errors: string[] }
```

## Installation

The visualization suite requires the following dependencies:

```bash
npm install chart.js react-chartjs-2 d3 @types/d3 react-beautiful-dnd @types/react-beautiful-dnd jspdf html2canvas xlsx file-saver @types/file-saver date-fns
```

## Usage

### Basic Setup

1. Import the components you need:

```tsx
import AnalyticsDashboard from './components/Visualization/AnalyticsDashboard';
import ProofMetrics from './components/Visualization/ProofMetrics';
import TrendAnalysis from './components/Visualization/TrendAnalysis';
```

2. Use the components in your application:

```tsx
function App() {
  return (
    <div>
      <AnalyticsDashboard onExport={(format) => console.log('Export:', format)} />
      <ProofMetrics timeRange="7d" />
      <TrendAnalysis onDrillDown={(category, date) => console.log('Drill down:', category, date)} />
    </div>
  );
}
```

### Advanced Usage

#### Custom Data Integration

```tsx
import { visualizationService } from './services/visualizationService';

function CustomChart() {
  const [data, setData] = useState(null);

  useEffect(() => {
    visualizationService.getChartData('my-chart-id', {
      dateRange: { start: '2024-01-01', end: '2024-12-31' },
      categories: ['proofs', 'users']
    }).then(setData);
  }, []);

  return data ? <ChartLibrary type="line" data={data} /> : <div>Loading...</div>;
}
```

#### Real-time Updates

```tsx
function RealTimeDashboard() {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    const unsubscribe = visualizationService.subscribeToRealTimeUpdates('metrics', (newData) => {
      setData(prevData => updateData(prevData, newData));
    });

    return unsubscribe;
  }, []);

  return <AnalyticsDashboard data={data} />;
}
```

#### Custom Reports

```tsx
function ReportBuilder() {
  const handleSave = (template) => {
    visualizationService.saveVisualizationTemplate(template);
  };

  return (
    <CustomReports
      onSave={handleSave}
      onExport={(templateId, format) => {
        visualizationService.exportData(templateId, { format });
      }}
    />
  );
}
```

## Performance Considerations

### Large Datasets

For datasets with more than 1000 points, consider using:

```typescript
import { performance } from './utils/chartUtils';

// Sample data for better performance
const sampledData = performance.sampleData(largeDataset, 1000);

// Debounce chart updates
const debouncedUpdate = performance.debounce(updateChart, 300);
```

### Memory Management

```typescript
// Clear cache when needed
visualizationService.clearCache();

// Set custom cache timeout
visualizationService.setCacheTimeout(10 * 60 * 1000); // 10 minutes
```

## Accessibility

All components are built with accessibility in mind:

- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- ARIA labels and descriptions

```typescript
import { accessibility } from './utils/chartUtils';

// Generate ARIA labels
const ariaLabel = accessibility.generateAriaLabel(config, data);

// Check color contrast
const isAccessible = accessibility.checkColorContrast('#000000', '#FFFFFF');
```

## Theming

Components support light and dark themes:

```typescript
<ChartLibrary
  type="line"
  data={data}
  theme="dark"
  options={{
    plugins: {
      legend: {
        labels: {
          color: '#E5E7EB' // Dark theme text color
        }
      }
    }
  }}
/>
```

## Export Options

All components support multiple export formats:

```typescript
// Export to PDF
await exportChart.asPDF(chartElement, {
  filename: 'my-chart.pdf',
  scale: 2
});

// Export to Excel
await exportChart.asExcel(data, {
  filename: 'my-data.xlsx'
});

// Export to CSV
await exportChart.asCSV(data, {
  filename: 'my-data.csv'
});
```

## Error Handling

Components include comprehensive error handling:

```typescript
try {
  const data = await visualizationService.getChartData('chart-id');
  // Use data
} catch (error) {
  console.error('Failed to load chart data:', error);
  // Show error message to user
}
```

## Testing

The visualization suite includes built-in validation:

```typescript
import { validateChart } from './utils/chartUtils';

const dataValidation = validateChart.validateData(myData);
const configValidation = validateChart.validateConfig(myConfig);

if (!dataValidation.isValid) {
  console.error('Data validation errors:', dataValidation.errors);
}
```

## Contributing

When contributing to the visualization suite:

1. Follow the existing code patterns and TypeScript conventions
2. Ensure all new components are accessible
3. Add comprehensive error handling
4. Include performance optimizations for large datasets
5. Test with various screen sizes and devices
6. Document new props and methods

## License

This visualization suite is part of the Verinode project and is licensed under the MIT License.
