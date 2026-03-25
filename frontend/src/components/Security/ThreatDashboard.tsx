import React, { useState, useEffect } from 'react';
import { SecurityAlerts } from './SecurityAlerts';

interface ThreatStats {
  totalThreats: number;
  criticalThreats: number;
  highThreats: number;
  lastUpdated: string;
}

export const ThreatDashboard: React.FC = () => {
  const [stats, setStats] = useState<ThreatStats>({
    totalThreats: 0,
    criticalThreats: 0,
    highThreats: 0,
    lastUpdated: new Date().toISOString()
  });

  // Simulated polling for real-time updates
  useEffect(() => {
    const fetchStats = async () => {
      // In a real app, this would be an API call to ThreatDetectionService
      // e.g. const response = await fetch('/api/security/dashboard');
      // const data = await response.json();
      // setStats(data.stats);
    };

    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-red-500">Advanced Threat Detection Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm font-semibold uppercase">Total Threats Monitored</h3>
          <p className="text-4xl font-mono mt-2 text-blue-400">{stats.totalThreats}</p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg border border-red-900">
          <h3 className="text-gray-400 text-sm font-semibold uppercase">Critical Threats</h3>
          <p className="text-4xl font-mono mt-2 text-red-500 animate-pulse">{stats.criticalThreats}</p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg border border-orange-900">
          <h3 className="text-gray-400 text-sm font-semibold uppercase">High/Medium Alerts</h3>
          <p className="text-4xl font-mono mt-2 text-orange-400">{stats.highThreats}</p>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Recent Security Events</h3>
        <SecurityAlerts />
      </div>

      <div className="mt-4 text-xs text-gray-500 text-right">
        Last updated: {new Date(stats.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
};
