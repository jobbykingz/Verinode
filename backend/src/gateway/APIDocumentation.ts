import { logger } from '../utils/logger';

export interface DocumentationConfig {
  enableAutoGeneration: boolean;
  enableInteractiveDocs: boolean;
  enableCodeExamples: boolean;
  enableTestConsole: boolean;
  enableSDKGeneration: boolean;
  outputFormats: Array<'openapi' | 'swagger' | 'postman' | 'insomnia' | 'raml' | 'api_blueprint'>;
  includeDeprecated: boolean;
  includeInternal: boolean;
  securityDefinitions: boolean;
  responseExamples: boolean;
  requestExamples: boolean;
  customTemplates: boolean;
  branding: {
    title: string;
    description: string;
    version: string;
    contact: {
      name: string;
      email: string;
      url: string;
    };
    license: {
      name: string;
      url: string;
    };
  };
}

export interface APIEndpoint {
  id: string;
  path: string;
  method: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Response[];
  security: SecurityRequirement[];
  deprecated: boolean;
  internal: boolean;
  version: string;
  examples: Example[];
  testing: TestConfig;
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'integer' | 'array' | 'object';
  format?: string;
  enum?: string[];
  default?: any;
  example?: any;
  validation?: {
    pattern?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
  };
}

export interface RequestBody {
  description: string;
  required: boolean;
  contentType: string;
  schema: Schema;
  example?: any;
}

export interface Response {
  code: string;
  description: string;
  contentType: string;
  schema: Schema;
  example?: any;
  headers?: Record<string, Parameter>;
}

export interface Schema {
  type: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  example?: any;
  enum?: string[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface SecurityRequirement {
  type: 'apiKey' | 'oauth2' | 'basic' | 'bearer';
  description: string;
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  flows?: {
    implicit?: OAuthFlow;
    password?: OAuthFlow;
    clientCredentials?: OAuthFlow;
    authorizationCode?: OAuthFlow;
  };
}

export interface OAuthFlow {
  authorizationUrl: string;
  tokenUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface Example {
  title: string;
  description: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  response: {
    code: number;
    headers: Record<string, string>;
    body: any;
  };
  curl: string;
  javascript: string;
  python: string;
  nodejs: string;
}

export interface TestConfig {
  enabled: boolean;
  testCases: TestCase[];
  mockData: Record<string, any>;
  testScenarios: TestScenario[];
}

export interface TestCase {
  name: string;
  description: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
  };
  expectedResponse: {
    code: number;
    body?: any;
    headers?: Record<string, string>;
  };
  setup?: string[];
  teardown?: string[];
}

export interface TestScenario {
  name: string;
  description: string;
  steps: Array<{
    name: string;
    endpoint: string;
    request: any;
    assertions: Assertion[];
  }>;
}

export interface Assertion {
  type: 'status' | 'header' | 'body' | 'response_time';
  property?: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  value: any;
}

export interface GeneratedDocumentation {
  format: string;
  content: string;
  metadata: {
    generatedAt: number;
    version: string;
    endpoints: number;
    schemas: number;
    examples: number;
    tests: number;
  };
}

export class APIDocumentationGenerator {
  private config: DocumentationConfig;
  private endpoints: Map<string, APIEndpoint> = new Map();
  private schemas: Map<string, Schema> = new Map();
  private examples: Map<string, Example> = new Map();

  constructor(config: Partial<DocumentationConfig> = {}) {
    this.config = {
      enableAutoGeneration: true,
      enableInteractiveDocs: true,
      enableCodeExamples: true,
      enableTestConsole: true,
      enableSDKGeneration: true,
      outputFormats: ['openapi', 'swagger'],
      includeDeprecated: false,
      includeInternal: false,
      securityDefinitions: true,
      responseExamples: true,
      requestExamples: true,
      customTemplates: false,
      branding: {
        title: 'Verinode Gateway API',
        description: 'Enterprise-grade API Gateway with advanced features',
        version: '1.0.0',
        contact: {
          name: 'API Team',
          email: 'api@verinode.com',
          url: 'https://verinode.com/support',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      ...config,
    };
  }

  public addEndpoint(endpoint: APIEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
    logger.info(`API documentation endpoint added: ${endpoint.id}`);
  }

  public removeEndpoint(endpointId: string): void {
    if (this.endpoints.delete(endpointId)) {
      logger.info(`API documentation endpoint removed: ${endpointId}`);
    }
  }

  public addSchema(name: string, schema: Schema): void {
    this.schemas.set(name, schema);
    logger.info(`API documentation schema added: ${name}`);
  }

  public addExample(name: string, example: Example): void {
    this.examples.set(name, example);
    logger.info(`API documentation example added: ${name}`);
  }

  public async generateDocumentation(format: 'openapi' | 'swagger' | 'postman' | 'insomnia' | 'raml' | 'api_blueprint'): Promise<GeneratedDocumentation> {
    const startTime = Date.now();

    try {
      let content: string;

      switch (format) {
        case 'openapi':
          content = await this.generateOpenAPIDocument();
          break;
        case 'swagger':
          content = await this.generateSwaggerDocument();
          break;
        case 'postman':
          content = await this.generatePostmanCollection();
          break;
        case 'insomnia':
          content = await this.generateInsomniaExport();
          break;
        case 'raml':
          content = await this.generateRAMLDocument();
          break;
        case 'api_blueprint':
          content = await this.generateAPIBlueprint();
          break;
        default:
          throw new Error(`Unsupported documentation format: ${format}`);
      }

      const metadata = {
        generatedAt: startTime,
        version: this.config.branding.version,
        endpoints: this.endpoints.size,
        schemas: this.schemas.size,
        examples: this.examples.size,
        tests: this.calculateTotalTests(),
      };

      logger.info(`API documentation generated in ${format} format`, metadata);

      return {
        format,
        content,
        metadata,
      };

    } catch (error) {
      logger.error(`Documentation generation error for ${format}:`, error);
      throw error;
    }
  }

  private async generateOpenAPIDocument(): Promise<string> {
    const openapiDoc = {
      openapi: '3.0.0',
      info: {
        title: this.config.branding.title,
        description: this.config.branding.description,
        version: this.config.branding.version,
        contact: this.config.branding.contact,
        license: this.config.branding.license,
      },
      servers: [
        {
          url: 'https://api.verinode.com/v1',
          description: 'Production server',
        },
        {
          url: 'https://staging-api.verinode.com/v1',
          description: 'Staging server',
        },
      ],
      paths: this.generatePaths(),
      components: {
        schemas: this.generateSchemas(),
        securitySchemes: this.generateSecuritySchemes(),
        examples: this.generateExamples(),
      },
      tags: this.generateTags(),
      security: this.generateGlobalSecurity(),
    };

    return JSON.stringify(openapiDoc, null, 2);
  }

  private async generateSwaggerDocument(): Promise<string> {
    const swaggerDoc = {
      swagger: '2.0',
      info: {
        title: this.config.branding.title,
        description: this.config.branding.description,
        version: this.config.branding.version,
        contact: this.config.branding.contact,
        license: this.config.branding.license,
      },
      host: 'api.verinode.com',
      basePath: '/v1',
      schemes: ['https', 'http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      paths: this.generateSwaggerPaths(),
      definitions: this.generateSwaggerDefinitions(),
      securityDefinitions: this.generateSwaggerSecurityDefinitions(),
      tags: this.generateTags(),
    };

    return JSON.stringify(swaggerDoc, null, 2);
  }

  private async generatePostmanCollection(): Promise<string> {
    const collection = {
      info: {
        name: this.config.branding.title,
        description: this.config.branding.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: this.generatePostmanItems(),
      variable: [
        {
          key: 'baseUrl',
          value: 'https://api.verinode.com/v1',
          type: 'string',
        },
        {
          key: 'apiKey',
          value: '{{apiKey}}',
          type: 'string',
        },
      ],
      auth: {
        type: 'apikey',
        apikey: [
          {
            key: 'value',
            value: '{{apiKey}}',
            type: 'string',
          },
          {
            key: 'key',
            value: 'X-API-Key',
            type: 'string',
          },
        ],
      },
    };

    return JSON.stringify(collection, null, 2);
  }

  private async generateInsomniaExport(): Promise<string> {
    const insomniaDoc = {
      _type: 'export',
      __export_format: 4,
      __export_date: new Date().toISOString(),
      __export_source: 'verinode-gateway',
      resources: this.generateInsomniaResources(),
    };

    return JSON.stringify(insomniaDoc, null, 2);
  }

  private async generateRAMLDocument(): Promise<string> {
    let raml = `#%RAML 1.0
title: ${this.config.branding.title}
description: ${this.config.branding.description}
version: ${this.config.branding.version}
baseUri: https://api.verinode.com/{version}
`;

    // Add security schemes
    if (this.config.securityDefinitions) {
      raml += `securitySchemes:
  ApiKeyAuth:
    type: apiKey
    describedBy:
      headers:
        X-API-Key:
          type: string
          description: API key for authentication
      responses:
        401:
          description: Unauthorized - Invalid API key
        403:
          description: Forbidden - API key doesn't have access

`;
    }

    // Add endpoints
    for (const endpoint of this.endpoints.values()) {
      if (!this.shouldIncludeEndpoint(endpoint)) continue;

      raml += `/${endpoint.path}:
  ${endpoint.method.toLowerCase()}:
    description: ${endpoint.description || endpoint.summary}
`;

      // Add parameters
      if (endpoint.parameters.length > 0) {
        raml += `    queryParameters:\n`;
        for (const param of endpoint.parameters.filter(p => p.in === 'query')) {
          raml += `      ${param.name}:
        type: ${param.type}
        required: ${param.required}
        description: ${param.description}
`;
        }
      }

      // Add request body
      if (endpoint.requestBody) {
        raml += `    body:
      application/json:
        type: ${endpoint.requestBody.schema.type}
        description: ${endpoint.requestBody.description}
`;
      }

      // Add responses
      for (const response of endpoint.responses) {
        raml += `    responses:
      ${response.code}:
        description: ${response.description}
        body:
          application/json:
            type: ${response.schema.type}
`;
      }
    }

    return raml;
  }

  private async generateAPIBlueprint(): Promise<string> {
    let blueprint = `FORMAT: 1A
HOST: https://api.verinode.com

# ${this.config.branding.title}

${this.config.branding.description}

`;

    // Add endpoints
    for (const endpoint of this.endpoints.values()) {
      if (!this.shouldIncludeEndpoint(endpoint)) continue;

      blueprint += `## ${endpoint.summary} [${endpoint.method.toUpperCase()}]

${endpoint.description || endpoint.summary}

### Request Parameters

`;

      for (const param of endpoint.parameters) {
        blueprint += `- ${param.name} (${param.type}, ${param.required ? 'required' : 'optional'}) - ${param.description}
`;
      }

      if (endpoint.requestBody) {
        blueprint += `### Request Body (application/json)

\`\`\`json
${JSON.stringify(endpoint.requestBody.example || {}, null, 2)}
\`\`\`

`;
      }

      for (const response of endpoint.responses) {
        blueprint += `### Response ${response.code} (${response.description})

\`\`\`json
${JSON.stringify(response.example || {}, null, 2)}
\`\`\`

`;
      }
    }

    return blueprint;
  }

  private generatePaths(): any {
    const paths: any = {};

    for (const endpoint of this.endpoints.values()) {
      if (!this.shouldIncludeEndpoint(endpoint)) continue;

      const pathItem: any = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        parameters: this.generateParameters(endpoint.parameters),
        responses: this.generateResponses(endpoint.responses),
        deprecated: endpoint.deprecated,
      };

      if (endpoint.requestBody) {
        pathItem.requestBody = {
          description: endpoint.requestBody.description,
          required: endpoint.requestBody.required,
          content: {
            [endpoint.requestBody.contentType]: {
              schema: endpoint.requestBody.schema,
            },
          },
        };

        if (endpoint.requestBody.example) {
          pathItem.requestBody.content[endpoint.requestBody.contentType].example = endpoint.requestBody.example;
        }
      }

      if (endpoint.security.length > 0) {
        pathItem.security = endpoint.security.map(req => ({ [req.type]: [] }));
      }

      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      paths[endpoint.path][endpoint.method.toLowerCase()] = pathItem;
    }

    return paths;
  }

  private generateSwaggerPaths(): any {
    const paths: any = {};

    for (const endpoint of this.endpoints.values()) {
      if (!this.shouldIncludeEndpoint(endpoint)) continue;

      const pathItem: any = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        parameters: this.generateSwaggerParameters(endpoint.parameters),
        responses: this.generateSwaggerResponses(endpoint.responses),
        deprecated: endpoint.deprecated,
      };

      if (endpoint.requestBody) {
        pathItem.parameters.push({
          in: 'body',
          name: 'body',
          description: endpoint.requestBody.description,
          required: endpoint.requestBody.required,
          schema: endpoint.requestBody.schema,
        });
      }

      if (endpoint.security.length > 0) {
        pathItem.security = endpoint.security.map(req => ({ [req.name || req.type]: [] }));
      }

      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      paths[endpoint.path][endpoint.method.toLowerCase()] = pathItem;
    }

    return paths;
  }

  private generateParameters(parameters: Parameter[]): any[] {
    return parameters
      .filter(param => param.in !== 'body')
      .map(param => ({
        name: param.name,
        in: param.in,
        description: param.description,
        required: param.required,
        schema: {
          type: param.type,
          format: param.format,
          enum: param.enum,
          default: param.default,
          example: param.example,
          minimum: param.validation?.minimum,
          maximum: param.validation?.maximum,
          minLength: param.validation?.minLength,
          maxLength: param.validation?.maxLength,
          pattern: param.validation?.pattern,
        },
      }));
  }

  private generateSwaggerParameters(parameters: Parameter[]): any[] {
    return parameters
      .filter(param => param.in !== 'body')
      .map(param => ({
        name: param.name,
        in: param.in,
        description: param.description,
        required: param.required,
        type: param.type,
        format: param.format,
        enum: param.enum,
        default: param.default,
        example: param.example,
        minimum: param.validation?.minimum,
        maximum: param.validation?.maximum,
        minLength: param.validation?.minLength,
        maxLength: param.validation?.maxLength,
        pattern: param.validation?.pattern,
      }));
  }

  private generateResponses(responses: Response[]): any {
    const responseObj: any = {};

    for (const response of responses) {
      responseObj[response.code] = {
        description: response.description,
        content: {
          [response.contentType]: {
            schema: response.schema,
          },
        },
      };

      if (response.example) {
        responseObj[response.code].content[response.contentType].example = response.example;
      }

      if (response.headers) {
        responseObj[response.code].headers = response.headers;
      }
    }

    return responseObj;
  }

  private generateSwaggerResponses(responses: Response[]): any {
    const responseObj: any = {};

    for (const response of responses) {
      responseObj[response.code] = {
        description: response.description,
        schema: response.schema,
      };

      if (response.example) {
        responseObj[response.code].examples = {
          'application/json': {
            value: response.example,
          },
        };
      }

      if (response.headers) {
        responseObj[response.code].headers = response.headers;
      }
    }

    return responseObj;
  }

  private generateSchemas(): any {
    const schemas: any = {};

    for (const [name, schema] of this.schemas.entries()) {
      schemas[name] = schema;
    }

    return schemas;
  }

  private generateSwaggerDefinitions(): any {
    const definitions: any = {};

    for (const [name, schema] of this.schemas.entries()) {
      definitions[name] = schema;
    }

    return definitions;
  }

  private generateSecuritySchemes(): any {
    if (!this.config.securityDefinitions) return {};

    return {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for authentication',
      },
    };
  }

  private generateSwaggerSecurityDefinitions(): any {
    if (!this.config.securityDefinitions) return {};

    return {
      ApiKeyAuth: {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API key for authentication',
      },
      BearerAuth: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'Bearer token for authentication',
      },
    };
  }

  private generateExamples(): any {
    const examples: any = {};

    for (const [name, example] of this.examples.entries()) {
      examples[name] = {
        summary: example.title,
        description: example.description,
        value: example.response.body,
      };
    }

    return examples;
  }

  private generateTags(): any[] {
    const tagSet = new Set<string>();

    for (const endpoint of this.endpoints.values()) {
      for (const tag of endpoint.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).map(tag => ({
      name: tag,
      description: `Endpoints related to ${tag}`,
    }));
  }

  private generateGlobalSecurity(): any[] {
    const securityTypes = new Set<string>();

    for (const endpoint of this.endpoints.values()) {
      for (const security of endpoint.security) {
        securityTypes.add(security.type);
      }
    }

    return Array.from(securityTypes).map(type => ({ [type]: [] }));
  }

  private generatePostmanItems(): any[] {
    const items: any[] = [];
    const groupedEndpoints = this.groupEndpointsByTag();

    for (const [tag, endpoints] of groupedEndpoints.entries()) {
      const folder = {
        name: tag,
        description: `Endpoints for ${tag}`,
        item: [],
      };

      for (const endpoint of endpoints) {
        if (!this.shouldIncludeEndpoint(endpoint)) continue;

        const item = {
          name: endpoint.summary,
          request: {
            method: endpoint.method.toUpperCase(),
            header: this.generatePostmanHeaders(endpoint),
            body: this.generatePostmanBody(endpoint),
            url: {
              raw: `{{baseUrl}}${endpoint.path}`,
              host: ['{{baseUrl}}'],
              path: endpoint.path.split('/').filter(p => p),
              query: this.generatePostmanQuery(endpoint),
            },
            description: endpoint.description,
          },
          response: this.generatePostmanResponses(endpoint),
        };

        folder.item.push(item);
      }

      items.push(folder);
    }

    return items;
  }

  private generateInsomniaResources(): any[] {
    const resources: any[] = [];

    // Add workspace
    resources.push({
      _id: 'wrk_' + this.generateId(),
      _type: 'workspace',
      name: this.config.branding.title,
      description: this.config.branding.description,
    });

    // Add endpoints
    for (const endpoint of this.endpoints.values()) {
      if (!this.shouldIncludeEndpoint(endpoint)) continue;

      resources.push({
        _id: 'req_' + this.generateId(),
        _type: 'request',
        parentId: 'wrk_' + this.generateId(),
        name: endpoint.summary,
        url: 'https://api.verinode.com/v1' + endpoint.path,
        method: endpoint.method.toUpperCase(),
        headers: this.generateInsomniaHeaders(endpoint),
        body: this.generateInsomniaBody(endpoint),
        description: endpoint.description,
      });
    }

    return resources;
  }

  private groupEndpointsByTag(): Map<string, APIEndpoint[]> {
    const grouped = new Map<string, APIEndpoint[]>();

    for (const endpoint of this.endpoints.values()) {
      if (!this.shouldIncludeEndpoint(endpoint)) continue;

      for (const tag of endpoint.tags) {
        if (!grouped.has(tag)) {
          grouped.set(tag, []);
        }
        grouped.get(tag)!.push(endpoint);
      }
    }

    return grouped;
  }

  private shouldIncludeEndpoint(endpoint: APIEndpoint): boolean {
    if (endpoint.internal && !this.config.includeInternal) {
      return false;
    }

    if (endpoint.deprecated && !this.config.includeDeprecated) {
      return false;
    }

    return true;
  }

  private generatePostmanHeaders(endpoint: APIEndpoint): any[] {
    const headers = [
      {
        key: 'Content-Type',
        value: 'application/json',
        description: 'Content type',
      },
    ];

    for (const param of endpoint.parameters.filter(p => p.in === 'header')) {
      headers.push({
        key: param.name,
        value: param.example || param.default || '',
        description: param.description,
      });
    }

    return headers;
  }

  private generatePostmanBody(endpoint: APIEndpoint): any {
    if (!endpoint.requestBody) return undefined;

    return {
      mode: 'raw',
      raw: JSON.stringify(endpoint.requestBody.example || {}, null, 2),
      options: {
        raw: {
          language: 'json',
        },
      },
    };
  }

  private generatePostmanQuery(endpoint: APIEndpoint): any[] {
    return endpoint.parameters
      .filter(param => param.in === 'query')
      .map(param => ({
        key: param.name,
        value: param.example || param.default || '',
        description: param.description,
        disabled: !param.required,
      }));
  }

  private generatePostmanResponses(endpoint: APIEndpoint): any[] {
    return endpoint.responses.map(response => ({
      name: `${response.code} ${response.description}`,
      originalRequest: {
        method: endpoint.method.toUpperCase(),
        url: 'https://api.verinode.com/v1' + endpoint.path,
      },
      status: response.code,
      code: parseInt(response.code),
      header: [
        {
          key: 'Content-Type',
          value: response.contentType,
        },
      ],
      body: JSON.stringify(response.example || {}, null, 2),
    }));
  }

  private generateInsomniaHeaders(endpoint: APIEndpoint): any[] {
    const headers = [
      {
        name: 'Content-Type',
        value: 'application/json',
      },
    ];

    for (const param of endpoint.parameters.filter(p => p.in === 'header')) {
      headers.push({
        name: param.name,
        value: param.example || param.default || '',
      });
    }

    return headers;
  }

  private generateInsomniaBody(endpoint: APIEndpoint): any {
    if (!endpoint.requestBody) return undefined;

    return {
      mimeType: 'application/json',
      text: JSON.stringify(endpoint.requestBody.example || {}, null, 2),
    };
  }

  private calculateTotalTests(): number {
    return Array.from(this.endpoints.values())
      .reduce((total, endpoint) => total + (endpoint.testing?.testCases?.length || 0), 0);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // SDK Generation
  public async generateSDK(language: 'javascript' | 'python' | 'java' | 'csharp' | 'go' | 'php'): Promise<string> {
    switch (language) {
      case 'javascript':
        return this.generateJavaScriptSDK();
      case 'python':
        return this.generatePythonSDK();
      case 'java':
        return this.generateJavaSDK();
      case 'csharp':
        return this.generateCSharpSDK();
      case 'go':
        return this.generateGoSDK();
      case 'php':
        return this.generatePHPSDK();
      default:
        throw new Error(`Unsupported SDK language: ${language}`);
    }
  }

  private generateJavaScriptSDK(): string {
    let sdk = `/**
 * ${this.config.branding.title} JavaScript SDK
 * Version: ${this.config.branding.version}
 */

class VerinodeGateway {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'https://api.verinode.com/v1';
    this.apiKey = options.apiKey || '';
    this.timeout = options.timeout || 30000;
  }

  async request(method, path, data = null, headers = {}) {
    const url = \`\${this.baseURL}\${path}\`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...headers,
      },
      timeout: this.timeout,
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Request failed');
      }

      return responseData;
    } catch (error) {
      throw new Error(\`API request failed: \${error.message}\`);
    }
  }
`;

    // Add methods for each endpoint
    for (const endpoint of this.endpoints.values()) {
      if (!this.shouldIncludeEndpoint(endpoint)) continue;

      const methodName = this.generateMethodName(endpoint);
      const pathParams = endpoint.parameters.filter(p => p.in === 'path');
      const queryParams = endpoint.parameters.filter(p => p.in === 'query');

      sdk += `
  async ${methodName}(${this.generateMethodParameters(endpoint)}) {
    let path = '${endpoint.path}';
`;

      // Handle path parameters
      for (const param of pathParams) {
        sdk += `    path = path.replace(':${param.name}', ${param.name});
`;
      }

      // Handle query parameters
      if (queryParams.length > 0) {
        sdk += `    const query = new URLSearchParams();
`;
        for (const param of queryParams) {
          sdk += `    if (${param.name} !== undefined) query.append('${param.name}', ${param.name});
`;
        }
        sdk += `    path += '?' + query.toString();
`;
      }

      sdk += `
    return this.request('${endpoint.method.toUpperCase()}', path${endpoint.requestBody ? ', data' : ''});
  }
`;
    }

    sdk += `
}

module.exports = VerinodeGateway;
`;

    return sdk;
  }

  private generatePythonSDK(): string {
    let sdk = `"""
${this.config.branding.title} Python SDK
Version: ${this.config.branding.version}
"""

import requests
import json
from typing import Dict, Any, Optional

class VerinodeGateway:
    def __init__(self, base_url: str = "https://api.verinode.com/v1", 
                 api_key: str = "", timeout: int = 30):
        self.base_url = base_url
        self.api_key = api_key
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'X-API-Key': api_key
        })

    def _request(self, method: str, path: str, data: Optional[Dict[str, Any]] = None, 
                 headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                headers=headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"API request failed: {str(e)}")
`;

    // Add methods for each endpoint
    for (const endpoint of this.endpoints.values()) {
      if (!this.shouldIncludeEndpoint(endpoint)) continue;

      const methodName = this.generateMethodName(endpoint);
      const pathParams = endpoint.parameters.filter(p => p.in === 'path');
      const queryParams = endpoint.parameters.filter(p => p.in === 'query');

      sdk += `
    def ${methodName}(${this.generatePythonMethodParameters(endpoint)}) -> Dict[str, Any]:
        path = "${endpoint.path}"
`;

      // Handle path parameters
      for (const param of pathParams) {
        sdk += `        path = path.replace(':${param.name}', str(${param.name}))
`;
      }

      // Handle query parameters
      if (queryParams.length > 0) {
        sdk += `        query_params = {}
`;
        for (const param of queryParams) {
          sdk += `        if ${param.name} is not None:
            query_params['${param.name}'] = ${param.name}
`;
        }
        sdk += `        # Add query parameters to path (implementation depends on your needs)
`;
      }

      sdk += `        return self._request('${endpoint.method.toUpperCase()}', path${endpoint.requestBody ? ', data' : ''})
`;
    }

    sdk += `
`;

    return sdk;
  }

  private generateJavaSDK(): string {
    // Simplified Java SDK generation
    return `/**
 * ${this.config.branding.title} Java SDK
 * Version: ${this.config.branding.version}
 */

// Java SDK implementation would go here
// This is a placeholder for demonstration
public class VerinodeGateway {
    private String baseURL;
    private String apiKey;
    
    public VerinodeGateway(String baseURL, String apiKey) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
    }
    
    // Add endpoint methods here
}
`;
  }

  private generateCSharpSDK(): string {
    // Simplified C# SDK generation
    return `using System;
using System.Net.Http;
using System.Text.Json;

namespace VerinodeGateway
{
    /// <summary>
    /// ${this.config.branding.title} C# SDK
    /// Version: ${this.config.branding.version}
    /// </summary>
    public class VerinodeGateway
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseURL;
        
        public VerinodeGateway(string baseURL, string apiKey)
        {
            _baseURL = baseURL;
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Add("X-API-Key", apiKey);
        }
        
        // Add endpoint methods here
    }
}
`;
  }

  private generateGoSDK(): string {
    // Simplified Go SDK generation
    return `package verinode

/*
${this.config.branding.title} Go SDK
Version: ${this.config.branding.version}
*/

import (
    "net/http"
    "bytes"
    "encoding/json"
)

type VerinodeGateway struct {
    BaseURL string
    APIKey  string
    Client  *http.Client
}

func NewVerinodeGateway(baseURL, apiKey string) *VerinodeGateway {
    return &VerinodeGateway{
        BaseURL: baseURL,
        APIKey:  apiKey,
        Client:  &http.Client{},
    }
}

// Add endpoint methods here
`;
  }

  private generatePHPSDK(): string {
    // Simplified PHP SDK generation
    return `<?php
/**
 * ${this.config.branding.title} PHP SDK
 * Version: ${this.config.branding.version}
 */

class VerinodeGateway {
    private $baseURL;
    private $apiKey;
    private $timeout;
    
    public function __construct($options = []) {
        $this->baseURL = $options['baseURL'] ?? 'https://api.verinode.com/v1';
        $this->apiKey = $options['apiKey'] ?? '';
        $this->timeout = $options['timeout'] ?? 30;
    }
    
    private function request($method, $path, $data = null, $headers = []) {
        $url = $this->baseURL . $path;
        
        $options = [
            'http' => [
                'method' => $method,
                'header' => "Content-Type: application/json\\r\\n" .
                           "X-API-Key: " . $this->apiKey . "\\r\\n" .
                           implode("\\r\\n", array_map(function($k, $v) {
                               return "$k: $v";
                           }, array_keys($headers), $headers)),
                'timeout' => $this->timeout,
            ],
        ];
        
        if ($data) {
            $options['http']['content'] = json_encode($data);
        }
        
        $context = stream_context_create($options);
        $result = file_get_contents($url, false, $context);
        
        if ($result === false) {
            throw new Exception("API request failed");
        }
        
        return json_decode($result, true);
    }
    
    // Add endpoint methods here
}
`;
  }

  private generateMethodName(endpoint: APIEndpoint): string {
    const pathParts = endpoint.path.split('/').filter(p => p && !p.startsWith(':'));
    const methodPrefix = endpoint.method.toLowerCase();
    const pathSuffix = pathParts.map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('');
    
    return methodPrefix + pathSuffix;
  }

  private generateMethodParameters(endpoint: APIEndpoint): string {
    const params: string[] = [];
    
    // Path parameters (required)
    for (const param of endpoint.parameters.filter(p => p.in === 'path')) {
      params.push(`${param.name}`);
    }
    
    // Query parameters (optional)
    for (const param of endpoint.parameters.filter(p => p.in === 'query')) {
      params.push(`${param.name} = null`);
    }
    
    // Request body
    if (endpoint.requestBody) {
      params.push('data = null');
    }
    
    // Options/headers
    params.push('options = {}');
    
    return params.join(', ');
  }

  private generatePythonMethodParameters(endpoint: APIEndpoint): string {
    const params: string[] = ['self'];
    
    // Path parameters (required)
    for (const param of endpoint.parameters.filter(p => p.in === 'path')) {
      params.push(`${param.name}: str`);
    }
    
    // Query parameters (optional)
    for (const param of endpoint.parameters.filter(p => p.in === 'query')) {
      params.push(`${param.name}: Optional[Any] = None`);
    }
    
    // Request body
    if (endpoint.requestBody) {
      params.push('data: Optional[Dict[str, Any]] = None');
    }
    
    return params.join(', ');
  }

  // Public methods
  public getConfig(): DocumentationConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<DocumentationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('APIDocumentationGenerator configuration updated');
  }

  public getEndpoints(): APIEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  public getSchemas(): Schema[] {
    return Array.from(this.schemas.values());
  }

  public getExamples(): Example[] {
    return Array.from(this.examples.values());
  }
}
