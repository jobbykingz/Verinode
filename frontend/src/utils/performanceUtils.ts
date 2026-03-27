/**
 * Utility functions for frontend performance analysis and optimization
 */
export const performanceUtils = {
  /**
   * Measure execution time of an async operation
   */
  async measureTime<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const end = performance.now();
      console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
      return result;
    } catch (e) {
      const end = performance.now();
      console.error(`[Performance Failed] ${label}: ${(end - start).toFixed(2)}ms`, e);
      throw e;
    }
  },

  /**
   * Simple debouncing function for optimized interaction handlers
   */
  debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Generate a unique cache key from an object or URL
   */
  generateCacheKey(input: string | object): string {
    if (typeof input === 'string') return btoa(input);
    return btoa(JSON.stringify(input));
  },

  /**
   * Log critical performance metrics to core-web-vitals analytics
   */
  reportWebVital(metric: any): void {
    const body = JSON.stringify(metric);
    const url = '/api/performance/vitals';
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      fetch(url, { body, method: 'POST', keepalive: true });
    }
  }
};

export default performanceUtils;
