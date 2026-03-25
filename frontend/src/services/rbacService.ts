import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface IRole {
  _id: string;
  name: string;
  description: string;
  parentRole?: string | IRole;
  permissions: string[] | IPermission[];
  isSystem: boolean;
}

export interface IPermission {
  _id: string;
  name: string;
  description: string;
  module: string;
  action: string;
}

export interface IUserRoleAssignment {
  userId: string;
  roleId: string;
}

class RBACService {
  // Roles
  async getRoles(): Promise<IRole[]> {
    const response = await axios.get(`${API_URL}/rbac/roles`);
    return response.data;
  }

  async createRole(data: Partial<IRole>): Promise<IRole> {
    const response = await axios.post(`${API_URL}/rbac/roles`, data);
    return response.data;
  }

  async updateRole(id: string, data: Partial<IRole>): Promise<IRole> {
    const response = await axios.put(`${API_URL}/rbac/roles/${id}`, data);
    return response.data;
  }

  async deleteRole(id: string): Promise<void> {
    await axios.delete(`${API_URL}/rbac/roles/${id}`);
  }

  // Permissions
  async getPermissions(): Promise<IPermission[]> {
    const response = await axios.get(`${API_URL}/rbac/permissions`);
    return response.data;
  }

  // User Role Assignments
  async assignRole(userId: string, roleId: string): Promise<void> {
    await axios.post(`${API_URL}/rbac/users/${userId}/roles`, { roleId });
  }

  async revokeRole(userId: string, roleId: string): Promise<void> {
    await axios.delete(`${API_URL}/rbac/users/${userId}/roles/${roleId}`);
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const response = await axios.get(`${API_URL}/rbac/users/${userId}/permissions`);
    return response.data;
  }

  /**
   * Bulk role assignment: Assign multiple roles to multiple users.
   */
  async bulkAssignRoles(assignments: IUserRoleAssignment[]): Promise<void> {
    await axios.post(`${API_URL}/rbac/bulk-assign`, { assignments });
  }
}

export default new RBACService();
