const { IPFSService } = require('./ipfsService');
const express = require('express');
const { CID } = require('cids');

class GatewayService {
  constructor() {
    this.ipfsService = new IPFSService();
    this.app = express();
    this.config = {
      port: process.env.IPFS_GATEWAY_PORT || 8080,
      host: process.env.IPFS_GATEWAY_HOST || '0.0.0.0',
      corsEnabled: process.env.IPFS_GATEWAY_CORS !== 'false',
      rateLimitEnabled: process.env.IPFS_GATEWAY_RATE_LIMIT !== 'false',
      cacheEnabled: process.env.IPFS_GATEWAY_CACHE !== 'false',
      cacheMaxAge: parseInt(process.env.IPFS_GATEWAY_CACHE_MAX_AGE) || 3600000, // 1 hour
      maxContentSize: parseInt(process.env.IPFS_GATEWAY_MAX_SIZE) || 100 * 1024 * 1024, // 100MB
      allowedOrigins: process.env.IPFS_GATEWAY_ALLOWED_ORIGINS ? 
        process.env.IPFS_GATEWAY_ALLOWED_ORIGINS.split(',') : ['*']
    };
    
    this.cache = new Map();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS middleware
    if (this.config.corsEnabled) {
      this.app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (this.config.allowedOrigins.includes('*') || 
            this.config.allowedOrigins.includes(origin)) {
          res.header('Access-Control-Allow-Origin', origin || '*');
        }
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
        res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
        
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }

    // Rate limiting middleware
    if (this.config.rateLimitEnabled) {
      const rateLimitMap = new Map();
      
      this.app.use((req, res, next) => {
        const clientIp = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowMs = 60000; // 1 minute
        const maxRequests = 100; // 100 requests per minute
        
        if (!rateLimitMap.has(clientIp)) {
          rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs });
        } else {
          const client = rateLimitMap.get(clientIp);
          
          if (now > client.resetTime) {
            client.count = 1;
            client.resetTime = now + windowMs;
          } else {
            client.count++;
            
            if (client.count > maxRequests) {
              return res.status(429).json({
                error: 'Too many requests',
                retryAfter: Math.ceil((client.resetTime - now) / 1000)
              });
            }
          }
        }
        
        next();
      });
    }

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - ${req.ip}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // IPFS content gateway
    this.app.get('/ipfs/:cid(*)', async (req, res) => {
      try {
        const { cid } = req.params;
        const path = req.params[0] || '';
        
        if (!this.isValidCID(cid)) {
          return res.status(400).json({ error: 'Invalid CID format' });
        }

        const fullCid = path ? `${cid}/${path}` : cid;
        
        // Check cache first
        if (this.config.cacheEnabled) {
          const cached = this.getFromCache(fullCid);
          if (cached) {
            return this.sendCachedResponse(res, cached);
          }
        }

        // Retrieve content from IPFS
        const content = await this.ipfsService.getContent(fullCid);
        
        // Check content size
        if (content.length > this.config.maxContentSize) {
          return res.status(413).json({ 
            error: 'Content too large',
            maxSize: this.config.maxContentSize,
            actualSize: content.length
          });
        }

        // Cache the content
        if (this.config.cacheEnabled) {
          this.setCache(fullCid, content);
        }

        // Determine content type
        const contentType = this.getContentType(path, content);
        
        // Set response headers
        res.set({
          'Content-Type': contentType,
          'Content-Length': content.length,
          'Cache-Control': `public, max-age=${Math.floor(this.config.cacheMaxAge / 1000)}`,
          'X-IPFS-Content-CID': cid,
          'X-IPFS-Content-Size': content.length
        });

        // Send content
        res.send(Buffer.from(content));
        
      } catch (error) {
        console.error('Error serving IPFS content:', error);
        
        if (error.message.includes('not found')) {
          res.status(404).json({ error: 'Content not found on IPFS network' });
        } else if (error.message.includes('timeout')) {
          res.status(408).json({ error: 'Request timeout' });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    // IPNS content gateway
    this.app.get('/ipns/:name(*)', async (req, res) => {
      try {
        const { name } = req.params;
        const path = req.params[0] || '';
        
        // Resolve IPNS name to CID
        const resolvedCID = await this.resolveIPNS(name);
        
        if (!resolvedCID) {
          return res.status(404).json({ error: 'IPNS name not found' });
        }

        const fullCid = path ? `${resolvedCID}/${path}` : resolvedCID;
        
        // Check cache first
        if (this.config.cacheEnabled) {
          const cached = this.getFromCache(fullCid);
          if (cached) {
            return this.sendCachedResponse(res, cached);
          }
        }

        // Retrieve content from IPFS
        const content = await this.ipfsService.getContent(fullCid);
        
        // Cache the content
        if (this.config.cacheEnabled) {
          this.setCache(fullCid, content);
        }

        // Determine content type
        const contentType = this.getContentType(path, content);
        
        // Set response headers
        res.set({
          'Content-Type': contentType,
          'Content-Length': content.length,
          'Cache-Control': `public, max-age=${Math.floor(this.config.cacheMaxAge / 1000)}`,
          'X-IPNS-Name': name,
          'X-IPFS-Content-CID': resolvedCID,
          'X-IPFS-Content-Size': content.length
        });

        // Send content
        res.send(Buffer.from(content));
        
      } catch (error) {
        console.error('Error serving IPNS content:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Directory listing
    this.app.get('/ipfs/:cid/*', async (req, res) => {
      try {
        const { cid } = req.params;
        const path = req.params[0];
        
        // This is a simplified implementation
        // In a real implementation, you would use IPFS directory listing
        res.json({
          message: 'Directory listing not implemented in this demo',
          cid,
          path
        });
      } catch (error) {
        console.error('Error listing directory:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Gateway info endpoint
    this.app.get('/gateway/info', (req, res) => {
      res.json({
        gateway: {
          version: '1.0.0',
          features: {
            cors: this.config.corsEnabled,
            rateLimit: this.config.rateLimitEnabled,
            cache: this.config.cacheEnabled,
            maxContentSize: this.config.maxContentSize
          },
          endpoints: {
            ipfs: '/ipfs/:cid',
            ipns: '/ipns/:name',
            health: '/health',
            info: '/gateway/info'
          }
        }
      });
    });

    // Cache management endpoints
    this.app.get('/gateway/cache/stats', (req, res) => {
      const stats = this.getCacheStats();
      res.json(stats);
    });

    this.app.delete('/gateway/cache', (req, res) => {
      this.clearCache();
      res.json({ message: 'Cache cleared successfully' });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ 
        error: 'Not found',
        message: 'The requested resource was not found on this gateway',
        availableEndpoints: [
          '/ipfs/:cid',
          '/ipns/:name',
          '/health',
          '/gateway/info',
          '/gateway/cache/stats'
        ]
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error('Gateway error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  isValidCID(cid) {
    try {
      new CID(cid);
      return true;
    } catch (error) {
      return false;
    }
  }

  getContentType(path, content) {
    // Try to determine content type from file extension
    const ext = path.split('.').pop().toLowerCase();
    const mimeTypes = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'md': 'text/markdown'
    };

    if (mimeTypes[ext]) {
      return mimeTypes[ext];
    }

    // Try to detect content type from content
    if (content.length > 0) {
      // Check for JSON
      try {
        JSON.parse(content.toString());
        return 'application/json';
      } catch (e) {
        // Not JSON
      }

      // Check for HTML
      const contentStr = content.toString().substring(0, 100);
      if (contentStr.includes('<!DOCTYPE') || contentStr.includes('<html')) {
        return 'text/html';
      }

      // Check for text content
      if (this.isTextContent(content)) {
        return 'text/plain';
      }
    }

    return 'application/octet-stream';
  }

  isTextContent(content) {
    // Simple heuristic to detect text content
    try {
      const str = content.toString();
      return /^[\x00-\x7F]*$/.test(str) && !str.includes('\x00');
    } catch (e) {
      return false;
    }
  }

  async resolveIPNS(name) {
    try {
      await this.ipfsService.initialize();
      
      // This is a simplified implementation
      // In a real implementation, you would use IPNS resolution
      // For now, return the name as-is (assuming it's already a CID)
      return name;
    } catch (error) {
      console.error('Error resolving IPNS name:', error);
      return null;
    }
  }

  // Cache management methods
  getFromCache(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const cached = this.cache.get(key);
    
    // Check if cache entry is expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  setCache(key, content) {
    // Implement LRU cache eviction if cache is too large
    const maxCacheSize = 1000; // Maximum number of cached items
    
    if (this.cache.size >= maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      content,
      cachedAt: Date.now(),
      expiresAt: Date.now() + this.config.cacheMaxAge
    });
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 1000,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      hits: this.cacheHits || 0,
      misses: this.cacheMisses || 0
    };
  }

  sendCachedResponse(res, cached) {
    this.cacheHits = (this.cacheHits || 0) + 1;
    
    res.set({
      'Content-Type': this.getContentType('', cached.content),
      'Content-Length': cached.content.length,
      'Cache-Control': `public, max-age=${Math.floor(this.config.cacheMaxAge / 1000)}`,
      'X-Cache': 'HIT'
    });

    res.send(Buffer.from(cached.content));
  }

  async start() {
    try {
      await this.ipfsService.initialize();
      
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        console.log(`IPFS Gateway started on http://${this.config.host}:${this.config.port}`);
        console.log(`Gateway features: CORS=${this.config.corsEnabled}, Cache=${this.config.cacheEnabled}, RateLimit=${this.config.rateLimitEnabled}`);
      });

      this.cacheHits = 0;
      this.cacheMisses = 0;

      return this.server;
    } catch (error) {
      console.error('Failed to start IPFS Gateway:', error);
      throw error;
    }
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}

module.exports = { GatewayService };
