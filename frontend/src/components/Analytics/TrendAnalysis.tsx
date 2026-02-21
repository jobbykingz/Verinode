import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar, Filter } from 'lucide-react';

interface TrendData {
  date: string;
  value: number;
  change: number;
  changePercent: number;
  forecast?: number;
}

interface TrendAnalysisProps {
  timeframe?: string;
  granularity?: string;
  metric?: string;
}

export const TrendAnalysis: React.FC<TrendAnalysisProps> = ({
  timeframe = '30d',
  granularity = 'daily',
  metric = 'proofs_created'
}) => {
  const [data, setData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);
  const [selectedGranularity, setSelectedGranularity] = useState(granularity);

  useEffect(() => {
    fetchTrendData();
  }, [selectedTimeframe, selectedGranularity, metric]);

  const fetchTrendData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/usage-trends?timeframe=${selectedTimeframe}&granularity=${selectedGranularity}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const latestValue = data[data.length - 1];
  const previousValue = data[data.length - 2];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Usage Trends</h2>
          <p className="text-sm text-gray-600 mt-1">Track usage patterns and growth over time</p>
        </div>
        
        <div className="flex gap-2">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          
          <select
            value={selectedGranularity}
            onChange={(e) => setSelectedGranularity(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Current Value</p>
              <p className="text-2xl font-bold text-blue-900">
                {latestValue?.value.toLocaleString() || '0'}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Change</p>
              <p className={`text-2xl font-bold ${getTrendColor(latestValue?.change || 0)}`}>
                {latestValue?.change > 0 ? '+' : ''}{latestValue?.change.toFixed(1)}
              </p>
            </div>
            {getTrendIcon(latestValue?.change || 0)}
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Change %</p>
              <p className={`text-2xl font-bold ${getTrendColor(latestValue?.changePercent || 0)}`}>
                {latestValue?.changePercent > 0 ? '+' : ''}{latestValue?.changePercent.toFixed(1)}%
              </p>
            </div>
            {getTrendIcon(latestValue?.changePercent || 0)}
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleDateString()}
              formatter={(value: any, name: string) => [
                typeof value === 'number' ? value.toLocaleString() : value,
                name === 'value' ? 'Actual' : 'Forecast'
              ]}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Actual"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke="#10b981" 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Forecast"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <p className="text-sm text-gray-600">
              Peak usage occurs on weekdays between 2 PM - 4 PM
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <p className="text-sm text-gray-600">
              {latestValue?.changePercent > 0 ? 'Positive' : 'Negative'} growth trend over selected period
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
            <p className="text-sm text-gray-600">
              Weekend usage typically {latestValue?.changePercent > 0 ? 'higher' : 'lower'} than weekdays
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
            <p className="text-sm text-gray-600">
              Forecast predicts continued growth based on current trends
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
