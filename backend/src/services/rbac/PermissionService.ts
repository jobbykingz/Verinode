import Role from '../../models/Role.ts';
import Permission from '../../models/Permission.ts';
import UserRole from '../../models/UserRole.ts';
import { RBACService } from './RBACService.ts';

/**
 * Service to manage roles, permissions, and user role assignments.
 */
export class PermissionService {
  /**
   * Create a new role with assigned permissions.
   */
  public async createRole(data: { name: string; description: string; parentRole?: string; permissions?: string[] }) {
    const role = new Role({
      name: data.name,
      description: data.description,
      parentRole: data.parentRole || null,
      permissions: data.permissions || []
    });
    return await role.save();
  }

  /**
   * Create a new permission.
   */
  public async createPermission(data: { name: string; description: string; module: string; action: string }) {
    const permission = new Permission(data);
    return await permission.save();
  }

  /**
   * Assign a role to a user.
   */
  public async assignRoleToUser(userId: string, roleId: string, assignedBy?: string) {
    const userRole = new UserRole({
      user: userId,
      role: roleId,
      assignedBy: assignedBy
    });
    const result = await userRole.save();
    
    // Invalidate permission cache for this user
    RBACService.invalidateCache(userId);
    
    return result;
  }

  /**
   * Remove a role from a user.
   */
  public async removeRoleFromUser(userId: string, roleId: string) {
    const result = await UserRole.deleteOne({ user: userId, role: roleId });
    RBACService.invalidateCache(userId);
    return result;
  }

  /**
   * Update permissions for a role.
   */
  public async updateRolePermissions(roleId: string, permissionIds: string[]) {
    const role = await Role.findByIdAndUpdate(roleId, { permissions: permissionIds }, { new: true });
    
    // Clear all cache as role permissions changed
    RBACService.clearCache();
    
    return role;
  }

  /**
   * Audit Log implementation (Mock for now, can be sent to a real Audit collection).
   */
  public async logAudit(userId: string, action: string, details: any) {
    console.log(`[AUDIT] User: ${userId}, Action: ${action}, Details: ${JSON.stringify(details)}`);
    // Implement real audit logging collection if needed.
  }
}

export default new PermissionService();
