import React from 'react';
import { useOffline } from '../../hooks/useOffline';

export const SyncStatus: React.FC = () => {
  const { syncStatus, isOnline, pendingItemsCount } = useOffline();

  if (!isOnline && pendingItemsCount > 0) {
    return (
      <div className="text-sm text-yellow-600 font-medium">
        {pendingItemsCount} item(s) pending sync
      </div>
    );
  }

  if (syncStatus === 'syncing') {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-600">
        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
        Syncing data...
      </div>
    );
  }

  if (syncStatus === 'synced') {
    return <div className="text-sm text-green-600 font-medium">All changes synced</div>;
  }

  if (syncStatus === 'error') {
    return (
      <div className="text-sm text-red-600 font-medium">
        Sync failed. Will retry automatically.
      </div>
    );
  }

  return null; // Idle
};
export default SyncStatus;