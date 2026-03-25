/**
 * HighContrast Component
 * Provides high contrast mode and color blind support for accessibility
 */

import React, { useEffect, useState } from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';
import { ColorContrast } from '../../utils/accessibilityUtils';

interface HighContrastProps {
  children?: React.ReactNode;
  className?: string;
  showToggle?: boolean;
  colorBlindSupport?: boolean;
}

type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

interface ColorPreset {
  name: string;
  background: string;
  foreground: string;
  accent: string;
  border: string;
}

export const HighContrast: React.FC<HighContrastProps> = ({
  children,
  className = '',
  showToggle = false,
  colorBlindSupport = true
}) => {
  const { preferences, updatePreference, announce } = useAccessibility();
  const [customPresets, setCustomPresets] = useState<ColorPreset[]>([]);

  // High contrast presets
  const highContrastPresets: ColorPreset[] = [
    {
      name: 'Standard High Contrast',
      background: '#000000',
      foreground: '#ffffff',
      accent: '#ffff00',
      border: '#ffffff'
    },
    {
      name: 'White on Black',
      background: '#000000',
      foreground: '#ffffff',
      accent: '#00ff00',
      border: '#ffffff'
    },
    {
      name: 'Black on White',
      background: '#ffffff',
      foreground: '#000000',
      accent: '#0000ff',
      border: '#000000'
    },
    {
      name: 'Yellow on Black',
      background: '#000000',
      foreground: '#ffff00',
      accent: '#ffffff',
      border: '#ffff00'
    }
  ];

  // Color blind filter presets
  const colorBlindFilters: Record<ColorBlindMode, string> = {
    none: 'none',
    protanopia: 'url(#protanopia-filter)',
    deuteranopia: 'url(#deuteranopia-filter)',
    tritanopia: 'url(#tritanopia-filter)'
  };

  // Apply high contrast styles
  useEffect(() => {
    if (preferences.highContrast) {
      applyHighContrastStyles();
    } else {
      removeHighContrastStyles();
    }
  }, [preferences.highContrast]);

  // Apply color blind filters
  useEffect(() => {
    if (colorBlindSupport) {
      applyColorBlindFilter(preferences.colorBlindMode);
    }
  }, [preferences.colorBlindMode, colorBlindSupport]);

  // Apply font size
  useEffect(() => {
    applyFontSize(preferences.fontSize);
  }, [preferences.fontSize]);

  const applyHighContrastStyles = () => {
    const style = document.createElement('style');
    style.id = 'high-contrast-styles';
    style.textContent = `
      :root {
        --bg-primary: #000000;
        --bg-secondary: #1a1a1a;
        --bg-tertiary: #2a2a2a;
        --text-primary: #ffffff;
        --text-secondary: #cccccc;
        --text-tertiary: #999999;
        --border-primary: #ffffff;
        --border-secondary: #cccccc;
        --accent-primary: #ffff00;
        --accent-secondary: #00ff00;
        --focus-ring: #ffff00;
      }

      body {
        background-color: var(--bg-primary) !important;
        color: var(--text-primary) !important;
      }

      .bg-white, .bg-gray-50, .bg-gray-100 {
        background-color: var(--bg-primary) !important;
      }

      .bg-gray-200, .bg-gray-300 {
        background-color: var(--bg-secondary) !important;
      }

      .bg-gray-400, .bg-gray-500 {
        background-color: var(--bg-tertiary) !important;
      }

      .text-gray-600, .text-gray-700, .text-gray-800, .text-gray-900 {
        color: var(--text-primary) !important;
      }

      .text-gray-400, .text-gray-500 {
        color: var(--text-secondary) !important;
      }

      .text-gray-300 {
        color: var(--text-tertiary) !important;
      }

      .border-gray-200, .border-gray-300, .border-gray-400 {
        border-color: var(--border-primary) !important;
      }

      .border-gray-500, .border-gray-600 {
        border-color: var(--border-secondary) !important;
      }

      .border-blue-500, .border-blue-600 {
        border-color: var(--accent-primary) !important;
      }

      .bg-blue-500, .bg-blue-600 {
        background-color: var(--accent-primary) !important;
        color: var(--bg-primary) !important;
      }

      .bg-green-500, .bg-green-600 {
        background-color: var(--accent-secondary) !important;
        color: var(--bg-primary) !important;
      }

      button, .btn, [role="button"] {
        background-color: var(--bg-secondary) !important;
        color: var(--text-primary) !important;
        border: 2px solid var(--border-primary) !important;
      }

      button:hover, .btn:hover, [role="button"]:hover {
        background-color: var(--bg-tertiary) !important;
        border-color: var(--accent-primary) !important;
      }

      button:focus, .btn:focus, [role="button"]:focus,
      input:focus, textarea:focus, select:focus {
        outline: 3px solid var(--focus-ring) !important;
        outline-offset: 2px !important;
      }

      input, textarea, select {
        background-color: var(--bg-secondary) !important;
        color: var(--text-primary) !important;
        border: 2px solid var(--border-primary) !important;
      }

      a {
        color: var(--accent-primary) !important;
        text-decoration: underline !important;
      }

      a:hover {
        color: var(--accent-secondary) !important;
      }

      .shadow-lg, .shadow-md, .shadow {
        box-shadow: 0 0 0 2px var(--border-primary) !important;
      }

      img {
        filter: contrast(1.5) brightness(1.2) !important;
      }

      .sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
    `;
    document.head.appendChild(style);
  };

  const removeHighContrastStyles = () => {
    const style = document.getElementById('high-contrast-styles');
    if (style) {
      document.head.removeChild(style);
    }
  };

  const applyColorBlindFilter = (mode: ColorBlindMode) => {
    // Remove existing SVG filters
    const existingFilters = document.getElementById('color-blind-filters');
    if (existingFilters) {
      existingFilters.remove();
    }

    if (mode === 'none') {
      document.documentElement.style.filter = 'none';
      return;
    }

    // Create SVG filters for color blindness
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'color-blind-filters';
    svg.style.position = 'absolute';
    svg.style.width = '0';
    svg.style.height = '0';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Protanopia filter (red-blind)
    if (mode === 'protanopia') {
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.id = 'protanopia-filter';
      filter.innerHTML = `
        <feColorMatrix type="matrix" values="
          0.567, 0.433, 0,     0, 0
          0.558, 0.442, 0,     0, 0
          0,     0.242, 0.758, 0, 0
          0,     0,     0,     1, 0
        "/>
      `;
      defs.appendChild(filter);
    }

    // Deuteranopia filter (green-blind)
    if (mode === 'deuteranopia') {
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.id = 'deuteranopia-filter';
      filter.innerHTML = `
        <feColorMatrix type="matrix" values="
          0.625, 0.375, 0,   0, 0
          0.7,   0.3,   0,   0, 0
          0,     0.3,   0.7, 0, 0
          0,     0,     0,   1, 0
        "/>
      `;
      defs.appendChild(filter);
    }

    // Tritanopia filter (blue-blind)
    if (mode === 'tritanopia') {
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.id = 'tritanopia-filter';
      filter.innerHTML = `
        <feColorMatrix type="matrix" values="
          0.95, 0.05,  0,     0, 0
          0,    0.433, 0.567, 0, 0
          0,    0.475, 0.525, 0, 0
          0,    0,     0,     1, 0
        "/>
      `;
      defs.appendChild(filter);
    }

    svg.appendChild(defs);
    document.body.appendChild(svg);

    // Apply the filter
    document.documentElement.style.filter = colorBlindFilters[mode];
  };

  const applyFontSize = (size: 'small' | 'medium' | 'large' | 'extra-large') => {
    const root = document.documentElement;
    const fontSizes = {
      small: '14px',
      medium: '16px',
      large: '18px',
      'extra-large': '20px'
    };

    root.style.fontSize = fontSizes[size];
  };

  const toggleHighContrast = () => {
    const newValue = !preferences.highContrast;
    updatePreference('highContrast', newValue);
    announce(`High contrast ${newValue ? 'enabled' : 'disabled'}`);
  };

  const changeColorBlindMode = (mode: ColorBlindMode) => {
    updatePreference('colorBlindMode', mode);
    announce(`Color blind mode set to ${mode}`);
  };

  const changeFontSize = (size: 'small' | 'medium' | 'large' | 'extra-large') => {
    updatePreference('fontSize', size);
    announce(`Font size set to ${size}`);
  };

  return (
    <div className={`high-contrast ${className}`} role="region" aria-label="High contrast and visual accessibility">
      {/* High contrast toggle button */}
      {showToggle && (
        <button
          onClick={toggleHighContrast}
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-50 
                   focus:bg-white focus:border-2 focus:border-blue-600 focus:rounded-lg 
                   focus:p-4 focus:shadow-lg"
          aria-pressed={preferences.highContrast}
        >
          {preferences.highContrast ? 'Disable' : 'Enable'} High Contrast
        </button>
      )}

      {/* Accessibility controls panel */}
      <div className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 
                      focus:bg-white focus:border-2 focus:border-blue-600 focus:rounded-lg 
                      focus:p-4 focus:shadow-lg"
           role="group"
           aria-label="Visual accessibility controls">
        <h3 className="font-bold mb-4">Visual Accessibility</h3>
        
        {/* High contrast toggle */}
        <div className="mb-4">
          <button
            onClick={toggleHighContrast}
            className="block w-full text-left px-2 py-1 mb-1 border rounded"
            aria-pressed={preferences.highContrast}
          >
            High Contrast: {preferences.highContrast ? 'On' : 'Off'}
          </button>
        </div>

        {/* Font size controls */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Font Size:</label>
          <div className="space-y-1">
            {(['small', 'medium', 'large', 'extra-large'] as const).map(size => (
              <button
                key={size}
                onClick={() => changeFontSize(size)}
                className={`block w-full text-left px-2 py-1 border rounded ${
                  preferences.fontSize === size ? 'bg-blue-100 border-blue-500' : ''
                }`}
              >
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Color blind support */}
        {colorBlindSupport && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Color Blind Mode:</label>
            <div className="space-y-1">
              {(['none', 'protanopia', 'deuteranopia', 'tritanopia'] as ColorBlindMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => changeColorBlindMode(mode)}
                  className={`block w-full text-left px-2 py-1 border rounded ${
                    preferences.colorBlindMode === mode ? 'bg-blue-100 border-blue-500' : ''
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Large text toggle */}
        <div className="mb-4">
          <button
            onClick={() => {
              updatePreference('largeText', !preferences.largeText);
              announce(`Large text ${!preferences.largeText ? 'enabled' : 'disabled'}`);
            }}
            className="block w-full text-left px-2 py-1 mb-1 border rounded"
            aria-pressed={preferences.largeText}
          >
            Large Text: {preferences.largeText ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Status indicator for screen readers */}
      <div className="sr-only" aria-live="polite">
        High contrast mode is {preferences.highContrast ? 'active' : 'inactive'}
        {colorBlindSupport && `, Color blind mode: ${preferences.colorBlindMode}`}
        {`, Font size: ${preferences.fontSize}`}
      </div>

      {/* Render children */}
      {children}
    </div>
  );
};

export default HighContrast;
