import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiting configuration for different endpoints
 */

// General rate limiter for most endpoints
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: '15 minutes',
      limit: 100,
      windowMs: 15 * 60 * 1000
    });
  }
});

// Strict rate limiter for sensitive operations
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded for this operation. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded for this operation. Please try again later.',
      retryAfter: '15 minutes',
      limit: 20,
      windowMs: 15 * 60 * 1000
    });
  }
});

// Proof creation rate limiter
export const proofCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 proof creations per hour
  message: {
    error: 'Too many proof creations',
    message: 'Proof creation limit exceeded. Please try again later.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req: Request) => {
    // Use user ID if available, otherwise IP
    return (req as any).user?.id || req.ip;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many proof creations',
      message: 'Proof creation limit exceeded. Please try again later.',
      retryAfter: '1 hour',
      limit: 50,
      windowMs: 60 * 60 * 1000
    });
  }
});

// Proof verification rate limiter
export const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 verifications per 15 minutes
  message: {
    error: 'Too many verification requests',
    message: 'Verification limit exceeded. Please try again later.',
    retryAfter: '15 minutes'
  },
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many verification requests',
      message: 'Verification limit exceeded. Please try again later.',
      retryAfter: '15 minutes',
      limit: 30,
      windowMs: 15 * 60 * 1000
    });
  }
});

// Proof update rate limiter
export const proofUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 updates per 15 minutes
  message: {
    error: 'Too many update requests',
    message: 'Update limit exceeded. Please try again later.',
    retryAfter: '15 minutes'
  },
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many update requests',
      message: 'Update limit exceeded. Please try again later.',
      retryAfter: '15 minutes',
      limit: 100,
      windowMs: 15 * 60 * 1000
    });
  }
});

// Proof deletion rate limiter
export const proofDeletionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 deletions per hour
  message: {
    error: 'Too many deletion requests',
    message: 'Deletion limit exceeded. Please try again later.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many deletion requests',
      message: 'Deletion limit exceeded. Please try again later.',
      retryAfter: '1 hour',
      limit: 20,
      windowMs: 60 * 60 * 1000
    });
  }
});

// Batch operations rate limiter
export const batchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 batch operations per hour
  message: {
    error: 'Too many batch operations',
    message: 'Batch operation limit exceeded. Please try again later.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many batch operations',
      message: 'Batch operation limit exceeded. Please try again later.',
      retryAfter: '1 hour',
      limit: 10,
      windowMs: 60 * 60 * 1000
    });
  }
});

// Search rate limiter
export const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 searches per 15 minutes
  message: {
    error: 'Too many search requests',
    message: 'Search limit exceeded. Please try again later.',
    retryAfter: '15 minutes'
  },
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many search requests',
      message: 'Search limit exceeded. Please try again later.',
      retryAfter: '15 minutes',
      limit: 50,
      windowMs: 15 * 60 * 1000
    });
  }
});

// Export rate limiter
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 exports per hour
  message: {
    error: 'Too many export requests',
    message: 'Export limit exceeded. Please try again later.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many export requests',
      message: 'Export limit exceeded. Please try again later.',
      retryAfter: '1 hour',
      limit: 5,
      windowMs: 60 * 60 * 1000
    });
  }
});

// Sharing rate limiter
export const sharingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 25, // Limit each IP to 25 shares per hour
  message: {
    error: 'Too many sharing requests',
    message: 'Sharing limit exceeded. Please try again later.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many sharing requests',
      message: 'Sharing limit exceeded. Please try again later.',
      retryAfter: '1 hour',
      limit: 25,
      windowMs: 60 * 60 * 1000
    });
  }
});

// Export all rate limiters as a single object for easier import
export const rateLimiter = {
  general: generalLimiter,
  strict: strictLimiter,
  proofCreation: proofCreationLimiter,
  verification: verificationLimiter,
  proofUpdate: proofUpdateLimiter,
  proofDeletion: proofDeletionLimiter,
  batch: batchLimiter,
  search: searchLimiter,
  export: exportLimiter,
  sharing: sharingLimiter
};

// Dynamic rate limiter based on user tier
export const createDynamicLimiter = (baseLimit: number, windowMs: number) => {
  return rateLimit({
    windowMs,
    max: (req: Request) => {
      const user = (req as any).user;
      if (!user) return baseLimit;
      
      // Adjust limits based on user tier
      switch (user.tier) {
        case 'premium':
          return baseLimit * 3;
        case 'enterprise':
          return baseLimit * 5;
        default:
          return baseLimit;
      }
    },
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: `${Math.ceil(windowMs / 60000)} minutes`
    },
    keyGenerator: (req: Request) => {
      return (req as any).user?.id || req.ip;
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Create rate limiters for different user tiers
export const userTierLimiters = {
  free: createDynamicLimiter(50, 15 * 60 * 1000),
  premium: createDynamicLimiter(150, 15 * 60 * 1000),
  enterprise: createDynamicLimiter(250, 15 * 60 * 1000)
};
