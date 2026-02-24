export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  locale?: string;
  fallback?: string;
}

export interface CurrencyFormatOptions extends NumberFormatOptions {
  currency: string;
}

export class NumberFormatter {
  private static DEFAULT_LOCALE = 'en-US';
  private static DEFAULT_CURRENCY = 'USD';

  /**
   * Format a number according to the specified locale
   */
  static formatNumber(
    value: number,
    options: NumberFormatOptions = {}
  ): string {
    const {
      locale = this.DEFAULT_LOCALE,
      fallback = this.DEFAULT_LOCALE,
      ...intlOptions
    } = options;

    try {
      return new Intl.NumberFormat(locale, intlOptions).format(value);
    } catch (error) {
      console.warn(`Failed to format number for locale ${locale}, trying fallback:`, error);
      
      try {
        return new Intl.NumberFormat(fallback, intlOptions).format(value);
      } catch (fallbackError) {
        console.warn(`Fallback formatting failed, using basic format:`, fallbackError);
        return value.toString();
      }
    }
  }

  /**
   * Format currency according to the specified locale and currency
   */
  static formatCurrency(
    value: number,
    options: CurrencyFormatOptions
  ): string {
    const {
      locale = this.DEFAULT_LOCALE,
      fallback = this.DEFAULT_LOCALE,
      currency = this.DEFAULT_CURRENCY,
      ...intlOptions
    } = options;

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        ...intlOptions
      }).format(value);
    } catch (error) {
      console.warn(`Failed to format currency for locale ${locale}, trying fallback:`, error);
      
      try {
        return new Intl.NumberFormat(fallback, {
          style: 'currency',
          currency,
          ...intlOptions
        }).format(value);
      } catch (fallbackError) {
        console.warn(`Fallback currency formatting failed, using basic format:`, fallbackError);
        return `${currency} ${value.toFixed(2)}`;
      }
    }
  }

  /**
   * Format percentage according to the specified locale
   */
  static formatPercentage(
    value: number,
    options: NumberFormatOptions = {}
  ): string {
    return this.formatNumber(value, {
      style: 'percent',
      ...options
    });
  }

  /**
   * Format a number with compact notation (K, M, B, etc.)
   */
  static formatCompact(
    value: number,
    options: NumberFormatOptions = {}
  ): string {
    return this.formatNumber(value, {
      notation: 'compact',
      compactDisplay: 'short',
      ...options
    });
  }

  /**
   * Format a number with specified decimal places
   */
  static formatDecimal(
    value: number,
    decimalPlaces: number = 2,
    options: NumberFormatOptions = {}
  ): string {
    return this.formatNumber(value, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
      ...options
    });
  }

  /**
   * Parse a localized number string back to a number
   */
  static parseNumber(
    value: string,
    locale: string = this.DEFAULT_LOCALE
  ): number {
    try {
      const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
      const groupSeparator = parts.find(part => part.type === 'group')?.value || ',';
      const decimalSeparator = parts.find(part => part.type === 'decimal')?.value || '.';
      
      const normalizedValue = value
        .replace(new RegExp(`\\${groupSeparator}`, 'g'), '')
        .replace(new RegExp(`\\${decimalSeparator}`), '.');
      
      const parsed = parseFloat(normalizedValue);
      
      if (isNaN(parsed)) {
        throw new Error('Invalid number format');
      }
      
      return parsed;
    } catch (error) {
      console.warn(`Failed to parse number "${value}" for locale ${locale}:`, error);
      return parseFloat(value) || 0;
    }
  }

  /**
   * Get currency symbol for a given currency code
   */
  static getCurrencySymbol(
    currency: string = this.DEFAULT_CURRENCY,
    locale: string = this.DEFAULT_LOCALE
  ): string {
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
      });
      
      const parts = formatter.formatToParts(1);
      const symbolPart = parts.find(part => part.type === 'currency');
      
      return symbolPart?.value || currency;
    } catch (error) {
      console.warn(`Failed to get currency symbol for ${currency}:`, error);
      return currency;
    }
  }

  /**
   * Check if a locale uses RTL formatting for numbers
   */
  static isRTLNumberFormat(locale: string): boolean {
    try {
      const formatter = new Intl.NumberFormat(locale);
      const formatted = formatter.format(123);
      
      // RTL languages often have different number formatting patterns
      // This is a simplified check - in practice, you might want more sophisticated detection
      const rtlLocales = ['ar', 'he', 'fa', 'ur'];
      return rtlLocales.some(rtl => locale.startsWith(rtl));
    } catch {
      return false;
    }
  }
}

// Convenience functions for common use cases
export const formatNumber = (value: number, options?: NumberFormatOptions) =>
  NumberFormatter.formatNumber(value, options);

export const formatCurrency = (value: number, options: CurrencyFormatOptions) =>
  NumberFormatter.formatCurrency(value, options);

export const formatPercentage = (value: number, options?: NumberFormatOptions) =>
  NumberFormatter.formatPercentage(value, options);

export const formatCompact = (value: number, options?: NumberFormatOptions) =>
  NumberFormatter.formatCompact(value, options);

export const parseNumber = (value: string, locale?: string) =>
  NumberFormatter.parseNumber(value, locale);

export const getCurrencySymbol = (currency?: string, locale?: string) =>
  NumberFormatter.getCurrencySymbol(currency, locale);
