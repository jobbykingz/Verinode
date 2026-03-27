import axios from 'axios';
import { Theme, BrandSettings, ThemeValidation } from '../types/theme';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface ThemeServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ThemeService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth-token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth-token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async getThemes(): Promise<ThemeServiceResponse<Theme[]>> {
    try {
      const response = await this.api.get('/themes');
      return {
        success: true,
        data: response.data.themes,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch themes',
      };
    }
  }

  async getTheme(id: string): Promise<ThemeServiceResponse<Theme>> {
    try {
      const response = await this.api.get(`/themes/${id}`);
      return {
        success: true,
        data: response.data.theme,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch theme',
      };
    }
  }

  async createTheme(theme: Omit<Theme, 'id'>): Promise<ThemeServiceResponse<Theme>> {
    try {
      const response = await this.api.post('/themes', theme);
      return {
        success: true,
        data: response.data.theme,
        message: 'Theme created successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create theme',
      };
    }
  }

  async updateTheme(id: string, updates: Partial<Theme>): Promise<ThemeServiceResponse<Theme>> {
    try {
      const response = await this.api.put(`/themes/${id}`, updates);
      return {
        success: true,
        data: response.data.theme,
        message: 'Theme updated successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update theme',
      };
    }
  }

  async deleteTheme(id: string): Promise<ThemeServiceResponse<void>> {
    try {
      await this.api.delete(`/themes/${id}`);
      return {
        success: true,
        message: 'Theme deleted successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete theme',
      };
    }
  }

  async duplicateTheme(id: string, newName: string): Promise<ThemeServiceResponse<Theme>> {
    try {
      const response = await this.api.post(`/themes/${id}/duplicate`, { name: newName });
      return {
        success: true,
        data: response.data.theme,
        message: 'Theme duplicated successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to duplicate theme',
      };
    }
  }

  async validateTheme(theme: Partial<Theme>): Promise<ThemeServiceResponse<ThemeValidation>> {
    try {
      const response = await this.api.post('/themes/validate', theme);
      return {
        success: true,
        data: response.data.validation,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to validate theme',
      };
    }
  }

  async exportTheme(id: string, format: 'json' | 'css' = 'json'): Promise<ThemeServiceResponse<string>> {
    try {
      const response = await this.api.get(`/themes/${id}/export?format=${format}`);
      return {
        success: true,
        data: response.data.content,
        message: 'Theme exported successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to export theme',
      };
    }
  }

  async importTheme(themeData: string, format: 'json' | 'css' = 'json'): Promise<ThemeServiceResponse<Theme>> {
    try {
      const response = await this.api.post('/themes/import', { data: themeData, format });
      return {
        success: true,
        data: response.data.theme,
        message: 'Theme imported successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to import theme',
      };
    }
  }

  async getBrandSettings(): Promise<ThemeServiceResponse<BrandSettings>> {
    try {
      const response = await this.api.get('/brand/settings');
      return {
        success: true,
        data: response.data.settings,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch brand settings',
      };
    }
  }

  async updateBrandSettings(settings: Partial<BrandSettings>): Promise<ThemeServiceResponse<BrandSettings>> {
    try {
      const response = await this.api.put('/brand/settings', settings);
      return {
        success: true,
        data: response.data.settings,
        message: 'Brand settings updated successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update brand settings',
      };
    }
  }

  async uploadBrandLogo(file: File): Promise<ThemeServiceResponse<string>> {
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await this.api.post('/brand/upload-logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        success: true,
        data: response.data.url,
        message: 'Logo uploaded successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to upload logo',
      };
    }
  }

  async getThemePresets(): Promise<ThemeServiceResponse<any[]>> {
    try {
      const response = await this.api.get('/themes/presets');
      return {
        success: true,
        data: response.data.presets,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch theme presets',
      };
    }
  }

  async applyThemeToUser(userId: string, themeId: string): Promise<ThemeServiceResponse<void>> {
    try {
      await this.api.post(`/users/${userId}/theme`, { themeId });
      return {
        success: true,
        message: 'Theme applied to user successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to apply theme to user',
      };
    }
  }

  async getUserTheme(userId: string): Promise<ThemeServiceResponse<Theme>> {
    try {
      const response = await this.api.get(`/users/${userId}/theme`);
      return {
        success: true,
        data: response.data.theme,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch user theme',
      };
    }
  }

  async syncThemeWithCloud(themeId: string): Promise<ThemeServiceResponse<Theme>> {
    try {
      const response = await this.api.post(`/themes/${themeId}/sync`);
      return {
        success: true,
        data: response.data.theme,
        message: 'Theme synced with cloud successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to sync theme with cloud',
      };
    }
  }

  async getThemeAnalytics(themeId: string): Promise<ThemeServiceResponse<any>> {
    try {
      const response = await this.api.get(`/themes/${themeId}/analytics`);
      return {
        success: true,
        data: response.data.analytics,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch theme analytics',
      };
    }
  }

  generateCSSFromTheme(theme: Theme): string {
    const cssVariables = Object.entries(theme.colors)
      .map(([key, value]) => `  --color-${key}: ${value};`)
      .join('\n');

    const fontSizeVariables = Object.entries(theme.typography.fontSize)
      .map(([key, value]) => `  --font-size-${key}: ${value};`)
      .join('\n');

    const fontWeightVariables = Object.entries(theme.typography.fontWeight)
      .map(([key, value]) => `  --font-weight-${key}: ${value};`)
      .join('\n');

    const spacingVariables = Object.entries(theme.spacing)
      .map(([key, value]) => `  --spacing-${key}: ${value};`)
      .join('\n');

    const borderRadiusVariables = Object.entries(theme.borderRadius)
      .map(([key, value]) => `  --radius-${key}: ${value};`)
      .join('\n');

    const shadowVariables = Object.entries(theme.shadows)
      .map(([key, value]) => `  --shadow-${key}: ${value};`)
      .join('\n');

    return `:root {
${cssVariables}
${fontSizeVariables}
${fontWeightVariables}
  --font-family: ${theme.typography.fontFamily};
${spacingVariables}
${borderRadiusVariables}
${shadowVariables}
}

[data-theme="${theme.id}"] {
  background-color: var(--color-background);
  color: var(--color-text);
}

/* Component styles */
.btn-primary {
  background-color: var(--color-primary);
  color: white;
  border: none;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}

.btn-secondary {
  background-color: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}

.card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-md);
}

.text-primary { color: var(--color-primary); }
.text-secondary { color: var(--color-secondary); }
.text-success { color: var(--color-success); }
.text-warning { color: var(--color-warning); }
.text-error { color: var(--color-error); }
.text-accent { color: var(--color-accent); }

.bg-primary { background-color: var(--color-primary); }
.bg-secondary { background-color: var(--color-secondary); }
.bg-surface { background-color: var(--color-surface); }
.bg-success { background-color: var(--color-success); }
.bg-warning { background-color: var(--color-warning); }
.bg-error { background-color: var(--color-error); }
.bg-accent { background-color: var(--color-accent); }
`;
  }

  validateThemeLocally(theme: Partial<Theme>): ThemeValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const contrastRatios: Record<string, any> = {};

    if (!theme.name || theme.name.trim().length === 0) {
      errors.push('Theme name is required');
    }

    if (theme.colors) {
      Object.entries(theme.colors).forEach(([key, value]) => {
        if (!value || !/^#[0-9A-Fa-f]{6}$/.test(value)) {
          errors.push(`Invalid color format for ${key}: ${value}`);
        }
      });

      if (theme.colors.background && theme.colors.text) {
        const bgLuminance = this.getLuminance(theme.colors.background);
        const textLuminance = this.getLuminance(theme.colors.text);
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
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      contrastRatios,
    };
  }

  private getLuminance(hex: string): number {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    
    const [lr, lg, lb] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  }
}

export const themeService = new ThemeService();
