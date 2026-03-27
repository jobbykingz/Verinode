import { GraphQLResolveInfo, GraphQLFieldResolver } from 'graphql';
import { WinstonLogger } from '../../utils/logger';
import { FederationConfig } from './FederationConfig';

interface EntityRepresentation {
  __typename: string;
  [key: string]: any;
}

interface ResolverContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  requestId: string;
  services: Map<string, any>;
}

interface EntityResolutionResult {
  data: any;
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

interface ServiceEntity {
  serviceName: string;
  typename: string;
  resolver: GraphQLFieldResolver<any, ResolverContext>;
}

export class EntityResolver {
  private logger: WinstonLogger;
  private config: FederationConfig;
  private entityResolvers: Map<string, Map<string, GraphQLFieldResolver<any, ResolverContext>>> = new Map();
  private serviceEntities: Map<string, ServiceEntity[]> = new Map();

  constructor(config: FederationConfig) {
    this.logger = new WinstonLogger();
    this.config = config;
    this.initializeEntityResolvers();
  }

  private initializeEntityResolvers(): void {
    // Initialize entity resolvers for each service
    const serviceDefinitions = this.config.getServiceDefinitions();
    
    for (const service of serviceDefinitions) {
      this.registerServiceEntities(service.name, service.url);
    }
  }

  private async registerServiceEntities(serviceName: string, serviceUrl: string): Promise<void> {
    try {
      this.logger.info(`Registering entities for service: ${serviceName}`);
      
      // Fetch entity definitions from service
      const entities = await this.fetchServiceEntities(serviceName, serviceUrl);
      
      this.serviceEntities.set(serviceName, entities);
      
      // Register resolvers for each entity
      for (const entity of entities) {
        if (!this.entityResolvers.has(entity.typename)) {
          this.entityResolvers.set(entity.typename, new Map());
        }
        
        this.entityResolvers.get(entity.typename)!.set(serviceName, entity.resolver);
      }
      
      this.logger.info(`Successfully registered ${entities.length} entities for service: ${serviceName}`);
    } catch (error) {
      this.logger.error(`Failed to register entities for service ${serviceName}:`, error);
      throw error;
    }
  }

  private async fetchServiceEntities(serviceName: string, serviceUrl: string): Promise<ServiceEntity[]> {
    const entities: ServiceEntity[] = [];

    try {
      // Fetch service schema to identify entities
      const introspectionQuery = `
        query GetEntities {
          __schema {
            types {
              kind
              name
              fields {
                name
                type {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
              directives {
                name
                args {
                  name
                  value
                }
              }
            }
          }
        }
      `;

      const response = await fetch(serviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: introspectionQuery
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch entities from ${serviceName}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`Entity introspection errors: ${JSON.stringify(result.errors)}`);
      }

      const schema = result.data.__schema;
      
      // Find entities (types with @key directive)
      for (const type of schema.types) {
        if (type.kind === 'OBJECT' && !type.name.startsWith('__')) {
          const hasKeyDirective = type.directives?.some((d: any) => d.name === 'key');
          
          if (hasKeyDirective) {
            // Create entity resolver
            const resolver = this.createEntityResolver(serviceName, type.name);
            
            entities.push({
              serviceName,
              typename: type.name,
              resolver
            });
          }
        }
      }

      return entities;
    } catch (error) {
      this.logger.error(`Failed to fetch entities from service ${serviceName}:`, error);
      throw error;
    }
  }

  private createEntityResolver(serviceName: string, typename: string): GraphQLFieldResolver<any, ResolverContext> {
    return async (parent: any, args: any, context: ResolverContext, info: GraphQLResolveInfo) => {
      const startTime = Date.now();
      
      try {
        this.logger.debug(`Resolving entity ${typename} in service ${serviceName}`, {
          representations: args.representations,
          user: context.user?.id
        });

        const serviceClient = context.services.get(serviceName);
        if (!serviceClient) {
          throw new Error(`Service client not found for ${serviceName}`);
        }

        // Build the _entities query
        const query = this.buildEntitiesQuery(typename, args.representations);
        
        const result = await serviceClient.request(query, {
          representations: args.representations
        });

        const duration = Date.now() - startTime;
        this.logger.debug(`Entity resolution completed`, {
          typename,
          serviceName,
          duration,
          resultCount: result.data?._entities?.length || 0
        });

        return result.data?._entities || [];
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error(`Entity resolution failed for ${typename} in ${serviceName}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration
        });
        
        throw error;
      }
    };
  }

  private buildEntitiesQuery(typename: string, representations: EntityRepresentation[]): string {
    // Build a query that requests the specific fields needed for each representation
    const fields = this.extractFieldsFromRepresentations(representations, typename);
    
    return `
      query GetEntities($representations: [_Any!]!) {
        _entities(representations: $representations) {
          ... on ${typename} {
            ${fields}
          }
        }
      }
    `;
  }

  private extractFieldsFromRepresentations(representations: EntityRepresentation[], typename: string): string {
    // Extract field names from the representations
    const fieldNames = new Set<string>();
    
    for (const representation of representations) {
      if (representation.__typename === typename) {
        Object.keys(representation).forEach(key => {
          if (key !== '__typename') {
            fieldNames.add(key);
          }
        });
      }
    }

    // Add commonly requested fields
    fieldNames.add('id');
    fieldNames.add('createdAt');
    fieldNames.add('updatedAt');

    return Array.from(fieldNames).join('\n');
  }

  async resolveEntities(
    typename: string,
    representations: EntityRepresentation[],
    context: ResolverContext
  ): Promise<EntityResolutionResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; service: string; path?: string }> = [];
    const warnings: Array<{ message: string; service: string }> = [];
    const results: any[] = [];

    try {
      this.logger.info(`Resolving entities for type ${typename}`, {
        representationCount: representations.length,
        requestId: context.requestId
      });

      // Group representations by service
      const serviceGroups = this.groupRepresentationsByService(typename, representations);
      
      // Resolve entities for each service in parallel
      const servicePromises = Array.from(serviceGroups.entries()).map(
        async ([serviceName, reps]) => {
          try {
            const resolver = this.getEntityResolver(typename, serviceName);
            if (!resolver) {
              throw new Error(`No resolver found for ${typename} in service ${serviceName}`);
            }

            const serviceResults = await resolver(
              {},
              { representations: reps },
              context,
              {} as GraphQLResolveInfo
            );

            return {
              serviceName,
              results: serviceResults || []
            };
          } catch (error) {
            errors.push({
              message: error instanceof Error ? error.message : 'Unknown error',
              service: serviceName,
              path: typename
            });
            
            return {
              serviceName,
              results: []
            };
          }
        }
      );

      const serviceResults = await Promise.all(servicePromises);
      
      // Combine results
      for (const { serviceName, results: serviceResult } of serviceResults) {
        results.push(...serviceResult);
      }

      const duration = Date.now() - startTime;
      
      this.logger.info(`Entity resolution completed`, {
        typename,
        representationCount: representations.length,
        resultCount: results.length,
        errorCount: errors.length,
        duration
      });

      return {
        data: results,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Entity resolution failed for ${typename}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      });

      return {
        data: [],
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown error',
          service: 'entity-resolver',
          path: typename
        }]
      };
    }
  }

  private groupRepresentationsByService(
    typename: string,
    representations: EntityRepresentation[]
  ): Map<string, EntityRepresentation[]> {
    const groups = new Map<string, EntityRepresentation[]>();

    for (const representation of representations) {
      if (representation.__typename === typename) {
        // Determine which service should handle this entity
        const serviceName = this.determineServiceForEntity(typename, representation);
        
        if (!groups.has(serviceName)) {
          groups.set(serviceName, []);
        }
        
        groups.get(serviceName)!.push(representation);
      }
    }

    return groups;
  }

  private determineServiceForEntity(typename: string, representation: EntityRepresentation): string {
    // Simple heuristic: use the first service that has this entity type
    // In a real implementation, you might have more sophisticated routing logic
    const typenameResolvers = this.entityResolvers.get(typename);
    
    if (typenameResolvers && typenameResolvers.size > 0) {
      return Array.from(typenameResolvers.keys())[0];
    }

    throw new Error(`No service found for entity type ${typename}`);
  }

  private getEntityResolver(typename: string, serviceName: string): GraphQLFieldResolver<any, ResolverContext> | null {
    const typenameResolvers = this.entityResolvers.get(typename);
    return typenameResolvers?.get(serviceName) || null;
  }

  async addServiceEntity(serviceName: string, typename: string, resolver: GraphQLFieldResolver<any, ResolverContext>): Promise<void> {
    this.logger.info(`Adding entity resolver for ${typename} in service ${serviceName}`);
    
    if (!this.entityResolvers.has(typename)) {
      this.entityResolvers.set(typename, new Map());
    }
    
    this.entityResolvers.get(typename)!.set(serviceName, resolver);
    
    // Update service entities
    const entities = this.serviceEntities.get(serviceName) || [];
    entities.push({
      serviceName,
      typename,
      resolver
    });
    this.serviceEntities.set(serviceName, entities);
  }

  async removeServiceEntity(serviceName: string, typename: string): Promise<void> {
    this.logger.info(`Removing entity resolver for ${typename} in service ${serviceName}`);
    
    const typenameResolvers = this.entityResolvers.get(typename);
    if (typenameResolvers) {
      typenameResolvers.delete(serviceName);
    }
    
    // Update service entities
    const entities = this.serviceEntities.get(serviceName) || [];
    const filteredEntities = entities.filter(e => e.typename !== typename);
    this.serviceEntities.set(serviceName, filteredEntities);
  }

  getEntityTypes(): string[] {
    return Array.from(this.entityResolvers.keys());
  }

  getServicesForEntityType(typename: string): string[] {
    const typenameResolvers = this.entityResolvers.get(typename);
    return typenameResolvers ? Array.from(typenameResolvers.keys()) : [];
  }

  getEntityResolverCount(): number {
    let count = 0;
    for (const typenameResolvers of this.entityResolvers.values()) {
      count += typenameResolvers.size;
    }
    return count;
  }

  async validateEntityResolution(typename: string, representations: EntityRepresentation[]): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if we have resolvers for this entity type
      const typenameResolvers = this.entityResolvers.get(typename);
      if (!typenameResolvers || typenameResolvers.size === 0) {
        errors.push(`No resolvers found for entity type ${typename}`);
        return { valid: false, errors, warnings };
      }

      // Check each representation
      for (const representation of representations) {
        if (representation.__typename !== typename) {
          errors.push(`Representation typename mismatch: expected ${typename}, got ${representation.__typename}`);
        }

        // Check if representation has required fields
        if (!representation.id) {
          warnings.push(`Representation missing id field for ${typename}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors, warnings };
    }
  }
}
