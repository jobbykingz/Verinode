import { EventEmitter } from 'events';

export interface ServiceInfo {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'websocket';
  healthEndpoint?: string;
  metadata?: Record<string, any>;
  registeredAt: Date;
  lastHeartbeat: Date;
  status: 'healthy' | 'unhealthy' | 'unknown';
  tags?: string[];
}

export interface ServiceDiscoveryConfig {
  heartbeatInterval: number;
  serviceTimeout: number;
  maxRetries: number;
  healthCheckEnabled: boolean;
}

/**
 * ServiceRegistry - Service discovery and registration system
 */
export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInfo[]> = new Map();
  private heartbeats: Map<string, NodeJS.Timeout> = new Map();
  private config: ServiceDiscoveryConfig;

  constructor(config?: Partial<ServiceDiscoveryConfig>) {
    super();
    
    this.config = {
      heartbeatInterval: 10000, // 10 seconds
      serviceTimeout: 30000, // 30 seconds
      maxRetries: 3,
      healthCheckEnabled: true,
      ...config,
    };
  }

  /**
   * Register a service
   */
  register(service: ServiceInfo): void {
    const serviceName = service.name;
    
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, []);
    }

    const instances = this.services.get(serviceName)!;
    const existingIndex = instances.findIndex(s => s.id === service.id);

    if (existingIndex >= 0) {
      // Update existing instance
      instances[existingIndex] = { ...service, registeredAt: instances[existingIndex].registeredAt };
      console.log(`Service instance updated: ${service.id}`);
    } else {
      // Add new instance
      instances.push(service);
      console.log(`Service registered: ${service.id}`);
    }

    this.startHeartbeat(service.id, serviceName);
    this.emit('serviceRegistered', { service });
  }

  /**
   * Deregister a service
   */
  deregister(serviceId: string): void {
    for (const [serviceName, instances] of this.services.entries()) {
      const index = instances.findIndex(s => s.id === serviceId);
      
      if (index >= 0) {
        instances.splice(index, 1);
        
        this.stopHeartbeat(serviceId);
        console.log(`Service deregistered: ${serviceId}`);
        this.emit('serviceDeregistered', { serviceId, serviceName });
        
        // Remove service entry if no instances left
        if (instances.length === 0) {
          this.services.delete(serviceName);
        }
        
        return;
      }
    }
  }

  /**
   * Get all instances of a service
   */
  getServiceInstances(serviceName: string): ServiceInfo[] {
    return this.services.get(serviceName) || [];
  }

  /**
   * Get healthy instances of a service
   */
  getHealthyInstances(serviceName: string): ServiceInfo[] {
    const instances = this.getServiceInstances(serviceName);
    return instances.filter(instance => instance.status === 'healthy');
  }

  /**
   * Get a single service instance (for load balancing)
   */
  getInstance(serviceName: string): ServiceInfo | null {
    const instances = this.getHealthyInstances(serviceName);
    
    if (instances.length === 0) {
      return null;
    }

    // Simple round-robin could be implemented here
    return instances[Math.floor(Math.random() * instances.length)];
  }

  /**
   * Update service health status
   */
  updateHealth(serviceId: string, status: 'healthy' | 'unhealthy'): void {
    for (const instances of this.services.values()) {
      const instance = instances.find(s => s.id === serviceId);
      
      if (instance) {
        const oldStatus = instance.status;
        instance.status = status;
        instance.lastHeartbeat = new Date();

        if (oldStatus !== status) {
          console.log(`Service ${serviceId} health changed from ${oldStatus} to ${status}`);
          this.emit('healthChanged', { serviceId, status });
        }
        
        return;
      }
    }
  }

  /**
   * Start heartbeat monitoring for a service
   */
  private startHeartbeat(serviceId: string, serviceName: string): void {
    this.stopHeartbeat(serviceId);

    const heartbeat = setInterval(() => {
      const instances = this.services.get(serviceName) || [];
      const instance = instances.find(s => s.id === serviceId);

      if (!instance) {
        this.stopHeartbeat(serviceId);
        return;
      }

      const timeSinceHeartbeat = Date.now() - instance.lastHeartbeat.getTime();

      if (timeSinceHeartbeat > this.config.serviceTimeout) {
        console.warn(`Service ${serviceId} heartbeat timeout`);
        this.updateHealth(serviceId, 'unhealthy');
        this.emit('heartbeatTimeout', { serviceId, serviceName });
      }
    }, this.config.heartbeatInterval);

    this.heartbeats.set(serviceId, heartbeat);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(serviceId: string): void {
    const heartbeat = this.heartbeats.get(serviceId);
    
    if (heartbeat) {
      clearInterval(heartbeat);
      this.heartbeats.delete(serviceId);
    }
  }

  /**
   * Perform health check on all services
   */
  async performHealthChecks(): Promise<void> {
    if (!this.config.healthCheckEnabled) {
      return;
    }

    for (const [serviceName, instances] of this.services.entries()) {
      for (const instance of instances) {
        if (instance.healthEndpoint) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(instance.healthEndpoint, { 
              method: 'GET',
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const isHealthy = response.ok;
            this.updateHealth(instance.id, isHealthy ? 'healthy' : 'unhealthy');
          } catch (error) {
            console.error(`Health check failed for ${instance.id}:`, error);
            this.updateHealth(instance.id, 'unhealthy');
          }
        }
      }
    }

    this.emit('healthChecksComplete');
  }

  /**
   * Get all registered services
   */
  getAllServices(): Map<string, ServiceInfo[]> {
    return new Map(this.services);
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalServices: number;
    totalInstances: number;
    healthyInstances: number;
    unhealthyInstances: number;
  } {
    let totalInstances = 0;
    let healthyInstances = 0;
    let unhealthyInstances = 0;

    for (const instances of this.services.values()) {
      for (const instance of instances) {
        totalInstances++;
        
        if (instance.status === 'healthy') {
          healthyInstances++;
        } else if (instance.status === 'unhealthy') {
          unhealthyInstances++;
        }
      }
    }

    return {
      totalServices: this.services.size,
      totalInstances,
      healthyInstances,
      unhealthyInstances,
    };
  }

  /**
   * Discover services by tag
   */
  discoverByTag(tag: string): ServiceInfo[] {
    const matchingInstances: ServiceInfo[] = [];

    for (const instances of this.services.values()) {
      for (const instance of instances) {
        if (instance.tags?.includes(tag)) {
          matchingInstances.push(instance);
        }
      }
    }

    return matchingInstances;
  }

  /**
   * Gracefully shutdown
   */
  shutdown(): void {
    // Stop all heartbeats
    for (const heartbeat of this.heartbeats.values()) {
      clearInterval(heartbeat);
    }
    this.heartbeats.clear();

    // Clear all services
    this.services.clear();

    console.log('ServiceRegistry shutdown complete');
    this.emit('shutdown');
  }
}

export const serviceRegistry = new ServiceRegistry();
