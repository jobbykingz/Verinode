import React, { useState, useEffect } from 'react';
import { Settings, Shield, Key, Globe, Database, Bell, RefreshCw, Save, Trash2, Download, Upload } from 'lucide-react';
import { PluginManager } from '../../plugins/pluginManager';
import { PermissionsModel } from '../../plugins/permissionsModel';
import { PluginMetadata, PluginPermission } from '../../plugins/pluginAPI';
import toast from 'react-hot-toast';

const PluginSettings: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginMetadata[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, PluginPermission[]>>({});
  const [globalSettings, setGlobalSettings] = useState({
    autoUpdate: false,
    allowBeta: false,
    requireApproval: true,
    enableSandbox: true,
    logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error'
  });
  const [loading, setLoading] = useState(true);

  const [pluginManager] = useState(() => new PluginManager());
  const [permissionsModel] = useState(() => new PermissionsModel());

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const installedPlugins = pluginManager.getInstalledPlugins();
      setPlugins(installedPlugins);
      
      const pluginPermissions: Record<string, PluginPermission[]> = {};
      for (const plugin of installedPlugins) {
        pluginPermissions[plugin.id] = permissionsModel.getPluginPermissions(plugin.id);
      }
      setPermissions(pluginPermissions);
    } catch (error) {
      toast.error('Failed to load plugin settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (pluginId: string, permissionType: string, scope: string[], granted: boolean) => {
    if (granted) {
      const permission: PluginPermission = {
        type: permissionType as any,
        scope,
        description: `Access to ${permissionType} for ${scope.join(', ')}`
      };
      permissionsModel.grantPermission(pluginId, permission);
    } else {
      permissionsModel.revokePermission(pluginId, permissionType, scope);
    }
    
    setPermissions({
      ...permissions,
      [pluginId]: permissionsModel.getPluginPermissions(pluginId)
    });
  };

  const handleGlobalSettingChange = (key: string, value: any) => {
    setGlobalSettings({
      ...globalSettings,
      [key]: value
    });
  };

  const handleSaveSettings = () => {
    localStorage.setItem('plugin-settings', JSON.stringify(globalSettings));
    toast.success('Settings saved successfully');
  };

  const handleResetPermissions = (pluginId: string) => {
    permissionsModel.revokePermission(pluginId, 'stellar', ['*']);
    permissionsModel.revokePermission(pluginId, 'network', ['*']);
    permissionsModel.revokePermission(pluginId, 'ui', ['*']);
    permissionsModel.revokePermission(pluginId, 'storage', ['*']);
    
    setPermissions({
      ...permissions,
      [pluginId]: permissionsModel.getPluginPermissions(pluginId)
    });
    
    toast.success('Permissions reset for plugin');
  };

  const handleExportSettings = () => {
    const settings = {
      global: globalSettings,
      permissions: permissionsModel.exportPermissions()
    };
    
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plugin-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Settings exported');
  };

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target?.result as string);
        
        if (settings.global) {
          setGlobalSettings(settings.global);
        }
        
        if (settings.permissions) {
          permissionsModel.importPermissions(settings.permissions);
          loadSettings();
        }
        
        toast.success('Settings imported successfully');
      } catch (error) {
        toast.error('Failed to import settings');
      }
    };
    reader.readAsText(file);
  };

  const getPermissionIcon = (type: string) => {
    switch (type) {
      case 'stellar': return <Key className="w-4 h-4" />;
      case 'network': return <Globe className="w-4 h-4" />;
      case 'ui': return <Bell className="w-4 h-4" />;
      case 'storage': return <Database className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
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
          <h1 className="text-2xl font-bold text-gray-900">Plugin Settings</h1>
          <p className="text-gray-600 mt-1">Manage plugin permissions and global settings</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportSettings}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <label className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportSettings}
              className="hidden"
            />
          </label>
          <button
            onClick={handleSaveSettings}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Global Settings</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Auto-update plugins</label>
              <p className="text-sm text-gray-600">Automatically update plugins when new versions are available</p>
            </div>
            <input
              type="checkbox"
              checked={globalSettings.autoUpdate}
              onChange={(e) => handleGlobalSettingChange('autoUpdate', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Allow beta versions</label>
              <p className="text-sm text-gray-600">Include beta versions in plugin updates</p>
            </div>
            <input
              type="checkbox"
              checked={globalSettings.allowBeta}
              onChange={(e) => handleGlobalSettingChange('allowBeta', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Require approval</label>
              <p className="text-sm text-gray-600">Ask for user approval before installing plugins</p>
            </div>
            <input
              type="checkbox"
              checked={globalSettings.requireApproval}
              onChange={(e) => handleGlobalSettingChange('requireApproval', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Enable sandbox</label>
              <p className="text-sm text-gray-600">Run plugins in isolated environment for security</p>
            </div>
            <input
              type="checkbox"
              checked={globalSettings.enableSandbox}
              onChange={(e) => handleGlobalSettingChange('enableSandbox', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-medium text-gray-900">Log Level</label>
            <p className="text-sm text-gray-600 mb-2">Set the verbosity of plugin logs</p>
            <select
              value={globalSettings.logLevel}
              onChange={(e) => handleGlobalSettingChange('logLevel', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Plugin Permissions</h2>
        
        {plugins.length === 0 ? (
          <p className="text-gray-600">No plugins installed</p>
        ) : (
          <div className="space-y-4">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{plugin.name}</h3>
                    <p className="text-sm text-gray-600">{plugin.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedPlugin(selectedPlugin === plugin.id ? null : plugin.id)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    {selectedPlugin === plugin.id ? 'Hide' : 'Show'} Permissions
                  </button>
                </div>

                {selectedPlugin === plugin.id && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Current Permissions</h4>
                      <button
                        onClick={() => handleResetPermissions(plugin.id)}
                        className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Reset All</span>
                      </button>
                    </div>

                    {['stellar', 'network', 'ui', 'storage'].map((permissionType) => (
                      <div key={permissionType} className="border border-gray-100 rounded p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          {getPermissionIcon(permissionType)}
                          <span className="font-medium capitalize">{permissionType}</span>
                        </div>
                        
                        <div className="space-y-2">
                          {['read', 'write', 'execute'].map((scope) => {
                            const hasPermission = permissions[plugin.id]?.some(
                              p => p.type === permissionType && p.scope.includes(scope)
                            );
                            
                            return (
                              <div key={scope} className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 capitalize">{scope}</span>
                                <input
                                  type="checkbox"
                                  checked={hasPermission}
                                  onChange={(e) => handlePermissionChange(plugin.id, permissionType, [scope], e.target.checked)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PluginSettings;
