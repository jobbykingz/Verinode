import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../utils/apiResponse';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        tier: 'free' | 'premium' | 'enterprise';
        permissions: string[];
      };
    }
  }
}

/**
 * Authentication middleware
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return ApiResponse.unauthorized(res, 'Access token is required');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Add user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      tier: decoded.tier || 'free',
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return ApiResponse.unauthorized(res, 'Invalid or expired token');
    }
    
    console.error('Authentication error:', error);
    return ApiResponse.unauthorized(res, 'Authentication failed');
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      req.user = {
        id: decoded.id,
        email: decoded.email,
        tier: decoded.tier || 'free',
        permissions: decoded.permissions || []
      };
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

/**
 * Permission-based middleware
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentication required');
    }

    if (!req.user.permissions.includes(permission)) {
      return ApiResponse.forbidden(res, `Permission '${permission}' required`);
    }

    next();
  };
};

/**
 * Tier-based middleware
 */
export const requireTier = (minTier: 'free' | 'premium' | 'enterprise') => {
  const tierHierarchy = {
    'free': 0,
    'premium': 1,
    'enterprise': 2
  };

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentication required');
    }

    const userTierLevel = tierHierarchy[req.user.tier];
    const requiredTierLevel = tierHierarchy[minTier];

    if (userTierLevel < requiredTierLevel) {
      return ApiResponse.forbidden(res, `${minTier} tier or higher required`);
    }

    next();
  };
};

/**
 * Admin-only middleware
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  if (!req.user.permissions.includes('admin')) {
    return ApiResponse.forbidden(res, 'Admin access required');
  }

  next();
};

/**
 * Resource owner middleware (user can only access their own resources)
 */
export const requireOwnership = (resourceIdParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentication required');
    }

    const resourceId = req.params[resourceIdParam];
    const userId = req.user.id;

    // Check if user is admin (can access any resource)
    if (req.user.permissions.includes('admin')) {
      return next();
    }

    // Check if resource belongs to user
    // This would typically involve a database check
    // For now, we'll assume the resource ID format includes user ID
    if (resourceId && !resourceId.includes(userId)) {
      return ApiResponse.forbidden(res, 'Access denied: Resource does not belong to user');
    }

    next();
  };
};
