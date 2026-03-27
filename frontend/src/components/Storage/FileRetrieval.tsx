import React, { useState, useEffect, useCallback } from 'react';
import { 
  Download, 
  File, 
  Search, 
  Filter, 
  Eye, 
  ExternalLink, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  DownloadCloud,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Code,
  Clock,
  Shield,
  Network,
  HardDrive
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

interface RetrievalOptions {
  verify?: boolean;
  cache?: boolean;
  timeout?: number;
  range?: {
    start: number;
    end: number;
  };
}

interface FileRetrievalProps {
  userId: string;
  onFileSelect?: (storage: StorageReference) => void;
  allowDownload?: boolean;
  showPreview?: boolean;
}

export const FileRetrieval: React.FC<FileRetrievalProps> = ({ 
  userId, 
  onFileSelect,
  allowDownload = true,
  showPreview = true
}) => {
  const [storageReferences, setStorageReferences] = useState<StorageReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<StorageReference | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'ipfs' | 'arweave' | 'hybrid'>('all');
  const [filterMimeType, setFilterMimeType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [previewData, setPreviewData] = useState<{ url: string; type: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch storage data
  const fetchStorageData = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/storage/users/${userId}/references`);
      
      if (response.ok) {
        const references = await response.json();
        setStorageReferences(references);
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

  // Handle file download
  const handleDownload = async (storage: StorageReference, options?: RetrievalOptions) => {
    setDownloading(storage.id);
    
    try {
      const response = await fetch(`/api/storage/${storage.id}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options || {}),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = storage.metadata.name || `file_${storage.id.slice(-8)}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('File downloaded successfully');
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    } finally {
      setDownloading(null);
    }
  };

  // Handle file preview
  const handlePreview = async (storage: StorageReference) => {
    if (!showPreview) return;
    
    setPreviewLoading(true);
    setSelectedFile(storage);
    
    try {
      const response = await fetch(`/api/storage/${storage.id}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setPreviewData({ url, type: storage.metadata.mimeType || 'application/octet-stream' });
      } else {
        throw new Error('Preview failed');
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Get file icon based on MIME type
  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <File className="w-5 h-5 text-gray-400" />;
    
    if (mimeType.startsWith('image/')) return <Image className="w-5 h-5 text-green-500" />;
    if (mimeType.startsWith('video/')) return <Video className="w-5 h-5 text-purple-500" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-pink-500" />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return <Archive className="w-5 h-5 text-orange-500" />;
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript')) return <Code className="w-5 h-5 text-blue-500" />;
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return <FileText className="w-5 h-5 text-red-500" />;
    
    return <File className="w-5 h-5 text-gray-400" />;
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

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  // Filter and sort storage references
  const filteredAndSortedReferences = storageReferences
    .filter(ref => {
      const matchesSearch = searchTerm === '' || 
        ref.metadata.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ref.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = filterType === 'all' || ref.storageType === filterType;
      const matchesMimeType = filterMimeType === 'all' || 
        (ref.metadata.mimeType && ref.metadata.mimeType.startsWith(filterMimeType));
      
      return matchesSearch && matchesType && matchesMimeType;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = (a.metadata.name || '').localeCompare(b.metadata.name || '');
          break;
        case 'date':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          comparison = (a.metadata.mimeType || '').localeCompare(b.metadata.mimeType || '');
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Get unique MIME type prefixes for filter
  const mimeTypeOptions = Array.from(new Set(
    storageReferences
      .map(ref => ref.metadata.mimeType?.split('/')[0])
      .filter(Boolean)
  ));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">File Retrieval</h2>
        
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search files by name or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Storage Types</option>
              <option value="ipfs">IPFS</option>
              <option value="arweave">Arweave</option>
              <option value="hybrid">Hybrid</option>
            </select>
            
            <select
              value={filterMimeType}
              onChange={(e) => setFilterMimeType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All File Types</option>
              {mimeTypeOptions.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="size">Sort by Size</option>
              <option value="type">Sort by Type</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* File List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Files ({filteredAndSortedReferences.length})
            </h3>
            <button
              onClick={fetchStorageData}
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {filteredAndSortedReferences.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No files found matching your criteria
            </div>
          ) : (
            filteredAndSortedReferences.map((ref) => (
              <div
                key={ref.id}
                className="p-6 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    {getFileIcon(ref.metadata.mimeType)}
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">
                          {ref.metadata.name || `File ${ref.id.slice(-8)}`}
                        </h3>
                        {getStorageTypeIcon(ref.storageType)}
                        {ref.verificationStatus ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-500">
                          {ref.metadata.mimeType || 'Unknown type'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatBytes(ref.size)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDate(ref.createdAt)}
                        </span>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">
                            Verified: {formatDate(ref.lastVerified)}
                          </span>
                        </div>
                      </div>
                      
                      {ref.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ref.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {showPreview && (
                      <button
                        onClick={() => handlePreview(ref)}
                        disabled={previewLoading}
                        className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    
                    {allowDownload && (
                      <button
                        onClick={() => handleDownload(ref)}
                        disabled={downloading === ref.id}
                        className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                      >
                        {downloading === ref.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    
                    <button
                      onClick={() => copyToClipboard(ref.id)}
                      className="p-2 text-gray-600 hover:text-gray-900"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    
                    {ref.ipfsRef && (
                      <a
                        href={ref.ipfsRef.gatewayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-600 hover:text-gray-900"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    
                    {ref.arweaveRef && (
                      <a
                        href={ref.arweaveRef.gatewayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-600 hover:text-gray-900"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    
                    <button
                      onClick={() => {
                        setSelectedFile(ref);
                        onFileSelect?.(ref);
                      }}
                      className="p-2 text-gray-600 hover:text-gray-900"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {selectedFile && showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedFile.metadata.name || 'File Preview'}
                </h3>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewData(null);
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {previewLoading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : previewData ? (
                <div className="space-y-4">
                  {/* File Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Type:</span> {selectedFile.metadata.mimeType}
                    </div>
                    <div>
                      <span className="text-gray-600">Size:</span> {formatBytes(selectedFile.size)}
                    </div>
                    <div>
                      <span className="text-gray-600">Storage:</span> {selectedFile.storageType.toUpperCase()}
                    </div>
                    <div>
                      <span className="text-gray-600">Created:</span> {formatDate(selectedFile.createdAt)}
                    </div>
                  </div>
                  
                  {/* Preview Content */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {previewData.type.startsWith('image/') ? (
                      <img
                        src={previewData.url}
                        alt="Preview"
                        className="w-full h-auto max-h-96 object-contain"
                      />
                    ) : previewData.type.startsWith('video/') ? (
                      <video
                        src={previewData.url}
                        controls
                        className="w-full max-h-96"
                      />
                    ) : previewData.type.startsWith('audio/') ? (
                      <audio
                        src={previewData.url}
                        controls
                        className="w-full"
                      />
                    ) : previewData.type.startsWith('text/') || previewData.type.includes('json') ? (
                      <iframe
                        src={previewData.url}
                        className="w-full h-96"
                        title="File Preview"
                      />
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p>Preview not available for this file type</p>
                        <button
                          onClick={() => handleDownload(selectedFile)}
                          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                          Download File
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  Failed to load preview
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
