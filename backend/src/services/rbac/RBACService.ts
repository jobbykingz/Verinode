import mongoose from 'mongoose';
import Role, { IRole } from '../../models/Role.ts';
import UserRole from '../../models/UserRole.ts';
import Permission, { IPermission } from '../../models/Permission.ts';

// Cache structure: userID -> Set<PermissionName>
const permissionCache = new Map<string, Set<string>>();

export class RBACService {
  /**
   * Resolves all permissions for a user, including those inherited from roles and role hierarchy.
   */
  public async getUserPermissions(userId: string): Promise<Set<string>> {
    const cached = permissionCache.get(userId);
    if (cached) return cached;

    // Find all roles directly assigned to the user
    const userRoles = await UserRole.find({ user: userId }).populate('role');
    const directRoles = userRoles.map(ur => ur.role as unknown as IRole);
    
    // Resolve full role list with hierarchy (traverse parents)
    const allRoles = await this.resolveRoleHierarchy(directRoles);
    
    // Get all permissions from all resolved roles
    const permissionNames = await this.getPermissionsFromRoles(allRoles);
    
    // Cache for 5 minutes (simple implementation)
    permissionCache.set(userId, permissionNames);
    setTimeout(() => permissionCache.delete(userId), 5 * 60 * 1000);

    return permissionNames;
  }

  /**
   * Checks if a user has a specific permission.
   */
  public async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.has(permissionName) || permissions.has('*') || permissions.has('admin_all');
  }

  /**
   * Hierarchy resolution: Admin > Manager > User.
   * Traverses up the parent chain to collect all inherited roles.
   */
  private async resolveRoleHierarchy(roles: IRole[]): Promise<IRole[]> {
    const roleIds = new Set<string>();
    const stack = [...roles];
    const resolvedRoles: IRole[] = [];

    while (stack.length > 0) {
      const role = stack.pop()!;
      if (roleIds.has(role._id.toString())) continue;

      roleIds.add(role._id.toString());
      resolvedRoles.push(role);

      if (role.parentRole) {
        const parent = await Role.findById(role.parentRole);
        if (parent) stack.push(parent);
      }
    }
    return resolvedRoles;
  }

  /**
   * Gets distinct permission names from a set of roles.
   */
  private async getPermissionsFromRoles(roles: IRole[]): Promise<Set<string>> {
    const permissionNames = new Set<string>();
    
    for (const role of roles) {
      if (!role.permissions || role.permissions.length === 0) continue;
      
      const permissions = await Permission.find({ _id: { $in: role.permissions } });
      permissions.forEach(p => permissionNames.add(p.name));
    }
    
    return permissionNames;
  }

  /**
   * Invalidates cache for a user (e.g., after role change).
   */
  public static invalidateCache(userId: string): void {
    permissionCache.delete(userId);
  }

  /**
   * Invalidates all permission caches.
   */
  public static clearCache(): void {
    permissionCache.clear();
  }
}

export default new RBACService();
