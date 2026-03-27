const { WinstonLogger } = require('../utils/logger');
const geoip = require('geoip-lite');

class RequestLoggerMiddleware {
  constructor() {
    this.logger = new WinstonLogger();
  }

  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getClientInfo(req) {
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const geo = geoip.lookup(ip);
    
    return {
      ip,
      userAgent: req.get('User-Agent') || '',
      referer: req.get('Referer') || '',
      origin: req.get('Origin') || '',
      geo: geo ? {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        timezone: geo.timezone
      } : null,
      forwardedFor: req.get('X-Forwarded-For') || '',
      realIp: req.get('X-Real-IP') || '',
      via: req.get('Via') || ''
    };
  }

  detectThreats(req) {
    const threats = [];
    const url = req.url;
    const userAgent = req.get('User-Agent') || '';
    const body = JSON.stringify(req.body || {});
    
    // SQL Injection patterns
    const sqlPatterns = [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
      /union.*select/i,
      /insert.*into/i,
      /delete.*from/i,
      /drop.*table/i
    ];

    // XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ];

    // Path traversal patterns
    const pathTraversalPatterns = [
      /\.\.\//g,
      /\.\.\\/g,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi
    ];

    // Command injection patterns
    const commandPatterns = [
      /;\s*rm\s+/i,
      /;\s*cat\s+/i,
      /;\s*ls\s+/i,
      /;\s*pwd\s+/i,
      /\|\s*nc\s+/i,
      /&&\s*rm\s+/i
    ];

    // Check for SQL injection
    const combinedInput = url + ' ' + body;
    sqlPatterns.forEach(pattern => {
      if (pattern.test(combinedInput)) {
        threats.push({
          type: 'SQL_INJECTION',
          pattern: pattern.toString(),
          detected: true
        });
      }
    });

    // Check for XSS
    xssPatterns.forEach(pattern => {
      if (pattern.test(combinedInput)) {
        threats.push({
          type: 'XSS',
          pattern: pattern.toString(),
          detected: true
        });
      }
    });

    // Check for path traversal
    pathTraversalPatterns.forEach(pattern => {
      if (pattern.test(url)) {
        threats.push({
          type: 'PATH_TRAVERSAL',
          pattern: pattern.toString(),
          detected: true
        });
      }
    });

    // Check for command injection
    commandPatterns.forEach(pattern => {
      if (pattern.test(combinedInput)) {
        threats.push({
          type: 'COMMAND_INJECTION',
          pattern: pattern.toString(),
          detected: true
        });
      }
    });

    // Check for suspicious user agents
    const suspiciousAgents = [
      /sqlmap/i,
      /nmap/i,
      /nikto/i,
      /dirb/i,
      /gobuster/i,
      /burp/i,
      /metasploit/i,
      /python-requests/i
    ];

    suspiciousAgents.forEach(pattern => {
      if (pattern.test(userAgent)) {
        threats.push({
          type: 'SUSPICIOUS_USER_AGENT',
          pattern: pattern.toString(),
          detected: true
        });
      }
    });

    return threats;
  }

  securityRequestLogger() {
    return (req, res, next) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();
      
      // Add request ID to request for tracking
      req.requestId = requestId;
      
      // Get client information
      const clientInfo = this.getClientInfo(req);
      
      // Detect threats
      const threats = this.detectThreats(req);
      
      // Create security log entry
      const securityLog = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        clientInfo,
        threats,
        userId: req.user?.id || null,
        isAuthenticated: !!req.user,
        contentType: req.get('Content-Type') || '',
        contentLength: req.get('Content-Length') || '0',
        headers: this.getSecurityHeaders(req)
      };

      // Log the request
      if (threats.length > 0) {
        this.logger.error('Security threat detected', securityLog);
        
        // Block requests with high-severity threats
        const highSeverityThreats = threats.filter(t => 
          ['SQL_INJECTION', 'COMMAND_INJECTION', 'PATH_TRAVERSAL'].includes(t.type)
        );
        
        if (highSeverityThreats.length > 0) {
          return res.status(403).json({
            error: 'Request blocked',
            message: 'Security threat detected',
            threats: highSeverityThreats.map(t => t.type)
          });
        }
      } else {
        this.logger.info('Security request logged', securityLog);
      }

      // Capture response
      const originalSend = res.send;
      let responseBody;
      
      res.send = (body) => {
        responseBody = body;
        return originalSend.call(res, body);
      };

      // Log response when finished
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        const responseLog = {
          ...securityLog,
          statusCode: res.statusCode,
          responseTime: duration,
          responseSize: res.get('Content-Length') || '0',
          success: res.statusCode < 400
        };

        // Log response body for error responses (sanitized)
        if (res.statusCode >= 400 && responseBody) {
          try {
            const sanitizedBody = typeof responseBody === 'string' 
              ? responseBody.substring(0, 500) // Limit to 500 chars
              : JSON.stringify(responseBody).substring(0, 500);
            responseLog.errorBody = sanitizedBody;
          } catch (e) {
            responseLog.errorBody = 'Unable to serialize response';
          }
        }

        if (res.statusCode >= 500) {
          this.logger.error('Security response error', responseLog);
        } else if (res.statusCode >= 400) {
          this.logger.warn('Security response warning', responseLog);
        } else {
          this.logger.info('Security response success', responseLog);
        }
      });

      next();
    };
  }

  getSecurityHeaders(req) {
    const securityHeaders = [
      'Authorization',
      'X-API-Key',
      'X-CSRF-Token',
      'X-Forwarded-For',
      'X-Real-IP',
      'X-Forwarded-Host',
      'X-Forwarded-Proto',
      'X-Original-URL',
      'X-Rewrite-URL'
    ];

    const headers = {};
    securityHeaders.forEach(header => {
      const value = req.get(header);
      if (value) {
        headers[header] = value;
      }
    });

    return headers;
  }

  attackPatternLogger() {
    return (req, res, next) => {
      const threats = this.detectThreats(req);
      
      if (threats.length > 0) {
        const attackLog = {
          timestamp: new Date().toISOString(),
          type: 'ATTACK_PATTERN',
          requestId: req.requestId,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent') || '',
          threats,
          userId: req.user?.id || null
        };

        this.logger.warn('Attack pattern detected', attackLog);
      }

      next();
    };
  }

  geoLocationLogger() {
    return (req, res, next) => {
      const clientInfo = this.getClientInfo(req);
      
      // Log requests from unusual geographic locations
      if (clientInfo.geo) {
        const suspiciousCountries = ['CN', 'RU', 'KP', 'IR']; // Example suspicious countries
        
        if (suspiciousCountries.includes(clientInfo.geo.country)) {
          const geoLog = {
            timestamp: new Date().toISOString(),
            type: 'SUSPICIOUS_GEOLOCATION',
            requestId: req.requestId,
            ip: clientInfo.ip,
            geo: clientInfo.geo,
            method: req.method,
            url: req.url,
            userId: req.user?.id || null
          };

          this.logger.warn('Suspicious geolocation request', geoLog);
        }
      }

      next();
    };
  }
}

const requestLoggerMiddleware = new RequestLoggerMiddleware();

module.exports = {
  RequestLoggerMiddleware,
  requestLoggerMiddleware,
  securityRequestLogger: () => requestLoggerMiddleware.securityRequestLogger(),
  attackPatternLogger: () => requestLoggerMiddleware.attackPatternLogger(),
  geoLocationLogger: () => requestLoggerMiddleware.geoLocationLogger()
};
