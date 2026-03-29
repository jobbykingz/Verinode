import { QueueManager, SyncOperation } from './QueueManager';
import { offlineStore } from '../../storage/offlineStore';
import { validateIntegrity } from '../../utils/offlineUtils';
import { dbOp } from '../../storage/indexedDB';

export class SyncManager {
  private static isSyncing = false;

  static async startSync(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) return;
    
    this.isSyncing = true;
    offlineStore.setState({ syncStatus: 'syncing' });

    try {
      const queue = await QueueManager.getQueue();
      
      for (const operation of queue) {
        await this.processOperation(operation);
      }
      
      offlineStore.setState({ syncStatus: 'synced' });
      setTimeout(() => offlineStore.setState({ syncStatus: 'idle' }), 3000);
    } catch (error) {
      console.error('Sync failed:', error);
      offlineStore.setState({ syncStatus: 'error' });
    } finally {
      this.isSyncing = false;
    }
  }

  private static async processOperation(operation: SyncOperation): Promise<void> {
    // Data integrity check before dispatching
    if (!validateIntegrity(operation.data, ['id'])) {
      console.warn('Invalid operation data, discarding', operation);
      await QueueManager.dequeue(operation.queueId!);
      return;
    }

    try {
      // Placeholder for actual API dispatch
      // e.g., await apiCall(operation.action, operation.entity, operation.data);
      console.log(`[Sync] Processing ${operation.action} for ${operation.entity}`, operation.data);
      
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // If successful, remove from queue
      await QueueManager.dequeue(operation.queueId!);
    } catch (error) {
      if (operation.retryCount < 3) {
        // Update retry count
        operation.retryCount += 1;
        await dbOp('sync_queue', 'readwrite', (store) => store.put(operation));
      } else {
        // Handle max retries exceeded (e.g., move to a dead-letter queue or notify user)
        console.error('Max retries exceeded for operation', operation);
      }
    }
  }
}

window.addEventListener('online', () => {
  SyncManager.startSync();
});