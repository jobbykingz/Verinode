import { PluginPermission, PluginMetadata } from './pluginAPI';

export class PermissionsModel {
  private allowedPermissions = new Map<string, PluginPermission[]>();
  private deniedPermissions = new Map<string, PluginPermission[]>();
  private permissionLevels = ['read', 'write', 'execute', 'admin'] as const;

  constructor() {
    this.initializeDefaultPermissions();
  }

  async validatePermissions(permissions: PluginPermission[]): Promise<boolean> {
    for (const permission of permissions) {
      if (!this.isValidPermission(permission)) {
        return false;
      }

      if (this.isPermissionDenied(permission)) {
        return false;
      }
    }
    return true;
  }

  async checkPermission(pluginId: string, permissionType: string, scope: string[]): Promise<boolean> {
    const pluginPermissions = this.allowedPermissions.get(pluginId) || [];
    
    for (const requestedScope of scope) {
      const hasPermission = pluginPermissions.some(permission => 
        permission.type === permissionType && 
        (permission.scope.includes('*') || permission.scope.includes(requestedScope))
      );
      
      if (!hasPermission) {
        return false;
      }
    }
    
    return true;
  }

  grantPermission(pluginId: string, permission: PluginPermission): void {
    if (!this.allowedPermissions.has(pluginId)) {
      this.allowedPermissions.set(pluginId, []);
    }
    
    const permissions = this.allowedPermissions.get(pluginId)!;
    
    if (!permissions.some(p => 
      p.type === permission.type && 
      p.scope.every(s => permission.scope.includes(s))
    )) {
      permissions.push(permission);
    }
  }

  revokePermission(pluginId: string, permissionType: string, scope: string[]): void {
    const permissions = this.allowedPermissions.get(pluginId);
    if (permissions) {
      const filtered = permissions.filter(p => 
        !(p.type === permissionType && 
          p.scope.some(s => scope.includes(s)))
      );
      this.allowedPermissions.set(pluginId, filtered);
    }
  }

  denyPermission(pluginId: string, permission: PluginPermission): void {
    if (!this.deniedPermissions.has(pluginId)) {
      this.deniedPermissions.set(pluginId, []);
    }
    
    const denied = this.deniedPermissions.get(pluginId)!;
    denied.push(permission);
  }

  getPluginPermissions(pluginId: string): PluginPermission[] {
    return this.allowedPermissions.get(pluginId) || [];
  }

  getDeniedPermissions(pluginId: string): PluginPermission[] {
    return this.deniedPermissions.get(pluginId) || [];
  }

  async requestPermission(pluginId: string, permission: PluginPermission): Promise<boolean> {
    if (this.isPermissionDenied(permission)) {
      return false;
    }

    if (await this.shouldAutoGrant(permission)) {
      this.grantPermission(pluginId, permission);
      return true;
    }

    return this.promptUserForPermission(pluginId, permission);
  }

  private isValidPermission(permission: PluginPermission): boolean {
    const validTypes = ['network', 'storage', 'filesystem', 'stellar', 'ui', 'events'];
    
    if (!validTypes.includes(permission.type)) {
      return false;
    }

    if (!Array.isArray(permission.scope) || permission.scope.length === 0) {
      return false;
    }

    if (typeof permission.description !== 'string' || permission.description.trim() === '') {
      return false;
    }

    for (const scope of permission.scope) {
      if (typeof scope !== 'string' || scope.trim() === '') {
        return false;
      }
    }

    return true;
  }

  private isPermissionDenied(permission: PluginPermission): boolean {
    const allDenied = Array.from(this.deniedPermissions.values()).flat();
    
    return allDenied.some(denied => 
      denied.type === permission.type && 
      (denied.scope.includes('*') || 
       denied.scope.some(s => permission.scope.includes(s)))
    );
  }

  private async shouldAutoGrant(permission: PluginPermission): Promise<boolean> {
    const safePermissions = [
      { type: 'ui', scope: ['notifications'] },
      { type: 'storage', scope: ['read', 'write'] },
      { type: 'events', scope: ['listen', 'emit'] }
    ];

    return safePermissions.some(safe => 
      safe.type === permission.type && 
      safe.scope.every(s => permission.scope.includes(s))
    );
  }

  private promptUserForPermission(pluginId: string, permission: PluginPermission): Promise<boolean> {
    return new Promise((resolve) => {
      const message = `Plugin ${pluginId} is requesting permission to ${permission.description} (${permission.type}: ${permission.scope.join(', ')}). Allow?`;
      
      const confirmed = window.confirm(message);
      resolve(confirmed);
    });
  }

  private initializeDefaultPermissions(): void {
    const defaultAllowed = [
      {
        type: 'ui' as const,
        scope: ['notifications'],
        description: 'Show notifications to users'
      },
      {
        type: 'storage' as const,
        scope: ['read', 'write'],
        description: 'Access plugin-specific storage'
      },
      {
        type: 'events' as const,
        scope: ['listen', 'emit'],
        description: 'Listen to and emit events'
      }
    ];

    this.allowedPermissions.set('system', defaultAllowed);
  }

  validatePermissionLevel(requestedLevel: string): boolean {
    return this.permissionLevels.includes(requestedLevel as any);
  }

  getPermissionHierarchy(): string[] {
    return [...this.permissionLevels];
  }

  canUpgradePermission(currentLevel: string, requestedLevel: string): boolean {
    const currentIndex = this.permissionLevels.indexOf(currentLevel as any);
    const requestedIndex = this.permissionLevels.indexOf(requestedLevel as any);
    
    return requestedIndex > currentIndex;
  }

  exportPermissions(): Record<string, PluginPermission[]> {
    const exported: Record<string, PluginPermission[]> = {};
    
    for (const [pluginId, permissions] of this.allowedPermissions.entries()) {
      exported[pluginId] = [...permissions];
    }
    
    return exported;
  }

  importPermissions(permissionsData: Record<string, PluginPermission[]>): void {
    this.allowedPermissions.clear();
    
    for (const [pluginId, permissions] of Object.entries(permissionsData)) {
      this.allowedPermissions.set(pluginId, permissions);
    }
  }

  resetPermissions(): void {
    this.allowedPermissions.clear();
    this.deniedPermissions.clear();
    this.initializeDefaultPermissions();
  }
}
