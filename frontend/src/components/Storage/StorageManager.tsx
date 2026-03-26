import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, 
  File, 
  HardDrive, 
  Network, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Download,
  Trash2,
  Search,
  Filter,
  BarChart3,
  Settings,
  Eye,
  EyeOff,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface StorageReference {
  id: string;
  storageType: 'ipfs' | 'arweave' | 'hybrid';
  metadata: {
    name?: string;
    mimeType?: string;
    size?: number;
    [key: string]: any;
  };
  redundancyLevel: number;
  createdAt: number;
  lastVerified: number;
  verificationStatus: boolean;
  size: number;
  cost: number;
  tags: string[];
  ipfsRef?: {
    cid: string;
    size: number;
    hash: string;
    timestamp: number;
    pinStatus: boolean;
    replicationFactor: number;
    gatewayUrl: string;
  };
  arweaveRef?: {
    transactionId: string;
    dataHash: string;
    owner: string;
    contentType: string;
    size: number;
    timestamp: number;
    blockHeight: number;
    reward: number;
    tags: Array<{ name: string; value: string }>;
    gatewayUrl: string;
  };
}

interface StorageMetrics {
  totalFiles: number;
  totalSize: number;
  ipfsFiles: number;
  arweaveFiles: number;
  hybridFiles: number;
  verificationRate: number;
  averageRedundancy: number;
  costEfficiency: number;
  cacheHitRate: number;
}

interface StorageManagerProps {
  userId: string;
  onStorageSelect?: (storage: StorageReference) => void;
}

export const StorageManager: React.FC<StorageManagerProps> = ({ 
  userId, 
  onStorageSelect 
}) => {
  const [storageReferences, setStorageReferences] = useState<StorageReference[]>([]);
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedStorage, setSelectedStorage] = useState<StorageReference | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'ipfs' | 'arweave' | 'hybrid'>('all');
  const [showDetails, setShowDetails] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  // Fetch storage data
  const fetchStorageData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Mock API calls - replace with actual API
      const [referencesResponse, metricsResponse] = await Promise.all([
        fetch(`/api/storage/users/${userId}/references`),
        fetch(`/api/storage/metrics`)
      ]);

      if (referencesResponse.ok && metricsResponse.ok) {
        const references = await referencesResponse.json();
        const metrics = await metricsResponse.json();
        
        setStorageReferences(references);
        setMetrics(metrics);
      } else {
        throw new Error('Failed to fetch storage data');
      }
    } catch (error) {
      console.error('Error fetching storage data:', error);
      toast.error('Failed to load storage data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStorageData();
  }, [fetchStorageData]);

  // Handle file upload
  const handleFileUpload = async (files: FileList, storageType: 'ipfs' | 'arweave' | 'hybrid' = 'ipfs') => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const file = files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('storageType', storageType);
      formData.append('userId', userId);

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`File uploaded successfully to ${storageType.toUpperCase()}`);
        await fetchStorageData(); // Refresh the list
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files);
    }
  };

  // Handle storage verification
  const handleVerifyStorage = async (storageId: string) => {
    try {
      const response = await fetch(`/api/storage/${storageId}/verify`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.verified ? 'Storage verified successfully' : 'Storage verification failed');
        await fetchStorageData();
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to verify storage');
    }
  };

  // Handle storage repair
  const handleRepairStorage = async (storageId: string) => {
    try {
      const response = await fetch(`/api/storage/${storageId}/repair`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Storage repair initiated');
        await fetchStorageData();
      } else {
        throw new Error('Repair failed');
      }
    } catch (error) {
      console.error('Repair error:', error);
      toast.error('Failed to repair storage');
    }
  };

  // Handle storage deletion
  const handleDeleteStorage = async (storageId: string) => {
    if (!confirm('Are you sure you want to delete this storage reference?')) {
      return;
    }

    try {
      const response = await fetch(`/api/storage/${storageId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Storage deleted successfully');
        await fetchStorageData();
        setSelectedStorage(null);
      } else {
        throw new Error('Deletion failed');
      }
    } catch (error) {
      console.error('Deletion error:', error);
      toast.error('Failed to delete storage');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Filter storage references
  const filteredReferences = storageReferences.filter(ref => {
    const matchesSearch = searchTerm === '' || 
      ref.metadata.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'all' || ref.storageType === filterType;
    
    return matchesSearch && matchesType;
  });

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format cost
  const formatCost = (cost: number) => {
    return `${cost.toFixed(6)} AR`;
  };

  // Get storage type icon
  const getStorageTypeIcon = (type: string) => {
    switch (type) {
      case 'ipfs':
        return <Network className="w-4 h-4 text-blue-500" />;
      case 'arweave':
        return <HardDrive className="w-4 h-4 text-orange-500" />;
      case 'hybrid':
        return <Shield className="w-4 h-4 text-purple-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
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
      {/* Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Files</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalFiles}</p>
              </div>
              <File className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Size</p>
                <p className="text-2xl font-bold text-gray-900">{formatBytes(metrics.totalSize)}</p>
              </div>
              <HardDrive className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Verification Rate</p>
                <p className="text-2xl font-bold text-gray-900">{(metrics.verificationRate * 100).toFixed(1)}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cache Hit Rate</p>
                <p className="text-2xl font-bold text-gray-900">{(metrics.cacheHitRate * 100).toFixed(1)}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Files</h2>
        
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">Drag and drop files here, or click to select</p>
          <input
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600"
          >
            Select Files
          </label>
          
          {/* Storage Type Selection */}
          <div className="mt-4 flex justify-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="storageType"
                value="ipfs"
                defaultChecked
                className="mr-2"
              />
              <Network className="w-4 h-4 mr-1" />
              IPFS
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="storageType"
                value="arweave"
                className="mr-2"
              />
              <HardDrive className="w-4 h-4 mr-1" />
              Arweave
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="storageType"
                value="hybrid"
                className="mr-2"
              />
              <Shield className="w-4 h-4 mr-1" />
              Hybrid
            </label>
          </div>
        </div>
        
        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Uploading...</span>
              <span className="text-sm text-gray-600">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Storage List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Storage References</h2>
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="ipfs">IPFS</option>
                <option value="arweave">Arweave</option>
                <option value="hybrid">Hybrid</option>
              </select>
              
              <button
                onClick={fetchStorageData}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {filteredReferences.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No storage references found
            </div>
          ) : (
            filteredReferences.map((ref) => (
              <div
                key={ref.id}
                className="p-6 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setSelectedStorage(ref);
                  onStorageSelect?.(ref);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStorageTypeIcon(ref.storageType)}
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {ref.metadata.name || `Storage ${ref.id.slice(-8)}`}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {ref.metadata.mimeType || 'Unknown type'} • {formatBytes(ref.size)}
                      </p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-gray-400">
                          Created: {new Date(ref.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-gray-400">
                          Cost: {formatCost(ref.cost)}
                        </span>
                        <div className="flex items-center space-x-1">
                          {ref.verificationStatus ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-yellow-500" />
                          )}
                          <span className="text-xs text-gray-400">
                            {ref.verificationStatus ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetails(!showDetails);
                      }}
                      className="p-2 text-gray-600 hover:text-gray-900"
                    >
                      {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerifyStorage(ref.id);
                      }}
                      className="p-2 text-gray-600 hover:text-gray-900"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRepairStorage(ref.id);
                      }}
                      className="p-2 text-gray-600 hover:text-gray-900"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteStorage(ref.id);
                      }}
                      className="p-2 text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Detailed Information */}
                {showDetails && selectedStorage?.id === ref.id && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Storage Details</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Storage ID</p>
                        <div className="flex items-center space-x-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{ref.id}</code>
                          <button
                            onClick={() => copyToClipboard(ref.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-600">Redundancy Level</p>
                        <p className="font-medium">{ref.redundancyLevel}x</p>
                      </div>
                      
                      {ref.ipfsRef && (
                        <div>
                          <p className="text-sm text-gray-600">IPFS CID</p>
                          <div className="flex items-center space-x-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{ref.ipfsRef.cid}</code>
                            <button
                              onClick={() => copyToClipboard(ref.ipfsRef.cid)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <a
                              href={ref.ipfsRef.gatewayUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {ref.arweaveRef && (
                        <div>
                          <p className="text-sm text-gray-600">Arweave Transaction</p>
                          <div className="flex items-center space-x-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{ref.arweaveRef.transactionId}</code>
                            <button
                              onClick={() => copyToClipboard(ref.arweaveRef.transactionId)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <a
                              href={ref.arweaveRef.gatewayUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-sm text-gray-600">Tags</p>
                        <div className="flex flex-wrap gap-1">
                          {ref.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-600">Last Verified</p>
                        <p className="font-medium">
                          {new Date(ref.lastVerified).toLocaleDateString()}
                        </p>
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
