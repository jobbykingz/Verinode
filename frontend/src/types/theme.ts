export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  accent: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  fontWeight: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface ThemeBorderRadius {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  isBuiltIn?: boolean;
  isAccessible?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandSettings {
  logo: string;
  brandName: string;
  brandColors: Partial<ThemeColors>;
  favicon?: string;
  customCSS?: string;
}

export interface ThemeState {
  currentTheme: string;
  themes: Record<string, Theme>;
  customThemes: Record<string, Theme>;
  brandSettings: BrandSettings;
}

export type ThemeAction =
  | { type: 'SWITCH_THEME'; payload: string }
  | { type: 'CREATE_CUSTOM_THEME'; payload: Omit<Theme, 'id'> }
  | { type: 'UPDATE_THEME'; payload: { themeId: string; updates: Partial<Theme> } }
  | { type: 'DELETE_THEME'; payload: string }
  | { type: 'UPDATE_BRAND_SETTINGS'; payload: Partial<BrandSettings> }
  | { type: 'LOAD_THEMES'; payload: Partial<ThemeState> };

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  theme: Omit<Theme, 'id'>;
  category: 'professional' | 'creative' | 'accessibility' | 'custom';
}

export interface ColorContrast {
  ratio: number;
  AA: boolean;
  AAA: boolean;
  AALarge: boolean;
  AAALarge: boolean;
}

export interface ThemeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  contrastRatios: Record<string, ColorContrast>;
}
