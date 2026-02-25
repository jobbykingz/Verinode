const CACHE_NAME = 'verinode-v1';
const STATIC_CACHE_NAME = 'verinode-static-v1';
const DYNAMIC_CACHE_NAME = 'verinode-dynamic-v1';
const PROOF_CACHE_NAME = 'verinode-proofs-v1';

// Assets to cache immediately (app shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add your CSS and JS files here
  '/static/css/main.css',
  '/static/js/main.js',
  // Add icons
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico'
];

// API endpoints that should be cached
const API_ENDPOINTS = [
  '/api/proofs',
  '/api/verification-status'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName !== PROOF_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(request)) {
    // Cache first for static assets
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
  } else if (isAPIRequest(request)) {
    // Network first for API requests with offline fallback
    event.respondWith(networkFirst(request, DYNAMIC_CACHE_NAME));
  } else if (isProofRequest(request)) {
    // Cache first for proof data with background sync
    event.respondWith(cacheFirst(request, PROOF_CACHE_NAME));
    event.waitUntil(updateCache(request, PROOF_CACHE_NAME));
  } else {
    // Network first for everything else
    event.respondWith(networkFirst(request, DYNAMIC_CACHE_NAME));
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'proof-verification') {
    event.waitUntil(syncProofVerifications());
  } else if (event.tag === 'proof-updates') {
    event.waitUntil(syncProofUpdates());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received');
  
  const options = {
    body: event.data ? event.data.text() : 'New verification update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-96x96.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Verinode Update', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received');
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/proofs')
    );
  }
});

// Helper functions
function isStaticAsset(request) {
  return request.url.includes('/static/') || 
         request.url.includes('/icons/') ||
         request.url.endsWith('.css') ||
         request.url.endsWith('.js') ||
         request.url.endsWith('.png') ||
         request.url.endsWith('.jpg') ||
         request.url.endsWith('.svg');
}

function isAPIRequest(request) {
  return request.url.includes('/api/');
}

function isProofRequest(request) {
  return request.url.includes('/api/proofs') || 
         request.url.includes('/api/verification');
}

// Cache strategies
async function cacheFirst(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    return new Response('Offline - No cached data available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Offline - No cached data available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

async function updateCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
  } catch (error) {
    console.log('[SW] Background update failed:', error);
  }
}

// Background sync functions
async function syncProofVerifications() {
  try {
    const offlineActions = await getOfflineActions('proof-verification');
    
    for (const action of offlineActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });
        
        if (response.ok) {
          await removeOfflineAction(action.id);
          console.log('[SW] Synced verification action:', action.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync action:', action.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

async function syncProofUpdates() {
  try {
    const offlineUpdates = await getOfflineActions('proof-updates');
    
    for (const update of offlineUpdates) {
      try {
        const response = await fetch(update.url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...update.headers
          },
          body: JSON.stringify(update.data)
        });
        
        if (response.ok) {
          await removeOfflineAction(update.id);
          console.log('[SW] Synced proof update:', update.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync update:', update.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Update sync failed:', error);
  }
}

// IndexedDB helpers for offline storage
async function getOfflineActions(type) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('verinode-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['actions'], 'readonly');
      const store = transaction.objectStore('actions');
      const index = store.index('type');
      const getRequest = index.getAll(type);
      
      getRequest.onsuccess = () => resolve(getRequest.result || []);
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('actions')) {
        const store = db.createObjectStore('actions', { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

async function removeOfflineAction(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('verinode-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Message handling for communication with main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
