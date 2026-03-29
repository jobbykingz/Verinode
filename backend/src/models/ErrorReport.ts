export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  INTERNAL = 'INTERNAL',
  UNKNOWN = 'UNKNOWN'
}

export interface ErrorReport {
  id: string;
  error: Error;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: Record<string, any>;
  recovered: boolean;
  correlationId?: string;
}