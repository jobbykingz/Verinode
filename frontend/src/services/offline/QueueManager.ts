import { dbOp, getAll, clearStore } from '../../storage/indexedDB';
import { offlineStore } from '../../storage/offlineStore';

export interface SyncOperation {
  queueId?: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'proof';
  data: any;
  timestamp: number;
  retryCount: number;
}

export class QueueManager {
  static async enqueue(operation: Omit<SyncOperation, 'queueId' | 'timestamp' | 'retryCount'>): Promise<void> {
    const newOp: SyncOperation = {
      ...operation,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    await dbOp('sync_queue', 'readwrite', (store) => store.add(newOp));
    await this.updatePendingCount();
  }

  static async dequeue(queueId: number): Promise<void> {
    await dbOp('sync_queue', 'readwrite', (store) => store.delete(queueId));
    await this.updatePendingCount();
  }

  static async getQueue(): Promise<SyncOperation[]> {
    return await getAll<SyncOperation>('sync_queue');
  }

  static async clearQueue(): Promise<void> {
    await clearStore('sync_queue');
    await this.updatePendingCount();
  }

  static async updatePendingCount() {
    const queue = await this.getQueue();
    offlineStore.setState({ pendingItemsCount: queue.length });
  }
}