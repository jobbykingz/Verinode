import React, { useState } from 'react';
import { useTheme, useThemeColor, useThemeContrast } from '../../hooks/useTheme';
import { ThemeColors } from '../../types/theme';
import CustomTheme from '../../themes/CustomTheme';
import BrandCustomization from '../../themes/BrandCustomization';

export default function ThemeTest() {
  const {
    currentTheme,
    currentThemeId,
    switchTheme,
    createCustomTheme,
    updateTheme,
    deleteTheme,
    exportTheme,
    importTheme,
    getColor,
    isDarkTheme,
    isLightTheme,
    isHighContrastTheme,
    toggleTheme,
  } = useTheme();

  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [showBrandEditor, setShowBrandEditor] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const runTests = () => {
    const results: string[] = [];
    
    // Test 1: Theme switching
    try {
      switchTheme('dark');
      results.push('✅ Theme switching: SUCCESS');
    } catch (error) {
      results.push('❌ Theme switching: FAILED');
    }

    // Test 2: Color retrieval
    try {
      const primaryColor = getColor('primary');
      if (primaryColor && primaryColor.startsWith('#')) {
        results.push('✅ Color retrieval: SUCCESS');
      } else {
        results.push('❌ Color retrieval: FAILED - Invalid color format');
      }
    } catch (error) {
      results.push('❌ Color retrieval: FAILED');
    }

    // Test 3: Theme detection
    try {
      const isDark = isDarkTheme;
      const isLight = isLightTheme;
      const isHighContrast = isHighContrastTheme;
      results.push(`✅ Theme detection: Dark=${isDark}, Light=${isLight}, HighContrast=${isHighContrast}`);
    } catch (error) {
      results.push('❌ Theme detection: FAILED');
    }

    // Test 4: Theme export
    try {
      const exportedTheme = exportTheme(currentThemeId);
      if (exportedTheme && exportedTheme.includes('"id"')) {
        results.push('✅ Theme export: SUCCESS');
      } else {
        results.push('❌ Theme export: FAILED - Invalid export format');
      }
    } catch (error) {
      results.push('❌ Theme export: FAILED');
    }

    // Test 5: Theme import
    try {
      const testTheme = {
        name: 'Test Theme',
        colors: {
          primary: '#ff0000',
          secondary: '#00ff00',
          background: '#0000ff',
          surface: '#ffffff',
          text: '#000000',
          textSecondary: '#666666',
          border: '#cccccc',
          success: '#00ff00',
          warning: '#ffff00',
          error: '#ff0000',
          accent: '#ff00ff',
        },
        typography: {
          fontFamily: 'Arial, sans-serif',
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
      
      const exportedTestTheme = JSON.stringify(testTheme);
      importTheme(exportedTestTheme);
      results.push('✅ Theme import: SUCCESS');
    } catch (error) {
      results.push('❌ Theme import: FAILED');
    }

    // Test 6: CSS Variables
    try {
      const rootElement = document.documentElement;
      const primaryVar = rootElement.style.getPropertyValue('--color-primary');
      if (primaryVar) {
        results.push('✅ CSS Variables: SUCCESS');
      } else {
        results.push('❌ CSS Variables: FAILED - Variables not applied');
      }
    } catch (error) {
      results.push('❌ CSS Variables: FAILED');
    }

    setTestResults(results);
  };

  return (
    <div className="p-6 space-y-6" style={{ backgroundColor: getColor('background'), color: getColor('text') }}>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Theme System Test Suite</h1>
        <p className="text-lg opacity-80">Current Theme: {currentTheme.name}</p>
        <p className="text-sm opacity-60">Theme ID: {currentThemeId}</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Theme Controls</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => switchTheme('light')}
            className="px-4 py-2 rounded-md font-medium transition-colors"
            style={{
              backgroundColor: currentThemeId === 'light' ? getColor('primary') : getColor('surface'),
              color: currentThemeId === 'light' ? 'white' : getColor('text'),
              border: `1px solid ${getColor('border')}`,
            }}
          >
            Light Theme
          </button>
          <button
            onClick={() => switchTheme('dark')}
            className="px-4 py-2 rounded-md font-medium transition-colors"
            style={{
              backgroundColor: currentThemeId === 'dark' ? getColor('primary') : getColor('surface'),
              color: currentThemeId === 'dark' ? 'white' : getColor('text'),
              border: `1px solid ${getColor('border')}`,
            }}
          >
            Dark Theme
          </button>
          <button
            onClick={() => switchTheme('highContrast')}
            className="px-4 py-2 rounded-md font-medium transition-colors"
            style={{
              backgroundColor: currentThemeId === 'highContrast' ? getColor('primary') : getColor('surface'),
              color: currentThemeId === 'highContrast' ? 'white' : getColor('text'),
              border: `1px solid ${getColor('border')}`,
            }}
          >
            High Contrast
          </button>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-md font-medium transition-colors"
            style={{
              backgroundColor: getColor('accent'),
              color: 'white',
            }}
          >
            Toggle Theme
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Color Palette Test</h2>
        <div className="grid grid-cols-5 gap-4">
          {(Object.keys(getColor('') ? {} : currentTheme.colors) as Array<keyof ThemeColors>).map((colorKey) => (
            <div key={colorKey} className="text-center p-4 rounded-lg border" style={{ borderColor: getColor('border') }}>
              <div
                className="w-16 h-16 rounded-full mx-auto mb-2 border-2"
                style={{ 
                  backgroundColor: getColor(colorKey),
                  borderColor: getColor('border')
                }}
              />
              <p className="font-medium text-sm">{colorKey}</p>
              <p className="text-xs opacity-60 font-mono">{getColor(colorKey)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Component Examples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: getColor('surface'),
              borderColor: getColor('border'),
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            <h3 className="font-semibold mb-2">Card Component</h3>
            <p className="text-sm opacity-80">This is a sample card with theme colors.</p>
          </div>

          <div className="space-y-2">
            <button
              className="w-full px-4 py-2 rounded-md font-medium"
              style={{
                backgroundColor: getColor('primary'),
                color: 'white',
              }}
            >
              Primary Button
            </button>
            <button
              className="w-full px-4 py-2 rounded-md font-medium"
              style={{
                backgroundColor: getColor('surface'),
                color: getColor('text'),
                borderColor: getColor('border'),
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              Secondary Button
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getColor('success') }} />
              <span className="text-sm">Success State</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getColor('warning') }} />
              <span className="text-sm">Warning State</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getColor('error') }} />
              <span className="text-sm">Error State</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Theme System Tests</h2>
        <div className="flex gap-2">
          <button
            onClick={runTests}
            className="px-4 py-2 rounded-md font-medium"
            style={{
              backgroundColor: getColor('primary'),
              color: 'white',
            }}
          >
            Run Tests
          </button>
          <button
            onClick={() => setShowCustomEditor(true)}
            className="px-4 py-2 rounded-md font-medium"
            style={{
              backgroundColor: getColor('accent'),
              color: 'white',
            }}
          >
            Create Custom Theme
          </button>
          <button
            onClick={() => setShowBrandEditor(true)}
            className="px-4 py-2 rounded-md font-medium"
            style={{
              backgroundColor: getColor('secondary'),
              color: 'white',
            }}
          >
            Brand Settings
          </button>
        </div>

        {testResults.length > 0 && (
          <div className="p-4 rounded-lg border" style={{ borderColor: getColor('border') }}>
            <h3 className="font-semibold mb-2">Test Results:</h3>
            <ul className="space-y-1">
              {testResults.map((result, index) => (
                <li key={index} className="text-sm font-mono">{result}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Theme Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border" style={{ borderColor: getColor('border') }}>
            <h3 className="font-semibold mb-2">Current Theme Properties</h3>
            <ul className="space-y-1 text-sm">
              <li>Name: {currentTheme.name}</li>
              <li>ID: {currentTheme.id}</li>
              <li>Built-in: {currentTheme.isBuiltIn ? 'Yes' : 'No'}</li>
              <li>Accessible: {currentTheme.isAccessible ? 'Yes' : 'No'}</li>
              <li>Font Family: {currentTheme.typography.fontFamily}</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg border" style={{ borderColor: getColor('border') }}>
            <h3 className="font-semibold mb-2">Theme Detection</h3>
            <ul className="space-y-1 text-sm">
              <li>Dark Theme: {isDarkTheme ? 'Yes' : 'No'}</li>
              <li>Light Theme: {isLightTheme ? 'Yes' : 'No'}</li>
              <li>High Contrast: {isHighContrastTheme ? 'Yes' : 'No'}</li>
            </ul>
          </div>
        </div>
      </div>

      {showCustomEditor && (
        <CustomTheme onClose={() => setShowCustomEditor(false)} />
      )}

      {showBrandEditor && (
        <BrandCustomization onClose={() => setShowBrandEditor(false)} />
      )}
    </div>
  );
}
