interface SyncQueueItem {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class BackgroundSyncManager {
  private static instance: BackgroundSyncManager;
  private syncQueue: SyncQueueItem[] = [];
  private dbName = 'verinode-background-sync';
  private storeName = 'sync-queue';
  private db: IDBDatabase | null = null;

  private constructor() {}

  static getInstance(): BackgroundSyncManager {
    if (!BackgroundSyncManager.instance) {
      BackgroundSyncManager.instance = new BackgroundSyncManager();
    }
    return BackgroundSyncManager.instance;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadSyncQueue();
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private async loadSyncQueue(): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.syncQueue = request.result || [];
        this.processSyncQueue();
        resolve();
      };
    });
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const syncItem: SyncQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3
    };

    this.syncQueue.push(syncItem);
    await this.saveSyncQueue();
    
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync');
      } catch (error) {
        console.warn('Background sync registration failed:', error);
        this.processSyncQueue();
      }
    } else {
      this.processSyncQueue();
    }
  }

  private async saveSyncQueue(): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Clear existing items
      store.clear();
      
      // Add all items from queue
      this.syncQueue.forEach(item => {
        store.add(item);
      });
      
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    const online = navigator.onLine;
    if (!online) return;

    const itemsToProcess = [...this.syncQueue];
    
    for (const item of itemsToProcess) {
      try {
        await this.syncItem(item);
        this.removeFromSyncQueue(item.id);
      } catch (error) {
        console.error('Sync failed for item:', item.id, error);
        item.retryCount++;
        
        if (item.retryCount >= item.maxRetries) {
          console.error('Max retries exceeded for item:', item.id);
          this.removeFromSyncQueue(item.id);
          // Could emit event for UI to handle
          this.dispatchSyncEvent('sync-failed', { item, error });
        } else {
          // Exponential backoff
          const delay = Math.pow(2, item.retryCount) * 1000;
          setTimeout(() => this.processSyncQueue(), delay);
        }
      }
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const response = await fetch(item.url, {
      method: item.method,
      headers: {
        'Content-Type': 'application/json',
        ...item.headers
      },
      body: item.body
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    this.dispatchSyncEvent('sync-success', { item });
  }

  private removeFromSyncQueue(id: string): void {
    this.syncQueue = this.syncQueue.filter(item => item.id !== id);
    this.saveSyncQueue();
  }

  private dispatchSyncEvent(type: string, data: any): void {
    const event = new CustomEvent(`background-sync-${type}`, { detail: data });
    window.dispatchEvent(event);
  }

  getSyncQueueStatus(): { pending: number; failed: number } {
    return {
      pending: this.syncQueue.filter(item => item.retryCount === 0).length,
      failed: this.syncQueue.filter(item => item.retryCount > 0).length
    };
  }

  async clearSyncQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveSyncQueue();
  }
}

export default BackgroundSyncManager;
