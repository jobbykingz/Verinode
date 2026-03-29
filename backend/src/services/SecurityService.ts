import { Request, Response, NextFunction } from 'express';
import SecurityHeaders, { SecurityHeaderConfig } from '../security/SecurityHeaders';
import CSPManager, { CSPConfig } from '../security/CSPManager';
import SecurityScanner, { SecurityScanResult, ScanConfig } from '../security/SecurityScanner';
import winston from 'winston';

export interface SecurityServiceConfig {
  headers?: SecurityHeaderConfig;
  csp?: CSPConfig;
  scanner?: ScanConfig;
  logging?: {
    enabled: boolean;
    level: 'error' | 'warn' | 'info' | 'debug';
    destination: string;
  };
  monitoring?: {
    enabled: boolean;
    metricsEndpoint: string;
    alertThreshold: number;
  };
}

export interface SecurityMetrics {
  timestamp: Date;
  totalRequests: number;
  blockedRequests: number;
  cspViolations: number;
  securityScore: number;
  activeThreats: number;
  scanResults: SecurityScanResult[];
}

export interface SecurityIncident {
  id: string;
  timestamp: Date;
  type: 'csp_violation' | 'xss_attempt' | 'sql_injection' | 'rate_limit' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ipAddress: string;
  userAgent?: string;
  details: Record<string, any>;
  resolved: boolean;
}

export class SecurityService {
  private securityHeaders: SecurityHeaders;
  private cspManager: CSPManager;
  private securityScanner: SecurityScanner;
  private logger: winston.Logger;
  private incidents: SecurityIncident[] = [];
  private metrics: SecurityMetrics;

  constructor(private config: SecurityServiceConfig = {}) {
    this.securityHeaders = new SecurityHeaders(config.headers);
    this.cspManager = new CSPManager(config.csp);
    this.securityScanner = new SecurityScanner(config.scanner);
    
    this.logger = winston.createLogger({
      level: config.logging?.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: config.logging?.destination || 'security.log' 
        })
      ]
    });

    this.metrics = {
      timestamp: new Date(),
      totalRequests: 0,
      blockedRequests: 0,
      cspViolations: 0,
      securityScore: 100,
      activeThreats: 0,
      scanResults: []
    };
  }

  public middleware() {
    return [
      this.requestLogger.bind(this),
      this.securityHeaders.middleware(),
      this.securityHeaders.customHeaders(),
      this.cspManager.middleware(),
      this.threatDetection.bind(this)
    ];
  }

  private requestLogger(req: Request, res: Response, next: NextFunction) {
    this.metrics.totalRequests++;
    
    // Log suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /union\s+select/i,
      /drop\s+table/i,
      /exec\s*\(/i
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(req.url) || 
      pattern.test(JSON.stringify(req.body)) ||
      pattern.test(req.get('User-Agent') || '')
    );

    if (isSuspicious) {
      this.createIncident({
        type: 'suspicious_activity',
        severity: 'medium',
        description: 'Suspicious request pattern detected',
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        details: {
          url: req.url,
          method: req.method,
          body: req.body,
          headers: req.headers
        }
      });
    }

    next();
  }

  private threatDetection(req: Request, res: Response, next: NextFunction) {
    // Check for common attack patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi
    ];

    const sqlInjectionPatterns = [
      /union\s+select/gi,
      /drop\s+table/gi,
      /insert\s+into/gi,
      /delete\s+from/gi,
      /exec\s*\(/gi
    ];

    const requestString = JSON.stringify(req.body) + req.url + (req.get('User-Agent') || '');

    // XSS Detection
    if (xssPatterns.some(pattern => pattern.test(requestString))) {
      this.createIncident({
        type: 'xss_attempt',
        severity: 'high',
        description: 'XSS attempt detected',
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        details: { url: req.url, method: req.method }
      });
      
      this.metrics.blockedRequests++;
      return res.status(403).json({ error: 'Forbidden' });
    }

    // SQL Injection Detection
    if (sqlInjectionPatterns.some(pattern => pattern.test(requestString))) {
      this.createIncident({
        type: 'sql_injection',
        severity: 'critical',
        description: 'SQL injection attempt detected',
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        details: { url: req.url, method: req.method }
      });
      
      this.metrics.blockedRequests++;
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  }

  public getCSPReportEndpoint() {
    return this.cspManager.createReportEndpoint();
  }

  public async runSecurityScan(): Promise<SecurityScanResult[]> {
    this.logger.info('Starting security scan');
    
    try {
      const results = await this.securityScanner.runFullScan();
      this.metrics.scanResults = results;
      
      // Update security score based on latest scan
      if (results.length > 0) {
        const averageScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
        this.metrics.securityScore = Math.round(averageScore);
      }
      
      this.logger.info('Security scan completed', { 
        resultsCount: results.length,
        averageScore: this.metrics.securityScore 
      });
      
      return results;
    } catch (error) {
      this.logger.error('Security scan failed', { error: error.message });
      throw error;
    }
  }

  public async runDependencyScan(): Promise<SecurityScanResult> {
    this.logger.info('Starting dependency scan');
    
    try {
      const result = await this.securityScanner.scanDependencies();
      this.logger.info('Dependency scan completed', { 
        vulnerabilities: result.summary.total,
        score: result.score 
      });
      
      return result;
    } catch (error) {
      this.logger.error('Dependency scan failed', { error: error.message });
      throw error;
    }
  }

  public async runCodeScan(): Promise<SecurityScanResult> {
    this.logger.info('Starting code scan');
    
    try {
      const result = await this.securityScanner.scanCode();
      this.logger.info('Code scan completed', { 
        vulnerabilities: result.summary.total,
        score: result.score 
      });
      
      return result;
    } catch (error) {
      this.logger.error('Code scan failed', { error: error.message });
      throw error;
    }
  }

  public async runAPIScan(): Promise<SecurityScanResult> {
    this.logger.info('Starting API scan');
    
    try {
      const result = await this.securityScanner.scanAPI();
      this.logger.info('API scan completed', { 
        vulnerabilities: result.summary.total,
        score: result.score 
      });
      
      return result;
    } catch (error) {
      this.logger.error('API scan failed', { error: error.message });
      throw error;
    }
  }

  private createIncident(incident: Omit<SecurityIncident, 'id' | 'timestamp' | 'resolved'>): void {
    const fullIncident: SecurityIncident = {
      ...incident,
      id: `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false
    };

    this.incidents.push(fullIncident);
    this.metrics.activeThreats = this.incidents.filter(i => !i.resolved).length;

    this.logger.warn('Security incident created', {
      id: fullIncident.id,
      type: fullIncident.type,
      severity: fullIncident.severity,
      ipAddress: fullIncident.ipAddress
    });

    // Auto-resolve low severity incidents after 24 hours
    if (fullIncident.severity === 'low') {
      setTimeout(() => {
        this.resolveIncident(fullIncident.id);
      }, 24 * 60 * 60 * 1000);
    }
  }

  public resolveIncident(incidentId: string): boolean {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (incident) {
      incident.resolved = true;
      this.metrics.activeThreats = this.incidents.filter(i => !i.resolved).length;
      
      this.logger.info('Security incident resolved', { 
        incidentId,
        type: incident.type 
      });
      
      return true;
    }
    return false;
  }

  public getIncidents(): SecurityIncident[] {
    return [...this.incidents];
  }

  public getActiveIncidents(): SecurityIncident[] {
    return this.incidents.filter(i => !i.resolved);
  }

  public getMetrics(): SecurityMetrics {
    return {
      ...this.metrics,
      timestamp: new Date()
    };
  }

  public getSecurityReport(): {
    metrics: SecurityMetrics;
    incidents: SecurityIncident[];
    scanHistory: SecurityScanResult[];
    recommendations: string[];
    overallStatus: 'secure' | 'warning' | 'critical';
  } {
    const scanHistory = this.securityScanner.getScanHistory();
    const activeIncidents = this.getActiveIncidents();
    
    let overallStatus: 'secure' | 'warning' | 'critical' = 'secure';
    
    if (this.metrics.securityScore < 50 || activeIncidents.some(i => i.severity === 'critical')) {
      overallStatus = 'critical';
    } else if (this.metrics.securityScore < 80 || activeIncidents.some(i => i.severity === 'high')) {
      overallStatus = 'warning';
    }

    const recommendations = this.generateRecommendations();

    return {
      metrics: this.getMetrics(),
      incidents: this.getIncidents(),
      scanHistory,
      recommendations,
      overallStatus
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const activeIncidents = this.getActiveIncidents();
    const latestScan = this.securityScanner.getScanHistory().slice(-1)[0];

    if (this.metrics.securityScore < 70) {
      recommendations.push('Security score is below optimal level. Consider addressing vulnerabilities immediately.');
    }

    if (activeIncidents.length > 10) {
      recommendations.push('High number of active security incidents. Review and resolve critical issues.');
    }

    if (latestScan && latestScan.summary.critical > 0) {
      recommendations.push('Critical vulnerabilities detected. Immediate action required.');
    }

    if (this.metrics.cspViolations > 100) {
      recommendations.push('High number of CSP violations. Review and update Content Security Policy.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture is good. Continue regular monitoring and scanning.');
    }

    return recommendations;
  }

  public updateSecurityConfig(newConfig: Partial<SecurityServiceConfig>): void {
    if (newConfig.headers) {
      this.securityHeaders.updateConfig(newConfig.headers);
    }
    
    if (newConfig.csp) {
      this.cspManager.updateConfig(newConfig.csp);
    }
    
    if (newConfig.scanner) {
      this.securityScanner.updateConfig(newConfig.scanner);
    }

    this.logger.info('Security configuration updated', { config: newConfig });
  }

  public getSecurityConfig(): SecurityServiceConfig {
    return {
      headers: this.securityHeaders.getConfig(),
      csp: this.cspManager.getConfig(),
      scanner: this.securityScanner.getConfig()
    };
  }

  public exportSecurityData(): {
    timestamp: Date;
    metrics: SecurityMetrics;
    incidents: SecurityIncident[];
    scanHistory: SecurityScanResult[];
    config: SecurityServiceConfig;
  } {
    return {
      timestamp: new Date(),
      metrics: this.getMetrics(),
      incidents: this.getIncidents(),
      scanHistory: this.securityScanner.getScanHistory(),
      config: this.getSecurityConfig()
    };
  }

  public getNonceForRequest(req: Request): string | undefined {
    return this.cspManager.getNonceFromRequest(req);
  }
}

export default SecurityService;
