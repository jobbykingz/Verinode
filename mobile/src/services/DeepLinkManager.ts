import { Linking, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceService } from './DeviceService';

export interface DeepLinkConfig {
  appScheme: string;
  appHost: string;
  universalLinks: string[];
  customSchemes: string[];
  fallbackUrl: string;
  enableAnalytics: boolean;
  enableLogging: boolean;
}

export interface DeepLinkData {
  url: string;
  scheme: string;
  host: string;
  path: string;
  query: Record<string, string>;
  fragment?: string;
  source?: string;
  timestamp: number;
  isNewUser?: boolean;
  referrer?: string;
}

export interface DeepLinkHandler {
  path: string;
  handler: (data: DeepLinkData) => Promise<void>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiresAuth?: boolean;
  conditions?: (data: DeepLinkData) => boolean;
}

export interface DeepLinkAnalytics {
  url: string;
  path: string;
  timestamp: number;
  source: string;
  isNewUser: boolean;
  referrer: string;
  handled: boolean;
  handlingTime: number;
  error?: string;
}

export interface DeepLinkCampaign {
  id: string;
  name: string;
  url: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  customParams?: Record<string, string>;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
}

export class DeepLinkManager {
  private config: DeepLinkConfig;
  private handlers: Map<string, DeepLinkHandler[]>;
  private analytics: DeepLinkAnalytics[];
  private campaigns: Map<string, DeepLinkCampaign>;
  private isInitialized: boolean = false;
  private pendingDeepLink: DeepLinkData | null = null;

  constructor(config: DeepLinkConfig) {
    this.config = config;
    this.handlers = new Map();
    this.analytics = [];
    this.campaigns = new Map();
  }

  /**
   * Initialize the deep link manager
   */
  async initialize(): Promise<void> {
    try {
      // Set up deep linking for iOS
      if (Platform.OS === 'ios') {
        await this.setupiOSDeepLinking();
      }
      
      // Set up deep linking for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidDeepLinking();
      }
      
      // Load existing handlers
      await this.loadHandlers();
      
      // Load campaigns
      await this.loadCampaigns();
      
      // Load analytics
      await this.loadAnalytics();
      
      // Handle initial URL if app was opened from deep link
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await this.handleDeepLink(initialUrl, 'initial');
      }
      
      // Set up URL event listener
      Linking.addEventListener('url', this.handleUrlEvent.bind(this));
      
      this.isInitialized = true;
      console.log('Deep Link Manager initialized');
    } catch (error) {
      console.error('Failed to initialize Deep Link Manager', error);
      throw error;
    }
  }

  /**
   * Register a deep link handler
   */
  registerHandler(handler: DeepLinkHandler): void {
    const path = handler.path;
    const handlers = this.handlers.get(path) || [];
    
    handlers.push(handler);
    
    // Sort by priority (highest first)
    handlers.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    this.handlers.set(path, handlers);
    console.log(`Deep link handler registered: ${path}`);
  }

  /**
   * Unregister a deep link handler
   */
  unregisterHandler(path: string, handler?: DeepLinkHandler): boolean {
    const handlers = this.handlers.get(path);
    if (!handlers) return false;
    
    if (handler) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        this.handlers.set(path, handlers);
      }
    } else {
      this.handlers.delete(path);
    }
    
    console.log(`Deep link handler unregistered: ${path}`);
    return true;
  }

  /**
   * Handle a deep link URL
   */
  async handleDeepLink(url: string, source: string = 'direct'): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Parse the URL
      const linkData = this.parseURL(url, source);
      
      // Check if this is a new user
      if (linkData.isNewUser) {
        await this.handleNewUser(linkData);
      }
      
      // Check for campaign tracking
      this.trackCampaignClick(linkData);
      
      // Find appropriate handler
      const handlers = this.handlers.get(linkData.path) || [];
      let handled = false;
      let error: string | undefined;
      
      for (const handler of handlers) {
        try {
          // Check conditions
          if (handler.conditions && !handler.conditions(linkData)) {
            continue;
          }
          
          // Check authentication requirement
          if (handler.requiresAuth) {
            const isAuthenticated = await this.checkAuthentication();
            if (!isAuthenticated) {
              // Redirect to login with deep link as return URL
              this.redirectToLogin(linkData);
              continue;
            }
          }
          
          // Execute handler
          await handler.handler(linkData);
          handled = true;
          break;
        } catch (handlerError) {
          error = handlerError instanceof Error ? handlerError.message : 'Handler error';
          console.error(`Deep link handler error for path ${linkData.path}:`, error);
        }
      }
      
      // Record analytics
      const analytics: DeepLinkAnalytics = {
        url: linkData.url,
        path: linkData.path,
        timestamp: linkData.timestamp,
        source,
        isNewUser: linkData.isNewUser || false,
        referrer: linkData.referrer || '',
        handled,
        handlingTime: Date.now() - startTime,
        error,
      };
      
      this.recordAnalytics(analytics);
      
      // If not handled, show fallback
      if (!handled) {
        await this.handleUnhandledLink(linkData);
      }
      
    } catch (error) {
      console.error('Failed to handle deep link:', error);
      throw error;
    }
  }

  /**
   * Generate a deep link URL
   */
  generateDeepLink(path: string, params?: Record<string, string>, campaign?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
  }): string {
    try {
      const url = new URL();
      url.scheme = this.config.appScheme;
      url.host = this.config.appHost;
      url.pathname = path.startsWith('/') ? path : `/${path}`;
      
      // Add query parameters
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }
      
      // Add campaign tracking
      if (campaign) {
        if (campaign.utmSource) url.searchParams.set('utm_source', campaign.utmSource);
        if (campaign.utmMedium) url.searchParams.set('utm_medium', campaign.utmMedium);
        if (campaign.utmCampaign) url.searchParams.set('utm_campaign', campaign.utmCampaign);
        if (campaign.utmContent) url.searchParams.set('utm_content', campaign.utmContent);
        if (campaign.utmTerm) url.searchParams.set('utm_term', campaign.utmTerm);
      }
      
      // Add timestamp
      url.searchParams.set('timestamp', Date.now().toString());
      
      return url.toString();
    } catch (error) {
      console.error('Failed to generate deep link:', error);
      return this.config.fallbackUrl;
    }
  }

  /**
   * Check if a URL is a deep link
   */
  isDeepLink(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // Check if it matches app scheme or universal links
      if (parsedUrl.scheme === this.config.appScheme) {
        return true;
      }
      
      // Check universal links
      for (const universalLink of this.config.universalLinks) {
        if (url.includes(universalLink)) {
          return true;
        }
      }
      
      // Check custom schemes
      for (const customScheme of this.config.customSchemes) {
        if (parsedUrl.scheme === customScheme) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse URL into DeepLinkData
   */
  parseURL(url: string, source: string): DeepLinkData {
    try {
      const parsedUrl = new URL(url);
      
      const linkData: DeepLinkData = {
        url,
        scheme: parsedUrl.scheme,
        host: parsedUrl.host,
        path: parsedUrl.pathname,
        query: {},
        fragment: parsedUrl.hash,
        source,
        timestamp: Date.now(),
      };
      
      // Parse query parameters
      parsedUrl.searchParams.forEach((value, key) => {
        linkData.query[key] = value;
      });
      
      // Check if new user
      linkData.isNewUser = this.checkIfNewUser(linkData);
      
      // Extract referrer
      linkData.referrer = linkData.query.referrer || '';
      
      return linkData;
    } catch (error) {
      console.error('Failed to parse URL:', error);
      
      // Return basic data
      return {
        url,
        scheme: 'unknown',
        host: 'unknown',
        path: url.split('?')[0],
        query: {},
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create a deep link campaign
   */
  createCampaign(campaign: Omit<DeepLinkCampaign, 'id' | 'isActive' | 'startDate'>): string {
    try {
      const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newCampaign: DeepLinkCampaign = {
        ...campaign,
        id: campaignId,
        isActive: true,
        startDate: new Date(),
      };
      
      this.campaigns.set(campaignId, newCampaign);
      this.saveCampaigns();
      
      console.log(`Deep link campaign created: ${campaignId} - ${campaign.name}`);
      return campaignId;
    } catch (error) {
      console.error('Failed to create deep link campaign:', error);
      throw error;
    }
  }

  /**
   * Get campaign by ID
   */
  getCampaign(campaignId: string): DeepLinkCampaign | null {
    return this.campaigns.get(campaignId) || null;
  }

  /**
   * Get all active campaigns
   */
  getActiveCampaigns(): DeepLinkCampaign[] {
    return Array.from(this.campaigns.values()).filter(campaign => campaign.isActive);
  }

  /**
   * Get deep link analytics
   */
  getAnalytics(timeRange?: { start: Date; end: Date }): DeepLinkAnalytics[] {
    let analytics = this.analytics;
    
    if (timeRange) {
      const { start, end } = timeRange;
      analytics = analytics.filter(
        a => a.timestamp >= start.getTime() && a.timestamp <= end.getTime()
      );
    }
    
    return analytics;
  }

  /**
   * Get deep link statistics
   */
  getStatistics(): {
    totalLinks: number;
    handledLinks: number;
    failedLinks: number;
    topPaths: Array<{ path: string; count: number }>;
    topSources: Array<{ source: string; count: number }>;
    topCampaigns: Array<{ campaignId: string; count: number; name: string }>;
    averageHandlingTime: number;
    errorRate: number;
  };

  /**
   * Export analytics data
   */
  exportAnalytics(format: 'json' | 'csv' = 'json'): string {
    const data = {
      analytics: this.analytics,
      campaigns: Array.from(this.campaigns.values()),
      handlers: Array.from(this.handlers.entries()).map(([path, handlers]) => ({
        path,
        handlers: handlers.map(h => ({
          priority: h.priority,
          requiresAuth: h.requiresAuth,
          hasConditions: !!h.conditions,
        })),
      })),
      statistics: this.getStatistics(),
      exportedAt: new Date().toISOString(),
    };
    
    return format === 'json' ? JSON.stringify(data, null, 2) : this.convertToCSV(data);
  }

  /**
   * Clear analytics data
   */
  clearAnalytics(): void {
    this.analytics = [];
    this.saveAnalytics();
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.handlers.clear();
    this.analytics = [];
    this.campaigns.clear();
    this.saveHandlers();
    this.saveCampaigns();
    this.saveAnalytics();
  }

  // Private methods

  private handleUrlEvent = (event: any) => {
    const url = event.url;
    
    if (this.isDeepLink(url)) {
      this.handleDeepLink(url, 'url_event');
    }
  };

  private async setupiOSDeepLinking(): Promise<void> {
    // iOS universal linking would be set up in Xcode project
    // This is handled by the native iOS code
    console.log('iOS deep linking setup completed');
  }

  private async setupAndroidDeepLinking(): Promise<void> {
    // Android App Links would be set up in AndroidManifest.xml
    // This is handled by the native Android code
    console.log('Android deep linking setup completed');
  }

  private async loadHandlers(): Promise<void> {
    try {
      const savedHandlers = await AsyncStorage.getItem('deep_link_handlers');
      if (savedHandlers) {
        const handlers = JSON.parse(savedHandlers);
        
        for (const [path, handlerList] of Object.entries(handlers)) {
          this.handlers.set(path, handlerList);
        }
      }
    } catch (error) {
      console.error('Failed to load deep link handlers:', error);
    }
  }

  private async saveHandlers(): Promise<void> {
    try {
      const handlers = Array.from(this.handlers.entries()).map(([path, handlerList]) => [path, handlerList]);
      await AsyncStorage.setItem('deep_link_handlers', JSON.stringify(handlers));
    } catch (error) {
      console.error('Failed to save deep link handlers:', error);
    }
  }

  private async loadCampaigns(): Promise<void> {
    try {
      const savedCampaigns = await AsyncStorage.getItem('deep_link_campaigns');
      if (savedCampaigns) {
        const campaigns = JSON.parse(savedCampaigns);
        
        for (const campaign of campaigns) {
          this.campaigns.set(campaign.id, campaign);
        }
      }
    } catch (error) {
      console.error('Failed to load deep link campaigns:', error);
    }
  }

  private saveCampaigns(): void {
    try {
      const campaigns = Array.from(this.campaigns.values());
      AsyncStorage.setItem('deep_link_campaigns', JSON.stringify(campaigns));
    } catch (error) {
      console.error('Failed to save deep link campaigns:', error);
    }
  }

  private async loadAnalytics(): Promise<void> {
    try {
      const savedAnalytics = await AsyncStorage.getItem('deep_link_analytics');
      if (savedAnalytics) {
        this.analytics = JSON.parse(savedAnalytics);
      }
    } catch (error) {
      console.error('Failed to load deep link analytics:', error);
    }
  }

  private saveAnalytics(): void {
    try {
      AsyncStorage.setItem('deep_link_analytics', JSON.stringify(this.analytics));
    } catch (error) {
      console.error('Failed to save deep link analytics:', error);
    }
  }

  private checkIfNewUser(linkData: DeepLinkData): boolean {
    // Check if user has used the app before
    // This would integrate with your user service
    const hasUsedApp = AsyncStorage.getItem('has_used_app');
    const isNew = !hasUsedApp;
    
    if (isNew) {
      AsyncStorage.setItem('has_used_app', 'true');
    }
    
    return isNew;
  }

  private async handleNewUser(linkData: DeepLinkData): Promise<void> {
    try {
      // Record new user analytics
      const analytics: DeepLinkAnalytics = {
        url: linkData.url,
        path: linkData.path,
        timestamp: linkData.timestamp,
        source: linkData.source,
        isNewUser: true,
        referrer: linkData.referrer || '',
        handled: false,
        handlingTime: 0,
      };
      
      this.recordAnalytics(analytics);
      
      // Show welcome experience
      Alert.alert(
        'Welcome to Verinode!',
        'You\'ve been successfully registered and logged in.',
        [
          { text: 'Get Started', style: 'default' },
        ]
      );
      
      console.log('New user handled via deep link');
    } catch (error) {
      console.error('Failed to handle new user:', error);
    }
  }

  private trackCampaignClick(linkData: DeepLinkData): void {
    try {
      // Check if campaign parameters exist
      const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      const hasUtmParams = utmParams.some(param => linkData.query[param]);
      
      if (hasUtmParams) {
        const campaignId = linkData.query.campaign_id;
        if (campaignId) {
          const campaign = this.campaigns.get(campaignId);
          if (campaign && campaign.isActive) {
            // Update campaign analytics
            // This would increment click count
            console.log(`Campaign click tracked: ${campaignId}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to track campaign click:', error);
    }
  }

  private async checkAuthentication(): Promise<boolean> {
    // Check if user is authenticated
    // This would integrate with your authentication service
    try {
      const token = await AsyncStorage.getItem('auth_token');
      return !!token;
    } catch (error) {
      return false;
    }
  }

  private redirectToLogin(linkData: DeepLinkData): void {
    // Store the deep link for post-login redirect
    AsyncStorage.setItem('pending_deep_link', JSON.stringify(linkData));
    
    // Navigate to login
    // This would integrate with your navigation service
    console.log('Redirecting to login for deep link:', linkData.url);
  }

  private async handleUnhandledLink(linkData: DeepLinkData): Promise<void> {
    try {
      // Check if we have a pending deep link
      const pendingLink = await AsyncStorage.getItem('pending_deep_link');
      
      if (pendingLink) {
        const pendingLinkData = JSON.parse(pendingLink);
        await AsyncStorage.removeItem('pending_deep_link');
        
        // Try to handle the pending link
        await this.handleDeepLink(pendingLinkData.url, 'pending');
      } else {
        // Show fallback dialog
        Alert.alert(
          'Link Not Supported',
          `The link "${linkData.url}" is not supported by the app.`,
          [
            { text: 'OK', style: 'default' },
          ]
        );
      }
    } catch (error) {
      console.error('Failed to handle unhandled link:', error);
    }
  }

  private getStatistics(): {
    const totalLinks = this.analytics.length;
    const handledLinks = this.analytics.filter(a => a.handled).length;
    const failedLinks = this.analytics.filter(a => !!a.error).length;
    
    // Calculate path statistics
    const pathCounts = new Map<string, number>();
    for (const analytics of this.analytics) {
      const path = analytics.path;
      pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
    }
    
    const topPaths = Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));
    
    // Calculate source statistics
    const sourceCounts = new Map<string, number>();
    for (const analytics of this.analytics) {
      const source = analytics.source;
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    }
    
    const topSources = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([source, count]) => ({ source, count }));
    
    // Calculate campaign statistics
    const campaignCounts = new Map<string, number>();
    for (const analytics of this.analytics) {
      const campaignId = analytics.query.campaign_id;
      if (campaignId) {
        campaignCounts.set(campaignId, (campaignCounts.get(campaignId) || 0) + 1);
      }
    }
    
    const topCampaigns = Array.from(campaignCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([campaignId, count]) => {
        const campaign = this.campaigns.get(campaignId);
        return {
          campaignId,
          count,
          name: campaign?.name || 'Unknown',
        };
      });
    
    // Calculate average handling time
    const handledAnalytics = this.analytics.filter(a => a.handled);
    const avgHandlingTime = handledAnalytics.length > 0 
      ? handledAnalytics.reduce((sum, a) => sum + a.handlingTime, 0) / handledAnalytics.length 
      : 0;
    
    // Calculate error rate
    const errorRate = totalLinks > 0 ? failedLinks / totalLinks : 0;
    
    return {
      totalLinks,
      handledLinks,
      failedLinks,
      topPaths,
      topSources,
      topCampaigns,
      averageHandlingTime,
      errorRate,
    };
  }

  private convertToCSV(data: any): string {
    const headers = Object.keys(data);
    const values = headers.map(header => JSON.stringify(data[header]));
    
    return [headers.join(','), values.join(',')].join('\n');
  }
}

// Export singleton instance
let deepLinkManager: DeepLinkManager | null = null;

export const getDeepLinkManager = (config: DeepLinkConfig): DeepLinkManager => {
  if (!deepLinkManager) {
    deepLinkManager = new DeepLinkManager(config);
    deepLinkManager.initialize();
  }
  return deepLinkManager;
};

// Hook for using deep linking in React components
export const useDeepLinkManager = (config: DeepLinkConfig): DeepLinkManager => {
  return getDeepLinkManager(config);
};

// Utility functions for deep linking
export const createDeepLink = (
  path: string,
  params?: Record<string, string>,
  config?: DeepLinkConfig
): string => {
  const manager = getDeepLinkManager(config || {
    appScheme: 'verinode',
    appHost: 'verinode.app',
    universalLinks: ['verinode.app', 'verinode.com'],
    customSchemes: [],
    fallbackUrl: 'https://verinode.com',
    enableAnalytics: true,
    enableLogging: true,
  });
  
  return manager.generateDeepLink(path, params);
};

export const openDeepLink = async (url: string, config?: DeepLinkConfig): Promise<boolean> => {
  try {
    const supported = await Linking.canOpenURL(url);
    
    if (supported) {
      await Linking.openURL(url);
      return true;
    } else {
      // Fallback to browser
      const manager = getDeepLinkManager(config || {
        appScheme: 'verinode',
        appHost: 'verinode.app',
        universalLinks: ['verinode.app', 'verinode.com'],
        customSchemes: [],
        fallbackUrl: 'https://verinode.com',
        enableAnalytics: true,
        enableLogging: true,
      });
      
      const fallbackUrl = manager.config.fallbackUrl;
      await Linking.openURL(fallbackUrl);
      return false;
    }
  } catch (error) {
    console.error('Failed to open deep link:', error);
    return false;
  }
};

// Export types for external use
export type { DeepLinkData, DeepLinkHandler, DeepLinkConfig, DeepLinkAnalytics, DeepLinkCampaign };
