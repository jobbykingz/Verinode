import { GraphQLGateway } from '../../graphql/federation/Gateway';
import { FederationConfig } from '../../graphql/federation/FederationConfig';
import { WinstonLogger } from '../../utils/logger';

interface FederationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  serviceHealth: Map<string, boolean>;
  uptime: number;
  lastRestart: Date;
}

interface ServiceStatus {
  name: string;
  healthy: boolean;
  lastCheck: Date;
  responseTime?: number;
  errorCount: number;
  lastError?: string;
}

export class FederationService {
  private gateway: GraphQLGateway;
  private config: FederationConfig;
  private logger: WinstonLogger;
  private metrics: FederationMetrics;
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private startTime: Date;

  constructor(config: FederationConfig) {
    this.config = config;
    this.logger = new WinstonLogger();
    this.startTime = new Date();
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      serviceHealth: new Map(),
      uptime: 0,
      lastRestart: this.startTime
    };

    this.gateway = new GraphQLGateway(config);
    this.initializeServiceStatuses();
  }

  private initializeServiceStatuses(): void {
    const services = this.config.getServiceDefinitions();
    
    for (const service of services) {
      this.serviceStatuses.set(service.name, {
        name: service.name,
        healthy: true,
        lastCheck: new Date(),
        errorCount: 0
      });
      
      this.metrics.serviceHealth.set(service.name, true);
    }
  }

  async start(port: number = 4000): Promise<void> {
    try {
      this.logger.info(`Starting Federation Service on port ${port}`);
      
      await this.gateway.start(port);
      
      this.logger.info(`Federation Service started successfully on port ${port}`);
      
      // Start background tasks
      this.startHealthMonitoring();
      this.startMetricsCollection();
      
    } catch (error) {
      this.logger.error('Failed to start Federation Service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Federation Service...');
      
      await this.gateway.stop();
      
      this.logger.info('Federation Service stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop Federation Service:', error);
      throw error;
    }
  }

  private startHealthMonitoring(): void {
    const healthCheckConfig = this.config.getHealthCheckConfig();
    
    if (!healthCheckConfig.enabled) {
      return;
    }

    // Use setTimeout for recurring health checks
    const scheduleHealthCheck = () => {
      setTimeout(async () => {
        await this.performHealthChecks();
        scheduleHealthCheck();
      }, healthCheckConfig.interval);
    };
    scheduleHealthCheck();
  }

  private async performHealthChecks(): Promise<void> {
    const services = this.config.getServiceDefinitions();
    const healthCheckConfig = this.config.getHealthCheckConfig();

    for (const service of services) {
      const status = this.serviceStatuses.get(service.name);
      if (!status) continue;

      try {
        const startTime = Date.now();
        const healthUrl = service.healthCheck || `${service.url}/health`;
        
        const response = await (globalThis as any).fetch(healthUrl, {
          method: 'GET',
          timeout: healthCheckConfig.timeout
        });

        const responseTime = Date.now() - startTime;
        const isHealthy = response.ok;

        // Update service status
        status.healthy = isHealthy;
        status.lastCheck = new Date();
        status.responseTime = responseTime;

        if (isHealthy) {
          status.errorCount = 0;
          status.lastError = undefined;
        } else {
          status.errorCount++;
          status.lastError = `HTTP ${response.status}: ${response.statusText}`;
        }

        this.metrics.serviceHealth.set(service.name, isHealthy);

        if (!isHealthy) {
          this.logger.warn(`Service ${service.name} health check failed`, {
            status: response.status,
            responseTime,
            errorCount: status.errorCount
          });
        }

      } catch (error) {
        status.healthy = false;
        status.lastCheck = new Date();
        status.errorCount++;
        status.lastError = error instanceof Error ? error.message : 'Unknown error';
        
        this.metrics.serviceHealth.set(service.name, false);

        this.logger.error(`Service ${service.name} health check error:`, error);
      }
    }
  }

  private startMetricsCollection(): void {
    if (!this.config.getMetricsEnabled()) {
      return;
    }

    // Use setTimeout for recurring metrics collection
    const scheduleMetricsCollection = () => {
      setTimeout(async () => {
        this.collectMetrics();
        scheduleMetricsCollection();
      }, 60000); // Collect every minute
    };
    scheduleMetricsCollection();
  }

  private collectMetrics(): void {
    const gatewayMetrics = this.gateway.getMetrics();
    
    this.metrics.totalRequests = gatewayMetrics.totalRequests;
    this.metrics.successfulRequests = gatewayMetrics.successfulRequests;
    this.metrics.failedRequests = gatewayMetrics.failedRequests;
    this.metrics.averageResponseTime = gatewayMetrics.averageResponseTime;
    this.metrics.serviceHealth = new Map(gatewayMetrics.serviceHealth);
    this.metrics.uptime = Date.now() - this.startTime.getTime();

    this.logger.debug('Metrics collected', {
      totalRequests: this.metrics.totalRequests,
      successRate: this.getSuccessRate(),
      averageResponseTime: this.metrics.averageResponseTime,
      uptime: this.metrics.uptime
    });
  }

  // Public API methods
  async reloadConfiguration(): Promise<void> {
    this.logger.info('Reloading federation configuration...');
    
    try {
      await this.gateway.reloadConfiguration();
      this.initializeServiceStatuses();
      
      this.logger.info('Federation configuration reloaded successfully');
    } catch (error) {
      this.logger.error('Failed to reload federation configuration:', error);
      throw error;
    }
  }

  async addService(serviceDefinition: any): Promise<void> {
    this.logger.info(`Adding service: ${serviceDefinition.name}`);
    
    try {
      await this.gateway.addService(serviceDefinition);
      
      this.serviceStatuses.set(serviceDefinition.name, {
        name: serviceDefinition.name,
        healthy: true,
        lastCheck: new Date(),
        errorCount: 0
      });

      this.logger.info(`Service ${serviceDefinition.name} added successfully`);
    } catch (error) {
      this.logger.error(`Failed to add service ${serviceDefinition.name}:`, error);
      throw error;
    }
  }

  async removeService(serviceName: string): Promise<void> {
    this.logger.info(`Removing service: ${serviceName}`);
    
    try {
      await this.gateway.removeService(serviceName);
      this.serviceStatuses.delete(serviceName);
      
      this.logger.info(`Service ${serviceName} removed successfully`);
    } catch (error) {
      this.logger.error(`Failed to remove service ${serviceName}:`, error);
      throw error;
    }
  }

  // Status and metrics methods
  getMetrics(): FederationMetrics {
    this.collectMetrics(); // Update metrics before returning
    return { ...this.metrics };
  }

  getServiceStatuses(): Map<string, ServiceStatus> {
    return new Map(this.serviceStatuses);
  }

  getServiceStatus(serviceName: string): ServiceStatus | undefined {
    return this.serviceStatuses.get(serviceName);
  }

  getHealthyServices(): string[] {
    const healthyServices: string[] = [];
    
    for (const [name, status] of this.serviceStatuses) {
      if (status.healthy) {
        healthyServices.push(name);
      }
    }
    
    return healthyServices;
  }

  getUnhealthyServices(): string[] {
    const unhealthyServices: string[] = [];
    
    for (const [name, status] of this.serviceStatuses) {
      if (!status.healthy) {
        unhealthyServices.push(name);
      }
    }
    
    return unhealthyServices;
  }

  getSuccessRate(): number {
    if (this.metrics.totalRequests === 0) {
      return 100;
    }
    
    return (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  isHealthy(): boolean {
    const unhealthyServices = this.getUnhealthyServices();
    return unhealthyServices.length === 0;
  }

  // Performance monitoring
  async getPerformanceReport(): Promise<{
    overall: {
      successRate: number;
      averageResponseTime: number;
      totalRequests: number;
      uptime: number;
    };
    services: Array<{
      name: string;
      healthy: boolean;
      responseTime?: number;
      errorCount: number;
      lastError?: string;
    }>;
    recommendations: string[];
  }> {
    const overall = {
      successRate: this.getSuccessRate(),
      averageResponseTime: this.metrics.averageResponseTime,
      totalRequests: this.metrics.totalRequests,
      uptime: this.getUptime()
    };

    const services = Array.from(this.serviceStatuses.values());

    const recommendations = this.generateRecommendations(overall, services);

    return {
      overall,
      services,
      recommendations
    };
  }

  private generateRecommendations(
    overall: any,
    services: ServiceStatus[]
  ): string[] {
    const recommendations: string[] = [];

    // Success rate recommendations
    if (overall.successRate < 95) {
      recommendations.push('Success rate is below 95%. Check service health and error logs.');
    }

    // Response time recommendations
    if (overall.averageResponseTime > 5000) {
      recommendations.push('Average response time is high (>5s). Consider optimizing queries or adding caching.');
    }

    // Service-specific recommendations
    for (const service of services) {
      if (!service.healthy) {
        recommendations.push(`Service ${service.name} is unhealthy. Check service logs and configuration.`);
      }

      if (service.responseTime && service.responseTime > 10000) {
        recommendations.push(`Service ${service.name} has high response time (>10s). Consider performance optimization.`);
      }

      if (service.errorCount > 10) {
        recommendations.push(`Service ${service.name} has high error count (${service.errorCount}). Investigate recurring issues.`);
      }
    }

    return recommendations;
  }

  // Configuration management
  updateConfiguration(updates: any): void {
    this.logger.info('Updating federation configuration...');
    
    // Update configuration
    if (updates.debugMode !== undefined) {
      this.config.setDebugMode(updates.debugMode);
    }
    
    if (updates.metricsEnabled !== undefined) {
      this.config.setMetricsEnabled(updates.metricsEnabled);
    }
    
    if (updates.tracingEnabled !== undefined) {
      this.config.setTracingEnabled(updates.tracingEnabled);
    }
    
    if (updates.cacheTTL !== undefined) {
      this.config.setCacheTTL(updates.cacheTTL);
    }
    
    if (updates.timeout !== undefined) {
      this.config.setTimeout(updates.timeout);
    }

    this.logger.info('Federation configuration updated');
  }

  getConfiguration(): any {
    return {
      services: this.config.getServiceDefinitions(),
      options: {
        introspectionEnabled: this.config.getIntrospectionEnabled(),
        debugMode: this.config.getDebugMode(),
        cacheEnabled: this.config.getCacheEnabled(),
        metricsEnabled: this.config.getMetricsEnabled(),
        tracingEnabled: this.config.getTracingEnabled()
      },
      healthCheckConfig: this.config.getHealthCheckConfig(),
      cacheConfig: this.config.getCacheConfig()
    };
  }

  // Debug and diagnostics
  async runDiagnostics(): Promise<{
    gateway: boolean;
    services: Array<{ name: string; reachable: boolean; error?: string }>;
    configuration: boolean;
    recommendations: string[];
  }> {
    const diagnostics = {
      gateway: false,
      services: [] as Array<{ name: string; reachable: boolean; error?: string }>,
      configuration: false,
      recommendations: [] as string[]
    };

    // Test gateway
    try {
      const gatewayMetrics = this.gateway.getMetrics();
      diagnostics.gateway = true;
    } catch (error) {
      diagnostics.recommendations.push('Gateway is not responding properly');
    }

    // Test services
    const services = this.config.getServiceDefinitions();
    for (const service of services) {
      try {
        const response = await (globalThis as any).fetch(service.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ __typename }' })
        });
        
        diagnostics.services.push({
          name: service.name,
          reachable: response.ok
        });
      } catch (error) {
        diagnostics.services.push({
          name: service.name,
          reachable: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test configuration
    const configValidation = this.config.validateConfiguration();
    diagnostics.configuration = configValidation.valid;
    
    if (!configValidation.valid) {
      diagnostics.recommendations.push(...configValidation.errors);
    }

    if (configValidation.warnings.length > 0) {
      diagnostics.recommendations.push(...configValidation.warnings);
    }

    return diagnostics;
  }
}
