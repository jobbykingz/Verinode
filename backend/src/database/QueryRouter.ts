import { EventEmitter } from 'events';
import mongoose, { Connection } from 'mongoose';
import { ReplicaManager, replicaManager } from './ReplicaManager';
import { ConnectionPool, connectionPool } from './ConnectionPool';

export enum QueryType {
  READ = 'read',
  WRITE = 'write',
  AGGREGATE = 'aggregate',
  TRANSACTION = 'transaction',
}

export interface QueryConfig {
  type: QueryType;
  model: string;
  operation: string;
  priority?: number;
  timeout?: number;
  useCache?: boolean;
  shardKey?: string;
}

export interface RoutingStrategy {
  name: string;
  routeQuery: (config: QueryConfig) => Promise<Connection | null>;
}

/**
 * QueryRouter - Intelligent query routing for database operations
 */
export class QueryRouter extends EventEmitter {
  private replicaManager: ReplicaManager;
  private connectionPool: ConnectionPool;
  private strategies: Map<string, RoutingStrategy> = new Map();
  private queryStats: Map<string, any> = new Map();
  private defaultStrategy: string = 'replica-aware';

  constructor(
    replicaManagerInstance?: ReplicaManager,
    connectionPoolInstance?: ConnectionPool
  ) {
    super();
    this.replicaManager = replicaManagerInstance || new ReplicaManager();
    this.connectionPool = connectionPoolInstance || new ConnectionPool(process.env.MONGODB_URI || 'mongodb://localhost:27017/verinode');
    
    this.initializeStrategies();
  }

  /**
   * Initialize routing strategies
   */
  private initializeStrategies(): void {
    // Replica-aware routing
    this.strategies.set('replica-aware', {
      name: 'replica-aware',
      routeQuery: async (config: QueryConfig) => {
        if (config.type === QueryType.READ || config.type === QueryType.AGGREGATE) {
          return this.replicaManager.getReadReplica();
        }
        return this.replicaManager.getPrimaryConnection();
      },
    });

    // Load-balanced routing
    this.strategies.set('load-balanced', {
      name: 'load-balanced',
      routeQuery: async (config: QueryConfig) => {
        const connections = [];
        
        if (config.type === QueryType.READ) {
          const readReplica = this.replicaManager.getReadReplica();
          if (readReplica) connections.push(readReplica);
        }
        
        const primary = this.replicaManager.getPrimaryConnection();
        if (primary) connections.push(primary);

        // Round-robin selection
        if (connections.length > 0) {
          const index = Math.floor(Math.random() * connections.length);
          return connections[index];
        }
        
        return null;
      },
    });

    // Shard-aware routing
    this.strategies.set('shard-aware', {
      name: 'shard-aware',
      routeQuery: async (config: QueryConfig) => {
        if (!config.shardKey) {
          return this.replicaManager.getPrimaryConnection();
        }

        const shardIndex = this.calculateShard(config.shardKey);
        return this.getShardConnection(shardIndex);
      },
    });

    // Priority-based routing
    this.strategies.set('priority-based', {
      name: 'priority-based',
      routeQuery: async (config: QueryConfig) => {
        const priority = config.priority || 0;

        // High priority queries go to primary with dedicated connection
        if (priority >= 8) {
          return this.replicaManager.getPrimaryConnection();
        }

        // Medium priority uses load balancing
        if (priority >= 5) {
          const strategy = this.strategies.get('load-balanced');
          return strategy ? strategy.routeQuery(config) : null;
        }

        // Low priority uses read replicas
        if (config.type === QueryType.READ) {
          return this.replicaManager.getReadReplica();
        }

        return this.replicaManager.getPrimaryConnection();
      },
    });
  }

  /**
   * Route a query to appropriate connection
   */
  async routeQuery(config: QueryConfig): Promise<Connection> {
    const startTime = Date.now();
    const strategyName = config.type === QueryType.WRITE ? 'replica-aware' : this.defaultStrategy;
    
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Routing strategy ${strategyName} not found`);
    }

    try {
      const connection = await strategy.routeQuery(config);
      
      if (!connection) {
        throw new Error('No available connection for query');
      }

      const latency = Date.now() - startTime;
      this.recordQueryMetrics(config, latency, true);
      
      this.emit('queryRouted', {
        config,
        connectionId: connection.id,
        strategy: strategyName,
        latency,
      });

      return connection;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordQueryMetrics(config, latency, false);
      
      this.emit('queryError', {
        config,
        strategy: strategyName,
        error,
        latency,
      });

      throw error;
    }
  }

  /**
   * Execute a read operation with automatic routing
   */
  async executeRead<T>(operation: (conn: Connection) => Promise<T>): Promise<T> {
    const config: QueryConfig = {
      type: QueryType.READ,
      model: 'unknown',
      operation: 'read',
    };

    const connection = await this.routeQuery(config);
    return operation(connection);
  }

  /**
   * Execute a write operation with automatic routing
   */
  async executeWrite<T>(operation: (conn: Connection) => Promise<T>): Promise<T> {
    const config: QueryConfig = {
      type: QueryType.WRITE,
      model: 'unknown',
      operation: 'write',
    };

    const connection = await this.routeQuery(config);
    return operation(connection);
  }

  /**
   * Execute an aggregate operation with automatic routing
   */
  async executeAggregate<T>(operation: (conn: Connection) => Promise<T>): Promise<T> {
    const config: QueryConfig = {
      type: QueryType.AGGREGATE,
      model: 'unknown',
      operation: 'aggregate',
    };

    const connection = await this.routeQuery(config);
    return operation(connection);
  }

  /**
   * Execute a transaction on primary
   */
  async executeTransaction<T>(operation: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
    const primary = this.replicaManager.getPrimaryConnection();
    
    if (!primary) {
      throw new Error('No primary connection available for transaction');
    }

    const session = await primary.startSession();
    
    try {
      session.startTransaction();
      const result = await operation(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Set the default routing strategy
   */
  setDefaultStrategy(strategyName: string): void {
    if (!this.strategies.has(strategyName)) {
      throw new Error(`Routing strategy ${strategyName} not found`);
    }
    this.defaultStrategy = strategyName;
    console.log(`Default routing strategy set to: ${strategyName}`);
  }

  /**
   * Add a custom routing strategy
   */
  addStrategy(strategy: RoutingStrategy): void {
    this.strategies.set(strategy.name, strategy);
    console.log(`Custom routing strategy added: ${strategy.name}`);
  }

  /**
   * Get query statistics
   */
  getQueryStats(): Map<string, any> {
    return new Map(this.queryStats);
  }

  /**
   * Calculate shard based on shard key
   */
  private calculateShard(shardKey: string): number {
    // Simple hash-based sharding
    let hash = 0;
    for (let i = 0; i < shardKey.length; i++) {
      hash = ((hash << 5) - hash) + shardKey.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 10; // 10 shards
  }

  /**
   * Get connection for specific shard
   */
  private getShardConnection(shardIndex: number): Connection | null {
    // In a real implementation, you would have different connections for different shards
    // For now, return primary connection
    return this.replicaManager.getPrimaryConnection();
  }

  /**
   * Record query metrics
   */
  private recordQueryMetrics(
    config: QueryConfig,
    latency: number,
    success: boolean
  ): void {
    const key = `${config.type}:${config.operation}`;
    const stats = this.queryStats.get(key) || {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalLatency: 0,
      avgLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
    };

    stats.totalQueries++;
    stats.totalLatency += latency;
    stats.avgLatency = stats.totalLatency / stats.totalQueries;
    stats.minLatency = Math.min(stats.minLatency, latency);
    stats.maxLatency = Math.max(stats.maxLatency, latency);

    if (success) {
      stats.successfulQueries++;
    } else {
      stats.failedQueries++;
    }

    this.queryStats.set(key, stats);
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    totalQueries: number;
    avgLatency: number;
    successRate: number;
    strategyUsage: Map<string, number>;
  } {
    let totalQueries = 0;
    let totalLatency = 0;
    let totalSuccess = 0;

    for (const stats of this.queryStats.values()) {
      totalQueries += stats.totalQueries;
      totalLatency += stats.totalLatency;
      totalSuccess += stats.successfulQueries;
    }

    return {
      totalQueries,
      avgLatency: totalQueries > 0 ? totalLatency / totalQueries : 0,
      successRate: totalQueries > 0 ? (totalSuccess / totalQueries) * 100 : 0,
      strategyUsage: new Map(), // Could be enhanced to track strategy usage
    };
  }
}

export const queryRouter = new QueryRouter();
