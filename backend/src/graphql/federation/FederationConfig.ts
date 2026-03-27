import { WinstonLogger } from '../../utils/logger';

interface ServiceDefinition {
  name: string;
  url: string;
  version: string;
  healthCheck?: string;
  timeout?: number;
  retryAttempts?: number;
  headers?: Record<string, string>;
  enabled?: boolean;
}

interface FederationConfigOptions {
  services: ServiceDefinition[];
  introspectionEnabled?: boolean;
  debugMode?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  maxRequestSize?: number;
  timeout?: number;
  enableMetrics?: boolean;
  enableTracing?: boolean;
}

interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  retries: number;
}

interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'lfu';
}

export class FederationConfig {
  private logger: WinstonLogger;
  private services: Map<string, ServiceDefinition> = new Map();
  private options: FederationConfigOptions;
  private healthCheckConfig: HealthCheckConfig;
  private cacheConfig: CacheConfig;

  constructor(options: FederationConfigOptions) {
    this.logger = new WinstonLogger();
    this.options = {
      introspectionEnabled: true,
      debugMode: false,
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      maxRequestSize: 10485760, // 10MB
      timeout: 30000, // 30 seconds
      enableMetrics: true,
      enableTracing: false,
      ...options
    };

    this.healthCheckConfig = {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      retries: 3
    };

    this.cacheConfig = {
      enabled: this.options.cacheEnabled || true,
      ttl: this.options.cacheTTL || 300000,
      maxSize: 1000,
      strategy: 'lru'
    };

    this.initializeServices();
  }

  private initializeServices(): void {
    for (const service of this.options.services) {
      this.addService(service);
    }
  }

  addService(service: ServiceDefinition): void {
    const normalizedService: ServiceDefinition = {
      timeout: 30000,
      retryAttempts: 3,
      enabled: true,
      ...service
    };

    this.services.set(service.name, normalizedService);
    this.logger.info(`Added service: ${service.name} (${service.url})`);
  }

  removeService(serviceName: string): void {
    if (this.services.delete(serviceName)) {
      this.logger.info(`Removed service: ${serviceName}`);
    } else {
      this.logger.warn(`Service not found for removal: ${serviceName}`);
    }
  }

  updateService(serviceName: string, updates: Partial<ServiceDefinition>): void {
    const existingService = this.services.get(serviceName);
    if (existingService) {
      const updatedService = { ...existingService, ...updates };
      this.services.set(serviceName, updatedService);
      this.logger.info(`Updated service: ${serviceName}`);
    } else {
      this.logger.warn(`Service not found for update: ${serviceName}`);
    }
  }

  getService(serviceName: string): ServiceDefinition | undefined {
    return this.services.get(serviceName);
  }

  getServiceDefinitions(): ServiceDefinition[] {
    return Array.from(this.services.values()).filter(service => service.enabled !== false);
  }

  getEnabledServices(): ServiceDefinition[] {
    return this.getServiceDefinitions().filter(service => service.enabled !== false);
  }

  // Configuration getters
  getIntrospectionEnabled(): boolean {
    return this.options.introspectionEnabled || false;
  }

  setIntrospectionEnabled(enabled: boolean): void {
    this.options.introspectionEnabled = enabled;
    this.logger.info(`Introspection ${enabled ? 'enabled' : 'disabled'}`);
  }

  getDebugMode(): boolean {
    return this.options.debugMode || false;
  }

  setDebugMode(enabled: boolean): void {
    this.options.debugMode = enabled;
    this.logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  getCacheEnabled(): boolean {
    return this.options.cacheEnabled || false;
  }

  setCacheEnabled(enabled: boolean): void {
    this.options.cacheEnabled = enabled;
    this.cacheConfig.enabled = enabled;
    this.logger.info(`Cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  getCacheTTL(): number {
    return this.options.cacheTTL || 300000;
  }

  setCacheTTL(ttl: number): void {
    this.options.cacheTTL = ttl;
    this.cacheConfig.ttl = ttl;
    this.logger.info(`Cache TTL set to ${ttl}ms`);
  }

  getMaxRequestSize(): number {
    return this.options.maxRequestSize || 10485760;
  }

  setMaxRequestSize(size: number): void {
    this.options.maxRequestSize = size;
    this.logger.info(`Max request size set to ${size} bytes`);
  }

  getTimeout(): number {
    return this.options.timeout || 30000;
  }

  setTimeout(timeout: number): void {
    this.options.timeout = timeout;
    this.logger.info(`Timeout set to ${timeout}ms`);
  }

  getMetricsEnabled(): boolean {
    return this.options.enableMetrics || false;
  }

  setMetricsEnabled(enabled: boolean): void {
    this.options.enableMetrics = enabled;
    this.logger.info(`Metrics ${enabled ? 'enabled' : 'disabled'}`);
  }

  getTracingEnabled(): boolean {
    return this.options.enableTracing || false;
  }

  setTracingEnabled(enabled: boolean): void {
    this.options.enableTracing = enabled;
    this.logger.info(`Tracing ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Health check configuration
  getHealthCheckConfig(): HealthCheckConfig {
    return { ...this.healthCheckConfig };
  }

  setHealthCheckConfig(config: Partial<HealthCheckConfig>): void {
    this.healthCheckConfig = { ...this.healthCheckConfig, ...config };
    this.logger.info('Health check configuration updated');
  }

  // Cache configuration
  getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }

  setCacheConfig(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
    this.logger.info('Cache configuration updated');
  }

  // Validation methods
  validateService(service: ServiceDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!service.name || service.name.trim() === '') {
      errors.push('Service name is required');
    }

    if (!service.url || service.url.trim() === '') {
      errors.push('Service URL is required');
    } else {
      // Basic URL validation - just check if it starts with http/https
      if (!service.url.startsWith('http://') && !service.url.startsWith('https://')) {
        errors.push('Service URL must start with http:// or https://');
      }
    }

    if (service.timeout && (service.timeout < 1000 || service.timeout > 300000)) {
      errors.push('Service timeout must be between 1000ms and 300000ms');
    }

    if (service.retryAttempts && (service.retryAttempts < 0 || service.retryAttempts > 10)) {
      errors.push('Service retry attempts must be between 0 and 10');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateConfiguration(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate services
    for (const service of this.services.values()) {
      const validation = this.validateService(service);
      if (!validation.valid) {
        errors.push(`Service ${service.name}: ${validation.errors.join(', ')}`);
      }
    }

    // Check for duplicate service names
    const serviceNames = Array.from(this.services.keys());
    const duplicateNames = serviceNames.filter((name, index) => serviceNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      errors.push(`Duplicate service names: ${duplicateNames.join(', ')}`);
    }

    // Validate global configuration
    if (this.options.maxRequestSize && this.options.maxRequestSize > 104857600) {
      warnings.push('Max request size is very large (>100MB), consider reducing it');
    }

    if (this.options.timeout && this.options.timeout > 120000) {
      warnings.push('Timeout is very long (>2 minutes), consider reducing it');
    }

    if (this.services.size === 0) {
      warnings.push('No services configured');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Serialization methods
  toJSON(): object {
    return {
      services: Array.from(this.services.values()),
      options: this.options,
      healthCheckConfig: this.healthCheckConfig,
      cacheConfig: this.cacheConfig
    };
  }

  static fromJSON(json: any): FederationConfig {
    const options: FederationConfigOptions = {
      services: json.services || [],
      ...json.options
    };

    const config = new FederationConfig(options);
    
    if (json.healthCheckConfig) {
      config.setHealthCheckConfig(json.healthCheckConfig);
    }
    
    if (json.cacheConfig) {
      config.setCacheConfig(json.cacheConfig);
    }

    return config;
  }

  // Environment-based configuration
  static fromEnvironment(): FederationConfig {
    const services: ServiceDefinition[] = [];
    
    // Parse services from environment variables
    // Format: FEDERATION_SERVICE_NAME=name,url,version,healthCheck
    // For now, return empty services array - can be configured via code
    
    return new FederationConfig({
      services,
      introspectionEnabled: true,
      debugMode: false,
      cacheEnabled: true,
      cacheTTL: 300000,
      maxRequestSize: 10485760,
      timeout: 30000,
      enableMetrics: true,
      enableTracing: false
    });
  }

  // Service discovery integration
  async loadFromServiceRegistry(registryUrl: string): Promise<void> {
    try {
      this.logger.info(`Loading services from registry: ${registryUrl}`);
      
      const response = await (globalThis as any).fetch(`${registryUrl}/services`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load services from registry: ${response.statusText}`);
      }

      const registryServices = await response.json();
      
      // Clear existing services
      this.services.clear();
      
      // Add services from registry
      for (const service of registryServices) {
        if (service.graphqlEndpoint) {
          this.addService({
            name: service.name,
            url: service.graphqlEndpoint,
            version: service.version || '1.0.0',
            healthCheck: service.healthCheck,
            timeout: service.timeout,
            retryAttempts: service.retryAttempts
          });
        }
      }

      this.logger.info(`Loaded ${this.services.size} services from registry`);
    } catch (error) {
      this.logger.error('Failed to load services from registry:', error);
      throw error;
    }
  }

  // Configuration hot-reload
  async reloadFromConfig(configPath: string): Promise<void> {
    try {
      this.logger.info(`Reloading configuration from: ${configPath}`);
      
      // In a real implementation, you'd read from file system
      // For now, we'll simulate a reload
      const validation = this.validateConfiguration();
      
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        this.logger.warn('Configuration warnings:', validation.warnings);
      }

      this.logger.info('Configuration reloaded successfully');
    } catch (error) {
      this.logger.error('Failed to reload configuration:', error);
      throw error;
    }
  }

  getServiceCount(): number {
    return this.services.size;
  }

  getEnabledServiceCount(): number {
    return this.getEnabledServices().length;
  }

  hasService(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  isServiceEnabled(serviceName: string): boolean {
    const service = this.services.get(serviceName);
    return service?.enabled !== false;
  }
}
