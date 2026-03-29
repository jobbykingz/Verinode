import { useEffect, useCallback, useMemo, useState } from 'react';
import { useThemeManager } from '../themes/ThemeManager';
import { Theme, ThemeColors } from '../types/theme';

interface UseThemeOptions {
  enableSystemTheme?: boolean;
  followSystemTheme?: boolean;
  storageKey?: string;
}

interface UseThemeReturn {
  currentTheme: Theme;
  currentThemeId: string;
  themes: Record<string, Theme>;
  customThemes: Record<string, Theme>;
  brandSettings: any;
  switchTheme: (themeId: string) => void;
  createCustomTheme: (theme: Omit<Theme, 'id'>) => void;
  updateTheme: (themeId: string, updates: Partial<Theme>) => void;
  deleteTheme: (themeId: string) => void;
  exportTheme: (themeId: string) => string;
  importTheme: (themeData: string) => void;
  getColor: (colorKey: keyof ThemeColors) => string;
  getCSSVariable: (variable: string) => string;
  setCSSVariable: (variable: string, value: string) => void;
  isDarkTheme: boolean;
  isLightTheme: boolean;
  isHighContrastTheme: boolean;
  resetToDefaults: () => void;
  toggleTheme: () => void;
}

export function useTheme(options: UseThemeOptions = {}): UseThemeReturn {
  const {
    enableSystemTheme = true,
    followSystemTheme = false,
    storageKey = 'verinode-theme-settings',
  } = options;

  const {
    state,
    switchTheme: switchThemeFromContext,
    createCustomTheme: createCustomThemeFromContext,
    updateTheme: updateThemeFromContext,
    deleteTheme: deleteThemeFromContext,
    exportTheme: exportThemeFromContext,
    importTheme: importThemeFromContext,
  } = useThemeManager();

  const allThemes = useMemo(() => ({
    ...state.themes,
    ...state.customThemes,
  }), [state.themes, state.customThemes]);

  const currentTheme = useMemo(() => {
    return allThemes[state.currentTheme] || allThemes.light;
  }, [state.currentTheme, allThemes]);

  const isDarkTheme = useMemo(() => {
    return currentTheme.id === 'dark' || 
           (currentTheme.colors.background && currentTheme.colors.background === '#0f172a');
  }, [currentTheme]);

  const isLightTheme = useMemo(() => {
    return currentTheme.id === 'light' || 
           (currentTheme.colors.background && currentTheme.colors.background === '#ffffff');
  }, [currentTheme]);

  const isHighContrastTheme = useMemo(() => {
    return currentTheme.id === 'highContrast';
  }, [currentTheme]);

  const getColor = useCallback((colorKey: keyof ThemeColors): string => {
    return currentTheme.colors[colorKey] || '#000000';
  }, [currentTheme]);

  const getCSSVariable = useCallback((variable: string): string => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(`--${variable}`)
      .trim();
  }, []);

  const setCSSVariable = useCallback((variable: string, value: string) => {
    document.documentElement.style.setProperty(`--${variable}`, value);
  }, []);

  const switchTheme = useCallback((themeId: string) => {
    switchThemeFromContext(themeId);
    
    if (enableSystemTheme && followSystemTheme) {
      localStorage.setItem(`${storageKey}-user-override`, themeId);
    }
  }, [switchThemeFromContext, enableSystemTheme, followSystemTheme, storageKey]);

  const createCustomTheme = useCallback((theme: Omit<Theme, 'id'>) => {
    createCustomThemeFromContext(theme);
  }, [createCustomThemeFromContext]);

  const updateTheme = useCallback((themeId: string, updates: Partial<Theme>) => {
    updateThemeFromContext(themeId, updates);
  }, [updateThemeFromContext]);

  const deleteTheme = useCallback((themeId: string) => {
    deleteThemeFromContext(themeId);
  }, [deleteThemeFromContext]);

  const exportTheme = useCallback((themeId: string): string => {
    return exportThemeFromContext(themeId);
  }, [exportThemeFromContext]);

  const importTheme = useCallback((themeData: string) => {
    importThemeFromContext(themeData);
  }, [importThemeFromContext]);

  const resetToDefaults = useCallback(() => {
    switchTheme('light');
    localStorage.removeItem(`${storageKey}-user-override`);
  }, [switchTheme, storageKey]);

  const toggleTheme = useCallback(() => {
    if (isDarkTheme) {
      switchTheme('light');
    } else {
      switchTheme('dark');
    }
  }, [isDarkTheme, switchTheme]);

  useEffect(() => {
    if (enableSystemTheme && followSystemTheme) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        const userOverride = localStorage.getItem(`${storageKey}-user-override`);
        if (!userOverride) {
          switchTheme(e.matches ? 'dark' : 'light');
        }
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);
      
      const userOverride = localStorage.getItem(`${storageKey}-user-override`);
      if (!userOverride) {
        switchTheme(mediaQuery.matches ? 'dark' : 'light');
      }

      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  }, [enableSystemTheme, followSystemTheme, switchTheme, storageKey]);

  useEffect(() => {
    const handleThemeChange = (event: CustomEvent) => {
      if (event.detail?.themeId) {
        switchTheme(event.detail.themeId);
      }
    };

    window.addEventListener('theme-change', handleThemeChange as EventListener);
    
    return () => {
      window.removeEventListener('theme-change', handleThemeChange as EventListener);
    };
  }, [switchTheme]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (prefersReducedMotion.matches) {
      document.documentElement.style.setProperty('--transition-duration', '0.01ms');
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const settings = JSON.parse(e.newValue);
          if (settings.themeId && settings.themeId !== state.currentTheme) {
            switchTheme(settings.themeId);
          }
        } catch (error) {
          console.error('Failed to parse theme settings from storage:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [storageKey, state.currentTheme, switchTheme]);

  return {
    currentTheme,
    currentThemeId: state.currentTheme,
    themes: state.themes,
    customThemes: state.customThemes,
    brandSettings: state.brandSettings,
    switchTheme,
    createCustomTheme,
    updateTheme,
    deleteTheme,
    exportTheme,
    importTheme,
    getColor,
    getCSSVariable,
    setCSSVariable,
    isDarkTheme,
    isLightTheme,
    isHighContrastTheme,
    resetToDefaults,
    toggleTheme,
  };
}

export function useThemeColor(colorKey: keyof ThemeColors, fallbackColor = '#000000'): string {
  const { getColor } = useTheme();
  return getColor(colorKey) || fallbackColor;
}

export function useThemeCSSVariable(variable: string, fallbackValue = ''): string {
  const { getCSSVariable } = useTheme();
  return getCSSVariable(variable) || fallbackValue;
}

export function useThemeContrast(
  backgroundColor?: keyof ThemeColors,
  textColor?: keyof ThemeColors
): {
  ratio: number;
  isAACompliant: boolean;
  isAAACompliant: boolean;
  isAALargeCompliant: boolean;
  isAAALargeCompliant: boolean;
} {
  const { getColor } = useTheme();
  
  const bg = backgroundColor ? getColor(backgroundColor) : '#ffffff';
  const text = textColor ? getColor(textColor) : '#000000';
  
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
  
  const bgLuminance = getLuminance(bg);
  const textLuminance = getLuminance(text);
  const ratio = (Math.max(bgLuminance, textLuminance) + 0.05) / (Math.min(bgLuminance, textLuminance) + 0.05);
  
  return {
    ratio,
    isAACompliant: ratio >= 4.5,
    isAAACompliant: ratio >= 7,
    isAALargeCompliant: ratio >= 3,
    isAAALargeCompliant: ratio >= 4.5,
  };
}

export function useThemeBreakpoints(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  currentBreakpoint: string;
} {
  const [breakpoint, setBreakpoint] = useState('desktop');
  
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setBreakpoint('mobile');
      } else if (width < 1024) {
        setBreakpoint('tablet');
      } else if (width < 1280) {
        setBreakpoint('desktop');
      } else {
        setBreakpoint('large-desktop');
      }
    };
    
    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    
    return () => {
      window.removeEventListener('resize', updateBreakpoint);
    };
  }, []);
  
  return {
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isLargeDesktop: breakpoint === 'large-desktop',
    currentBreakpoint: breakpoint,
  };
}

export function useThemeAnimation(): {
  prefersReducedMotion: boolean;
  animationDuration: string;
  enableAnimations: boolean;
} {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);
  
  return {
    prefersReducedMotion,
    animationDuration: prefersReducedMotion ? '0.01ms' : '200ms',
    enableAnimations: !prefersReducedMotion,
  };
}
