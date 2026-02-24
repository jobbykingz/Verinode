const { WinstonLogger } = require('./logger');

class InputSanitization {
  constructor() {
    this.logger = new WinstonLogger();
  }

  // Remove HTML tags and encode special characters
  sanitizeHtml(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Remove script tags and dangerous JavaScript
  removeScripts(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/onload\s*=/gi, '')
      .replace(/onerror\s*=/gi, '')
      .replace(/onclick\s*=/gi, '')
      .replace(/onmouseover\s*=/gi, '')
      .replace(/onfocus\s*=/gi, '')
      .replace(/onblur\s*=/gi, '')
      .replace(/onchange\s*=/gi, '')
      .replace(/onsubmit\s*=/gi, '');
  }

  // Sanitize SQL input to prevent injection
  sanitizeSql(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/'/g, "''")
      .replace(/"/g, '""')
      .replace(/\\/g, '\\\\')
      .replace(/--/g, '')
      .replace(/;/g, '')
      .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b/gi, '');
  }

  // Remove path traversal patterns
  sanitizePath(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/\.\.\//g, '')
      .replace(/\.\.\\/g, '')
      .replace(/%2e%2e%2f/gi, '')
      .replace(/%2e%2e%5c/gi, '')
      .replace(/\//g, '')
      .replace(/\\/g, '');
  }

  // Sanitize email addresses
  sanitizeEmail(input) {
    if (typeof input !== 'string') {
      return input;
    }

    // Basic email sanitization - remove potentially dangerous characters
    return input
      .toLowerCase()
      .trim()
      .replace(/[<>]/g, '');
  }

  // Sanitize usernames
  sanitizeUsername(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 30);
  }

  // Sanitize phone numbers
  sanitizePhone(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/[^\d\+\-\(\)\s]/g, '')
      .trim();
  }

  // General string sanitization
  sanitizeString(input, options = {}) {
    if (typeof input !== 'string') {
      return input;
    }

    const {
      maxLength = 1000,
      allowHtml = false,
      allowScripts = false,
      trim = true,
      lowercase = false
    } = options;

    let sanitized = input;

    if (trim) {
      sanitized = sanitized.trim();
    }

    if (lowercase) {
      sanitized = sanitized.toLowerCase();
    }

    if (!allowHtml) {
      sanitized = this.sanitizeHtml(sanitized);
    }

    if (!allowScripts) {
      sanitized = this.removeScripts(sanitized);
    }

    // Remove null bytes and other control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Limit length
    if (maxLength > 0) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  // Sanitize object recursively
  sanitizeObject(obj, options = {}) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return this.sanitizeString(obj, options);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, options));
    }

    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Sanitize keys as well
        const sanitizedKey = this.sanitizeString(key, { maxLength: 100, trim: true });
        
        if (typeof obj[key] === 'object') {
          sanitized[sanitizedKey] = this.sanitizeObject(obj[key], options);
        } else {
          sanitized[sanitizedKey] = this.sanitizeString(obj[key], options);
        }
      }
    }

    return sanitized;
  }

  // Validate and sanitize file names
  sanitizeFileName(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\.\./g, '') // Remove path traversal
      .replace(/^\./, '') // Remove leading dot
      .toLowerCase()
      .trim()
      .substring(0, 255);
  }

  // Validate and sanitize URLs
  sanitizeUrl(input) {
    if (typeof input !== 'string') {
      return input;
    }

    try {
      const url = new URL(input);
      
      // Only allow certain protocols
      const allowedProtocols = ['http:', 'https:'];
      if (!allowedProtocols.includes(url.protocol)) {
        return '';
      }

      // Remove dangerous parts
      url.hash = '';
      url.username = '';
      url.password = '';

      return url.toString();
    } catch (e) {
      // Invalid URL
      return '';
    }
  }

  // Sanitize JSON input
  sanitizeJson(input) {
    try {
      const parsed = typeof input === 'string' ? JSON.parse(input) : input;
      return this.sanitizeObject(parsed);
    } catch (e) {
      this.logger.warn('Invalid JSON input', { input, error: e.message });
      return null;
    }
  }

  // Check for malicious patterns
  containsMaliciousContent(input) {
    if (typeof input !== 'string') {
      return false;
    }

    const maliciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /shell_exec\s*\(/gi,
      /\.\.\//g,
      /\.\.\\/g,
      /union.*select/gi,
      /insert.*into/gi,
      /delete.*from/gi,
      /drop.*table/gi
    ];

    return maliciousPatterns.some(pattern => pattern.test(input));
  }

  // Comprehensive sanitization method
  sanitize(input, type = 'string', options = {}) {
    switch (type) {
      case 'html':
        return this.sanitizeHtml(input);
      case 'sql':
        return this.sanitizeSql(input);
      case 'path':
        return this.sanitizePath(input);
      case 'email':
        return this.sanitizeEmail(input);
      case 'username':
        return this.sanitizeUsername(input);
      case 'phone':
        return this.sanitizePhone(input);
      case 'filename':
        return this.sanitizeFileName(input);
      case 'url':
        return this.sanitizeUrl(input);
      case 'json':
        return this.sanitizeJson(input);
      case 'object':
        return this.sanitizeObject(input, options);
      default:
        return this.sanitizeString(input, options);
    }
  }
}

const inputSanitization = new InputSanitization();

module.exports = {
  InputSanitization,
  inputSanitization,
  sanitizeHtml: (input) => inputSanitization.sanitizeHtml(input),
  removeScripts: (input) => inputSanitization.removeScripts(input),
  sanitizeSql: (input) => inputSanitization.sanitizeSql(input),
  sanitizePath: (input) => inputSanitization.sanitizePath(input),
  sanitizeEmail: (input) => inputSanitization.sanitizeEmail(input),
  sanitizeUsername: (input) => inputSanitization.sanitizeUsername(input),
  sanitizePhone: (input) => inputSanitization.sanitizePhone(input),
  sanitizeString: (input, options) => inputSanitization.sanitizeString(input, options),
  sanitizeObject: (obj, options) => inputSanitization.sanitizeObject(obj, options),
  sanitizeFileName: (input) => inputSanitization.sanitizeFileName(input),
  sanitizeUrl: (input) => inputSanitization.sanitizeUrl(input),
  sanitizeJson: (input) => inputSanitization.sanitizeJson(input),
  containsMaliciousContent: (input) => inputSanitization.containsMaliciousContent(input),
  sanitize: (input, type, options) => inputSanitization.sanitize(input, type, options)
};
