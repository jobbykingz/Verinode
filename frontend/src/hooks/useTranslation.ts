import { useTranslation as useReactTranslation } from 'react-i18next';
import { useCallback } from 'react';

export const useTranslation = () => {
  const { t, i18n, ...rest } = useReactTranslation();

  const translateWithFallback = useCallback((key: string, options?: any) => {
    const translation = t(key, options);
    
    // Check if the translation is missing (returns the key itself)
    if (translation === key && i18n.exists(key) === false) {
      console.warn(`Translation missing for key: ${key} in language: ${i18n.language}`);
      // Try to get the fallback language translation
      const fallbackTranslation = t(key, { ...options, lng: 'en' });
      return fallbackTranslation !== key ? fallbackTranslation : translation;
    }
    
    return translation;
  }, [t, i18n]);

  const changeLanguage = useCallback(async (language: string) => {
    try {
      await i18n.changeLanguage(language);
      
      // Store user preference
      localStorage.setItem('i18nextLng', language);
      
      // Update document attributes for accessibility and SEO
      document.documentElement.lang = language;
      
      // Handle RTL languages
      const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
      const isRTL = rtlLanguages.includes(language);
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      
      return true;
    } catch (error) {
      console.error('Failed to change language:', error);
      return false;
    }
  }, [i18n]);

  const getCurrentLanguage = useCallback(() => {
    return i18n.language;
  }, [i18n]);

  const getSupportedLanguages = useCallback(() => {
    return ['en', 'es', 'fr', 'zh'];
  }, []);

  const isRTL = useCallback(() => {
    const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    return rtlLanguages.includes(i18n.language);
  }, [i18n]);

  const formatNumber = useCallback((number: number, options?: Intl.NumberFormatOptions) => {
    try {
      return new Intl.NumberFormat(i18n.language, options).format(number);
    } catch (error) {
      console.warn('Number formatting failed, using fallback:', error);
      return number.toString();
    }
  }, [i18n.language]);

  const formatCurrency = useCallback((amount: number, currency: string = 'USD') => {
    try {
      return new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: currency
      }).format(amount);
    } catch (error) {
      console.warn('Currency formatting failed, using fallback:', error);
      return `${currency} ${amount.toFixed(2)}`;
    }
  }, [i18n.language]);

  const formatDate = useCallback((date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
      };
      return new Intl.DateTimeFormat(i18n.language, defaultOptions).format(dateObj);
    } catch (error) {
      console.warn('Date formatting failed, using fallback:', error);
      return date.toString();
    }
  }, [i18n.language]);

  const formatRelativeTime = useCallback((value: number, unit: Intl.RelativeTimeFormatUnit) => {
    try {
      const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
      return rtf.format(value, unit);
    } catch (error) {
      console.warn('Relative time formatting failed, using fallback:', error);
      return `${value} ${unit}`;
    }
  }, [i18n.language]);

  return {
    t: translateWithFallback,
    i18n,
    changeLanguage,
    getCurrentLanguage,
    getSupportedLanguages,
    isRTL,
    formatNumber,
    formatCurrency,
    formatDate,
    formatRelativeTime,
    ...rest
  };
};

export default useTranslation;
