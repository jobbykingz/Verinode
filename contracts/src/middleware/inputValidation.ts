import { Request, Response, NextFunction } from 'express';
import { sanitizeInput } from '../utils/inputSanitization';

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationRule {
  field: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export class Validator {
  private errors: ValidationError[] = [];

  addError(field: string, message: string, value?: any): void {
    this.errors.push({ field, message, value });
  }

  validate(value: any, rules: ValidationRule[]): void {
    for (const rule of rules) {
      const fieldValue = value[rule.field];
      
      // Check if required
      if (rule.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
        this.addError(rule.field, `${rule.field} is required`);
        continue;
      }

      // Skip other validations if field is not provided and not required
      if (fieldValue === undefined || fieldValue === null) {
        continue;
      }

      // Type validation
      if (typeof fieldValue === 'string') {
        // Min length
        if (rule.minLength && fieldValue.length < rule.minLength) {
          this.addError(rule.field, `${rule.field} must be at least ${rule.minLength} characters long`, fieldValue);
        }

        // Max length
        if (rule.maxLength && fieldValue.length > rule.maxLength) {
          this.addError(rule.field, `${rule.field} must not exceed ${rule.maxLength} characters`, fieldValue);
        }

        // Pattern validation
        if (rule.pattern && !rule.pattern.test(fieldValue)) {
          this.addError(rule.field, `${rule.field} format is invalid`, fieldValue);
        }
      }

      // Custom validation
      if (rule.custom) {
        const result = rule.custom(fieldValue);
        if (result !== true) {
          this.addError(rule.field, typeof result === 'string' ? result : `${rule.field} is invalid`, fieldValue);
        }
      }
    }
  }

  getErrors(): ValidationError[] {
    return this.errors;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  reset(): void {
    this.errors = [];
  }
}

// Common validation rules
export const commonValidationRules = {
  email: [
    { field: 'email', required: true, maxLength: 255, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
  ],
  
  password: [
    { field: 'password', required: true, minLength: 8, maxLength: 128 }
  ],
  
  username: [
    { field: 'username', required: true, minLength: 3, maxLength: 50, pattern: /^[a-zA-Z0-9_-]+$/ }
  ],
  
  id: [
    { field: 'id', required: true, pattern: /^[a-zA-Z0-9_-]+$/ }
  ]
};

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const validator = req.validator as Validator;
  
  if (validator && validator.hasErrors()) {
    const validationErrors = validator.getErrors();

    // Log validation errors for security monitoring
    console.warn('Validation Error:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      errors: validationErrors,
      timestamp: new Date().toISOString()
    });

    return res.status(400).json({
      error: 'Validation failed',
      message: 'Invalid input data provided',
      errors: validationErrors
    });
  }

  next();
};

export const sanitizeRequestBody = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    // Add validator to request
    req.validator = new Validator();

    next();
  } catch (error) {
    console.error('Sanitization error:', error);
    return res.status(400).json({
      error: 'Invalid input format',
      message: 'Request contains malformed data'
    });
  }
};

const sanitizeObject = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize keys as well to prevent injection
    const sanitizedKey = sanitizeInput(key).toString();
    
    if (typeof value === 'object' && value !== null) {
      sanitized[sanitizedKey] = sanitizeObject(value);
    } else {
      sanitized[sanitizedKey] = sanitizeInput(value);
    }
  }

  return sanitized;
};

export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`
      });
    }

    next();
  };
};

export const validateContentLength = (maxLength: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxLength) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request body cannot exceed ${maxLength} bytes`
      });
    }

    next();
  };
};

// Middleware factory for common validations
export const validateBody = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validator = req.validator as Validator || new Validator();
    
    validator.validate(req.body, rules);
    
    req.validator = validator;
    
    if (validator.hasErrors()) {
      return handleValidationErrors(req, res, next);
    }
    
    next();
  };
};

export const validateQuery = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validator = req.validator as Validator || new Validator();
    
    validator.validate(req.query, rules);
    
    req.validator = validator;
    
    if (validator.hasErrors()) {
      return handleValidationErrors(req, res, next);
    }
    
    next();
  };
};
