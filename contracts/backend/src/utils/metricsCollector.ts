import { WinstonLogger } from '../utils/logger';
import { monitoringService } from '../services/monitoringService';
import * as promClient from 'prom-client';

export class MetricsCollector {
  private logger: WinstonLogger;
  private register: promClient.Registry;
  
  // Metric instances
  private httpRequestDuration?: promClient.Histogram;
  private httpRequestTotal?: promClient.Counter;
  private httpRequestInFlight?: promClient.Gauge;
  private dbQueryDuration?: promClient.Histogram;
  private dbConnections?: promClient.Gauge;
  private blockchainTxDuration?: promClient.Histogram;
  private blockchainTxTotal?: promClient.Counter;
  private contractInvocations?: promClient.Counter;
  private proofIssuance?: promClient.Counter;
  private proofVerification?: promClient.Counter;
  private proofVerificationDuration?: promClient.Histogram;
  private userActivity?: promClient.Counter;
  private activeUsers?: promClient.Gauge;
  private processMemory?: promClient.Gauge;
  private processCPU?: promClient.Gauge;

  constructor() {
    this.logger = new WinstonLogger();
    this.register = new promClient.Registry();
    this.setupMetrics();
  }

  private setupMetrics(): void {
    // HTTP request metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.register]
    });

    this.httpRequestTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    this.httpRequestInFlight = new promClient.Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently in flight',
      registers: [this.register]
    });

    // Database metrics
    this.dbQueryDuration = new promClient.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'collection'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [this.register]
    });

    this.dbConnections = new promClient.Gauge({
      name: 'db_connections',
      help: 'Number of active database connections',
      registers: [this.register]
    });

    // Blockchain metrics
    this.blockchainTxDuration = new promClient.Histogram({
      name: 'blockchain_transaction_duration_seconds',
      help: 'Duration of blockchain transactions in seconds',
      labelNames: ['type', 'success'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.register]
    });

    this.blockchainTxTotal = new promClient.Counter({
      name: 'blockchain_transactions_total',
      help: 'Total number of blockchain transactions',
      labelNames: ['type', 'success'],
      registers: [this.register]
    });

    this.contractInvocations = new promClient.Counter({
      name: 'contract_invocations_total',
      help: 'Total number of smart contract invocations',
      labelNames: ['contract_name', 'function', 'success'],
      registers: [this.register]
    });

    // Proof metrics
    this.proofIssuance = new promClient.Counter({
      name: 'proof_issuance_total',
      help: 'Total number of proofs issued',
      labelNames: ['type'],
      registers: [this.register]
    });

    this.proofVerification = new promClient.Counter({
      name: 'proof_verification_total',
      help: 'Total number of proof verifications',
      labelNames: ['type', 'success'],
      registers: [this.register]
    });

    this.proofVerificationDuration = new promClient.Histogram({
      name: 'proof_verification_duration_seconds',
      help: 'Duration of proof verification in seconds',
      labelNames: ['type', 'success'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.register]
    });

    // User activity metrics
    this.userActivity = new promClient.Counter({
      name: 'user_activity_events_total',
      help: 'Total number of user activity events',
      labelNames: ['event_type', 'user_type'],
      registers: [this.register]
    });

    this.activeUsers = new promClient.Gauge({
      name: 'active_users_count',
      help: 'Number of currently active users',
      registers: [this.register]
    });

    // System metrics
    this.processMemory = new promClient.Gauge({
      name: 'process_memory_bytes',
      help: 'Process memory usage in bytes',
      registers: [this.register]
    });

    this.processCPU = new promClient.Gauge({
      name: 'process_cpu_seconds_total',
      help: 'Total user and system CPU time spent in seconds',
      registers: [this.register]
    });

    this.logger.info('Metrics collector initialized');
  }

  // HTTP Metrics
  public recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    try {
      this.httpRequestDuration?.labels(method, route, statusCode.toString())
        .observe(duration / 1000); // Convert ms to seconds
      
      this.httpRequestTotal?.labels(method, route, statusCode.toString())
        .inc();
    } catch (error) {
      this.logger.error('Error recording HTTP request metrics', error);
    }
  }

  public incrementHttpRequestsInFlight(): void {
    try {
      this.httpRequestInFlight?.inc();
    } catch (error) {
      this.logger.error('Error incrementing HTTP requests in flight', error);
    }
  }

  public decrementHttpRequestsInFlight(): void {
    try {
      this.httpRequestInFlight?.dec();
    } catch (error) {
      this.logger.error('Error decrementing HTTP requests in flight', error);
    }
  }

  // Database Metrics
  public recordDatabaseQuery(operation: string, collection: string, duration: number): void {
    try {
      this.dbQueryDuration?.labels(operation, collection)
        .observe(duration / 1000);
    } catch (error) {
      this.logger.error('Error recording database query metrics', error);
    }
  }

  public setDatabaseConnections(count: number): void {
    try {
      this.dbConnections?.set(count);
    } catch (error) {
      this.logger.error('Error setting database connections metric', error);
    }
  }

  // Blockchain Metrics
  public recordBlockchainTransaction(type: string, success: boolean, duration: number): void {
    try {
      this.blockchainTxDuration?.labels(type, success.toString())
        .observe(duration / 1000);
      
      this.blockchainTxTotal?.labels(type, success.toString())
        .inc();
    } catch (error) {
      this.logger.error('Error recording blockchain transaction metrics', error);
    }
  }

  public recordContractInvocation(contractName: string, functionName: string, success: boolean): void {
    try {
      this.contractInvocations?.labels(contractName, functionName, success.toString())
        .inc();
    } catch (error) {
      this.logger.error('Error recording contract invocation metrics', error);
    }
  }

  // Proof Metrics
  public recordProofIssuance(type: string): void {
    try {
      this.proofIssuance?.labels(type)
        .inc();
    } catch (error) {
      this.logger.error('Error recording proof issuance metrics', error);
    }
  }

  public recordProofVerification(type: string, success: boolean, duration: number): void {
    try {
      this.proofVerification?.labels(type, success.toString())
        .inc();
      
      this.proofVerificationDuration?.labels(type, success.toString())
        .observe(duration / 1000);
    } catch (error) {
      this.logger.error('Error recording proof verification metrics', error);
    }
  }

  // User Activity Metrics
  public recordUserActivity(eventType: string, userType: string = 'regular'): void {
    try {
      this.userActivity?.labels(eventType, userType)
        .inc();
    } catch (error) {
      this.logger.error('Error recording user activity metrics', error);
    }
  }

  public setActiveUsers(count: number): void {
    try {
      this.activeUsers?.set(count);
    } catch (error) {
      this.logger.error('Error setting active users metric', error);
    }
  }

  // System Metrics
  public collectProcessMetrics(): void {
    try {
      const memoryUsage = process.memoryUsage();
      this.processMemory?.set(memoryUsage.rss);
      
      const cpuUsage = process.cpuUsage();
      this.processCPU?.set(
        (cpuUsage.user + cpuUsage.system) / 1000000
      );
    } catch (error) {
      this.logger.error('Error collecting process metrics', error);
    }
  }

  // Get metrics in Prometheus format
  public async getMetrics(): Promise<string> {
    try {
      // Collect process metrics
      this.collectProcessMetrics();
      
      // Get metrics from registry
      const metrics = await this.register.metrics();
      
      // Add custom metrics from monitoring service
      const customMetrics = monitoringService.getPrometheusMetrics();
      
      return metrics + '\n' + customMetrics;
    } catch (error) {
      this.logger.error('Error getting metrics', error);
      throw error;
    }
  }

  // Get metrics registry
  public getRegistry(): promClient.Registry {
    return this.register;
  }

  // Reset all metrics
  public resetMetrics(): void {
    try {
      this.register.resetMetrics();
      this.logger.info('Metrics reset');
    } catch (error) {
      this.logger.error('Error resetting metrics', error);
    }
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();