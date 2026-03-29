import { EventEmitter } from 'events';
import { cacheService } from './cacheService';

export interface RealTimeStats {
  timestamp: string;
  activeUsers: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  databaseConnections: number;
  cacheHitRate: number;
  activeProofs: number;
  queuedVerifications: number;
}

export interface StatsUpdate {
  metric: string;
  value: number;
  timestamp: string;
}

export class RealTimeStatsService extends EventEmitter {
  private stats: RealTimeStats;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 5000; // 5 seconds

  constructor() {
    super();
    this.stats = this.initializeStats();
  }

  async start(): Promise<void> {
    try {
      // Load initial stats from cache
      const cached = await cacheService.get<RealTimeStats>('realtime-stats');
      if (cached) {
        this.stats = cached;
      }

      // Start periodic updates
      this.updateInterval = setInterval(() => {
        this.updateStats();
      }, this.UPDATE_INTERVAL);

      console.log('Real-time stats service started');
    } catch (error) {
      console.error('Error starting real-time stats service:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('Real-time stats service stopped');
  }

  async getCurrentStats(): Promise<RealTimeStats> {
    return { ...this.stats };
  }

  async getHistoricalStats(minutes: number = 60): Promise<RealTimeStats[]> {
    try {
      const cacheKey = `historical-stats:${minutes}`;
      const cached = await cacheService.get<RealTimeStats[]>(cacheKey);
      
      if (cached) return cached;

      // Generate mock historical data
      const historical: RealTimeStats[] = [];
      const now = Date.now();
      
      for (let i = minutes - 1; i >= 0; i--) {
        const timestamp = new Date(now - i * 60000).toISOString();
        historical.push(this.generateMockStats(timestamp));
      }

      await cacheService.set(cacheKey, historical, { ttl: 300 }); // 5 minutes
      return historical;
    } catch (error) {
      console.error('Error fetching historical stats:', error);
      return [];
    }
  }

  async incrementMetric(metric: keyof RealTimeStats, value: number = 1): Promise<void> {
    if (typeof this.stats[metric] === 'number') {
      (this.stats[metric] as number) += value;
      await this.persistStats();
      this.emit('metricUpdated', { metric, value, timestamp: new Date().toISOString() });
    }
  }

  async setMetric(metric: keyof RealTimeStats, value: number): Promise<void> {
    if (typeof this.stats[metric] === 'number') {
      this.stats[metric] = value;
      await this.persistStats();
      this.emit('metricUpdated', { metric, value, timestamp: new Date().toISOString() });
    }
  }

  private async updateStats(): Promise<void> {
    try {
      const previousStats = { ...this.stats };
      
      // Update metrics with simulated real-time data
      this.stats = {
        ...this.stats,
        timestamp: new Date().toISOString(),
        activeUsers: Math.max(0, this.stats.activeUsers + (Math.random() - 0.5) * 10),
        requestsPerSecond: Math.max(0, Math.floor(Math.random() * 100) + 20),
        averageResponseTime: Math.max(50, Math.floor(Math.random() * 300) + 100),
        errorRate: Math.max(0, Math.random() * 5),
        cpuUsage: Math.max(0, Math.min(100, Math.random() * 80 + 10)),
        memoryUsage: Math.max(0, Math.min(100, Math.random() * 70 + 20)),
        diskUsage: Math.max(0, Math.min(100, Math.random() * 60 + 30)),
        networkIn: Math.max(0, Math.random() * 1000),
        networkOut: Math.max(0, Math.random() * 800),
        databaseConnections: Math.max(1, Math.floor(Math.random() * 20) + 5),
        cacheHitRate: Math.max(0, Math.min(100, Math.random() * 20 + 80)),
        activeProofs: Math.max(0, Math.floor(Math.random() * 50) + 10),
        queuedVerifications: Math.max(0, Math.floor(Math.random() * 10))
      };

      await this.persistStats();

      // Emit updates for significant changes
      this.checkAndEmitAlerts(previousStats, this.stats);
      
      this.emit('statsUpdated', this.stats);
    } catch (error) {
      console.error('Error updating real-time stats:', error);
    }
  }

  private async persistStats(): Promise<void> {
    try {
      await cacheService.set('realtime-stats', this.stats, { ttl: 60 }); // 1 minute
    } catch (error) {
      console.error('Error persisting real-time stats:', error);
    }
  }

  private checkAndEmitAlerts(previous: RealTimeStats, current: RealTimeStats): void {
    // Check for significant metric changes and emit alerts
    if (current.errorRate > 5 && previous.errorRate <= 5) {
      this.emit('alert', {
        type: 'high_error_rate',
        severity: 'high',
        message: `Error rate exceeded 5%: ${current.errorRate.toFixed(2)}%`,
        timestamp: current.timestamp
      });
    }

    if (current.averageResponseTime > 500 && previous.averageResponseTime <= 500) {
      this.emit('alert', {
        type: 'high_response_time',
        severity: 'medium',
        message: `Response time exceeded 500ms: ${current.averageResponseTime.toFixed(0)}ms`,
        timestamp: current.timestamp
      });
    }

    if (current.cacheHitRate < 70 && previous.cacheHitRate >= 70) {
      this.emit('alert', {
        type: 'low_cache_hit_rate',
        severity: 'medium',
        message: `Cache hit rate dropped below 70%: ${current.cacheHitRate.toFixed(1)}%`,
        timestamp: current.timestamp
      });
    }

    if (current.cpuUsage > 90 && previous.cpuUsage <= 90) {
      this.emit('alert', {
        type: 'high_cpu_usage',
        severity: 'high',
        message: `CPU usage exceeded 90%: ${current.cpuUsage.toFixed(1)}%`,
        timestamp: current.timestamp
      });
    }
  }

  private initializeStats(): RealTimeStats {
    return this.generateMockStats(new Date().toISOString());
  }

  private generateMockStats(timestamp: string): RealTimeStats {
    return {
      timestamp,
      activeUsers: Math.floor(Math.random() * 100) + 50,
      requestsPerSecond: Math.floor(Math.random() * 50) + 10,
      averageResponseTime: Math.floor(Math.random() * 200) + 100,
      errorRate: Math.random() * 5,
      cpuUsage: Math.random() * 80 + 10,
      memoryUsage: Math.random() * 70 + 20,
      diskUsage: Math.random() * 60 + 30,
      networkIn: Math.random() * 1000,
      networkOut: Math.random() * 800,
      databaseConnections: Math.floor(Math.random() * 20) + 5,
      cacheHitRate: Math.random() * 20 + 80,
      activeProofs: Math.floor(Math.random() * 50) + 10,
      queuedVerifications: Math.floor(Math.random() * 10)
    };
  }

  // WebSocket integration for real-time updates
  async subscribeToUpdates(socket: any): Promise<void> {
    const statsHandler = (stats: RealTimeStats) => {
      socket.emit('statsUpdate', stats);
    };

    const alertHandler = (alert: any) => {
      socket.emit('alert', alert);
    };

    this.on('statsUpdated', statsHandler);
    this.on('alert', alertHandler);

    socket.on('disconnect', () => {
      this.off('statsUpdated', statsHandler);
      this.off('alert', alertHandler);
    });

    // Send current stats immediately
    socket.emit('statsUpdate', this.stats);
  }
}

export const realTimeStats = new RealTimeStatsService();
