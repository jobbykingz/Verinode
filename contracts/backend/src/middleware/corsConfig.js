const cors = require('cors');
const { WinstonLogger } = require('../utils/logger');

class CorsConfigMiddleware {
  constructor() {
    this.logger = new WinstonLogger();
  }

  getAllowedOrigins() {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://verinode.app',
      'https://www.verinode.app',
      'https://app.verinode.com'
    ];

    // Add environment-specific origins
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:8080', 'http://127.0.0.1:3000');
    }

    // Add production origins from environment
    if (process.env.ALLOWED_ORIGINS) {
      const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
      allowedOrigins.push(...envOrigins);
    }

    return allowedOrigins;
  }

  logCorsEvent(req, origin, allowed) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'CORS_REQUEST',
      origin: origin || 'undefined',
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent') || '',
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      allowed: allowed,
      requestId: req.requestId
    };

    if (!allowed) {
      this.logger.warn('CORS request blocked', logData);
    } else {
      this.logger.info('CORS request allowed', logData);
    }
  }

  createCorsOptions() {
    const allowedOrigins = this.getAllowedOrigins();

    return {
      origin: (origin, req) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return true;

        // Check if origin is in allowed list
        const isAllowed = allowedOrigins.includes(origin);

        // Log the CORS event for monitoring
        this.logCorsEvent(req, origin, isAllowed);

        return isAllowed;
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-CSRF-Token',
        'X-API-Key',
        'X-Client-Version'
      ],
      exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-Rate-Limit-Limit',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset'
      ],
      credentials: true, // Allow cookies to be sent
      maxAge: 86400, // Preflight cache for 24 hours
      preflightContinue: false,
      optionsSuccessStatus: 204
    };
  }

  corsMiddleware() {
    const options = this.createCorsOptions();
    return cors(options);
  }

  strictCorsMiddleware() {
    // More restrictive CORS for sensitive endpoints
    const strictOptions = {
      origin: (origin, req) => {
        if (!origin) return false; // Require origin for strict endpoints

        const allowedOrigins = this.getAllowedOrigins();
        const isAllowed = allowedOrigins.includes(origin);

        this.logCorsEvent(req, origin, isAllowed);

        return isAllowed;
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: [
        'Origin',
        'Content-Type',
        'Accept',
        'Authorization'
      ],
      exposedHeaders: [],
      credentials: true,
      maxAge: 3600, // Shorter cache for strict endpoints
      preflightContinue: false,
      optionsSuccessStatus: 204
    };

    return cors(strictOptions);
  }

  publicCorsMiddleware() {
    // Less restrictive CORS for public endpoints
    const publicOptions = {
      origin: true, // Allow any origin for public endpoints
      methods: ['GET', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept'
      ],
      exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count'
      ],
      credentials: false, // No credentials for public endpoints
      maxAge: 86400,
      preflightContinue: false,
      optionsSuccessStatus: 204
    };

    return cors(publicOptions);
  }

  conditionalCors() {
    return (req, res, next) => {
      // Apply different CORS policies based on the endpoint
      if (req.path.startsWith('/api/auth') || 
          req.path.startsWith('/api/user') ||
          req.path.startsWith('/api/admin')) {
        return this.strictCorsMiddleware()(req, res, next);
      }

      if (req.path.startsWith('/api/public') ||
          req.path === '/health' ||
          req.path === '/metrics') {
        return this.publicCorsMiddleware()(req, res, next);
      }

      // Default CORS for other endpoints
      return this.corsMiddleware()(req, res, next);
    };
  }

  corsErrorHandler() {
    return (err, req, res, next) => {
      if (err.message.includes('CORS')) {
        this.logger.warn('CORS error', {
          timestamp: new Date().toISOString(),
          error: err.message,
          origin: req.get('Origin'),
          method: req.method,
          url: req.url,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          requestId: req.requestId
        });

        return res.status(403).json({
          error: 'CORS policy violation',
          message: 'Cross-origin request not allowed'
        });
      }

      next(err);
    };
  }
}

module.exports = {
  CorsConfigMiddleware,
  corsConfigMiddleware: new CorsConfigMiddleware(),
  corsMiddleware: () => new CorsConfigMiddleware().corsMiddleware(),
  strictCorsMiddleware: () => new CorsConfigMiddleware().strictCorsMiddleware(),
  publicCorsMiddleware: () => new CorsConfigMiddleware().publicCorsMiddleware(),
  conditionalCors: () => new CorsConfigMiddleware().conditionalCors(),
  corsErrorHandler: () => new CorsConfigMiddleware().corsErrorHandler()
};
