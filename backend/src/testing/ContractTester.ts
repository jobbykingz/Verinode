import { EventEmitter } from 'events';

export interface ContractDefinition {
  endpoint: string;
  method: string;
  requestSchema?: any;
  responseSchemas: {
    [statusCode: string]: any;
  };
  headers?: {
    required: string[];
    optional?: string[];
  };
  authentication?: {
    required: boolean;
    type?: 'bearer' | 'api-key' | 'basic';
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    expected?: any;
    actual?: any;
  }>;
  warnings: string[];
}

/**
 * ContractTester - Validates API responses against contract definitions
 */
export class ContractTester extends EventEmitter {
  private contracts: Map<string, ContractDefinition> = new Map();
  private validationResults: Map<string, ValidationResult[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Register a contract definition
   */
  registerContract(contract: ContractDefinition): void {
    const key = `${contract.method}:${contract.endpoint}`;
    this.contracts.set(key, contract);
    
    console.log(`Contract registered: ${contract.method} ${contract.endpoint}`);
    this.emit('contractRegistered', { contract });
  }

  /**
   * Validate a response against its contract
   */
  async validateResponse(
    endpoint: string,
    method: string,
    response: {
      statusCode: number;
      headers: Record<string, string>;
      body: any;
    },
    request?: {
      headers?: Record<string, string>;
      body?: any;
    }
  ): Promise<ValidationResult> {
    const contractKey = `${method}:${endpoint}`;
    const contract = this.contracts.get(contractKey);

    if (!contract) {
      return {
        valid: false,
        errors: [{
          field: 'contract',
          message: `No contract found for ${method} ${endpoint}`,
        }],
        warnings: [],
      };
    }

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Validate status code
    this.validateStatusCode(contract, response.statusCode, result);

    // Validate headers
    this.validateHeaders(contract, response.headers, result);

    // Validate response body
    this.validateResponseBody(contract, response.statusCode, response.body, result);

    // Validate authentication if required
    if (contract.authentication?.required && request) {
      this.validateAuthentication(contract, request.headers, result);
    }

    // Store validation result
    this.storeValidationResult(contractKey, result);

    console.log(`Contract validation for ${contractKey}: ${result.valid ? 'PASSED' : 'FAILED'}`);
    this.emit('validationComplete', { contractKey, result });

    return result;
  }

  /**
   * Validate request against contract
   */
  validateRequest(
    endpoint: string,
    method: string,
    request: {
      headers: Record<string, string>;
      body: any;
      params?: Record<string, string>;
      query?: Record<string, string>;
    }
  ): ValidationResult {
    const contractKey = `${method}:${endpoint}`;
    const contract = this.contracts.get(contractKey);

    if (!contract) {
      return {
        valid: false,
        errors: [{
          field: 'contract',
          message: `No contract found for ${method} ${endpoint}`,
        }],
        warnings: [],
      };
    }

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Validate required headers
    this.validateRequestHeaders(contract, request.headers, result);

    // Validate request body
    this.validateRequestBody(contract, request.body, result);

    this.emit('requestValidationComplete', { contractKey, result });

    return result;
  }

  /**
   * Validate status code
   */
  private validateStatusCode(
    contract: ContractDefinition,
    statusCode: number,
    result: ValidationResult
  ): void {
    if (!contract.responseSchemas[statusCode]) {
      result.valid = false;
      result.errors.push({
        field: 'statusCode',
        message: `Unexpected status code: ${statusCode}`,
        expected: Object.keys(contract.responseSchemas),
        actual: statusCode,
      });
    }
  }

  /**
   * Validate response headers
   */
  private validateHeaders(
    contract: ContractDefinition,
    headers: Record<string, string>,
    result: ValidationResult
  ): void {
    if (!contract.headers) {
      return;
    }

    // Check required headers
    for (const requiredHeader of contract.headers.required) {
      if (!headers[requiredHeader.toLowerCase()]) {
        result.valid = false;
        result.errors.push({
          field: `headers.${requiredHeader}`,
          message: `Required header is missing`,
          expected: requiredHeader,
          actual: undefined,
        });
      }
    }

    // Check Content-Type
    if (headers['content-type'] && !headers['content-type'].includes('application/json')) {
      result.warnings.push('Content-Type is not application/json');
    }
  }

  /**
   * Validate request headers
   */
  private validateRequestHeaders(
    contract: ContractDefinition,
    headers: Record<string, string>,
    result: ValidationResult
  ): void {
    if (!contract.headers) {
      return;
    }

    // Check required headers
    for (const requiredHeader of contract.headers.required) {
      if (!headers[requiredHeader.toLowerCase()]) {
        result.valid = false;
        result.errors.push({
          field: `headers.${requiredHeader}`,
          message: `Required request header is missing`,
          expected: requiredHeader,
          actual: undefined,
        });
      }
    }

    // Check authentication header if required
    if (contract.authentication?.required) {
      const authHeader = headers['authorization'];
      
      if (!authHeader) {
        result.valid = false;
        result.errors.push({
          field: 'headers.authorization',
          message: 'Authorization header is required',
          expected: 'Bearer token or API key',
          actual: undefined,
        });
      } else if (contract.authentication.type === 'bearer' && !authHeader.startsWith('Bearer ')) {
        result.valid = false;
        result.errors.push({
          field: 'headers.authorization',
          message: 'Authorization header should be Bearer token',
          expected: 'Bearer <token>',
          actual: authHeader,
        });
      }
    }
  }

  /**
   * Validate response body against schema
   */
  private validateResponseBody(
    contract: ContractDefinition,
    statusCode: number,
    body: any,
    result: ValidationResult
  ): void {
    const schema = contract.responseSchemas[statusCode];

    if (!schema) {
      return; // Status code already marked as invalid
    }

    // Simple schema validation (in production, use a proper JSON Schema validator)
    this.validateAgainstSchema(body, schema, 'response', result);
  }

  /**
   * Validate request body against schema
   */
  private validateRequestBody(
    contract: ContractDefinition,
    body: any,
    result: ValidationResult
  ): void {
    if (!contract.requestSchema) {
      return;
    }

    this.validateAgainstSchema(body, contract.requestSchema, 'request', result);
  }

  /**
   * Validate data against schema
   */
  private validateAgainstSchema(
    data: any,
    schema: any,
    context: string,
    result: ValidationResult,
    path: string = ''
  ): void {
    if (!schema || typeof schema !== 'object') {
      return;
    }

    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data && !(field in data)) {
          result.valid = false;
          result.errors.push({
            field: `${path}${field}`,
            message: `Required ${context} field is missing`,
            expected: field,
            actual: undefined,
          });
        }
      }
    }

    // Check field types
    if (schema.properties) {
      for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
        const fieldValue = data?.[fieldName];
        const fieldPath = path ? `${path}.${fieldName}` : fieldName;

        if (fieldValue !== undefined) {
          this.validateFieldType(fieldValue, fieldSchema as any, fieldPath, result);
        }
      }
    }
  }

  /**
   * Validate field type
   */
  private validateFieldType(
    value: any,
    schema: any,
    fieldPath: string,
    result: ValidationResult
  ): void {
    if (!schema.type) {
      return;
    }

    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType !== schema.type) {
      // Special case: null is acceptable for nullable fields
      if (value === null && schema.nullable) {
        return;
      }

      result.valid = false;
      result.errors.push({
        field: fieldPath,
        message: `Invalid type for ${fieldPath}`,
        expected: schema.type,
        actual: actualType,
      });
    }

    // Validate array items
    if (schema.type === 'array' && schema.items && Array.isArray(value)) {
      value.forEach((item, index) => {
        this.validateFieldType(item, schema.items, `${fieldPath}[${index}]`, result);
      });
    }

    // Validate object properties recursively
    if (schema.type === 'object' && schema.properties && typeof value === 'object') {
      this.validateAgainstSchema(value, schema, 'nested', result, fieldPath);
    }
  }

  /**
   * Validate authentication
   */
  private validateAuthentication(
    contract: ContractDefinition,
    headers: Record<string, string> | undefined,
    result: ValidationResult
  ): void {
    if (!headers?.authorization) {
      result.valid = false;
      result.errors.push({
        field: 'authentication',
        message: 'Authentication is required',
        expected: 'Valid authorization header',
        actual: undefined,
      });
    }
  }

  /**
   * Store validation result
   */
  private storeValidationResult(contractKey: string, result: ValidationResult): void {
    if (!this.validationResults.has(contractKey)) {
      this.validationResults.set(contractKey, []);
    }
    this.validationResults.get(contractKey)!.push(result);
  }

  /**
   * Get validation history
   */
  getValidationHistory(contractKey?: string): Map<string, ValidationResult[]> {
    if (contractKey) {
      const history = new Map<string, ValidationResult[]>();
      history.set(contractKey, this.validationResults.get(contractKey) || []);
      return history;
    }

    return new Map(this.validationResults);
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    totalValidations: number;
    passedValidations: number;
    failedValidations: number;
    passRate: number;
  } {
    let totalValidations = 0;
    let passedValidations = 0;

    for (const results of this.validationResults.values()) {
      for (const result of results) {
        totalValidations++;
        if (result.valid) {
          passedValidations++;
        }
      }
    }

    return {
      totalValidations,
      passedValidations,
      failedValidations: totalValidations - passedValidations,
      passRate: totalValidations > 0 ? (passedValidations / totalValidations) * 100 : 0,
    };
  }

  /**
   * Get all registered contracts
   */
  getAllContracts(): Map<string, ContractDefinition> {
    return new Map(this.contracts);
  }

  /**
   * Clear validation history
   */
  clearHistory(contractKey?: string): void {
    if (contractKey) {
      this.validationResults.delete(contractKey);
    } else {
      this.validationResults.clear();
    }
  }
}

export const contractTester = new ContractTester();
