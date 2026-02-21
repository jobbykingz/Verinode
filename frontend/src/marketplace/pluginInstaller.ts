import { PluginMetadata, PluginError } from '../plugins/pluginAPI';
import { PluginStore, PluginListing } from './pluginStore';
import { PluginManager } from '../plugins/pluginManager';

export interface InstallationProgress {
  pluginId: string;
  status: 'downloading' | 'extracting' | 'validating' | 'installing' | 'completed' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface InstallationOptions {
  version?: string;
  autoUpdate?: boolean;
  allowBeta?: boolean;
  skipValidation?: boolean;
}

export class PluginInstaller {
  private pluginManager: PluginManager;
  private pluginStore: PluginStore;
  private installations = new Map<string, InstallationProgress>();
  private eventListeners = new Map<string, Set<(progress: InstallationProgress) => void>>();

  constructor(pluginManager: PluginManager, pluginStore: PluginStore) {
    this.pluginManager = pluginManager;
    this.pluginStore = pluginStore;
  }

  async installPlugin(
    pluginId: string, 
    options: InstallationOptions = {}
  ): Promise<void> {
    const progressId = `${pluginId}-${Date.now()}`;
    
    try {
      this.updateProgress(progressId, {
        pluginId,
        status: 'downloading',
        progress: 0,
        message: 'Starting installation...'
      });

      const pluginData = await this.downloadPlugin(pluginId, options);
      
      this.updateProgress(progressId, {
        pluginId,
        status: 'extracting',
        progress: 25,
        message: 'Extracting plugin package...'
      });

      const extractedPlugin = await this.extractPlugin(pluginData);
      
      this.updateProgress(progressId, {
        pluginId,
        status: 'validating',
        progress: 50,
        message: 'Validating plugin...'
      });

      if (!options.skipValidation) {
        await this.validatePlugin(extractedPlugin);
      }
      
      this.updateProgress(progressId, {
        pluginId,
        status: 'installing',
        progress: 75,
        message: 'Installing plugin...'
      });

      await this.pluginManager.installPlugin(extractedPlugin);
      
      this.updateProgress(progressId, {
        pluginId,
        status: 'completed',
        progress: 100,
        message: 'Plugin installed successfully!'
      });

    } catch (error) {
      this.updateProgress(progressId, {
        pluginId,
        status: 'error',
        progress: 0,
        message: 'Installation failed',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const progressId = `${pluginId}-${Date.now()}`;
    
    try {
      this.updateProgress(progressId, {
        pluginId,
        status: 'installing',
        progress: 50,
        message: 'Uninstalling plugin...'
      });

      await this.pluginManager.uninstallPlugin(pluginId);
      
      this.updateProgress(progressId, {
        pluginId,
        status: 'completed',
        progress: 100,
        message: 'Plugin uninstalled successfully!'
      });

    } catch (error) {
      this.updateProgress(progressId, {
        pluginId,
        status: 'error',
        progress: 0,
        message: 'Uninstallation failed',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async updatePlugin(pluginId: string, options: InstallationOptions = {}): Promise<void> {
    const progressId = `${pluginId}-update-${Date.now()}`;
    
    try {
      this.updateProgress(progressId, {
        pluginId,
        status: 'downloading',
        progress: 0,
        message: 'Checking for updates...'
      });

      const currentPlugin = this.pluginManager.getPlugin(pluginId);
      if (!currentPlugin) {
        throw new PluginError(`Plugin ${pluginId} is not installed`, 'NOT_INSTALLED');
      }

      const pluginListing = await this.pluginStore.getPluginDetails(pluginId);
      const latestVersion = pluginListing.metadata.version;
      
      this.updateProgress(progressId, {
        pluginId,
        status: 'downloading',
        progress: 25,
        message: `Downloading version ${latestVersion}...`
      });

      const pluginData = await this.downloadPlugin(pluginId, { ...options, version: latestVersion });
      
      this.updateProgress(progressId, {
        pluginId,
        status: 'extracting',
        progress: 50,
        message: 'Extracting updated plugin...'
      });

      const extractedPlugin = await this.extractPlugin(pluginData);
      
      this.updateProgress(progressId, {
        pluginId,
        status: 'validating',
        progress: 75,
        message: 'Validating updated plugin...'
      });

      if (!options.skipValidation) {
        await this.validatePlugin(extractedPlugin);
      }
      
      this.updateProgress(progressId, {
        pluginId,
        status: 'installing',
        progress: 90,
        message: 'Installing updated plugin...'
      });

      await this.pluginManager.updatePlugin(pluginId, extractedPlugin);
      
      this.updateProgress(progressId, {
        pluginId,
        status: 'completed',
        progress: 100,
        message: 'Plugin updated successfully!'
      });

    } catch (error) {
      this.updateProgress(progressId, {
        pluginId,
        status: 'error',
        progress: 0,
        message: 'Update failed',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async batchInstall(pluginIds: string[], options: InstallationOptions = {}): Promise<void> {
    const results = await Promise.allSettled(
      pluginIds.map(id => this.installPlugin(id, options))
    );

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      throw new PluginError(
        `Failed to install ${failed.length} plugins`,
        'BATCH_INSTALL_FAILED'
      );
    }
  }

  async batchUninstall(pluginIds: string[]): Promise<void> {
    const results = await Promise.allSettled(
      pluginIds.map(id => this.uninstallPlugin(id))
    );

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      throw new PluginError(
        `Failed to uninstall ${failed.length} plugins`,
        'BATCH_UNINSTALL_FAILED'
      );
    }
  }

  getInstallationProgress(pluginId: string): InstallationProgress | undefined {
    for (const [key, progress] of this.installations.entries()) {
      if (progress.pluginId === pluginId) {
        return progress;
      }
    }
    return undefined;
  }

  getAllInstallations(): InstallationProgress[] {
    return Array.from(this.installations.values());
  }

  onProgressUpdate(pluginId: string, listener: (progress: InstallationProgress) => void): () => void {
    if (!this.eventListeners.has(pluginId)) {
      this.eventListeners.set(pluginId, new Set());
    }
    
    const listeners = this.eventListeners.get(pluginId)!;
    listeners.add(listener);
    
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(pluginId);
      }
    };
  }

  private async downloadPlugin(pluginId: string, options: InstallationOptions): Promise<Blob> {
    return this.pluginStore.getPluginDownload(pluginId, options.version);
  }

  private async extractPlugin(pluginData: Blob): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          if (this.isZipFile(uint8Array)) {
            const extracted = await this.extractZipFile(uint8Array);
            resolve(extracted);
          } else {
            const json = JSON.parse(new TextDecoder().decode(uint8Array));
            resolve(json);
          }
        } catch (error) {
          reject(new PluginError(
            `Failed to extract plugin: ${error instanceof Error ? error.message : String(error)}`,
            'EXTRACTION_FAILED'
          ));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read plugin data'));
      reader.readAsArrayBuffer(pluginData);
    });
  }

  private async validatePlugin(pluginData: any): Promise<void> {
    if (!pluginData.metadata) {
      throw new PluginError('Plugin metadata is missing', 'INVALID_METADATA');
    }

    const metadata = pluginData.metadata;
    
    if (!metadata.id || !metadata.name || !metadata.version) {
      throw new PluginError('Required metadata fields are missing', 'INVALID_METADATA');
    }

    if (!metadata.permissions || !Array.isArray(metadata.permissions)) {
      throw new PluginError('Plugin permissions are missing or invalid', 'INVALID_PERMISSIONS');
    }

    if (!pluginData.code && !metadata.entryPoint) {
      throw new PluginError('Plugin code or entry point is missing', 'INVALID_CODE');
    }
  }

  private isZipFile(data: Uint8Array): boolean {
    return data.length >= 4 && 
           data[0] === 0x50 && data[1] === 0x4B && 
           (data[2] === 0x03 || data[2] === 0x05 || data[2] === 0x07) &&
           (data[3] === 0x04 || data[3] === 0x06 || data[3] === 0x08);
  }

  private async extractZipFile(data: Uint8Array): Promise<any> {
    throw new PluginError('ZIP extraction not implemented yet', 'NOT_IMPLEMENTED');
  }

  private updateProgress(id: string, progress: InstallationProgress): void {
    this.installations.set(id, progress);
    
    const listeners = this.eventListeners.get(progress.pluginId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(progress);
        } catch (error) {
          console.error('Progress listener error:', error);
        }
      });
    }

    if (progress.status === 'completed' || progress.status === 'error') {
      setTimeout(() => {
        this.installations.delete(id);
      }, 5000);
    }
  }

  clearCompletedInstallations(): void {
    for (const [id, progress] of this.installations.entries()) {
      if (progress.status === 'completed') {
        this.installations.delete(id);
      }
    }
  }

  getInstallationHistory(): InstallationProgress[] {
    return Array.from(this.installations.values())
      .sort((a, b) => b.pluginId.localeCompare(a.pluginId));
  }
}
