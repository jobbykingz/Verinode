/**
 * Utility functions for RBAC.
 */

/**
 * Common roles and permissions constants.
 */
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  GUEST: 'guest'
};

export const MODULES = {
  PROOFS: 'proofs',
  STELLAR: 'stellar',
  RBAC: 'rbac',
  USERS: 'users'
};

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  VERIFY: 'verify',
  ASSIGN: 'assign'
};

/**
 * Format permission name by module and action.
 * Example: createPermissionName('proofs', 'verify') -> 'proofs:verify'
 */
export const createPermissionName = (module: string, action: string): string => {
  return `${module}:${action}`;
};

/**
 * Create role templates representing common permission groups.
 */
export const ROLE_TEMPLATES = {
  [ROLES.ADMIN]: {
    description: 'Full system access',
    permissions: ['*']
  },
  [ROLES.MANAGER]: {
    description: 'Manage users and proofs, but not RBAC itself',
    permissions: [
      'proofs:*',
      'stellar:read',
      'users:*'
    ]
  },
  [ROLES.USER]: {
    description: 'Basic user permissions',
    permissions: [
      'proofs:create',
      'proofs:read',
      'stellar:read'
    ]
  }
};

/**
 * Generate a standard hierarchical structure.
 * Returns map of roleName -> parentRoleName.
 */
export const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: ROLES.MANAGER,
  [ROLES.MANAGER]: ROLES.USER,
  [ROLES.USER]: null
};
