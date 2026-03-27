import { Request, Response, NextFunction } from 'express';
import { WinstonLogger } from '../utils/logger';
import { monitoringService } from '../services/monitoringService';

interface RequestLog {
  timestamp: string;
  method: string;
  url: string;
  userAgent: string;
  ip: string;
  statusCode?: number;
  responseTime?: number;
  contentLength?: number;
  requestId: string;
  userId?: string;
  error?: string;
}

export class LoggingMiddleware {
  private logger: WinstonLogger;

  constructor() {
    this.logger = new WinstonLogger();
  }

  public requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();
      
      // Add request ID to request for tracking
      (req as any).requestId = requestId;
      
      // Log request
      const requestLog: RequestLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent') || '',
        ip: req.ip || req.connection.remoteAddress || '',
        requestId: requestId
      };

      // Extract user ID if available
      if ((req as any).user && (req as any).user.id) {
        requestLog.userId = (req as any).user.id;
      }

      // Log the request
      this.logger.info('HTTP Request', requestLog);

      // Capture response
      const originalSend = res.send;
      let responseBody: any;
      
      res.send = (body: any) => {
        responseBody = body;
        return originalSend.call(res, body);
      };

      // Log response when it's finished
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        const responseLog: RequestLog = {
          ...requestLog,
          statusCode: res.statusCode,
          responseTime: duration,
          contentLength: res.get('Content-Length') ? parseInt(res.get('Content-Length') || '0') : 0
        };

        // Add response body for error responses
        if (res.statusCode >= 400 && responseBody) {
          try {
            responseLog.error = typeof responseBody === 'string' 
              ? responseBody 
              : JSON.stringify(responseBody);
          } catch (e) {
            responseLog.error = 'Unable to serialize error response';
          }
        }

        // Log the response
        if (res.statusCode >= 500) {
          this.logger.error('HTTP Response Error', responseLog);
        } else if (res.statusCode >= 400) {
          this.logger.warn('HTTP Response Warning', responseLog);
        } else {
          this.logger.info('HTTP Response', responseLog);
        }

        // Update monitoring metrics
        monitoringService.incrementHttpRequest(req.method, res.statusCode.toString());
        monitoringService.recordResponseTime(duration);
      });

      next();
    };
  }

  public errorLogger() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      const errorLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent') || '',
        ip: req.ip || req.connection.remoteAddress || '',
        requestId: (req as any).requestId || this.generateRequestId(),
        error: {
          message: err.message,
          stack: err.stack,
          name: err.name
        },
        userId: (req as any).user ? (req as any).user.id : undefined
      };

      this.logger.error('Unhandled Error', errorLog);
      
      // Update monitoring service
      monitoringService.incrementHttpRequest(req.method, '500');
      
      next(err);
    };
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public securityLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Log security-related events
      const securityEvents = [
        'Authorization',
        'X-Forwarded-For',
        'X-Real-IP',
        'X-Forwarded-Host'
      ];

      const securityLog: any = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress || '',
        requestId: (req as any).requestId || this.generateRequestId(),
        headers: {}
      };

      // Log specific security headers
      securityEvents.forEach(header => {
        const value = req.get(header);
        if (value) {
          securityLog.headers[header] = value;
        }
      });

      // Log authentication attempts
      if (req.path.includes('/auth') || req.get('Authorization')) {
        this.logger.info('Security Event', securityLog);
      }

      next();
    };
  }

  public performanceLogger(threshold: number = 1000) {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        if (duration > threshold) {
          const perfLog = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            duration: duration,
            statusCode: res.statusCode,
            requestId: (req as any).requestId || this.generateRequestId()
          };
          
          this.logger.warn('Slow Request Detected', perfLog);
        }
      });

      next();
    };
  }

  public complianceLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Log compliance-related activities
      const compliancePaths = [
        '/api/compliance',
        '/api/audit',
        '/api/security',
        '/api/proofs'
      ];

      const isComplianceRelated = compliancePaths.some(path => 
        req.path.startsWith(path)
      );

      if (isComplianceRelated) {
        const complianceLog = {
          timestamp: new Date().toISOString(),
          method: req.method,
          url: req.url,
          userId: (req as any).user ? (req as any).user.id : undefined,
          action: this.getActionFromPath(req.path),
          requestId: (req as any).requestId || this.generateRequestId()
        };

        this.logger.info('Compliance Activity', complianceLog);
      }

      next();
    };
  }

  private getActionFromPath(path: string): string {
    const pathParts = path.split('/').filter(part => part);
    if (pathParts.length > 1) {
      return `${pathParts[0]}_${pathParts[1]}`;
    }
    return pathParts[0] || 'unknown';
  }
}

// Export middleware functions
export const loggingMiddleware = new LoggingMiddleware();
export const requestLogger = () => loggingMiddleware.requestLogger();
export const errorLogger = () => loggingMiddleware.errorLogger();
export const securityLogger = () => loggingMiddleware.securityLogger();
export const performanceLogger = (threshold?: number) => loggingMiddleware.performanceLogger(threshold);
export const complianceLogger = () => loggingMiddleware.complianceLogger();