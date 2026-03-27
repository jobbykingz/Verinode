import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../redisService';
import { MonitoringService } from '../monitoringService';
import { ContractEventService } from './ContractEventService';
import { IContractEvent } from '../../models/ContractEvent';
import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import * as http from 'http';

export interface StreamConfig {
  enableWebSocket: boolean;
  enableServerSentEvents: boolean;
  enableRedisPubSub: boolean;
  maxConnections: number;
  heartbeatInterval: number;
  bufferSize: number;
  compressionEnabled: boolean;
  authenticationRequired: boolean;
}

export interface ClientConnection {
  id: string;
  clientId: string;
  socket?: WebSocket;
  response?: http.ServerResponse;
  filters: StreamFilters;
  isActive: boolean;
  connectedAt: Date;
  lastActivity: Date;
  eventsSent: number;
  bytesTransferred: number;
  subscriptionType: SubscriptionType;
}

export interface StreamFilters {
  eventTypes?: string[];
  addresses?: string[];
  topics?: string[];
  fromBlock?: number;
  toBlock?: number;
  fromTime?: number;
  toTime?: number;
  dataFilters?: Record<string, any>;
}

export enum SubscriptionType {
  WEBSOCKET = 'websocket',
  SSE = 'sse',
  REDIS = 'redis',
}

export interface StreamMessage {
  type: MessageType;
  data: any;
  timestamp: number;
  messageId: string;
  clientId?: string;
}

export enum MessageType {
  EVENT = 'event',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
  SUBSCRIPTION_CONFIRMED = 'subscription_confirmed',
  DISCONNECT = 'disconnect',
  STATS = 'stats',
}

export interface StreamStats {
  totalConnections: number;
  activeConnections: number;
  totalEventsStreamed: number;
  eventsPerSecond: number;
  averageLatency: number;
  bytesTransferred: number;
  connectionsByType: Record<SubscriptionType, number>;
  errorRate: number;
}

@Injectable()
export class EventStreamingService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventStreamingService.name);
  private readonly config: StreamConfig;
  private connections: Map<string, ClientConnection> = new Map();
  private websocketServer?: WebSocket.Server;
  private httpServer?: http.Server;
  private redisSubscriber?: any;
  private stats: StreamStats;
  private heartbeatInterval?: NodeJS.Timeout;
  private eventBuffer: IContractEvent[] = [];
  private bufferFlushInterval?: NodeJS.Timeout;

  constructor(
    private redisService: RedisService,
    private monitoringService: MonitoringService,
    private eventService: ContractEventService,
  ) {
    super();
    
    this.config = {
      enableWebSocket: true,
      enableServerSentEvents: true,
      enableRedisPubSub: true,
      maxConnections: 1000,
      heartbeatInterval: 30000, // 30 seconds
      bufferSize: 1000,
      compressionEnabled: true,
      authenticationRequired: false,
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      totalEventsStreamed: 0,
      eventsPerSecond: 0,
      averageLatency: 0,
      bytesTransferred: 0,
      connectionsByType: {
        [SubscriptionType.WEBSOCKET]: 0,
        [SubscriptionType.SSE]: 0,
        [SubscriptionType.REDIS]: 0,
      },
      errorRate: 0,
    };
  }

  async onModuleInit() {
    this.logger.log('Initializing Event Streaming Service');
    
    // Setup WebSocket server
    if (this.config.enableWebSocket) {
      await this.setupWebSocketServer();
    }
    
    // Setup Redis pub/sub
    if (this.config.enableRedisPubSub) {
      await this.setupRedisPubSub();
    }
    
    // Subscribe to contract events
    this.setupEventSubscription();
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Start buffer flushing
    this.startBufferFlushing();
    
    this.logger.log('Event Streaming Service initialized successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Event Streaming Service');
    
    // Close all connections
    await this.closeAllConnections();
    
    // Close WebSocket server
    if (this.websocketServer) {
      this.websocketServer.close();
    }
    
    // Close Redis subscriber
    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
    }
    
    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }
    
    this.logger.log('Event Streaming Service shut down successfully');
  }

  /**
   * Create WebSocket connection
   */
  createWebSocketConnection(ws: WebSocket, clientId: string, filters: StreamFilters): ClientConnection {
    const connectionId = this.generateConnectionId();
    
    const connection: ClientConnection = {
      id: connectionId,
      clientId,
      socket: ws,
      filters,
      isActive: true,
      connectedAt: new Date(),
      lastActivity: new Date(),
      eventsSent: 0,
      bytesTransferred: 0,
      subscriptionType: SubscriptionType.WEBSOCKET,
    };
    
    // Setup WebSocket handlers
    ws.on('message', (data) => this.handleWebSocketMessage(connection, data));
    ws.on('close', () => this.handleConnectionClose(connection));
    ws.on('error', (error) => this.handleConnectionError(connection, error));
    ws.on('pong', () => this.handleWebSocketPong(connection));
    
    // Store connection
    this.connections.set(connectionId, connection);
    this.updateConnectionStats();
    
    // Send subscription confirmation
    this.sendMessage(connection, {
      type: MessageType.SUBSCRIPTION_CONFIRMED,
      data: { connectionId, filters },
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    });
    
    this.logger.log(`WebSocket connection established: ${connectionId} for client: ${clientId}`);
    
    return connection;
  }

  /**
   * Create Server-Sent Events connection
   */
  createSSEConnection(response: http.ServerResponse, clientId: string, filters: StreamFilters): ClientConnection {
    const connectionId = this.generateConnectionId();
    
    // Setup SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });
    
    const connection: ClientConnection = {
      id: connectionId,
      clientId,
      response,
      filters,
      isActive: true,
      connectedAt: new Date(),
      lastActivity: new Date(),
      eventsSent: 0,
      bytesTransferred: 0,
      subscriptionType: SubscriptionType.SSE,
    };
    
    // Handle connection close
    response.on('close', () => this.handleConnectionClose(connection));
    
    // Store connection
    this.connections.set(connectionId, connection);
    this.updateConnectionStats();
    
    // Send subscription confirmation
    this.sendSSEMessage(connection, {
      type: MessageType.SUBSCRIPTION_CONFIRMED,
      data: { connectionId, filters },
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    });
    
    this.logger.log(`SSE connection established: ${connectionId} for client: ${clientId}`);
    
    return connection;
  }

  /**
   * Broadcast event to all matching connections
   */
  async broadcastEvent(event: IContractEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Add to buffer for batch processing
      this.eventBuffer.push(event);
      
      // If buffer is full, flush immediately
      if (this.eventBuffer.length >= this.config.bufferSize) {
        await this.flushEventBuffer();
      }
      
      // Update stats
      this.stats.totalEventsStreamed++;
      
    } catch (error) {
      this.logger.error('Failed to broadcast event:', error);
      this.stats.errorRate = (this.stats.errorRate + 1) / 2;
    } finally {
      const latency = Date.now() - startTime;
      this.updateLatencyStats(latency);
    }
  }

  /**
   * Send message to specific connection
   */
  private sendMessage(connection: ClientConnection, message: StreamMessage): void {
    try {
      const messageData = JSON.stringify(message);
      const messageSize = Buffer.byteLength(messageData);
      
      if (connection.subscriptionType === SubscriptionType.WEBSOCKET && connection.socket) {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(messageData);
          connection.eventsSent++;
          connection.bytesTransferred += messageSize;
          connection.lastActivity = new Date();
          this.stats.bytesTransferred += messageSize;
        }
      } else if (connection.subscriptionType === SubscriptionType.SSE && connection.response) {
        this.sendSSEMessage(connection, message);
      }
      
    } catch (error) {
      this.logger.error(`Failed to send message to connection ${connection.id}:`, error);
      this.handleConnectionError(connection, error);
    }
  }

  /**
   * Send SSE message
   */
  private sendSSEMessage(connection: ClientConnection, message: StreamMessage): void {
    if (!connection.response) return;
    
    try {
      const messageData = JSON.stringify(message);
      const messageSize = Buffer.byteLength(messageData);
      
      connection.response.write(`id: ${message.messageId}\n`);
      connection.response.write(`event: ${message.type}\n`);
      connection.response.write(`data: ${messageData}\n\n`);
      
      connection.eventsSent++;
      connection.bytesTransferred += messageSize;
      connection.lastActivity = new Date();
      this.stats.bytesTransferred += messageSize;
      
    } catch (error) {
      this.logger.error(`Failed to send SSE message to connection ${connection.id}:`, error);
      this.handleConnectionError(connection, error);
    }
  }

  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(connection: ClientConnection, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'update_filters':
          connection.filters = { ...connection.filters, ...message.filters };
          break;
        case 'ping':
          if (connection.socket) {
            connection.socket.pong();
          }
          break;
        case 'disconnect':
          this.handleConnectionClose(connection);
          break;
        default:
          this.logger.warn(`Unknown message type: ${message.type}`);
      }
      
      connection.lastActivity = new Date();
      
    } catch (error) {
      this.logger.error(`Failed to handle WebSocket message:`, error);
    }
  }

  /**
   * Handle connection close
   */
  private handleConnectionClose(connection: ClientConnection): void {
    connection.isActive = false;
    
    if (connection.socket) {
      connection.socket.close();
    }
    
    if (connection.response) {
      connection.response.end();
    }
    
    this.connections.delete(connection.id);
    this.updateConnectionStats();
    
    this.logger.log(`Connection closed: ${connection.id}`);
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(connection: ClientConnection, error: any): void {
    this.logger.error(`Connection error for ${connection.id}:`, error);
    
    // Send error message if possible
    this.sendMessage(connection, {
      type: MessageType.ERROR,
      data: { error: error.message },
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    });
    
    // Close connection
    this.handleConnectionClose(connection);
  }

  /**
   * Handle WebSocket pong
   */
  private handleWebSocketPong(connection: ClientConnection): void {
    connection.lastActivity = new Date();
  }

  /**
   * Setup WebSocket server
   */
  private async setupWebSocketServer(): Promise<void> {
    this.websocketServer = new WebSocket.Server({
      maxConnections: this.config.maxConnections,
      perMessageDeflate: this.config.compressionEnabled,
    });
    
    this.websocketServer.on('connection', (ws: WebSocket, request) => {
      // Extract client ID and filters from query parameters
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const clientId = url.searchParams.get('clientId') || 'anonymous';
      const filtersParam = url.searchParams.get('filters');
      const filters = filtersParam ? JSON.parse(filtersParam) : {};
      
      // Create connection
      this.createWebSocketConnection(ws, clientId, filters);
    });
    
    this.websocketServer.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
    });
    
    this.logger.log('WebSocket server setup completed');
  }

  /**
   * Setup Redis pub/sub
   */
  private async setupRedisPubSub(): Promise<void> {
    try {
      this.redisSubscriber = this.redisService.createSubscriber();
      
      await this.redisSubscriber.subscribe('contract_events');
      
      this.redisSubscriber.on('message', (channel: string, message: string) => {
        if (channel === 'contract_events') {
          const event = JSON.parse(message) as IContractEvent;
          this.broadcastEvent(event);
        }
      });
      
      this.logger.log('Redis pub/sub setup completed');
      
    } catch (error) {
      this.logger.error('Failed to setup Redis pub/sub:', error);
    }
  }

  /**
   * Setup event subscription
   */
  private setupEventSubscription(): void {
    this.eventService.on('newEvent', (event: IContractEvent) => {
      this.broadcastEvent(event);
    });
    
    this.eventService.on('eventProcessed', (event: IContractEvent) => {
      this.broadcastEvent(event);
    });
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      this.cleanupInactiveConnections();
    }, this.config.heartbeatInterval);
  }

  /**
   * Send heartbeat to all connections
   */
  private sendHeartbeat(): void {
    const heartbeatMessage: StreamMessage = {
      type: MessageType.HEARTBEAT,
      data: { timestamp: Date.now() },
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };
    
    for (const connection of this.connections.values()) {
      if (connection.isActive) {
        this.sendMessage(connection, heartbeatMessage);
      }
    }
  }

  /**
   * Cleanup inactive connections
   */
  private cleanupInactiveConnections(): void {
    const now = Date.now();
    const timeout = this.config.heartbeatInterval * 2; // 2x heartbeat interval
    
    for (const connection of this.connections.values()) {
      if (now - connection.lastActivity.getTime() > timeout) {
        this.logger.warn(`Cleaning up inactive connection: ${connection.id}`);
        this.handleConnectionClose(connection);
      }
    }
  }

  /**
   * Start buffer flushing
   */
  private startBufferFlushing(): void {
    this.bufferFlushInterval = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flushEventBuffer();
      }
    }, 1000); // Flush every second
  }

  /**
   * Flush event buffer
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;
    
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    
    // Process events in parallel
    await Promise.allSettled(
      events.map(event => this.processBufferedEvent(event))
    );
  }

  /**
   * Process buffered event
   */
  private async processBufferedEvent(event: IContractEvent): Promise<void> {
    for (const connection of this.connections.values()) {
      if (!connection.isActive) continue;
      
      // Check if event matches connection filters
      if (this.eventMatchesFilters(event, connection.filters)) {
        this.sendMessage(connection, {
          type: MessageType.EVENT,
          data: event,
          timestamp: Date.now(),
          messageId: this.generateMessageId(),
        });
      }
    }
  }

  /**
   * Check if event matches filters
   */
  private eventMatchesFilters(event: IContractEvent, filters: StreamFilters): boolean {
    // Check event type
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      if (!filters.eventTypes.includes(event.eventType)) {
        return false;
      }
    }
    
    // Check address
    if (filters.addresses && filters.addresses.length > 0) {
      if (!filters.addresses.includes(event.emitter)) {
        return false;
      }
    }
    
    // Check topics
    if (filters.topics && filters.topics.length > 0) {
      const hasMatchingTopic = filters.topics.some(topic => 
        event.topics && event.topics.includes(topic)
      );
      if (!hasMatchingTopic) {
        return false;
      }
    }
    
    // Check block range
    if (filters.fromBlock !== undefined || filters.toBlock !== undefined) {
      const block = event.blockNumber || 0;
      if (filters.fromBlock !== undefined && block < filters.fromBlock) {
        return false;
      }
      if (filters.toBlock !== undefined && block > filters.toBlock) {
        return false;
      }
    }
    
    // Check time range
    if (filters.fromTime !== undefined || filters.toTime !== undefined) {
      const time = event.timestamp.getTime();
      if (filters.fromTime !== undefined && time < filters.fromTime) {
        return false;
      }
      if (filters.toTime !== undefined && time > filters.toTime) {
        return false;
      }
    }
    
    // Check data filters
    if (filters.dataFilters) {
      for (const [key, value] of Object.entries(filters.dataFilters)) {
        const eventValue = (event.data as any)?.[key];
        if (eventValue !== value) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Close all connections
   */
  private async closeAllConnections(): Promise<void> {
    for (const connection of this.connections.values()) {
      this.handleConnectionClose(connection);
    }
  }

  /**
   * Update connection statistics
   */
  private updateConnectionStats(): void {
    this.stats.totalConnections = this.connections.size;
    this.stats.activeConnections = Array.from(this.connections.values())
      .filter(c => c.isActive).length;
    
    // Update connections by type
    this.stats.connectionsByType = {
      [SubscriptionType.WEBSOCKET]: 0,
      [SubscriptionType.SSE]: 0,
      [SubscriptionType.REDIS]: 0,
    };
    
    for (const connection of this.connections.values()) {
      this.stats.connectionsByType[connection.subscriptionType]++;
    }
  }

  /**
   * Update latency statistics
   */
  private updateLatencyStats(latency: number): void {
    this.stats.averageLatency = (this.stats.averageLatency + latency) / 2;
  }

  /**
   * Get streaming statistics
   */
  getStats(): StreamStats {
    return { ...this.stats };
  }

  /**
   * Get active connections
   */
  getActiveConnections(): ClientConnection[] {
    return Array.from(this.connections.values()).filter(c => c.isActive);
  }

  /**
   * Generate connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
