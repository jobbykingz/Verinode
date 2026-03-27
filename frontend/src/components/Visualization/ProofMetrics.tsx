import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import ChartLibrary, { ChartData } from './ChartLibrary';
import { Shield, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp, Filter, Download } from 'lucide-react';

interface ProofData {
  id: string;
  type: string;
  status: 'verified' | 'pending' | 'failed';
  timestamp: string;
  processingTime: number;
  gasUsed: number;
  size: number;
  issuer: string;
  verifier?: string;
}

interface ProofMetricsProps {
  className?: string;
  timeRange?: '24h' | '7d' | '30d' | '90d';
  filters?: {
    type?: string[];
    status?: string[];
    issuer?: string[];
  };
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
}

const ProofMetrics: React.FC<ProofMetricsProps> = ({
  className = '',
  timeRange = '7d',
  filters,
  onExport,
}) => {
  const [proofs, setProofs] = useState<ProofData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilters, setSelectedFilters] = useState(filters || {});

  // Mock data generation - replace with actual API calls
  const generateMockProofs = useMemo(() => {
    const types = ['zk-SNARK', 'zk-STARK', 'Bulletproofs', 'Merkle Proof', 'Signature Proof'];
    const statuses: Array<'verified' | 'pending' | 'failed'> = ['verified', 'pending', 'failed'];
    const issuers = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
    
    const count = timeRange === '24h' ? 100 : timeRange === '7d' ? 500 : timeRange === '30d' ? 2000 : 5000;
    const mockProofs: ProofData[] = [];
    
    for (let i = 0; i < count; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      mockProofs.push({
        id: `proof-${i + 1}`,
        type: types[Math.floor(Math.random() * types.length)],
        status,
        timestamp: new Date(Date.now() - Math.random() * (timeRange === '24h' ? 86400000 : timeRange === '7d' ? 604800000 : timeRange === '30d' ? 2592000000 : 7776000000)).toISOString(),
        processingTime: Math.random() * 10 + 1,
        gasUsed: Math.floor(Math.random() * 100000) + 10000,
        size: Math.floor(Math.random() * 1000) + 100,
        issuer: issuers[Math.floor(Math.random() * issuers.length)],
        verifier: status === 'verified' ? issuers[Math.floor(Math.random() * issuers.length)] : undefined,
      });
    }
    
    return mockProofs;
  }, [timeRange]);

  useEffect(() => {
    const loadProofs = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let filteredProofs = generateMockProofs;
      
      // Apply filters
      if (selectedFilters.type && selectedFilters.type.length > 0) {
        filteredProofs = filteredProofs.filter(proof => selectedFilters.type.includes(proof.type));
      }
      
      if (selectedFilters.status && selectedFilters.status.length > 0) {
        filteredProofs = filteredProofs.filter(proof => selectedFilters.status.includes(proof.status));
      }
      
      if (selectedFilters.issuer && selectedFilters.issuer.length > 0) {
        filteredProofs = filteredProofs.filter(proof => selectedFilters.issuer.includes(proof.issuer));
      }
      
      setProofs(filteredProofs);
      setIsLoading(false);
    };

    loadProofs();
  }, [generateMockProofs, selectedFilters]);

  const metrics = useMemo(() => {
    const total = proofs.length;
    const verified = proofs.filter(p => p.status === 'verified').length;
    const pending = proofs.filter(p => p.status === 'pending').length;
    const failed = proofs.filter(p => p.status === 'failed').length;
    const avgProcessingTime = proofs.reduce((sum, p) => sum + p.processingTime, 0) / total || 0;
    const avgGasUsed = proofs.reduce((sum, p) => sum + p.gasUsed, 0) / total || 0;
    const avgSize = proofs.reduce((sum, p) => sum + p.size, 0) / total || 0;
    
    return {
      total,
      verified,
      pending,
      failed,
      successRate: total > 0 ? (verified / total) * 100 : 0,
      avgProcessingTime,
      avgGasUsed,
      avgSize,
    };
  }, [proofs]);

  const statusDistributionData: ChartData = {
    labels: ['Verified', 'Pending', 'Failed'],
    datasets: [
      {
        label: 'Proof Status Distribution',
        data: [metrics.verified, metrics.pending, metrics.failed],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(16, 185, 129, 1)',
          'rgba(251, 191, 36, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const typeDistributionData: ChartData = {
    labels: [...new Set(proofs.map(p => p.type))],
    datasets: [
      {
        label: 'Proof Type Distribution',
        data: [...new Set(proofs.map(p => p.type))].map(type => 
          proofs.filter(p => p.type === type).length
        ),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(147, 51, 234, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(34, 197, 94, 0.8)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(147, 51, 234, 1)',
          'rgba(251, 146, 60, 1)',
          'rgba(236, 72, 153, 1)',
          'rgba(34, 197, 94, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const processingTimeData: ChartData = {
    labels: proofs.slice(0, 20).map(p => p.id.split('-')[1]),
    datasets: [
      {
        label: 'Processing Time (seconds)',
        data: proofs.slice(0, 20).map(p => p.processingTime),
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const gasUsageData: ChartData = {
    labels: proofs.slice(0, 20).map(p => p.id.split('-')[1]),
    datasets: [
      {
        label: 'Gas Used',
        data: proofs.slice(0, 20).map(p => p.gasUsed),
        backgroundColor: 'rgba(251, 146, 60, 0.1)',
        borderColor: 'rgba(251, 146, 60, 1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const MetricCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color?: string; subtitle?: string }> = ({
    title,
    value,
    icon,
    color = 'blue',
    subtitle,
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
              title.includes('Time') ? `${value.toFixed(2)}s` :
              title.includes('Gas') ? value.toLocaleString() :
              title.includes('Size') ? `${value.toFixed(0)} KB` :
              value.toLocaleString()
            ) : value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Proof Metrics</h1>
        <div className="flex flex-wrap gap-2">
          <select
            value={timeRange}
            onChange={(e) => {/* Handle time range change */}}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Proofs"
          value={metrics.total}
          icon={<Shield className="w-6 h-6 text-blue-600" />}
          color="blue"
          subtitle="All time"
        />
        <MetricCard
          title="Success Rate"
          value={metrics.successRate}
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          color="green"
          subtitle={`${metrics.verified} verified`}
        />
        <MetricCard
          title="Avg. Processing Time"
          value={metrics.avgProcessingTime}
          icon={<Clock className="w-6 h-6 text-purple-600" />}
          color="purple"
          subtitle="Per proof"
        />
        <MetricCard
          title="Avg. Gas Used"
          value={metrics.avgGasUsed}
          icon={<TrendingUp className="w-6 h-6 text-orange-600" />}
          color="orange"
          subtitle="Gas units"
        />
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Verified"
          value={metrics.verified}
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          color="green"
          subtitle={`${((metrics.verified / metrics.total) * 100).toFixed(1)}%`}
        />
        <MetricCard
          title="Pending"
          value={metrics.pending}
          icon={<AlertTriangle className="w-6 h-6 text-yellow-600" />}
          color="yellow"
          subtitle={`${((metrics.pending / metrics.total) * 100).toFixed(1)}%`}
        />
        <MetricCard
          title="Failed"
          value={metrics.failed}
          icon={<XCircle className="w-6 h-6 text-red-600" />}
          color="red"
          subtitle={`${((metrics.failed / metrics.total) * 100).toFixed(1)}%`}
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Status Distribution</h2>
          <ChartLibrary
            type="doughnut"
            data={statusDistributionData}
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Type Distribution</h2>
          <ChartLibrary
            type="pie"
            data={typeDistributionData}
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Processing Time Trend</h2>
          <ChartLibrary
            type="line"
            data={processingTimeData}
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Gas Usage Pattern</h2>
          <ChartLibrary
            type="bar"
            data={gasUsageData}
            height={300}
            className="w-full"
          />
        </motion.div>
      </div>

      {/* Recent Proofs Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Proofs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Issuer</th>
                <th className="px-6 py-3">Processing Time</th>
                <th className="px-6 py-3">Gas Used</th>
                <th className="px-6 py-3">Size</th>
              </tr>
            </thead>
            <tbody>
              {proofs.slice(0, 10).map((proof) => (
                <tr key={proof.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {proof.id}
                  </td>
                  <td className="px-6 py-4">{proof.type}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      proof.status === 'verified' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      proof.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {proof.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{proof.issuer}</td>
                  <td className="px-6 py-4">{proof.processingTime.toFixed(2)}s</td>
                  <td className="px-6 py-4">{proof.gasUsed.toLocaleString()}</td>
                  <td className="px-6 py-4">{proof.size} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default ProofMetrics;
