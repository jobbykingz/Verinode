import { EventEmitter } from 'events';

export interface APISpec {
  endpoint: string;
  method: string;
  description?: string;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    location: 'path' | 'query' | 'body' | 'header';
  }>;
  requestBody?: any;
  responses?: {
    [statusCode: string]: {
      description: string;
      schema?: any;
    };
  };
}

export interface GeneratedTest {
  id: string;
  endpoint: string;
  method: string;
  testType: 'functional' | 'integration' | 'contract' | 'performance';
  description: string;
  request: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  };
  expectedResponse: {
    statusCode: number;
    schema?: any;
    validationRules: string[];
  };
}

/**
 * TestGenerator - Automatically generates API tests from specifications
 */
export class TestGenerator extends EventEmitter {
  private generatedTests: Map<string, GeneratedTest[]> = new Map();
  private apiSpecs: Map<string, APISpec[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Load API specifications
   */
  loadAPISpecs(specs: APISpec[]): void {
    for (const spec of specs) {
      if (!this.apiSpecs.has(spec.endpoint)) {
        this.apiSpecs.set(spec.endpoint, []);
      }
      this.apiSpecs.get(spec.endpoint)!.push(spec);
    }

    console.log(`Loaded ${specs.length} API specifications`);
    this.emit('specsLoaded', { count: specs.length });
  }

  /**
   * Generate tests for all loaded API specs
   */
  generateAllTests(): GeneratedTest[] {
    const allTests: GeneratedTest[] = [];

    for (const [endpoint, specs] of this.apiSpecs.entries()) {
      const tests = this.generateTestsForEndpoint(endpoint, specs);
      allTests.push(...tests);
    }

    return allTests;
  }

  /**
   * Generate tests for a specific endpoint
   */
  generateTestsForEndpoint(endpoint: string, specs: APISpec[]): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    for (const spec of specs) {
      // Generate functional tests
      tests.push(...this.generateFunctionalTests(spec));

      // Generate contract tests
      tests.push(...this.generateContractTests(spec));

      // Generate edge case tests
      tests.push(...this.generateEdgeCaseTests(spec));
    }

    this.generatedTests.set(endpoint, tests);
    console.log(`Generated ${tests.length} tests for endpoint: ${endpoint}`);
    this.emit('testsGenerated', { endpoint, count: tests.length });

    return tests;
  }

  /**
   * Generate functional tests
   */
  private generateFunctionalTests(spec: APISpec): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    // Happy path test
    tests.push({
      id: this.generateTestId(spec, 'happy_path'),
      endpoint: spec.endpoint,
      method: spec.method,
      testType: 'functional',
      description: `Should successfully execute ${spec.method} ${spec.endpoint}`,
      request: {
        url: spec.endpoint,
        method: spec.method,
        headers: this.getDefaultHeaders(),
        body: this.createValidRequestBody(spec),
      },
      expectedResponse: {
        statusCode: spec.responses?.['200'] ? 200 : 200,
        schema: spec.responses?.['200']?.schema,
        validationRules: [
          'response_should_be_defined',
          'status_code_should_match',
        ],
      },
    });

    // Test with missing optional parameters
    if (spec.parameters?.some(p => !p.required)) {
      tests.push({
        id: this.generateTestId(spec, 'missing_optional'),
        endpoint: spec.endpoint,
        method: spec.method,
        testType: 'functional',
        description: `Should handle missing optional parameters for ${spec.method} ${spec.endpoint}`,
        request: {
          url: spec.endpoint,
          method: spec.method,
          headers: this.getDefaultHeaders(),
          body: this.createMinimalRequestBody(spec),
        },
        expectedResponse: {
          statusCode: spec.responses?.['200'] ? 200 : 200,
          validationRules: ['response_should_be_defined'],
        },
      });
    }

    return tests;
  }

  /**
   * Generate contract tests
   */
  private generateContractTests(spec: APISpec): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    // Response schema validation
    if (spec.responses) {
      for (const [statusCode, response] of Object.entries(spec.responses)) {
        tests.push({
          id: this.generateTestId(spec, `contract_${statusCode}`),
          endpoint: spec.endpoint,
          method: spec.method,
          testType: 'contract',
          description: `Should return correct schema for ${statusCode} response`,
          request: {
            url: spec.endpoint,
            method: spec.method,
            headers: this.getDefaultHeaders(),
            body: this.createValidRequestBody(spec),
          },
          expectedResponse: {
            statusCode: parseInt(statusCode),
            schema: response.schema,
            validationRules: [
              'schema_validation_strict_mode',
              'required_fields_present',
              'field_types_correct',
            ],
          },
        });
      }
    }

    // Content-Type validation
    tests.push({
      id: this.generateTestId(spec, 'content_type'),
      endpoint: spec.endpoint,
      method: spec.method,
      testType: 'contract',
      description: `Should return correct Content-Type header for ${spec.method} ${spec.endpoint}`,
      request: {
        url: spec.endpoint,
        method: spec.method,
        headers: this.getDefaultHeaders(),
        body: this.createValidRequestBody(spec),
      },
      expectedResponse: {
        statusCode: 200,
        validationRules: ['content_type_should_be_application_json'],
      },
    });

    return tests;
  }

  /**
   * Generate edge case tests
   */
  private generateEdgeCaseTests(spec: APISpec): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    // Test with invalid parameters
    if (spec.parameters?.some(p => p.required)) {
      tests.push({
        id: this.generateTestId(spec, 'missing_required'),
        endpoint: spec.endpoint,
        method: spec.method,
        testType: 'functional',
        description: `Should reject request with missing required parameters for ${spec.method} ${spec.endpoint}`,
        request: {
          url: spec.endpoint,
          method: spec.method,
          headers: this.getDefaultHeaders(),
          body: {},
        },
        expectedResponse: {
          statusCode: 400,
          validationRules: ['error_message_should_be_present'],
        },
      });
    }

    // Test with invalid data types
    tests.push({
      id: this.generateTestId(spec, 'invalid_type'),
      endpoint: spec.endpoint,
      method: spec.method,
      testType: 'functional',
      description: `Should reject request with invalid data types for ${spec.method} ${spec.endpoint}`,
      request: {
        url: spec.endpoint,
        method: spec.method,
        headers: this.getDefaultHeaders(),
        body: this.createInvalidRequestBody(spec),
      },
      expectedResponse: {
        statusCode: 400,
        validationRules: ['error_message_should_be_present'],
      },
    });

    // Test authentication/authorization if needed
    tests.push({
      id: this.generateTestId(spec, 'unauthorized'),
      endpoint: spec.endpoint,
      method: spec.method,
      testType: 'functional',
      description: `Should reject unauthorized request for ${spec.method} ${spec.endpoint}`,
      request: {
        url: spec.endpoint,
        method: spec.method,
        headers: {}, // No auth headers
        body: this.createValidRequestBody(spec),
      },
      expectedResponse: {
        statusCode: 401,
        validationRules: ['error_message_should_indicate_unauthorized'],
      },
    });

    return tests;
  }

  /**
   * Generate unique test ID
   */
  private generateTestId(spec: APISpec, suffix: string): string {
    const sanitized = spec.endpoint.replace(/[^a-zA-Z0-9]/g, '_');
    return `test_${spec.method.toLowerCase()}_${sanitized}_${suffix}`;
  }

  /**
   * Get default headers
   */
  private getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Create valid request body from spec
   */
  private createValidRequestBody(spec: APISpec): any {
    if (!spec.requestBody) {
      return undefined;
    }

    // Simple implementation - in production, you'd use JSON Schema faker
    return spec.requestBody;
  }

  /**
   * Create minimal request body (only required fields)
   */
  private createMinimalRequestBody(spec: APISpec): any {
    if (!spec.requestBody || !spec.parameters) {
      return undefined;
    }

    const body: any = {};
    
    for (const param of spec.parameters.filter(p => p.required)) {
      if (param.location === 'body') {
        body[param.name] = this.getDefaultValueForType(param.type);
      }
    }

    return Object.keys(body).length > 0 ? body : undefined;
  }

  /**
   * Create invalid request body for testing
   */
  private createInvalidRequestBody(spec: APISpec): any {
    if (!spec.requestBody) {
      return undefined;
    }

    // Return body with wrong types
    const invalidBody: any = {};
    
    for (const key in spec.requestBody) {
      invalidBody[key] = 'INVALID_STRING_VALUE';
    }

    return invalidBody;
  }

  /**
   * Get default value for a type
   */
  private getDefaultValueForType(type: string): any {
    switch (type) {
      case 'string':
        return 'test_value';
      case 'number':
      case 'integer':
        return 1;
      case 'boolean':
        return true;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return null;
    }
  }

  /**
   * Get generated tests
   */
  getGeneratedTests(endpoint?: string): GeneratedTest[] {
    if (endpoint) {
      return this.generatedTests.get(endpoint) || [];
    }

    const allTests: GeneratedTest[] = [];
    for (const tests of this.generatedTests.values()) {
      allTests.push(...tests);
    }

    return allTests;
  }

  /**
   * Get test generation statistics
   */
  getStats(): {
    totalSpecs: number;
    totalTests: number;
    testsByType: Map<string, number>;
    testsByEndpoint: Map<string, number>;
  } {
    const testsByType = new Map<string, number>();
    const testsByEndpoint = new Map<string, number>();
    let totalTests = 0;

    for (const [endpoint, tests] of this.generatedTests.entries()) {
      testsByEndpoint.set(endpoint, tests.length);
      totalTests += tests.length;

      for (const test of tests) {
        const count = testsByType.get(test.testType) || 0;
        testsByType.set(test.testType, count + 1);
      }
    }

    return {
      totalSpecs: this.apiSpecs.size,
      totalTests,
      testsByType,
      testsByEndpoint,
    };
  }
}

export const testGenerator = new TestGenerator();
