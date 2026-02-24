import fs from 'fs';
import path from 'path';

export interface TranslationKey {
  key: string;
  value: string;
  context?: string;
  plural?: string;
}

export interface TranslationNamespace {
  [key: string]: string | TranslationNamespace;
}

export interface LocaleData {
  [namespace: string]: TranslationNamespace;
}

export class TranslationService {
  private static instance: TranslationService;
  private translations: Map<string, LocaleData> = new Map();
  private fallbackLocale = 'en';
  private supportedLocales = ['en', 'es', 'fr', 'zh'];

  private constructor() {
    this.loadTranslations();
  }

  public static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  /**
   * Load translation files from the filesystem
   */
  private async loadTranslations(): Promise<void> {
    const translationsPath = path.join(__dirname, '../../locales');
    
    try {
      for (const locale of this.supportedLocales) {
        const localePath = path.join(translationsPath, `${locale}.json`);
        
        if (fs.existsSync(localePath)) {
          const content = fs.readFileSync(localePath, 'utf-8');
          const translations: LocaleData = JSON.parse(content);
          this.translations.set(locale, translations);
        } else {
          console.warn(`Translation file not found for locale: ${locale}`);
        }
      }
    } catch (error) {
      console.error('Failed to load translations:', error);
    }
  }

  /**
   * Get translation for a specific key and locale
   */
  public translate(
    key: string,
    locale: string = this.fallbackLocale,
    options?: {
      count?: number;
      context?: string;
      variables?: Record<string, any>;
    }
  ): string {
    const translation = this.getTranslation(key, locale);
    
    if (!translation) {
      // Try fallback locale
      const fallbackTranslation = this.getTranslation(key, this.fallbackLocale);
      if (fallbackTranslation) {
        return this.interpolate(fallbackTranslation, options?.variables);
      }
      
      // Return key if no translation found
      console.warn(`Translation not found for key: ${key} in locale: ${locale}`);
      return key;
    }

    // Handle pluralization
    if (options?.count !== undefined && typeof translation === 'object') {
      const pluralForm = this.getPluralForm(options.count, locale);
      const pluralTranslation = (translation as any)[pluralForm] || translation.one || translation.other;
      return this.interpolate(pluralTranslation, { ...options?.variables, count: options.count });
    }

    return this.interpolate(translation as string, options?.variables);
  }

  /**
   * Get nested translation value
   */
  private getTranslation(key: string, locale: string): string | TranslationNamespace | null {
    const localeData = this.translations.get(locale);
    if (!localeData) {
      return null;
    }

    const keys = key.split('.');
    let current: any = localeData;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Interpolate variables into translation string
   */
  private interpolate(template: string, variables?: Record<string, any>): string {
    if (!variables || typeof template !== 'string') {
      return template;
    }

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key]?.toString() || match;
    });
  }

  /**
   * Get plural form based on count and locale
   */
  private getPluralForm(count: number, locale: string): string {
    // Simplified pluralization rules
    // In a real implementation, you'd use a library like Intl.PluralRules
    const rules: Record<string, (count: number) => string> = {
      en: (n) => n === 1 ? 'one' : 'other',
      es: (n) => n === 1 ? 'one' : 'other',
      fr: (n) => n === 1 ? 'one' : 'other',
      zh: () => 'other', // Chinese doesn't have plural forms
    };

    const rule = rules[locale] || rules.en;
    return rule(count);
  }

  /**
   * Get all supported locales
   */
  public getSupportedLocales(): string[] {
    return [...this.supportedLocales];
  }

  /**
   * Check if a locale is supported
   */
  public isLocaleSupported(locale: string): boolean {
    return this.supportedLocales.includes(locale);
  }

  /**
   * Get fallback locale
   */
  public getFallbackLocale(): string {
    return this.fallbackLocale;
  }

  /**
   * Add or update a translation
   */
  public addTranslation(
    locale: string,
    namespace: string,
    key: string,
    value: string
  ): void {
    if (!this.translations.has(locale)) {
      this.translations.set(locale, {});
    }

    const localeData = this.translations.get(locale)!;
    
    if (!localeData[namespace]) {
      localeData[namespace] = {};
    }

    const namespaceData = localeData[namespace] as any;
    const keys = key.split('.');
    let current = namespaceData;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get translations for a specific namespace
   */
  public getNamespaceTranslations(locale: string, namespace: string): TranslationNamespace | null {
    const localeData = this.translations.get(locale);
    return localeData?.[namespace] || null;
  }

  /**
   * Reload translations from disk
   */
  public async reloadTranslations(): Promise<void> {
    this.translations.clear();
    await this.loadTranslations();
  }

  /**
   * Validate translation keys completeness
   */
  public validateTranslations(): {
    locale: string;
    missingKeys: string[];
    extraKeys: string[];
  }[] {
    const results: {
      locale: string;
      missingKeys: string[];
      extraKeys: string[];
    }[] = [];

    const fallbackData = this.translations.get(this.fallbackLocale);
    if (!fallbackData) {
      return results;
    }

    const fallbackKeys = this.extractAllKeys(fallbackData);

    for (const locale of this.supportedLocales) {
      if (locale === this.fallbackLocale) continue;

      const localeData = this.translations.get(locale);
      const localeKeys = localeData ? this.extractAllKeys(localeData) : [];

      const missingKeys = fallbackKeys.filter(key => !localeKeys.includes(key));
      const extraKeys = localeKeys.filter(key => !fallbackKeys.includes(key));

      results.push({
        locale,
        missingKeys,
        extraKeys
      });
    }

    return results;
  }

  /**
   * Extract all translation keys from locale data
   */
  private extractAllKeys(data: TranslationNamespace, prefix: string = ''): string[] {
    const keys: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        keys.push(...this.extractAllKeys(value, fullKey));
      } else {
        keys.push(fullKey);
      }
    }

    return keys;
  }
}

// Export singleton instance
export const translationService = TranslationService.getInstance();

// Express middleware for translations
export const translationMiddleware = (req: any, res: any, next: any) => {
  req.t = (key: string, options?: any) => {
    const locale = req.locale || req.acceptsLanguages?.()?.[0] || 'en';
    return translationService.translate(key, locale, options);
  };
  
  next();
};
