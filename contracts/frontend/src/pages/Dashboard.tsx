import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, Clock, TrendingUp } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProofs: 0,
    verifiedProofs: 0,
    pendingProofs: 0,
    recentActivity: []
  });

  useEffect(() => {
    // Mock data - replace with actual API calls
    setStats({
      totalProofs: 150,
      verifiedProofs: 120,
      pendingProofs: 30,
      recentActivity: [
        { id: 1, type: 'issued', timestamp: '2024-02-16T10:30:00Z' },
        { id: 2, type: 'verified', timestamp: '2024-02-16T09:45:00Z' },
        { id: 3, type: 'issued', timestamp: '2024-02-16T08:20:00Z' }
      ]
    });
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Proofs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProofs}</p>
            </div>
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Verified</p>
              <p className="text-2xl font-bold text-green-600">{stats.verifiedProofs}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingProofs}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Verification Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {Math.round((stats.verifiedProofs / stats.totalProofs) * 100)}%
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-6">Recent Activity</h2>
        <div className="space-y-4">
          {stats.recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'verified' ? 'bg-green-500' : 'bg-blue-500'
                }`} />
                <span className="font-medium">
                  Proof #{activity.id} {activity.type}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {new Date(activity.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-6">Quick Actions</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <button className="p-4 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
            Issue New Proof
          </button>
          <button className="p-4 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors">
            Verify Proof
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
