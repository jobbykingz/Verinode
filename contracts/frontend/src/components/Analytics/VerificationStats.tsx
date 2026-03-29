import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface VerificationData {
  timestamp: string;
  count: number;
  successRate: number;
}

interface VerificationStats {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  averageVerificationTime: number;
  verificationsByType: Record<string, number>;
  verificationsOverTime: VerificationData[];
}

export const VerificationStats: React.FC = () => {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    fetchVerificationStats();
  }, [timeRange]);

  const fetchVerificationStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/verification-stats?timeRange=${timeRange}`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching verification stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
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
        No verification data available
      </div>
    );
  }

  const successRate = ((stats.successfulVerifications / stats.totalVerifications) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Verification Statistics</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Verifications</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalVerifications)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-green-600 rounded-full"></div>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">{successRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-yellow-600 rounded-full"></div>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg. Verification Time</p>
              <p className="text-2xl font-bold text-gray-900">{stats.averageVerificationTime.toFixed(1)}s</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-red-600 rounded-full"></div>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Failed Verifications</p>
              <p className="text-2xl font-bold text-red-600">{formatNumber(stats.failedVerifications)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification Over Time */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Verifications Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.verificationsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTime}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => `Time: ${formatTime(value as string)}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#3b82f6" 
                name="Verifications"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="successRate" 
                stroke="#10b981" 
                name="Success Rate (%)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Verifications by Type */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Verifications by Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={Object.entries(stats.verificationsByType).map(([type, count]) => ({
              type: type.charAt(0).toUpperCase() + type.slice(1),
              count
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Success Metrics</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Successful</span>
                <span className="text-sm font-medium text-green-600">
                  {formatNumber(stats.successfulVerifications)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Failed</span>
                <span className="text-sm font-medium text-red-600">
                  {formatNumber(stats.failedVerifications)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Time Metrics</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Average Time</span>
                <span className="text-sm font-medium">
                  {stats.averageVerificationTime.toFixed(1)}s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Throughput</span>
                <span className="text-sm font-medium">
                  {(stats.totalVerifications / 24).toFixed(0)}/hour
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Quality Metrics</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Success Rate</span>
                <span className="text-sm font-medium text-green-600">{successRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Error Rate</span>
                <span className="text-sm font-medium text-red-600">
                  {(100 - parseFloat(successRate)).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
