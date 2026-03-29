import { Response } from 'express';

/**
 * Standardized API Response utility
 */
export class ApiResponse {
  /**
   * Send success response
   */
  static success(res: Response, data: any, message: string = 'Success', statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send error response
   */
  static error(res: Response, message: string, statusCode: number = 500, details?: any) {
    return res.status(statusCode).json({
      success: false,
      error: message,
      ...(details && { details }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send validation error response
   */
  static validationError(res: Response, errors: any[]) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send not found response
   */
  static notFound(res: Response, message: string = 'Resource not found') {
    return res.status(404).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send unauthorized response
   */
  static unauthorized(res: Response, message: string = 'Unauthorized') {
    return res.status(401).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send forbidden response
   */
  static forbidden(res: Response, message: string = 'Forbidden') {
    return res.status(403).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send bad request response
   */
  static badRequest(res: Response, message: string, details?: any) {
    return res.status(400).json({
      success: false,
      error: message,
      ...(details && { details }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send conflict response
   */
  static conflict(res: Response, message: string, details?: any) {
    return res.status(409).json({
      success: false,
      error: message,
      ...(details && { details }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send rate limit exceeded response
   */
  static rateLimitExceeded(res: Response, message: string = 'Rate limit exceeded', retryAfter?: string) {
    const response: any = {
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    };

    if (retryAfter) {
      response.retryAfter = retryAfter;
    }

    return res.status(429).json(response);
  }

  /**
   * Send server error response
   */
  static serverError(res: Response, message: string = 'Internal server error', details?: any) {
    return res.status(500).json({
      success: false,
      error: message,
      ...(details && { details }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send paginated response
   */
  static paginated(
    res: Response, 
    data: any[], 
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    message: string = 'Success'
  ) {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNext: pagination.page < pagination.totalPages,
        hasPrev: pagination.page > 1
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send created response
   */
  static created(res: Response, data: any, message: string = 'Resource created successfully') {
    return res.status(201).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send no content response
   */
  static noContent(res: Response, message: string = 'Operation completed successfully') {
    return res.status(204).send();
  }

  /**
   * Send accepted response
   */
  static accepted(res: Response, data: any, message: string = 'Request accepted for processing') {
    return res.status(202).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send partial content response
   */
  static partialContent(res: Response, data: any, message: string = 'Partial content') {
    return res.status(206).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send service unavailable response
   */
  static serviceUnavailable(res: Response, message: string = 'Service temporarily unavailable') {
    return res.status(503).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send too many requests response (alias for rateLimitExceeded)
   */
  static tooManyRequests(res: Response, message: string = 'Too many requests', retryAfter?: string) {
    return this.rateLimitExceeded(res, message, retryAfter);
  }
}

export default ApiResponse;
