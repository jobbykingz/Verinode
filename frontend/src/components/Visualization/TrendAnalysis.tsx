import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import ChartLibrary, { ChartData } from './ChartLibrary';
import { TrendingUp, TrendingDown, Calendar, Filter, Download, BarChart3, LineChart, Activity } from 'lucide-react';

interface TrendData {
  date: string;
  value: number;
  category?: string;
  metadata?: Record<string, any>;
}

interface TrendConfig {
  title: string;
  dataKey: string;
  color: string;
  icon: React.ReactNode;
  format?: 'number' | 'percentage' | 'currency' | 'time';
  unit?: string;
}

interface TrendAnalysisProps {
  className?: string;
  timeRange?: '7d' | '30d' | '90d' | '1y';
  data?: Record<string, TrendData[]>;
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
  onDrillDown?: (category: string, date: string) => void;
}

const TrendAnalysis: React.FC<TrendAnalysisProps> = ({
  className = '',
  timeRange = '30d',
  data,
  onExport,
  onDrillDown,
}) => {
  const [trendData, setTrendData] = useState<Record<string, TrendData[]>>({});
  const [selectedTrends, setSelectedTrends] = useState<string[]>([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const trendConfigs: TrendConfig[] = [
    {
      title: 'Proof Generation',
      dataKey: 'proofGeneration',
      color: '#3B82F6',
      icon: <Activity className="w-5 h-5" />,
      format: 'number',
    },
    {
      title: 'User Activity',
      dataKey: 'userActivity',
      color: '#10B981',
      icon: <TrendingUp className="w-5 h-5" />,
      format: 'number',
    },
    {
      title: 'Success Rate',
      dataKey: 'successRate',
      color: '#8B5CF6',
      icon: <BarChart3 className="w-5 h-5" />,
      format: 'percentage',
      unit: '%',
    },
    {
      title: 'Processing Time',
      dataKey: 'processingTime',
      color: '#F59E0B',
      icon: <LineChart className="w-5 h-5" />,
      format: 'time',
      unit: 's',
    },
    {
      title: 'Gas Consumption',
      dataKey: 'gasConsumption',
      color: '#EF4444',
      icon: <Activity className="w-5 h-5" />,
      format: 'number',
    },
    {
      title: 'Revenue',
      dataKey: 'revenue',
      color: '#EC4899',
      icon: <TrendingUp className="w-5 h-5" />,
      format: 'currency',
      unit: '$',
    },
  ];

  // Mock data generation - replace with actual API calls
  const generateMockTrendData = useMemo(() => {
    const mockData: Record<string, TrendData[]> = {};
    const now = new Date();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;

    trendConfigs.forEach(config => {
      const data: TrendData[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        let value = 0;
        switch (config.dataKey) {
          case 'proofGeneration':
            value = Math.floor(Math.random() * 1000) + 500;
            break;
          case 'userActivity':
            value = Math.floor(Math.random() * 500) + 200;
            break;
          case 'successRate':
            value = Math.random() * 20 + 80;
            break;
          case 'processingTime':
            value = Math.random() * 5 + 2;
            break;
          case 'gasConsumption':
            value = Math.floor(Math.random() * 100000) + 50000;
            break;
          case 'revenue':
            value = Math.floor(Math.random() * 10000) + 5000;
            break;
        }

        data.push({
          date: date.toISOString().split('T')[0],
          value,
          category: config.dataKey,
        });
      }
      mockData[config.dataKey] = data;
    });

    return mockData;
  }, [timeRange]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalData = data || generateMockTrendData;
      setTrendData(finalData);
      setSelectedTrends(Object.keys(finalData).slice(0, 3)); // Select first 3 trends by default
      setIsLoading(false);
    };

    loadData();
  }, [data, generateMockTrendData]);

  const calculateTrendStats = (data: TrendData[]) => {
    if (data.length < 2) return { trend: 0, change: 0, direction: 'neutral' as const };
    
    const current = data[data.length - 1].value;
    const previous = data[data.length - 2].value;
    const change = current - previous;
    const trend = (change / previous) * 100;
    
    return {
      trend,
      change,
      direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral' as const,
    };
  };

  const formatValue = (value: number, format?: string, unit?: string) => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}${unit || '%'}`;
      case 'currency':
        return `${unit || '$'}${value.toLocaleString()}`;
      case 'time':
        return `${value.toFixed(2)}${unit || 's'}`;
      default:
        return `${value.toLocaleString()}${unit || ''}`;
    }
  };

  const createChartData = (data: TrendData[], color: string): ChartData => ({
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Value',
        data: data.map(d => d.value),
        backgroundColor: `${color}20`,
        borderColor: color,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  });

  const createComparisonChartData = (datasets: Array<{ data: TrendData[]; color: string; label: string }>): ChartData => ({
    labels: datasets[0]?.data.map(d => d.date) || [],
    datasets: datasets.map(dataset => ({
      label: dataset.label,
      data: dataset.data.map(d => d.value),
      backgroundColor: `${dataset.color}20`,
      borderColor: dataset.color,
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
    })),
  });

  const TrendCard: React.FC<{ config: TrendConfig; data: TrendData[]; isSelected: boolean; onSelect: () => void }> = ({
    config,
    data,
    isSelected,
    onSelect,
  }) => {
    const stats = calculateTrendStats(data);
    const currentValue = data[data.length - 1]?.value || 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 cursor-pointer transition-all hover:shadow-xl ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={onSelect}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${config.color}20` }}>
              {config.icon}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{config.title}</h3>
          </div>
          <div className={`flex items-center gap-1 text-sm ${
            stats.direction === 'up' ? 'text-green-600' :
            stats.direction === 'down' ? 'text-red-600' : 'text-gray-600'
          }`}>
            {stats.direction === 'up' ? <TrendingUp className="w-4 h-4" /> :
             stats.direction === 'down' ? <TrendingDown className="w-4 h-4" /> : null}
            {Math.abs(stats.trend).toFixed(1)}%
          </div>
        </div>
        
        <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {formatValue(currentValue, config.format, config.unit)}
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {stats.change > 0 ? '+' : ''}{formatValue(stats.change, config.format, config.unit)} from previous period
        </div>
      </motion.div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Trend Analysis</h1>
        <div className="flex flex-wrap gap-2">
          <select
            value={timeRange}
            onChange={(e) => {/* Handle time range change */}}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            onClick={() => setComparisonMode(!comparisonMode)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              comparisonMode 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Compare
          </button>
          <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Trend Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trendConfigs.map(config => (
          <TrendCard
            key={config.dataKey}
            config={config}
            data={trendData[config.dataKey] || []}
            isSelected={selectedTrends.includes(config.dataKey)}
            onSelect={() => {
              setSelectedTrends(prev => 
                prev.includes(config.dataKey)
                  ? prev.filter(t => t !== config.dataKey)
                  : [...prev, config.dataKey]
              );
            }}
          />
        ))}
      </div>

      {/* Charts */}
      {selectedTrends.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {comparisonMode ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Comparison View</h2>
              <ChartLibrary
                type="line"
                data={createComparisonChartData(
                  selectedTrends.map(key => {
                    const config = trendConfigs.find(c => c.dataKey === key);
                    return {
                      data: trendData[key] || [],
                      color: config?.color || '#3B82F6',
                      label: config?.title || key,
                    };
                  })
                )}
                height={400}
                className="w-full"
              />
            </motion.div>
          ) : (
            selectedTrends.map((key, index) => {
              const config = trendConfigs.find(c => c.dataKey === key);
              if (!config) return null;
              
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
                >
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    {config.title} Trend
                  </h2>
                  <ChartLibrary
                    type="line"
                    data={createChartData(trendData[key] || [], config.color)}
                    height={300}
                    className="w-full"
                    onDataPointClick={(data) => onDrillDown?.(key, data.label)}
                  />
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Statistical Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Statistical Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">Metric</th>
                <th className="px-6 py-3">Current</th>
                <th className="px-6 py-3">Average</th>
                <th className="px-6 py-3">Min</th>
                <th className="px-6 py-3">Max</th>
                <th className="px-6 py-3">Trend</th>
              </tr>
            </thead>
            <tbody>
              {selectedTrends.map(key => {
                const config = trendConfigs.find(c => c.dataKey === key);
                if (!config) return null;
                
                const data = trendData[key] || [];
                const values = data.map(d => d.value);
                const current = values[values.length - 1] || 0;
                const average = values.reduce((sum, val) => sum + val, 0) / values.length || 0;
                const min = Math.min(...values);
                const max = Math.max(...values);
                const stats = calculateTrendStats(data);
                
                return (
                  <tr key={key} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }}></div>
                        {config.title}
                      </div>
                    </td>
                    <td className="px-6 py-4">{formatValue(current, config.format, config.unit)}</td>
                    <td className="px-6 py-4">{formatValue(average, config.format, config.unit)}</td>
                    <td className="px-6 py-4">{formatValue(min, config.format, config.unit)}</td>
                    <td className="px-6 py-4">{formatValue(max, config.format, config.unit)}</td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-1 ${
                        stats.direction === 'up' ? 'text-green-600' :
                        stats.direction === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {stats.direction === 'up' ? <TrendingUp className="w-4 h-4" /> :
                         stats.direction === 'down' ? <TrendingDown className="w-4 h-4" /> : null}
                        {Math.abs(stats.trend).toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default TrendAnalysis;
