interface NetworkStatus {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface InstallPromptResult {
  accepted: boolean;
  platform?: string;
}

class PWAUtils {
  private static instance: PWAUtils;
  private networkStatusCallbacks: ((status: NetworkStatus) => void)[] = [];
  private currentNetworkStatus: NetworkStatus = {
    online: navigator.onLine
  };

  private constructor() {
    this.initializeNetworkMonitoring();
    this.initializeServiceWorker();
  }

  static getInstance(): PWAUtils {
    if (!PWAUtils.instance) {
      PWAUtils.instance = new PWAUtils();
    }
    return PWAUtils.instance;
  }

  private initializeNetworkMonitoring(): void {
    const updateNetworkStatus = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;

      this.currentNetworkStatus = {
        online: navigator.onLine,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
        saveData: connection?.saveData
      };

      this.notifyNetworkStatusChange();
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    if (navigator.onLine) {
      updateNetworkStatus();
    }
  }

  private async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered successfully:', registration);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available
                this.notifyAppUpdateAvailable();
              }
            });
          }
        });

        // Listen for controlling service worker changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  private notifyNetworkStatusChange(): void {
    this.networkStatusCallbacks.forEach(callback => callback(this.currentNetworkStatus));
  }

  private notifyAppUpdateAvailable(): void {
    window.dispatchEvent(new CustomEvent('app-update-available', {
      detail: { version: 'new' }
    }));
  }

  // Network status methods
  getNetworkStatus(): NetworkStatus {
    return { ...this.currentNetworkStatus };
  }

  isOnline(): boolean {
    return this.currentNetworkStatus.online;
  }

  isSlowConnection(): boolean {
    return this.currentNetworkStatus.effectiveType === 'slow-2g' || 
           this.currentNetworkStatus.effectiveType === '2g' ||
           this.currentNetworkStatus.saveData === true;
  }

  onNetworkStatusChange(callback: (status: NetworkStatus) => void): () => void {
    this.networkStatusCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.networkStatusCallbacks.indexOf(callback);
      if (index > -1) {
        this.networkStatusCallbacks.splice(index, 1);
      }
    };
  }

  // App installation methods
  async canInstallApp(): Promise<boolean> {
    return 'beforeinstallprompt' in window;
  }

  async installApp(): Promise<InstallPromptResult> {
    return new Promise((resolve) => {
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        const promptEvent = e as any;
        
        promptEvent.prompt().then((result: any) => {
          resolve({
            accepted: result.outcome === 'accepted',
            platform: result.platform
          });
        });

        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      
      // If the event doesn't fire within 5 seconds, resolve with rejected
      setTimeout(() => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        resolve({ accepted: false });
      }, 5000);
    });
  }

  isAppInstalled(): boolean {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    const isInWebAppChrome = window.matchMedia('(display-mode: minimal-ui)').matches;
    
    return isStandalone || isInWebAppiOS || isInWebAppChrome;
  }

  // Badge notification methods
  async setBadge(count: number): Promise<void> {
    if ('setAppBadge' in navigator) {
      try {
        await (navigator as any).setAppBadge(count);
      } catch (error) {
        console.warn('Failed to set app badge:', error);
      }
    }
  }

  async clearBadge(): Promise<void> {
    if ('clearAppBadge' in navigator) {
      try {
        await (navigator as any).clearAppBadge();
      } catch (error) {
        console.warn('Failed to clear app badge:', error);
      }
    }
  }

  // Screen wake lock
  async requestWakeLock(): Promise<WakeLockSentinel | null> {
    if ('wakeLock' in navigator) {
      try {
        return await (navigator as any).wakeLock.request('screen');
      } catch (error) {
        console.warn('Failed to request wake lock:', error);
        return null;
      }
    }
    return null;
  }

  async releaseWakeLock(wakeLock: WakeLockSentinel): Promise<void> {
    try {
      await wakeLock.release();
    } catch (error) {
      console.warn('Failed to release wake lock:', error);
    }
  }

  // Device capabilities
  getDeviceCapabilities(): {
    touch: boolean;
    mobile: boolean;
    standalone: boolean;
    notifications: boolean;
    pushNotifications: boolean;
    backgroundSync: boolean;
    wakeLock: boolean;
    installPrompt: boolean;
  } {
    return {
      touch: 'ontouchstart' in window,
      mobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      standalone: this.isAppInstalled(),
      notifications: 'Notification' in window,
      pushNotifications: 'PushManager' in window,
      backgroundSync: 'serviceWorker' in navigator && 'SyncManager' in window,
      wakeLock: 'wakeLock' in navigator,
      installPrompt: 'beforeinstallprompt' in window
    };
  }

  // App lifecycle
  async hideApp(): Promise<void> {
    if ('document' in window && 'exitFullscreen' in document.documentElement) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        console.warn('Failed to exit fullscreen:', error);
      }
    }
  }

  async showApp(): Promise<void> {
    if ('document' in window && 'requestFullscreen' in document.documentElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (error) {
        console.warn('Failed to request fullscreen:', error);
      }
    }
  }

  // Storage utilities
  async getStorageUsage(): Promise<{
    quota: number;
    usage: number;
    available: number;
    usagePercentage: number;
  }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota || 0;
        const usage = estimate.usage || 0;
        
        return {
          quota,
          usage,
          available: quota - usage,
          usagePercentage: quota > 0 ? (usage / quota) * 100 : 0
        };
      } catch (error) {
        console.warn('Failed to get storage usage:', error);
      }
    }
    
    return { quota: 0, usage: 0, available: 0, usagePercentage: 0 };
  }

  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        return await navigator.storage.persist();
      } catch (error) {
        console.warn('Failed to request persistent storage:', error);
        return false;
      }
    }
    return false;
  }

  // Share API
  async canShare(): Promise<boolean> {
    return 'share' in navigator;
  }

  async shareContent(data: ShareData): Promise<void> {
    if ('share' in navigator) {
      try {
        await navigator.share(data);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.warn('Failed to share content:', error);
        }
      }
    }
  }

  // Clipboard API
  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  async readFromClipboard(): Promise<string> {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      console.warn('Failed to read from clipboard:', error);
      return '';
    }
  }

  // App theme
  prefersDarkMode(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  onThemeChange(callback: (isDark: boolean) => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => callback(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    // Call immediately with current preference
    callback(mediaQuery.matches);
    
    // Return unsubscribe function
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }
}

export default PWAUtils;
