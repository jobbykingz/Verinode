/**
 * KeyboardNavigation Component
 * Provides comprehensive keyboard navigation support and shortcuts
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';
import { KeyboardNavigation as KeyboardNavUtils, FocusManager } from '../../utils/accessibilityUtils';

interface KeyboardNavigationProps {
  children?: React.ReactNode;
  className?: string;
  enableShortcuts?: boolean;
  customShortcuts?: Record<string, { description: string; action: () => void }>;
  showHelp?: boolean;
}

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
  category: string;
}

export const KeyboardNavigation: React.FC<KeyboardNavigationProps> = ({
  children,
  className = '',
  enableShortcuts = true,
  customShortcuts = {},
  showHelp = false
}) => {
  const { preferences, updatePreference, announce } = useAccessibility();
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [currentFocus, setCurrentFocus] = useState<HTMLElement | null>(null);
  const shortcutsRef = useRef<Map<string, Shortcut>>(new Map());
  const helpButtonRef = useRef<HTMLButtonElement>(null);

  // Default keyboard shortcuts
  const defaultShortcuts: Record<string, { description: string; action: () => void; category: string }> = {
    'Alt+H': {
      description: 'Show keyboard shortcuts help',
      action: () => setIsHelpVisible(prev => !prev),
      category: 'Navigation'
    },
    'Alt+S': {
      description: 'Skip to main content',
      action: () => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
          mainContent.focus();
          announce('Skipped to main content');
        }
      },
      category: 'Navigation'
    },
    'Alt+N': {
      description: 'Go to navigation',
      action: () => {
        const nav = document.querySelector('nav');
        if (nav) {
          const firstFocusable = nav.querySelectorAll('button, [href], input, select, textarea')[0] as HTMLElement;
          firstFocusable?.focus();
          announce('Focused on navigation');
        }
      },
      category: 'Navigation'
    },
    'Alt+F': {
      description: 'Go to search',
      action: () => {
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          announce('Focused on search');
        }
      },
      category: 'Navigation'
    },
    'Alt+A': {
      description: 'Toggle accessibility menu',
      action: () => {
        const event = new CustomEvent('toggleAccessibilityMenu');
        document.dispatchEvent(event);
        announce('Accessibility menu toggled');
      },
      category: 'Accessibility'
    },
    'Alt+C': {
      description: 'Toggle high contrast',
      action: () => {
        updatePreference('highContrast', !preferences.highContrast);
        announce(`High contrast ${!preferences.highContrast ? 'enabled' : 'disabled'}`);
      },
      category: 'Accessibility'
    },
    'Alt+M': {
      description: 'Toggle reduced motion',
      action: () => {
        updatePreference('reducedMotion', !preferences.reducedMotion);
        announce(`Reduced motion ${!preferences.reducedMotion ? 'enabled' : 'disabled'}`);
      },
      category: 'Accessibility'
    },
    'Alt+L': {
      description: 'Toggle large text',
      action: () => {
        updatePreference('largeText', !preferences.largeText);
        announce(`Large text ${!preferences.largeText ? 'enabled' : 'disabled'}`);
      },
      category: 'Accessibility'
    },
    'Escape': {
      description: 'Close dialogs or cancel actions',
      action: () => {
        // Close any open modals
        const modals = document.querySelectorAll('[role="dialog"][aria-hidden="false"]');
        modals.forEach(modal => {
          (modal as HTMLElement).setAttribute('aria-hidden', 'true');
        });
        
        // Restore focus
        FocusManager.restoreFocus();
        announce('Dialog closed');
      },
      category: 'General'
    },
    'Tab': {
      description: 'Navigate to next focusable element',
      action: () => {
        // Handled by browser default
        announce('Tab navigation');
      },
      category: 'Navigation'
    },
    'Shift+Tab': {
      description: 'Navigate to previous focusable element',
      action: () => {
        // Handled by browser default
        announce('Shift+Tab navigation');
      },
      category: 'Navigation'
    }
  };

  // Initialize shortcuts
  useEffect(() => {
    if (!enableShortcuts) return;

    // Combine default and custom shortcuts
    const allShortcuts = { ...defaultShortcuts, ...customShortcuts };
    
    // Clear existing shortcuts
    shortcutsRef.current.clear();

    // Register shortcuts
    Object.entries(allShortcuts).forEach(([keyCombo, config]) => {
      const shortcut: Shortcut = {
        key: keyCombo,
        description: config.description,
        action: config.action,
        category: (config as any).category || 'Custom'
      };
      shortcutsRef.current.set(keyCombo, shortcut);
    });

    // Setup keyboard event listener
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        // Allow Escape key even in inputs
        if (event.key !== 'Escape') return;
      }

      // Build key combination string
      const parts: string[] = [];
      if (event.altKey) parts.push('Alt');
      if (event.ctrlKey) parts.push('Ctrl');
      if (event.shiftKey) parts.push('Shift');
      if (event.metaKey) parts.push('Meta');
      
      let key = event.key;
      if (key === ' ') key = 'Space';
      parts.push(key);

      const keyCombo = parts.join('+');
      const shortcut = shortcutsRef.current.get(keyCombo);

      if (shortcut) {
        event.preventDefault();
        shortcut.action();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableShortcuts, customShortcuts, preferences, updatePreference, announce]);

  // Track current focus for debugging
  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      setCurrentFocus(event.target as HTMLElement);
    };

    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  // Setup focus indicators
  useEffect(() => {
    if (!preferences.keyboardNavigation) return;

    // Add focus-visible styles
    const style = document.createElement('style');
    style.textContent = `
      .keyboard-nav *:focus {
        outline: 2px solid #0066cc !important;
        outline-offset: 2px !important;
      }
      
      .keyboard-nav *:focus:not(:focus-visible) {
        outline: none !important;
      }
      
      .keyboard-nav *:focus-visible {
        outline: 2px solid #0066cc !important;
        outline-offset: 2px !important;
      }
      
      .sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      
      .focus\\:not-sr-only:focus {
        position: static !important;
        width: auto !important;
        height: auto !important;
        padding: inherit !important;
        margin: inherit !important;
        overflow: visible !important;
        clip: auto !important;
        white-space: normal !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [preferences.keyboardNavigation]);

  // Categorize shortcuts for help display
  const getShortcutsByCategory = useCallback(() => {
    const categories: Record<string, Shortcut[]> = {};
    
    shortcutsRef.current.forEach(shortcut => {
      if (!categories[shortcut.category]) {
        categories[shortcut.category] = [];
      }
      categories[shortcut.category].push(shortcut);
    });

    return categories;
  }, []);

  const shortcutsByCategory = getShortcutsByCategory();

  return (
    <div className={`keyboard-navigation ${className}`} role="region" aria-label="Keyboard navigation">
      {/* Keyboard navigation status */}
      <div className="sr-only" aria-live="polite">
        Keyboard navigation is {preferences.keyboardNavigation ? 'enabled' : 'disabled'}
      </div>

      {/* Help button */}
      {(showHelp || enableShortcuts) && (
        <button
          ref={helpButtonRef}
          onClick={() => setIsHelpVisible(true)}
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 
                   focus:bg-white focus:border-2 focus:border-blue-600 focus:rounded-lg 
                   focus:p-4 focus:shadow-lg"
          aria-label="Show keyboard shortcuts help"
        >
          Keyboard Shortcuts (Alt+H)
        </button>
      )}

      {/* Keyboard shortcuts help modal */}
      {isHelpVisible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="keyboard-help-title"
        >
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <h2 id="keyboard-help-title" className="text-2xl font-bold mb-4">
              Keyboard Shortcuts
            </h2>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Use these keyboard shortcuts to navigate the application more efficiently.
              </p>
              <p className="text-sm text-gray-500">
                Press <kbd className="px-2 py-1 bg-gray-100 rounded">Escape</kbd> to close this help.
              </p>
            </div>

            {Object.entries(shortcutsByCategory).map(([category, shortcuts]) => (
              <div key={category} className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">{category}</h3>
                <div className="space-y-2">
                  {shortcuts.map(shortcut => (
                    <div key={shortcut.key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <kbd className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-mono">
                        {shortcut.key}
                      </kbd>
                      <span className="text-gray-700">{shortcut.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsHelpVisible(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Focus indicator for development */}
      {process.env.NODE_ENV === 'development' && currentFocus && (
        <div className="sr-only" aria-live="polite">
          Currently focused: {currentFocus.tagName.toLowerCase()} 
          {currentFocus.getAttribute('aria-label') && ` - ${currentFocus.getAttribute('aria-label')}`}
        </div>
      )}

      {/* Render children */}
      {children}
    </div>
  );
};

export default KeyboardNavigation;
