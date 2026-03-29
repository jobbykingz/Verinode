// Basic XSS protection without external dependencies
export interface XSSProtectionOptions {
  allowedTags?: string[];
  allowedAttributes?: string[];
  allowScriptTags?: boolean;
  allowStyleTags?: boolean;
}

export const defaultXSSOptions: XSSProtectionOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'span'],
  allowedAttributes: ['class'],
  allowScriptTags: false,
  allowStyleTags: false
};

export const protectAgainstXSS = (input: string, options: XSSProtectionOptions = defaultXSSOptions): string => {
  const config = {
    ...defaultXSSOptions,
    ...options
  };

  let sanitized = input;
  
  // Remove script tags
  if (!config.allowScriptTags) {
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  }
  
  // Remove dangerous event handlers
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove dangerous CSS expressions
  sanitized = sanitized.replace(/expression\s*\(/gi, '');
  
  // Remove @import
  sanitized = sanitized.replace(/@import/gi, '');
  
  // Remove style tags if not allowed
  if (!config.allowStyleTags) {
    sanitized = sanitized.replace(/<style[^>]*>.*?<\/style>/gi, '');
  }
  
  // Only allow specified tags
  if (config.allowedTags && config.allowedTags.length > 0) {
    const tagPattern = new RegExp(`<(?!\\/?(${config.allowedTags.join('|')})\\b)[^>]*>`, 'gi');
    sanitized = sanitized.replace(tagPattern, '');
  }
  
  return sanitized;
};

export const detectXSS = (input: string): boolean => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
    /@import/gi,
    /expression\s*\(/gi,
    /url\s*\(/gi
  ];

  return xssPatterns.some(pattern => pattern.test(input));
};

export const sanitizeForOutput = (data: any): any => {
  if (typeof data === 'string') {
    return protectAgainstXSS(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeForOutput);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeForOutput(value);
    }
    return sanitized;
  }
  
  return data;
};

export const createXSSMiddleware = (options: XSSProtectionOptions = defaultXSSOptions) => {
  return (req: any, res: any, next: any) => {
    if (req.body) {
      req.body = sanitizeForOutput(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeForOutput(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeForOutput(req.params);
    }
    
    next();
  };
};
