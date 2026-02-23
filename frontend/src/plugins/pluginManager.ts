import React from 'react';
import { Plugin, PluginContext, PluginMetadata, PluginAPI, PluginError } from './pluginAPI';
import { SecuritySandbox } from './securitySandbox';
import { PermissionsModel } from './permissionsModel';
import { VersionManager } from './versionManager';

export class PluginManager {
  private plugins = new Map<string, Plugin>();
  private contexts = new Map<string, PluginContext>();
  private sandbox: SecuritySandbox;
  private permissions: PermissionsModel;
  private versionManager: VersionManager;

  constructor() {
    this.sandbox = new SecuritySandbox();
    this.permissions = new PermissionsModel();
    this.versionManager = new VersionManager();
  }

  async installPlugin(pluginData: any): Promise<void> {
    try {
      const metadata = pluginData.metadata;
      
      if (!metadata) {
        throw new PluginError('Plugin metadata is required', 'INVALID_METADATA');
      }

      if (this.plugins.has(metadata.id)) {
        throw new PluginError(`Plugin ${metadata.id} is already installed`, 'ALREADY_INSTALLED');
      }

      if (!await this.permissions.validatePermissions(metadata.permissions)) {
        throw new PluginError('Plugin permissions are not allowed', 'INVALID_PERMISSIONS');
      }

      if (!await this.versionManager.checkCompatibility(metadata)) {
        throw new PluginError('Plugin is not compatible with current Verinode version', 'INCOMPATIBLE_VERSION');
      }

      const plugin = await this.loadPlugin(pluginData);
      const context = await this.createPluginContext(metadata);
      
      await this.sandbox.initializePlugin(metadata.id, pluginData);
      await plugin.initialize(context);
      
      this.plugins.set(metadata.id, plugin);
      this.contexts.set(metadata.id, context);

      if (plugin.activate) {
        await plugin.activate();
      }

    } catch (error) {
      throw new PluginError(
        `Failed to install plugin: ${error instanceof Error ? error.message : String(error)}`,
        'INSTALLATION_FAILED',
        pluginData.metadata?.id
      );
    }
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const context = this.contexts.get(pluginId);

    if (!plugin) {
      throw new PluginError(`Plugin ${pluginId} is not installed`, 'NOT_INSTALLED');
    }

    try {
      if (plugin.deactivate) {
        await plugin.deactivate();
      }

      if (plugin.destroy) {
        await plugin.destroy();
      }

      await this.sandbox.cleanupPlugin(pluginId);
      
      this.plugins.delete(pluginId);
      this.contexts.delete(pluginId);

    } catch (error) {
      throw new PluginError(
        `Failed to uninstall plugin: ${error instanceof Error ? error.message : String(error)}`,
        'UNINSTALLATION_FAILED',
        pluginId
      );
    }
  }

  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    
    if (!plugin) {
      throw new PluginError(`Plugin ${pluginId} is not installed`, 'NOT_INSTALLED');
    }

    if (plugin.activate) {
      await plugin.activate();
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    
    if (!plugin) {
      throw new PluginError(`Plugin ${pluginId} is not installed`, 'NOT_INSTALLED');
    }

    if (plugin.deactivate) {
      await plugin.deactivate();
    }
  }

  getInstalledPlugins(): PluginMetadata[] {
    return Array.from(this.contexts.values()).map(context => context.metadata);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getPluginContext(pluginId: string): PluginContext | undefined {
    return this.contexts.get(pluginId);
  }

  isPluginInstalled(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  async updatePlugin(pluginId: string, newPluginData: any): Promise<void> {
    const currentPlugin = this.plugins.get(pluginId);
    const currentMetadata = this.contexts.get(pluginId)?.metadata;

    if (!currentPlugin || !currentMetadata) {
      throw new PluginError(`Plugin ${pluginId} is not installed`, 'NOT_INSTALLED');
    }

    if (!await this.versionManager.canUpdate(currentMetadata, newPluginData.metadata)) {
      throw new PluginError('Plugin update is not allowed', 'INVALID_UPDATE');
    }

    await this.uninstallPlugin(pluginId);
    await this.installPlugin(newPluginData);
  }

  private async loadPlugin(pluginData: any): Promise<Plugin> {
    try {
      const pluginModule = await this.sandbox.executePlugin(pluginData);
      return pluginModule.default || pluginModule;
    } catch (error) {
      throw new PluginError(
        `Failed to load plugin: ${error instanceof Error ? error.message : String(error)}`,
        'LOAD_FAILED',
        pluginData.metadata?.id
      );
    }
  }

  private async createPluginContext(metadata: PluginMetadata): Promise<PluginContext> {
    const storage = await this.sandbox.createStorage(metadata.id);
    const events = await this.sandbox.createEventEmitter(metadata.id);
    const api = await this.createPluginAPI(metadata);

    return {
      id: metadata.id,
      metadata,
      storage,
      events,
      permissions: metadata.permissions,
      api
    };
  }

  private async createPluginAPI(metadata: PluginMetadata): Promise<PluginAPI> {
    return {
      stellar: {
        connect: async () => {
          await this.permissions.checkPermission(metadata.id, 'stellar', ['connect']);
          return this.sandbox.executeWithPermission(metadata.id, 'stellar', 'connect', []);
        },
        getAccount: async (publicKey: string) => {
          await this.permissions.checkPermission(metadata.id, 'stellar', ['read']);
          return this.sandbox.executeWithPermission(metadata.id, 'stellar', 'getAccount', [publicKey]);
        },
        signTransaction: async (transaction: any) => {
          await this.permissions.checkPermission(metadata.id, 'stellar', ['sign']);
          return this.sandbox.executeWithPermission(metadata.id, 'stellar', 'signTransaction', [transaction]);
        },
        submitTransaction: async (transaction: any) => {
          await this.permissions.checkPermission(metadata.id, 'stellar', ['submit']);
          return this.sandbox.executeWithPermission(metadata.id, 'stellar', 'submitTransaction', [transaction]);
        }
      },
      ui: {
        showNotification: async (message: string, type: 'success' | 'error' | 'info') => {
          await this.permissions.checkPermission(metadata.id, 'ui', ['notifications']);
          this.sandbox.executeWithPermission(metadata.id, 'ui', 'showNotification', [message, type]);
        },
        showModal: async (component: React.ComponentType<any>, props?: any) => {
          await this.permissions.checkPermission(metadata.id, 'ui', ['modals']);
          this.sandbox.executeWithPermission(metadata.id, 'ui', 'showModal', [component, props]);
        },
        addMenuItem: async (item: any) => {
          await this.permissions.checkPermission(metadata.id, 'ui', ['menu']);
          this.sandbox.executeWithPermission(metadata.id, 'ui', 'addMenuItem', [item]);
        },
        removeMenuItem: async (itemId: string) => {
          await this.permissions.checkPermission(metadata.id, 'ui', ['menu']);
          this.sandbox.executeWithPermission(metadata.id, 'ui', 'removeMenuItem', [itemId]);
        }
      },
      network: {
        request: async (url: string, options?: RequestInit) => {
          await this.permissions.checkPermission(metadata.id, 'network', ['request']);
          return this.sandbox.executeWithPermission(metadata.id, 'network', 'request', [url, options]);
        },
        get: async (url: string) => {
          await this.permissions.checkPermission(metadata.id, 'network', ['read']);
          return this.sandbox.executeWithPermission(metadata.id, 'network', 'get', [url]);
        },
        post: async (url: string, data: any) => {
          await this.permissions.checkPermission(metadata.id, 'network', ['write']);
          return this.sandbox.executeWithPermission(metadata.id, 'network', 'post', [url, data]);
        }
      },
      storage: await this.sandbox.createStorage(metadata.id),
      events: await this.sandbox.createEventEmitter(metadata.id)
    };
  }
}
