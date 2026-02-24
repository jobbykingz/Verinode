export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  locale?: string;
  fallback?: string;
}

export interface RelativeTimeOptions {
  locale?: string;
  fallback?: string;
  numeric?: 'auto' | 'always';
  style?: 'long' | 'short' | 'narrow';
}

export class DateFormatter {
  private static DEFAULT_LOCALE = 'en-US';

  /**
   * Format a date according to the specified locale
   */
  static formatDate(
    date: Date | string | number,
    options: DateFormatOptions = {}
  ): string {
    const {
      locale = this.DEFAULT_LOCALE,
      fallback = this.DEFAULT_LOCALE,
      ...intlOptions
    } = options;

    const dateObj = this.toDate(date);

    try {
      return new Intl.DateTimeFormat(locale, intlOptions).format(dateObj);
    } catch (error) {
      console.warn(`Failed to format date for locale ${locale}, trying fallback:`, error);
      
      try {
        return new Intl.DateTimeFormat(fallback, intlOptions).format(dateObj);
      } catch (fallbackError) {
        console.warn(`Fallback date formatting failed, using ISO format:`, fallbackError);
        return dateObj.toISOString();
      }
    }
  }

  /**
   * Format date with time
   */
  static formatDateTime(
    date: Date | string | number,
    options: DateFormatOptions = {}
  ): string {
    return this.formatDate(date, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    });
  }

  /**
   * Format date with short format
   */
  static formatShortDate(
    date: Date | string | number,
    options: DateFormatOptions = {}
  ): string {
    return this.formatDate(date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...options
    });
  }

  /**
   * Format time only
   */
  static formatTime(
    date: Date | string | number,
    options: DateFormatOptions = {}
  ): string {
    return this.formatDate(date, {
      hour: '2-digit',
      minute: '2-digit',
      ...options
    });
  }

  /**
   * Format relative time (e.g., "2 hours ago", "in 3 days")
   */
  static formatRelativeTime(
    date: Date | string | number,
    options: RelativeTimeOptions = {}
  ): string {
    const {
      locale = this.DEFAULT_LOCALE,
      fallback = this.DEFAULT_LOCALE,
      numeric = 'auto',
      style = 'long'
    } = options;

    const dateObj = this.toDate(date);
    const now = new Date();
    const diffInSeconds = (dateObj.getTime() - now.getTime()) / 1000;

    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric, style });
      
      // Determine the appropriate unit and value
      const absDiff = Math.abs(diffInSeconds);
      
      if (absDiff < 60) {
        return rtf.format(Math.round(diffInSeconds), 'second');
      } else if (absDiff < 3600) {
        return rtf.format(Math.round(diffInSeconds / 60), 'minute');
      } else if (absDiff < 86400) {
        return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
      } else if (absDiff < 2592000) {
        return rtf.format(Math.round(diffInSeconds / 86400), 'day');
      } else if (absDiff < 31536000) {
        return rtf.format(Math.round(diffInSeconds / 2592000), 'month');
      } else {
        return rtf.format(Math.round(diffInSeconds / 31536000), 'year');
      }
    } catch (error) {
      console.warn(`Failed to format relative time for locale ${locale}, trying fallback:`, error);
      
      try {
        const rtf = new Intl.RelativeTimeFormat(fallback, { numeric, style });
        return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
      } catch (fallbackError) {
        console.warn(`Fallback relative time formatting failed, using absolute date:`, fallbackError);
        return this.formatDate(dateObj, { locale: fallback });
      }
    }
  }

  /**
   * Format date range
   */
  static formatDateRange(
    startDate: Date | string | number,
    endDate: Date | string | number,
    options: DateFormatOptions = {}
  ): string {
    const {
      locale = this.DEFAULT_LOCALE,
      fallback = this.DEFAULT_LOCALE,
      ...intlOptions
    } = options;

    const start = this.toDate(startDate);
    const end = this.toDate(endDate);

    try {
      return new Intl.DateTimeFormat(locale, intlOptions).formatRange(start, end);
    } catch (error) {
      console.warn(`Failed to format date range for locale ${locale}, trying fallback:`, error);
      
      try {
        return new Intl.DateTimeFormat(fallback, intlOptions).formatRange(start, end);
      } catch (fallbackError) {
        console.warn(`Fallback date range formatting failed, using separate dates:`, fallbackError);
        return `${this.formatDate(start, { locale: fallback, ...intlOptions })} - ${this.formatDate(end, { locale: fallback, ...intlOptions })}`;
      }
    }
  }

  /**
   * Get localized date parts
   */
  static getDateParts(
    date: Date | string | number,
    locale: string = this.DEFAULT_LOCALE
  ): {
    weekday?: string;
    era?: string;
    year?: string;
    month?: string;
    day?: string;
    hour?: string;
    minute?: string;
    second?: string;
    timeZoneName?: string;
  } {
    const dateObj = this.toDate(date);
    
    try {
      const formatter = new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        era: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'long'
      });
      
      const parts = formatter.formatToParts(dateObj);
      const result: any = {};
      
      parts.forEach(part => {
        if (part.type !== 'literal') {
          result[part.type] = part.value;
        }
      });
      
      return result;
    } catch (error) {
      console.warn(`Failed to get date parts for locale ${locale}:`, error);
      return {};
    }
  }

  /**
   * Check if a locale uses RTL date formatting
   */
  static isRTLDateFormat(locale: string): boolean {
    try {
      const rtlLocales = ['ar', 'he', 'fa', 'ur'];
      return rtlLocales.some(rtl => locale.startsWith(rtl));
    } catch {
      return false;
    }
  }

  /**
   * Convert various date inputs to Date object
   */
  private static toDate(date: Date | string | number): Date {
    if (date instanceof Date) {
      return date;
    }
    
    if (typeof date === 'string') {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        throw new Error(`Invalid date string: ${date}`);
      }
      return parsed;
    }
    
    if (typeof date === 'number') {
      return new Date(date);
    }
    
    throw new Error(`Unsupported date type: ${typeof date}`);
  }

  /**
   * Get calendar type for locale (e.g., gregory, islamic, etc.)
   */
  static getCalendarType(locale: string = this.DEFAULT_LOCALE): string {
    try {
      const formatter = new Intl.DateTimeFormat(locale, { calendar: 'auto' });
      const resolved = formatter.resolvedOptions();
      return resolved.calendar || 'gregory';
    } catch (error) {
      console.warn(`Failed to get calendar type for locale ${locale}:`, error);
      return 'gregory';
    }
  }

  /**
   * Get time zone for locale
   */
  static getTimeZone(locale: string = this.DEFAULT_LOCALE): string {
    try {
      const formatter = new Intl.DateTimeFormat(locale);
      const resolved = formatter.resolvedOptions();
      return resolved.timeZone || 'UTC';
    } catch (error) {
      console.warn(`Failed to get time zone for locale ${locale}:`, error);
      return 'UTC';
    }
  }
}

// Convenience functions for common use cases
export const formatDate = (date: Date | string | number, options?: DateFormatOptions) =>
  DateFormatter.formatDate(date, options);

export const formatDateTime = (date: Date | string | number, options?: DateFormatOptions) =>
  DateFormatter.formatDateTime(date, options);

export const formatShortDate = (date: Date | string | number, options?: DateFormatOptions) =>
  DateFormatter.formatShortDate(date, options);

export const formatTime = (date: Date | string | number, options?: DateFormatOptions) =>
  DateFormatter.formatTime(date, options);

export const formatRelativeTime = (date: Date | string | number, options?: RelativeTimeOptions) =>
  DateFormatter.formatRelativeTime(date, options);

export const formatDateRange = (startDate: Date | string | number, endDate: Date | string | number, options?: DateFormatOptions) =>
  DateFormatter.formatDateRange(startDate, endDate, options);

export const getDateParts = (date: Date | string | number, locale?: string) =>
  DateFormatter.getDateParts(date, locale);
