/**
 * Advanced caching strategies for frontend assets and data
 */
export class CacheManager {
  private static STORAGE_KEY = 'verinode_cache_v1';
  private static TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Safe set item with TTL and optional versioning
   */
  static set(key: string, value: any, ttl = this.TTL): void {
    const data = {
      value,
      expiry: Date.now() + ttl,
      version: '1.0.0'
    };
    try {
      localStorage.setItem(`${this.STORAGE_KEY}_${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage Quota exceeded, clearing old items');
      this.clearOld();
    }
  }

  /**
   * Get item only if not expired
   */
  static get(key: string): any | null {
    const raw = localStorage.getItem(`${this.STORAGE_KEY}_${key}`);
    if (!raw) return null;

    try {
      const data = JSON.parse(raw);
      if (Date.now() > data.expiry) {
        localStorage.removeItem(`${this.STORAGE_KEY}_${key}`);
        return null;
      }
      return data.value;
    } catch (e) {
      return null;
    }
  }

  /**
   * Cache-First strategy for API calls
   */
  static async fetchWithCache(key: string, fetchFn: () => Promise<any>): Promise<any> {
    const cached = this.get(key);
    if (cached) return cached;

    const FreshData = await fetchFn();
    this.set(key, FreshData);
    return FreshData;
  }

  private static clearOld(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.STORAGE_KEY)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Clear cache for deployment or version upgrades
   */
  static forceReset(): void {
    this.clearOld();
  }
}

export default CacheManager;
