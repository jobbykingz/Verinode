// Basic sanitization without external dependencies
export const sanitizeInput = (input: any): any => {
  if (input === null || input === undefined) return input;
  
  if (typeof input === 'string') {
    return sanitizeString(input);
  }
  
  if (typeof input === 'object') {
    if (Array.isArray(input)) {
      return input.map(sanitizeInput);
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeString(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};

export const sanitizeString = (str: string): string => {
  if (!str) return str;
  
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/@import/gi, '')
    .trim();
};

export const sanitizeHTML = (html: string): string => {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
};

export const sanitizeSQL = (input: string): string => {
  return input.replace(/['"\\;]/g, '');
};
