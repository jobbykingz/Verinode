import React, { useState, useEffect } from 'react';
import { Package, Settings, Trash2, Download, RefreshCw, Shield, Users, Star } from 'lucide-react';
import { PluginManager } from '../../plugins/pluginManager';
import { PluginInstaller } from '../../marketplace/pluginInstaller';
import { PluginMetadata } from '../../plugins/pluginAPI';
import toast from 'react-hot-toast';

interface InstalledPlugin extends PluginMetadata {
  isActive: boolean;
  canUpdate: boolean;
  updateAvailable?: boolean;
}

const PluginManager: React.FC = () => {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [pluginManager] = useState(() => new PluginManager());
  const [pluginInstaller] = useState(() => new PluginInstaller(pluginManager, null as any));

  useEffect(() => {
    loadInstalledPlugins();
  }, []);

  const loadInstalledPlugins = async () => {
    try {
      setLoading(true);
      const installedPlugins = pluginManager.getInstalledPlugins();
      const pluginsWithStatus = installedPlugins.map(plugin => ({
        ...plugin,
        isActive: true,
        canUpdate: true,
        updateAvailable: false
      }));
      setPlugins(pluginsWithStatus);
    } catch (error) {
      toast.error('Failed to load installed plugins');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlugin = async (pluginId: string) => {
    try {
      const plugin = pluginManager.getPlugin(pluginId);
      if (plugin) {
        await pluginManager.deactivatePlugin(pluginId);
        toast.success('Plugin deactivated');
      } else {
        await pluginManager.activatePlugin(pluginId);
        toast.success('Plugin activated');
      }
      loadInstalledPlugins();
    } catch (error) {
      toast.error('Failed to toggle plugin');
    }
  };

  const handleUninstallPlugin = async (pluginId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) {
      return;
    }

    try {
      await pluginInstaller.uninstallPlugin(pluginId);
      toast.success('Plugin uninstalled successfully');
      loadInstalledPlugins();
    } catch (error) {
      toast.error('Failed to uninstall plugin');
    }
  };

  const handleUpdatePlugin = async (pluginId: string) => {
    try {
      await pluginInstaller.updatePlugin(pluginId);
      toast.success('Plugin updated successfully');
      loadInstalledPlugins();
    } catch (error) {
      toast.error('Failed to update plugin');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getPermissionIcon = (type: string) => {
    switch (type) {
      case 'stellar': return <Shield className="w-4 h-4" />;
      case 'network': return <Download className="w-4 h-4" />;
      case 'ui': return <Settings className="w-4 h-4" />;
      case 'storage': return <Package className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plugin Manager</h1>
          <p className="text-gray-600 mt-1">Manage your installed plugins</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadInstalledPlugins}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {plugins.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No plugins installed</h3>
          <p className="text-gray-600 mb-4">Install plugins from the marketplace to extend Verinode functionality</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Browse Marketplace
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className={`bg-white rounded-lg border border-gray-200 p-6 transition-all cursor-pointer ${
                selectedPlugin === plugin.id ? 'border-blue-500 shadow-md' : 'hover:border-gray-300'
              }`}
              onClick={() => setSelectedPlugin(selectedPlugin === plugin.id ? null : plugin.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{plugin.name}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      v{plugin.version}
                    </span>
                    {plugin.updateAvailable && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Update Available
                      </span>
                    )}
                    {plugin.isActive && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-3">{plugin.description}</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{plugin.author}</span>
                    </div>
                    {plugin.dependencies && plugin.dependencies.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Package className="w-4 h-4" />
                        <span>{plugin.dependencies.length} dependencies</span>
                      </div>
                    )}
                  </div>

                  {selectedPlugin === plugin.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Permissions</h4>
                        <div className="flex flex-wrap gap-2">
                          {plugin.permissions.map((permission, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                            >
                              {getPermissionIcon(permission.type)}
                              <span>{permission.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePlugin(plugin.id);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            plugin.isActive
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {plugin.isActive ? 'Deactivate' : 'Activate'}
                        </button>

                        {plugin.updateAvailable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdatePlugin(plugin.id);
                            }}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                          >
                            Update
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUninstallPlugin(plugin.id);
                          }}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PluginManager;
