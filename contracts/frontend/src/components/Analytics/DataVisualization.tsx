import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter } from 'recharts';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Activity, Settings, Download, RefreshCw, Maximize2, Grid3x3 } from 'lucide-react';

interface DataPoint {
  name: string;
  value: number;
  category?: string;
  timestamp?: string;
}

interface VisualizationConfig {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap' | 'gauge';
  title: string;
  dataSource: string;
  xAxis?: string;
  yAxis?: string;
  colorScheme?: string[];
  interactive?: boolean;
  realTime?: boolean;
}

interface DataVisualizationProps {
  config?: VisualizationConfig;
  data?: any[];
  height?: number;
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const SAMPLE_DATA = [
  { name: 'Jan', value: 400, category: 'A' },
  { name: 'Feb', value: 300, category: 'A' },
  { name: 'Mar', value: 600, category: 'B' },
  { name: 'Apr', value: 800, category: 'B' },
  { name: 'May', value: 500, category: 'A' },
  { name: 'Jun', value: 700, category: 'B' },
];

const PIE_SAMPLE_DATA = [
  { name: 'Desktop', value: 45, color: '#3b82f6' },
  { name: 'Mobile', value: 30, color: '#10b981' },
  { name: 'Tablet', value: 15, color: '#f59e0b' },
  { name: 'Other', value: 10, color: '#ef4444' },
];

export const DataVisualization: React.FC<DataVisualizationProps> = ({
  config,
  data = SAMPLE_DATA,
  height = 400
}) => {
  const [visualizationConfig, setVisualizationConfig] = useState<VisualizationConfig>(
    config || {
      type: 'line',
      title: 'Data Visualization',
      dataSource: 'analytics',
      colorScheme: DEFAULT_COLORS,
      interactive: true,
      realTime: false
    }
  );
  const [chartData, setChartData] = useState(data);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (config) {
      setVisualizationConfig(config);
    }
  }, [config]);

  useEffect(() => {
    if (visualizationConfig.realTime) {
      const interval = setInterval(() => {
        fetchRealTimeData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [visualizationConfig.realTime]);

  const fetchRealTimeData = async () => {
    setLoading(true);
    try {
      // Mock real-time data update
      const newData = chartData.map(item => ({
        ...item,
        value: item.value + Math.floor(Math.random() * 20) - 10
      }));
      setChartData(newData);
    } catch (error) {
      console.error('Error fetching real-time data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      // Mock data refresh
      const response = await fetch(`/api/analytics/data/${visualizationConfig.dataSource}`);
      const newData = await response.json();
      setChartData(newData);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportChart = async (format: 'png' | 'svg' | 'pdf') => {
    // This would integrate with a chart export library
    console.log(`Exporting chart as ${format}`);
  };

  const renderChart = () => {
    const { type, colorScheme = DEFAULT_COLORS } = visualizationConfig;

    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={colorScheme[0]} 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill={colorScheme[0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={PIE_SAMPLE_DATA}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {PIE_SAMPLE_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || colorScheme[index % colorScheme.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={colorScheme[0]} 
                fill={colorScheme[0]}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis dataKey="value" />
              <Tooltip />
              <Scatter dataKey="value" fill={colorScheme[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Unsupported chart type: {type}</p>
          </div>
        );
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow ${isFullscreen ? 'fixed inset-0 z-50 m-0' : 'p-6'}`}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{visualizationConfig.title}</h3>
          <p className="text-sm text-gray-600">
            {visualizationConfig.realTime ? 'Real-time data' : 'Last updated: ' + new Date().toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {visualizationConfig.realTime && (
            <div className="flex items-center gap-1 text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span className="text-xs">Live</span>
            </div>
          )}
          
          <button
            onClick={refreshData}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => exportChart('png')}
            className="p-2 text-gray-500 hover:text-gray-700"
            title="Export chart"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-500 hover:text-gray-700"
            title="Toggle fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          
          <button
            className="p-2 text-gray-500 hover:text-gray-700"
            title="Chart settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {renderChart()}
      </div>

      {!isFullscreen && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setVisualizationConfig({...visualizationConfig, type: 'line'})}
                className={`p-2 rounded ${visualizationConfig.type === 'line' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="Line chart"
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setVisualizationConfig({...visualizationConfig, type: 'bar'})}
                className={`p-2 rounded ${visualizationConfig.type === 'bar' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="Bar chart"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setVisualizationConfig({...visualizationConfig, type: 'pie'})}
                className={`p-2 rounded ${visualizationConfig.type === 'pie' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="Pie chart"
              >
                <PieChartIcon className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setVisualizationConfig({...visualizationConfig, type: 'area'})}
                className={`p-2 rounded ${visualizationConfig.type === 'area' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="Area chart"
              >
                <Activity className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setVisualizationConfig({...visualizationConfig, type: 'scatter'})}
                className={`p-2 rounded ${visualizationConfig.type === 'scatter' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="Scatter plot"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="text-sm text-gray-600">
              {chartData.length} data points
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Dashboard component that combines multiple visualizations
export const AnalyticsDashboard: React.FC = () => {
  const [visualizations, setVisualizations] = useState<VisualizationConfig[]>([
    {
      type: 'line',
      title: 'User Growth',
      dataSource: 'users',
      colorScheme: DEFAULT_COLORS,
      interactive: true,
      realTime: true
    },
    {
      type: 'bar',
      title: 'Feature Usage',
      dataSource: 'features',
      colorScheme: DEFAULT_COLORS,
      interactive: true,
      realTime: false
    },
    {
      type: 'pie',
      title: 'Device Distribution',
      dataSource: 'devices',
      colorScheme: DEFAULT_COLORS,
      interactive: true,
      realTime: false
    },
    {
      type: 'area',
      title: 'Revenue Trends',
      dataSource: 'revenue',
      colorScheme: DEFAULT_COLORS,
      interactive: true,
      realTime: false
    }
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">Real-time data visualization and insights</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visualizations.map((viz, index) => (
          <DataVisualization
            key={index}
            config={viz}
            height={300}
          />
        ))}
      </div>
    </div>
  );
};
