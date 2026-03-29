import { ErrorCategory, ErrorSeverity } from '../models/ErrorReport';

export class ErrorClassifier {
  public classify(error: Error): { category: ErrorCategory; severity: ErrorSeverity } {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('timeout') || message.includes('econnrefused')) {
      return { category: ErrorCategory.NETWORK, severity: ErrorSeverity.HIGH };
    }
    
    if (message.includes('database') || message.includes('sql') || message.includes('mongo')) {
      return { category: ErrorCategory.DATABASE, severity: ErrorSeverity.CRITICAL };
    }
    
    if (message.includes('unauthorized') || message.includes('token') || message.includes('jwt')) {
      return { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.MEDIUM };
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.LOW };
    }
    
    return { category: ErrorCategory.INTERNAL, severity: ErrorSeverity.HIGH };
  }
}