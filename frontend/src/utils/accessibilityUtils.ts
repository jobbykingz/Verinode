/**
 * Accessibility Utilities
 * Helper functions for accessibility features and WCAG 2.2 compliance
 */

import { accessibilityService } from '../services/accessibilityService';

// Type definitions for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// Color contrast ratios
export const CONTRAST_RATIOS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
} as const;

// Focus management utilities
export class FocusManager {
  private static focusHistory: HTMLElement[] = [];
  private static trapStack: HTMLElement[] = [];

  static saveFocus(): void {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      this.focusHistory.push(activeElement);
    }
  }

  static restoreFocus(): void {
    const lastFocused = this.focusHistory.pop();
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  static trapFocus(element: HTMLElement): () => void {
    this.trapStack.push(element);
    
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    ) as NodeListOf<HTMLElement>;
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    
    // Focus first element
    firstFocusable?.focus();

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
      this.trapStack = this.trapStack.filter(el => el !== element);
    };
  }

  static getCurrentTrap(): HTMLElement | null {
    return this.trapStack[this.trapStack.length - 1] || null;
  }
}

// ARIA utilities
export class AriaUtils {
  static setAriaAttributes(element: HTMLElement, attributes: Record<string, string>): void {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, value);
      }
    });
  }

  static announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    accessibilityService.announce(message, priority);
  }

  static generateUniqueId(prefix = 'aria'): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static setupLabelRelationships(): void {
    // Auto-associate labels with form inputs
    const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
    
    inputs.forEach(input => {
      const id = input.id || this.generateUniqueId('input');
      input.id = id;

      // Look for label with matching "for" attribute
      const label = document.querySelector(`label[for="${id}"]`);
      if (!label) {
        // Look for preceding label
        const previousLabel = input.previousElementSibling;
        if (previousLabel?.tagName === 'LABEL') {
          previousLabel.setAttribute('for', id);
        }
      }
    });
  }
}

// Color contrast utilities
export class ColorContrast {
  static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  static getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  static getContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return 0;

    const lum1 = this.getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = this.getLuminance(rgb2.r, rgb2.g, rgb2.b);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }

  static meetsWCAG(foreground: string, background: string, level: 'AA' | 'AAA' = 'AA', large = false): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    const requiredRatio = large ? 
      (level === 'AA' ? CONTRAST_RATIOS.AA_LARGE : CONTRAST_RATIOS.AAA_LARGE) :
      (level === 'AA' ? CONTRAST_RATIOS.AA_NORMAL : CONTRAST_RATIOS.AAA_NORMAL);
    
    return ratio >= requiredRatio;
  }
}

// Keyboard navigation utilities
export class KeyboardNavigation {
  private static keyMap: Record<string, string> = {
    'Enter': 'activate',
    ' ': 'activate',
    'Escape': 'cancel',
    'ArrowUp': 'previous',
    'ArrowDown': 'next',
    'ArrowLeft': 'previous',
    'ArrowRight': 'next',
    'Home': 'first',
    'End': 'last',
    'PageUp': 'previousPage',
    'PageDown': 'nextPage',
    'Tab': 'nextFocus',
  };

  static getKeyAction(key: string): string {
    return this.keyMap[key] || key;
  }

  static setupMenuNavigation(menuElement: HTMLElement): void {
    const menuItems = menuElement.querySelectorAll('[role="menuitem"], [role="option"]') as NodeListOf<HTMLElement>;
    let currentIndex = -1;

    const handleKeyDown = (e: KeyboardEvent) => {
      const action = this.getKeyAction(e.key);
      
      switch (action) {
        case 'next':
          e.preventDefault();
          currentIndex = (currentIndex + 1) % menuItems.length;
          menuItems[currentIndex]?.focus();
          break;
          
        case 'previous':
          e.preventDefault();
          currentIndex = currentIndex <= 0 ? menuItems.length - 1 : currentIndex - 1;
          menuItems[currentIndex]?.focus();
          break;
          
        case 'first':
          e.preventDefault();
          currentIndex = 0;
          menuItems[currentIndex]?.focus();
          break;
          
        case 'last':
          e.preventDefault();
          currentIndex = menuItems.length - 1;
          menuItems[currentIndex]?.focus();
          break;
          
        case 'activate':
          e.preventDefault();
          menuItems[currentIndex]?.click();
          break;
          
        case 'cancel':
          e.preventDefault();
          menuElement.setAttribute('aria-hidden', 'true');
          menuElement.dispatchEvent(new CustomEvent('menuClose'));
          break;
      }
    };

    menuElement.addEventListener('keydown', handleKeyDown);
  }

  static createKeyboardShortcut(key: string, callback: () => void, description: string): void {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === key && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKey);
    
    // Store for cleanup
    if (!(window as any).keyboardShortcuts) {
      (window as any).keyboardShortcuts = [];
    }
    (window as any).keyboardShortcuts.push({ key, callback, handleKey, description });
  }
}

// Screen reader utilities
export class ScreenReaderUtils {
  static isScreenReaderActive(): boolean {
    // Multiple detection methods for better accuracy
    const hasSpeechSynthesis = 'speechSynthesis' in window;
    const hasAriaLive = document.querySelector('[aria-live]') !== null;
    
    // Check for common screen reader browser extensions
    const userAgent = navigator.userAgent.toLowerCase();
    const hasScreenReaderExtension = 
      userAgent.includes('nvda') || 
      userAgent.includes('jaws') || 
      userAgent.includes('voiceover');
    
    return hasSpeechSynthesis || hasAriaLive || hasScreenReaderExtension;
  }

  static speakText(text: string, options: {
    rate?: number;
    pitch?: number;
    volume?: number;
    lang?: string;
  } = {}): void {
    if (!('speechSynthesis' in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;
    utterance.lang = options.lang ?? 'en-US';

    window.speechSynthesis.speak(utterance);
  }

  static createLiveRegion(politeness: 'polite' | 'assertive' | 'off' = 'polite'): HTMLElement {
    const region = document.createElement('div');
    region.setAttribute('aria-live', politeness);
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    region.style.position = 'absolute';
    region.style.left = '-10000px';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';
    
    document.body.appendChild(region);
    return region;
  }
}

// Validation utilities
export class AccessibilityValidator {
  static validateImageAltText(): string[] {
    const issues: string[] = [];
    const images = document.querySelectorAll('img');
    
    images.forEach((img, index) => {
      if (!img.hasAttribute('alt')) {
        issues.push(`Image ${index + 1}: Missing alt attribute`);
      } else if (img.alt === '' && !img.hasAttribute('role') && img.getAttribute('role') !== 'presentation') {
        issues.push(`Image ${index + 1}: Empty alt text but not marked as presentation`);
      }
    });
    
    return issues;
  }

  static validateHeadingStructure(): string[] {
    const issues: string[] = [];
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    
    headings.forEach((heading, index) => {
      const currentLevel = parseInt(heading.tagName.charAt(1));
      
      if (index === 0 && currentLevel !== 1) {
        issues.push('Page should start with h1 heading');
      }
      
      if (currentLevel > lastLevel + 1) {
        issues.push(`Heading level skipped: h${lastLevel} to h${currentLevel}`);
      }
      
      if (heading.textContent?.trim() === '') {
        issues.push(`Empty ${heading.tagName.toLowerCase()} heading found`);
      }
      
      lastLevel = currentLevel;
    });
    
    return issues;
  }

  static validateFormLabels(): string[] {
    const issues: string[] = [];
    const inputs = document.querySelectorAll('input, select, textarea');
    
    inputs.forEach((input, index) => {
      const hasLabel = input.hasAttribute('aria-label') || 
                      input.hasAttribute('aria-labelledby') ||
                      document.querySelector(`label[for="${input.id}"]`) ||
                      input.closest('label');
      
      if (!hasLabel) {
        issues.push(`Form input ${index + 1}: Missing label or aria-label`);
      }
    });
    
    return issues;
  }

  static validateFocusManagement(): string[] {
    const issues: string[] = [];
    
    // Check for tabindex abuse
    const elementsWithTabindex = document.querySelectorAll('[tabindex]');
    elementsWithTabindex.forEach(element => {
      const tabindex = element.getAttribute('tabindex');
      if (tabindex && parseInt(tabindex) > 0) {
        issues.push(`Element with positive tabindex: ${element.tagName.toLowerCase()}`);
      }
    });
    
    // Check for focusable elements with disabled state
    const disabledFocusable = document.querySelectorAll('button:disabled, input:disabled, select:disabled');
    disabledFocusable.forEach(element => {
      if (element.getAttribute('tabindex') !== '-1') {
        issues.push(`Disabled focusable element should have tabindex="-1": ${element.tagName.toLowerCase()}`);
      }
    });
    
    return issues;
  }

  static runFullValidation(): {
    images: string[];
    headings: string[];
    forms: string[];
    focus: string[];
    total: number;
  } {
    return {
      images: this.validateImageAltText(),
      headings: this.validateHeadingStructure(),
      forms: this.validateFormLabels(),
      focus: this.validateFocusManagement(),
      total: 0 // Will be calculated
    };
  }
}

// Voice command utilities
export class VoiceCommandUtils {
  private static recognition: SpeechRecognition | null = null;
  private static isListening = false;

  static initializeVoiceCommands(commands: Record<string, () => void>): boolean {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      
      // Find matching command
      const matchedCommand = Object.keys(commands).find(cmd => 
        command.includes(cmd.toLowerCase())
      );
      
      if (matchedCommand) {
        commands[matchedCommand]();
        AriaUtils.announceToScreenReader(`Command executed: ${matchedCommand}`);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        AriaUtils.announceToScreenReader('Microphone access denied');
      }
    };

    return true;
  }

  static startListening(): void {
    if (this.recognition && !this.isListening) {
      this.recognition.start();
      this.isListening = true;
      AriaUtils.announceToScreenReader('Voice commands activated');
    }
  }

  static stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      AriaUtils.announceToScreenReader('Voice commands deactivated');
    }
  }

  static toggleListening(): void {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  static isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }
}

