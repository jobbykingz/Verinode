import { buildSchema, GraphQLSchema, printSchema, parse } from 'graphql';
import { WinstonLogger } from '../../utils/logger';

interface ServiceSchema {
  name: string;
  url: string;
  schema: GraphQLSchema;
  version: string;
}

interface CompositionResult {
  supergraphSdl: string;
  errors?: Array<{
    message: string;
    service: string;
    path?: string;
  }>;
  warnings?: Array<{
    message: string;
    service: string;
  }>;
}

interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SchemaComposer {
  private logger: WinstonLogger;
  private serviceSchemas: Map<string, ServiceSchema> = new Map();
  private compositionCache: Map<string, CompositionResult> = new Map();

  constructor() {
    this.logger = new WinstonLogger();
  }

  async addServiceSchema(serviceName: string, url: string, version: string = '1.0.0'): Promise<void> {
    try {
      this.logger.info(`Adding schema for service: ${serviceName}`);
      
      const schema = await this.fetchServiceSchema(url);
      
      const serviceSchema: ServiceSchema = {
        name: serviceName,
        url,
        schema,
        version
      };

      this.serviceSchemas.set(serviceName, serviceSchema);
      
      // Clear composition cache
      this.compositionCache.clear();
      
      this.logger.info(`Successfully added schema for service: ${serviceName}`);
    } catch (error) {
      this.logger.error(`Failed to add schema for service ${serviceName}:`, error);
      throw error;
    }
  }

  async removeServiceSchema(serviceName: string): Promise<void> {
    this.logger.info(`Removing schema for service: ${serviceName}`);
    
    this.serviceSchemas.delete(serviceName);
    this.compositionCache.clear();
    
    this.logger.info(`Successfully removed schema for service: ${serviceName}`);
  }

  private async fetchServiceSchema(url: string): Promise<GraphQLSchema> {
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType { name }
          mutationType { name }
          subscriptionType { name }
          types {
            ...FullType
          }
          directives {
            name
            description
            locations
            args {
              ...InputValue
            }
          }
        }
      }
      
      fragment FullType on __Type {
        kind
        name
        description
        fields(includeDeprecated: true) {
          name
          description
          args {
            ...InputValue
          }
          type {
            ...TypeRef
          }
          isDeprecated
          deprecationReason
        }
        inputFields {
          ...InputValue
        }
        interfaces {
          ...TypeRef
        }
        enumValues(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
        }
        possibleTypes {
          ...TypeRef
        }
      }
      
      fragment InputValue on __InputValue {
        name
        description
        type { ...TypeRef }
        defaultValue
      }
      
      fragment TypeRef on __Type {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: introspectionQuery
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch schema from ${url}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`Schema introspection errors: ${JSON.stringify(result.errors)}`);
      }

      const schema = buildSchema(JSON.stringify(result.data));
      return schema;
    } catch (error) {
      this.logger.error(`Failed to fetch schema from ${url}:`, error);
      throw error;
    }
  }

  async composeSupergraph(serviceList: Array<{ name: string; url: string }>): Promise<string> {
    const cacheKey = serviceList.map(s => `${s.name}:${s.url}`).sort().join('|');
    
    // Check cache first
    if (this.compositionCache.has(cacheKey)) {
      this.logger.debug('Using cached composition result');
      const cached = this.compositionCache.get(cacheKey)!;
      
      if (cached.errors && cached.errors.length > 0) {
        throw new Error(`Composition errors: ${cached.errors.map(e => e.message).join(', ')}`);
      }
      
      return cached.supergraphSdl;
    }

    try {
      this.logger.info('Composing supergraph from service schemas');
      
      // Fetch all service schemas
      const schemas: ServiceSchema[] = [];
      for (const service of serviceList) {
        if (this.serviceSchemas.has(service.name)) {
          schemas.push(this.serviceSchemas.get(service.name)!);
        } else {
          const schema = await this.fetchServiceSchema(service.url);
          schemas.push({
            name: service.name,
            url: service.url,
            schema,
            version: '1.0.0'
          });
        }
      }

      // Validate schemas
      const validationResult = await this.validateSchemas(schemas);
      if (!validationResult.valid) {
        const compositionResult: CompositionResult = {
          supergraphSdl: '',
          errors: validationResult.errors.map(error => ({
            message: error,
            service: 'composition'
          }))
        };
        
        this.compositionCache.set(cacheKey, compositionResult);
        throw new Error(`Schema validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Compose schemas
      const compositionResult = await this.performComposition(schemas);
      
      // Cache result
      this.compositionCache.set(cacheKey, compositionResult);
      
      if (compositionResult.errors && compositionResult.errors.length > 0) {
        this.logger.error('Schema composition errors:', compositionResult.errors);
        throw new Error(`Composition failed: ${compositionResult.errors.map(e => e.message).join(', ')}`);
      }

      if (compositionResult.warnings && compositionResult.warnings.length > 0) {
        this.logger.warn('Schema composition warnings:', compositionResult.warnings);
      }

      this.logger.info('Successfully composed supergraph');
      return compositionResult.supergraphSdl;
    } catch (error) {
      this.logger.error('Schema composition failed:', error);
      throw error;
    }
  }

  private async validateSchemas(schemas: ServiceSchema[]): Promise<SchemaValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for type conflicts
    const typeMap = new Map<string, string[]>();
    
    for (const service of schemas) {
      const schemaTypes = service.schema.getTypeMap();
      
      for (const [typeName, type] of Object.entries(schemaTypes)) {
        if (typeName.startsWith('__')) continue; // Skip introspection types
        
        if (!typeMap.has(typeName)) {
          typeMap.set(typeName, []);
        }
        typeMap.get(typeName)!.push(service.name);
      }
    }

    // Check for type conflicts
    for (const [typeName, services] of typeMap) {
      if (services.length > 1) {
        // Check if types are compatible
        const typeDefinitions = services.map(serviceName => {
          const service = schemas.find(s => s.name === serviceName)!;
          const type = service.schema.getType(typeName);
          return printSchema(buildSchema(`type ${typeName} ${type?.toString()}`));
        });

        // Simple check - in a real implementation, you'd do more sophisticated comparison
        const uniqueDefinitions = new Set(typeDefinitions);
        if (uniqueDefinitions.size > 1) {
          errors.push(`Type ${typeName} is defined differently in services: ${services.join(', ')}`);
        }
      }
    }

    // Check for federation directives
    for (const service of schemas) {
      const schemaTypes = service.schema.getTypeMap();
      
      for (const [typeName, type] of Object.entries(schemaTypes)) {
        if (typeName.startsWith('__')) continue;
        
        // Check for @key directives
        if (type.astNode?.directives?.some(d => d.name.value === 'key')) {
          // Validate key directive structure
          const keyDirectives = type.astNode.directives.filter(d => d.name.value === 'key');
          for (const directive of keyDirectives) {
            const fieldsArg = directive.arguments?.find(arg => arg.name.value === 'fields');
            if (!fieldsArg) {
              errors.push(`@key directive on ${typeName} in ${service.name} missing fields argument`);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private async performComposition(schemas: ServiceSchema[]): Promise<CompositionResult> {
    const errors: Array<{ message: string; service: string; path?: string }> = [];
    const warnings: Array<{ message: string; service: string }> = [];

    try {
      // This is a simplified composition process
      // In a real implementation, you'd use @apollo/federation or similar
      
      let supergraphSDL = `
        # Federation v2 specification
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable", "@inaccessible", "@override", "@external", "@provides", "@requires", "@tag"]) {
          query: Query
          mutation: Mutation
        }
        
        type Query {
          _empty: String
        }
        
        type Mutation {
          _empty: String
        }
      `;

      // Merge all types
      const typeMap = new Map<string, Set<string>>();
      const serviceMap = new Map<string, string>();

      for (const service of schemas) {
        const schemaSDL = printSchema(service.schema);
        
        // Extract type definitions
        const typeRegex = /type\s+(\w+)\s*{[^}]+}/g;
        let match;
        
        while ((match = typeRegex.exec(schemaSDL)) !== null) {
          const typeName = match[1];
          if (!typeMap.has(typeName)) {
            typeMap.set(typeName, new Set());
          }
          typeMap.get(typeName)!.add(match[0]);
          serviceMap.set(typeName, service.name);
        }
      }

      // Add types to supergraph
      for (const [typeName, definitions] of typeMap) {
        if (definitions.size === 1) {
          supergraphSDL += '\n\n' + Array.from(definitions)[0];
        } else {
          // Handle type conflicts - this is simplified
          warnings.push({
            message: `Type ${typeName} has multiple definitions, using first occurrence`,
            service: serviceMap.get(typeName) || 'unknown'
          });
          supergraphSDL += '\n\n' + Array.from(definitions)[0];
        }
      }

      return {
        supergraphSdl: supergraphSDL,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      this.logger.error('Composition process failed:', error);
      return {
        supergraphSdl: '',
        errors: [{
          message: `Composition failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          service: 'composition'
        }]
      };
    }
  }

  async validateSupergraph(supergraphSdl: string): Promise<SchemaValidationResult> {
    try {
      const schema = buildSchema(supergraphSdl);
      
      // Basic validation
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check for required federation types
      const queryType = schema.getQueryType();
      if (!queryType) {
        errors.push('Schema must have a Query type');
      }

      // Check for federation directives
      const typeMap = schema.getTypeMap();
      let hasKeyDirective = false;
      
      for (const [typeName, type] of Object.entries(typeMap)) {
        if (typeName.startsWith('__')) continue;
        
        if (type.astNode?.directives?.some(d => d.name.value === 'key')) {
          hasKeyDirective = true;
          break;
        }
      }

      if (!hasKeyDirective) {
        warnings.push('No @key directives found - entities may not be properly federated');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid GraphQL schema: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  getServiceSchemas(): Map<string, ServiceSchema> {
    return new Map(this.serviceSchemas);
  }

  getCompositionCacheSize(): number {
    return this.compositionCache.size;
  }

  clearCompositionCache(): void {
    this.compositionCache.clear();
  }

  async getServiceSchema(serviceName: string): Promise<GraphQLSchema | null> {
    const serviceSchema = this.serviceSchemas.get(serviceName);
    return serviceSchema?.schema || null;
  }

  async updateServiceSchema(serviceName: string, url: string, version: string): Promise<void> {
    this.logger.info(`Updating schema for service: ${serviceName}`);
    
    const schema = await this.fetchServiceSchema(url);
    
    const serviceSchema: ServiceSchema = {
      name: serviceName,
      url,
      schema,
      version
    };

    this.serviceSchemas.set(serviceName, serviceSchema);
    this.compositionCache.clear();
    
    this.logger.info(`Successfully updated schema for service: ${serviceName}`);
  }
}
