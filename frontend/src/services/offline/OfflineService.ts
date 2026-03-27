import { dbOp, getAll } from '../../storage/indexedDB';
import { QueueManager } from './QueueManager';
import { generateTempId } from '../../utils/offlineUtils';
import { SyncManager } from './SyncManager';

export class OfflineService {
  static async saveProof(proof: any): Promise<any> {
    const isNew = !proof.id;
    const proofData = {
      ...proof,
      id: isNew ? generateTempId() : proof.id,
      updatedAt: new Date().toISOString()
    };

    // Always save locally first for fast UI updates
    await dbOp('proofs', 'readwrite', (store) => store.put(proofData));

    // Queue the operation
    await QueueManager.enqueue({
      action: isNew ? 'CREATE' : 'UPDATE',
      entity: 'proof',
      data: proofData
    });

    // Attempt background sync if online
    if (navigator.onLine) {
      SyncManager.startSync();
    }

    return proofData;
  }

  static async getProofs(): Promise<any[]> {
    // Could be modified to fetch from API and cache if online, 
    // or resolve conflicts based on `resolveConflict` helper.
    return await getAll('proofs');
  }
}