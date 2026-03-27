import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cacheService';

export interface CacheMiddlewareOptions {
  ttl?: number;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  tags?: string[];
}

export const cacheMiddleware = (options: CacheMiddlewareOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check condition if provided
    if (options.condition && !options.condition(req)) {
      return next();
    }

    const key = options.keyGenerator 
      ? options.keyGenerator(req)
      : generateDefaultKey(req);

    try {
      const cached = await cacheService.get(key, {
        ttl: options.ttl,
        keyPrefix: options.keyPrefix,
        tags: options.tags
      });

      if (cached) {
        res.set({
          'X-Cache': 'HIT',
          'Content-Type': 'application/json'
        });
        return res.json(cached);
      }

      // Store original res.json to intercept response
      const originalJson = res.json;
      res.json = function(data: any) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(key, data, {
            ttl: options.ttl,
            keyPrefix: options.keyPrefix,
            tags: options.tags
          }).catch(error => {
            console.error('Cache middleware set error:', error);
          });
        }
        
        res.set('X-Cache', 'MISS');
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

export const invalidateCacheMiddleware = (options: { tags?: string[]; pattern?: string } = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data: any) {
      // Invalidate cache after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (options.tags) {
          Promise.all(
            options.tags.map(tag => cacheService.invalidateByTag(tag))
          ).catch(error => {
            console.error('Cache invalidation error:', error);
          });
        }
        
        if (options.pattern) {
          cacheService.invalidatePattern(options.pattern).catch(error => {
            console.error('Cache pattern invalidation error:', error);
          });
        }
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
};

function generateDefaultKey(req: Request): string {
  const baseUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  const queryString = Object.keys(req.query)
    .sort()
    .map(key => `${key}=${req.query[key]}`)
    .join('&');
  
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// Predefined middleware configurations
export const cacheProofVerification = cacheMiddleware({
  ttl: 1800, // 30 minutes
  keyPrefix: 'proof',
  keyGenerator: (req) => `verification:${req.params.proofId}`,
  tags: ['proof-verification']
});

export const cacheUserProofs = cacheMiddleware({
  ttl: 3600, // 1 hour
  keyPrefix: 'user',
  keyGenerator: (req) => `proofs:${req.params.userId}`,
  tags: ['user-proofs']
});

export const cacheAnalytics = cacheMiddleware({
  ttl: 300, // 5 minutes
  keyPrefix: 'analytics',
  keyGenerator: (req) => `stats:${JSON.stringify(req.query)}`,
  tags: ['analytics']
});

export const invalidateProofCache = invalidateCacheMiddleware({
  tags: ['proof-verification', 'user-proofs']
});

export const invalidateAnalyticsCache = invalidateCacheMiddleware({
  tags: ['analytics']
});
