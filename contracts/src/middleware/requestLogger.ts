import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

interface LogEntry {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  userId?: string;
  statusCode?: number;
  responseTime?: number;
  contentLength?: number;
  referer?: string;
  headers: Record<string, string>;
  body?: any;
  query?: any;
  params?: any;
  errors?: string[];
  securityFlags: SecurityFlag[];
}

interface SecurityFlag {
  type: 'suspicious_ip' | 'rate_limit' | 'invalid_auth' | 'sql_injection' | 'xss_attempt' | 'large_payload' | 'unusual_user_agent';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

class RequestLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 10000;
  private suspiciousPatterns: RegExp[] = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i, // SQL injection
    /(<script|javascript:|on\w+=)/i, // XSS attempts
    /(\/etc\/passwd|\/proc\/|\/sys\/)/i, // Path traversal
    /(\.\.\/|\.\.\\)/, // Directory traversal
    /(<iframe|<object|<embed)/i, // Injection attempts
  ];

  private suspiciousUserAgents: RegExp[] = [
    /bot|crawler|spider|scraper/i,
    /curl|wget|python|java|go|ruby|php/i,
    /nmap|nikto|sqlmap|burp|owasp/i,
  ];

  logRequest(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = randomUUID();
    
    // Store original res.end to capture response data
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Log the request
      logger.logCompletedRequest(req, res, requestId, responseTime, chunk);
      
      // Call original end
      originalEnd.call(this, chunk, encoding);
    };

    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);
    
    next();
  }

  private logCompletedRequest(
    req: Request, 
    res: Response, 
    requestId: string, 
    responseTime: number,
    chunk?: any
  ): void {
    const securityFlags = this.analyzeSecurityFlags(req, res);
    
    const logEntry: LogEntry = {
      id: requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'Unknown',
      userId: (req as any).user?.id,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.get('Content-Length') ? parseInt(res.get('Content-Length')!) : undefined,
      referer: req.get('Referer'),
      headers: this.sanitizeHeaders(req.headers),
      body: this.sanitizeBody(req.body),
      query: req.query,
      params: req.params,
      securityFlags
    };

    this.addLog(logEntry);

    // Log to console for immediate visibility
    this.consoleLog(logEntry);

    // Alert on high-severity security flags
    this.alertOnSecurityFlags(logEntry);
  }

  private analyzeSecurityFlags(req: Request, res: Response): SecurityFlag[] {
    const flags: SecurityFlag[] = [];
    const userAgent = req.get('User-Agent') || '';
    const url = req.originalUrl || req.url;
    const body = JSON.stringify(req.body || {});
    const query = JSON.stringify(req.query || {});

    const combinedInput = url + ' ' + body + ' ' + query;

    // Check for suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(combinedInput)) {
        flags.push({
          type: pattern.source.includes('SELECT') ? 'sql_injection' : 'xss_attempt',
          severity: 'high',
          description: `Suspicious pattern detected: ${pattern.source}`
        });
      }
    }

    // Check for suspicious user agents
    for (const uaPattern of this.suspiciousUserAgents) {
      if (uaPattern.test(userAgent)) {
        flags.push({
          type: 'unusual_user_agent',
          severity: 'medium',
          description: `Suspicious user agent: ${userAgent}`
        });
      }
    }

    // Check for large payloads
    const contentLength = req.get('Content-Length');
    if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB
      flags.push({
        type: 'large_payload',
        severity: 'medium',
        description: `Large payload detected: ${contentLength} bytes`
      });
    }

    // Check for authentication failures
    if (res.statusCode === 401 || res.statusCode === 403) {
      flags.push({
        type: 'invalid_auth',
        severity: 'medium',
        description: `Authentication failure: ${res.statusCode}`
      });
    }

    // Check for rate limiting
    if (res.statusCode === 429) {
      flags.push({
        type: 'rate_limit',
        severity: 'low',
        description: 'Rate limit exceeded'
      });
    }

    return flags;
  }

  private getClientIP(req: Request): string {
    return req.ip || 
           req.headers['x-forwarded-for'] as string || 
           req.headers['x-real-ip'] as string || 
           req.connection.remoteAddress || 
           'unknown';
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;
    
    const sanitized = JSON.parse(JSON.stringify(body));
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'creditCard'];
    
    const redactSensitive = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(redactSensitive);
      }
      
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = redactSensitive(value);
        }
      }
      
      return result;
    };
    
    return redactSensitive(sanitized);
  }

  private addLog(logEntry: LogEntry): void {
    this.logs.push(logEntry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private consoleLog(logEntry: LogEntry): void {
    const logLevel = this.getLogLevel(logEntry);
    const message = `${logEntry.method} ${logEntry.url} - ${logEntry.statusCode} - ${logEntry.responseTime}ms`;
    
    if (logEntry.securityFlags.length > 0) {
      console.warn(`[SECURITY] ${message}`, {
        flags: logEntry.securityFlags,
        ip: logEntry.ip,
        userAgent: logEntry.userAgent
      });
    } else {
      console.log(`[${logLevel}] ${message}`);
    }
  }

  private getLogLevel(logEntry: LogEntry): string {
    if (!logEntry.statusCode) return 'INFO';
    if (logEntry.statusCode >= 500) return 'ERROR';
    if (logEntry.statusCode >= 400) return 'WARN';
    return 'INFO';
  }

  private alertOnSecurityFlags(logEntry: LogEntry): void {
    const criticalFlags = logEntry.securityFlags.filter(flag => flag.severity === 'critical');
    const highFlags = logEntry.securityFlags.filter(flag => flag.severity === 'high');
    
    if (criticalFlags.length > 0 || highFlags.length > 0) {
      console.error('🚨 SECURITY ALERT:', {
        requestId: logEntry.id,
        ip: logEntry.ip,
        url: logEntry.url,
        flags: [...criticalFlags, ...highFlags],
        timestamp: logEntry.timestamp
      });
    }
  }

  // Public methods for accessing logs
  getLogs(limit?: number): LogEntry[] {
    return limit ? this.logs.slice(-limit) : this.logs;
  }

  getLogsByIP(ip: string, limit?: number): LogEntry[] {
    const filtered = this.logs.filter(log => log.ip === ip);
    return limit ? filtered.slice(-limit) : filtered;
  }

  getSecurityLogs(severity?: string, limit?: number): LogEntry[] {
    let filtered = this.logs.filter(log => log.securityFlags.length > 0);
    
    if (severity) {
      filtered = filtered.filter(log => 
        log.securityFlags.some(flag => flag.severity === severity)
      );
    }
    
    return limit ? filtered.slice(-limit) : filtered;
  }

  clearLogs(): void {
    this.logs = [];
  }

  getStats(): any {
    const totalRequests = this.logs.length;
    const securityIncidents = this.logs.filter(log => log.securityFlags.length > 0).length;
    const avgResponseTime = this.logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / totalRequests;
    
    return {
      totalRequests,
      securityIncidents,
      avgResponseTime: Math.round(avgResponseTime),
      uniqueIPs: new Set(this.logs.map(log => log.ip)).size,
      lastHour: this.logs.filter(log => 
        new Date(log.timestamp).getTime() > Date.now() - 60 * 60 * 1000
      ).length
    };
  }
}

export const logger = new RequestLogger();

// Middleware function
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  logger.logRequest(req, res, next);
};
