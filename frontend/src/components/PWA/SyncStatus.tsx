import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, CheckCircle, AlertCircle, RefreshCw, X } from 'lucide-react';

interface SyncStatusProps {
  className?: string;
  showDetails?: boolean;
}

interface SyncItem {
  id: string;
  type: 'proof' | 'verification' | 'update';
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  timestamp: number;
  error?: string;
}

const SyncStatus: React.FC<SyncStatusProps> = ({
  className = '',
  showDetails = false
}) => {
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Load sync items from IndexedDB
    loadSyncItems();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    // Auto-sync when coming back online
    if (isOnline && syncItems.some(item => item.status === 'pending')) {
      syncPendingItems();
    }
  }, [isOnline]);

  const loadSyncItems = async () => {
    try {
      const items = await getSyncItemsFromDB();
      setSyncItems(items);
      
      // Get last sync time
      const lastSync = localStorage.getItem('last-sync-time');
      if (lastSync) {
        setLastSyncTime(parseInt(lastSync));
      }
    } catch (error) {
      console.error('Failed to load sync items:', error);
    }
  };

  const syncPendingItems = async () => {
    const pendingItems = syncItems.filter(item => item.status === 'pending');
    
    for (const item of pendingItems) {
      try {
        // Update item status to syncing
        updateSyncItemStatus(item.id, 'syncing');
        
        // Perform the actual sync based on item type
        await performSync(item);
        
        // Update to completed
        updateSyncItemStatus(item.id, 'completed');
        
        // Remove completed items after a delay
        setTimeout(() => {
          removeSyncItem(item.id);
        }, 3000);
        
      } catch (error) {
        updateSyncItemStatus(item.id, 'failed', error.message);
      }
    }
    
    // Update last sync time
    const now = Date.now();
    setLastSyncTime(now);
    localStorage.setItem('last-sync-time', now.toString());
  };

  const updateSyncItemStatus = (id: string, status: SyncItem['status'], error?: string) => {
    setSyncItems(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, status, error, timestamp: Date.now() }
          : item
      )
    );
  };

  const removeSyncItem = (id: string) => {
    setSyncItems(prev => prev.filter(item => item.id !== id));
  };

  const performSync = async (item: SyncItem): Promise<void> => {
    // Simulate sync delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // In a real implementation, this would make actual API calls
    switch (item.type) {
      case 'proof':
        // Sync proof data
        console.log('Syncing proof:', item.id);
        break;
      case 'verification':
        // Sync verification status
        console.log('Syncing verification:', item.id);
        break;
      case 'update':
        // Sync updates
        console.log('Syncing update:', item.id);
        break;
    }
    
    // Simulate occasional failures for demo
    if (Math.random() < 0.1) {
      throw new Error('Network error during sync');
    }
  };

  const getSyncItemsFromDB = async (): Promise<SyncItem[]> => {
    // In a real implementation, this would query IndexedDB
    // For now, return mock data
    return [
      {
        id: '1',
        type: 'proof',
        status: 'pending',
        timestamp: Date.now() - 5000
      },
      {
        id: '2',
        type: 'verification',
        status: 'completed',
        timestamp: Date.now() - 10000
      }
    ];
  };

  const pendingCount = syncItems.filter(item => item.status === 'pending').length;
  const syncingCount = syncItems.filter(item => item.status === 'syncing').length;
  const failedCount = syncItems.filter(item => item.status === 'failed').length;

  const getStatusIcon = () => {
    if (!isOnline) {
      return <CloudOff size={16} className="text-red-500" />;
    }
    
    if (syncingCount > 0) {
      return <RefreshCw size={16} className="text-blue-500 animate-spin" />;
    }
    
    if (pendingCount > 0) {
      return <Cloud size={16} className="text-yellow-500" />;
    }
    
    if (failedCount > 0) {
      return <AlertCircle size={16} className="text-orange-500" />;
    }
    
    return <CheckCircle size={16} className="text-green-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) {
      return 'Offline';
    }
    
    if (syncingCount > 0) {
      return `Syncing (${syncingCount})`;
    }
    
    if (pendingCount > 0) {
      return `Pending (${pendingCount})`;
    }
    
    if (failedCount > 0) {
      return `Failed (${failedCount})`;
    }
    
    return 'Synced';
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    
    const now = Date.now();
    const diff = now - lastSyncTime;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Status Indicator */}
      <button
        onClick={() => setShowSyncPanel(!showSyncPanel)}
        className="flex items-center space-x-2 text-sm hover:bg-gray-100 p-2 rounded-md transition-colors"
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
        {showDetails && (
          <span className="text-xs text-gray-500">
            Last sync: {formatLastSync()}
          </span>
        )}
      </button>

      {/* Sync Panel */}
      {showSyncPanel && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Sync Status</h3>
              <button
                onClick={() => setShowSyncPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Connection Status */}
            <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-md">
              <span className="text-sm font-medium">Connection</span>
              <span className={`text-sm ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Sync Items */}
            {syncItems.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Items to Sync</h4>
                {syncItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      {item.status === 'pending' && <Cloud size={14} className="text-yellow-500" />}
                      {item.status === 'syncing' && <RefreshCw size={14} className="text-blue-500 animate-spin" />}
                      {item.status === 'completed' && <CheckCircle size={14} className="text-green-500" />}
                      {item.status === 'failed' && <AlertCircle size={14} className="text-red-500" />}
                      
                      <span className="text-sm capitalize">{item.type}</span>
                    </div>
                    
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      item.status === 'syncing' ? 'bg-blue-100 text-blue-700' :
                      item.status === 'completed' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                All items are synced
              </p>
            )}

            {/* Actions */}
            {isOnline && pendingCount > 0 && (
              <button
                onClick={syncPendingItems}
                className="w-full mt-4 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Sync Now ({pendingCount} items)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatus;
