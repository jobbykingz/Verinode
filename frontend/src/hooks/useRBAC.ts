import { useQuery } from 'react-query';
import rbacService from '../services/rbacService.ts';

/**
 * Custom hook to check if user has required permissions.
 */
export const useRBAC = (userId?: string) => {
  // Fetch user permissions using react-query
  const { data: permissions = [], isLoading, error } = useQuery(
    ['user-permissions', userId],
    () => (userId ? rbacService.getUserPermissions(userId) : Promise.resolve([])),
    {
      enabled: !!userId,
      staleTime: 5 * 60 * 1000 // Cache for 5 minutes
    }
  );

  /**
   * Check if a single permission exists for the user.
   */
  const hasPermission = (permissionName: string): boolean => {
    return permissions.includes(permissionName) || permissions.includes('*') || permissions.includes('admin_all');
  };

  /**
   * Check if any of the permissions exist for the user.
   */
  const hasAnyPermission = (permissionNames: string[]): boolean => {
    return permissionNames.some(p => hasPermission(p));
  };

  /**
   * Check if all of the permissions exist for the user.
   */
  const hasAllPermissions = (permissionNames: string[]): boolean => {
    return permissionNames.every(p => hasPermission(p));
  };

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  };
};

export default useRBAC;
