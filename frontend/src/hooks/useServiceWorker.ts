import { useState, useEffect, useCallback } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isInstalled: boolean;
  isActivated: boolean;
  registration: ServiceWorkerRegistration | null;
  error: string | null;
}

interface UseServiceWorkerReturn extends ServiceWorkerState {
  updateServiceWorker: () => Promise<void>;
  skipWaiting: () => void;
  unregister: () => Promise<boolean>;
  getNotifications: () => Promise<Notification[]>;
  subscribeToPush: (publicKey: string) => Promise<PushSubscription | null>;
  unsubscribeFromPush: () => Promise<boolean>;
}

const useServiceWorker = (): UseServiceWorkerReturn => {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isInstalled: false,
    isActivated: false,
    registration: null,
    error: null
  });

  // Check if service worker is supported
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator;
    
    setState(prev => ({
      ...prev,
      isSupported
    }));

    if (isSupported) {
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', registration);

      // Check if there's an active service worker
      const isActivated = !!registration.active;

      setState(prev => ({
        ...prev,
        registration,
        isInstalled: true,
        isActivated
      }));

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is available, show update prompt
              console.log('New service worker available');
            }
          });
        }
      });

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service worker controller changed');
        window.location.reload();
      });

    } catch (error) {
      console.error('Service Worker registration failed:', error);
      setState(prev => ({
        ...prev,
        error: error.message
      }));
    }
  };

  const updateServiceWorker = useCallback(async (): Promise<void> => {
    if (!state.registration) {
      throw new Error('Service worker not registered');
    }

    try {
      await state.registration.update();
      console.log('Service worker update triggered');
    } catch (error) {
      console.error('Failed to update service worker:', error);
      throw error;
    }
  }, [state.registration]);

  const skipWaiting = useCallback((): void => {
    if (!state.registration) {
      console.warn('No service worker registration found');
      return;
    }

    // Send message to service worker to skip waiting
    state.registration.active?.postMessage({ type: 'SKIP_WAITING' });
  }, [state.registration]);

  const unregister = useCallback(async (): Promise<boolean> => {
    if (!state.registration) {
      return false;
    }

    try {
      const unregistered = await state.registration.unregister();
      console.log('Service worker unregistered:', unregistered);
      
      setState(prev => ({
        ...prev,
        registration: null,
        isInstalled: false,
        isActivated: false
      }));

      return unregistered;
    } catch (error) {
      console.error('Failed to unregister service worker:', error);
      return false;
    }
  }, [state.registration]);

  const getNotifications = useCallback(async (): Promise<Notification[]> => {
    if (!('Notification' in window)) {
      return [];
    }

    try {
      const notifications = await state.registration?.getNotifications();
      return notifications || [];
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return [];
    }
  }, [state.registration]);

  const subscribeToPush = useCallback(async (publicKey: string): Promise<PushSubscription | null> => {
    if (!state.registration) {
      throw new Error('Service worker not registered');
    }

    if (!('PushManager' in window)) {
      throw new Error('Push notifications not supported');
    }

    try {
      // Request notification permission first
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      const subscription = await state.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      console.log('Push subscription successful:', subscription);
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }, [state.registration]);

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!state.registration) {
      return false;
    }

    try {
      const subscription = await state.registration.pushManager.getSubscription();
      if (subscription) {
        const unsubscribed = await subscription.unsubscribe();
        console.log('Push unsubscribe successful:', unsubscribed);
        return unsubscribed;
      }
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }, [state.registration]);

  return {
    ...state,
    updateServiceWorker,
    skipWaiting,
    unregister,
    getNotifications,
    subscribeToPush,
    unsubscribeFromPush
  };
};

// Helper function to convert base64 string to Uint8Array for VAPID keys
function urlBase64ToUint8Array(base64String: string): Uint8Array {
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

export default useServiceWorker;
