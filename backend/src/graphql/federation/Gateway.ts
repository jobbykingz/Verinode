import { ApolloServer } from '@apollo/server';
import { ApolloGateway } from '@apollo/gateway';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FederationConfig } from './FederationConfig';
import { SchemaComposer } from './SchemaComposer';
import { EntityResolver } from './EntityResolver';
import { WinstonLogger } from '../../utils/logger';

interface GatewayContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  requestId: string;
  startTime: number;
  services: Map<string, any>;
}

interface ServiceDefinition {
  name: string;
  url: string;
  version: string;
  healthCheck?: string;
  timeout?: number;
  retryAttempts?: number;
}

interface GatewayMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  serviceHealth: Map<string, boolean>;
}

export class GraphQLGateway {
  private apolloServer: ApolloServer;
  private gateway: ApolloGateway;
  private config: FederationConfig;
  private schemaComposer: SchemaComposer;
  private entityResolver: EntityResolver;
  private logger: WinstonLogger;
  private metrics: GatewayMetrics;
  private services: Map<string, ServiceDefinition> = new Map();

  constructor(config: FederationConfig) {
    this.config = config;
    this.logger = new WinstonLogger();
    this.schemaComposer = new SchemaComposer();
    this.entityResolver = new EntityResolver(config);
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      serviceHealth: new Map()
    };
    
    this.initializeServices();
    this.createGateway();
  }

  private initializeServices(): void {
    const serviceDefinitions = this.config.getServiceDefinitions();
    
    for (const serviceDef of serviceDefinitions) {
      this.services.set(serviceDef.name, serviceDef);
      this.metrics.serviceHealth.set(serviceDef.name, true);
    }
  }

  private createGateway(): void {
    const serviceList = Array.from(this.services.values()).map(service => ({
      name: service.name,
      url: service.url
    }));

    this.gateway = new ApolloGateway({
      supergraphSdl: new Promise(async (resolve) => {
        try {
          const supergraph = await this.schemaComposer.composeSupergraph(serviceList);
          resolve(supergraph);
        } catch (error) {
          this.logger.error('Failed to compose supergraph:', error);
          throw error;
        }
      }),
      buildService: ({ name, url }) => {
        const service = this.services.get(name);
        if (!service) {
          throw new Error(`Service ${name} not found in configuration`);
        }

        return {
          name,
          url,
          healthCheck: service.healthCheck || `${url}/health`,
          timeout: service.timeout || 30000,
          retryAttempts: service.retryAttempts || 3
        };
      },
      // Custom error handling
      onServiceRequest: ({ request, serviceName }) => {
        this.logger.debug(`Forwarding request to service: ${serviceName}`, {
          query: request.query,
          variables: request.variables
        });
      },
      onServiceResponse: ({ response, serviceName, request }) => {
        this.logger.debug(`Received response from service: ${serviceName}`, {
          status: response.status,
          duration: Date.now() - request.startTime
        });
      }
    });

    this.apolloServer = new ApolloServer({
      gateway: this.gateway,
      plugins: [
        {
          requestDidStart: async () => ({
            didResolveOperation: async (requestContext) => {
              this.metrics.totalRequests++;
              requestContext.context.startTime = Date.now();
              
              this.logger.info('GraphQL operation resolved', {
                operation: requestContext.request.operationName,
                variables: requestContext.request.variables
              });
            },
            didEncounterErrors: async (requestContext) => {
              this.metrics.failedRequests++;
              
              this.logger.error('GraphQL operation encountered errors', {
                errors: requestContext.errors,
                operation: requestContext.request.operationName
              });
            },
            willSendResponse: async (requestContext) => {
              const duration = Date.now() - requestContext.context.startTime;
              this.updateAverageResponseTime(duration);
              
              if (!requestContext.errors) {
                this.metrics.successfulRequests++;
              }
              
              this.logger.info('GraphQL operation completed', {
                operation: requestContext.request.operationName,
                duration,
                success: !requestContext.errors
              });
            }
          })
        }
      ],
      introspection: this.config.getIntrospectionEnabled(),
      context: async ({ req }): Promise<GatewayContext> => {
        const user = await this.authenticateUser(req);
        const services = new Map();
        
        // Initialize service connections
        for (const [name, service] of this.services) {
          try {
            const serviceClient = await this.createServiceClient(service);
            services.set(name, serviceClient);
          } catch (error) {
            this.logger.error(`Failed to create client for service ${name}:`, error);
            this.metrics.serviceHealth.set(name, false);
          }
        }

        return {
          user,
          requestId: this.generateRequestId(),
          startTime: Date.now(),
          services
        };
      }
    });
  }

  private async authenticateUser(req: any): Promise<any> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return null;
      }

      // Verify JWT token with auth service
      const authService = this.services.get('auth');
      if (!authService) {
        return null;
      }

      const response = await fetch(`${authService.url}/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        return userData;
      }

      return null;
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      return null;
    }
  }

  private async createServiceClient(service: ServiceDefinition): Promise<any> {
    // Create a service client based on the service configuration
    // This could be a GraphQL client, REST client, etc.
    return {
      name: service.name,
      url: service.url,
      request: async (query: string, variables?: any) => {
        const response = await fetch(service.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
          throw new Error(`Service ${service.name} request failed: ${response.statusText}`);
        }

        return response.json();
      }
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateAverageResponseTime(duration: number): void {
    const totalResponseTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + duration;
    this.metrics.averageResponseTime = totalResponseTime / this.metrics.totalRequests;
  }

  async start(port: number = 4000): Promise<void> {
    try {
      const { url } = await this.apolloServer.listen({ port });
      this.logger.info(`GraphQL Gateway ready at ${url}`);
      
      // Start health checks
      this.startHealthChecks();
      
      // Start periodic metrics collection
      this.startMetricsCollection();
    } catch (error) {
      this.logger.error('Failed to start GraphQL Gateway:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.apolloServer.stop();
      this.logger.info('GraphQL Gateway stopped');
    } catch (error) {
      this.logger.error('Failed to stop GraphQL Gateway:', error);
      throw error;
    }
  }

  private startHealthChecks(): void {
    setInterval(async () => {
      for (const [name, service] of this.services) {
        try {
          const healthUrl = service.healthCheck || `${service.url}/health`;
          const response = await fetch(healthUrl, {
            method: 'GET',
            timeout: 5000
          });
          
          const isHealthy = response.ok;
          this.metrics.serviceHealth.set(name, isHealthy);
          
          if (!isHealthy) {
            this.logger.warn(`Service ${name} health check failed`, {
              status: response.status,
              statusText: response.statusText
            });
          }
        } catch (error) {
          this.metrics.serviceHealth.set(name, false);
          this.logger.error(`Service ${name} health check error:`, error);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.logger.info('Gateway metrics', {
        ...this.metrics,
        serviceHealth: Object.fromEntries(this.metrics.serviceHealth)
      });
    }, 60000); // Log every minute
  }

  getMetrics(): GatewayMetrics {
    return {
      ...this.metrics,
      serviceHealth: new Map(this.metrics.serviceHealth)
    };
  }

  async reloadConfiguration(): Promise<void> {
    this.logger.info('Reloading gateway configuration...');
    
    try {
      // Reinitialize services
      this.initializeServices();
      
      // Recreate gateway with new configuration
      this.createGateway();
      
      this.logger.info('Gateway configuration reloaded successfully');
    } catch (error) {
      this.logger.error('Failed to reload gateway configuration:', error);
      throw error;
    }
  }

  async addService(service: ServiceDefinition): Promise<void> {
    this.logger.info(`Adding service: ${service.name}`);
    
    this.services.set(service.name, service);
    this.metrics.serviceHealth.set(service.name, true);
    
    // Recreate gateway to include new service
    await this.reloadConfiguration();
  }

  async removeService(serviceName: string): Promise<void> {
    this.logger.info(`Removing service: ${serviceName}`);
    
    this.services.delete(serviceName);
    this.metrics.serviceHealth.delete(serviceName);
    
    // Recreate gateway to exclude removed service
    await this.reloadConfiguration();
  }

  getServiceHealth(serviceName?: string): boolean | Map<string, boolean> {
    if (serviceName) {
      return this.metrics.serviceHealth.get(serviceName) || false;
    }
    return new Map(this.metrics.serviceHealth);
  }
}
