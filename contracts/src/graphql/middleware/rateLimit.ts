import { GraphQLContext } from '../../types';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory rate limit store - in production, use Redis or similar
const rateLimitStore: RateLimitStore = {};

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
}

const defaultOptions: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later.',
};

export const createRateLimiter = (options: Partial<RateLimitOptions> = {}) => {
  const config = { ...defaultOptions, ...options };

  return (context: GraphQLContext) => {
    const identifier = context.req.ip || context.req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    // Clean up expired entries
    if (rateLimitStore[identifier] && now > rateLimitStore[identifier].resetTime) {
      delete rateLimitStore[identifier];
    }

    // Initialize or increment counter
    if (!rateLimitStore[identifier]) {
      rateLimitStore[identifier] = {
        count: 1,
        resetTime: now + config.windowMs,
      };
    } else {
      rateLimitStore[identifier].count++;
    }

    // Check if limit exceeded
    if (rateLimitStore[identifier].count > config.max) {
      throw new Error(config.message || 'Rate limit exceeded');
    }

    // Add rate limit headers to response
    const remaining = Math.max(0, config.max - rateLimitStore[identifier].count);
    const resetTime = Math.ceil(rateLimitStore[identifier].resetTime / 1000);

    context.res.setHeader('X-RateLimit-Limit', config.max);
    context.res.setHeader('X-RateLimit-Remaining', remaining);
    context.res.setHeader('X-RateLimit-Reset', resetTime);
  };
};

// Pre-configured rate limiters for different use cases
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
});

export const queryRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 queries per minute
});

export const mutationRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 mutations per minute
});

// Rate limiting middleware for GraphQL operations
export const applyRateLimit = (context: GraphQLContext, operationType: 'query' | 'mutation' | 'subscription') => {
  switch (operationType) {
    case 'query':
      queryRateLimit(context);
      break;
    case 'mutation':
      mutationRateLimit(context);
      break;
    case 'subscription':
      // Subscriptions have their own connection limits
      break;
    default:
      queryRateLimit(context);
  }
};
