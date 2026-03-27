import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeManager } from '../../themes/ThemeManager';
import { Theme } from '../../types/theme';
import { Palette, Plus, Edit, Trash2, Download, Upload, Eye, Check } from 'lucide-react';
import CustomTheme from '../../themes/CustomTheme';
import BrandCustomization from '../../themes/BrandCustomization';

interface ThemeSelectorProps {
  className?: string;
  showBrandCustomization?: boolean;
}

export default function ThemeSelector({ className = '', showBrandCustomization = true }: ThemeSelectorProps) {
  const { state, switchTheme, deleteTheme, exportTheme, importTheme } = useThemeManager();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomThemeEditor, setShowCustomThemeEditor] = useState(false);
  const [showBrandEditor, setShowBrandEditor] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const allThemes = { ...state.themes, ...state.customThemes };
  const currentTheme = allThemes[state.currentTheme];

  const handleThemeSelect = (themeId: string) => {
    switchTheme(themeId);
    setIsOpen(false);
  };

  const handleThemePreview = (themeId: string) => {
    setPreviewTheme(themeId);
  };

  const handleThemeDelete = (themeId: string) => {
    if (confirm('Are you sure you want to delete this theme?')) {
      deleteTheme(themeId);
    }
  };

  const handleThemeExport = (themeId: string) => {
    const themeData = exportTheme(themeId);
    if (themeData) {
      const theme = allThemes[themeId];
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(themeData);
      const exportFileDefaultName = `theme-${theme.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  };

  const handleThemeImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const themeData = e.target?.result as string;
        importTheme(themeData);
      };
      reader.readAsText(file);
    }
  };

  const getThemePreview = (theme: Theme) => {
    return (
      <div
        className="w-full h-20 rounded-lg border-2 border-gray-200 overflow-hidden"
        style={{
          backgroundColor: theme.colors.background,
        }}
      >
        <div className="h-8 flex">
          <div
            className="flex-1"
            style={{ backgroundColor: theme.colors.primary }}
          />
          <div
            className="flex-1"
            style={{ backgroundColor: theme.colors.secondary }}
          />
          <div
            className="flex-1"
            style={{ backgroundColor: theme.colors.accent }}
          />
        </div>
        <div className="h-12 p-2">
          <div
            className="h-4 rounded mb-1"
            style={{
              backgroundColor: theme.colors.text,
              width: '80%',
            }}
          />
          <div
            className="h-3 rounded"
            style={{
              backgroundColor: theme.colors.textSecondary,
              width: '60%',
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Palette className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium">{currentTheme?.name || 'Select Theme'}</span>
          <div
            className="w-4 h-4 rounded border border-gray-300"
            style={{ backgroundColor: currentTheme?.colors.primary }}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute z-50 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Themes</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      title="Import theme"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowCustomThemeEditor(true)}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      title="Create custom theme"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {showBrandCustomization && (
                      <button
                        onClick={() => setShowBrandEditor(true)}
                        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="Brand customization"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleThemeImport}
                  className="hidden"
                />
              </div>

              <div className="overflow-y-auto max-h-80">
                <div className="p-2 space-y-2">
                  {Object.entries(allThemes).map(([themeId, theme]) => (
                    <motion.div
                      key={themeId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        state.currentTheme === themeId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => handleThemeSelect(themeId)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900">{theme.name}</h4>
                            {theme.isBuiltIn && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                Built-in
                              </span>
                            )}
                            {theme.isAccessible && (
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                Accessible
                              </span>
                            )}
                          </div>
                          {getThemePreview(theme)}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleThemePreview(themeId);
                            }}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                            title="Preview theme"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          {!theme.isBuiltIn && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleThemeExport(themeId);
                                }}
                                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                title="Export theme"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleThemeDelete(themeId);
                                }}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                title="Delete theme"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showCustomThemeEditor && (
        <CustomTheme
          onClose={() => setShowCustomThemeEditor(false)}
        />
      )}

      {showBrandEditor && (
        <BrandCustomization
          onClose={() => setShowBrandEditor(false)}
        />
      )}

      {previewTheme && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewTheme(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Theme Preview: {allThemes[previewTheme]?.name}
                </h2>
                <button
                  onClick={() => setPreviewTheme(null)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div
                className="space-y-6"
                style={{
                  backgroundColor: allThemes[previewTheme]?.colors.background,
                  color: allThemes[previewTheme]?.colors.text,
                  fontFamily: allThemes[previewTheme]?.typography.fontFamily,
                }}
              >
                <div className="space-y-4">
                  <h1
                    style={{
                      fontSize: allThemes[previewTheme]?.typography.fontSize['3xl'],
                      fontWeight: allThemes[previewTheme]?.typography.fontWeight.bold,
                    }}
                  >
                    Sample Heading
                  </h1>
                  <p
                    style={{
                      fontSize: allThemes[previewTheme]?.typography.fontSize.base,
                      color: allThemes[previewTheme]?.colors.textSecondary,
                    }}
                  >
                    This is a sample paragraph to showcase the theme typography and colors.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <button
                    className="px-4 py-2 rounded-md text-white font-medium"
                    style={{
                      backgroundColor: allThemes[previewTheme]?.colors.primary,
                    }}
                  >
                    Primary Button
                  </button>
                  <button
                    className="px-4 py-2 rounded-md font-medium border"
                    style={{
                      backgroundColor: allThemes[previewTheme]?.colors.surface,
                      borderColor: allThemes[previewTheme]?.colors.border,
                      color: allThemes[previewTheme]?.colors.text,
                    }}
                  >
                    Secondary Button
                  </button>
                  <button
                    className="px-4 py-2 rounded-md text-white font-medium"
                    style={{
                      backgroundColor: allThemes[previewTheme]?.colors.accent,
                    }}
                  >
                    Accent Button
                  </button>
                </div>

                <div
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: allThemes[previewTheme]?.colors.surface,
                    borderColor: allThemes[previewTheme]?.colors.border,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                >
                  <h3
                    style={{
                      fontSize: allThemes[previewTheme]?.typography.fontSize.lg,
                      fontWeight: allThemes[previewTheme]?.typography.fontWeight.semibold,
                      marginBottom: allThemes[previewTheme]?.spacing.sm,
                    }}
                  >
                    Card Component
                  </h3>
                  <p
                    style={{
                      fontSize: allThemes[previewTheme]?.typography.fontSize.sm,
                      color: allThemes[previewTheme]?.colors.textSecondary,
                    }}
                  >
                    This is how a card component would look with this theme.
                  </p>
                </div>

                <div className="flex gap-2">
                  {Object.entries(allThemes[previewTheme]?.colors || {}).map(([key, color]) => (
                    <div key={key} className="text-center">
                      <div
                        className="w-12 h-12 rounded border border-gray-300 mb-1"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs">{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
