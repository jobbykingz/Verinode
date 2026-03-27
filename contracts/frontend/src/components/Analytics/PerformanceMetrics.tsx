import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface PerformanceData {
  timestamp: string;
  responseTime: number;
  throughput: number;
  errorRate: number;
}

interface PerformanceStats {
  averageResponseTime: number;
  throughput: number;
  errorRate: number;
  cacheHitRate: number;
  memoryUsage: number;
  cpuUsage: number;
  databaseConnections: number;
  metricsOverTime: PerformanceData[];
}

export const PerformanceMetrics: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    fetchPerformanceMetrics();
  }, [timeRange]);

  const fetchPerformanceMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/performance-metrics?timeRange=${timeRange}`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (value: number, type: string) => {
    switch (type) {
      case 'responseTime':
        return value < 200 ? 'text-green-600' : value < 500 ? 'text-yellow-600' : 'text-red-600';
      case 'errorRate':
        return value < 1 ? 'text-green-600' : value < 5 ? 'text-yellow-600' : 'text-red-600';
      case 'cacheHitRate':
        return value > 90 ? 'text-green-600' : value > 70 ? 'text-yellow-600' : 'text-red-600';
      case 'cpuUsage':
        return value < 50 ? 'text-green-600' : value < 80 ? 'text-yellow-600' : 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-500 p-8">
        No performance data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Performance Metrics</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
              <p className={`text-2xl font-bold ${getStatusColor(stats.averageResponseTime, 'responseTime')}`}>
                {stats.averageResponseTime.toFixed(0)}ms
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-green-600 rounded-full"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Throughput</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.throughput.toFixed(0)}/s
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-yellow-600 rounded-full"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Error Rate</p>
              <p className={`text-2xl font-bold ${getStatusColor(stats.errorRate, 'errorRate')}`}>
                {stats.errorRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-purple-600 rounded-full"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Cache Hit Rate</p>
              <p className={`text-2xl font-bold ${getStatusColor(stats.cacheHitRate, 'cacheHitRate')}`}>
                {stats.cacheHitRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Time & Throughput</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.metricsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="responseTime"
                stroke="#3b82f6"
                name="Response Time (ms)"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="throughput"
                stroke="#10b981"
                name="Throughput (req/s)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Rate</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.metricsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="errorRate"
                stroke="#ef4444"
                fill="#fca5a5"
                name="Error Rate (%)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">CPU Usage</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Current</span>
                <span className={`text-sm font-medium ${getStatusColor(stats.cpuUsage, 'cpuUsage')}`}>
                  {stats.cpuUsage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    stats.cpuUsage < 50 ? 'bg-green-500' :
                    stats.cpuUsage < 80 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(stats.cpuUsage, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Memory Usage</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Current</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.memoryUsage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    stats.memoryUsage < 70 ? 'bg-green-500' :
                    stats.memoryUsage < 85 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(stats.memoryUsage, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Database Connections</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Active</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.databaseConnections}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${Math.min((stats.databaseConnections / 50) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
