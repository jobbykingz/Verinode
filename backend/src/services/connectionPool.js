const mongoose = require('mongoose');
const EventEmitter = require('events');

class ConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      minConnections: options.minConnections || 5,
      maxConnections: options.maxConnections || 50,
      maxIdleTime: options.maxIdleTime || 30000, // 30 seconds
      acquireTimeout: options.acquireTimeout || 10000, // 10 seconds
      createTimeout: options.createTimeout || 30000, // 30 seconds
      destroyTimeout: options.destroyTimeout || 5000, // 5 seconds
      reapInterval: options.reapInterval || 1000, // 1 second
      ...options
    };
    
    this.connections = new Map();
    this.waitingQueue = [];
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
      peakConnections: 0
    };
    
    this.reapTimer = null;
    this.isShuttingDown = false;
    
    this.initializePool();
  }

  /**
   * Initialize the connection pool
   */
  async initializePool() {
    try {
      // Create minimum connections
      const createPromises = [];
      for (let i = 0; i < this.options.minConnections; i++) {
        createPromises.push(this.createConnection());
      }
      
      await Promise.all(createPromises);
      
      // Start reaping idle connections
      this.startReaping();
      
      console.log(`Connection pool initialized with ${this.options.minConnections} connections`);
      this.emit('initialized', this.stats);
      
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire() {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }
    
    const startTime = Date.now();
    this.stats.totalAcquires++;
    this.stats.waitingRequests++;
    
    return new Promise((resolve, reject) => {
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
      if (this.stats.totalConnections < this.options.maxConnections) {
        this.createConnection()
          .then(connection => {
            this.activateConnection(connection);
            this.stats.waitingRequests--;
            this.updateAcquireTime(startTime);
            resolve(connection);
          })
          .catch(error => {
            this.stats.waitingRequests--;
            this.stats.totalErrors++;
            reject(error);
          });
        return;
      }
      
      // Add to waiting queue
      const timeoutId = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
          this.stats.waitingRequests--;
          this.stats.totalTimeouts++;
          reject(new Error('Connection acquire timeout'));
        }
      }, this.options.acquireTimeout);
      
      this.waitingQueue.push({
        resolve,
        reject,
        timestamp: startTime,
        timeoutId
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection) {
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
          const waiter = this.waitingQueue.shift();
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
        if (this.waitingQueue.length > 0 && 
            this.stats.totalConnections < this.options.maxConnections) {
          this.createConnection()
            .then(newConnection => {
              const waiter = this.waitingQueue.shift();
              clearTimeout(waiter.timeoutId);
              this.activateConnection(newConnection);
              this.stats.waitingRequests--;
              this.updateAcquireTime(waiter.timestamp);
              waiter.resolve(newConnection);
            })
            .catch(error => {
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
   * Create a new database connection
   */
  async createConnection() {
    const startTime = Date.now();
    
    try {
      // Create connection with timeout
      const connectionPromise = mongoose.createConnection();
      
      const connection = await Promise.race([
        connectionPromise.asPromise(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection creation timeout')), 
                     this.options.createTimeout)
        )
      ]);
      
      const connectionId = this.generateConnectionId();
      const connectionInfo = {
        id: connectionId,
        connection,
        created: Date.now(),
        lastUsed: Date.now(),
        active: false,
        acquireCount: 0
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
  async destroyConnection(connectionInfo) {
    if (!connectionInfo || !this.connections.has(connectionInfo.id)) {
      return;
    }
    
    try {
      await Promise.race([
        connectionInfo.connection.close(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection destroy timeout')), 
                     this.options.destroyTimeout)
        )
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
  getIdleConnection() {
    for (const [id, connection] of this.connections) {
      if (!connection.active && this.isConnectionValid(connection.connection)) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Activate a connection
   */
  activateConnection(connection) {
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
  deactivateConnection(connection) {
    connection.active = false;
    connection.lastUsed = Date.now();
    
    this.stats.activeConnections--;
    this.stats.idleConnections++;
  }

  /**
   * Check if connection is valid
   */
  isConnectionValid(connection) {
    try {
      return connection.readyState === 1; // 1 = connected
    } catch (error) {
      return false;
    }
  }

  /**
   * Set up connection event handlers
   */
  setupConnectionHandlers(connectionInfo) {
    const connection = connectionInfo.connection;
    
    connection.on('error', (error) => {
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
  startReaping() {
    this.reapTimer = setInterval(() => {
      this.reapIdleConnections();
    }, this.options.reapInterval);
  }

  /**
   * Reap idle connections
   */
  reapIdleConnections() {
    if (this.isShuttingDown) {
      return;
    }
    
    const now = Date.now();
    const minConnections = this.options.minConnections;
    const connectionsToReap = [];
    
    for (const [id, connection] of this.connections) {
      if (!connection.active && 
          this.stats.totalConnections > minConnections &&
          (now - connection.lastUsed) > this.options.maxIdleTime) {
        connectionsToReap.push(connection);
      }
    }
    
    // Reap connections
    connectionsToReap.forEach(connection => {
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
  stopReaping() {
    if (this.reapTimer) {
      clearInterval(this.reapTimer);
      this.reapTimer = null;
    }
  }

  /**
   * Generate unique connection ID
   */
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update acquire time statistics
   */
  updateAcquireTime(startTime) {
    const acquireTime = Date.now() - startTime;
    const totalAcquires = this.stats.totalAcquires;
    
    // Calculate rolling average
    this.stats.avgAcquireTime = 
      ((this.stats.avgAcquireTime * (totalAcquires - 1)) + acquireTime) / totalAcquires;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      waitingQueueLength: this.waitingQueue.length,
      utilizationRate: this.stats.totalConnections > 0 ? 
        (this.stats.activeConnections / this.stats.totalConnections) : 0,
      options: this.options
    };
  }

  /**
   * Get detailed connection information
   */
  getConnectionDetails() {
    const connections = [];
    
    for (const [id, connection] of this.connections) {
      connections.push({
        id: connection.id,
        active: connection.active,
        created: connection.created,
        lastUsed: connection.lastUsed,
        acquireCount: connection.acquireCount,
        readyState: connection.connection.readyState,
        host: connection.connection.host,
        port: connection.connection.port
      });
    }
    
    return connections;
  }

  /**
   * Health check for the pool
   */
  async healthCheck() {
    try {
      const stats = this.getStats();
      const issues = [];
      
      // Check for high waiting queue
      if (stats.waitingQueueLength > 10) {
        issues.push('High waiting queue length');
      }
      
      // Check for low connection availability
      if (stats.utilizationRate > 0.9) {
        issues.push('High connection utilization');
      }
      
      // Check for high error rate
      const errorRate = stats.totalAcquires > 0 ? stats.totalErrors / stats.totalAcquires : 0;
      if (errorRate > 0.05) {
        issues.push('High error rate');
      }
      
      // Check for slow acquire times
      if (stats.avgAcquireTime > 1000) {
        issues.push('Slow connection acquire times');
      }
      
      return {
        healthy: issues.length === 0,
        issues,
        stats
      };
      
    } catch (error) {
      return {
        healthy: false,
        issues: ['Health check failed'],
        error: error.message
      };
    }
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    this.stopReaping();
    
    console.log('Shutting down connection pool...');
    this.emit('shutdownStarted');
    
    // Reject all waiting requests
    this.waitingQueue.forEach(waiter => {
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

module.exports = ConnectionPool;
