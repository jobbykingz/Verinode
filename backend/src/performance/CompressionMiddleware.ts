import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * Configure response compression for all API layers
 */
export const CompressionMiddleware = compression({
  level: 6, // optimal balance of CPU vs Compression ratio
  threshold: 1024, // only compress responses > 1KB
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Only compress standard web assets and JSON payloads
    return compression.filter(req, res);
  }
});

/**
 * Custom middleware to suggest edge-caching for static/data layers
 */
export const EdgeCachingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET') {
    // Standard CDN/Edge cache-control: 1 hour public
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');
  }
  next();
};

export default CompressionMiddleware;
