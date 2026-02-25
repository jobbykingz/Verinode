import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  className?: string;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = '',
  showRefreshButton = true,
  onRefresh
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const updateConnectionStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      
      if (!online) {
        setShowOfflineMessage(true);
      } else {
        // Hide offline message after a delay when coming back online
        setTimeout(() => setShowOfflineMessage(false), 3000);
      }

      // Get connection type if available
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      
      if (connection) {
        setConnectionType(connection.effectiveType || 'unknown');
      }
    };

    const handleOnline = () => updateConnectionStatus();
    const handleOffline = () => updateConnectionStatus();

    // Listen for connection changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection type changes if available
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateConnectionStatus);
    }

    // Initial status
    updateConnectionStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnectionStatus);
      }
    };
  }, []);

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  const getConnectionQuality = () => {
    switch (connectionType) {
      case '4g':
        return { color: 'text-green-500', label: '4G - Excellent' };
      case '3g':
        return { color: 'text-yellow-500', label: '3G - Good' };
      case '2g':
        return { color: 'text-orange-500', label: '2G - Slow' };
      case 'slow-2g':
        return { color: 'text-red-500', label: '2G - Very Slow' };
      default:
        return { color: 'text-gray-500', label: 'Unknown' };
    }
  };

  const connectionQuality = getConnectionQuality();

  if (isOnline && !showOfflineMessage) {
    return (
      <div className={`flex items-center space-x-2 text-sm ${className}`}>
        <Wifi size={16} className="text-green-500" />
        <span className="text-green-500">Online</span>
        {connectionType !== 'unknown' && (
          <span className={`text-xs ${connectionQuality.color}`}>
            ({connectionQuality.label})
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Offline Banner */}
      {showOfflineMessage && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white z-50">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center space-x-3">
                <WifiOff size={20} />
                <div>
                  <p className="font-semibold">You're offline</p>
                  <p className="text-sm opacity-90">
                    Some features may be limited. Cached data is available.
                  </p>
                </div>
              </div>
              {showRefreshButton && (
                <button
                  onClick={handleRefresh}
                  className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-sm font-medium flex items-center space-x-1 transition-colors"
                >
                  <RefreshCw size={14} />
                  <span>Refresh</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compact Offline Indicator */}
      {!showOfflineMessage && !isOnline && (
        <div className={`flex items-center space-x-2 text-sm ${className}`}>
          <WifiOff size={16} className="text-red-500" />
          <span className="text-red-500">Offline</span>
          <AlertCircle size={14} className="text-yellow-500" />
        </div>
      )}
    </>
  );
};

export default OfflineIndicator;
