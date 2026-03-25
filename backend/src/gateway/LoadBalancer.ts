import { Request, Response, NextFunction } from 'express';

/**
 * Basic Load Balancer for distributing service load within the gateway.
 */
class LoadBalancer {
  private serviceInstances: Map<string, string[]> = new Map();
  private currentIndex: Map<string, number> = new Map();

  constructor() {
    this.initializeServiceRegistry();
  }

  /**
   * Static service registry (mocking service discovery registry).
   */
  private initializeServiceRegistry() {
    this.serviceInstances.set('auth-service', ['http://auth-service-1:4001', 'http://auth-service-2:4001']);
    this.serviceInstances.set('proof-service', ['http://proof-service-1:4003', 'http://proof-service-2:4003']);
    this.serviceInstances.set('user-service', ['http://user-service-1:4002']);
    this.serviceInstances.set('verification-service', ['http://verification-service-1:4004']);
    this.serviceInstances.set('notification-service', ['http://notification-service-1:4005']);

    // Initialize round-robin counters
    this.serviceInstances.forEach((_, serviceName) => {
      this.currentIndex.set(serviceName, 0);
    });
  }

  /**
   * Simple Round-Robin algorithm for selecting service instance.
   */
  public getNextInstance(serviceName: string): string {
    const instances = this.serviceInstances.get(serviceName);
    if (!instances || instances.length === 0) {
      throw new Error(`No instances registered for service: ${serviceName}`);
    }

    const index = this.currentIndex.get(serviceName) || 0;
    const instance = instances[index];

    // Update index for next time (modulo total instances)
    this.currentIndex.set(serviceName, (index + 1) % instances.length);

    return instance;
  }

  /**
   * Health check for service instances.
   */
  public async verifyInstanceHealth(instanceUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${instanceUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export default new LoadBalancer();
