import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

const createRateLimiter = (options: RateLimitOptions) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: options.standardHeaders !== false,
    legacyHeaders: options.legacyHeaders !== false,
    keyGenerator: options.keyGenerator || ((req: Request) => {
      return req.ip ||
        req.headers['x-forwarded-for'] as string ||
        req.headers['x-real-ip'] as string ||
        'unknown';
    }),
    skip: options.skip,
    handler: (req: Request, res: Response) => {
      const resetTime = new Date(Date.now() + options.windowMs);
      res.status(429).json({
        error: 'Too many requests',
        message: options.message || 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000),
        resetTime: resetTime.toISOString()
      });
    }
  });
};

export const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimits.strict,
  message: 'Rate limit exceeded. Please try again in 15 minutes.'
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimits.auth,
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.rateLimits.api,
  message: 'API rate limit exceeded. Please try again in 1 minute.'
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: config.rateLimits.upload,
  message: 'Upload limit exceeded. Please try again in 1 hour.'
});

export const createRateLimiter = createRateLimiter;
