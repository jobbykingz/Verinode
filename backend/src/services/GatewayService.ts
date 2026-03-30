import { EventEmitter } from 'events';
import { CircuitBreaker, circuitBreaker } from './CircuitBreaker';
import { ServiceRegistry, serviceRegistry, ServiceInfo } from './ServiceRegistry';
import { LoadBalancer, loadBalancer, LoadBalancingStrategy } from './LoadBalancer';

export interface GatewayConfig {
  enableCircuitBreaker: boolean;
  enableServiceDiscovery: boolean;
  enableLoadBalancing: boolean;
  defaultTimeout: number;
  maxRetries: number;
}

export interface RequestTransform {
  type: 'header' | 'body' | 'query' | 'path';
  key: string;
  value?: string;
  operation: 'add' | 'remove' | 'modify';
}

export interface GatewayStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  circuitBreakerTrips: number;
  activeConnections: number;
}

/**
 * GatewayService - Comprehensive API gateway with advanced features
 */
export class GatewayService extends EventEmitter {
  private config: GatewayConfig;
  private circuitBreaker: CircuitBreaker;
  private serviceRegistry: ServiceRegistry;
  private loadBalancer: LoadBalancer;
  private stats: GatewayStats;
  private requestTransforms: Map<string, RequestTransform[]> = new Map();

  constructor(
    circuitBreakerInstance?: CircuitBreaker,
    serviceRegistryInstance?: ServiceRegistry,
    loadBalancerInstance?: LoadBalancer,
    config?: Partial<GatewayConfig>
  ) {
    super();
    
    this.config = {
      enableCircuitBreaker: true,
      enableServiceDiscovery: true,
      enableLoadBalancing: true,
      defaultTimeout: 30000,
      maxRetries: 3,
      ...config,
    };

    this.circuitBreaker = circuitBreakerInstance || circuitBreaker;
    this.serviceRegistry = serviceRegistryInstance || serviceRegistry;
    this.loadBalancer = loadBalancerInstance || loadBalancer;

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      circuitBreakerTrips: 0,
      activeConnections: 0,
    };

    this.setupEventListeners();
  }

  /**
   * Setup event listeners for components
   */
  private setupEventListeners(): void {
    // Circuit breaker events
    this.circuitBreaker.on('stateChange', ({ serviceId, newState }: { serviceId: string; newState: string }) => {
      if (newState === 'OPEN') {
        this.stats.circuitBreakerTrips++;
      }
      this.emit('circuitBreakerEvent', { serviceId, newState });
    });

    // Service registry events
    this.serviceRegistry.on('serviceRegistered', ({ service }: { service: ServiceInfo }) => {
      if (this.config.enableLoadBalancing) {
        this.loadBalancer.addServer(service.name, service);
      }
      this.emit('serviceDiscovered', { service });
    });

    this.serviceRegistry.on('serviceDeregistered', ({ serviceId, serviceName }: { serviceId: string; serviceName: string }) => {
      if (this.config.enableLoadBalancing) {
        this.loadBalancer.removeServer(serviceName, serviceId);
      }
      this.emit('serviceLost', { serviceId, serviceName });
    });
  }

  /**
   * Register a service
   */
  registerService(service: ServiceInfo): void {
    this.serviceRegistry.register(service);
    console.log(`Service registered in gateway: ${service.id}`);
  }

  /**
   * Deregister a service
   */
  deregisterService(serviceId: string): void {
    this.serviceRegistry.deregister(serviceId);
    console.log(`Service deregistered from gateway: ${serviceId}`);
  }

  /**
   * Make a request through the gateway
   */
  async makeRequest(
    serviceName: string,
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
      query?: Record<string, string>;
      clientIp?: string;
      timeout?: number;
    } = {}
  ): Promise<any> {
    const startTime = Date.now();
    this.stats.totalRequests++;
    this.stats.activeConnections++;

    try {
      // Get service instance
      const server = await this.getServerInstance(serviceName, options.clientIp);
      
      if (!server) {
        throw new Error(`No available servers for service: ${serviceName}`);
      }

      // Check circuit breaker
      if (this.config.enableCircuitBreaker) {
        await this.checkCircuitBreaker(server.id);
      }

      // Apply request transforms
      const transformedOptions = this.applyTransforms(serviceName, options);

      // Build URL
      const url = this.buildUrl(server, path, transformedOptions.query);

      // Execute request with retries
      const result = await this.executeWithRetry(
        server.id,
        () => this.executeRequest(url, {
          method: transformedOptions.method || 'GET',
          headers: transformedOptions.headers,
          body: transformedOptions.body,
          timeout: options.timeout || this.config.defaultTimeout,
        }),
        options.timeout || this.config.defaultTimeout
      );

      // Update stats
      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);
      this.loadBalancer.updateStats(server.id, true, responseTime);

      this.emit('requestComplete', { 
        serviceName, 
        serverId: server.id,
        responseTime,
        success: true 
      });

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(false, responseTime);
      
      this.emit('requestError', { 
        serviceName, 
        error,
        responseTime,
        success: false 
      });

      throw error;
    } finally {
      this.stats.activeConnections--;
    }
  }

  /**
   * Get server instance using service discovery and load balancing
   */
  private async getServerInstance(serviceName: string, clientIp?: string): Promise<ServiceInfo | null> {
    if (!this.config.enableServiceDiscovery) {
      // If service discovery is disabled, use load balancer directly
      return this.loadBalancer.getNextServer(serviceName, clientIp);
    }

    // Get healthy instances from service registry
    const instances = this.serviceRegistry.getHealthyInstances(serviceName);
    
    if (instances.length === 0) {
      return null;
    }

    // Use load balancer to select instance
    if (this.config.enableLoadBalancing) {
      return this.loadBalancer.getNextServer(serviceName, clientIp);
    }

    // Simple random selection if load balancing is disabled
    return instances[Math.floor(Math.random() * instances.length)];
  }

  /**
   * Check circuit breaker before making request
   */
  private async checkCircuitBreaker(serviceId: string): Promise<void> {
    try {
      await this.circuitBreaker.execute(serviceId, async () => {
        // Just a check, actual execution happens later
        return true;
      });
    } catch (error) {
      throw new Error(`Circuit breaker prevented request to ${serviceId}`);
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    serviceId: string,
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await this.circuitBreaker.execute(serviceId, fn);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Execute HTTP request
   */
  private async executeRequest(
    url: string,
    options: {
      method: string;
      headers?: Record<string, string>;
      body?: any;
      timeout: number;
    }
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const fetchOptions: RequestInit = {
        method: options.method,
        headers: options.headers,
        signal: controller.signal,
      };

      if (options.body && options.method !== 'GET') {
        fetchOptions.body = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
        
        if (!fetchOptions.headers) {
          fetchOptions.headers = {};
        }
        
        if (!(fetchOptions.headers as any)['Content-Type']) {
          (fetchOptions.headers as any)['Content-Type'] = 'application/json';
        }
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // Try to parse as JSON, otherwise return text
      try {
        return await response.json();
      } catch {
        return await response.text();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Build URL from server info
   */
  private buildUrl(
    server: ServiceInfo,
    path: string,
    query?: Record<string, string>
  ): string {
    const protocol = server.protocol === 'grpc' ? 'http' : server.protocol;
    let url = `${protocol}://${server.host}:${server.port}${path}`;

    if (query && Object.keys(query).length > 0) {
      const queryString = new URLSearchParams(query).toString();
      url += `?${queryString}`;
    }

    return url;
  }

  /**
   * Apply request transforms
   */
  private applyTransforms(
    serviceName: string,
    options: any
  ): any {
    const transforms = this.requestTransforms.get(serviceName) || [];
    const result = { ...options };

    for (const transform of transforms) {
      switch (transform.type) {
        case 'header':
          if (transform.operation === 'add' || transform.operation === 'modify') {
            result.headers = { ...result.headers, [transform.key]: transform.value };
          } else if (transform.operation === 'remove') {
            delete result.headers?.[transform.key];
          }
          break;
        case 'query':
          if (transform.operation === 'add' || transform.operation === 'modify') {
            result.query = { ...result.query, [transform.key]: transform.value };
          } else if (transform.operation === 'remove') {
            delete result.query?.[transform.key];
          }
          break;
      }
    }

    return result;
  }

  /**
   * Add request transform
   */
  addTransform(serviceName: string, transform: RequestTransform): void {
    if (!this.requestTransforms.has(serviceName)) {
      this.requestTransforms.set(serviceName, []);
    }
    
    this.requestTransforms.get(serviceName)!.push(transform);
    console.log(`Transform added for ${serviceName}: ${transform.operation} ${transform.key}`);
  }

  /**
   * Update statistics
   */
  private updateStats(success: boolean, responseTime: number): void {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Update average response time
    this.stats.avgResponseTime = 
      ((this.stats.avgResponseTime * (this.stats.totalRequests - 1)) + responseTime) / 
      this.stats.totalRequests;
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    // Client errors that shouldn't be retried
    const nonRetryableMessages = [
      '400',
      '401',
      '403',
      '404',
      'Circuit breaker is OPEN',
    ];

    return nonRetryableMessages.some(msg => error.message.includes(msg));
  }

  /**
   * Get gateway statistics
   */
  getStats(): GatewayStats {
    return { ...this.stats };
  }

  /**
   * Set load balancing strategy
   */
  setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    this.loadBalancer.setStrategy(strategy);
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(serviceId: string): string {
    const state = this.circuitBreaker.getState(serviceId);
    return state.closed;
  }

  /**
   * Gracefully shutdown
   */
  shutdown(): void {
    this.circuitBreaker.shutdown();
    this.serviceRegistry.shutdown();
    this.loadBalancer.shutdown();
    
    console.log('GatewayService shutdown complete');
    this.emit('shutdown');
  }
}

export const gatewayService = new GatewayService();
