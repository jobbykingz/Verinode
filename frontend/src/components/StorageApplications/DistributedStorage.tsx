import React, { useState, useEffect, useCallback } from 'react';
import {
  Network,
  Server,
  HardDrive,
  Shield,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Users,
  Activity,
  Zap,
  Gift,
  BarChart3,
  Search,
  Plus,
  Gauge,
  Wifi,
  WifiOff,
  PieChart,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface StorageNode {
  id: string;
  address: string;
  region: string;
  capacity: number;
  usedStorage: number;
  status: 'online' | 'offline' | 'syncing';
  latency: number;
  reliability: number;
  incentives: number;
  lastHeartbeat: number;
}

interface DistributionResult {
  storageId: string;
  chunks: number;
  nodes: string[];
  replicas: number;
  totalSize: number;
  distributedAt: number;
  storageType: string;
}

interface IncentiveRecord {
  nodeId: string;
  totalRewards: number;
  pendingRewards: number;
  dataStored: number;
  uptimePercentage: number;
  lastPayout: number;
}

interface DistributionMetrics {
  totalNodes: number;
  onlineNodes: number;
  totalChunks: number;
  totalDataStored: number;
  averageRedundancy: number;
  networkUtilization: number;
}

interface DistributedStorageProps {
  userId: string;
  onNodeSelect?: (nodeId: string) => void;
}

export const DistributedStorage: React.FC<DistributedStorageProps> = ({ userId, onNodeSelect }) => {
  const [nodes, setNodes] = useState<StorageNode[]>([]);
  const [distributions, setDistributions] = useState<DistributionResult[]>([]);
  const [incentives, setIncentives] = useState<IncentiveRecord[]>([]);
  const [metrics, setMetrics] = useState<DistributionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<StorageNode | null>(null);
  const [selectedDistribution, setSelectedDistribution] = useState<DistributionResult | null>(null);
  const [view, setView] = useState<'overview' | 'nodes' | 'distributions' | 'incentives'>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [nodesRes, distRes, incRes, metricsRes] = await Promise.all([
        fetch(`/api/storage-applications/distributed/nodes`),
        fetch(`/api/storage-applications/distributed/distributions/${userId}`),
        fetch(`/api/storage-applications/distributed/incentives`),
        fetch(`/api/storage-applications/distributed/metrics`),
      ]);

      if (nodesRes.ok) setNodes(await nodesRes.json());
      if (distRes.ok) setDistributions(await distRes.json());
      if (incRes.ok) setIncentives(await incRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
    } catch (error) {
      console.error('Error fetching distributed storage data:', error);
      toast.error('Failed to load distributed storage data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Register a new node
  const handleRegisterNode = async () => {
    try {
      const response = await fetch('/api/storage-applications/distributed/nodes/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        toast.success('Storage node registered');
        await fetchData();
      } else {
        throw new Error('Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to register node');
    }
  };

  // Distribute incentives
  const handleDistributeIncentives = async () => {
    try {
      const response = await fetch('/api/storage-applications/distributed/incentives/distribute', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Incentives distributed');
        await fetchData();
      } else {
        throw new Error('Incentive distribution failed');
      }
    } catch (error) {
      console.error('Incentive error:', error);
      toast.error('Failed to distribute incentives');
    }
  };

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Format uptime
  const formatUptime = (seconds: number): string => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Get node status icon
  const getNodeStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'offline':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  // Get reliability color
  const getReliabilityColor = (reliability: number): string => {
    if (reliability >= 0.95) return 'text-green-600';
    if (reliability >= 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {(['overview', 'nodes', 'distributions', 'incentives'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 py-3 px-4 text-center text-sm font-medium border-b-2 transition-colors ${
                  view === v
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {v === 'overview' && 'Overview'}
                {v === 'nodes' && `Nodes (${nodes.length})`}
                {v === 'distributions' && `Distributions (${distributions.length})`}
                {v === 'incentives' && 'Incentives'}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Overview View */}
      {view === 'overview' && metrics && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <Server className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{metrics.totalNodes}</p>
              <p className="text-xs text-gray-500">Total Nodes</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <Wifi className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{metrics.onlineNodes}</p>
              <p className="text-xs text-gray-500">Online</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <HardDrive className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{metrics.totalChunks}</p>
              <p className="text-xs text-gray-500">Chunks</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <Network className="w-6 h-6 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {metrics.averageRedundancy.toFixed(1)}x
              </p>
              <p className="text-xs text-gray-500">Avg Redundancy</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <PieChart className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {(metrics.networkUtilization * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">Utilization</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <Activity className="w-6 h-6 text-teal-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {formatBytes(metrics.totalDataStored)}
              </p>
              <p className="text-xs text-gray-500">Data Stored</p>
            </div>
          </div>

          {/* Network Health */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Health</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Node Availability</span>
                  <span className="font-medium text-gray-900">
                    {metrics.onlineNodes}/{metrics.totalNodes}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${metrics.totalNodes > 0 ? (metrics.onlineNodes / metrics.totalNodes) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Network Utilization</span>
                  <span className="font-medium text-gray-900">
                    {(metrics.networkUtilization * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(metrics.networkUtilization * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleRegisterNode}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Register Node
            </button>
            <button
              onClick={handleDistributeIncentives}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Gift className="w-4 h-4" />
              Distribute Incentives
            </button>
            <button
              onClick={fetchData}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Nodes View */}
      {view === 'nodes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleRegisterNode}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Register Node
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="divide-y divide-gray-200">
              {nodes
                .filter((n) =>
                  searchTerm === '' ||
                  n.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  n.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  n.region.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((node) => (
                  <div
                    key={node.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedNode?.id === node.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedNode(node);
                      onNodeSelect?.(node.id);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Server className="w-8 h-8 text-gray-400" />
                          <div className="absolute -bottom-1 -right-1">
                            {getNodeStatusIcon(node.status)}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-gray-900">
                              {node.id}
                            </span>
                            <span className={`text-xs ${getReliabilityColor(node.reliability)}`}>
                              {(node.reliability * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span>{node.address}</span>
                            <span>•</span>
                            <span>{node.region}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Gauge className="w-3 h-3" />
                              {node.latency}ms
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatBytes(node.usedStorage)} / {formatBytes(node.capacity)}
                          </div>
                          <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                node.usedStorage / node.capacity > 0.8
                                  ? 'bg-red-500'
                                  : node.usedStorage / node.capacity > 0.5
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min((node.usedStorage / node.capacity) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        {node.incentives > 0 && (
                          <div className="text-right">
                            <div className="text-sm font-medium text-green-600">
                              {node.incentives.toFixed(4)} AR
                            </div>
                            <div className="text-xs text-gray-400">Earned</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Node Details */}
                    {selectedNode?.id === node.id && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">Status:</span>
                            <p className="font-medium capitalize flex items-center gap-1">
                              {getNodeStatusIcon(node.status)}
                              {node.status}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Region:</span>
                            <p className="font-medium">{node.region}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Latency:</span>
                            <p className="font-medium">{node.latency}ms</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Heartbeat:</span>
                            <p className="font-medium">{formatDate(node.lastHeartbeat)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

              {nodes.length === 0 && (
                <div className="p-8 text-center">
                  <Server className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No storage nodes registered</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Register nodes to enable distributed storage
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Distributions View */}
      {view === 'distributions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="divide-y divide-gray-200">
              {distributions.map((dist) => (
                <div
                  key={dist.storageId}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedDistribution?.storageId === dist.storageId ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedDistribution(dist)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Network className="w-6 h-6 text-purple-500" />
                      <div>
                        <span className="font-mono text-sm font-medium text-gray-900 block">
                          {dist.storageId.slice(0, 24)}...
                        </span>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span>{formatBytes(dist.totalSize)}</span>
                          <span>•</span>
                          <span>{dist.chunks} chunks</span>
                          <span>•</span>
                          <span>{dist.replicas} replicas</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatDate(dist.distributedAt)}</p>
                      <p className="text-sm font-medium capitalize text-gray-600">
                        {dist.storageType}
                      </p>
                    </div>
                  </div>

                  {/* Distribution Details */}
                  {selectedDistribution?.storageId === dist.storageId && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Distribution Nodes</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {dist.nodes.map((nodeId) => {
                          const node = nodes.find((n) => n.id === nodeId);
                          return (
                            <div
                              key={nodeId}
                              className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs"
                            >
                              {node ? getNodeStatusIcon(node.status) : <Server className="w-3 h-3" />}
                              <span className="font-mono truncate">{nodeId}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {distributions.length === 0 && (
                <div className="p-8 text-center">
                  <Network className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No distributions yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Distribute data to see it here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Incentives View */}
      {view === 'incentives' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Storage Incentives</h3>
            <button
              onClick={handleDistributeIncentives}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
            >
              <Gift className="w-4 h-4" />
              Process Payouts
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incentives.map((record) => {
              const node = nodes.find((n) => n.id === record.nodeId);
              return (
                <div key={record.nodeId} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-gray-400" />
                      <span className="font-mono text-sm font-medium">{record.nodeId}</span>
                    </div>
                    {node && getNodeStatusIcon(node.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Total Earned</span>
                      <p className="font-bold text-green-600">
                        {record.totalRewards.toFixed(4)} AR
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Pending</span>
                      <p className="font-bold text-yellow-600">
                        {record.pendingRewards.toFixed(4)} AR
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Data Stored</span>
                      <p className="font-medium">{formatBytes(record.dataStored)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Uptime</span>
                      <p className="font-medium">{record.uptimePercentage.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Uptime</span>
                      <span>{record.uptimePercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          record.uptimePercentage >= 99
                            ? 'bg-green-500'
                            : record.uptimePercentage >= 90
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${record.uptimePercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-400">
                    Last payout: {formatDate(record.lastPayout)}
                  </div>
                </div>
              );
            })}

            {incentives.length === 0 && (
              <div className="md:col-span-2 p-8 text-center">
                <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No incentive records yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Incentives will be calculated when nodes store data
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
