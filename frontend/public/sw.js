const CACHE_VERSION = 'v1';
const STATIC_CACHE = `verinode-static-${CACHE_VERSION}`;
const API_CACHE = `verinode-api-${CACHE_VERSION}`;
const IMAGES_CACHE = `verinode-images-${CACHE_VERSION}`;
const DOCUMENTS_CACHE = `verinode-documents-${CACHE_VERSION}`;

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/user/profile',
  '/api/proofs/list',
  '/api/notifications'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== API_CACHE && 
                cacheName !== IMAGES_CACHE && 
                cacheName !== DOCUMENTS_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different request types
  if (request.method === 'GET') {
    if (isAPIRequest(url)) {
      event.respondWith(handleAPIRequest(request));
    } else if (isImageRequest(url)) {
      event.respondWith(handleImageRequest(request));
    } else if (isDocumentRequest(url)) {
      event.respondWith(handleDocumentRequest(request));
    } else {
      event.respondWith(handleStaticRequest(request));
    }
  } else if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
    event.respondWith(handleMutationRequest(request));
  }
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(processBackgroundSync());
  } else if (event.tag === 'periodic-sync') {
    event.waitUntil(processPeriodicSync());
  }
});

// Push event
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/logo192.png',
      badge: data.badge || '/favicon.ico',
      image: data.image,
      data: data.data,
      actions: data.actions,
      vibrate: data.vibrate,
      silent: data.silent,
      requireInteraction: data.requireInteraction,
      timestamp: data.timestamp || Date.now(),
      tag: data.tag || 'default'
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification click received');
  
  event.notification.close();
  
  if (event.action) {
    // Handle specific action clicks
    handleNotificationAction(event.action, event.notification.data);
  } else {
    // Handle default notification click
    event.waitUntil(
      clients.openWindow(event.notification.data?.url || '/')
    );
  }
});

// Helper functions
function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/graphql');
}

function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname);
}

function isDocumentRequest(url) {
  return /\.(pdf|doc|docx|txt|json)$/i.test(url.pathname);
}

async function handleStaticRequest(request) {
  try {
    // Cache first strategy for static assets
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Static request failed:', error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || createOfflineResponse();
  }
}

async function handleAPIRequest(request) {
  try {
    // Network first strategy for API requests
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('API request failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return createOfflineResponse();
  }
}

async function handleImageRequest(request) {
  try {
    // Cache first strategy for images
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(IMAGES_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Image request failed:', error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || createOfflineResponse();
  }
}

async function handleDocumentRequest(request) {
  try {
    // Stale while revalidate strategy for documents
    const cache = await caches.open(DOCUMENTS_CACHE);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request).then(async (networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }).catch(error => {
      console.error('Document fetch failed:', error);
      return null;
    });

    if (cachedResponse) {
      // Return cached response immediately, fetch in background
      fetchPromise;
      return cachedResponse;
    }

    try {
      const networkResponse = await fetchPromise;
      return networkResponse || createOfflineResponse();
    } catch (error) {
      return createOfflineResponse();
    }
  } catch (error) {
    console.error('Document request failed:', error);
    return createOfflineResponse();
  }
}

async function handleMutationRequest(request) {
  try {
    // Always try network first for mutations
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clear relevant caches after successful mutation
      clearRelatedCaches(request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Mutation request failed, queuing for sync:', error);
    
    // Queue for background sync
    await queueForBackgroundSync(request);
    
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'Request queued for sync when online' 
      }),
      {
        status: 202,
        statusText: 'Accepted',
        headers: {
          'Content-Type': 'application/json',
          'x-offline-queued': 'true'
        }
      }
    );
  }
}

async function queueForBackgroundSync(request) {
  const syncData = {
    id: crypto.randomUUID(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: 3
  };

  // Store in IndexedDB for background sync
  const db = await openSyncDB();
  const transaction = db.transaction(['sync-queue'], 'readwrite');
  const store = transaction.objectStore('sync-queue');
  await store.add(syncData);
}

async function processBackgroundSync() {
  const db = await openSyncDB();
  const transaction = db.transaction(['sync-queue'], 'readwrite');
  const store = transaction.objectStore('sync-queue');
  const items = await store.getAll();

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body
      });

      if (response.ok) {
        await store.delete(item.id);
        console.log('Background sync successful for:', item.id);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Background sync failed for:', item.id, error);
      item.retryCount++;
      
      if (item.retryCount >= item.maxRetries) {
        await store.delete(item.id);
        console.error('Max retries exceeded for:', item.id);
      } else {
        await store.put(item);
        // Exponential backoff
        const delay = Math.pow(2, item.retryCount) * 1000;
        setTimeout(processBackgroundSync, delay);
      }
    }
  }
}

async function processPeriodicSync() {
  // Periodic background tasks
  try {
    // Clear expired cache entries
    await cleanupExpiredCache();
    
    // Pre-cache important assets
    await precacheCriticalAssets();
    
    // Sync any pending data
    await processBackgroundSync();
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

async function cleanupExpiredCache() {
  const cacheNames = await caches.keys();
  const now = Date.now();
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const expires = response.headers.get('x-cache-expires');
        if (expires && parseInt(expires) < now) {
          await cache.delete(request);
        }
      }
    }
  }
}

async function precacheCriticalAssets() {
  const cache = await caches.open(STATIC_CACHE);
  
  for (const asset of STATIC_ASSETS) {
    try {
      const response = await fetch(asset);
      if (response.ok) {
        await cache.put(asset, response);
      }
    } catch (error) {
      console.error('Failed to precache asset:', asset, error);
    }
  }
}

function clearRelatedCaches(url) {
  // Clear API cache for mutations
  if (url.includes('/api/')) {
    caches.delete(API_CACHE);
  }
}

function createOfflineResponse() {
  return new Response(
    JSON.stringify({ 
      error: 'Offline', 
      message: 'No network connection and no cached data available' 
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
        'x-offline': 'true'
      }
    }
  );
}

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('verinode-background-sync', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('sync-queue')) {
        const store = db.createObjectStore('sync-queue', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

function handleNotificationAction(action, data) {
  switch (action) {
    case 'view':
      clients.openWindow(data.url || '/');
      break;
    case 'dismiss':
      // Just close the notification (already done)
      break;
    default:
      console.log('Unknown notification action:', action);
  }
}
