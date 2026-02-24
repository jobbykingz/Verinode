const { body, param, query, validationResult } = require('express-validator');
const { WinstonLogger } = require('../utils/logger');

class InputValidationMiddleware {
  constructor() {
    this.logger = new WinstonLogger();
  }

  logValidationFailure(req, errors) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'VALIDATION_FAILURE',
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      method: req.method,
      url: req.url,
      userId: req.user?.id,
      requestId: req.requestId,
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    };

    this.logger.warn('Input validation failed', logData);
  }

  validateUserRegistration() {
    return [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email required'),
      body('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must be 8+ chars with uppercase, lowercase, number, and special char'),
      body('username')
        .isLength({ min: 3, max: 30 })
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username must be 3-30 chars, alphanumeric and underscore only'),
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          this.logValidationFailure(req, errors);
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }
        next();
      }
    ];
  }

  validateUserLogin() {
    return [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email required'),
      body('password')
        .notEmpty()
        .withMessage('Password required'),
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          this.logValidationFailure(req, errors);
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }
        next();
      }
    ];
  }

  validateProofCreation() {
    return [
      body('title')
        .isLength({ min: 1, max: 200 })
        .trim()
        .escape()
        .withMessage('Title must be 1-200 characters'),
      body('description')
        .optional()
        .isLength({ max: 2000 })
        .trim()
        .escape()
        .withMessage('Description must be less than 2000 characters'),
      body('data')
        .isObject()
        .withMessage('Data must be an object'),
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          this.logValidationFailure(req, errors);
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }
        next();
      }
    ];
  }

  validateIdParam(paramName = 'id') {
    return [
      param(paramName)
        .isMongoId()
        .withMessage(`Invalid ${paramName} format`),
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          this.logValidationFailure(req, errors);
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }
        next();
      }
    ];
  }

  validatePagination() {
    return [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .toInt()
        .withMessage('Page must be a positive integer'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .toInt()
        .withMessage('Limit must be between 1 and 100'),
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          this.logValidationFailure(req, errors);
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }
        next();
      }
    ];
  }

  sanitizeInput() {
    return (req, res, next) => {
      // Sanitize string fields in request body
      if (req.body && typeof req.body === 'object') {
        this.sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        this.sanitizeObject(req.query);
      }

      // Sanitize route parameters
      if (req.params && typeof req.params === 'object') {
        this.sanitizeObject(req.params);
      }

      next();
    };
  }

  sanitizeObject(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key]
          .trim()
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObject(obj[key]);
      }
    }
  }
}

const inputValidationMiddleware = new InputValidationMiddleware();

module.exports = {
  InputValidationMiddleware,
  inputValidationMiddleware,
  validateUserRegistration: () => inputValidationMiddleware.validateUserRegistration(),
  validateUserLogin: () => inputValidationMiddleware.validateUserLogin(),
  validateProofCreation: () => inputValidationMiddleware.validateProofCreation(),
  validateIdParam: (paramName) => inputValidationMiddleware.validateIdParam(paramName),
  validatePagination: () => inputValidationMiddleware.validatePagination(),
  sanitizeInput: () => inputValidationMiddleware.sanitizeInput()
};
