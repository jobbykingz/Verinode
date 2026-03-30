import { EventEmitter } from 'events';
import mongoose from 'mongoose';

export interface ReplicaConfig {
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  priority?: number; // Lower is higher priority
  maxPoolSize?: number;
  minPoolSize?: number;
  replicaName: string;
  isReadReplica: boolean;
}

export interface ReplicaStats {
  replicaName: string;
  host: string;
  status: 'connected' | 'disconnected' | 'error';
  latency: number;
  lastCheck: Date;
  queriesExecuted: number;
  avgResponseTime: number;
  errorCount: number;
}

/**
 * ReplicaManager - Manages MongoDB read replicas for scaling read operations
 */
export class ReplicaManager extends EventEmitter {
  private replicas: Map<string, ReplicaConfig> = new Map();
  private connections: Map<string, mongoose.Connection> = new Map();
  private stats: Map<string, ReplicaStats> = new Map();
  private primaryReplica: string | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly healthCheckDelay: number = 30000; // 30 seconds

  constructor() {
    super();
  }

  /**
   * Initialize the replica manager with configuration
   */
  async initialize(replicas: ReplicaConfig[]): Promise<void> {
    try {
      // Sort replicas by priority (lower is better)
      const sortedReplicas = replicas.sort((a, b) => (a.priority || 0) - (b.priority || 0));
      
      // Set first non-read replica as primary if exists
      const primary = sortedReplicas.find(r => !r.isReadReplica);
      if (primary) {
        this.primaryReplica = primary.replicaName;
      }

      // Initialize all replicas
      for (const replica of sortedReplicas) {
        this.replicas.set(replica.replicaName, replica);
        await this.connectToReplica(replica);
      }

      // Start health monitoring
      this.startHealthMonitoring();

      this.emit('initialized', { replicaCount: this.replicas.size });
      console.log(`ReplicaManager initialized with ${this.replicas.size} replicas`);
    } catch (error) {
      console.error('Failed to initialize ReplicaManager:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Connect to a replica
   */
  private async connectToReplica(config: ReplicaConfig): Promise<void> {
    try {
      const uri = this.buildConnectionString(config);
      
      const connection = mongoose.createConnection(uri, {
        maxPoolSize: config.maxPoolSize || 10,
        minPoolSize: config.minPoolSize || 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      connection.on('connected', () => {
        console.log(`Connected to replica: ${config.replicaName}`);
        this.updateReplicaStats(config.replicaName, { 
          status: 'connected',
          latency: 0 
        });
        this.emit('replicaConnected', config.replicaName);
      });

      connection.on('disconnected', () => {
        console.log(`Disconnected from replica: ${config.replicaName}`);
        this.updateReplicaStats(config.replicaName, { status: 'disconnected' });
        this.emit('replicaDisconnected', config.replicaName);
      });

      connection.on('error', (error: Error) => {
        console.error(`Error with replica ${config.replicaName}:`, error);
        this.updateReplicaStats(config.replicaName, { 
          status: 'error',
          errorCount: 1 
        });
        this.emit('replicaError', config.replicaName, error);
      });

      this.connections.set(config.replicaName, connection);
      this.initializeReplicaStats(config);

      // Wait for initial connection
      await connection.asPromise();
    } catch (error) {
      console.error(`Failed to connect to replica ${config.replicaName}:`, error);
      this.updateReplicaStats(config.replicaName, { status: 'error' });
      throw error;
    }
  }

  /**
   * Get a read replica for query execution
   */
  getReadReplica(): mongoose.Connection | null {
    const readReplicas = Array.from(this.connections.entries())
      .filter(([name]) => {
        const config = this.replicas.get(name);
        return config?.isReadReplica && this.isReplicaHealthy(name);
      })
      .sort(([nameA], [nameB]) => {
        const statsA = this.stats.get(nameA);
        const statsB = this.stats.get(nameB);
        
        // Prioritize by latency and error count
        const scoreA = (statsA?.latency || 0) + (statsA?.errorCount || 0) * 100;
        const scoreB = (statsB?.latency || 0) + (statsB?.errorCount || 0) * 100;
        
        return scoreA - scoreB;
      });

    if (readReplicas.length > 0) {
      return readReplicas[0][1];
    }

    // Fallback to primary if no healthy read replicas
    if (this.primaryReplica) {
      return this.connections.get(this.primaryReplica) || null;
    }

    return null;
  }

  /**
   * Get the primary connection
   */
  getPrimaryConnection(): mongoose.Connection | null {
    if (!this.primaryReplica) {
      return Array.from(this.connections.values())[0] || null;
    }
    return this.connections.get(this.primaryReplica) || null;
  }

  /**
   * Get connection by replica name
   */
  getConnection(replicaName: string): mongoose.Connection | null {
    return this.connections.get(replicaName) || null;
  }

  /**
   * Check if a replica is healthy
   */
  isReplicaHealthy(replicaName: string): boolean {
    const stats = this.stats.get(replicaName);
    const connection = this.connections.get(replicaName);
    
    if (!stats || !connection) {
      return false;
    }

    return (
      stats.status === 'connected' &&
      stats.latency < 5000 && // 5 second threshold
      stats.errorCount < 10
    );
  }

  /**
   * Get all replica statistics
   */
  getReplicaStats(): Map<string, ReplicaStats> {
    return new Map(this.stats);
  }

  /**
   * Execute a read operation on a read replica
   */
  async executeOnReadReplica<T>(operation: (conn: mongoose.Connection) => Promise<T>): Promise<T> {
    const replica = this.getReadReplica();
    
    if (!replica) {
      throw new Error('No healthy read replicas available');
    }

    const startTime = Date.now();
    try {
      const result = await operation(replica);
      const latency = Date.now() - startTime;
      
      this.recordQueryMetrics(replica, latency, true);
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordQueryMetrics(replica, latency, false);
      throw error;
    }
  }

  /**
   * Execute a write operation on the primary
   */
  async executeOnPrimary<T>(operation: (conn: mongoose.Connection) => Promise<T>): Promise<T> {
    const primary = this.getPrimaryConnection();
    
    if (!primary) {
      throw new Error('No primary connection available');
    }

    const startTime = Date.now();
    try {
      const result = await operation(primary);
      const latency = Date.now() - startTime;
      
      this.recordQueryMetrics(primary, latency, true);
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordQueryMetrics(primary, latency, false);
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [name, connection] of this.connections.entries()) {
        try {
          const startTime = Date.now();
          await connection.db?.admin().ping();
          const latency = Date.now() - startTime;
          
          this.updateReplicaStats(name, { 
            latency,
            lastCheck: new Date(),
            status: 'connected'
          });
        } catch (error) {
          this.updateReplicaStats(name, { 
            status: 'error',
            errorCount: 1 
          });
        }
      }
      
      this.emit('healthCheckComplete', this.getReplicaStats());
    }, this.healthCheckDelay);
  }

  /**
   * Initialize stats for a replica
   */
  private initializeReplicaStats(config: ReplicaConfig): void {
    this.stats.set(config.replicaName, {
      replicaName: config.replicaName,
      host: `${config.host}:${config.port}`,
      status: 'connected',
      latency: 0,
      lastCheck: new Date(),
      queriesExecuted: 0,
      avgResponseTime: 0,
      errorCount: 0,
    });
  }

  /**
   * Update replica statistics
   */
  private updateReplicaStats(replicaName: string, updates: Partial<ReplicaStats>): void {
    const currentStats = this.stats.get(replicaName);
    if (currentStats) {
      this.stats.set(replicaName, { ...currentStats, ...updates });
    }
  }

  /**
   * Record query metrics
   */
  private recordQueryMetrics(
    connection: mongoose.Connection,
    latency: number,
    success: boolean
  ): void {
    const replicaName = Array.from(this.connections.entries())
      .find(([_, conn]) => conn === connection)?.[0];
    
    if (!replicaName) return;

    const stats = this.stats.get(replicaName);
    if (stats) {
      stats.queriesExecuted++;
      
      // Update average response time
      const totalQueries = stats.queriesExecuted;
      const oldAvg = stats.avgResponseTime;
      stats.avgResponseTime = ((oldAvg * (totalQueries - 1)) + latency) / totalQueries;
      
      if (!success) {
        stats.errorCount++;
      }
      
      this.stats.set(replicaName, stats);
    }
  }

  /**
   * Build connection string from config
   */
  private buildConnectionString(config: ReplicaConfig): string {
    const auth = config.username && config.password 
      ? `${config.username}:${config.password}@`
      : '';
    
    return `mongodb://${auth}${config.host}:${config.port}/${config.database}`;
  }

  /**
   * Gracefully shutdown all connections
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    const closePromises = Array.from(this.connections.values()).map(conn => conn.close());
    await Promise.all(closePromises);
    
    this.connections.clear();
    this.replicas.clear();
    this.stats.clear();
    
    console.log('ReplicaManager shutdown complete');
    this.emit('shutdown');
  }
}

export const replicaManager = new ReplicaManager();
