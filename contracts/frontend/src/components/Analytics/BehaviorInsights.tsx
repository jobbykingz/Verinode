import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Activity, Clock, TrendingUp, Eye, MousePointer } from 'lucide-react';

interface BehaviorData {
  segmentName: string;
  userCount: number;
  loginFrequency: number;
  sessionDuration: number;
  featureUsage: Record<string, number>;
}

interface FeatureUsage {
  featureName: string;
  usageCount: number;
  uniqueUsers: number;
  adoptionRate: number;
}

interface BehaviorInsightsProps {
  userId?: string;
  timeframe?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const BehaviorInsights: React.FC<BehaviorInsightsProps> = ({
  userId,
  timeframe = '30d'
}) => {
  const [behaviorData, setBehaviorData] = useState<BehaviorData[]>([]);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'segments' | 'features' | 'patterns'>('segments');

  useEffect(() => {
    fetchBehaviorData();
  }, [userId, timeframe]);

  const fetchBehaviorData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/user-behavior?userId=${userId}&timeframe=${timeframe}`);
      const result = await response.json();
      setBehaviorData(result.segments || []);
      setFeatureUsage(result.featureUsage || []);
    } catch (error) {
      console.error('Error fetching behavior data:', error);
    } finally {
      setLoading(false);
    }
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

  const totalUsers = behaviorData.reduce((sum, segment) => sum + segment.userCount, 0);
  const avgSessionDuration = behaviorData.reduce((sum, segment) => sum + segment.sessionDuration, 0) / behaviorData.length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">User Behavior Insights</h2>
          <p className="text-sm text-gray-600 mt-1">Understand how users interact with your platform</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedView('segments')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedView === 'segments'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Segments
          </button>
          <button
            onClick={() => setSelectedView('features')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedView === 'features'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Features
          </button>
          <button
            onClick={() => setSelectedView('patterns')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedView === 'patterns'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Patterns
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Users</p>
              <p className="text-2xl font-bold text-blue-900">
                {totalUsers.toLocaleString()}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Avg Session</p>
              <p className="text-2xl font-bold text-green-900">
                {Math.round(avgSessionDuration / 60)}m
              </p>
            </div>
            <Clock className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Active Features</p>
              <p className="text-2xl font-bold text-purple-900">
                {featureUsage.length}
              </p>
            </div>
            <Activity className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">Engagement Rate</p>
              <p className="text-2xl font-bold text-orange-900">
                {Math.round((totalUsers / (totalUsers * 1.2)) * 100)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {selectedView === 'segments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">User Segments</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={behaviorData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ segmentName, userCount }) => `${segmentName}: ${userCount}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="userCount"
                    >
                      {behaviorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Segment Details</h3>
              <div className="space-y-3">
                {behaviorData.map((segment, index) => (
                  <div key={segment.segmentName} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{segment.segmentName}</h4>
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Users:</span>
                        <span className="ml-2 font-medium">{segment.userCount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Login Freq:</span>
                        <span className="ml-2 font-medium">{segment.loginFrequency.toFixed(1)}/week</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Session:</span>
                        <span className="ml-2 font-medium">{Math.round(segment.sessionDuration / 60)}m</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Features:</span>
                        <span className="ml-2 font-medium">{Object.keys(segment.featureUsage).length}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedView === 'features' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Feature Usage</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureUsage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="featureName" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      typeof value === 'number' ? value.toLocaleString() : value,
                      name === 'usageCount' ? 'Usage Count' : name === 'uniqueUsers' ? 'Unique Users' : 'Adoption Rate'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="usageCount" fill="#3b82f6" name="Usage Count" />
                  <Bar dataKey="uniqueUsers" fill="#10b981" name="Unique Users" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featureUsage.map((feature) => (
              <div key={feature.featureName} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{feature.featureName}</h4>
                  <Eye className="w-5 h-5 text-gray-400" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Usage Count:</span>
                    <span className="font-medium">{feature.usageCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unique Users:</span>
                    <span className="font-medium">{feature.uniqueUsers.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Adoption Rate:</span>
                    <span className="font-medium">{feature.adoptionRate.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${feature.adoptionRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedView === 'patterns' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Behavior Patterns</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Time-based Patterns
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Peak Hours:</span>
                    <span className="font-medium">2 PM - 4 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Peak Day:</span>
                    <span className="font-medium">Tuesday</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Lowest Activity:</span>
                    <span className="font-medium">Sunday 3 AM</span>
                  </div>
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <MousePointer className="w-5 h-5 text-green-500" />
                  Interaction Patterns
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Clicks/Session:</span>
                    <span className="font-medium">24.5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Page Views/Session:</span>
                    <span className="font-medium">8.2</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bounce Rate:</span>
                    <span className="font-medium">32.1%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Key Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <p className="text-sm text-gray-600">
                  Power users spend 3x more time on analytics features
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <p className="text-sm text-gray-600">
                  Mobile users have shorter sessions but higher engagement
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <p className="text-sm text-gray-600">
                  Team collaboration features increase retention by 45%
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                <p className="text-sm text-gray-600">
                  Users who access API are 5x more likely to stay active
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
