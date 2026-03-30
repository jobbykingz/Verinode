import { EventEmitter } from 'events';
import { ServiceInfo } from './ServiceRegistry';

export type LoadBalancingStrategy = 'round-robin' | 'least-connections' | 'weighted' | 'random' | 'ip-hash';

export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  healthCheckInterval: number;
  stickySessions: boolean;
  weights?: Map<string, number>;
}

export interface ServerStats {
  serverId: string;
  activeConnections: number;
  totalRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  lastRequestTime: Date | null;
}

/**
 * LoadBalancer - Intelligent load balancing with multiple strategies
 */
export class LoadBalancer extends EventEmitter {
  private servers: Map<string, ServiceInfo[]> = new Map();
  private stats: Map<string, ServerStats> = new Map();
  private config: LoadBalancerConfig;
  private roundRobinIndex: Map<string, number> = new Map();
  private stickySessionMap: Map<string, string> = new Map(); // client IP -> server ID

  constructor(config?: Partial<LoadBalancerConfig>) {
    super();
    
    this.config = {
      strategy: 'round-robin',
      healthCheckInterval: 30000,
      stickySessions: false,
      ...config,
    };
  }

  /**
   * Add a server to the pool
   */
  addServer(serviceName: string, server: ServiceInfo): void {
    if (!this.servers.has(serviceName)) {
      this.servers.set(serviceName, []);
    }

    const serverList = this.servers.get(serviceName)!;
    serverList.push(server);

    // Initialize stats
    this.stats.set(server.id, {
      serverId: server.id,
      activeConnections: 0,
      totalRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      lastRequestTime: null,
    });

    console.log(`Server added to load balancer: ${server.id}`);
    this.emit('serverAdded', { serviceName, server });
  }

  /**
   * Remove a server from the pool
   */
  removeServer(serviceName: string, serverId: string): void {
    const serverList = this.servers.get(serviceName);
    
    if (serverList) {
      const index = serverList.findIndex(s => s.id === serverId);
      
      if (index >= 0) {
        serverList.splice(index, 1);
        this.stats.delete(serverId);
        
        // Clear sticky sessions for this server
        for (const [clientIp, sid] of this.stickySessionMap.entries()) {
          if (sid === serverId) {
            this.stickySessionMap.delete(clientIp);
          }
        }

        console.log(`Server removed from load balancer: ${serverId}`);
        this.emit('serverRemoved', { serviceName, serverId });
      }
    }
  }

  /**
   * Get next server using configured strategy
   */
  getNextServer(serviceName: string, clientIp?: string): ServiceInfo | null {
    const servers = this.servers.get(serviceName);
    
    if (!servers || servers.length === 0) {
      return null;
    }

    // Filter healthy servers
    const healthyServers = servers.filter(s => s.status === 'healthy');
    
    if (healthyServers.length === 0) {
      return null;
    }

    // Check for sticky session
    if (this.config.stickySessions && clientIp) {
      const stickyServerId = this.stickySessionMap.get(clientIp);
      
      if (stickyServerId) {
        const stickyServer = healthyServers.find(s => s.id === stickyServerId);
        
        if (stickyServer) {
          return stickyServer;
        }
      }
    }

    // Select server based on strategy
    let selectedServer: ServiceInfo;

    switch (this.config.strategy) {
      case 'round-robin':
        selectedServer = this.selectRoundRobin(serviceName, healthyServers);
        break;
      case 'least-connections':
        selectedServer = this.selectLeastConnections(healthyServers);
        break;
      case 'weighted':
        selectedServer = this.selectWeighted(healthyServers);
        break;
      case 'random':
        selectedServer = this.selectRandom(healthyServers);
        break;
      case 'ip-hash':
        selectedServer = this.selectIpHash(healthyServers, clientIp);
        break;
      default:
        selectedServer = healthyServers[0];
    }

    // Set sticky session if enabled
    if (this.config.stickySessions && clientIp) {
      this.stickySessionMap.set(clientIp, selectedServer.id);
    }

    return selectedServer;
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(serviceName: string, servers: ServiceInfo[]): ServiceInfo {
    const currentIndex = this.roundRobinIndex.get(serviceName) || 0;
    const nextIndex = (currentIndex + 1) % servers.length;
    
    this.roundRobinIndex.set(serviceName, nextIndex);
    return servers[currentIndex];
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(servers: ServiceInfo[]): ServiceInfo {
    return servers.reduce((min, server) => {
      const stats = this.stats.get(server.id);
      const minStats = this.stats.get(min.id);
      
      return (!stats || !minStats) ? min :
             stats.activeConnections < minStats.activeConnections ? server : min;
    }, servers[0]);
  }

  /**
   * Weighted selection
   */
  private selectWeighted(servers: ServiceInfo[]): ServiceInfo {
    const totalWeight = servers.reduce((sum, server) => {
      return sum + (this.config.weights?.get(server.id) || 1);
    }, 0);

    let random = Math.random() * totalWeight;
    
    for (const server of servers) {
      const weight = this.config.weights?.get(server.id) || 1;
      random -= weight;
      
      if (random <= 0) {
        return server;
      }
    }

    return servers[servers.length - 1];
  }

  /**
   * Random selection
   */
  private selectRandom(servers: ServiceInfo[]): ServiceInfo {
    return servers[Math.floor(Math.random() * servers.length)];
  }

  /**
   * IP hash selection
   */
  private selectIpHash(servers: ServiceInfo[], clientIp?: string): ServiceInfo {
    if (!clientIp) {
      return servers[0];
    }

    const hash = this.hashString(clientIp);
    const index = Math.abs(hash) % servers.length;
    return servers[index];
  }

  /**
   * Hash a string
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Update server statistics after request
   */
  updateStats(serverId: string, success: boolean, responseTime: number): void {
    const stats = this.stats.get(serverId);
    
    if (stats) {
      stats.totalRequests++;
      stats.lastRequestTime = new Date();
      
      if (!success) {
        stats.failedRequests++;
      }

      // Update average response time
      stats.avgResponseTime = ((stats.avgResponseTime * (stats.totalRequests - 1)) + responseTime) / stats.totalRequests;

      this.stats.set(serverId, stats);
    }
  }

  /**
   * Increment active connections
   */
  incrementConnections(serverId: string): void {
    const stats = this.stats.get(serverId);
    
    if (stats) {
      stats.activeConnections++;
      this.stats.set(serverId, stats);
    }
  }

  /**
   * Decrement active connections
   */
  decrementConnections(serverId: string): void {
    const stats = this.stats.get(serverId);
    
    if (stats) {
      stats.activeConnections = Math.max(0, stats.activeConnections - 1);
      this.stats.set(serverId, stats);
    }
  }

  /**
   * Get server statistics
   */
  getServerStats(serverId: string): ServerStats | null {
    return this.stats.get(serverId) || null;
  }

  /**
   * Get all server statistics
   */
  getAllStats(): Map<string, ServerStats> {
    return new Map(this.stats);
  }

  /**
   * Get load balancer configuration
   */
  getConfig(): LoadBalancerConfig {
    return { ...this.config };
  }

  /**
   * Update load balancing strategy
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    this.config.strategy = strategy;
    console.log(`Load balancing strategy updated to: ${strategy}`);
    this.emit('strategyChanged', { strategy });
  }

  /**
   * Get available servers for a service
   */
  getAvailableServers(serviceName: string): ServiceInfo[] {
    return this.servers.get(serviceName) || [];
  }

  /**
   * Get distribution of requests across servers
   */
  getRequestDistribution(serviceName: string): Map<string, number> {
    const distribution = new Map<string, number>();
    const servers = this.servers.get(serviceName) || [];

    for (const server of servers) {
      const stats = this.stats.get(server.id);
      distribution.set(server.id, stats?.totalRequests || 0);
    }

    return distribution;
  }

  /**
   * Gracefully shutdown
   */
  shutdown(): void {
    this.servers.clear();
    this.stats.clear();
    this.roundRobinIndex.clear();
    this.stickySessionMap.clear();
    
    console.log('LoadBalancer shutdown complete');
    this.emit('shutdown');
  }
}

export const loadBalancer = new LoadBalancer();
