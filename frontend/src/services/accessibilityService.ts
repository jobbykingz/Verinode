/**
 * Accessibility Service
 * Central service for managing accessibility features and WCAG 2.2 compliance
 */

export interface AccessibilityPreferences {
  screenReader: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  keyboardNavigation: boolean;
  voiceCommands: boolean;
  focusVisible: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  announcements: boolean;
}

export interface AriaAnnouncement {
  message: string;
  priority: 'polite' | 'assertive' | 'off';
  timeout?: number;
}

class AccessibilityService {
  private preferences: AccessibilityPreferences;
  private observers: MutationObserver[] = [];
  private announcementQueue: AriaAnnouncement[] = [];
  private isProcessingQueue = false;

  constructor() {
    this.preferences = this.loadPreferences();
    this.initializeAccessibility();
    this.setupSystemPreferenceDetection();
  }

  private loadPreferences(): AccessibilityPreferences {
    try {
      const saved = localStorage.getItem('accessibility-preferences');
      if (saved) {
        return { ...this.getDefaultPreferences(), ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load accessibility preferences:', error);
    }
    return this.getDefaultPreferences();
  }

  private getDefaultPreferences(): AccessibilityPreferences {
    return {
      screenReader: false,
      highContrast: false,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      largeText: false,
      keyboardNavigation: true,
      voiceCommands: false,
      focusVisible: true,
      colorBlindMode: 'none',
      fontSize: 'medium',
      announcements: true,
    };
  }

  private setupSystemPreferenceDetection(): void {
    // Detect system preferences for reduced motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', (e) => {
      this.updatePreference('reducedMotion', e.matches);
    });

    // Detect system preferences for high contrast
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    contrastQuery.addEventListener('change', (e) => {
      this.updatePreference('highContrast', e.matches);
    });

    // Detect screen reader usage
    this.detectScreenReader();
  }

  private detectScreenReader(): void {
    // Common screen reader detection techniques
    const isScreenReaderActive = () => {
      // Check for screen reader specific behaviors
      const testElement = document.createElement('div');
      testElement.setAttribute('aria-live', 'polite');
      testElement.style.position = 'absolute';
      testElement.style.left = '-9999px';
      document.body.appendChild(testElement);

      const hasScreenReader = window.speechSynthesis && 
        window.speechSynthesis.getVoices().length > 0;

      document.body.removeChild(testElement);
      return hasScreenReader;
    };

    // Initial detection
    setTimeout(() => {
      this.updatePreference('screenReader', isScreenReaderActive());
    }, 1000);
  }

  private initializeAccessibility(): void {
    this.applyPreferences();
    this.setupFocusManagement();
    this.setupKeyboardNavigation();
    this.setupAriaLiveRegions();
  }

  private applyPreferences(): void {
    const root = document.documentElement;
    
    // Apply CSS classes based on preferences
    root.classList.toggle('high-contrast', this.preferences.highContrast);
    root.classList.toggle('reduced-motion', this.preferences.reducedMotion);
    root.classList.toggle('large-text', this.preferences.largeText);
    root.classList.toggle('focus-visible', this.preferences.focusVisible);
    root.classList.toggle('keyboard-nav', this.preferences.keyboardNavigation);
    
    // Apply font size
    root.setAttribute('data-font-size', this.preferences.fontSize);
    
    // Apply color blind mode
    root.setAttribute('data-color-blind', this.preferences.colorBlindMode);

    // Skip to main content link
    this.createSkipLink();
  }

  private createSkipLink(): void {
    if (document.getElementById('skip-to-main')) return;

    const skipLink = document.createElement('a');
    skipLink.id = 'skip-to-main';
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded';
    
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  private setupFocusManagement(): void {
    // Track focus for better keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });

    // Focus trap for modals
    this.setupFocusTrap();
  }

  private setupFocusTrap(): void {
    const trapFocus = (element: HTMLElement) => {
      const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      };

      element.addEventListener('keydown', handleTabKey);
    };

    // Store for later use with modal components
    (window as any).trapFocus = trapFocus;
  }

  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', (e) => {
      // Alt + A: Accessibility menu
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        this.toggleAccessibilityMenu();
      }

      // Escape: Close modals/menus
      if (e.key === 'Escape') {
        this.handleEscapeKey();
      }
    });
  }

  private setupAriaLiveRegions(): void {
    // Create live regions for announcements
    const createLiveRegion = (politeness: 'polite' | 'assertive' | 'off'): HTMLElement => {
      const region = document.createElement('div');
      region.setAttribute('aria-live', politeness);
      region.setAttribute('aria-atomic', 'true');
      region.className = 'sr-only';
      region.id = `aria-live-${politeness}`;
      document.body.appendChild(region);
      return region;
    };

    if (!document.getElementById('aria-live-polite')) {
      createLiveRegion('polite');
    }
    if (!document.getElementById('aria-live-assertive')) {
      createLiveRegion('assertive');
    }
  }

  private handleEscapeKey(): void {
    // Close any open modals or menus
    const modals = document.querySelectorAll('[role="dialog"][aria-hidden="false"]');
    modals.forEach(modal => {
      (modal as HTMLElement).setAttribute('aria-hidden', 'true');
    });
  }

  private toggleAccessibilityMenu(): void {
    // Implementation for accessibility menu toggle
    const event = new CustomEvent('toggleAccessibilityMenu');
    document.dispatchEvent(event);
  }

  // Public API methods
  public updatePreference<K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K]
  ): void {
    this.preferences[key] = value;
    this.savePreferences();
    this.applyPreferences();
    
    // Emit change event
    const event = new CustomEvent('accessibilityPreferenceChanged', {
      detail: { key, value }
    });
    document.dispatchEvent(event);
  }

  public getPreference<K extends keyof AccessibilityPreferences>(
    key: K
  ): AccessibilityPreferences[K] {
    return this.preferences[key];
  }

  public getAllPreferences(): AccessibilityPreferences {
    return { ...this.preferences };
  }

  private savePreferences(): void {
    try {
      localStorage.setItem('accessibility-preferences', JSON.stringify(this.preferences));
    } catch (error) {
      console.warn('Failed to save accessibility preferences:', error);
    }
  }

  public announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.preferences.announcements) return;

    const announcement: AriaAnnouncement = {
      message,
      priority,
      timeout: 5000
    };

    this.announcementQueue.push(announcement);
    this.processAnnouncementQueue();
  }

  private processAnnouncementQueue(): void {
    if (this.isProcessingQueue || this.announcementQueue.length === 0) return;

    this.isProcessingQueue = true;
    const announcement = this.announcementQueue.shift()!;

    const liveRegion = document.getElementById(`aria-live-${announcement.priority}`);
    if (liveRegion) {
      liveRegion.textContent = announcement.message;
      
      setTimeout(() => {
        liveRegion.textContent = '';
        this.isProcessingQueue = false;
        this.processAnnouncementQueue();
      }, announcement.timeout || 3000);
    } else {
      this.isProcessingQueue = false;
      this.processAnnouncementQueue();
    }
  }

  public validateWCAGCompliance(): {
    level: 'A' | 'AA' | 'AAA';
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 100;

    // Check for alt text on images
    const images = document.querySelectorAll('img:not([alt])');
    if (images.length > 0) {
      issues.push(`${images.length} images missing alt text`);
      score -= images.length * 5;
    }

    // Check for proper heading structure
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    headings.forEach((heading, index) => {
      const currentLevel = parseInt(heading.tagName.charAt(1));
      if (index === 0 && currentLevel !== 1) {
        issues.push('Page should start with h1 heading');
        score -= 10;
      }
      if (currentLevel > lastLevel + 1) {
        issues.push('Heading levels should not be skipped');
        score -= 5;
      }
      lastLevel = currentLevel;
    });

    // Check for form labels
    const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
    const labels = document.querySelectorAll('label');
    if (inputs.length > labels.length) {
      issues.push('Some form inputs may be missing labels');
      score -= 10;
    }

    // Check color contrast (simplified)
    const textElements = document.querySelectorAll('body *');
    // This would need a more sophisticated implementation in production
    // For now, just check if high contrast is enabled when needed
    if (this.preferences.highContrast && !document.documentElement.classList.contains('high-contrast')) {
      issues.push('High contrast mode not properly applied');
      score -= 15;
    }

    let level: 'A' | 'AA' | 'AAA' = 'AAA';
    if (score < 80) level = 'A';
    else if (score < 90) level = 'AA';

    return { level, issues, score };
  }

  public generateAccessibilityReport(): {
    timestamp: string;
    preferences: AccessibilityPreferences;
    compliance: ReturnType<typeof this.validateWCAGCompliance>;
    recommendations: string[];
  } {
    const compliance = this.validateWCAGCompliance();
    const recommendations: string[] = [];

    if (compliance.issues.length > 0) {
      recommendations.push('Fix WCAG compliance issues for better accessibility');
    }

    if (!this.preferences.keyboardNavigation) {
      recommendations.push('Enable keyboard navigation for better usability');
    }

    if (!this.preferences.focusVisible) {
      recommendations.push('Enable focus indicators for keyboard users');
    }

    return {
      timestamp: new Date().toISOString(),
      preferences: this.preferences,
      compliance,
      recommendations
    };
  }

  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Singleton instance
export const accessibilityService = new AccessibilityService();
export default accessibilityService;
