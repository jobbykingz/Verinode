import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Authentication middleware
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      logger.error('JWT verification failed:', err);
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = user as any;
    next();
  });
};

/**
 * Role-based access control middleware
 */
export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Multi-signature authorization middleware
 */
export const requireMultiSigAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Check if the request has multi-signature authorization
  const multiSigHeader = req.headers['x-multisig-auth'];
  
  if (!multiSigHeader) {
    return res.status(401).json({
      success: false,
      error: 'Multi-signature authorization required'
    });
  }

  try {
    // Verify the multi-signature token
    const decoded = jwt.verify(multiSigHeader as string, process.env.MULTISIG_SECRET || 'multisig-secret');
    req.multiSigAuth = decoded;
    next();
  } catch (error) {
    logger.error('Multi-sig auth verification failed:', error);
    return res.status(403).json({
      success: false,
      error: 'Invalid multi-signature authorization'
    });
  }
};

/**
 * Rate limiting middleware for sensitive operations
 */
export const sensitiveOperationRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // This is a simplified rate limiter - in production, use a proper rate limiting library
  const clientIp = req.ip || 'unknown';
  const currentTime = Date.now();
  
  // Store rate limit data in memory (in production, use Redis)
  const rateLimitData = (global as any).rateLimitData || {};
  const userRequests = rateLimitData[clientIp] || [];
  
  // Remove requests older than 15 minutes
  const recentRequests = userRequests.filter((time: number) => currentTime - time < 15 * 60 * 1000);
  
  if (recentRequests.length >= 5) {
    return res.status(429).json({
      success: false,
      error: 'Too many sensitive operations. Please try again later.'
    });
  }
  
  recentRequests.push(currentTime);
  rateLimitData[clientIp] = recentRequests;
  (global as any).rateLimitData = rateLimitData;
  
  next();
};

/**
 * Wallet ownership verification middleware
 */
export const requireWalletOwnership = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const walletId = req.params.walletId || req.body.walletId;
  
  if (!walletId) {
    return res.status(400).json({
      success: false,
      error: 'Wallet ID required'
    });
  }

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    // Check if user is a signer for the wallet
    const MultiSigWallet = require('../models/MultiSigWallet').default;
    const wallet = await MultiSigWallet.findOne({ walletId });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    const isSigner = wallet.config.signers.some(signer => 
      signer.address === req.user!.id || signer.address === req.user!.email
    );

    if (!isSigner) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: not a wallet signer'
      });
    }

    req.wallet = wallet;
    next();
  } catch (error) {
    logger.error('Wallet ownership verification failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export default {
  authenticateToken,
  requireRole,
  requireMultiSigAuth,
  sensitiveOperationRateLimit,
  requireWalletOwnership
};
