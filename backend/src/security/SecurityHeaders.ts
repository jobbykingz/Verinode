import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

export interface SecurityHeaderConfig {
  frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  frameOptionsAllowFrom?: string;
  contentTypeNosniff?: boolean;
  xssProtection?: boolean;
  strictTransportSecurity?: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
  permissionsPolicy?: Record<string, boolean[]>;
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
  crossOriginResourcePolicy?: 'cross-origin' | 'same-origin' | 'same-site';
  dnsPrefetchControl?: boolean;
  hsts?: boolean;
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean;
  xssFilter?: boolean;
}

export class SecurityHeaders {
  private defaultConfig: SecurityHeaderConfig = {
    frameOptions: 'DENY',
    contentTypeNosniff: true,
    xssProtection: true,
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      geolocation: [],
      camera: [],
      microphone: [],
      payment: [],
      usb: [],
      magnetometer: [],
      gyroscope: [],
      accelerometer: [],
      autoplay: [],
      encryptedMedia: [],
      fullscreen: [],
      pictureInPicture: []
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: 'cross-origin',
    dnsPrefetchControl: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    xssFilter: true
  };

  constructor(private config: SecurityHeaderConfig = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  public middleware() {
    return helmet({
      contentSecurityPolicy: false, // We'll handle CSP separately
      crossOriginEmbedderPolicy: this.config.crossOriginEmbedderPolicy,
      crossOriginOpenerPolicy: this.config.crossOriginOpenerPolicy,
      crossOriginResourcePolicy: {
        policy: this.config.crossOriginResourcePolicy || 'cross-origin'
      },
      dnsPrefetchControl: this.config.dnsPrefetchControl,
      frameguard: {
        action: this.config.frameOptions || 'DENY',
        domain: this.config.frameOptionsAllowFrom
      },
      hidePoweredBy: true,
      hsts: this.config.hsts ? {
        maxAge: this.config.strictTransportSecurity?.maxAge || 31536000,
        includeSubDomains: this.config.strictTransportSecurity?.includeSubDomains,
        preload: this.config.strictTransportSecurity?.preload
      } : false,
      ieNoOpen: this.config.ieNoOpen,
      noSniff: this.config.noSniff,
      originAgentCluster: this.config.originAgentCluster,
      permittedCrossDomainPolicies: this.config.permittedCrossDomainPolicies,
      referrerPolicy: {
        policy: this.config.referrerPolicy || 'strict-origin-when-cross-origin'
      },
      xssFilter: this.config.xssFilter
    });
  }

  public customHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Additional custom security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', this.config.frameOptions || 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Security headers for API
      res.setHeader('X-API-Version', '1.0.0');
      res.setHeader('X-Content-Security-Policy', 'default-src \'self\'');
      
      // Cache control for security
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      // Remove server information
      res.removeHeader('Server');
      res.removeHeader('X-Powered-By');
      
      next();
    };
  }

  public updateConfig(newConfig: Partial<SecurityHeaderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): SecurityHeaderConfig {
    return { ...this.config };
  }

  public getSecurityHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': this.config.frameOptions || 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': this.config.referrerPolicy || 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    if (this.config.hsts && this.config.strictTransportSecurity) {
      const hstsValue = `max-age=${this.config.strictTransportSecurity.maxAge}${
        this.config.strictTransportSecurity.includeSubDomains ? '; includeSubDomains' : ''
      }${
        this.config.strictTransportSecurity.preload ? '; preload' : ''
      }`;
      headers['Strict-Transport-Security'] = hstsValue;
    }

    if (this.config.frameOptionsAllowFrom) {
      headers['X-Frame-Options'] = `ALLOW-FROM ${this.config.frameOptionsAllowFrom}`;
    }

    return headers;
  }
}

export default SecurityHeaders;
