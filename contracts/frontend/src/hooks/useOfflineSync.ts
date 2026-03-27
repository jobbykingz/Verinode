import { useState, useEffect, useCallback } from 'react';

interface OfflineAction {
  id: string;
  type: 'proof-verification' | 'proof-update' | 'verification-status';
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
}

interface SyncStatus {
  isOnline: boolean;
  pendingActions: number;
  lastSyncTime: number | null;
  isSyncing: boolean;
  error: string | null;
}

interface UseOfflineSyncReturn extends SyncStatus {
  queueAction: (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) => Promise<void>;
  syncActions: () => Promise<void>;
  clearQueue: () => Promise<void>;
  getQueuedActions: () => Promise<OfflineAction[]>;
  retryFailedActions: () => Promise<void>;
}

const DB_NAME = 'verinode-offline';
const DB_VERSION = 1;
const STORE_NAME = 'offline-actions';

const useOfflineSync = (): UseOfflineSyncReturn => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    pendingActions: 0,
    lastSyncTime: null,
    isSyncing: false,
    error: null
  });

  // Initialize IndexedDB
  const initDB = useCallback(async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }, []);

  // Get all queued actions
  const getQueuedActions = useCallback(async (): Promise<OfflineAction[]> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get queued actions:', error);
      return [];
    }
  }, [initDB]);

  // Add action to queue
  const queueAction = useCallback(async (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const offlineAction: OfflineAction = {
        ...action,
        id: generateId(),
        timestamp: Date.now(),
        retryCount: 0
      };

      const request = store.add(offlineAction);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('Action queued for offline sync:', offlineAction.id);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to queue action:', error);
      throw error;
    }
  }, [initDB]);

  // Remove action from queue
  const removeAction = useCallback(async (id: string): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to remove action:', error);
      throw error;
    }
  }, [initDB]);

  // Update action retry count
  const updateRetryCount = useCallback(async (id: string, retryCount: number): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.retryCount = retryCount;
          store.put(action);
        }
      };
    } catch (error) {
      console.error('Failed to update retry count:', error);
    }
  }, [initDB]);

  // Sync all pending actions
  const syncActions = useCallback(async (): Promise<void> => {
    if (!navigator.onLine) {
      console.log('Offline - skipping sync');
      return;
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const actions = await getQueuedActions();
      
      for (const action of actions) {
        try {
          await executeAction(action);
          await removeAction(action.id);
          console.log('Synced action:', action.id);
        } catch (error) {
          console.error('Failed to sync action:', action.id, error);
          
          // Update retry count
          await updateRetryCount(action.id, action.retryCount + 1);
          
          // Remove action if it has failed too many times
          if (action.retryCount >= 3) {
            await removeAction(action.id);
            console.log('Removed failed action after 3 retries:', action.id);
          }
        }
      }

      const remainingActions = await getQueuedActions();
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        pendingActions: remainingActions.length,
        lastSyncTime: Date.now()
      }));

    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: error.message
      }));
    }
  }, [getQueuedActions, removeAction, updateRetryCount]);

  // Execute a single action
  const executeAction = async (action: OfflineAction): Promise<void> => {
    const options: RequestInit = {
      method: action.method,
      headers: {
        'Content-Type': 'application/json',
        ...action.headers
      }
    };

    if (action.data && (action.method === 'POST' || action.method === 'PUT')) {
      options.body = JSON.stringify(action.data);
    }

    const response = await fetch(action.url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  };

  // Clear all queued actions
  const clearQueue = useCallback(async (): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('Offline queue cleared');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear queue:', error);
      throw error;
    }
  }, [initDB]);

  // Retry failed actions
  const retryFailedActions = useCallback(async (): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Reset retry count for all actions
      const request = store.getAll();
      request.onsuccess = () => {
        const actions = request.result || [];
        actions.forEach(action => {
          action.retryCount = 0;
          store.put(action);
        });
      };

      await syncActions();
    } catch (error) {
      console.error('Failed to retry actions:', error);
      throw error;
    }
  }, [initDB, syncActions]);

  // Update pending actions count
  const updatePendingCount = useCallback(async () => {
    try {
      const actions = await getQueuedActions();
      setSyncStatus(prev => ({
        ...prev,
        pendingActions: actions.length
      }));
    } catch (error) {
      console.error('Failed to update pending count:', error);
    }
  }, [getQueuedActions]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      syncActions(); // Auto-sync when coming back online
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncActions]);

  // Initialize and update pending count
  useEffect(() => {
    updatePendingCount();
    
    // Load last sync time from localStorage
    const lastSync = localStorage.getItem('last-sync-time');
    if (lastSync) {
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: parseInt(lastSync)
      }));
    }
  }, [updatePendingCount]);

  // Save last sync time to localStorage
  useEffect(() => {
    if (syncStatus.lastSyncTime) {
      localStorage.setItem('last-sync-time', syncStatus.lastSyncTime.toString());
    }
  }, [syncStatus.lastSyncTime]);

  return {
    ...syncStatus,
    queueAction,
    syncActions,
    clearQueue,
    getQueuedActions,
    retryFailedActions
  };
};

// Helper function to generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default useOfflineSync;
