
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',

  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {

  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {

              return caches.delete(cacheName);
            }
          })
        );
      })

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);


    );
  }
});

// Helper functions

    if (cachedResponse) {
      return cachedResponse;
    }
    

