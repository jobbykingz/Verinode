import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Save,
  HardDrive,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Shield,
  Download,
  Upload,
  Trash2,
  Search,
  Layers,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PersistenceRecord {
  proofId: string;
  storageId: string;
  persistedAt: number;
  storageType: 'ipfs' | 'arweave' | 'hybrid';
  verified: boolean;
  size: number;
  cost: number;
  attempts: number;
  duration: number;
}

interface PersistenceMetrics {
  totalProofs: number;
  totalSize: number;
  averagePersistTime: number;
  persistenceSuccessRate: number;
  compressionRatio: number;
  deduplicationRate: number;
  cacheHitRate: number;
  averageRetries: number;
}

interface PersistencePanelProps {
  userId: string;
  onProofSelect?: (proofId: string) => void;
}

export const PersistencePanel: React.FC<PersistencePanelProps> = ({ userId, onProofSelect }) => {
  const [records, setRecords] = useState<PersistenceRecord[]>([]);
  const [metrics, setMetrics] = useState<PersistenceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [persisting, setPersisting] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PersistenceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'unverified'>('all');
  const [showMetrics, setShowMetrics] = useState(true);

  // Fetch persistence data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [recordsResponse, metricsResponse] = await Promise.all([
        fetch(`/api/storage-applications/persistence/${userId}/records`),
        fetch(`/api/storage-applications/persistence/metrics`),
      ]);

      if (recordsResponse.ok && metricsResponse.ok) {
        const recordsData = await recordsResponse.json();
        const metricsData = await metricsResponse.json();
        setRecords(recordsData);
        setMetrics(metricsData);
      } else {
        throw new Error('Failed to fetch persistence data');
      }
    } catch (error) {
      console.error('Error fetching persistence data:', error);
      toast.error('Failed to load persistence data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle new proof persistence
  const handlePersistProof = async () => {
    setPersisting(true);
    try {
      const response = await fetch('/api/storage-applications/persistence/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          proofType: 'verinode-proof',
          tags: ['manual', 'persistence'],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Proof persisted successfully (${result.duration}ms)`);
        await fetchData();
      } else {
        throw new Error('Persistence failed');
      }
    } catch (error) {
      console.error('Persistence error:', error);
      toast.error('Failed to persist proof data');
    } finally {
      setPersisting(false);
    }
  };

  // Handle verification
  const handleVerify = async (proofId: string) => {
    try {
      const response = await fetch(`/api/storage-applications/persistence/${proofId}/verify`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.verified ? 'Proof persistence verified' : 'Verification failed');
        await fetchData();
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to verify proof persistence');
    }
  };

  // Handle backup
  const handleBackup = async () => {
    try {
      const response = await fetch('/api/storage-applications/persistence/backup', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Persistence backup completed');
        await fetchData();
      } else {
        throw new Error('Backup failed');
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('Failed to create backup');
    }
  };

  // Handle delete
  const handleDelete = async (proofId: string) => {
    if (!confirm('Are you sure you want to delete this persisted proof?')) return;

    try {
      const response = await fetch(`/api/storage-applications/persistence/${proofId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Proof persistence record deleted');
        await fetchData();
        setSelectedRecord(null);
      } else {
        throw new Error('Deletion failed');
      }
    } catch (error) {
      console.error('Deletion error:', error);
      toast.error('Failed to delete persistence record');
    }
  };

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Get storage type icon
  const getStorageTypeIcon = (type: string) => {
    switch (type) {
      case 'ipfs':
        return <HardDrive className="w-4 h-4 text-blue-500" />;
      case 'arweave':
        return <Database className="w-4 h-4 text-orange-500" />;
      case 'hybrid':
        return <Shield className="w-4 h-4 text-purple-500" />;
      default:
        return <HardDrive className="w-4 h-4 text-gray-500" />;
    }
  };

  // Filter records
  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      searchTerm === '' || r.proofId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'verified' && r.verified) ||
      (filterStatus === 'unverified' && !r.verified);
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      {showMetrics && metrics && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Persistence Efficiency Metrics
            </h2>
            <button
              onClick={() => setShowMetrics(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Hide
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Total Proofs</p>
                  <p className="text-xl font-bold text-gray-900">{metrics.totalProofs}</p>
                </div>
                <Database className="w-6 h-6 text-blue-500 opacity-50" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Success Rate</p>
                  <p className="text-xl font-bold text-gray-900">
                    {(metrics.persistenceSuccessRate * 100).toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 text-green-500 opacity-50" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Avg. Persist Time</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatDuration(metrics.averagePersistTime)}
                  </p>
                </div>
                <Zap className="w-6 h-6 text-purple-500 opacity-50" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Total Size</p>
                  <p className="text-xl font-bold text-gray-900">{formatBytes(metrics.totalSize)}</p>
                </div>
                <Layers className="w-6 h-6 text-orange-500 opacity-50" />
              </div>
            </div>
          </div>

          {/* Efficiency sub-metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Compression Ratio</span>
                <span className="text-sm font-medium text-gray-900">
                  {(metrics.compressionRatio * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full"
                  style={{ width: `${metrics.compressionRatio * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Deduplication Rate</span>
                <span className="text-sm font-medium text-gray-900">
                  {(metrics.deduplicationRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full"
                  style={{ width: `${metrics.deduplicationRate * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Cache Hit Rate</span>
                <span className="text-sm font-medium text-gray-900">
                  {(metrics.cacheHitRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-purple-500 h-1.5 rounded-full"
                  style={{ width: `${metrics.cacheHitRate * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Save className="w-5 h-5 text-blue-500" />
            Proof Data Persistence
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePersistProof}
              disabled={persisting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {persisting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Persist New Proof
            </button>

            <button
              onClick={handleBackup}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              Backup
            </button>

            <button
              onClick={fetchData}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by proof ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>

          {!showMetrics && metrics && (
            <button
              onClick={() => setShowMetrics(true)}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <BarChart3 className="w-4 h-4" />
              Show Metrics
            </button>
          )}
        </div>
      </div>

      {/* Records List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500">
            {filteredRecords.length} persistence record{filteredRecords.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No persistence records found</p>
              <p className="text-sm text-gray-400 mt-1">
                Persist a proof to get started
              </p>
            </div>
          ) : (
            filteredRecords.map((record) => (
              <div
                key={record.proofId}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedRecord?.proofId === record.proofId ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => {
                  setSelectedRecord(record);
                  onProofSelect?.(record.proofId);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStorageTypeIcon(record.storageType)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {record.proofId}
                        </span>
                        {record.verified ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatBytes(record.size)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(record.persistedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {formatDuration(record.duration)}
                        </span>
                        {record.attempts > 1 && (
                          <span className="text-yellow-600">{record.attempts} attempts</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerify(record.proofId);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                      title="Verify persistence"
                    >
                      <Shield className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(record.proofId);
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {selectedRecord?.proofId === record.proofId && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Storage ID:</span>
                        <p className="font-mono text-xs text-gray-700 truncate">{record.storageId}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Type:</span>
                        <p className="font-medium capitalize">{record.storageType}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <p className={`font-medium ${record.verified ? 'text-green-600' : 'text-yellow-600'}`}>
                          {record.verified ? 'Verified' : 'Unverified'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Cost:</span>
                        <p className="font-medium">{record.cost.toFixed(6)} AR</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Attempts:</span>
                        <p className="font-medium">{record.attempts}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <p className="font-medium">{formatDuration(record.duration)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
