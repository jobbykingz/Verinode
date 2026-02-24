const { WinstonLogger } = require('./logger');

class XSSProtection {
  constructor() {
    this.logger = new WinstonLogger();
  }

  // XSS attack patterns
  getXSSPatterns() {
    return [
      // Script tags
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<script[^>]*>/gi,
      /<\/script>/gi,
      
      // JavaScript event handlers
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /on\w+\s*=\s*[^"'\s>]+/gi,
      
      // JavaScript protocols
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      
      // Dangerous HTML tags
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
      /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi,
      /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
      /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
      
      // Dangerous attributes
      /src\s*=\s*["']javascript:/gi,
      /href\s*=\s*["']javascript:/gi,
      /action\s*=\s*["']javascript:/gi,
      /formaction\s*=\s*["']javascript:/gi,
      
      // CSS expressions
      /expression\s*\(/gi,
      /url\s*\(\s*["']javascript:/gi,
      
      // Eval and similar functions
      /eval\s*\(/gi,
      /setTimeout\s*\(\s*["'][^"']*["']/gi,
      /setInterval\s*\(\s*["'][^"']*["']/gi,
      /Function\s*\(/gi,
      
      // Document write
      /document\.write\s*\(/gi,
      /document\.writeln\s*\(/gi,
      
      // HTML5 security issues
      /autofocus/gi,
      /contenteditable/gi,
      
      // Base64 encoded scripts
      /src\s*=\s*["']data:text\/html;base64,/gi,
      /href\s*=\s*["']data:text\/html;base64,/gi
    ];
  }

  // Check if input contains XSS patterns
  containsXSS(input) {
    if (typeof input !== 'string') {
      return false;
    }

    const patterns = this.getXSSPatterns();
    const detectedPatterns = [];

    patterns.forEach(pattern => {
      const matches = input.match(pattern);
      if (matches) {
        detectedPatterns.push({
          pattern: pattern.toString(),
          matches: matches.slice(0, 3) // Limit to first 3 matches
        });
      }
    });

    return detectedPatterns.length > 0 ? detectedPatterns : false;
  }

  // Remove XSS patterns from input
  removeXSS(input) {
    if (typeof input !== 'string') {
      return input;
    }

    let sanitized = input;
    const patterns = this.getXSSPatterns();

    patterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Additional cleanup
    sanitized = sanitized
      // Remove any remaining script-like content
      .replace(/<\s*\/?\s*script/gi, '')
      // Remove event handlers
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+on\w+\s*=\s*[^"'\s>]+/gi, '')
      // Remove javascript: protocols
      .replace(/javascript\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      // Remove dangerous attributes
      .replace(/\s+src\s*=\s*["']javascript:/gi, '')
      .replace(/\s+href\s*=\s*["']javascript:/gi, '')
      // Remove expression()
      .replace(/expression\s*\([^)]*\)/gi, '');

    return sanitized;
  }

  // Encode HTML entities
  encodeHTML(input) {
    if (typeof input !== 'string') {
      return input;
    }

    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };

    return input.replace(/[&<>"'`=\/]/g, (match) => entityMap[match]);
  }

  // Decode HTML entities (use with caution)
  decodeHTML(input) {
    if (typeof input !== 'string') {
      return input;
    }

    const entityMap = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x60;': '`',
      '&#x3D;': '='
    };

    return input.replace(/&(amp|lt|gt|quot|#x27|#x2F|#x60|#x3D);/g, (match) => entityMap[match]);
  }

  // Sanitize CSS
  sanitizeCSS(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      // Remove JavaScript expressions
      .replace(/expression\s*\([^)]*\)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      // Remove @import with JavaScript
      .replace(/@import\s*["']javascript:/gi, '')
      // Remove behavior property
      .replace(/behavior\s*:\s*[^;]+/gi, '')
      // Remove binding property
      .replace(/binding\s*:\s*[^;]+/gi, '');
  }

  // Validate URL for XSS
  validateURL(url) {
    if (typeof url !== 'string') {
      return false;
    }

    try {
      const parsed = new URL(url);
      
      // Check for dangerous protocols
      const dangerousProtocols = ['javascript:', 'vbscript:', 'data:', 'file:', 'ftp:'];
      if (dangerousProtocols.includes(parsed.protocol)) {
        return false;
      }

      // Check for XSS in URL parameters
      const params = parsed.search;
      if (this.containsXSS(params)) {
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  // Create safe HTML output
  createSafeHTML(input, options = {}) {
    const {
      allowTags = [],
      allowAttributes = {},
      encodeAll = false
    } = options;

    if (typeof input !== 'string') {
      return input;
    }

    if (encodeAll) {
      return this.encodeHTML(input);
    }

    // Remove XSS patterns first
    let sanitized = this.removeXSS(input);

    // If no allowed tags specified, encode everything
    if (allowTags.length === 0) {
      return this.encodeHTML(sanitized);
    }

    // Simple tag filtering (for production, use a library like DOMPurify)
    const tagPattern = new RegExp(`<(?!\\/?(${allowTags.join('|')})\\b)[^>]*>`, 'gi');
    sanitized = sanitized.replace(tagPattern, '');

    // Remove dangerous attributes
    const dangerousAttrs = ['on\\w+', 'javascript:', 'vbscript:', 'data:', 'expression'];
    dangerousAttrs.forEach(attr => {
      const attrPattern = new RegExp(`\\s+${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(attrPattern, '');
    });

    return sanitized;
  }

  // Check for reflected XSS
  checkReflectedXSS(req) {
    const threats = [];
    
    // Check URL parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        const xssDetected = this.containsXSS(value);
        if (xssDetected) {
          threats.push({
            type: 'REFLECTED_XSS_QUERY',
            parameter: key,
            value: value,
            patterns: xssDetected
          });
        }
      }
    }

    // Check URL path
    const xssInPath = this.containsXSS(req.path);
    if (xssInPath) {
      threats.push({
        type: 'REFLECTED_XSS_PATH',
        path: req.path,
        patterns: xssInPath
      });
    }

    // Check request body
    if (req.body) {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') {
          const xssDetected = this.containsXSS(value);
          if (xssDetected) {
            threats.push({
              type: 'REFLECTED_XSS_BODY',
              field: key,
              value: value,
              patterns: xssDetected
            });
          }
        }
      }
    }

    return threats;
  }

  // Check for stored XSS
  checkStoredXSS(data) {
    const threats = [];
    
    const checkValue = (key, value, path = '') => {
      if (typeof value === 'string') {
        const xssDetected = this.containsXSS(value);
        if (xssDetected) {
          threats.push({
            type: 'STORED_XSS',
            path: path ? `${path}.${key}` : key,
            value: value,
            patterns: xssDetected
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [subKey, subValue] of Object.entries(value)) {
          checkValue(subKey, subValue, path ? `${path}.${key}` : key);
        }
      }
    };

    checkValue('root', data);
    return threats;
  }

  // Middleware for XSS protection
  xssProtectionMiddleware() {
    return (req, res, next) => {
      // Check for XSS in request
      const threats = this.checkReflectedXSS(req);
      
      if (threats.length > 0) {
        this.logger.error('XSS attack detected', {
          timestamp: new Date().toISOString(),
          type: 'XSS_ATTACK',
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent') || '',
          threats,
          userId: req.user?.id || null,
          requestId: req.requestId
        });

        // Block requests with XSS attempts
        return res.status(403).json({
          error: 'XSS detected',
          message: 'Request contains potentially dangerous content',
          threats: threats.map(t => t.type)
        });
      }

      // Sanitize request body
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }

      next();
    };
  }

  // Sanitize object recursively
  sanitizeObject(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return this.removeXSS(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object') {
          sanitized[key] = this.sanitizeObject(obj[key]);
        } else {
          sanitized[key] = this.removeXSS(obj[key]);
        }
      }
    }

    return sanitized;
  }

  // Generate CSP nonce
  generateNonce() {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('base64');
  }

  // Validate CSP compliance
  validateCSP(content, cspPolicy) {
    // This is a simplified CSP validation
    // In production, use a proper CSP parser
    const violations = [];
    
    const xssPatterns = this.getXSSPatterns();
    xssPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        violations.push({
          type: 'CSP_VIOLATION',
          pattern: pattern.toString(),
          directive: 'script-src'
        });
      }
    });

    return violations;
  }
}

const xssProtection = new XSSProtection();

module.exports = {
  XSSProtection,
  xssProtection,
  containsXSS: (input) => xssProtection.containsXSS(input),
  removeXSS: (input) => xssProtection.removeXSS(input),
  encodeHTML: (input) => xssProtection.encodeHTML(input),
  decodeHTML: (input) => xssProtection.decodeHTML(input),
  sanitizeCSS: (input) => xssProtection.sanitizeCSS(input),
  validateURL: (url) => xssProtection.validateURL(url),
  createSafeHTML: (input, options) => xssProtection.createSafeHTML(input, options),
  checkReflectedXSS: (req) => xssProtection.checkReflectedXSS(req),
  checkStoredXSS: (data) => xssProtection.checkStoredXSS(data),
  xssProtectionMiddleware: () => xssProtection.xssProtectionMiddleware(),
  sanitizeObject: (obj) => xssProtection.sanitizeObject(obj),
  generateNonce: () => xssProtection.generateNonce(),
  validateCSP: (content, cspPolicy) => xssProtection.validateCSP(content, cspPolicy)
};
