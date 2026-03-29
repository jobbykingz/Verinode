/**
 * ScreenReader Component
 * Provides screen reader support and announcements for accessibility
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';
import { ScreenReaderUtils, AriaUtils } from '../../utils/accessibilityUtils';

interface ScreenReaderProps {
  children?: React.ReactNode;
  className?: string;
  announcements?: boolean;
  autoDetect?: boolean;
}

interface Announcement {
  id: string;
  message: string;
  priority: 'polite' | 'assertive';
  timestamp: number;
}

export const ScreenReader: React.FC<ScreenReaderProps> = ({
  children,
  className = '',
  announcements = true,
  autoDetect = true
}) => {
  const { 
    isScreenReaderActive, 
    announce, 
    preferences,
    updatePreference,
    generateId 
  } = useAccessibility();
  
  const [announcementQueue, setAnnouncementQueue] = useState<Announcement[]>([]);
  const politeRegionRef = useRef<HTMLDivElement>(null);
  const assertiveRegionRef = useRef<HTMLDivElement>(null);
  const [isDetected, setIsDetected] = useState(false);

  // Auto-detect screen reader
  useEffect(() => {
    if (autoDetect) {
      const detectScreenReader = () => {
        const detected = ScreenReaderUtils.isScreenReaderActive();
        setIsDetected(detected);
        updatePreference('screenReader', detected);
      };

      detectScreenReader();
      const interval = setInterval(detectScreenReader, 3000);

      return () => clearInterval(interval);
    }
  }, [autoDetect, updatePreference]);

  // Create live regions
  useEffect(() => {
    if (!politeRegionRef.current) {
      const politeRegion = document.createElement('div');
      politeRegion.setAttribute('aria-live', 'polite');
      politeRegion.setAttribute('aria-atomic', 'true');
      politeRegion.className = 'sr-only';
      politeRegion.id = 'screen-reader-polite';
      document.body.appendChild(politeRegion);
      politeRegionRef.current = politeRegion;
    }

    if (!assertiveRegionRef.current) {
      const assertiveRegion = document.createElement('div');
      assertiveRegion.setAttribute('aria-live', 'assertive');
      assertiveRegion.setAttribute('aria-atomic', 'true');
      assertiveRegion.className = 'sr-only';
      assertiveRegion.id = 'screen-reader-assertive';
      document.body.appendChild(assertiveRegion);
      assertiveRegionRef.current = assertiveRegion;
    }

    return () => {
      politeRegionRef.current?.remove();
      assertiveRegionRef.current?.remove();
    };
  }, []);

  // Process announcements
  useEffect(() => {
    if (announcementQueue.length === 0 || !announcements) return;

    const timer = setTimeout(() => {
      const [currentAnnouncement, ...remaining] = announcementQueue;
      
      const region = currentAnnouncement.priority === 'assertive' 
        ? assertiveRegionRef.current 
        : politeRegionRef.current;

      if (region) {
        region.textContent = currentAnnouncement.message;
        
        // Clear after announcement
        setTimeout(() => {
          region.textContent = '';
        }, 1000);
      }

      setAnnouncementQueue(remaining);
    }, 100);

    return () => clearTimeout(timer);
  }, [announcementQueue, announcements]);

  // Public method to add announcements
  const addAnnouncement = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement: Announcement = {
      id: generateId('announcement'),
      message,
      priority,
      timestamp: Date.now()
    };

    setAnnouncementQueue(prev => [...prev, announcement]);
  };

  // Expose announcement method globally
  useEffect(() => {
    (window as any).screenReaderAnnounce = addAnnouncement;
    return () => {
      delete (window as any).screenReaderAnnounce;
    };
  }, [addAnnouncement]);

  // Handle page changes
  useEffect(() => {
    const handleRouteChange = () => {
      const title = document.title;
      if (title) {
        addAnnouncement(`Navigated to ${title}`, 'polite');
      }
    };

    // Listen for navigation events
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [addAnnouncement]);

  // Setup ARIA landmarks
  useEffect(() => {
    const setupLandmarks = () => {
      // Main landmark
      const main = document.querySelector('main') || document.getElementById('main-content');
      if (main && !main.hasAttribute('role')) {
        main.setAttribute('role', 'main');
      }

      // Navigation landmark
      const nav = document.querySelector('nav');
      if (nav && !nav.hasAttribute('role')) {
        nav.setAttribute('role', 'navigation');
        nav.setAttribute('aria-label', 'Main navigation');
      }

      // Header landmark
      const header = document.querySelector('header');
      if (header && !header.hasAttribute('role')) {
        header.setAttribute('role', 'banner');
      }

      // Footer landmark
      const footer = document.querySelector('footer');
      if (footer && !footer.hasAttribute('role')) {
        footer.setAttribute('role', 'contentinfo');
      }

      // Search landmark
      const search = document.querySelector('[role="search"], input[type="search"]');
      if (search && !search.closest('[role="search"]')) {
        const searchContainer = search.closest('form, div');
        if (searchContainer) {
          searchContainer.setAttribute('role', 'search');
          searchContainer.setAttribute('aria-label', 'Search');
        }
      }
    };

    setupLandmarks();
    
    // Watch for dynamic content changes
    const observer = new MutationObserver(() => {
      setupLandmarks();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  // Handle form validation announcements
  useEffect(() => {
    const handleFormSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement;
      if (!form.checkValidity()) {
        const invalidFields = form.querySelectorAll(':invalid');
        const fieldNames = Array.from(invalidFields).map(field => {
          const label = document.querySelector(`label[for="${field.id}"]`);
          return label?.textContent || field.getAttribute('placeholder') || field.getAttribute('name') || 'Field';
        });
        
        if (fieldNames.length > 0) {
          addAnnouncement(
            `Form validation failed. Please check: ${fieldNames.join(', ')}`,
            'assertive'
          );
        }
      }
    };

    document.addEventListener('submit', handleFormSubmit);
    
    return () => {
      document.removeEventListener('submit', handleFormSubmit);
    };
  }, [addAnnouncement]);

  // Screen reader status indicator (visually hidden but accessible)
  if (!preferences.screenReader && !isDetected) {
    return null;
  }

  return (
    <div 
      className={`screen-reader-support ${className}`}
      role="region"
      aria-label="Screen reader support"
      aria-hidden="false"
    >
      {/* Status indicator for developers */}
      <div className="sr-only" aria-live="polite">
        Screen reader support is {preferences.screenReader || isDetected ? 'active' : 'inactive'}
      </div>

      {/* Screen reader controls */}
      {(preferences.screenReader || isDetected) && (
        <div className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-50 
                        focus:bg-white focus:border-2 focus:border-blue-600 focus:rounded-lg 
                        focus:p-4 focus:shadow-lg"
             role="group"
             aria-label="Screen reader controls">
          <h3 className="font-bold mb-2">Screen Reader Controls</h3>
          <button
            onClick={() => updatePreference('announcements', !preferences.announcements)}
            className="block w-full text-left px-2 py-1 mb-1 border rounded"
            aria-pressed={preferences.announcements}
          >
            {preferences.announcements ? 'Disable' : 'Enable'} Announcements
          </button>
          <button
            onClick={() => {
              const currentUrl = window.location.href;
              announce(`Current page: ${document.title}. URL: ${currentUrl}`, 'polite');
            }}
            className="block w-full text-left px-2 py-1 mb-1 border rounded"
          >
            Announce Current Page
          </button>
          <button
            onClick={() => {
              const links = document.querySelectorAll('a[href]');
              announce(`${links.length} links found on this page`, 'polite');
            }}
            className="block w-full text-left px-2 py-1 mb-1 border rounded"
          >
            Count Page Links
          </button>
        </div>
      )}

      {/* Render children */}
      {children}
    </div>
  );
};

export default ScreenReader;
