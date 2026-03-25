import { Request, Response, NextFunction } from 'express';
import RBACService from '../services/rbac/RBACService.ts';

/**
 * Middleware to protect routes based on required permission.
 */
export const hasPermission = (permissionName: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Assuming 'req.user' is populated by auth middleware
      const user = (req as any).user;
      
      if (!user || (!user.id && !user._id)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = user.id || user._id;
      const hasAccess = await RBACService.hasPermission(userId.toString(), permissionName);

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: `Insufficient permissions: '${permissionName}' required.` 
        });
      }

      next();
    } catch (error) {
      console.error(`Error in rbac middleware for permission ${permissionName}:`, error);
      res.status(500).json({ error: 'Internal server error while checking permissions' });
    }
  };
};

/**
 * Higher-order middleware to require at least one of many permissions.
 */
export const hasAnyPermission = (permissionNames: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'Authentication required' });

      const userId = user.id || user._id;
      const userPermissions = await RBACService.getUserPermissions(userId.toString());
      
      const hasAccess = permissionNames.some(p => userPermissions.has(p) || userPermissions.has('admin_all'));

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: `At least one of [${permissionNames.join(', ')}] required.` 
        });
      }

      next();
    } catch (error) {
      console.error('Error in rbac middleware:', error);
      res.status(500).json({ error: 'Internal server error while checking permissions' });
    }
  };
};
