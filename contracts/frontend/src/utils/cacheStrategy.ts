// Cache strategy utilities for PWA implementation

export interface CacheOptions {
  cacheName: string;
  maxAge?: number; // in milliseconds
  maxEntries?: number;
  networkTimeout?: number; // in milliseconds
}

export interface CacheEntry {
  response: Response;
  timestamp: number;
}

export class CacheStrategy {
  private cacheName: string;
  private maxAge: number;
  private maxEntries: number;
  private networkTimeout: number;

  constructor(options: CacheOptions) {
    this.cacheName = options.cacheName;
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
    this.maxEntries = options.maxEntries || 100;
    this.networkTimeout = options.networkTimeout || 3000; // 3 seconds default
  }

  // Cache First Strategy - serves from cache first, then network
  async cacheFirst(request: Request): Promise<Response> {
    try {
      const cachedResponse = await this.getCachedResponse(request);
      if (cachedResponse && !this.isExpired(cachedResponse)) {
        return cachedResponse.response;
      }

      // If cache is expired or doesn't exist, fetch from network
      const networkResponse = await this.fetchWithTimeout(request);
      if (networkResponse.ok) {
        await this.cacheResponse(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      console.error('Cache first strategy failed:', error);
      const cachedResponse = await this.getCachedResponse(request);
      if (cachedResponse) {
        return cachedResponse.response;
      }
      throw error;
    }
  }

  // Network First Strategy - tries network first, falls back to cache
  async networkFirst(request: Request): Promise<Response> {
    try {
      const networkResponse = await this.fetchWithTimeout(request);
      if (networkResponse.ok) {
        await this.cacheResponse(request, networkResponse.clone());
        return networkResponse;
      }
    } catch (error) {
      console.log('Network failed, trying cache:', error);
    }

    // Fallback to cache
    const cachedResponse = await this.getCachedResponse(request);
    if (cachedResponse) {
      return cachedResponse.response;
    }

    throw new Error('Network request failed and no cached response available');
  }

  // Stale While Revalidate Strategy - serves from cache, updates in background
  async staleWhileRevalidate(request: Request): Promise<Response> {
    const cachedResponse = await this.getCachedResponse(request);
    
    // Always try to update in background
    const updatePromise = this.updateCache(request);
    
    if (cachedResponse && !this.isExpired(cachedResponse)) {
      return cachedResponse.response;
    }

    // If no cache or expired, wait for network
    try {
      const networkResponse = await this.fetchWithTimeout(request);
      if (networkResponse.ok) {
        await this.cacheResponse(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      if (cachedResponse) {
        return cachedResponse.response; // Return stale cache if network fails
      }
      throw error;
    }
  }

  // Network Only Strategy - always fetches from network
  async networkOnly(request: Request): Promise<Response> {
    return this.fetchWithTimeout(request);
  }

  // Cache Only Strategy - only serves from cache
  async cacheOnly(request: Request): Promise<Response> {
    const cachedResponse = await this.getCachedResponse(request);
    if (cachedResponse) {
      return cachedResponse.response;
    }
    throw new Error('No cached response available');
  }

  // Helper methods
  private async getCachedResponse(request: Request): Promise<CacheEntry | null> {
    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(request);
      
      if (response) {
        const timestamp = parseInt(response.headers.get('x-cache-timestamp') || '0');
        return { response, timestamp };
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached response:', error);
      return null;
    }
  }

  private async cacheResponse(request: Request, response: Response): Promise<void> {
    try {
      const cache = await caches.open(this.cacheName);
      
      // Add timestamp header for expiration tracking
      const responseToCache = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...response.headers,
          'x-cache-timestamp': Date.now().toString()
        }
      });

      await cache.put(request, responseToCache);
      await this.cleanupCache();
    } catch (error) {
      console.error('Failed to cache response:', error);
    }
  }

  private async updateCache(request: Request): Promise<void> {
    try {
      const networkResponse = await this.fetchWithTimeout(request);
      if (networkResponse.ok) {
        await this.cacheResponse(request, networkResponse.clone());
      }
    } catch (error) {
      console.log('Background cache update failed:', error);
    }
  }

  private async fetchWithTimeout(request: Request): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.networkTimeout);

    try {
      const response = await fetch(request, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private isExpired(cacheEntry: CacheEntry): boolean {
    return Date.now() - cacheEntry.timestamp > this.maxAge;
  }

  private async cleanupCache(): Promise<void> {
    try {
      const cache = await caches.open(this.cacheName);
      const requests = await cache.keys();
      
      // Remove expired entries
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const timestamp = parseInt(response.headers.get('x-cache-timestamp') || '0');
          if (Date.now() - timestamp > this.maxAge) {
            await cache.delete(request);
          }
        }
      }

      // Remove oldest entries if exceeding maxEntries
      const remainingRequests = await cache.keys();
      if (remainingRequests.length > this.maxEntries) {
        const entriesToRemove = remainingRequests.length - this.maxEntries;
        for (let i = 0; i < entriesToRemove; i++) {
          await cache.delete(remainingRequests[i]);
        }
      }
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }

  // Public utility methods
  async clearCache(): Promise<void> {
    try {
      await caches.delete(this.cacheName);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      const cache = await caches.open(this.cacheName);
      const requests = await cache.keys();
      return requests.length;
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }

  async isRequestCached(request: Request): Promise<boolean> {
    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(request);
      return !!response;
    } catch (error) {
      console.error('Failed to check if request is cached:', error);
      return false;
    }
  }
}

// Predefined cache strategies for different types of content
export const cacheStrategies = {
  // Static assets (CSS, JS, images) - Cache First
  staticAssets: new CacheStrategy({
    cacheName: 'verinode-static-v1',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxEntries: 50
  }),

  // API responses - Network First with short cache
  apiResponses: new CacheStrategy({
    cacheName: 'verinode-api-v1',
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 100,
    networkTimeout: 5000
  }),

  // Proof data - Stale While Revalidate
  proofData: new CacheStrategy({
    cacheName: 'verinode-proofs-v1',
    maxAge: 30 * 60 * 1000, // 30 minutes
    maxEntries: 200
  }),

  // User data - Network First
  userData: new CacheStrategy({
    cacheName: 'verinode-user-v1',
    maxAge: 15 * 60 * 1000, // 15 minutes
    maxEntries: 50
  }),

  // Images - Cache First with long expiration
  images: new CacheStrategy({
    cacheName: 'verinode-images-v1',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxEntries: 100
  })
};

// Helper function to determine cache strategy based on request
export function getCacheStrategy(request: Request): CacheStrategy {
  const url = new URL(request.url);
  
  // Static assets
  if (url.pathname.includes('/static/') || 
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.woff2')) {
    return cacheStrategies.staticAssets;
  }

  // API endpoints
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.includes('/proofs')) {
      return cacheStrategies.proofData;
    }
    if (url.pathname.includes('/user')) {
      return cacheStrategies.userData;
    }
    return cacheStrategies.apiResponses;
  }

  // Images
  if (url.pathname.includes('/images/') || 
      url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    return cacheStrategies.images;
  }

  // Default to network first
  return cacheStrategies.apiResponses;
}

// Utility function to clear all caches
export async function clearAllCaches(): Promise<void> {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  } catch (error) {
    console.error('Failed to clear all caches:', error);
  }
}

// Utility function to get total cache usage
export async function getCacheUsage(): Promise<{ size: number; entries: number }> {
  try {
    const cacheNames = await caches.keys();
    let totalEntries = 0;
    
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      totalEntries += requests.length;
    }

    // Note: Getting actual cache size is not directly supported in most browsers
    // This returns the number of entries across all caches
    return { size: 0, entries: totalEntries };
  } catch (error) {
    console.error('Failed to get cache usage:', error);
    return { size: 0, entries: 0 };
  }
}
