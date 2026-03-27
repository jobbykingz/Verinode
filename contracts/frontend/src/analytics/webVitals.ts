import { isAnalyticsEnabled, trackEvent } from './ga';

type WebVitalName = 'LCP' | 'CLS' | 'INP' | 'FID' | 'TTFB';

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface FirstInputEntry extends PerformanceEntry {
  processingStart: number;
}

let hasStarted = false;

const toGaValue = (name: WebVitalName, value: number): number => {
  if (name === 'CLS') {
    return Math.round(value * 1000);
  }

  return Math.round(value);
};

const reportVital = (name: WebVitalName, value: number, label?: string): void => {
  const normalizedValue = toGaValue(name, value);

  if (isAnalyticsEnabled()) {
    trackEvent({
      action: `web_vital_${name.toLowerCase()}`,
      category: 'Web Vitals',
      label: label || name,
      value: normalizedValue,
    });

    return;
  }

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.info(`[Web Vitals] ${name}: ${value}`);
  }
};

const onPageHide = (callback: () => void): void => {
  let hasRun = false;

  const runOnce = (): void => {
    if (hasRun) {
      return;
    }

    hasRun = true;
    callback();
  };

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') {
        runOnce();
      }
    },
    { once: true }
  );

  window.addEventListener('pagehide', runOnce, { once: true });
};

const safelyObserve = (observerFactory: () => void): void => {
  try {
    observerFactory();
  } catch {
    // Browser does not support this PerformanceObserver entry type.
  }
};

const trackLCP = (): void => {
  safelyObserve(() => {
    let lcpValue = 0;

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];

      if (lastEntry) {
        lcpValue = lastEntry.startTime;
      }
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true } as PerformanceObserverInit);

    onPageHide(() => {
      if (lcpValue > 0) {
        reportVital('LCP', lcpValue);
      }

      observer.disconnect();
    });
  });
};

const trackCLS = (): void => {
  safelyObserve(() => {
    let clsValue = 0;

    const observer = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        const layoutShiftEntry = entry as LayoutShiftEntry;

        if (!layoutShiftEntry.hadRecentInput) {
          clsValue += layoutShiftEntry.value;
        }
      });
    });

    observer.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);

    onPageHide(() => {
      if (clsValue > 0) {
        reportVital('CLS', clsValue);
      }

      observer.disconnect();
    });
  });
};

const trackFID = (): void => {
  safelyObserve(() => {
    const observer = new PerformanceObserver((entryList) => {
      const firstEntry = entryList.getEntries()[0] as FirstInputEntry | undefined;

      if (!firstEntry) {
        return;
      }

      const fidValue = firstEntry.processingStart - firstEntry.startTime;

      if (fidValue >= 0) {
        reportVital('FID', fidValue, firstEntry.name || 'first-input');
      }

      observer.disconnect();
    });

    observer.observe({ type: 'first-input', buffered: true } as PerformanceObserverInit);
  });
};

const trackINP = (): void => {
  safelyObserve(() => {
    let maxInteractionDuration = 0;

    const observer = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        if (entry.duration > maxInteractionDuration) {
          maxInteractionDuration = entry.duration;
        }
      });
    });

    observer.observe({ type: 'event', buffered: true, durationThreshold: 40 } as any);

    onPageHide(() => {
      if (maxInteractionDuration > 0) {
        reportVital('INP', maxInteractionDuration);
      }

      observer.disconnect();
    });
  });
};

const trackTTFB = (): void => {
  const reportTtfb = (): void => {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;

    if (navigationEntry) {
      reportVital('TTFB', navigationEntry.responseStart);
    }
  };

  if (document.readyState === 'complete') {
    reportTtfb();
    return;
  }

  window.addEventListener('load', reportTtfb, { once: true });
};

export const startWebVitalsTracking = (): void => {
  if (
    hasStarted ||
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof performance === 'undefined' ||
    typeof PerformanceObserver === 'undefined'
  ) {
    return;
  }

  hasStarted = true;

  trackTTFB();
  trackLCP();
  trackCLS();
  trackFID();
  trackINP();
};
