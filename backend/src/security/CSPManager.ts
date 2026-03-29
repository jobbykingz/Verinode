import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface CSPDirective {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'connect-src'?: string[];
  'font-src'?: string[];
  'object-src'?: string[];
  'media-src'?: string[];
  'frame-src'?: string[];
  'child-src'?: string[];
  'worker-src'?: string[];
  'manifest-src'?: string[];
  'base-uri'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'navigate-to'?: string[];
  'report-to'?: string[];
  'report-uri'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

export interface CSPConfig {
  directives: CSPDirective;
  reportOnly?: boolean;
  reportUri?: string;
  nonce?: boolean;
  strictDynamic?: boolean;
  unsafeEval?: boolean;
  unsafeInline?: boolean;
  sandbox?: string[];
}

export class CSPManager {
  private defaultConfig: CSPConfig = {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'strict-dynamic'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'", 'data:'],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'child-src': ["'none'"],
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': true,
      'block-all-mixed-content': true
    },
    reportOnly: false,
    nonce: true,
    strictDynamic: true,
    unsafeEval: false,
    unsafeInline: false,
    sandbox: []
  };

  constructor(private config: CSPConfig = {}) {
    this.config = { ...this.defaultConfig, ...config };
    this.mergeDirectives();
  }

  private mergeDirectives(): void {
    this.config.directives = {
      ...this.defaultConfig.directives,
      ...this.config.directives
    };
  }

  public generateNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const cspHeader = this.config.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
      
      // Generate nonce for this request if enabled
      if (this.config.nonce) {
        res.locals.cspNonce = this.generateNonce();
      }

      const policy = this.buildPolicy(req);
      res.setHeader(cspHeader, policy);
      
      next();
    };
  }

  private buildPolicy(req: Request): string {
    const directives: string[] = [];

    for (const [directive, values] of Object.entries(this.config.directives)) {
      if (Array.isArray(values)) {
        let directiveValue = values.join(' ');
        
        // Add nonce if enabled and applicable
        if (this.config.nonce && (directive === 'script-src' || directive === 'style-src')) {
          const nonce = req.res?.locals?.cspNonce;
          if (nonce) {
            directiveValue += ` 'nonce-${nonce}'`;
          }
        }

        // Add strict-dynamic if enabled
        if (this.config.strictDynamic && directive === 'script-src') {
          directiveValue += " 'strict-dynamic'";
        }

        // Add unsafe-eval if enabled
        if (this.config.unsafeEval && directive === 'script-src') {
          directiveValue += " 'unsafe-eval'";
        }

        // Add unsafe-inline if enabled
        if (this.config.unsafeInline && (directive === 'script-src' || directive === 'style-src')) {
          directiveValue += " 'unsafe-inline'";
        }

        if (directiveValue) {
          directives.push(`${directive} ${directiveValue}`);
        }
      } else if (typeof values === 'boolean' && values) {
        directives.push(directive);
      }
    }

    // Add sandbox if specified
    if (this.config.sandbox && this.config.sandbox.length > 0) {
      directives.push(`sandbox ${this.config.sandbox.join(' ')}`);
    }

    return directives.join('; ');
  }

  public getPolicyForRequest(req: Request): string {
    return this.buildPolicy(req);
  }

  public updateConfig(newConfig: Partial<CSPConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.mergeDirectives();
  }

  public getConfig(): CSPConfig {
    return { ...this.config };
  }

  public addDirective(directive: keyof CSPDirective, values: string[]): void {
    if (!this.config.directives[directive]) {
      this.config.directives[directive] = [];
    }
    this.config.directives[directive]!.push(...values);
  }

  public removeDirective(directive: keyof CSPDirective): void {
    delete this.config.directives[directive];
  }

  public updateDirective(directive: keyof CSPDirective, values: string[]): void {
    this.config.directives[directive] = values;
  }

  public validateCSP(policy: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const directives = policy.split(';').map(d => d.trim());
    
    for (const directive of directives) {
      if (!directive) continue;
      
      const [name, ...values] = directive.split(' ');
      const validDirectives = Object.keys(this.defaultConfig.directives);
      
      if (!validDirectives.includes(name)) {
        errors.push(`Invalid directive: ${name}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public getNonceFromRequest(req: Request): string | undefined {
    return req.res?.locals?.cspNonce;
  }

  public createReportEndpoint() {
    return (req: Request, res: Response) => {
      const cspReport = req.body;
      
      // Log CSP violation
      console.warn('CSP Violation:', {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString(),
        report: cspReport
      });

      // Store violation for analysis (implement with your storage solution)
      this.storeCSPViolation(cspReport, req);

      res.status(204).send();
    };
  }

  private storeCSPViolation(report: any, req: Request): void {
    // Implement storage logic for CSP violations
    // This could be stored in a database, logging service, etc.
    // For now, we'll just log it
    console.log('CSP Violation stored:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      report
    });
  }

  public getSecurityReport(): {
    totalViolations: number;
    recentViolations: any[];
    blockedRequests: number;
  } {
    // Implement logic to retrieve security reports
    // This would typically query your storage system
    return {
      totalViolations: 0,
      recentViolations: [],
      blockedRequests: 0
    };
  }
}

export default CSPManager;
