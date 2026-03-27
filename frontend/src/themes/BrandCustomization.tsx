import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useThemeManager } from './ThemeManager';
import { BrandSettings } from '../types/theme';
import { Upload, X, Save, Palette, Type, Image, Code, Eye, Download } from 'lucide-react';
import ColorPicker from '../components/Theme/ColorPicker';

interface BrandCustomizationProps {
  onClose?: () => void;
  onSave?: (settings: BrandSettings) => void;
}

const defaultBrandSettings: BrandSettings = {
  logo: '',
  brandName: 'Verinode',
  brandColors: {},
  favicon: '',
  customCSS: '',
};

export default function BrandCustomization({ onClose, onSave }: BrandCustomizationProps) {
  const { state, updateTheme } = useThemeManager();
  const [settings, setSettings] = useState<BrandSettings>({
    ...defaultBrandSettings,
    ...state.brandSettings,
  });
  const [activeTab, setActiveTab] = useState<'general' | 'colors' | 'logo' | 'advanced'>('general');
  const [previewMode, setPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSettings({
          ...settings,
          logo: e.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaviconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSettings({
          ...settings,
          favicon: e.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBrandColorChange = (colorKey: string, value: string) => {
    setSettings({
      ...settings,
      brandColors: {
        ...settings.brandColors,
        [colorKey]: value,
      },
    });
  };

  const handleSave = () => {
    updateTheme(settings.brandSettings);
    if (onSave) {
      onSave(settings);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `brand-settings-${settings.brandName.toLowerCase().replace(/\s+/g, '-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const applyCustomCSS = () => {
    if (settings.customCSS) {
      const existingStyle = document.getElementById('brand-custom-css');
      if (existingStyle) {
        existingStyle.remove();
      }
      
      const style = document.createElement('style');
      style.id = 'brand-custom-css';
      style.textContent = settings.customCSS;
      document.head.appendChild(style);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Type },
    { id: 'colors', label: 'Brand Colors', icon: Palette },
    { id: 'logo', label: 'Logo & Assets', icon: Image },
    { id: 'advanced', label: 'Advanced', icon: Code },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Brand Customization</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  previewMode ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-1" />
                {previewMode ? 'Exit' : 'Enter'} Preview
              </button>
              <button
                onClick={handleExport}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          <div className="w-64 border-r border-gray-200 bg-gray-50">
            <nav className="space-y-1 p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex-1 flex">
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'general' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900">General Brand Settings</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Brand Name
                      </label>
                      <input
                        type="text"
                        value={settings.brandName}
                        onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter brand name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Brand Tagline
                      </label>
                      <input
                        type="text"
                        value={settings.tagline || ''}
                        onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter brand tagline"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Brand Description
                      </label>
                      <textarea
                        value={settings.description || ''}
                        onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="Enter brand description"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Email
                      </label>
                      <input
                        type="email"
                        value={settings.contactEmail || ''}
                        onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="contact@company.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Website URL
                      </label>
                      <input
                        type="url"
                        value={settings.website || ''}
                        onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://company.com"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'colors' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900">Brand Colors</h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'primary', label: 'Primary Brand Color' },
                        { key: 'secondary', label: 'Secondary Brand Color' },
                        { key: 'accent', label: 'Accent Color' },
                        { key: 'background', label: 'Background Color' },
                        { key: 'surface', label: 'Surface Color' },
                        { key: 'text', label: 'Text Color' },
                      ].map(({ key, label }) => (
                        <div key={key} className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            {label}
                          </label>
                          <div className="flex items-center gap-2">
                            <ColorPicker
                              value={settings.brandColors[key] || ''}
                              onChange={(value) => handleBrandColorChange(key, value)}
                            />
                            <input
                              type="text"
                              value={settings.brandColors[key] || ''}
                              onChange={(e) => handleBrandColorChange(key, e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="#000000"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6">
                      <h4 className="text-md font-medium text-gray-900 mb-3">Color Palette Preview</h4>
                      <div className="grid grid-cols-6 gap-2">
                        {Object.entries(settings.brandColors).map(([key, color]) => (
                          <div key={key} className="text-center">
                            <div
                              className="w-full h-16 rounded-md border border-gray-200 mb-1"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs text-gray-600">{key}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'logo' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900">Logo & Assets</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company Logo
                      </label>
                      <div className="space-y-4">
                        {settings.logo && (
                          <div className="relative inline-block">
                            <img
                              src={settings.logo}
                              alt="Company Logo"
                              className="h-24 max-w-xs object-contain border border-gray-200 rounded-md p-2"
                            />
                            <button
                              onClick={() => setSettings({ ...settings, logo: '' })}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            Upload Logo
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Favicon
                      </label>
                      <div className="space-y-4">
                        {settings.favicon && (
                          <div className="relative inline-block">
                            <img
                              src={settings.favicon}
                              alt="Favicon"
                              className="h-12 w-12 border border-gray-200 rounded-md p-1"
                            />
                            <button
                              onClick={() => setSettings({ ...settings, favicon: '' })}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        
                        <div>
                          <input
                            ref={faviconInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFaviconUpload}
                            className="hidden"
                          />
                          <button
                            onClick={() => faviconInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            Upload Favicon
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'advanced' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900">Advanced Settings</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Custom CSS
                      </label>
                      <textarea
                        value={settings.customCSS || ''}
                        onChange={(e) => setSettings({ ...settings, customCSS: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        rows={10}
                        placeholder="/* Enter custom CSS here */"
                      />
                      <div className="mt-2">
                        <button
                          onClick={applyCustomCSS}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
                        >
                          Apply CSS
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Meta Tags (JSON)
                      </label>
                      <textarea
                        value={settings.metaTags ? JSON.stringify(settings.metaTags, null, 2) : ''}
                        onChange={(e) => {
                          try {
                            const metaTags = JSON.parse(e.target.value);
                            setSettings({ ...settings, metaTags });
                          } catch (error) {
                            // Invalid JSON, keep current state
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        rows={6}
                        placeholder='{"description": "Brand description", "keywords": "brand,company"}'
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {previewMode && (
              <div className="w-80 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Brand Preview</h3>
                
                <div className="space-y-4">
                  {settings.logo && (
                    <div className="text-center">
                      <img
                        src={settings.logo}
                        alt={settings.brandName}
                        className="h-16 mx-auto mb-2"
                      />
                      <h4 className="text-xl font-bold">{settings.brandName}</h4>
                      {settings.tagline && (
                        <p className="text-sm text-gray-600">{settings.tagline}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-900">Brand Colors:</h5>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(settings.brandColors).map(([key, color]) => (
                        <div key={key} className="text-center">
                          <div
                            className="w-full h-12 rounded border border-gray-200 mb-1"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs text-gray-600">{key}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {settings.description && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Description:</h5>
                      <p className="text-sm text-gray-600">{settings.description}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-900">Contact Info:</h5>
                    {settings.contactEmail && (
                      <p className="text-sm text-gray-600">📧 {settings.contactEmail}</p>
                    )}
                    {settings.website && (
                      <p className="text-sm text-gray-600">🌐 {settings.website}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Brand customization for {settings.brandName}
            </div>
            <div className="flex items-center gap-2">
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Brand Settings
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
