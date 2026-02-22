import { WinstonLogger } from '../utils/logger';
import * as os from 'os';
import * as fs from 'fs';

interface SystemMetrics {
  cpu: {
    usage: number;
    count: number;
    load: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    interfaces: Record<string, {
      rx_bytes: number;
      tx_bytes: number;
      rx_packets: number;
      tx_packets: number;
    }>;
  };
  uptime: number;
  timestamp: number;
}

interface ApplicationMetrics {
  http: {
    requests: {
      total: number;
      rate: number;
      byMethod: Record<string, number>;
      byStatus: Record<string, number>;
    };
    responseTime: {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };
  database: {
    connections: number;
    queries: {
      total: number;
      rate: number;
      avgTime: number;
    };
  };
  blockchain: {
    transactions: {
      total: number;
      success: number;
      failure: number;
      rate: number;
    };
    contracts: {
      invocations: number;
      errors: number;
      gasUsed: number;
    };
  };
  proof: {
    issued: number;
    verified: {
      total: number;
      success: number;
      failure: number;
    };
  };
}

export class MonitoringService {
  private logger: WinstonLogger;
  private metrics: {
    system: SystemMetrics;
    application: ApplicationMetrics;
  };
  private metricsInterval: NodeJS.Timeout | null = null;
  private startTime: number;

  constructor() {
    this.logger = new WinstonLogger();
    this.startTime = Date.now();
    this.metrics = {
      system: this.getDefaultSystemMetrics(),
      application: this.getDefaultApplicationMetrics()
    };
    
    this.startMetricsCollection();
  }

  private getDefaultSystemMetrics(): SystemMetrics {
    return {
      cpu: {
        usage: 0,
        count: os.cpus().length,
        load: [0, 0, 0]
      },
      memory: {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      },
      disk: {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      },
      network: {
        interfaces: {}
      },
      uptime: 0,
      timestamp: Date.now()
    };
  }

  private getDefaultApplicationMetrics(): ApplicationMetrics {
    return {
      http: {
        requests: {
          total: 0,
          rate: 0,
          byMethod: {},
          byStatus: {}
        },
        responseTime: {
          avg: 0,
          p50: 0,
          p95: 0,
          p99: 0
        }
      },
      database: {
        connections: 0,
        queries: {
          total: 0,
          rate: 0,
          avgTime: 0
        }
      },
      blockchain: {
        transactions: {
          total: 0,
          success: 0,
          failure: 0,
          rate: 0
        },
        contracts: {
          invocations: 0,
          errors: 0,
          gasUsed: 0
        }
      },
      proof: {
        issued: 0,
        verified: {
          total: 0,
          success: 0,
          failure: 0
        }
      }
    };
  }

  private startMetricsCollection(): void {
    // Collect system metrics every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);
    
    this.logger.info('Monitoring service started');
  }

  private collectSystemMetrics(): void {
    try {
      // CPU metrics
      const cpus = os.cpus();
      const idle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
      const total = cpus.reduce((acc, cpu) => {
        return acc + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
      }, 0);
      this.metrics.system.cpu.usage = 100 - (idle / total) * 100;
      this.metrics.system.cpu.count = cpus.length;
      this.metrics.system.cpu.load = os.loadavg();

      // Memory metrics
      const memInfo = this.getMemoryInfo();
      this.metrics.system.memory = memInfo;

      // Disk metrics
      const diskInfo = this.getDiskInfo();
      this.metrics.system.disk = diskInfo;

      // Network metrics
      this.metrics.system.network = this.getNetworkInfo();

      // Uptime
      this.metrics.system.uptime = os.uptime();
      this.metrics.system.timestamp = Date.now();

      // Application metrics collection
      this.collectApplicationMetrics();

    } catch (error) {
      this.logger.error('Error collecting system metrics', error);
    }
  }

  private getMemoryInfo(): SystemMetrics['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    
    return {
      total,
      used,
      free,
      usage: (used / total) * 100
    };
  }

  private getDiskInfo(): SystemMetrics['disk'] {
    try {
      const fs = require('fs');
      const path = require('path');
      const diskInfo = fs.statSync(path.parse(process.cwd()).root);
      
      const total = diskInfo.size;
      const free = diskInfo.blocks * diskInfo.bsize;
      const used = total - free;
      
      return {
        total,
        used,
        free,
        usage: total > 0 ? (used / total) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Error getting disk info', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      };
    }
  }

  private getNetworkInfo(): SystemMetrics['network'] {
    try {
      // This is a simplified implementation
      // In production, you'd use a proper network monitoring library
      const interfaces = os.networkInterfaces();
      const result: Record<string, any> = {};
      
      Object.keys(interfaces).forEach(name => {
        const iface = interfaces[name];
        if (iface && iface.length > 0) {
          const first = iface[0];
          result[name] = {
            rx_bytes: 0, // Would need actual network monitoring
            tx_bytes: 0,
            rx_packets: 0,
            tx_packets: 0
          };
        }
      });
      
      return { interfaces: result };
    } catch (error) {
      this.logger.error('Error getting network info', error);
      return { interfaces: {} };
    }
  }

  private collectApplicationMetrics(): void {
    // This would be implemented to collect actual application metrics
    // For now, we'll update timestamp
    this.metrics.application.http.requests.total++;
    this.metrics.application.http.requests.rate = this.calculateRate(
      this.metrics.application.http.requests.total
    );
  }

  private calculateRate(total: number): number {
    const elapsed = (Date.now() - this.startTime) / 1000; // seconds
    return elapsed > 0 ? total / elapsed : 0;
  }

  // Public methods for updating metrics
  public incrementHttpRequest(method: string, status: string): void {
    this.metrics.application.http.requests.total++;
    this.metrics.application.http.requests.byMethod[method] = 
      (this.metrics.application.http.requests.byMethod[method] || 0) + 1;
    this.metrics.application.http.requests.byStatus[status] = 
      (this.metrics.application.http.requests.byStatus[status] || 0) + 1;
  }

  public recordResponseTime(duration: number): void {
    // This would be implemented with proper statistics
    this.metrics.application.http.responseTime.avg = 
      (this.metrics.application.http.responseTime.avg + duration) / 2;
  }

  public incrementDatabaseQuery(): void {
    this.metrics.application.database.queries.total++;
    this.metrics.application.database.queries.rate = this.calculateRate(
      this.metrics.application.database.queries.total
    );
  }

  public incrementBlockchainTransaction(success: boolean): void {
    this.metrics.application.blockchain.transactions.total++;
    if (success) {
      this.metrics.application.blockchain.transactions.success++;
    } else {
      this.metrics.application.blockchain.transactions.failure++;
    }
    this.metrics.application.blockchain.transactions.rate = this.calculateRate(
      this.metrics.application.blockchain.transactions.total
    );
  }

  public incrementContractInvocation(error: boolean = false): void {
    this.metrics.application.blockchain.contracts.invocations++;
    if (error) {
      this.metrics.application.blockchain.contracts.errors++;
    }
  }

  public incrementProofIssued(): void {
    this.metrics.application.proof.issued++;
  }

  public incrementProofVerification(success: boolean): void {
    this.metrics.application.proof.verified.total++;
    if (success) {
      this.metrics.application.proof.verified.success++;
    } else {
      this.metrics.application.proof.verified.failure++;
    }
  }

  public getSystemMetrics(): SystemMetrics {
    return { ...this.metrics.system };
  }

  public getApplicationMetrics(): ApplicationMetrics {
    return { ...this.metrics.application };
  }

  public getMetrics(): { system: SystemMetrics; application: ApplicationMetrics } {
    return {
      system: this.getSystemMetrics(),
      application: this.getApplicationMetrics()
    };
  }

  public getPrometheusMetrics(): string {
    const metrics = [];
    const now = Date.now();
    
    // System metrics
    const system = this.metrics.system;
    metrics.push(`# HELP system_cpu_usage Current CPU usage percentage`);
    metrics.push(`# TYPE system_cpu_usage gauge`);
    metrics.push(`system_cpu_usage ${system.cpu.usage.toFixed(2)} ${now}`);
    
    metrics.push(`# HELP system_memory_usage Current memory usage percentage`);
    metrics.push(`# TYPE system_memory_usage gauge`);
    metrics.push(`system_memory_usage ${system.memory.usage.toFixed(2)} ${now}`);
    
    metrics.push(`# HELP system_disk_usage Current disk usage percentage`);
    metrics.push(`# TYPE system_disk_usage gauge`);
    metrics.push(`system_disk_usage ${system.disk.usage.toFixed(2)} ${now}`);
    
    // Application metrics
    const app = this.metrics.application;
    metrics.push(`# HELP http_requests_total Total HTTP requests`);
    metrics.push(`# TYPE http_requests_total counter`);
    metrics.push(`http_requests_total ${app.http.requests.total} ${now}`);
    
    metrics.push(`# HELP http_request_rate Requests per second`);
    metrics.push(`# TYPE http_request_rate gauge`);
    metrics.push(`http_request_rate ${app.http.requests.rate.toFixed(2)} ${now}`);
    
    metrics.push(`# HELP proof_issued_total Total proofs issued`);
    metrics.push(`# TYPE proof_issued_total counter`);
    metrics.push(`proof_issued_total ${app.proof.issued} ${now}`);
    
    metrics.push(`# HELP proof_verification_total Total proof verifications`);
    metrics.push(`# TYPE proof_verification_total counter`);
    metrics.push(`proof_verification_total ${app.proof.verified.total} ${now}`);
    
    return metrics.join('\n');
  }

  public shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.logger.info('Monitoring service shut down');
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();