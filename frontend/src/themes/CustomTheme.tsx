import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeManager } from './ThemeManager';
import { Theme, ThemeValidation, ColorContrast } from '../types/theme';
import { Palette, Type, Square, Plus, Trash2, Download, Upload, Check, X } from 'lucide-react';
import ColorPicker from '../components/Theme/ColorPicker';

interface CustomThemeProps {
  onClose?: () => void;
  initialTheme?: Partial<Theme>;
}

const defaultTheme: Omit<Theme, 'id'> = {
  name: 'Custom Theme',
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    accent: '#8b5cf6',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  borderRadius: {
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

const fontFamilies = [
  'Inter, system-ui, sans-serif',
  'Roboto, system-ui, sans-serif',
  'Arial, sans-serif',
  'Georgia, serif',
  'Courier New, monospace',
  'system-ui, sans-serif',
];

export default function CustomTheme({ onClose, initialTheme }: CustomThemeProps) {
  const { createCustomTheme, updateTheme } = useThemeManager();
  const [activeTab, setActiveTab] = useState<'colors' | 'typography' | 'spacing' | 'borders' | 'shadows'>('colors');
  const [theme, setTheme] = useState<Omit<Theme, 'id'>>({ ...defaultTheme, ...initialTheme });
  const [validation, setValidation] = useState<ThemeValidation | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const validateTheme = (themeData: Omit<Theme, 'id'>): ThemeValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const contrastRatios: Record<string, ColorContrast> = {};

    Object.entries(themeData.colors).forEach(([key, color]) => {
      if (!color.match(/^#[0-9A-Fa-f]{6}$/)) {
        errors.push(`Invalid color format for ${key}: ${color}`);
      }
    });

    const bgLuminance = getLuminance(themeData.colors.background);
    const textLuminance = getLuminance(themeData.colors.text);
    const contrastRatio = (Math.max(bgLuminance, textLuminance) + 0.05) / (Math.min(bgLuminance, textLuminance) + 0.05);
    
    contrastRatios.text = {
      ratio: contrastRatio,
      AA: contrastRatio >= 4.5,
      AAA: contrastRatio >= 7,
      AALarge: contrastRatio >= 3,
      AAALarge: contrastRatio >= 4.5,
    };

    if (contrastRatio < 4.5) {
      warnings.push('Text color may not have sufficient contrast with background');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      contrastRatios,
    };
  };

  const getLuminance = (hex: string): number => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    
    const [lr, lg, lb] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  };

  const handleColorChange = (colorKey: keyof typeof theme.colors, value: string) => {
    const newTheme = {
      ...theme,
      colors: {
        ...theme.colors,
        [colorKey]: value,
      },
    };
    setTheme(newTheme);
    setValidation(validateTheme(newTheme));
  };

  const handleTypographyChange = (key: string, value: string | number) => {
    const newTheme = {
      ...theme,
      typography: {
        ...theme.typography,
        [key]: value,
      },
    };
    setTheme(newTheme);
  };

  const handleSave = () => {
    const validation = validateTheme(theme);
    if (validation.isValid) {
      createCustomTheme(theme);
      if (onClose) onClose();
    } else {
      setValidation(validation);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(theme, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `theme-${theme.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedTheme = JSON.parse(e.target?.result as string);
          setTheme({ ...defaultTheme, ...importedTheme });
        } catch (error) {
          console.error('Failed to import theme:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const tabs = [
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'typography', label: 'Typography', icon: Type },
    { id: 'spacing', label: 'Spacing', icon: Square },
    { id: 'borders', label: 'Borders', icon: Square },
    { id: 'shadows', label: 'Shadows', icon: Square },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Custom Theme Editor</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  showPreview ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>
              <button
                onClick={handleExport}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              <label className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
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
            <div className="p-4">
              <input
                type="text"
                value={theme.name}
                onChange={(e) => setTheme({ ...theme, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Theme name"
              />
            </div>
            <nav className="space-y-1 px-2">
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
              <AnimatePresence mode="wait">
                {activeTab === 'colors' && (
                  <motion.div
                    key="colors"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">Color Palette</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(theme.colors).map(([key, value]) => (
                        <div key={key} className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </label>
                          <div className="flex items-center gap-2">
                            <ColorPicker
                              value={value}
                              onChange={(newColor) => handleColorChange(key as keyof typeof theme.colors, newColor)}
                            />
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => handleColorChange(key as keyof typeof theme.colors, e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'typography' && (
                  <motion.div
                    key="typography"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">Typography</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
                        <select
                          value={theme.typography.fontFamily}
                          onChange={(e) => handleTypographyChange('fontFamily', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {fontFamilies.map((font) => (
                            <option key={font} value={font}>
                              {font}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Font Sizes</label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(theme.typography.fontSize).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              <label className="text-xs text-gray-600 w-12">{key}:</label>
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => handleTypographyChange(`fontSize.${key}`, e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'spacing' && (
                  <motion.div
                    key="spacing"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">Spacing</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(theme.spacing).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 w-12">{key}:</label>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => setTheme({
                              ...theme,
                              spacing: { ...theme.spacing, [key]: e.target.value }
                            })}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'borders' && (
                  <motion.div
                    key="borders"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">Border Radius</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(theme.borderRadius).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 w-12">{key}:</label>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => setTheme({
                              ...theme,
                              borderRadius: { ...theme.borderRadius, [key]: e.target.value }
                            })}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'shadows' && (
                  <motion.div
                    key="shadows"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">Shadows</h3>
                    <div className="space-y-2">
                      {Object.entries(theme.shadows).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 w-12">{key}:</label>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => setTheme({
                              ...theme,
                              shadows: { ...theme.shadows, [key]: e.target.value }
                            })}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="mt-6 space-y-2">
                  {validation.errors.map((error, index) => (
                    <div key={index} className="flex items-center gap-2 text-red-600 text-sm">
                      <X className="w-4 h-4" />
                      {error}
                    </div>
                  ))}
                  {validation.warnings.map((warning, index) => (
                    <div key={index} className="flex items-center gap-2 text-yellow-600 text-sm">
                      <X className="w-4 h-4" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showPreview && (
              <div className="w-80 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
                <div
                  className="space-y-4 p-4 rounded-lg border border-gray-200"
                  style={{
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    fontFamily: theme.typography.fontFamily,
                  }}
                >
                  <div
                    className="p-3 rounded-md"
                    style={{
                      backgroundColor: theme.colors.primary,
                      color: '#ffffff',
                    }}
                  >
                    Primary Button
                  </div>
                  
                  <div
                    className="p-3 rounded-md border"
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    }}
                  >
                    Card Component
                  </div>

                  <div className="space-y-2">
                    <h4 style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                      Typography Sample
                    </h4>
                    <p style={{ fontSize: theme.typography.fontSize.base, color: theme.colors.textSecondary }}>
                      This is a sample text to demonstrate the typography settings.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: theme.colors.success }}
                    />
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: theme.colors.warning }}
                    />
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: theme.colors.error }}
                    />
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: theme.colors.accent }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {validation?.isValid ? (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="w-4 h-4" />
                  Theme is valid and accessible
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600">
                  <X className="w-4 h-4" />
                  Please fix validation errors
                </span>
              )}
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
                disabled={!validation?.isValid}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Theme
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
