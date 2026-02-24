import { Request, Response, NextFunction } from 'express';

export interface LocaleDetectionOptions {
  supportedLocales: string[];
  fallbackLocale: string;
  cookieName?: string;
  queryParam?: string;
  headerName?: string;
}

export class LocaleDetector {
  private options: LocaleDetectionOptions;

  constructor(options: LocaleDetectionOptions) {
    this.options = {
      cookieName: 'locale',
      queryParam: 'lang',
      headerName: 'accept-language',
      ...options
    };
  }

  /**
   * Express middleware for locale detection
   */
  public detectLocale = (req: Request, res: Response, next: NextFunction): void => {
    const locale = this.getLocale(req);
    
    // Set locale on request object
    (req as any).locale = locale;
    
    // Set locale in response headers
    res.setHeader('Content-Language', locale);
    
    // Set locale cookie if different from current
    if (req.cookies?.[this.options.cookieName!] !== locale) {
      res.cookie(this.options.cookieName!, locale, {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }
    
    next();
  };

  /**
   * Get locale from various sources in priority order
   */
  private getLocale(req: Request): string {
    // 1. URL query parameter (highest priority)
    const queryLocale = this.getLocaleFromQuery(req);
    if (queryLocale) {
      return queryLocale;
    }

    // 2. Cookie
    const cookieLocale = this.getLocaleFromCookie(req);
    if (cookieLocale) {
      return cookieLocale;
    }

    // 3. Accept-Language header
    const headerLocale = this.getLocaleFromHeader(req);
    if (headerLocale) {
      return headerLocale;
    }

    // 4. User preference (if authenticated)
    const userLocale = this.getLocaleFromUser(req);
    if (userLocale) {
      return userLocale;
    }

    // 5. Fallback locale
    return this.options.fallbackLocale;
  }

  /**
   * Get locale from URL query parameter
   */
  private getLocaleFromQuery(req: Request): string | null {
    const queryParam = this.options.queryParam!;
    const locale = req.query[queryParam] as string;
    
    if (locale && this.isValidLocale(locale)) {
      return locale;
    }
    
    return null;
  }

  /**
   * Get locale from cookie
   */
  private getLocaleFromCookie(req: Request): string | null {
    const cookieName = this.options.cookieName!;
    const locale = req.cookies?.[cookieName];
    
    if (locale && this.isValidLocale(locale)) {
      return locale;
    }
    
    return null;
  }

  /**
   * Get locale from Accept-Language header
   */
  private getLocaleFromHeader(req: Request): string | null {
    const headerName = this.options.headerName!;
    const acceptLanguage = req.headers[headerName] as string;
    
    if (!acceptLanguage) {
      return null;
    }

    // Parse Accept-Language header
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [locale, quality = '1'] = lang.trim().split(';q=');
        return {
          locale: locale.trim(),
          quality: parseFloat(quality)
        };
      })
      .sort((a, b) => b.quality - a.quality);

    // Find first supported locale
    for (const { locale } of languages) {
      // Try exact match
      if (this.isValidLocale(locale)) {
        return locale;
      }

      // Try language-only match (e.g., 'en' from 'en-US')
      const languageOnly = locale.split('-')[0];
      if (this.isValidLocale(languageOnly)) {
        return languageOnly;
      }
    }

    return null;
  }

  /**
   * Get locale from authenticated user preferences
   */
  private getLocaleFromUser(req: Request): string | null {
    // This would typically come from a database or user service
    // For now, we'll assume it's available on the request object
    const user = (req as any).user;
    
    if (user?.locale && this.isValidLocale(user.locale)) {
      return user.locale;
    }
    
    return null;
  }

  /**
   * Check if locale is supported
   */
  private isValidLocale(locale: string): boolean {
    return this.options.supportedLocales.includes(locale);
  }

  /**
   * Get locale information for API responses
   */
  public getLocaleInfo(req: Request): {
    current: string;
    supported: string[];
    fallback: string;
    source: string;
  } {
    const locale = (req as any).locale || this.options.fallbackLocale;
    
    let source = 'fallback';
    if (req.query[this.options.queryParam!]) {
      source = 'query';
    } else if (req.cookies?.[this.options.cookieName!]) {
      source = 'cookie';
    } else if (req.headers[this.options.headerName!]) {
      source = 'header';
    } else if ((req as any).user?.locale) {
      source = 'user';
    }

    return {
      current: locale,
      supported: this.options.supportedLocales,
      fallback: this.options.fallbackLocale,
      source
    };
  }

  /**
   * Set locale programmatically
   */
  public setLocale(res: Response, locale: string): void {
    if (this.isValidLocale(locale)) {
      res.cookie(this.options.cookieName!, locale, {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      res.setHeader('Content-Language', locale);
    }
  }

  /**
   * Get RTL language information
   */
  public isRTLLocale(locale: string): boolean {
    const rtlLocales = ['ar', 'he', 'fa', 'ur'];
    return rtlLocales.some(rtl => locale.startsWith(rtl));
  }

  /**
   * Get locale-specific formatting options
   */
  public getFormattingOptions(locale: string): {
    currency: string;
    dateFormat: Intl.DateTimeFormatOptions;
    numberFormat: Intl.NumberFormatOptions;
    timeZone: string;
  } {
    const localeConfig: Record<string, any> = {
      en: {
        currency: 'USD',
        dateFormat: { year: 'numeric', month: 'short', day: 'numeric' },
        numberFormat: { style: 'decimal' },
        timeZone: 'America/New_York'
      },
      es: {
        currency: 'EUR',
        dateFormat: { year: 'numeric', month: 'long', day: 'numeric' },
        numberFormat: { style: 'decimal' },
        timeZone: 'Europe/Madrid'
      },
      fr: {
        currency: 'EUR',
        dateFormat: { year: 'numeric', month: 'long', day: 'numeric' },
        numberFormat: { style: 'decimal' },
        timeZone: 'Europe/Paris'
      },
      zh: {
        currency: 'CNY',
        dateFormat: { year: 'numeric', month: 'long', day: 'numeric' },
        numberFormat: { style: 'decimal' },
        timeZone: 'Asia/Shanghai'
      }
    };

    return localeConfig[locale] || localeConfig[this.options.fallbackLocale];
  }
}

// Default configuration
const defaultOptions: LocaleDetectionOptions = {
  supportedLocales: ['en', 'es', 'fr', 'zh'],
  fallbackLocale: 'en'
};

// Create and export default instance
export const localeDetector = new LocaleDetector(defaultOptions);

// Export middleware for easy use
export const localeDetectionMiddleware = localeDetector.detectLocale;
