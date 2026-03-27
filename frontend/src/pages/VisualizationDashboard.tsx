import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AnalyticsDashboard from '../components/Visualization/AnalyticsDashboard';
import ProofMetrics from '../components/Visualization/ProofMetrics';
import TrendAnalysis from '../components/Visualization/TrendAnalysis';
import HeatMap from '../components/Visualization/HeatMap';
import CustomReports from '../components/Visualization/CustomReports';
import { BarChart3, TrendingUp, Activity, Grid3X3, FileText, Home } from 'lucide-react';

type TabType = 'overview' | 'proofs' | 'trends' | 'heatmap' | 'reports';

const VisualizationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs = [
    { id: 'overview' as TabType, label: 'Analytics Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'proofs' as TabType, label: 'Proof Metrics', icon: <Activity className="w-4 h-4" /> },
    { id: 'trends' as TabType, label: 'Trend Analysis', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'heatmap' as TabType, label: 'Usage Heat Map', icon: <Grid3X3 className="w-4 h-4" /> },
    { id: 'reports' as TabType, label: 'Custom Reports', icon: <FileText className="w-4 h-4" /> },
  ];

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    console.log(`Exporting dashboard as ${format}`);
    // Implementation would go here
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Data Visualization Suite
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <Home className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'overview' && (
            <AnalyticsDashboard
              onExport={handleExport}
              className="space-y-6"
            />
          )}

          {activeTab === 'proofs' && (
            <ProofMetrics
              onExport={handleExport}
              className="space-y-6"
            />
          )}

          {activeTab === 'trends' && (
            <TrendAnalysis
              onExport={handleExport}
              onDrillDown={(category, date) => {
                console.log('Drill down:', category, date);
              }}
              className="space-y-6"
            />
          )}

          {activeTab === 'heatmap' && (
            <HeatMap
              title="Platform Usage Heat Map"
              xAxisLabel="Hour of Day"
              yAxisLabel="Day of Week"
              valueLabel="Activity Level"
              colorScheme="blues"
              onCellClick={(data) => {
                console.log('Cell clicked:', data);
              }}
              onCellHover={(data) => {
                console.log('Cell hovered:', data);
              }}
              className="space-y-6"
            />
          )}

          {activeTab === 'reports' && (
            <CustomReports
              onSave={(template) => {
                console.log('Template saved:', template);
              }}
              onLoad={(templateId) => {
                console.log('Template loaded:', templateId);
              }}
              onExport={(templateId, format) => {
                console.log(`Template ${templateId} exported as ${format}`);
              }}
              className="space-y-6"
            />
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>© 2024 Verinode Data Visualization Suite. All rights reserved.</p>
            <p className="mt-2">
              Built with React, Chart.js, D3.js, and Tailwind CSS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualizationDashboard;
