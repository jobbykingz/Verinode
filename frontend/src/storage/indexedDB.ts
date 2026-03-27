const DB_NAME = 'VerinodeOfflineDB';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for actual proof data
      if (!db.objectStoreNames.contains('proofs')) {
        const proofsStore = db.createObjectStore('proofs', { keyPath: 'id' });
        proofsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      
      // Store for operations pending synchronization
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'queueId', autoIncrement: true });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const dbOp = async <T>(
  storeName: 'proofs' | 'sync_queue',
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest
): Promise<T> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
};

export const getAll = async <T>(storeName: 'proofs' | 'sync_queue'): Promise<T[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
};

export const clearStore = async (storeName: 'proofs' | 'sync_queue'): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
};