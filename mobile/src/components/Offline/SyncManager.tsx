import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  NetInfo,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';

export interface SyncItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  data: any;
  timestamp: number;
  retryCount: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingItems: number;
  lastSyncTime: number | null;
  syncProgress: number;
  conflicts: SyncConflict[];
}

export interface SyncConflict {
  id: string;
  type: 'data' | 'version' | 'delete';
  entityType: string;
  entityId: string;
  localData: any;
  remoteData: any;
  timestamp: number;
  resolution?: 'local' | 'remote' | 'merge';
}

export interface OfflineStorage {
  saveItem: (key: string, data: any) => Promise<void>;
  getItem: (key: string) => Promise<any>;
  removeItem: (key: string) => Promise<void>;
  getAllItems: (prefix?: string) => Promise<Array<{ key: string; data: any }>>;
  clear: () => Promise<void>;
}

interface SyncManagerContextType {
  syncStatus: SyncStatus;
  addToSyncQueue: (item: Omit<SyncItem, 'id' | 'timestamp' | 'retryCount' | 'status'>) => void;
  syncNow: () => Promise<void>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge') => void;
  clearSyncQueue: () => Promise<void>;
  getOfflineData: (entityType: string, entityId: string) => Promise<any>;
  saveOfflineData: (entityType: string, entityId: string, data: any) => Promise<void>;
}

const SyncManagerContext = createContext<SyncManagerContextType | null>(null);

interface SyncManagerProviderProps {
  children: ReactNode;
  apiEndpoint: string;
  maxRetries?: number;
  syncInterval?: number;
  conflictResolutionStrategy?: 'manual' | 'auto-local' | 'auto-remote';
}

const { width, height } = Dimensions.get('window');

export const SyncManagerProvider: React.FC<SyncManagerProviderProps> = ({
  children,
  apiEndpoint,
  maxRetries = 3,
  syncInterval = 30000, // 30 seconds
  conflictResolutionStrategy = 'manual',
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    pendingItems: 0,
    lastSyncTime: null,
    syncProgress: 0,
    conflicts: [],
  });

  const [syncQueue, setSyncQueue] = useState<SyncItem[]>([]);
  const [database, setDatabase] = useState<SQLite.SQLiteDatabase | null>(null);
  const [progressAnim] = useState(new Animated.Value(0));
  const [syncTimer, setSyncTimer] = useState<NodeJS.Timeout | null>(null);
  const [netInfoListener, setNetInfoListener] = useState<any>(null);

  // Initialize database
  useEffect(() => {
    initializeDatabase();
    setupNetworkListener();
    loadSyncQueue();
    startAutoSync();

    return () => {
      if (syncTimer) clearInterval(syncTimer);
      if (netInfoListener) netInfoListener();
    };
  }, []);

  const initializeDatabase = async () => {
    try {
      const db = SQLite.openDatabase({
        name: 'VerinodeOffline.db',
        location: 'default',
      });

      // Create tables
      await db.transaction((tx) => {
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            retry_count INTEGER DEFAULT 0,
            priority TEXT NOT NULL,
            status TEXT NOT NULL,
            error TEXT
          );
        `);

        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS offline_data (
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            PRIMARY KEY (entity_type, entity_id)
          );
        `);

        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS sync_conflicts (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            local_data TEXT NOT NULL,
            remote_data TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            resolution TEXT
          );
        `);
      });

      setDatabase(db);
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected && state.isInternetReachable;
      setSyncStatus(prev => ({ ...prev, isOnline }));
      
      if (isOnline && syncQueue.length > 0) {
        // Start syncing when coming back online
        setTimeout(() => processSyncQueue(), 1000);
      }
    });

    setNetInfoListener(() => unsubscribe);
  };

  const loadSyncQueue = async () => {
    if (!database) return;

    try {
      const results = await new Promise<SQLite.SQLResultSet>((resolve, reject) => {
        database!.transaction((tx) => {
          tx.executeSql(
            'SELECT * FROM sync_queue ORDER BY priority DESC, timestamp ASC',
            [],
            (_, result) => resolve(result),
            (_, error) => reject(error)
          );
        });
      });

      const items: SyncItem[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        items.push({
          id: row.id,
          type: row.type,
          entityType: row.entity_type,
          entityId: row.entity_id,
          data: JSON.parse(row.data),
          timestamp: row.timestamp,
          retryCount: row.retry_count,
          priority: row.priority,
          status: row.status,
          error: row.error,
        });
      }

      setSyncQueue(items);
      updateSyncStatus(items);
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  };

  const startAutoSync = () => {
    if (syncTimer) clearInterval(syncTimer);
    
    const timer = setInterval(() => {
      if (syncStatus.isOnline && syncQueue.length > 0) {
        processSyncQueue();
      }
    }, syncInterval);
    
    setSyncTimer(timer);
  };

  const addToSyncQueue = async (item: Omit<SyncItem, 'id' | 'timestamp' | 'retryCount' | 'status'>) => {
    if (!database) return;

    const syncItem: SyncItem = {
      ...item,
      id: `${item.entityType}_${item.entityId}_${Date.now()}`,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    try {
      // Add to database
      await new Promise<void>((resolve, reject) => {
        database!.transaction((tx) => {
          tx.executeSql(
            `INSERT INTO sync_queue (
              id, type, entity_type, entity_id, data, timestamp, 
              retry_count, priority, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              syncItem.id,
              syncItem.type,
              syncItem.entityType,
              syncItem.entityId,
              JSON.stringify(syncItem.data),
              syncItem.timestamp,
              syncItem.retryCount,
              syncItem.priority,
              syncItem.status,
            ],
            () => resolve(),
            (_, error) => reject(error)
          );
        });
      });

      // Update state
      setSyncQueue(prev => {
        const newQueue = [...prev, syncItem];
        updateSyncStatus(newQueue);
        return newQueue;
      });

      // Try to sync immediately if online
      if (syncStatus.isOnline) {
        setTimeout(() => processSyncQueue(), 100);
      }
    } catch (error) {
      console.error('Error adding to sync queue:', error);
    }
  };

  const processSyncQueue = async () => {
    if (!database || syncStatus.isSyncing || !syncStatus.isOnline) return;

    const pendingItems = syncQueue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      // Process items in priority order
      const sortedItems = pendingItems.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      for (const item of sortedItems) {
        await syncItem(item);
      }

      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: Date.now(),
      }));
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
    }
  };

  const syncItem = async (item: SyncItem) => {
    if (!database) return;

    try {
      // Update status to syncing
      await updateItemStatus(item.id, 'syncing');
      updateSyncStatus([...syncQueue]);

      // Prepare API request
      const endpoint = `${apiEndpoint}/${item.entityType}/${item.entityId}`;
      let response: Response;

      switch (item.type) {
        case 'create':
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data),
          });
          break;
        case 'update':
          response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data),
          });
          break;
        case 'delete':
          response = await fetch(endpoint, {
            method: 'DELETE',
          });
          break;
        default:
          throw new Error(`Unknown sync type: ${item.type}`);
      }

      if (response.ok) {
        // Sync successful
        await removeItemFromQueue(item.id);
        setSyncQueue(prev => prev.filter(i => i.id !== item.id));
      } else if (response.status === 409) {
        // Conflict detected
        const remoteData = await response.json();
        await handleConflict(item, remoteData);
      } else {
        throw new Error(`Sync failed: ${response.status}`);
      }

      updateSyncStatus([...syncQueue]);
    } catch (error) {
      console.error('Error syncing item:', error);
      
      // Update retry count and status
      const newRetryCount = item.retryCount + 1;
      const status = newRetryCount >= maxRetries ? 'failed' : 'pending';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await updateItemStatus(item.id, status, newRetryCount, errorMessage);
      
      setSyncQueue(prev => 
        prev.map(i => 
          i.id === item.id 
            ? { ...i, retryCount: newRetryCount, status, error: errorMessage }
            : i
        )
      );
      
      updateSyncStatus([...syncQueue]);
    }
  };

  const handleConflict = async (item: SyncItem, remoteData: any) => {
    if (!database) return;

    const conflict: SyncConflict = {
      id: `conflict_${item.id}`,
      type: 'data',
      entityType: item.entityType,
      entityId: item.entityId,
      localData: item.data,
      remoteData,
      timestamp: Date.now(),
    };

    try {
      // Save conflict
      await new Promise<void>((resolve, reject) => {
        database!.transaction((tx) => {
          tx.executeSql(
            `INSERT INTO sync_conflicts (
              id, type, entity_type, entity_id, local_data, remote_data, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              conflict.id,
              conflict.type,
              conflict.entityType,
              conflict.entityId,
              JSON.stringify(conflict.localData),
              JSON.stringify(conflict.remoteData),
              conflict.timestamp,
            ],
            () => resolve(),
            (_, error) => reject(error)
          );
        });
      });

      // Auto-resolve if strategy is set
      if (conflictResolutionStrategy !== 'manual') {
        const resolution = conflictResolutionStrategy === 'auto-local' ? 'local' : 'remote';
        await resolveConflict(conflict.id, resolution);
      } else {
        // Add to conflicts list
        setSyncStatus(prev => ({
          ...prev,
          conflicts: [...prev.conflicts, conflict],
        }));
      }

      // Remove from sync queue temporarily
      await updateItemStatus(item.id, 'pending');
    } catch (error) {
      console.error('Error handling conflict:', error);
    }
  };

  const resolveConflict = async (conflictId: string, resolution: 'local' | 'remote' | 'merge') => {
    if (!database) return;

    try {
      // Get conflict details
      const conflict = await new Promise<SyncConflict | null>((resolve, reject) => {
        database!.transaction((tx) => {
          tx.executeSql(
            'SELECT * FROM sync_conflicts WHERE id = ?',
            [conflictId],
            (_, result) => {
              if (result.rows.length > 0) {
                const row = result.rows.item(0);
                resolve({
                  id: row.id,
                  type: row.type,
                  entityType: row.entity_type,
                  entityId: row.entity_id,
                  localData: JSON.parse(row.local_data),
                  remoteData: JSON.parse(row.remote_data),
                  timestamp: row.timestamp,
                  resolution: row.resolution,
                });
              } else {
                resolve(null);
              }
            },
            (_, error) => reject(error)
          );
        });
      });

      if (!conflict) return;

      let resolvedData: any;
      let syncType: 'create' | 'update';

      switch (resolution) {
        case 'local':
          resolvedData = conflict.localData;
          syncType = 'update';
          break;
        case 'remote':
          resolvedData = conflict.remoteData;
          // Update local data with remote version
          await saveOfflineData(conflict.entityType, conflict.entityId, resolvedData);
          break;
        case 'merge':
          // Simple merge strategy - could be enhanced
          resolvedData = { ...conflict.remoteData, ...conflict.localData };
          syncType = 'update';
          break;
      }

      // Update conflict resolution
      await new Promise<void>((resolve, reject) => {
        database!.transaction((tx) => {
          tx.executeSql(
            'UPDATE sync_conflicts SET resolution = ? WHERE id = ?',
            [resolution, conflictId],
            () => resolve(),
            (_, error) => reject(error)
          );
        });
      });

      // Remove from conflicts list
      setSyncStatus(prev => ({
        ...prev,
        conflicts: prev.conflicts.filter(c => c.id !== conflictId),
      }));

      // Re-add to sync queue if needed
      if (resolution !== 'remote') {
        await addToSyncQueue({
          type: syncType,
          entityType: conflict.entityType,
          entityId: conflict.entityId,
          data: resolvedData,
          priority: 'high',
        });
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
    }
  };

  const syncNow = async () => {
    if (!syncStatus.isOnline) {
      throw new Error('Device is offline');
    }
    await processSyncQueue();
  };

  const clearSyncQueue = async () => {
    if (!database) return;

    try {
      await new Promise<void>((resolve, reject) => {
        database!.transaction((tx) => {
          tx.executeSql('DELETE FROM sync_queue', [], () => resolve(), (_, error) => reject(error));
        });
      });

      setSyncQueue([]);
      updateSyncStatus([]);
    } catch (error) {
      console.error('Error clearing sync queue:', error);
    }
  };

  const getOfflineData = async (entityType: string, entityId: string) => {
    if (!database) return null;

    try {
      const result = await new Promise<any>((resolve, reject) => {
        database!.transaction((tx) => {
          tx.executeSql(
            'SELECT data FROM offline_data WHERE entity_type = ? AND entity_id = ?',
            [entityType, entityId],
            (_, result) => {
              if (result.rows.length > 0) {
                resolve(JSON.parse(result.rows.item(0).data));
              } else {
                resolve(null);
              }
            },
            (_, error) => reject(error)
          );
        });
      });

      return result;
    } catch (error) {
      console.error('Error getting offline data:', error);
      return null;
    }
  };

  const saveOfflineData = async (entityType: string, entityId: string, data: any) => {
    if (!database) return;

    try {
      await new Promise<void>((resolve, reject) => {
        database!.transaction((tx) => {
          tx.executeSql(
            `INSERT OR REPLACE INTO offline_data 
             (entity_type, entity_id, data, timestamp) 
             VALUES (?, ?, ?, ?)`,
            [entityType, entityId, JSON.stringify(data), Date.now()],
            () => resolve(),
            (_, error) => reject(error)
          );
        });
      });
    } catch (error) {
      console.error('Error saving offline data:', error);
    }
  };

  const updateItemStatus = async (itemId: string, status: string, retryCount?: number, error?: string) => {
    if (!database) return;

    try {
      await new Promise<void>((resolve, reject) => {
        database!.transaction((tx) => {
          const sql = retryCount !== undefined
            ? 'UPDATE sync_queue SET status = ?, retry_count = ?, error = ? WHERE id = ?'
            : 'UPDATE sync_queue SET status = ?, error = ? WHERE id = ?';
          
          const params = retryCount !== undefined
            ? [status, retryCount, error || null, itemId]
            : [status, error || null, itemId];
          
          tx.executeSql(sql, params, () => resolve(), (_, error) => reject(error));
        });
      });
    } catch (error) {
      console.error('Error updating item status:', error);
    }
  };

  const removeItemFromQueue = async (itemId: string) => {
    if (!database) return;

    try {
      await new Promise<void>((resolve, reject) => {
        database!.transaction((tx) => {
          tx.executeSql(
            'DELETE FROM sync_queue WHERE id = ?',
            [itemId],
            () => resolve(),
            (_, error) => reject(error)
          );
        });
      });
    } catch (error) {
      console.error('Error removing item from queue:', error);
    }
  };

  const updateSyncStatus = (queue: SyncItem[]) => {
    const pendingItems = queue.filter(item => item.status === 'pending').length;
    const progress = queue.length > 0 
      ? ((queue.length - pendingItems) / queue.length) * 100 
      : 0;

    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();

    setSyncStatus(prev => ({
      ...prev,
      pendingItems,
      syncProgress: progress,
    }));
  };

  const contextValue: SyncManagerContextType = {
    syncStatus,
    addToSyncQueue,
    syncNow,
    resolveConflict,
    clearSyncQueue,
    getOfflineData,
    saveOfflineData,
  };

  return (
    <SyncManagerContext.Provider value={contextValue}>
      {children}
    </SyncManagerContext.Provider>
  );
};

export const useSyncManager = () => {
  const context = useContext(SyncManagerContext);
  if (!context) {
    throw new Error('useSyncManager must be used within SyncManagerProvider');
  }
  return context;
};

// Sync Status Component
interface SyncStatusIndicatorProps {
  showDetails?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ 
  showDetails = false 
}) => {
  const { syncStatus } = useSyncManager();

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return '#FF6B6B';
    if (syncStatus.isSyncing) return '#FFA500';
    if (syncStatus.pendingItems > 0) return '#FFD93D';
    return '#6BCF7F';
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return 'wifi-off';
    if (syncStatus.isSyncing) return 'sync';
    if (syncStatus.pendingItems > 0) return 'sync-problem';
    return 'sync';
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return 'Offline';
    if (syncStatus.isSyncing) return 'Syncing...';
    if (syncStatus.pendingItems > 0) return `${syncStatus.pendingItems} pending`;
    return 'Synced';
  };

  return (
    <View style={styles.statusContainer}>
      <Icon name={getStatusIcon()} size={20} color={getStatusColor()} />
      <Text style={[styles.statusText, { color: getStatusColor() }]}>
        {getStatusText()}
      </Text>
      
      {showDetails && (
        <View style={styles.detailsContainer}>
          <Animated.View 
            style={[
              styles.progressBar, 
              { 
                width: `${syncStatus.syncProgress}%`,
                backgroundColor: getStatusColor(),
              }
            ]} 
          />
          {syncStatus.lastSyncTime && (
            <Text style={styles.lastSyncText}>
              Last sync: {new Date(syncStatus.lastSyncTime).toLocaleTimeString()}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailsContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    marginTop: 4,
  },
  lastSyncText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
});
