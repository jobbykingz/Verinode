type SyncStatus = 'idle' | 'syncing' | 'error' | 'synced';

export interface OfflineState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingItemsCount: number;
}

type Listener = (state: OfflineState) => void;

class OfflineStore {
  private state: OfflineState = {
    isOnline: navigator.onLine,
    syncStatus: 'idle',
    pendingItemsCount: 0,
  };
  private listeners: Set<Listener> = new Set();

  getState() {
    return this.state;
  }

  setState(newState: Partial<OfflineState>) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export const offlineStore = new OfflineStore();