/**
 * Base error class for Verinode SDK
 */
export class VerinodeError extends Error {
  public readonly code: string;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'VerinodeError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where our error was thrown
    Object.setPrototypeOf(this, VerinodeError.prototype);
  }

  /**
   * Convert error to JSON
   */
  public toJSON(): VerinodeErrorJSON {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString()
    };
  }

  /**
   * Create error from JSON
   */
  public static fromJSON(json: VerinodeErrorJSON): VerinodeError {
    const error = new VerinodeError(json.message, json.code, json.details);
    (error as any).timestamp = new Date(json.timestamp);
    return error;
  }
}

/**
 * Network error - issues with API connectivity
 */
export class NetworkError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

/**
 * Authentication error - invalid API key or credentials
 */
export class AuthenticationError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Validation error - invalid input parameters
 */
export class ValidationError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Proof error - issues with proof creation or verification
 */
export class ProofError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'PROOF_ERROR', details);
    this.name = 'ProofError';
  }
}

/**
 * Wallet error - issues with wallet connection or operations
 */
export class WalletError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'WALLET_ERROR', details);
    this.name = 'WalletError';
  }
}

/**
 * Blockchain error - issues with blockchain operations
 */
export class BlockchainError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'BLOCKCHAIN_ERROR', details);
    this.name = 'BlockchainError';
  }
}

/**
 * Timeout error - operation exceeded time limit
 */
export class TimeoutError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT_ERROR', details);
    this.name = 'TimeoutError';
  }
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT_ERROR', details);
    this.name = 'RateLimitError';
  }
}

/**
 * Server error - internal server issues
 */
export class ServerError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'SERVER_ERROR', details);
    this.name = 'ServerError';
  }
}

/**
 * Not found error - resource not found
 */
export class NotFoundError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'NOT_FOUND_ERROR', details);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error - resource conflict
 */
export class ConflictError extends VerinodeError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT_ERROR', details);
    this.name = 'ConflictError';
  }
}

/**
 * Error factory for creating appropriate error instances
 */
export class ErrorFactory {
  /**
   * Create error based on HTTP status code
   */
  public static fromHttpStatus(status: number, message: string, details?: any): VerinodeError {
    switch (status) {
      case 400:
        return new ValidationError(message, details);
      case 401:
      case 403:
        return new AuthenticationError(message, details);
      case 404:
        return new NotFoundError(message, details);
      case 409:
        return new ConflictError(message, details);
      case 429:
        return new RateLimitError(message, details);
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServerError(message, details);
      default:
        return new VerinodeError(message, 'UNKNOWN_ERROR', details);
    }
  }

  /**
   * Create network error
   */
  public static network(message: string, details?: any): NetworkError {
    return new NetworkError(message, details);
  }

  /**
   * Create validation error
   */
  public static validation(message: string, details?: any): ValidationError {
    return new ValidationError(message, details);
  }

  /**
   * Create proof error
   */
  public static proof(message: string, details?: any): ProofError {
    return new ProofError(message, details);
  }

  /**
   * Create wallet error
   */
  public static wallet(message: string, details?: any): WalletError {
    return new WalletError(message, details);
  }

  /**
   * Create blockchain error
   */
  public static blockchain(message: string, details?: any): BlockchainError {
    return new BlockchainError(message, details);
  }
}

/**
 * Error handling utilities
 */
export class ErrorHandler {
  /**
   * Wrap async function with error handling
   */
  public static async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof VerinodeError) {
        throw error;
      }
      
      // Convert unknown errors to VerinodeError
      if (error instanceof Error) {
        throw new VerinodeError(error.message, 'UNKNOWN_ERROR', { originalError: error });
      }
      
      throw new VerinodeError('Unknown error occurred', 'UNKNOWN_ERROR', { error });
    }
  }

  /**
   * Handle Axios error and convert to appropriate VerinodeError
   */
  public static handleAxiosError(error: any): VerinodeError {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      const message = data?.message || error.message || 'Request failed';
      return ErrorFactory.fromHttpStatus(status, message, data);
    } else if (error.request) {
      // Request was made but no response received
      return new NetworkError('No response received from server', { 
        request: error.request,
        config: error.config 
      });
    } else {
      // Something happened in setting up the request
      return new VerinodeError(error.message, 'REQUEST_SETUP_ERROR', { 
        config: error.config 
      });
    }
  }

  /**
   * Log error with context
   */
  public static logError(error: VerinodeError, context?: string): void {
    console.error(`[Verinode SDK] ${context ? `${context}: ` : ''}${error.name}: ${error.message}`, {
      code: error.code,
      timestamp: error.timestamp,
      details: error.details
    });
  }
}

// Type definitions
export interface VerinodeErrorJSON {
  name: string;
  message: string;
  code: string;
  details?: any;
  timestamp: string;
}