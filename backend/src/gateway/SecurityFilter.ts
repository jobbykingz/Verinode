import { Request } from 'express';
import { logger } from '../utils/logger';

export interface SecurityConfig {
  enableXSS: boolean;
  enableSQLInjection: boolean;
  enableCSRF: boolean;
  enableInputValidation: boolean;
  maxRequestSize: number;
  enableIPWhitelist: boolean;
  enableIPBlacklist: boolean;
  enableGeoBlocking: boolean;
  enableUserAgentFiltering: boolean;
  enableHeaderValidation: boolean;
  enableContentValidation: boolean;
  enableRateLimitSecurity: boolean;
  enableThrottling: boolean;
  enableAnomalyDetection: boolean;
  enableBehaviorAnalysis: boolean;
}

export interface SecurityRule {
  id: string;
  name: string;
  type: 'xss' | 'sql_injection' | 'csrf' | 'ip_filter' | 'geo_filter' | 'user_agent_filter' | 'header_filter' | 'content_filter' | 'anomaly' | 'behavior';
  enabled: boolean;
  priority: number;
  conditions: {
    path?: string;
    method?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
  };
  actions: {
    block?: boolean;
    log?: boolean;
    alert?: boolean;
    transform?: boolean;
    rate_limit?: {
      requests: number;
      window: number;
    };
  };
  patterns?: string[];
  thresholds?: {
    score?: number;
    frequency?: number;
    deviation?: number;
  };
  whitelist?: string[];
  blacklist?: string[];
}

export interface SecurityFilterResult {
  valid: boolean;
  blocked: boolean;
  score: number;
  violations: Array<{
    type: string;
    rule: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidence?: any;
    timestamp: number;
  }>;
  transformed?: {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
  };
  actions: {
    blocked: boolean;
    logged: boolean;
    alerted: boolean;
    transformed: boolean;
    rateLimited: boolean;
  };
  metadata: {
    ip: string;
    userAgent?: string;
    userId?: string;
    sessionId?: string;
    endpoint: string;
    timestamp: number;
    riskScore: number;
    reputationScore: number;
  };
}

export interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  allowedRequests: number;
  violationsByType: Record<string, number>;
  violationsByRule: Record<string, number>;
  violationsByIP: Record<string, number>;
  violationsByUser: Record<string, number>;
  violationsByEndpoint: Record<string, number>;
  averageRiskScore: number;
  highRiskRequests: number;
  criticalViolations: number;
  falsePositives: number;
  truePositives: number;
  detectionRate: number;
  falsePositiveRate: number;
}

export class SecurityFilter {
  private config: SecurityConfig;
  private rules: Map<string, SecurityRule> = new Map();
  private ipWhitelist: Set<string> = new Set();
  private ipBlacklist: Set<string> = new Set();
  private geoBlacklist: Set<string> = new Set();
  private userAgentBlacklist: Set<string> = new Set();
  private metrics: SecurityMetrics;
  private reputationCache: Map<string, number> = new Map();
  private behaviorCache: Map<string, any> = new Map();

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableXSS: true,
      enableSQLInjection: true,
      enableCSRF: true,
      enableInputValidation: true,
      maxRequestSize: 10485760, // 10MB
      enableIPWhitelist: false,
      enableIPBlacklist: true,
      enableGeoBlocking: false,
      enableUserAgentFiltering: true,
      enableHeaderValidation: true,
      enableContentValidation: true,
      enableRateLimitSecurity: true,
      enableThrottling: true,
      enableAnomalyDetection: false,
      enableBehaviorAnalysis: false,
      ...config,
    };

    this.initializeMetrics();
    this.initializeDefaultRules();
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      violationsByType: {},
      violationsByRule: {},
      violationsByIP: {},
      violationsByUser: {},
      violationsByEndpoint: {},
      averageRiskScore: 0,
      highRiskRequests: 0,
      criticalViolations: 0,
      falsePositives: 0,
      truePositives: 0,
      detectionRate: 0,
      falsePositiveRate: 0,
    };
  }

  private initializeDefaultRules(): void {
    // XSS Protection Rule
    this.addRule({
      id: 'xss_protection',
      name: 'Cross-Site Scripting Protection',
      type: 'xss',
      enabled: this.config.enableXSS,
      priority: 1,
      conditions: {},
      actions: {
        block: true,
        log: true,
        alert: true,
      },
      patterns: [
        '<script[^>]*>.*?</script>',
        'javascript:',
        'on\\w+\\s*=',
        'eval\\s*\\(',
        'expression\\s*\\(',
      ],
    });

    // SQL Injection Protection Rule
    this.addRule({
      id: 'sql_injection_protection',
      name: 'SQL Injection Protection',
      type: 'sql_injection',
      enabled: this.config.enableSQLInjection,
      priority: 1,
      conditions: {},
      actions: {
        block: true,
        log: true,
        alert: true,
      },
      patterns: [
        '(?i)(union|select|insert|update|delete|drop|create|alter|exec|execute)\\s+',
        '(?i)(or|and)\\s+\\d+\\s*=\\s*\\d+',
        '(?i)(or|and)\\s+\\w+\\s*=\\s*\\w+',
        '(?i)\'\\s*(or|and)\\s*\'\\d+\'\\s*=\\s*\'\\d+',
        '(?i)\\*\\s*(or|and)\\s*\\d+\\s*=\\s*\\d+',
      ],
    });

    // CSRF Protection Rule
    this.addRule({
      id: 'csrf_protection',
      name: 'Cross-Site Request Forgery Protection',
      type: 'csrf',
      enabled: this.config.enableCSRF,
      priority: 2,
      conditions: {
        method: 'POST',
      },
      actions: {
        block: false,
        log: true,
        alert: false,
      },
      patterns: [],
    });

    // IP Filter Rule
    this.addRule({
      id: 'ip_filter',
      name: 'IP Address Filtering',
      type: 'ip_filter',
      enabled: this.config.enableIPBlacklist || this.config.enableIPWhitelist,
      priority: 1,
      conditions: {},
      actions: {
        block: true,
        log: true,
        alert: false,
      },
    });

    // User Agent Filter Rule
    this.addRule({
      id: 'user_agent_filter',
      name: 'User Agent Filtering',
      type: 'user_agent_filter',
      enabled: this.config.enableUserAgentFiltering,
      priority: 2,
      conditions: {},
      actions: {
        block: true,
        log: true,
        alert: false,
      },
    });
  }

  public addRule(rule: SecurityRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Security rule added: ${rule.id}`);
  }

  public removeRule(ruleId: string): void {
    if (this.rules.delete(ruleId)) {
      logger.info(`Security rule removed: ${ruleId}`);
    }
  }

  public getRule(ruleId: string): SecurityRule | undefined {
    return this.rules.get(ruleId);
  }

  public getAllRules(): SecurityRule[] {
    return Array.from(this.rules.values());
  }

  public async filter(req: Request): Promise<SecurityFilterResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result: SecurityFilterResult = {
        valid: true,
        blocked: false,
        score: 0,
        violations: [],
        actions: {
          blocked: false,
          logged: false,
          alerted: false,
          transformed: false,
          rateLimited: false,
        },
        metadata: {
          ip: this.getClientIP(req),
          userAgent: req.headers['user-agent'],
          userId: this.getUserId(req),
          sessionId: this.getSessionId(req),
          endpoint: `${req.method}:${req.path}`,
          timestamp: startTime,
          riskScore: 0,
          reputationScore: this.getReputationScore(this.getClientIP(req)),
        },
      };

      // Check request size
      if (this.config.enableInputValidation && !this.checkRequestSize(req)) {
        result.valid = false;
        result.blocked = true;
        result.violations.push({
          type: 'size_limit',
          rule: 'request_size',
          severity: 'medium',
          description: 'Request size exceeds limit',
          timestamp: startTime,
        });
      }

      // Apply security rules
      for (const rule of this.rules.values()) {
        if (!rule.enabled) continue;

        const ruleResult = await this.applyRule(req, rule, result);
        if (ruleResult.violations.length > 0) {
          result.violations.push(...ruleResult.violations);
          result.score += ruleResult.score;
          
          if (ruleResult.blocked) {
            result.valid = false;
            result.blocked = true;
            result.actions.blocked = true;
          }

          if (ruleResult.logged) {
            result.actions.logged = true;
          }

          if (ruleResult.alerted) {
            result.actions.alerted = true;
          }
        }
      }

      // Apply transformations if needed
      if (result.valid && this.hasTransformations(result)) {
        result.transformed = await this.applyTransformations(req, result);
        result.actions.transformed = true;
      }

      // Calculate final risk score
      result.metadata.riskScore = this.calculateRiskScore(result);
      result.score = result.metadata.riskScore;

      // Update metrics
      this.updateMetrics(result);

      return result;

    } catch (error) {
      logger.error('Security filter error:', error);
      
      // Fail safe - allow request if security filter fails
      return {
        valid: true,
        blocked: false,
        score: 0,
        violations: [{
          type: 'system_error',
          rule: 'system',
          severity: 'low',
          description: 'Security filter system error',
          timestamp: startTime,
        }],
        actions: {
          blocked: false,
          logged: true,
          alerted: false,
          transformed: false,
          rateLimited: false,
        },
        metadata: {
          ip: this.getClientIP(req),
          endpoint: `${req.method}:${req.path}`,
          timestamp: startTime,
          riskScore: 0,
          reputationScore: 0,
        },
      };
    }
  }

  private async applyRule(req: Request, rule: SecurityRule, result: SecurityFilterResult): Promise<{ violations: any[]; score: number; blocked: boolean; logged: boolean; alerted: boolean }> {
    const violations: any[] = [];
    let score = 0;
    let blocked = false;
    let logged = false;
    let alerted = false;

    try {
      switch (rule.type) {
        case 'xss':
          const xssResult = this.checkXSS(req, rule);
          if (xssResult.detected) {
            violations.push(...xssResult.violations);
            score += xssResult.score;
            blocked = blocked || rule.actions.block;
            logged = logged || rule.actions.log;
            alerted = alerted || rule.actions.alert;
          }
          break;

        case 'sql_injection':
          const sqlResult = this.checkSQLInjection(req, rule);
          if (sqlResult.detected) {
            violations.push(...sqlResult.violations);
            score += sqlResult.score;
            blocked = blocked || rule.actions.block;
            logged = logged || rule.actions.log;
            alerted = alerted || rule.actions.alert;
          }
          break;

        case 'csrf':
          const csrfResult = this.checkCSRF(req, rule);
          if (csrfResult.detected) {
            violations.push(...csrfResult.violations);
            score += csrfResult.score;
            blocked = blocked || rule.actions.block;
            logged = logged || rule.actions.log;
            alerted = alerted || rule.actions.alert;
          }
          break;

        case 'ip_filter':
          const ipResult = this.checkIPFilter(req, rule);
          if (ipResult.detected) {
            violations.push(...ipResult.violations);
            score += ipResult.score;
            blocked = blocked || rule.actions.block;
            logged = logged || rule.actions.log;
            alerted = alerted || rule.actions.alert;
          }
          break;

        case 'geo_filter':
          const geoResult = this.checkGeoFilter(req, rule);
          if (geoResult.detected) {
            violations.push(...geoResult.violations);
            score += geoResult.score;
            blocked = blocked || rule.actions.block;
            logged = logged || rule.actions.log;
            alerted = alerted || rule.actions.alert;
          }
          break;

        case 'user_agent_filter':
          const userAgentResult = this.checkUserAgentFilter(req, rule);
          if (userAgentResult.detected) {
            violations.push(...userAgentResult.violations);
            score += userAgentResult.score;
            blocked = blocked || rule.actions.block;
            logged = logged || rule.actions.log;
            alerted = alerted || rule.actions.alert;
          }
          break;

        case 'header_filter':
          const headerResult = this.checkHeaderFilter(req, rule);
          if (headerResult.detected) {
            violations.push(...headerResult.violations);
            score += headerResult.score;
            blocked = blocked || rule.actions.block;
            logged = logged || rule.actions.log;
            alerted = alerted || rule.actions.alert;
          }
          break;

        case 'content_filter':
          const contentResult = this.checkContentFilter(req, rule);
          if (contentResult.detected) {
            violations.push(...contentResult.violations);
            score += contentResult.score;
            blocked = blocked || rule.actions.block;
            logged = logged || rule.actions.log;
            alerted = alerted || rule.actions.alert;
          }
          break;

        case 'anomaly':
          const anomalyResult = this.checkAnomaly(req, rule);
          if (anomalyResult.detected) {
            violations.push(...anomalyResult.violations);
            score += anomalyResult.score;
            blocked = blocked || rule.actions.block;
            logged = logged || rule.actions.log;
            alerted = alerted || rule.actions.alert;
          }
          break;

        case 'behavior':
          const behaviorResult = this.checkBehavior(req, rule);
          if (behaviorResult.detected) {
            violations.push(...behaviorResult.violations);
            score += behaviorResult.score;
            blocked = blocked || rule.actions.block;
            logged = logged || rule.actions.log;
            alerted = alerted || rule.actions.alert;
          }
          break;
      }

      return { violations, score, blocked, logged, alerted };

    } catch (error) {
      logger.error(`Security rule ${rule.id} error:`, error);
      return { violations: [], score: 0, blocked: false, logged: false, alerted: false };
    }
  }

  private checkXSS(req: Request, rule: SecurityRule): { detected: boolean; violations: any[]; score: number } {
    const violations: any[] = [];
    let detected = false;
    let score = 0;

    const content = this.getRequestContent(req);
    const patterns = rule.patterns || [];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      const matches = content.match(regex);
      
      if (matches) {
        detected = true;
        score += matches.length * 10;
        
        violations.push({
          type: 'xss',
          rule: rule.id,
          severity: 'high',
          description: `XSS pattern detected: ${pattern}`,
          evidence: {
            pattern,
            matches: matches.slice(0, 3), // Limit evidence
            location: this.getDetectionLocation(content, pattern),
          },
          timestamp: Date.now(),
        });
      }
    }

    return { detected, violations, score };
  }

  private checkSQLInjection(req: Request, rule: SecurityRule): { detected: boolean; violations: any[]; score: number } {
    const violations: any[] = [];
    let detected = false;
    let score = 0;

    const content = this.getRequestContent(req);
    const patterns = rule.patterns || [];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      const matches = content.match(regex);
      
      if (matches) {
        detected = true;
        score += matches.length * 15;
        
        violations.push({
          type: 'sql_injection',
          rule: rule.id,
          severity: 'critical',
          description: `SQL injection pattern detected: ${pattern}`,
          evidence: {
            pattern,
            matches: matches.slice(0, 3),
            location: this.getDetectionLocation(content, pattern),
          },
          timestamp: Date.now(),
        });
      }
    }

    return { detected, violations, score };
  }

  private checkCSRF(req: Request, rule: SecurityRule): { detected: boolean; violations: any[]; score: number } {
    const violations: any[] = [];
    let detected = false;
    let score = 0;

    // Simple CSRF check - in production, use proper CSRF tokens
    const referer = req.headers.referer;
    const origin = req.headers.origin;
    const host = req.headers.host;

    if (!referer && !origin && req.method === 'POST') {
      detected = true;
      score += 5;
      
      violations.push({
        type: 'csrf',
        rule: rule.id,
        severity: 'medium',
        description: 'Missing referer and origin headers for POST request',
        evidence: {
          method: req.method,
          referer,
          origin,
          host,
        },
        timestamp: Date.now(),
      });
    }

    return { detected, violations, score };
  }

  private checkIPFilter(req: Request, rule: SecurityRule): { detected: boolean; violations: any[]; score: number } {
    const violations: any[] = [];
    let detected = false;
    let score = 0;

    const ip = this.getClientIP(req);

    // Check blacklist first
    if (this.config.enableIPBlacklist && this.ipBlacklist.has(ip)) {
      detected = true;
      score += 20;
      
      violations.push({
        type: 'ip_blacklist',
        rule: rule.id,
        severity: 'high',
        description: 'IP address is blacklisted',
        evidence: { ip },
        timestamp: Date.now(),
      });
    }

    // Check whitelist if enabled
    if (this.config.enableIPWhitelist && this.ipWhitelist.size > 0 && !this.ipWhitelist.has(ip)) {
      detected = true;
      score += 15;
      
      violations.push({
        type: 'ip_whitelist',
        rule: rule.id,
        severity: 'medium',
        description: 'IP address not in whitelist',
        evidence: { ip },
        timestamp: Date.now(),
      });
    }

    return { detected, violations, score };
  }

  private checkGeoFilter(req: Request, rule: SecurityRule): { detected: boolean; violations: any[]; score: number } {
    const violations: any[] = [];
    let detected = false;
    let score = 0;

    if (!this.config.enableGeoBlocking) {
      return { detected, violations, score };
    }

    const geo = this.getGeoLocation(req);
    
    if (geo && this.geoBlacklist.has(geo)) {
      detected = true;
      score += 18;
      
      violations.push({
        type: 'geo_blacklist',
        rule: rule.id,
        severity: 'medium',
        description: 'Geographic location is blocked',
        evidence: { geo, ip: this.getClientIP(req) },
        timestamp: Date.now(),
      });
    }

    return { detected, violations, score };
  }

  private checkUserAgentFilter(req: Request, rule: SecurityRule): { detected: boolean; violations: any[]; score: number } {
    const violations: any[] = [];
    let detected = false;
    let score = 0;

    const userAgent = req.headers['user-agent'] || '';

    // Check for suspicious user agents
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userAgent)) {
        detected = true;
        score += 8;
        
        violations.push({
          type: 'user_agent',
          rule: rule.id,
          severity: 'low',
          description: 'Suspicious user agent detected',
          evidence: { userAgent, pattern: pattern.source },
          timestamp: Date.now(),
        });
        break;
      }
    }

    // Check blacklist
    if (this.userAgentBlacklist.has(userAgent)) {
      detected = true;
      score += 12;
      
      violations.push({
        type: 'user_agent_blacklist',
        rule: rule.id,
        severity: 'medium',
        description: 'User agent is blacklisted',
        evidence: { userAgent },
        timestamp: Date.now(),
      });
    }

    return { detected, violations, score };
  }

  private checkHeaderFilter(req: Request, rule: SecurityRule): { detected: boolean; violations: any[]; score: number } {
    const violations: any[] = [];
    let detected = false;
    let score = 0;

    // Check for suspicious headers
    const suspiciousHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-originating-ip',
      'x-remote-ip',
      'x-remote-addr',
    ];

    for (const header of suspiciousHeaders) {
      if (req.headers[header]) {
        detected = true;
        score += 3;
        
        violations.push({
          type: 'suspicious_header',
          rule: rule.id,
          severity: 'low',
          description: `Suspicious header detected: ${header}`,
          evidence: { [header]: req.headers[header] },
          timestamp: Date.now(),
        });
      }
    }

    return { detected, violations, score };
  }

  private checkContentFilter(req: Request, rule: SecurityRule): { detected: boolean; violations: any[]; score: number } {
    const violations: any[] = [];
    let detected = false;
    let score = 0;

    const content = this.getRequestContent(req);

    // Check for suspicious content patterns
    const suspiciousPatterns = [
      /\b(password|passwd|pwd)\s*[:=]\s*\S+/i,
      /\b(api[_-]?key|apikey|access[_-]?token)\s*[:=]\s*\S+/i,
      /\b(secret|private[_-]?key|auth[_-]?token)\s*[:=]\s*\S+/i,
    ];

    for (const pattern of suspiciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        detected = true;
        score += matches.length * 5;
        
        violations.push({
          type: 'suspicious_content',
          rule: rule.id,
          severity: 'medium',
          description: 'Suspicious content pattern detected',
          evidence: {
            pattern: pattern.source,
            matches: matches.slice(0, 2), // Limit evidence
          },
          timestamp: Date.now(),
        });
      }
    }

    return { detected, violations, score };
  }

  private checkAnomaly(req: Request, rule: SecurityRule): { detected: boolean; violations: any[]; score: number } {
    const violations: any[] = [];
    let detected = false;
    let score = 0;

    if (!this.config.enableAnomalyDetection) {
      return { detected, violations, score };
    }

    // Simple anomaly detection - in production, use machine learning
    const ip = this.getClientIP(req);
    const endpoint = `${req.method}:${req.path}`;
    
    // Check for unusual request patterns
    const requestSize = JSON.stringify(req.body || {}).length;
    const headerCount = Object.keys(req.headers).length;
    
    if (requestSize > 100000) { // Large request
      detected = true;
      score += 10;
      
      violations.push({
        type: 'anomaly',
        rule: rule.id,
        severity: 'medium',
        description: 'Unusually large request',
        evidence: { requestSize },
        timestamp: Date.now(),
      });
    }

    if (headerCount > 20) { // Too many headers
      detected = true;
      score += 5;
      
      violations.push({
        type: 'anomaly',
        rule: rule.id,
        severity: 'low',
        description: 'Unusually many headers',
        evidence: { headerCount },
        timestamp: Date.now(),
      });
    }

    return { detected, violations, score };
  }

  private checkBehavior(req: Request, rule: SecurityRule): { detected: boolean; violations: any[]; score: number } {
    const violations: any[] = [];
    let detected = false;
    let score = 0;

    if (!this.config.enableBehaviorAnalysis) {
      return { detected, violations, score };
    }

    // Simple behavior analysis - in production, use machine learning
    const ip = this.getClientIP(req);
    const now = Date.now();
    
    const behavior = this.behaviorCache.get(ip) || {
      requests: [],
      endpoints: new Set(),
      lastSeen: now,
    };

    behavior.requests.push(now);
    behavior.endpoints.add(`${req.method}:${req.path}`);
    behavior.lastSeen = now;

    // Clean old requests (keep last hour)
    const hourAgo = now - 3600000;
    behavior.requests = behavior.requests.filter(time => time > hourAgo);

    // Check for rapid requests
    if (behavior.requests.length > 100) { // More than 100 requests per hour
      detected = true;
      score += 15;
      
      violations.push({
        type: 'behavior',
        rule: rule.id,
        severity: 'medium',
        description: 'High frequency requests detected',
        evidence: { requestCount: behavior.requests.length, timeWindow: '1 hour' },
        timestamp: now,
      });
    }

    // Check for endpoint diversity (potential scraping)
    if (behavior.endpoints.size > 50) {
      detected = true;
      score += 10;
      
      violations.push({
        type: 'behavior',
        rule: rule.id,
        severity: 'low',
        description: 'High endpoint diversity detected',
        evidence: { endpointCount: behavior.endpoints.size },
        timestamp: now,
      });
    }

    this.behaviorCache.set(ip, behavior);

    return { detected, violations, score };
  }

  private checkRequestSize(req: Request): boolean {
    const size = JSON.stringify(req.body || {}).length;
    return size <= this.config.maxRequestSize;
  }

  private getRequestContent(req: Request): string {
    const parts: string[] = [];
    
    // Add query parameters
    if (req.query) {
      parts.push(JSON.stringify(req.query));
    }
    
    // Add body
    if (req.body) {
      parts.push(JSON.stringify(req.body));
    }
    
    // Add headers (selected ones)
    const headers = ['user-agent', 'referer', 'origin', 'x-forwarded-for'];
    for (const header of headers) {
      if (req.headers[header]) {
        parts.push(`${header}: ${req.headers[header]}`);
      }
    }
    
    return parts.join(' ').toLowerCase();
  }

  private getDetectionLocation(content: string, pattern: string): string {
    const index = content.search(new RegExp(pattern, 'gi'));
    if (index === -1) return 'unknown';
    
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + pattern.length + 50);
    return content.substring(start, end);
  }

  private hasTransformations(result: SecurityFilterResult): boolean {
    return result.violations.some(v => v.type === 'xss' || v.type === 'sql_injection');
  }

  private async applyTransformations(req: Request, result: SecurityFilterResult): Promise<any> {
    const transformed: any = {};

    // Sanitize XSS content
    if (result.violations.some(v => v.type === 'xss')) {
      transformed.body = this.sanitizeXSS(req.body);
      transformed.query = this.sanitizeXSS(req.query);
    }

    // Sanitize SQL injection content
    if (result.violations.some(v => v.type === 'sql_injection')) {
      transformed.body = this.sanitizeSQLInjection(transformed.body || req.body);
      transformed.query = this.sanitizeSQLInjection(transformed.query || req.query);
    }

    return transformed;
  }

  private sanitizeXSS(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeXSS(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeXSS(value);
      }
      return sanitized;
    }
    
    return data;
  }

  private sanitizeSQLInjection(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(/['"\\]/g, '')
        .replace(/(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi, '')
        .replace(/(or|and)\s+\d+\s*=\s*\d+/gi, '')
        .replace(/(or|and)\s+\w+\s*=\s*\w+/gi, '');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeSQLInjection(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeSQLInjection(value);
      }
      return sanitized;
    }
    
    return data;
  }

  private calculateRiskScore(result: SecurityFilterResult): number {
    let score = result.score;
    
    // Add reputation score impact
    score += (100 - result.metadata.reputationScore) * 0.1;
    
    // Add violation severity weights
    for (const violation of result.violations) {
      switch (violation.severity) {
        case 'critical':
          score += 25;
          break;
        case 'high':
          score += 15;
          break;
        case 'medium':
          score += 10;
          break;
        case 'low':
          score += 5;
          break;
      }
    }
    
    return Math.min(100, score); // Cap at 100
  }

  private updateMetrics(result: SecurityFilterResult): void {
    if (result.blocked) {
      this.metrics.blockedRequests++;
    } else {
      this.metrics.allowedRequests++;
    }

    // Update violation counts
    for (const violation of result.violations) {
      this.metrics.violationsByType[violation.type] = (this.metrics.violationsByType[violation.type] || 0) + 1;
      this.metrics.violationsByRule[violation.rule] = (this.metrics.violationsByRule[violation.rule] || 0) + 1;
      
      if (result.metadata.ip) {
        this.metrics.violationsByIP[result.metadata.ip] = (this.metrics.violationsByIP[result.metadata.ip] || 0) + 1;
      }
      
      if (result.metadata.userId) {
        this.metrics.violationsByUser[result.metadata.userId] = (this.metrics.violationsByUser[result.metadata.userId] || 0) + 1;
      }
      
      this.metrics.violationsByEndpoint[result.metadata.endpoint] = (this.metrics.violationsByEndpoint[result.metadata.endpoint] || 0) + 1;
      
      if (violation.severity === 'critical') {
        this.metrics.criticalViolations++;
      }
    }

    // Update risk score metrics
    const totalRequests = this.metrics.allowedRequests + this.metrics.blockedRequests;
    this.metrics.averageRiskScore = (this.metrics.averageRiskScore * (totalRequests - 1) + result.metadata.riskScore) / totalRequests;
    
    if (result.metadata.riskScore > 70) {
      this.metrics.highRiskRequests++;
    }
  }

  // Helper methods
  private getClientIP(req: Request): string {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
           '127.0.0.1';
  }

  private getUserId(req: Request): string | undefined {
    return req.headers['x-user-id'] as string || 
           (req as any).user?.id || 
           (req as any).session?.userId;
  }

  private getSessionId(req: Request): string | undefined {
    return req.headers['x-session-id'] as string || 
           (req as any).session?.id;
  }

  private getGeoLocation(req: Request): string | undefined {
    // Simple geo location detection - in production, use a proper geo IP service
    const ip = this.getClientIP(req);
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return 'internal';
    }
    return 'unknown';
  }

  private getReputationScore(ip: string): number {
    // Simple reputation scoring - in production, use a reputation service
    const cached = this.reputationCache.get(ip);
    if (cached !== undefined) {
      return cached;
    }

    // Default reputation score (0-100, higher is better)
    let score = 80;

    // Penalize blacklisted IPs
    if (this.ipBlacklist.has(ip)) {
      score = 10;
    }

    // Penalize IPs with many violations
    const violations = this.metrics.violationsByIP[ip] || 0;
    score -= Math.min(violations * 5, 50);

    this.reputationCache.set(ip, score);
    return score;
  }

  // Public methods for managing lists
  public addToIPWhitelist(ip: string): void {
    this.ipWhitelist.add(ip);
    logger.info(`IP added to whitelist: ${ip}`);
  }

  public removeFromIPWhitelist(ip: string): void {
    this.ipWhitelist.delete(ip);
    logger.info(`IP removed from whitelist: ${ip}`);
  }

  public addToIPBlacklist(ip: string): void {
    this.ipBlacklist.add(ip);
    logger.info(`IP added to blacklist: ${ip}`);
  }

  public removeFromIPBlacklist(ip: string): void {
    this.ipBlacklist.delete(ip);
    logger.info(`IP removed from blacklist: ${ip}`);
  }

  public addToGeoBlacklist(country: string): void {
    this.geoBlacklist.add(country);
    logger.info(`Country added to geo blacklist: ${country}`);
  }

  public removeFromGeoBlacklist(country: string): void {
    this.geoBlacklist.delete(country);
    logger.info(`Country removed from geo blacklist: ${country}`);
  }

  public addToUserAgentBlacklist(userAgent: string): void {
    this.userAgentBlacklist.add(userAgent);
    logger.info(`User agent added to blacklist: ${userAgent}`);
  }

  public removeFromUserAgentBlacklist(userAgent: string): void {
    this.userAgentBlacklist.delete(userAgent);
    logger.info(`User agent removed from blacklist: ${userAgent}`);
  }

  // Public metrics methods
  public async getMetrics(): Promise<SecurityMetrics> {
    return { ...this.metrics };
  }

  public async resetMetrics(): Promise<void> {
    this.initializeMetrics();
    logger.info('SecurityFilter metrics reset');
  }

  public getConfig(): SecurityConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('SecurityFilter configuration updated');
  }

  public clearCaches(): void {
    this.reputationCache.clear();
    this.behaviorCache.clear();
    logger.info('SecurityFilter caches cleared');
  }
}
