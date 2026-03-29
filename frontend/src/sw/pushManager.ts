interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushNotification {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  actions?: NotificationAction[];
  vibrate?: number[];
  silent?: boolean;
  requireInteraction?: boolean;
  timestamp?: number;
}

class PushManager {
  private static instance: PushManager;
  private subscription: PushSubscription | null = null;
  private vapidPublicKey: string = '';
  private dbName = 'verinode-push-notifications';
  private storeName = 'notifications';
  private db: IDBDatabase | null = null;

  private constructor() {}

  static getInstance(): PushManager {
    if (!PushManager.instance) {
      PushManager.instance = new PushManager();
    }
    return PushManager.instance;
  }

  async init(vapidPublicKey?: string): Promise<void> {
    if (vapidPublicKey) {
      this.vapidPublicKey = vapidPublicKey;
    }

    await this.initDB();
    await this.loadSubscription();
    
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        this.subscription = await registration.pushManager.getSubscription();
        
        if (!this.subscription) {
          await this.requestSubscription();
        }
      } catch (error) {
        console.error('Push manager initialization failed:', error);
      }
    }
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('read', 'read', { unique: false });
        }
      };
    });
  }

  async requestSubscription(): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      this.subscription = subscription;
      await this.saveSubscriptionToServer(subscription);
      
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe for push notifications:', error);
      return null;
    }
  }

  private async saveSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.toJSON().keys!.p256dh,
            auth: subscription.toJSON().keys!.auth
          }
        })
      });
    } catch (error) {
      console.error('Failed to save subscription to server:', error);
    }
  }

  private async loadSubscription(): Promise<void> {
    // Load from localStorage or server if needed
    const savedSubscription = localStorage.getItem('push-subscription');
    if (savedSubscription) {
      try {
        const data = JSON.parse(savedSubscription);
        // Validate subscription is still valid
      } catch (error) {
        console.error('Failed to load saved subscription:', error);
      }
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const result = await this.subscription.unsubscribe();
      
      // Remove from server
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      });

      this.subscription = null;
      localStorage.removeItem('push-subscription');
      
      return result;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      return false;
    }
  }

  async showNotification(notification: PushNotification): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      // Fallback to browser notification
      this.showBrowserNotification(notification);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Save notification to IndexedDB for offline access
      await this.saveNotification(notification);
      
      await registration.showNotification(notification.title, {
        body: notification.body,
        icon: notification.icon || '/logo192.png',
        badge: notification.badge || '/favicon.ico',
        image: notification.image,
        data: notification.data,
        actions: notification.actions,
        vibrate: notification.vibrate,
        silent: notification.silent,
        requireInteraction: notification.requireInteraction,
        timestamp: notification.timestamp || Date.now(),
        tag: notification.data?.tag || 'default'
      });

      this.updateBadge();
    } catch (error) {
      console.error('Failed to show notification:', error);
      this.showBrowserNotification(notification);
    }
  }

  private showBrowserNotification(notification: PushNotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.body,
        icon: notification.icon || '/logo192.png',
        badge: notification.badge || '/favicon.ico',
        image: notification.image,
        data: notification.data,
        vibrate: notification.vibrate,
        requireInteraction: notification.requireInteraction,
        timestamp: notification.timestamp || Date.now()
      });
    }
  }

  private async saveNotification(notification: PushNotification): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const notificationData = {
        ...notification,
        read: false,
        timestamp: notification.timestamp || Date.now()
      };
      
      const request = store.add(notificationData);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getNotifications(): Promise<any[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async markNotificationAsRead(id: number): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const getRequest = store.get(id);
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const notification = getRequest.result;
        if (notification) {
          notification.read = true;
          const updateRequest = store.put(notification);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => {
            this.updateBadge();
            resolve();
          };
        } else {
          resolve();
        }
      };
    });
  }

  async clearNotifications(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.updateBadge();
        resolve();
      };
    });
  }

  private async updateBadge(): Promise<void> {
    const notifications = await this.getNotifications();
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if ('setAppBadge' in navigator) {
      try {
        if (unreadCount > 0) {
          await (navigator as any).setAppBadge(unreadCount);
        } else {
          await (navigator as any).clearAppBadge();
        }
      } catch (error) {
        console.warn('Failed to update app badge:', error);
      }
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }

  getSubscriptionStatus(): { subscribed: boolean; endpoint?: string } {
    return {
      subscribed: !!this.subscription,
      endpoint: this.subscription?.endpoint
    };
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export default PushManager;
