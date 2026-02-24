const crypto = require('crypto');
const PerformanceMetrics = require('../models/PerformanceMetrics');

class QueryCache {
  constructor(options = {}) {
    this.options = {
      maxSize: options.maxSize || 1000, // Maximum number of cached queries
      ttl: options.ttl || 300000, // 5 minutes default TTL
      maxSizeBytes: options.maxSizeBytes || 100 * 1024 * 1024, // 100MB
      cleanupInterval: options.cleanupInterval || 60000, // 1 minute
      compressionThreshold: options.compressionThreshold || 1024, // 1KB
      enableCompression: options.enableCompression || false,
      enableMetrics: options.enableMetrics !== false,
      ...options
    };
    
    this.cache = new Map();
    this.accessTimes = new Map();
    this.sizes = new Map();
    this.currentSizeBytes = 0;
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      compressions: 0,
      decompressions: 0,
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      avgHitTime: 0,
      avgMissTime: 0,
      currentSize: 0,
      currentSizeBytes: 0
    };
    
    this.cleanupTimer = null;
    this.startCleanup();
  }

  /**
   * Generate cache key from query
   */
  generateKey(query, collection, options = {}) {
    const keyData = {
      query: typeof query === 'string' ? query : JSON.stringify(query),
      collection,
      options: JSON.stringify(options)
    };
    
    const keyString = JSON.stringify(keyData);
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  /**
   * Get cached query result
   */
  async get(query, collection, options = {}) {
    const startTime = Date.now();
    const key = this.generateKey(query, collection, options);
    
    try {
      const cached = this.cache.get(key);
      
      if (!cached) {
        this.stats.misses++;
        this.stats.totalMisses++;
        this.updateMissTime(startTime);
        return null;
      }
      
      // Check TTL
      if (Date.now() > cached.expiresAt) {
        this.delete(key);
        this.stats.misses++;
        this.stats.totalMisses++;
        this.updateMissTime(startTime);
        return null;
      }
      
      // Update access time
      this.accessTimes.set(key, Date.now());
      
      // Decompress if needed
      let result = cached.data;
      if (cached.compressed) {
        result = await this.decompress(result);
        this.stats.decompressions++;
      }
      
      this.stats.hits++;
      this.stats.totalHits++;
      this.updateHitTime(startTime);
      this.updateHitRate();
      
      // Log cache hit metrics
      if (this.options.enableMetrics) {
        await this.logCacheMetrics(key, true, Date.now() - startTime);
      }
      
      return result;
      
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      this.stats.totalMisses++;
      return null;
    }
  }

  /**
   * Set query result in cache
   */
  async set(query, collection, result, options = {}) {
    const key = this.generateKey(query, collection, options);
    const ttl = options.ttl || this.options.ttl;
    
    try {
      // Check if we need to evict items
      await this.ensureCapacity();
      
      // Compress if needed
      let data = result;
      let compressed = false;
      let size = this.calculateSize(result);
      
      if (this.options.enableCompression && size > this.options.compressionThreshold) {
        data = await this.compress(data);
        compressed = true;
        size = this.calculateSize(data);
        this.stats.compressions++;
      }
      
      const cacheEntry = {
        data,
        compressed,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttl,
        size,
        queryHash: this.generateQueryHash(query),
        collection
      };
      
      // Delete existing entry if present
      if (this.cache.has(key)) {
        this.delete(key);
      }
      
      // Add to cache
      this.cache.set(key, cacheEntry);
      this.accessTimes.set(key, Date.now());
      this.sizes.set(key, size);
      this.currentSizeBytes += size;
      
      this.stats.sets++;
      this.updateCurrentSize();
      
      // Log cache set metrics
      if (this.options.enableMetrics) {
        await this.logCacheMetrics(key, false, 0, size);
      }
      
      return true;
      
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete entry from cache
   */
  delete(key) {
    if (this.cache.has(key)) {
      const size = this.sizes.get(key) || 0;
      
      this.cache.delete(key);
      this.accessTimes.delete(key);
      this.sizes.delete(key);
      this.currentSizeBytes -= size;
      
      this.stats.deletes++;
      this.updateCurrentSize();
      
      return true;
    }
    
    return false;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const count = this.cache.size;
    
    this.cache.clear();
    this.accessTimes.clear();
    this.sizes.clear();
    this.currentSizeBytes = 0;
    
    this.stats.deletes += count;
    this.updateCurrentSize();
    
    console.log(`Cleared ${count} cache entries`);
  }

  /**
   * Ensure cache has capacity for new entry
   */
  async ensureCapacity() {
    // Check size limits
    while (this.cache.size >= this.options.maxSize || 
           this.currentSizeBytes >= this.options.maxSizeBytes) {
      await this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   */
  async evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, accessTime] of this.accessTimes) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
    
    return expiredKeys.length;
  }

  /**
   * Start cleanup timer
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Compress data
   */
  async compress(data) {
    const zlib = require('zlib');
    const jsonString = JSON.stringify(data);
    return zlib.gzipSync(jsonString);
  }

  /**
   * Decompress data
   */
  async decompress(compressedData) {
    const zlib = require('zlib');
    const jsonString = zlib.gunzipSync(compressedData).toString();
    return JSON.parse(jsonString);
  }

  /**
   * Calculate size of data
   */
  calculateSize(data) {
    if (Buffer.isBuffer(data)) {
      return data.length;
    }
    
    try {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch (error) {
      return 1024; // Default size if serialization fails
    }
  }

  /**
   * Generate query hash for metrics
   */
  generateQueryHash(query) {
    const queryString = typeof query === 'string' ? query : JSON.stringify(query);
    return crypto.createHash('md5').update(queryString).digest('hex').substring(0, 8);
  }

  /**
   * Update hit rate
   */
  updateHitRate() {
    const total = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRate = total > 0 ? this.stats.totalHits / total : 0;
  }

  /**
   * Update average hit time
   */
  updateHitTime(startTime) {
    const hitTime = Date.now() - startTime;
    const totalHits = this.stats.totalHits;
    
    this.stats.avgHitTime = 
      ((this.stats.avgHitTime * (totalHits - 1)) + hitTime) / totalHits;
  }

  /**
   * Update average miss time
   */
  updateMissTime(startTime) {
    const missTime = Date.now() - startTime;
    const totalMisses = this.stats.totalMisses;
    
    this.stats.avgMissTime = 
      ((this.stats.avgMissTime * (totalMisses - 1)) + missTime) / totalMisses;
  }

  /**
   * Update current size stats
   */
  updateCurrentSize() {
    this.stats.currentSize = this.cache.size;
    this.stats.currentSizeBytes = this.currentSizeBytes;
  }

  /**
   * Log cache metrics
   */
  async logCacheMetrics(key, isHit, accessTime, size = 0) {
    try {
      const entry = this.cache.get(key);
      if (!entry) return;
      
      await PerformanceMetrics.create({
        queryHash: entry.queryHash,
        queryText: '', // We don't store the full query in cache
        executionTime: accessTime,
        databaseName: 'cache',
        collectionName: entry.collection,
        cacheHit: isHit,
        cacheKey: key,
        documentsScanned: 0,
        documentsReturned: isHit ? 1 : 0,
        slowQuery: accessTime > 100
      });
    } catch (error) {
      // Don't let logging errors break cache functionality
      console.warn('Failed to log cache metrics:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: Math.round(this.stats.hitRate * 10000) / 100, // Round to 2 decimal places
      avgHitTime: Math.round(this.stats.avgHitTime * 100) / 100,
      avgMissTime: Math.round(this.stats.avgMissTime * 100) / 100,
      memoryUsage: {
        currentBytes: this.currentSizeBytes,
        maxBytes: this.options.maxSizeBytes,
        utilization: Math.round((this.currentSizeBytes / this.options.maxSizeBytes) * 10000) / 100
      },
      options: this.options
    };
  }

  /**
   * Get detailed cache information
   */
  getCacheInfo() {
    const entries = [];
    
    for (const [key, entry] of this.cache) {
      entries.push({
        key: key.substring(0, 16) + '...', // Truncated for security
        queryHash: entry.queryHash,
        collection: entry.collection,
        size: entry.size,
        compressed: entry.compressed,
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt,
        lastAccessed: this.accessTimes.get(key),
        ttl: entry.expiresAt - Date.now()
      });
    }
    
    return {
      entries: entries.sort((a, b) => b.lastAccessed - a.lastAccessed),
      totalEntries: entries.length,
      stats: this.getStats()
    };
  }

  /**
   * Preload cache with common queries
   */
  async preload(preloadData) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (const item of preloadData) {
      try {
        await this.set(item.query, item.collection, item.result, item.options);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          query: item.query,
          error: error.message
        });
      }
    }
    
    console.log(`Cache preload completed: ${results.successful} successful, ${results.failed} failed`);
    return results;
  }

  /**
   * Export cache data for backup/migration
   */
  async export() {
    const exportData = {
      entries: [],
      stats: this.getStats(),
      exportedAt: new Date()
    };
    
    for (const [key, entry] of this.cache) {
      exportData.entries.push({
        key,
        data: entry.data,
        metadata: {
          compressed: entry.compressed,
          createdAt: entry.createdAt,
          expiresAt: entry.expiresAt,
          queryHash: entry.queryHash,
          collection: entry.collection,
          size: entry.size
        }
      });
    }
    
    return exportData;
  }

  /**
   * Import cache data
   */
  async import(importData) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };
    
    this.clear(); // Clear existing cache
    
    for (const entry of importData.entries) {
      try {
        const cacheEntry = {
          data: entry.data,
          ...entry.metadata
        };
        
        this.cache.set(entry.key, cacheEntry);
        this.accessTimes.set(entry.key, entry.metadata.createdAt);
        this.sizes.set(entry.key, entry.metadata.size);
        this.currentSizeBytes += entry.metadata.size;
        
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          key: entry.key,
          error: error.message
        });
      }
    }
    
    this.updateCurrentSize();
    console.log(`Cache import completed: ${results.successful} successful, ${results.failed} failed`);
    return results;
  }

  /**
   * Shutdown cache
   */
  shutdown() {
    this.stopCleanup();
    this.clear();
    console.log('Query cache shutdown complete');
  }
}

module.exports = QueryCache;
