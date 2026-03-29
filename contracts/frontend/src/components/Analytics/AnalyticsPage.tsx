import React, { useState } from 'react';
import { TrendAnalysis } from './TrendAnalysis';
import { BehaviorInsights } from './BehaviorInsights';
import { CustomReports } from './CustomReports';
import { AnalyticsDashboard } from './DataVisualization';
import { BarChart3, Users, FileText, Activity, Settings, Bell } from 'lucide-react';

type TabType = 'overview' | 'trends' | 'behavior' | 'reports' | 'visualization';

export const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'trends', label: 'Trends', icon: BarChart3 },
    { id: 'behavior', label: 'Behavior', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'visualization', label: 'Visualization', icon: BarChart3 }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AnalyticsDashboard />;
      case 'trends':
        return <TrendAnalysis />;
      case 'behavior':
        return <BehaviorInsights />;
      case 'reports':
        return <CustomReports />;
      case 'visualization':
        return <AnalyticsDashboard />;
      default:
        return <AnalyticsDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
              <p className="mt-2 text-sm text-gray-600">
                Advanced analytics and business insights for Verinode
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                <Bell className="w-4 h-4" />
                Alerts
              </button>
            </div>
          </div>
          
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </div>
    </div>
  );
};

export default AnalyticsPage;
