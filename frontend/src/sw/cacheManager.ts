interface CacheConfig {
  name: string;
  version: string;
  maxAge: number;
  maxEntries: number;
  strategy: 'cacheFirst' | 'networkFirst' | 'staleWhileRevalidate' | 'networkOnly' | 'cacheOnly';
}

interface CacheEntry {
  request: Request;
  response: Response;
  timestamp: number;
  expires: number;
}

class CacheManager {
  private static instance: CacheManager;
  private cacheConfigs: Map<string, CacheConfig> = new Map();
  private currentCacheVersion = 'v1';

  private constructor() {
    this.initializeCacheConfigs();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private initializeCacheConfigs(): void {
    // API cache configuration
    this.cacheConfigs.set('api', {
      name: 'verinode-api-cache',
      version: 'v1',
      maxAge: 5 * 60 * 1000, // 5 minutes
      maxEntries: 100,
      strategy: 'networkFirst'
    });

    // Static assets cache configuration
    this.cacheConfigs.set('static', {
      name: 'verinode-static-cache',
      version: 'v1',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxEntries: 200,
      strategy: 'cacheFirst'
    });

    // Images cache configuration
    this.cacheConfigs.set('images', {
      name: 'verinode-images-cache',
      version: 'v1',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxEntries: 100,
      strategy: 'cacheFirst'
    });

    // Documents cache configuration
    this.cacheConfigs.set('documents', {
      name: 'verinode-documents-cache',
      version: 'v1',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      maxEntries: 50,
      strategy: 'staleWhileRevalidate'
    });
  }

  async handleRequest(request: Request, cacheType: string): Promise<Response> {
    const config = this.cacheConfigs.get(cacheType);
    if (!config) {
      return fetch(request);
    }

    switch (config.strategy) {
      case 'cacheFirst':
        return this.cacheFirst(request, config);
      case 'networkFirst':
        return this.networkFirst(request, config);
      case 'staleWhileRevalidate':
        return this.staleWhileRevalidate(request, config);
      case 'networkOnly':
        return this.networkOnly(request);
      case 'cacheOnly':
        return this.cacheOnly(request, config);
      default:
        return this.networkFirst(request, config);
    }
  }

  private async cacheFirst(request: Request, config: CacheConfig): Promise<Response> {
    const cache = await caches.open(`${config.name}-${config.version}`);
    
    try {
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse && !this.isExpired(cachedResponse, config)) {
        return cachedResponse;
      }

      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        await this.addToCache(cache, request, networkResponse.clone(), config);
      }
      
      return networkResponse;
    } catch (error) {
      console.error('Cache first strategy failed:', error);
      const cachedResponse = await cache.match(request);
      return cachedResponse || this.createOfflineResponse();
    }
  }

  private async networkFirst(request: Request, config: CacheConfig): Promise<Response> {
    const cache = await caches.open(`${config.name}-${config.version}`);
    
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        await this.addToCache(cache, request, networkResponse.clone(), config);
      }
      
      return networkResponse;
    } catch (error) {
      console.log('Network failed, trying cache:', error);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return this.createOfflineResponse();
    }
  }

  private async staleWhileRevalidate(request: Request, config: CacheConfig): Promise<Response> {
    const cache = await caches.open(`${config.name}-${config.version}`);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request).then(async (networkResponse) => {
      if (networkResponse.ok) {
        await this.addToCache(cache, request, networkResponse.clone(), config);
      }
      return networkResponse;
    }).catch(error => {
      console.error('Background fetch failed:', error);
      return null;
    });

    if (cachedResponse && !this.isExpired(cachedResponse, config)) {
      // Trigger background fetch but return cached response immediately
      fetchPromise;
      return cachedResponse;
    }

    try {
      const networkResponse = await fetchPromise;
      return networkResponse || cachedResponse || this.createOfflineResponse();
    } catch (error) {
      return cachedResponse || this.createOfflineResponse();
    }
  }

  private async networkOnly(request: Request): Promise<Response> {
    try {
      return await fetch(request);
    } catch (error) {
      return this.createOfflineResponse();
    }
  }

  private async cacheOnly(request: Request, config: CacheConfig): Promise<Response> {
    const cache = await caches.open(`${config.name}-${config.version}`);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !this.isExpired(cachedResponse, config)) {
      return cachedResponse;
    }
    
    return this.createOfflineResponse();
  }

  private async addToCache(
    cache: Cache, 
    request: Request, 
    response: Response, 
    config: CacheConfig
  ): Promise<void> {
    try {
      // Check cache size limit
      const keys = await cache.keys();
      if (keys.length >= config.maxEntries) {
        // Remove oldest entry
        const oldestKey = keys[0];
        await cache.delete(oldestKey);
      }

      // Add custom headers for cache management
      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...response.headers,
          'x-cached-timestamp': Date.now().toString(),
          'x-cache-expires': (Date.now() + config.maxAge).toString()
        }
      });

      await cache.put(request, modifiedResponse);
    } catch (error) {
      console.error('Failed to add to cache:', error);
    }
  }

  private isExpired(response: Response, config: CacheConfig): boolean {
    const cachedTimestamp = response.headers.get('x-cached-timestamp');
    const expires = response.headers.get('x-cache-expires');
    
    if (expires) {
      return Date.now() > parseInt(expires);
    }
    
    if (cachedTimestamp) {
      return Date.now() - parseInt(cachedTimestamp) > config.maxAge;
    }
    
    return false;
  }

  private createOfflineResponse(): Response {
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

  async precacheAssets(urls: string[], cacheType: string = 'static'): Promise<void> {
    const config = this.cacheConfigs.get(cacheType);
    if (!config) return;

    const cache = await caches.open(`${config.name}-${config.version}`);
    
    try {
      await Promise.all(
        urls.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (error) {
            console.error(`Failed to precache ${url}:`, error);
          }
        })
      );
    } catch (error) {
      console.error('Precaching failed:', error);
    }
  }

  async clearCache(cacheType?: string): Promise<void> {
    if (cacheType) {
      const config = this.cacheConfigs.get(cacheType);
      if (config) {
        await caches.delete(`${config.name}-${config.version}`);
      }
    } else {
      // Clear all caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      );
    }
  }

  async getCacheSize(cacheType: string): Promise<number> {
    const config = this.cacheConfigs.get(cacheType);
    if (!config) return 0;

    const cache = await caches.open(`${config.name}-${config.version}`);
    const keys = await cache.keys();
    return keys.length;
  }

  async cleanupExpiredEntries(): Promise<void> {
    for (const [cacheType, config] of this.cacheConfigs) {
      const cache = await caches.open(`${config.name}-${config.version}`);
      const keys = await cache.keys();
      
      for (const request of keys) {
        const response = await cache.match(request);
        if (response && this.isExpired(response, config)) {
          await cache.delete(request);
        }
      }
    }
  }

  getCacheConfig(cacheType: string): CacheConfig | undefined {
    return this.cacheConfigs.get(cacheType);
  }

  updateCacheConfig(cacheType: string, config: Partial<CacheConfig>): void {
    const existingConfig = this.cacheConfigs.get(cacheType);
    if (existingConfig) {
      this.cacheConfigs.set(cacheType, { ...existingConfig, ...config });
    }
  }
}

export default CacheManager;
