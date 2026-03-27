import { useState, useEffect } from 'react';
import { offlineStore, OfflineState } from '../storage/offlineStore';
import { SyncManager } from '../services/offline/SyncManager';

export const useOffline = (): OfflineState => {
  const [state, setState] = useState<OfflineState>(offlineStore.getState());

  useEffect(() => {
    const unsubscribe = offlineStore.subscribe(setState);

    const handleOnline = () => {
      offlineStore.setState({ isOnline: true });
      SyncManager.startSync();
    };

    const handleOffline = () => {
      offlineStore.setState({ isOnline: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return state;
};