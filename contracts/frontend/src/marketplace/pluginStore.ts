import { PluginMetadata } from '../plugins/pluginAPI';

export interface PluginListing {
  id: string;
  metadata: PluginMetadata;
  author: {
    name: string;
    email?: string;
    website?: string;
    verified: boolean;
  };
  stats: {
    downloads: number;
    rating: number;
    reviews: number;
    lastUpdated: string;
  };
  pricing: {
    type: 'free' | 'paid' | 'freemium';
    price?: string;
    trialDays?: number;
  };
  tags: string[];
  screenshots: string[];
  documentation: string;
  changelog: string;
  repository?: string;
  license: string;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  tags?: string[];
  pricing?: 'free' | 'paid' | 'freemium';
  rating?: number;
  verified?: boolean;
  sortBy?: 'relevance' | 'downloads' | 'rating' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  plugins: PluginListing[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export class PluginStore {
  private baseUrl = '/api/marketplace';
  private cache = new Map<string, any>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  async searchPlugins(filters: SearchFilters = {}): Promise<SearchResult> {
    const cacheKey = this.generateCacheKey('search', filters);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    const params = new URLSearchParams();
    
    if (filters.query) params.append('q', filters.query);
    if (filters.category) params.append('category', filters.category);
    if (filters.tags?.length) params.append('tags', filters.tags.join(','));
    if (filters.pricing) params.append('pricing', filters.pricing);
    if (filters.rating) params.append('rating', filters.rating.toString());
    if (filters.verified !== undefined) params.append('verified', filters.verified.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await fetch(`${this.baseUrl}/search?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to search plugins: ${response.statusText}`);
    }

    const result = await response.json();
    this.setCache(cacheKey, result);
    
    return result;
  }

  async getPluginDetails(pluginId: string): Promise<PluginListing> {
    const cacheKey = `plugin-${pluginId}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await fetch(`${this.baseUrl}/plugins/${pluginId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }
      throw new Error(`Failed to get plugin details: ${response.statusText}`);
    }

    const plugin = await response.json();
    this.setCache(cacheKey, plugin);
    
    return plugin;
  }

  async getPluginDownload(pluginId: string, version?: string): Promise<Blob> {
    const params = version ? `?version=${version}` : '';
    const response = await fetch(`${this.baseUrl}/plugins/${pluginId}/download${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to download plugin: ${response.statusText}`);
    }

    return response.blob();
  }

  async getPluginVersions(pluginId: string): Promise<string[]> {
    const cacheKey = `versions-${pluginId}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await fetch(`${this.baseUrl}/plugins/${pluginId}/versions`);
    
    if (!response.ok) {
      throw new Error(`Failed to get plugin versions: ${response.statusText}`);
    }

    const versions = await response.json();
    this.setCache(cacheKey, versions);
    
    return versions;
  }

  async getPopularPlugins(limit = 10): Promise<PluginListing[]> {
    const cacheKey = `popular-${limit}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await fetch(`${this.baseUrl}/popular?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get popular plugins: ${response.statusText}`);
    }

    const plugins = await response.json();
    this.setCache(cacheKey, plugins);
    
    return plugins;
  }

  async getRecentPlugins(limit = 10): Promise<PluginListing[]> {
    const cacheKey = `recent-${limit}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await fetch(`${this.baseUrl}/recent?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get recent plugins: ${response.statusText}`);
    }

    const plugins = await response.json();
    this.setCache(cacheKey, plugins);
    
    return plugins;
  }

  async getCategories(): Promise<string[]> {
    const cacheKey = 'categories';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await fetch(`${this.baseUrl}/categories`);
    
    if (!response.ok) {
      throw new Error(`Failed to get categories: ${response.statusText}`);
    }

    const categories = await response.json();
    this.setCache(cacheKey, categories);
    
    return categories;
  }

  async getTags(): Promise<string[]> {
    const cacheKey = 'tags';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await fetch(`${this.baseUrl}/tags`);
    
    if (!response.ok) {
      throw new Error(`Failed to get tags: ${response.statusText}`);
    }

    const tags = await response.json();
    this.setCache(cacheKey, tags);
    
    return tags;
  }

  async submitReview(pluginId: string, review: {
    rating: number;
    title: string;
    content: string;
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/plugins/${pluginId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(review),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit review: ${response.statusText}`);
    }

    this.clearCache(`plugin-${pluginId}`);
  }

  async getReviews(pluginId: string, page = 1, pageSize = 10): Promise<{
    reviews: any[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const params = `?page=${page}&pageSize=${pageSize}`;
    const response = await fetch(`${this.baseUrl}/plugins/${pluginId}/reviews${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get reviews: ${response.statusText}`);
    }

    return response.json();
  }

  async reportPlugin(pluginId: string, reason: string, description: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/plugins/${pluginId}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, description }),
    });

    if (!response.ok) {
      throw new Error(`Failed to report plugin: ${response.statusText}`);
    }
  }

  private generateCacheKey(type: string, params: any): string {
    return `${type}-${JSON.stringify(params)}`;
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  clearAllCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  setCacheTimeout(timeout: number): void {
    this.cacheTimeout = timeout;
  }
}
