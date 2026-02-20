import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Shield,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import axios from 'axios';

interface DashboardMetrics {
  totalEvents: number;
  securityEvents: number;
  complianceEvents: number;
  openFindings: number;
  complianceRate: number;
  additionalMetrics: {
    weeklyActivity: any;
    monthlyActivity: any;
    trendingUp: boolean;
  };
  trends: any;
}

const ComplianceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/compliance/dashboard');
      setMetrics(response.data.dashboard);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    color: string;
  }> = ({ title, value, icon, trend, color }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
        <div className="p-3 rounded-full bg-gray-100">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-2 flex items-center">
          {trend === 'up' ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span className={`text-sm ml-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? 'Increasing' : 'Decreasing'}
          </span>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-6">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
          <p className="text-red-700">{error}</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Time Range:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1d">24 Hours</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Events"
          value={metrics?.totalEvents || 0}
          icon={<BarChart className="h-6 w-6 text-blue-600" />}
          trend={metrics?.additionalMetrics?.trendingUp ? 'up' : 'down'}
          color="text-blue-600"
        />
        
        <MetricCard
          title="Security Events"
          value={metrics?.securityEvents || 0}
          icon={<Shield className="h-6 w-6 text-red-600" />}
          color="text-red-600"
        />
        
        <MetricCard
          title="Compliance Events"
          value={metrics?.complianceEvents || 0}
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          color="text-green-600"
        />
        
        <MetricCard
          title="Compliance Rate"
          value={`${metrics?.complianceRate || 0}%`}
          icon={<TrendingUp className="h-6 w-6 text-purple-600" />}
          color="text-purple-600"
        />
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Trends</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Weekly Activity</span>
              <span className="font-medium">{metrics?.additionalMetrics?.weeklyActivity?.totalEvents || 0} events</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Monthly Activity</span>
              <span className="font-medium">{metrics?.additionalMetrics?.monthlyActivity?.totalEvents || 0} events</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Security Incidents</span>
              <span className="font-medium text-red-600">{metrics?.additionalMetrics?.weeklyActivity?.securityEvents || 0}</span>
            </div>
          </div>
        </div>

        {/* Compliance Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm text-gray-600">Compliant</span>
              </div>
              <span className="text-sm font-medium text-green-600">
                {Math.round((100 - (metrics?.complianceRate || 0)) * (metrics?.totalEvents || 1) / 100)} items
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                <span className="text-sm text-gray-600">Needs Review</span>
              </div>
              <span className="text-sm font-medium text-yellow-600">
                {metrics?.openFindings || 0} items
              </span>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Overall Compliance</span>
                <span className={`text-sm font-bold ${
                  (metrics?.complianceRate || 0) >= 90 ? 'text-green-600' : 
                  (metrics?.complianceRate || 0) >= 70 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {metrics?.complianceRate || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (metrics?.complianceRate || 0) >= 90 ? 'bg-green-500' : 
                    (metrics?.complianceRate || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${metrics?.complianceRate || 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-full mr-3">
                <BarChart className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">System audit completed</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Completed</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-full mr-3">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Compliance check pending</p>
                <p className="text-xs text-gray-500">1 day ago</p>
              </div>
            </div>
            <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">Pending</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-full mr-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Privacy controls updated</p>
                <p className="text-xs text-gray-500">3 days ago</p>
              </div>
            </div>
            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Updated</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <BarChart className="h-5 w-5 text-blue-600 mr-2" />
            <span className="text-sm font-medium text-gray-700">Generate Report</span>
          </button>
          
          <button className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Shield className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-sm font-medium text-gray-700">Run Compliance Check</span>
          </button>
          
          <button className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Users className="h-5 w-5 text-purple-600 mr-2" />
            <span className="text-sm font-medium text-gray-700">View Audit Trail</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;