import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

// Content Security Policy configuration
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com"
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com"
    ],
    imgSrc: [
      "'self'",
      "data:",
      "https:"
    ],
    scriptSrc: [
      "'self'",
      "'unsafe-eval'" // Only if absolutely necessary
    ],
    connectSrc: [
      "'self'",
      "https://api.yourdomain.com"
    ],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    manifestSrc: ["'self'"],
    workerSrc: ["'self'"],
    upgradeInsecureRequests: isProduction ? [] : null
  }
};

// Helmet configuration
export const helmetConfig = {
  contentSecurityPolicy: isProduction ? contentSecurityPolicy : false,
  crossOriginEmbedderPolicy: isProduction,
  crossOriginOpenerPolicy: isProduction,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: isProduction ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
};

export const securityHeadersMiddleware = helmet(helmetConfig);

// Custom security headers middleware
export const customSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Additional custom headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 
    'geolocation=(), ' +
    'microphone=(), ' +
    'camera=(), ' +
    'payment=(), ' +
    'usb=(), ' +
    'magnetometer=(), ' +
    'gyroscope=(), ' +
    'accelerometer=()'
  );
  
  // Cache control for API endpoints
  if (req.path.startsWith('/api/') || req.path.startsWith('/graphql')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  // API rate limit headers (will be set by rate limiter)
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('X-Response-Time', Date.now().toString());

  next();
};

// Strict security headers for sensitive endpoints
export const strictSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Apply all standard headers
  customSecurityHeaders(req, res, () => {
    // Additional strict headers
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "connect-src 'self'; " +
      "font-src 'self'; " +
      "object-src 'none'; " +
      "frame-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'"
    );
    
    next();
  });
};

// Development security headers (more relaxed)
export const devSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  if (!isProduction) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('X-Debug-Mode', 'enabled');
  }
  
  customSecurityHeaders(req, res, next);
};

export const getSecurityHeaders = (isStrict: boolean = false) => {
  return isStrict ? strictSecurityHeaders : customSecurityHeaders;
};
