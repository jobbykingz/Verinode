/**
 * useAccessibility Hook
 * React hook for managing accessibility features and preferences
 */

import { useState, useEffect, useCallback } from 'react';
import { accessibilityService, AccessibilityPreferences } from '../services/accessibilityService';
import { 
  FocusManager, 
  AriaUtils, 
  ScreenReaderUtils, 
  VoiceCommandUtils,
  AccessibilityValidator 
} from '../utils/accessibilityUtils';

interface CustomEvent<T = any> extends Event {
  detail: T;
}

export interface UseAccessibilityReturn {
  // Preferences
  preferences: AccessibilityPreferences;
  updatePreference: <K extends keyof AccessibilityPreferences>(
    key: K, 
    value: AccessibilityPreferences[K]
  ) => void;
  
  // Screen reader
  isScreenReaderActive: boolean;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  
  // Focus management
  saveFocus: () => void;
  restoreFocus: () => void;
  trapFocus: (element: HTMLElement) => () => void;
  
  // Voice commands
  isVoiceSupported: boolean;
  isVoiceListening: boolean;
  startVoiceCommands: (commands: Record<string, () => void>) => boolean;
  toggleVoiceListening: () => void;
  
  // Validation
  validateAccessibility: () => ReturnType<typeof AccessibilityValidator.runFullValidation>;
  getComplianceReport: () => ReturnType<typeof accessibilityService.generateAccessibilityReport>;
  
  // Utilities
  generateId: (prefix?: string) => string;
  setupAriaAttributes: (element: HTMLElement, attributes: Record<string, string>) => void;
}

export const useAccessibility = (): UseAccessibilityReturn => {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(
    accessibilityService.getAllPreferences()
  );
  const [isScreenReaderActive, setIsScreenReaderActive] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  // Listen for preference changes
  useEffect(() => {
    const handlePreferenceChange = (event: Event) => {
      const customEvent = event as CustomEvent<{key: string; value: any}>;
      const { key, value } = customEvent.detail;
      setPreferences((prev: AccessibilityPreferences) => ({ ...prev, [key]: value }));
    };

    document.addEventListener('accessibilityPreferenceChanged', handlePreferenceChange as EventListener);
    
    return () => {
      document.removeEventListener('accessibilityPreferenceChanged', handlePreferenceChange as EventListener);
    };
  }, []);

  // Detect screen reader on mount and periodically
  useEffect(() => {
    const checkScreenReader = () => {
      setIsScreenReaderActive(ScreenReaderUtils.isScreenReaderActive());
    };

    checkScreenReader();
    const interval = setInterval(checkScreenReader, 5000);

    return () => clearInterval(interval);
  }, []);

  // Update preference
  const updatePreference = useCallback(<K extends keyof AccessibilityPreferences>(
    key: K, 
    value: AccessibilityPreferences[K]
  ) => {
    accessibilityService.updatePreference(key, value);
  }, []);

  // Screen reader announcements
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    AriaUtils.announceToScreenReader(message, priority);
  }, []);

  // Focus management
  const saveFocus = useCallback(() => {
    FocusManager.saveFocus();
  }, []);

  const restoreFocus = useCallback(() => {
    FocusManager.restoreFocus();
  }, []);

  const trapFocus = useCallback((element: HTMLElement) => {
    return FocusManager.trapFocus(element);
  }, []);

  // Voice commands
  const isVoiceSupported = VoiceCommandUtils.isSupported();

  const startVoiceCommands = useCallback((commands: Record<string, () => void>) => {
    return VoiceCommandUtils.initializeVoiceCommands(commands);
  }, []);

  const toggleVoiceListening = useCallback(() => {
    VoiceCommandUtils.toggleListening();
    setIsVoiceListening((prev: boolean) => !prev);
  }, []);

  // Validation
  const validateAccessibility = useCallback(() => {
    return AccessibilityValidator.runFullValidation();
  }, []);

  const getComplianceReport = useCallback(() => {
    return accessibilityService.generateAccessibilityReport();
  }, []);

  // Utilities
  const generateId = useCallback((prefix = 'accessible') => {
    return AriaUtils.generateUniqueId(prefix);
  }, []);

  const setupAriaAttributes = useCallback((element: HTMLElement, attributes: Record<string, string>) => {
    AriaUtils.setAriaAttributes(element, attributes);
  }, []);

  // Auto-setup ARIA relationships
  useEffect(() => {
    AriaUtils.setupLabelRelationships();
  }, []);

  return {
    preferences,
    updatePreference,
    isScreenReaderActive,
    announce,
    saveFocus,
    restoreFocus,
    trapFocus,
    isVoiceSupported,
    isVoiceListening,
    startVoiceCommands,
    toggleVoiceListening,
    validateAccessibility,
    getComplianceReport,
    generateId,
    setupAriaAttributes,
  };
};

export default useAccessibility;
