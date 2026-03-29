export interface TrackEventParams {
  action: string;
  category?: string;
  label?: string;
  value?: number;
}

declare global {
  interface Window {
    dataLayer?: Array<unknown[]>;
    gtag?: (...args: unknown[]) => void;
  }
}

let isInitialized = false;
let missingIdLogged = false;

export const getAnalyticsMeasurementId = (): string =>
  process.env.REACT_APP_GA_ID || '';

export const isAnalyticsEnabled = (): boolean =>
  typeof window !== 'undefined' && getAnalyticsMeasurementId().length > 0;

const logDevInfo = (message: string): void => {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.info(message);
  }
};

const ensureGtagStub = (): void => {
  window.dataLayer = window.dataLayer || [];

  if (!window.gtag) {
    window.gtag = (...args: unknown[]): void => {
      window.dataLayer?.push(args);
    };
  }
};

const injectGtagScript = (measurementId: string): void => {
  if (document.getElementById('ga4-gtag-script')) {
    return;
  }

  const script = document.createElement('script');
  script.id = 'ga4-gtag-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
};

export const initAnalytics = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || isInitialized) {
    return;
  }

  const measurementId = getAnalyticsMeasurementId();
  if (!measurementId) {
    if (!missingIdLogged) {
      logDevInfo(
        'GA4 analytics is disabled because no measurement ID is configured. Set REACT_APP_GA_ID to enable analytics.'
      );
      missingIdLogged = true;
    }

    return;
  }

  injectGtagScript(measurementId);
  ensureGtagStub();

  window.gtag?.('js', new Date());
  window.gtag?.('config', measurementId, { send_page_view: false });

  isInitialized = true;
};

const sendGtagEvent = (
  action: string,
  params: Record<string, string | number | boolean>
): void => {
  if (!isAnalyticsEnabled()) {
    return;
  }

  if (!isInitialized) {
    initAnalytics();
  }

  window.gtag?.('event', action, params);
};

export const trackPageView = (pagePath?: string): void => {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) {
    return;
  }

  const resolvedPagePath = pagePath || `${window.location.pathname}${window.location.search}`;

  sendGtagEvent('page_view', {
    page_path: resolvedPagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
};

export const trackEvent = ({
  action,
  category,
  label,
  value,
}: TrackEventParams): void => {
  if (!action) {
    return;
  }

  const params: Record<string, string | number> = {};

  if (category) {
    params.event_category = category;
  }

  if (label) {
    params.event_label = label;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    params.value = Math.round(value);
  }

  sendGtagEvent(action, params);
};

export const trackLogin = (method = 'password'): void => {
  trackEvent({
    action: 'login_submit',
    category: 'Auth',
    label: method,
  });
};

export const trackSignup = (method = 'password'): void => {
  trackEvent({
    action: 'signup_submit',
    category: 'Auth',
    label: method,
  });
};
