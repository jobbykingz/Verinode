const helmet = require('helmet');
const { WinstonLogger } = require('../utils/logger');

class SecurityHeadersMiddleware {
  constructor() {
    this.logger = new WinstonLogger();
  }

  logSecurityHeaderEvent(req, header, value) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'SECURITY_HEADER_SET',
      header: header,
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      requestId: req.requestId
    };

    this.logger.info('Security header applied', logData);
  }

  getContentSecurityPolicy() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return {
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'font-src': ["'self'", 'https:', 'data:'],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'script-src': [
          "'self'",
          ...(isDevelopment ? ["'unsafe-eval'", "'unsafe-inline'"] : [])
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'" // Required for many CSS frameworks
        ],
        'connect-src': [
          "'self'",
          ...(isDevelopment ? ['ws:', 'wss:'] : ['wss:']),
          'https://api.stellar.org',
          'https://horizon.stellar.org'
        ],
        'object-src': ["'none'"],
        'media-src': ["'self'"],
        'worker-src': ["'self'"],
        'manifest-src': ["'self'"],
        'upgrade-insecure-requests': []
      },
      reportOnly: isDevelopment
    };
  }

  getSecurityHeadersConfig() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return {
      contentSecurityPolicy: this.getContentSecurityPolicy(),
      crossOriginEmbedderPolicy: !isDevelopment,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: {
        policy: 'cross-origin'
      },
      dnsPrefetchControl: true,
      frameguard: {
        action: 'deny'
      },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      },
      xssFilter: true
    };
  }

  securityHeadersMiddleware() {
    const config = this.getSecurityHeadersConfig();
    
    return helmet(config);
  }

  customSecurityHeaders() {
    return (req, res, next) => {
      // Additional custom security headers
      
      // Content-Type Options
      res.setHeader('X-Content-Type-Options', 'nosniff');
      this.logSecurityHeaderEvent(req, 'X-Content-Type-Options', 'nosniff');

      // Strict Transport Security (only in production)
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        this.logSecurityHeaderEvent(req, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }

      // Permissions Policy (formerly Feature Policy)
      const permissionsPolicy = [
        'geolocation=()',
        'microphone=()',
        'camera=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()',
        'ambient-light-sensor=()',
        'autoplay=()',
        'encrypted-media=()',
        'fullscreen=()',
        'picture-in-picture=()'
      ];
      
      res.setHeader('Permissions-Policy', permissionsPolicy.join(', '));
      this.logSecurityHeaderEvent(req, 'Permissions-Policy', permissionsPolicy.join(', '));

      // Clear Site Data on logout
      if (req.path.includes('/logout')) {
        res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"');
        this.logSecurityHeaderEvent(req, 'Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"');
      }

      // Cache Control for sensitive endpoints
      if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/user')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        this.logSecurityHeaderEvent(req, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      }

      // API Rate Limiting Headers
      res.setHeader('X-RateLimit-Limit', '100');
      res.setHeader('X-RateLimit-Remaining', '99');
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 15 * 60 * 1000).toISOString());

      // Security Information Headers
      res.setHeader('X-Content-Security-Policy', 'default-src \'self\'');
      res.setHeader('X-WebKit-CSP', 'default-src \'self\'');

      // Remove server information
      res.removeHeader('Server');
      res.removeHeader('X-Powered-By');

      next();
    };
  }

  apiSecurityHeaders() {
    return (req, res, next) => {
      // Specific headers for API endpoints
      
      // API Version
      res.setHeader('API-Version', '1.0.0');
      
      // API Rate Limiting
      res.setHeader('X-RateLimit-Limit', '1000');
      res.setHeader('X-RateLimit-Remaining', '999');
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 60 * 60 * 1000).toISOString());
      
      // CORS Headers for API
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset,X-Total-Count');
      
      // Security Headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Cache Control for API
      if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes for GET requests
      } else {
        res.setHeader('Cache-Control', 'no-store, no-cache');
      }

      next();
    };
  }

  conditionalSecurityHeaders() {
    return (req, res, next) => {
      // Apply different security headers based on the endpoint
      
      if (req.path.startsWith('/api/')) {
        return this.apiSecurityHeaders()(req, res, next);
      }

      // Default security headers for other endpoints
      return this.customSecurityHeaders()(req, res, next);
    };
  }

  securityHeadersValidator() {
    return (req, res, next) => {
      // Validate incoming security headers
      const suspiciousHeaders = [
        'x-forwarded-host',
        'x-original-url',
        'x-rewrite-url',
        'x-real-url'
      ];

      const foundSuspiciousHeaders = suspiciousHeaders.filter(header => 
        req.get(header)
      );

      if (foundSuspiciousHeaders.length > 0) {
        this.logger.warn('Suspicious headers detected', {
          timestamp: new Date().toISOString(),
          type: 'SUSPICIOUS_HEADERS',
          headers: foundSuspiciousHeaders,
          method: req.method,
          url: req.url,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          requestId: req.requestId
        });

        return res.status(400).json({
          error: 'Invalid request headers',
          message: 'Request contains suspicious headers'
        });
      }

      next();
    };
  }
}

const securityHeadersMiddleware = new SecurityHeadersMiddleware();

module.exports = {
  SecurityHeadersMiddleware,
  securityHeadersMiddleware,
  securityHeaders: () => securityHeadersMiddleware.securityHeadersMiddleware(),
  customSecurityHeaders: () => securityHeadersMiddleware.customSecurityHeaders(),
  apiSecurityHeaders: () => securityHeadersMiddleware.apiSecurityHeaders(),
  conditionalSecurityHeaders: () => securityHeadersMiddleware.conditionalSecurityHeaders(),
  securityHeadersValidator: () => securityHeadersMiddleware.securityHeadersValidator()
};
