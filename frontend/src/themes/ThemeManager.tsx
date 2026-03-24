import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Theme, ThemeAction, ThemeState } from '../types/theme';
import { themeService } from '../services/themeService';

const ThemeContext = createContext<{
  state: ThemeState;
  dispatch: React.Dispatch<ThemeAction>;
  switchTheme: (themeId: string) => void;
  createCustomTheme: (theme: Omit<Theme, 'id'>) => void;
  updateTheme: (themeId: string, updates: Partial<Theme>) => void;
  deleteTheme: (themeId: string) => void;
  exportTheme: (themeId: string) => string;
  importTheme: (themeData: string) => void;
} | null>(null);

const initialState: ThemeState = {
  currentTheme: 'light',
  themes: {
    light: {
      id: 'light',
      name: 'Light',
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
      isBuiltIn: true,
      isAccessible: true,
    },
    dark: {
      id: 'dark',
      name: 'Dark',
      colors: {
        primary: '#60a5fa',
        secondary: '#94a3b8',
        background: '#0f172a',
        surface: '#1e293b',
        text: '#f1f5f9',
        textSecondary: '#94a3b8',
        border: '#334155',
        success: '#34d399',
        warning: '#fbbf24',
        error: '#f87171',
        accent: '#a78bfa',
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
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.4)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.5)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.6)',
      },
      isBuiltIn: true,
      isAccessible: true,
    },
    highContrast: {
      id: 'highContrast',
      name: 'High Contrast',
      colors: {
        primary: '#0000ff',
        secondary: '#000000',
        background: '#ffffff',
        surface: '#ffffff',
        text: '#000000',
        textSecondary: '#000000',
        border: '#000000',
        success: '#008000',
        warning: '#ff8c00',
        error: '#ff0000',
        accent: '#800080',
      },
      typography: {
        fontFamily: 'Arial, sans-serif',
        fontSize: {
          xs: '0.875rem',
          sm: '1rem',
          base: '1.125rem',
          lg: '1.25rem',
          xl: '1.375rem',
          '2xl': '1.625rem',
          '3xl': '2rem',
        },
        fontWeight: {
          light: 400,
          normal: 600,
          medium: 700,
          semibold: 800,
          bold: 900,
        },
      },
      spacing: {
        xs: '0.5rem',
        sm: '0.75rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
      },
      borderRadius: {
        sm: '0rem',
        md: '0rem',
        lg: '0rem',
        xl: '0rem',
        full: '0rem',
      },
      shadows: {
        sm: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
      },
      isBuiltIn: true,
      isAccessible: true,
    },
  },
  customThemes: {},
  brandSettings: {
    logo: '',
    brandName: 'Verinode',
    brandColors: {},
  },
};

function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case 'SWITCH_THEME':
      return {
        ...state,
        currentTheme: action.payload,
      };

    case 'CREATE_CUSTOM_THEME':
      const newTheme: Theme = {
        ...action.payload,
        id: `custom_${Date.now()}`,
        isBuiltIn: false,
        isAccessible: true,
      };
      return {
        ...state,
        customThemes: {
          ...state.customThemes,
          [newTheme.id]: newTheme,
        },
      };

    case 'UPDATE_THEME':
      if (state.themes[action.payload.themeId]) {
        return {
          ...state,
          themes: {
            ...state.themes,
            [action.payload.themeId]: {
              ...state.themes[action.payload.themeId],
              ...action.payload.updates,
            },
          },
        };
      } else if (state.customThemes[action.payload.themeId]) {
        return {
          ...state,
          customThemes: {
            ...state.customThemes,
            [action.payload.themeId]: {
              ...state.customThemes[action.payload.themeId],
              ...action.payload.updates,
            },
          },
        };
      }
      return state;

    case 'DELETE_THEME':
      const newCustomThemes = { ...state.customThemes };
      delete newCustomThemes[action.payload];
      return {
        ...state,
        customThemes: newCustomThemes,
      };

    case 'UPDATE_BRAND_SETTINGS':
      return {
        ...state,
        brandSettings: {
          ...state.brandSettings,
          ...action.payload,
        },
      };

    case 'LOAD_THEMES':
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(themeReducer, initialState);

  useEffect(() => {
    const savedState = localStorage.getItem('verinode-theme-state');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        dispatch({ type: 'LOAD_THEMES', payload: parsedState });
      } catch (error) {
        console.error('Failed to load theme state:', error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('verinode-theme-state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const currentTheme = state.themes[state.currentTheme] || state.customThemes[state.currentTheme];
    if (currentTheme) {
      applyThemeToDOM(currentTheme);
    }
  }, [state.currentTheme, state.themes, state.customThemes]);

  const switchTheme = (themeId: string) => {
    dispatch({ type: 'SWITCH_THEME', payload: themeId });
  };

  const createCustomTheme = (theme: Omit<Theme, 'id'>) => {
    dispatch({ type: 'CREATE_CUSTOM_THEME', payload: theme });
  };

  const updateTheme = (themeId: string, updates: Partial<Theme>) => {
    dispatch({ type: 'UPDATE_THEME', payload: { themeId, updates } });
  };

  const deleteTheme = (themeId: string) => {
    dispatch({ type: 'DELETE_THEME', payload: themeId });
  };

  const exportTheme = (themeId: string) => {
    const theme = state.themes[themeId] || state.customThemes[themeId];
    if (!theme) return '';
    return JSON.stringify(theme, null, 2);
  };

  const importTheme = (themeData: string) => {
    try {
      const theme = JSON.parse(themeData);
      createCustomTheme(theme);
    } catch (error) {
      console.error('Failed to import theme:', error);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        state,
        dispatch,
        switchTheme,
        createCustomTheme,
        updateTheme,
        deleteTheme,
        exportTheme,
        importTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeManager() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeManager must be used within a ThemeProvider');
  }
  return context;
}

function applyThemeToDOM(theme: Theme) {
  const root = document.documentElement;
  
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });

  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    root.style.setProperty(`--font-size-${key}`, value);
  });

  Object.entries(theme.typography.fontWeight).forEach(([key, value]) => {
    root.style.setProperty(`--font-weight-${key}`, String(value));
  });

  root.style.setProperty('--font-family', theme.typography.fontFamily);

  Object.entries(theme.spacing).forEach(([key, value]) => {
    root.style.setProperty(`--spacing-${key}`, value);
  });

  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    root.style.setProperty(`--radius-${key}`, value);
  });

  Object.entries(theme.shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value);
  });

  root.setAttribute('data-theme', theme.id);
}
