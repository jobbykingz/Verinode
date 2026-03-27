import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit/AuditService';
import { AuditEventType, AuditSeverity, AuditStatus } from '../models/AuditLog';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

/**
 * Middleware Configuration
 */
export interface AuditMiddlewareConfig {
  // Event capture settings
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  captureHeaders?: boolean;
  maxBodySize?: number;
  
  // Filtering settings
  excludePaths?: string[];
  excludeMethods?: string[];
  excludeStatusCodes?: number[];
  excludeUserAgents?: string[];
  
  // Sensitivity settings
  sensitiveFields?: string[];
  maskSensitiveData?: boolean;
  
  // Performance settings
  enableBatching?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  
  // Security settings
  enableRateLimit?: boolean;
  rateLimitWindow?: number;
  rateLimitMax?: number;
}

/**
 * Request Context
 */
export interface RequestContext {
  requestId: string;
  correlationId: string;
  userId?: string;
  sessionId?: string;
  startTime: number;
  userAgent?: string;
  ipAddress?: string;
  method?: string;
  endpoint?: string;
  path?: string;
  query?: any;
  headers?: any;
  body?: any;
}

/**
 * Enhanced Request with Audit Context
 */
declare global {
  namespace Express {
    interface Request {
      auditContext?: RequestContext;
    }
  }
}

/**
 * Audit Middleware Factory
 * 
 * Provides automatic audit trail capture for HTTP requests:
 * - Request/response logging
 * - User activity tracking
 * - Security event detection
 * - Performance monitoring
 * - Rate limiting and protection
 */
export class AuditMiddleware {
  private config: AuditMiddlewareConfig;
  private rateLimiter?: any;

  constructor(config: AuditMiddlewareConfig = {}) {
    this.config = {
      captureRequestBody: false,
      captureResponseBody: false,
      captureHeaders: true,
      maxBodySize: 1024 * 1024, // 1MB
      excludePaths: ['/health', '/metrics', '/favicon.ico'],
      excludeMethods: ['OPTIONS', 'HEAD'],
      excludeStatusCodes: [200, 201, 204],
      excludeUserAgents: [],
      sensitiveFields: ['password', 'token', 'secret', 'key', 'credit_card'],
      maskSensitiveData: true,
      enableBatching: true,
      batchSize: 100,
      batchTimeout: 5000,
      enableRateLimit: true,
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 100, // 100 requests per window
      ...config
    };

    // Initialize rate limiter if enabled
    if (this.config.enableRateLimit) {
      this.rateLimiter = rateLimit({
        windowMs: this.config.rateLimitWindow!,
        max: this.config.rateLimitMax!,
        message: {
          error: 'Too many requests',
          retryAfter: Math.ceil(this.config.rateLimitWindow! / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req: Request, res: Response) => {
          this.logSecurityEvent(req, 'RATE_LIMIT_EXCEEDED', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: req.path,
            method: req.method
          });
          res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(this.config.rateLimitWindow! / 1000)
          });
        }
      });
    }
  }

  /**
   * Main audit middleware
   */
  auditMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip excluded paths
      if (this.shouldExcludeRequest(req)) {
        return next();
      }

      // Create request context
      const context = this.createRequestContext(req);
      req.auditContext = context;

      // Capture original res.json and res.send
      const originalJson = res.json;
      const originalSend = res.send;
      let responseBody: any;

      // Override res.json to capture response
      res.json = function(data: any) {
        responseBody = data;
        return originalJson.call(this, data);
      };

      // Override res.send to capture response
      res.send = function(data: any) {
        responseBody = data;
        return originalSend.call(this, data);
      };

      // Listen for response finish
      res.on('finish', async () => {
        await this.logRequest(req, res, responseBody);
      });

      // Listen for response close (client disconnected)
      res.on('close', async () => {
        await this.logRequest(req, res, responseBody, true);
      });

      next();
    };
  }

  /**
   * Authentication middleware
   */
  authMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const context = req.auditContext;
      if (!context) {
        return next();
      }

      // Extract user info from request (assuming JWT or similar)
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          // This would typically decode JWT and extract user info
          // For now, we'll use a placeholder
          context.userId = this.extractUserIdFromToken(token);
          context.sessionId = this.extractSessionIdFromToken(token);
        } catch (error) {
          // Invalid token - log security event
          this.logSecurityEvent(req, 'INVALID_TOKEN', {
            token: token.substring(0, 10) + '...',
            error: error
          });
        }
      }

      next();
    };
  }

  /**
   * Security middleware
   */
  securityMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const context = req.auditContext;
      if (!context) {
        return next();
      }

      // Check for suspicious patterns
      this.checkForSuspiciousActivity(req);

      // Apply rate limiting if enabled
      if (this.rateLimiter) {
        return this.rateLimiter(req, res, next);
      }

      next();
    };
  }

  /**
   * Error handling middleware
   */
  errorMiddleware() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const context = req.auditContext;
      if (!context) {
        return next(error);
      }

      // Log error event
      this.logErrorEvent(req, error);

      next(error);
    };
  }

  /**
   * CRUD operation middleware
   */
  crudMiddleware(resourceType: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const context = req.auditContext;
      if (!context) {
        return next();
      }

      // Store resource info for later logging
      context.path = req.path;
      context.query = req.query;

      // Listen for response to log CRUD operation
      res.on('finish', async () => {
        await this.logCrudOperation(req, res, resourceType);
      });

      next();
    };
  }

  /**
   * File upload middleware
   */
  fileUploadMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const context = req.auditContext;
      if (!context) {
        return next();
      }

      // Log file upload events
      if (req.files && Object.keys(req.files).length > 0) {
        this.logFileUploadEvent(req);
      }

      next();
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimitMiddleware(options: {
    windowMs?: number;
    max?: number;
    message?: string;
  } = {}) {
    return rateLimit({
      windowMs: options.windowMs || this.config.rateLimitWindow!,
      max: options.max || this.config.rateLimitMax!,
      message: options.message || 'Too many requests',
      handler: (req: Request, res: Response) => {
        this.logSecurityEvent(req, 'RATE_LIMIT_EXCEEDED', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method
        });
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((options.windowMs || this.config.rateLimitWindow!) / 1000)
        });
      }
    });
  }

  /**
   * Private helper methods
   */
  private shouldExcludeRequest(req: Request): boolean {
    // Check excluded paths
    if (this.config.excludePaths?.some(path => req.path.startsWith(path))) {
      return true;
    }

    // Check excluded methods
    if (this.config.excludeMethods?.includes(req.method)) {
      return true;
    }

    // Check excluded user agents
    const userAgent = req.get('User-Agent');
    if (userAgent && this.config.excludeUserAgents?.some(ua => userAgent.includes(ua))) {
      return true;
    }

    return false;
  }

  private createRequestContext(req: Request): RequestContext {
    return {
      requestId: `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
      correlationId: req.get('X-Correlation-ID') || `corr_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
      userId: undefined,
      sessionId: undefined,
      startTime: Date.now(),
      userAgent: req.get('User-Agent'),
      ipAddress: this.getClientIP(req),
      method: req.method,
      endpoint: req.path,
      path: req.path,
      query: req.query,
      headers: this.config.captureHeaders ? this.sanitizeHeaders(req.headers) : undefined,
      body: this.config.captureRequestBody ? this.sanitizeBody(req.body) : undefined
    };
  }

  private getClientIP(req: Request): string {
    return req.ip || 
           req.get('X-Forwarded-For')?.split(',')[0] || 
           req.get('X-Real-IP') || 
           req.connection.remoteAddress || 
           'unknown';
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[MASKED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    if (typeof body === 'string') {
      // Check if body size exceeds limit
      if (body.length > (this.config.maxBodySize || 1024 * 1024)) {
        return '[BODY_TOO_LARGE]';
      }
      return body;
    }

    if (typeof body === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(body)) {
        if (this.isSensitiveField(key)) {
          sanitized[key] = '[MASKED]';
        } else if (typeof value === 'string' && value.length > (this.config.maxBodySize || 1024 * 1024)) {
          sanitized[key] = '[VALUE_TOO_LARGE]';
        } else {
          sanitized[key] = value;
        }
      }
      
      return sanitized;
    }

    return body;
  }

  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.config.sensitiveFields?.some(sensitive => 
      lowerFieldName.includes(sensitive.toLowerCase())
    ) || false;
  }

  private async logRequest(req: Request, res: Response, responseBody?: any, disconnected = false): Promise<void> {
    try {
      const context = req.auditContext;
      if (!context) return;

      // Skip excluded status codes
      if (this.config.excludeStatusCodes?.includes(res.statusCode)) {
        return;
      }

      const duration = Date.now() - context.startTime;
      
      // Determine event type and severity
      const { eventType, severity } = this.getEventTypeAndSeverity(req.method, res.statusCode);

      // Log the audit event
      await auditService.logEvent({
        eventType,
        severity,
        status: res.statusCode < 400 ? AuditStatus.SUCCESS : AuditStatus.FAILURE,
        action: `${req.method} ${req.path}`,
        resourceType: 'HTTP',
        resourceId: context.requestId,
        resourceUrl: req.url,
        userId: context.userId,
        sessionId: context.sessionId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        requestId: context.requestId,
        correlationId: context.correlationId,
        method: req.method,
        endpoint: req.path,
        oldValues: context.body,
        newValues: responseBody && this.config.captureResponseBody ? responseBody : undefined,
        metadata: {
          statusCode: res.statusCode,
          duration,
          disconnected,
          headers: context.headers,
          query: context.query
        },
        tags: ['http', req.method.toLowerCase(), res.statusCode.toString()]
      });
    } catch (error) {
      console.error('Failed to log audit request:', error);
    }
  }

  private async logCrudOperation(req: Request, res: Response, resourceType: string): Promise<void> {
    try {
      const context = req.auditContext;
      if (!context) return;

      const operation = this.mapMethodToOperation(req.method);
      if (!operation) return;

      const resourceId = req.params.id || req.body?.id;
      
      await auditService.logEvent({
        eventType: this.getCrudEventType(operation),
        severity: this.getCrudSeverity(operation, resourceType),
        action: `${operation} ${resourceType}`,
        resourceType,
        resourceId,
        userId: context.userId,
        sessionId: context.sessionId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        requestId: context.requestId,
        correlationId: context.correlationId,
        method: req.method,
        endpoint: req.path,
        oldValues: operation === 'UPDATE' ? req.body : undefined,
        newValues: ['CREATE', 'UPDATE'].includes(operation) ? req.body : undefined,
        metadata: {
          operation,
          resourceType,
          params: req.params
        },
        tags: ['crud', operation.toLowerCase(), resourceType.toLowerCase()]
      });
    } catch (error) {
      console.error('Failed to log CRUD operation:', error);
    }
  }

  private async logSecurityEvent(req: Request, eventType: string, details: any): Promise<void> {
    try {
      await auditService.logEvent({
        eventType: eventType as any,
        severity: AuditSeverity.HIGH,
        status: AuditStatus.WARNING,
        action: eventType.toLowerCase().replace('_', ' '),
        resourceType: 'Security',
        resourceId: details.ip,
        userAgent: req.get('User-Agent'),
        ipAddress: this.getClientIP(req),
        requestId: req.auditContext?.requestId,
        correlationId: req.auditContext?.correlationId,
        method: req.method,
        endpoint: req.path,
        metadata: details,
        tags: ['security', 'threat', eventType.toLowerCase()]
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private async logErrorEvent(req: Request, error: Error): Promise<void> {
    try {
      const context = req.auditContext;
      
      await auditService.logEvent({
        eventType: AuditEventType.SYSTEM_STARTUP, // Using existing type, should add ERROR event type
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.FAILURE,
        action: 'application_error',
        resourceType: 'System',
        resourceId: context?.requestId,
        userId: context?.userId,
        sessionId: context?.sessionId,
        userAgent: context?.userAgent,
        ipAddress: context?.ipAddress,
        requestId: context?.requestId,
        correlationId: context?.correlationId,
        method: req.method,
        endpoint: req.path,
        metadata: {
          error: error.message,
          stack: error.stack,
          name: error.name
        },
        tags: ['error', 'system']
      });
    } catch (logError) {
      console.error('Failed to log error event:', logError);
    }
  }

  private logFileUploadEvent(req: Request): void {
    // Async log file upload event
    setImmediate(async () => {
      try {
        const context = req.auditContext;
        if (!context) return;

        const files = req.files as any;
        const fileCount = Object.keys(files).length;
        
        await auditService.logEvent({
          eventType: AuditEventType.DATA_IMPORT,
          severity: AuditSeverity.MEDIUM,
          status: AuditStatus.SUCCESS,
          action: 'file_upload',
          resourceType: 'File',
          resourceId: context.requestId,
          userId: context.userId,
          sessionId: context.sessionId,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
          requestId: context.requestId,
          correlationId: context.correlationId,
          method: req.method,
          endpoint: req.path,
          metadata: {
            fileCount,
            fileNames: Object.keys(files),
            totalSize: this.calculateTotalFileSize(files)
          },
          tags: ['file', 'upload', 'data']
        });
      } catch (error) {
        console.error('Failed to log file upload event:', error);
      }
    });
  }

  private checkForSuspiciousActivity(req: Request): void {
    const context = req.auditContext;
    if (!context) return;

    // Check for common attack patterns
    const suspiciousPatterns = [
      /\.\.\//,  // Path traversal
      /<script/i, // XSS
      /union.*select/i, // SQL injection
      /cmd\.exe/i, // Command injection
      /\${.*}/i   // Template injection
    ];

    const url = req.url;
    const userAgent = req.get('User-Agent') || '';
    const body = JSON.stringify(req.body || {});

    const combinedText = `${url} ${userAgent} ${body}`;
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(combinedText)) {
        this.logSecurityEvent(req, 'SUSPICIOUS_ACTIVITY', {
          pattern: pattern.toString(),
          url,
          userAgent
        });
        break;
      }
    }

    // Check for missing user agent (bot/crawler)
    if (!userAgent || userAgent.length < 10) {
      this.logSecurityEvent(req, 'SUSPICIOUS_ACTIVITY', {
        reason: 'Missing or suspicious user agent',
        userAgent
      });
    }
  }

  private getEventTypeAndSeverity(method: string, statusCode: number): { eventType: AuditEventType; severity: AuditSeverity } {
    if (statusCode >= 500) {
      return { eventType: AuditEventType.SYSTEM_STARTUP, severity: AuditSeverity.HIGH }; // Using existing types
    }
    
    if (statusCode >= 400) {
      return { eventType: AuditEventType.BLOCKED_REQUEST, severity: AuditSeverity.MEDIUM };
    }
    
    if (method === 'DELETE') {
      return { eventType: AuditEventType.DELETE, severity: AuditSeverity.HIGH };
    }
    
    if (method === 'POST' || method === 'PUT') {
      return { eventType: AuditEventType.CREATE, severity: AuditSeverity.MEDIUM };
    }
    
    return { eventType: AuditEventType.READ, severity: AuditSeverity.LOW };
  }

  private mapMethodToOperation(method: string): string | null {
    const methodMap: Record<string, string> = {
      'GET': 'READ',
      'POST': 'CREATE',
      'PUT': 'UPDATE',
      'PATCH': 'UPDATE',
      'DELETE': 'DELETE'
    };
    
    return methodMap[method] || null;
  }

  private getCrudEventType(operation: string): AuditEventType {
    const eventMap: Record<string, AuditEventType> = {
      'CREATE': AuditEventType.CREATE,
      'READ': AuditEventType.READ,
      'UPDATE': AuditEventType.UPDATE,
      'DELETE': AuditEventType.DELETE
    };
    
    return eventMap[operation] || AuditEventType.UPDATE;
  }

  private getCrudSeverity(operation: string, resourceType: string): AuditSeverity {
    if (operation === 'DELETE') return AuditSeverity.HIGH;
    if (operation === 'UPDATE' && resourceType === 'User') return AuditSeverity.HIGH;
    if (operation === 'CREATE' && resourceType === 'User') return AuditSeverity.MEDIUM;
    return AuditSeverity.MEDIUM;
  }

  private extractUserIdFromToken(token: string): string | undefined {
    // This would typically decode JWT and extract user ID
    // For now, return placeholder
    return 'user_from_token';
  }

  private extractSessionIdFromToken(token: string): string | undefined {
    // This would typically decode JWT and extract session ID
    // For now, return placeholder
    return 'session_from_token';
  }

  private calculateTotalFileSize(files: any): number {
    let totalSize = 0;
    
    if (Array.isArray(files)) {
      files.forEach(file => {
        totalSize += file.size || 0;
      });
    } else if (typeof files === 'object') {
      Object.values(files).forEach((file: any) => {
        if (Array.isArray(file)) {
          file.forEach(f => totalSize += f.size || 0);
        } else {
          totalSize += file.size || 0;
        }
      });
    }
    
    return totalSize;
  }
}

// Create default middleware instance
export const auditMiddleware = new AuditMiddleware();

// Export middleware functions
export const auditRequest = auditMiddleware.auditMiddleware();
export const auditAuth = auditMiddleware.authMiddleware();
export const auditSecurity = auditMiddleware.securityMiddleware();
export const auditError = auditMiddleware.errorMiddleware();

export default auditMiddleware;
