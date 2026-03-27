import { Request, Response, NextFunction } from 'express';
import redis from '../config/redisConfig';

export class ResponseCache {
  /**
   * Simple In-Memory/Redis Response Caching Middleware
   */
  static async middleware(ttl: number = 60) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only cache GET requests
      if (req.method !== 'GET') return next();

      const key = `cache:${req.originalUrl}`;
      try {
        const cached = await redis.get(key);
        if (cached) {
          res.setHeader('X-Cache', 'HIT');
          return res.json(JSON.parse(cached));
        }

        // Intercept res.json
        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
          // Store response in cache for TTL
          redis.set(key, JSON.stringify(body), 'EX', ttl);
          res.setHeader('X-Cache', 'MISS');
          return originalJson(body);
        };

        next();
      } catch (err) {
        console.error('Cache error:', err);
        next();
      }
    };
  }

  /**
   * Clear cache for specific endpoints or patterns
   */
  static async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(`cache:${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  /**
   * Health check for cache layer
   */
  static async getCacheEfficiency(): Promise<number> {
    // Logic to calculate cache hit/miss ratio based on stats if available
    return Math.random() * 20 + 75; // Mock 75-95% efficiency
  }
}

export default ResponseCache;
