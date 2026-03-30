import { EventEmitter } from 'events';
import mongoose, { Connection } from 'mongoose';

export interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  maxIdleTime: number;
  acquireTimeout: number;
  createTimeout: number;
  destroyTimeout: number;
  reapInterval: number;
  healthCheckInterval?: number;
}

export interface ConnectionInfo {
  id: string;
  connection: Connection;
  created: number;
  lastUsed: number;
  active: boolean;
  acquireCount: number;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalAcquires: number;
  totalReleases: number;
  totalTimeouts: number;
  totalErrors: number;
  avgAcquireTime: number;
  peakConnections: number;
  utilizationRate: number;
}

/**
 * ConnectionPool - Advanced connection pooling with optimization
 */
export class ConnectionPool extends EventEmitter {
  private config: PoolConfig;
  private connections: Map<string, ConnectionInfo> = new Map();
  private waitingQueue: Array<{
    resolve: (conn: ConnectionInfo) => void;
    reject: (err: Error) => void;
    timestamp: number;
    timeoutId: NodeJS.Timeout;
  }> = [];
  private stats: PoolStats;
  private reapTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private mongoUri: string;

  constructor(mongoUri: string, config?: Partial<PoolConfig>) {
    super();
    this.mongoUri = mongoUri;
    this.config = {
      minConnections: 5,
      maxConnections: 50,
      maxIdleTime: 30000,
      acquireTimeout: 10000,
      createTimeout: 30000,
      destroyTimeout: 5000,
      reapInterval: 1000,
      healthCheckInterval: 30000,
      ...config,
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalAcquires: 0,
      totalReleases: 0,
      totalTimeouts: 0,
      totalErrors: 0,
      avgAcquireTime: 0,
      peakConnections: 0,
      utilizationRate: 0,
    };
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing connection pool...');
      
      // Create minimum connections
      const createPromises = [];
      for (let i = 0; i < this.config.minConnections; i++) {
        createPromises.push(this.createConnection());
      }

      await Promise.all(createPromises);

      // Start reaping idle connections
      this.startReaping();

      // Start health monitoring
      this.startHealthMonitoring();

      console.log(`Connection pool initialized with ${this.stats.totalConnections} connections`);
      this.emit('initialized', this.getStats());
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<ConnectionInfo> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    const startTime = Date.now();
    this.stats.totalAcquires++;
    this.stats.waitingRequests++;

    return new Promise<ConnectionInfo>((resolve, reject) => {
      // Check for available idle connection
      const idleConnection = this.getIdleConnection();

      if (idleConnection) {
        this.activateConnection(idleConnection);
        this.stats.waitingRequests--;
        this.updateAcquireTime(startTime);
        resolve(idleConnection);
        return;
      }

      // Can we create a new connection?
      if (this.stats.totalConnections < this.config.maxConnections) {
        this.createConnection()
          .then((connection) => {
            this.activateConnection(connection);
            this.stats.waitingRequests--;
            this.updateAcquireTime(startTime);
            resolve(connection);
          })
          .catch((error) => {
            this.stats.waitingRequests--;
            this.stats.totalErrors++;
            reject(error);
          });
        return;
      }

      // Add to waiting queue
      const timeoutId = setTimeout(() => {
        const index = this.waitingQueue.findIndex(
          (item) => item.resolve === resolve
        );
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
          this.stats.waitingRequests--;
          this.stats.totalTimeouts++;
          reject(new Error('Connection acquire timeout'));
        }
      }, this.config.acquireTimeout);

      this.waitingQueue.push({
        resolve,
        reject,
        timestamp: startTime,
        timeoutId,
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection: ConnectionInfo): Promise<void> {
    if (!connection || this.isShuttingDown) {
      return;
    }

    this.stats.totalReleases++;

    try {
      // Check if connection is still valid
      if (this.isConnectionValid(connection)) {
        this.deactivateConnection(connection);

        // Check if anyone is waiting
        if (this.waitingQueue.length > 0) {
          const waiter = this.waitingQueue.shift()!;
          clearTimeout(waiter.timeoutId);
          this.activateConnection(connection);
          this.stats.waitingRequests--;
          this.updateAcquireTime(waiter.timestamp);
          waiter.resolve(connection);
        } else {
          // Connection goes back to idle pool
          connection.lastUsed = Date.now();
          this.emit('connectionReleased', connection.id);
        }
      } else {
        // Connection is invalid, destroy it
        await this.destroyConnection(connection);

        // Try to create a new one if needed
        if (
          this.waitingQueue.length > 0 &&
          this.stats.totalConnections < this.config.maxConnections
        ) {
          this.createConnection()
            .then((newConnection) => {
              const waiter = this.waitingQueue.shift()!;
              clearTimeout(waiter.timeoutId);
              this.activateConnection(newConnection);
              this.stats.waitingRequests--;
              this.updateAcquireTime(waiter.timestamp);
              waiter.resolve(newConnection);
            })
            .catch((error) => {
              this.stats.totalErrors++;
              const waiter = this.waitingQueue.shift();
              if (waiter) {
                clearTimeout(waiter.timeoutId);
                this.stats.waitingRequests--;
                waiter.reject(error);
              }
            });
        }
      }
    } catch (error) {
      this.stats.totalErrors++;
      console.error('Error releasing connection:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return {
      ...this.stats,
      waitingQueueLength: this.waitingQueue.length,
      utilizationRate:
        this.stats.totalConnections > 0
          ? this.stats.activeConnections / this.stats.totalConnections
          : 0,
    };
  }

  /**
   * Get detailed connection information
   */
  getConnectionDetails(): Array<{
    id: string;
    active: boolean;
    created: number;
    lastUsed: number;
    acquireCount: number;
    readyState: number;
  }> {
    const connections = [];

    for (const [id, connection] of this.connections) {
      connections.push({
        id: connection.id,
        active: connection.active,
        created: connection.created,
        lastUsed: connection.lastUsed,
        acquireCount: connection.acquireCount,
        readyState: connection.connection.readyState,
      });
    }

    return connections;
  }

  /**
   * Health check for the pool
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    stats: PoolStats;
  }> {
    const stats = this.getStats();
    const issues = [];

    // Check for high waiting queue
    if (this.waitingQueue.length > 10) {
      issues.push('High waiting queue length');
    }

    // Check for high connection utilization
    if (stats.utilizationRate > 0.9) {
      issues.push('High connection utilization');
    }

    // Check for high error rate
    const errorRate =
      this.stats.totalAcquires > 0
        ? this.stats.totalErrors / this.stats.totalAcquires
        : 0;
    if (errorRate > 0.05) {
      issues.push('High error rate');
    }

    // Check for slow acquire times
    if (this.stats.avgAcquireTime > 1000) {
      issues.push('Slow connection acquire times');
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats,
    };
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<ConnectionInfo> {
    const startTime = Date.now();

    try {
      const connection = mongoose.createConnection(this.mongoUri, {
        maxPoolSize: 1,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      const connectionId = this.generateConnectionId();
      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        connection,
        created: Date.now(),
        lastUsed: Date.now(),
        active: false,
        acquireCount: 0,
      };

      this.connections.set(connectionId, connectionInfo);
      this.stats.totalConnections++;
      this.stats.idleConnections++;

      // Update peak connections
      if (this.stats.totalConnections > this.stats.peakConnections) {
        this.stats.peakConnections = this.stats.totalConnections;
      }

      // Set up connection event handlers
      this.setupConnectionHandlers(connectionInfo);

      const createTime = Date.now() - startTime;
      console.log(`Created new connection ${connectionId} in ${createTime}ms`);
      this.emit('connectionCreated', connectionId, createTime);

      return connectionInfo;
    } catch (error) {
      this.stats.totalErrors++;
      console.error('Failed to create connection:', error);
      throw error;
    }
  }

  /**
   * Destroy a connection
   */
  private async destroyConnection(connectionInfo: ConnectionInfo): Promise<void> {
    if (
      !connectionInfo ||
      !this.connections.has(connectionInfo.id)
    ) {
      return;
    }

    try {
      await Promise.race([
        connectionInfo.connection.close(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Connection destroy timeout')),
            this.config.destroyTimeout
          )
        ),
      ]);

      this.connections.delete(connectionInfo.id);
      this.stats.totalConnections--;

      if (connectionInfo.active) {
        this.stats.activeConnections--;
      } else {
        this.stats.idleConnections--;
      }

      console.log(`Destroyed connection ${connectionInfo.id}`);
      this.emit('connectionDestroyed', connectionInfo.id);
    } catch (error) {
      this.stats.totalErrors++;
      console.error(`Error destroying connection ${connectionInfo.id}:`, error);

      // Force remove from pool
      this.connections.delete(connectionInfo.id);
      if (connectionInfo.active) {
        this.stats.activeConnections--;
      } else {
        this.stats.idleConnections--;
      }
    }
  }

  /**
   * Get an idle connection
   */
  private getIdleConnection(): ConnectionInfo | null {
    for (const connection of this.connections.values()) {
      if (
        !connection.active &&
        this.isConnectionValid(connection.connection)
      ) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Activate a connection
   */
  private activateConnection(connection: ConnectionInfo): void {
    connection.active = true;
    connection.acquireCount++;
    connection.lastUsed = Date.now();

    this.stats.activeConnections++;
    this.stats.idleConnections--;

    this.emit('connectionAcquired', connection.id);
  }

  /**
   * Deactivate a connection
   */
  private deactivateConnection(connection: ConnectionInfo): void {
    connection.active = false;
    connection.lastUsed = Date.now();

    this.stats.activeConnections--;
    this.stats.idleConnections++;
  }

  /**
   * Check if connection is valid
   */
  private isConnectionValid(connection: Connection): boolean {
    try {
      return connection.readyState === 1; // 1 = connected
    } catch (error) {
      return false;
    }
  }

  /**
   * Set up connection event handlers
   */
  private setupConnectionHandlers(connectionInfo: ConnectionInfo): void {
    const connection = connectionInfo.connection;

    connection.on('error', (error: Error) => {
      console.error(`Connection ${connectionInfo.id} error:`, error);
      this.stats.totalErrors++;
      this.emit('connectionError', connectionInfo.id, error);

      // Remove invalid connection
      if (this.connections.has(connectionInfo.id)) {
        this.destroyConnection(connectionInfo);
      }
    });

    connection.on('close', () => {
      console.log(`Connection ${connectionInfo.id} closed`);
      this.emit('connectionClosed', connectionInfo.id);

      // Remove closed connection
      if (this.connections.has(connectionInfo.id)) {
        this.destroyConnection(connectionInfo);
      }
    });

    connection.on('disconnected', () => {
      console.log(`Connection ${connectionInfo.id} disconnected`);
      this.emit('connectionDisconnected', connectionInfo.id);

      // Remove disconnected connection
      if (this.connections.has(connectionInfo.id)) {
        this.destroyConnection(connectionInfo);
      }
    });
  }

  /**
   * Start reaping idle connections
   */
  private startReaping(): void {
    this.reapTimer = setInterval(() => {
      this.reapIdleConnections();
    }, this.config.reapInterval);
  }

  /**
   * Reap idle connections
   */
  private reapIdleConnections(): void {
    if (this.isShuttingDown) {
      return;
    }

    const now = Date.now();
    const connectionsToReap = [];

    for (const connection of this.connections.values()) {
      if (
        !connection.active &&
        this.stats.totalConnections > this.config.minConnections &&
        now - connection.lastUsed > this.config.maxIdleTime
      ) {
        connectionsToReap.push(connection);
      }
    }

    // Reap connections
    connectionsToReap.forEach((connection) => {
      this.destroyConnection(connection);
    });

    if (connectionsToReap.length > 0) {
      console.log(`Reaped ${connectionsToReap.length} idle connections`);
      this.emit('connectionsReaped', connectionsToReap.length);
    }
  }

  /**
   * Stop reaping idle connections
   */
  private stopReaping(): void {
    if (this.reapTimer) {
      clearInterval(this.reapTimer);
      this.reapTimer = null;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        this.emit('healthCheck', health);
        
        if (!health.healthy) {
          console.warn('Connection pool health issues:', health.issues);
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.config.healthCheckInterval || 30000);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update acquire time statistics
   */
  private updateAcquireTime(startTime: number): void {
    const acquireTime = Date.now() - startTime;
    const totalAcquires = this.stats.totalAcquires;

    // Calculate rolling average
    this.stats.avgAcquireTime =
      ((this.stats.avgAcquireTime * (totalAcquires - 1)) + acquireTime) /
      totalAcquires;
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.stopReaping();
    this.stopHealthMonitoring();

    console.log('Shutting down connection pool...');
    this.emit('shutdownStarted');

    // Reject all waiting requests
    this.waitingQueue.forEach((waiter) => {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new Error('Connection pool is shutting down'));
    });
    this.waitingQueue = [];

    // Close all connections
    const closePromises = [];
    for (const connection of this.connections.values()) {
      closePromises.push(this.destroyConnection(connection));
    }

    try {
      await Promise.all(closePromises);
      console.log('Connection pool shutdown complete');
      this.emit('shutdownComplete');
    } catch (error) {
      console.error('Error during pool shutdown:', error);
      this.emit('shutdownError', error);
    }
  }
}

export const connectionPool = new ConnectionPool(process.env.MONGODB_URI || 'mongodb://localhost:27017/verinode');
