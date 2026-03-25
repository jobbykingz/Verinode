import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import ChartLibrary, { ChartData } from './ChartLibrary';
import { Calendar, Filter, Download, RefreshCw, TrendingUp, Users, Activity, DollarSign } from 'lucide-react';

interface DashboardMetrics {
  totalProofs: number;
  activeUsers: number;
  successRate: number;
  revenue: number;
  growthRate: number;
  avgProcessingTime: number;
}

interface TimeSeriesData {
  date: string;
  proofs: number;
  users: number;
  revenue: number;
  successRate: number;
}

interface AnalyticsDashboardProps {
  className?: string;
  dateRange?: { start: Date; end: Date };
  refreshInterval?: number;
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  className = '',
  dateRange,
  refreshInterval = 30000,
  onExport,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalProofs: 0,
    activeUsers: 0,
    successRate: 0,
    revenue: 0,
    growthRate: 0,
    avgProcessingTime: 0,
  });

  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Mock data generation - replace with actual API calls
  const generateMockData = useMemo(() => {
    const data: TimeSeriesData[] = [];
    const now = new Date();
    const days = selectedTimeRange === '7d' ? 7 : selectedTimeRange === '30d' ? 30 : 90;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        proofs: Math.floor(Math.random() * 1000) + 500,
        users: Math.floor(Math.random() * 500) + 200,
        revenue: Math.floor(Math.random() * 10000) + 5000,
        successRate: Math.random() * 20 + 80,
      });
    }
    return data;
  }, [selectedTimeRange]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockData = generateMockData;
      setTimeSeriesData(mockData);
      
      // Calculate metrics from time series data
      const totalProofs = mockData.reduce((sum, day) => sum + day.proofs, 0);
      const totalUsers = mockData[mockData.length - 1]?.users || 0;
      const avgSuccessRate = mockData.reduce((sum, day) => sum + day.successRate, 0) / mockData.length;
      const totalRevenue = mockData.reduce((sum, day) => sum + day.revenue, 0);
      const growthRate = ((mockData[mockData.length - 1]?.proofs || 0) - (mockData[0]?.proofs || 0)) / (mockData[0]?.proofs || 1) * 100;
      
      setMetrics({
        totalProofs,
        activeUsers: totalUsers,
        successRate: avgSuccessRate,
        revenue: totalRevenue,
        growthRate,
        avgProcessingTime: Math.random() * 5 + 2,
      });
      
      setIsLoading(false);
    };

    loadData();

    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(loadData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [generateMockData, autoRefresh, refreshInterval]);

  const proofsChartData: ChartData = {
    labels: timeSeriesData.map(d => d.date),
    datasets: [
      {
        label: 'Proofs Generated',
        data: timeSeriesData.map(d => d.proofs),
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const usersChartData: ChartData = {
    labels: timeSeriesData.map(d => d.date),
    datasets: [
      {
        label: 'Active Users',
        data: timeSeriesData.map(d => d.users),
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const revenueChartData: ChartData = {
    labels: timeSeriesData.map(d => d.date),
    datasets: [
      {
        label: 'Revenue ($)',
        data: timeSeriesData.map(d => d.revenue),
        backgroundColor: 'rgba(251, 146, 60, 0.1)',
        borderColor: 'rgba(251, 146, 60, 1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const successRateChartData: ChartData = {
    labels: timeSeriesData.map(d => d.date),
    datasets: [
      {
        label: 'Success Rate (%)',
        data: timeSeriesData.map(d => d.successRate),
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        borderColor: 'rgba(147, 51, 234, 1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const MetricCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; trend?: number; color?: string }> = ({
    title,
    value,
    icon,
    trend,
    color = 'blue',
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {typeof value === 'number' ? (
              title.includes('Rate') ? `${value.toFixed(1)}%` :
              title.includes('Time') ? `${value.toFixed(1)}s` :
              title.includes('$') ? `$${value.toLocaleString()}` :
              value.toLocaleString()
            ) : value}
          </p>
          {trend !== undefined && (
            <div className={`flex items-center mt-2 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`w-4 h-4 mr-1 ${trend < 0 ? 'rotate-180' : ''}`} />
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-100 dark:bg-${color}-900`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              autoRefresh 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </button>
          <div className="relative">
            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Download className="w-4 h-4" />
              Export
            </button>
            <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 hidden">
              <button
                onClick={() => onExport?.('pdf')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Export as PDF
              </button>
              <button
                onClick={() => onExport?.('excel')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Export as Excel
              </button>
              <button
                onClick={() => onExport?.('csv')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Export as CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Total Proofs"
          value={metrics.totalProofs}
          icon={<Activity className="w-6 h-6 text-blue-600" />}
          trend={metrics.growthRate}
          color="blue"
        />
        <MetricCard
          title="Active Users"
          value={metrics.activeUsers}
          icon={<Users className="w-6 h-6 text-green-600" />}
          color="green"
        />
        <MetricCard
          title="Success Rate"
          value={metrics.successRate}
          icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
          color="purple"
        />
        <MetricCard
          title="Revenue"
          value={metrics.revenue}
          icon={<DollarSign className="w-6 h-6 text-orange-600" />}
          trend={metrics.growthRate}
          color="orange"
        />
        <MetricCard
          title="Growth Rate"
          value={metrics.growthRate}
          icon={<TrendingUp className="w-6 h-6 text-indigo-600" />}
          color="indigo"
        />
        <MetricCard
          title="Avg. Processing Time"
          value={metrics.avgProcessingTime}
          icon={<Activity className="w-6 h-6 text-red-600" />}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Proof Generation Trend</h2>
          <ChartLibrary
            type="line"
            data={proofsChartData}
            height={300}
            className="w-full"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Active Users</h2>
          <ChartLibrary
            type="line"
            data={usersChartData}
            height={300}
            className="w-full"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Revenue Overview</h2>
          <ChartLibrary
            type="bar"
            data={revenueChartData}
            height={300}
            className="w-full"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Success Rate</h2>
          <ChartLibrary
            type="line"
            data={successRateChartData}
            height={300}
            className="w-full"
          />
        </motion.div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
