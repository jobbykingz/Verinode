import { Request, Response } from 'express';
import { AdvancedGateway, APIEndpoint, GatewayConfig, GatewayMetrics } from '../gateway/AdvancedGateway';
import { RequestTransformer, TransformationRule } from '../gateway/RequestTransformer';
import { ResponseAggregator, AggregationRequest } from '../gateway/ResponseAggregator';
import { APIComposer, CompositionWorkflow } from '../gateway/APIComposer';
import { RateLimiter, RateLimitRule } from '../gateway/RateLimiter';
import { SecurityFilter, SecurityRule } from '../gateway/SecurityFilter';
import { logger } from '../utils/logger';
import { monitoringService } from '../services/monitoringService';
import { redisService } from '../services/redisService';

export interface GatewayServiceConfig {
  gateway: GatewayConfig;
  transformation: {
    enable: boolean;
    rules: TransformationRule[];
  };
  aggregation: {
    enable: boolean;
    maxConcurrentRequests: number;
    timeout: number;
    retryAttempts: number;
  };
  composition: {
    enable: boolean;
    maxConcurrentRequests: number;
    timeout: number;
    retryAttempts: number;
  };
  rateLimit: {
    enable: boolean;
    rules: RateLimitRule[];
  };
  security: {
    enable: boolean;
    rules: SecurityRule[];
  };
  monitoring: {
    enable: boolean;
    metricsInterval: number;
    alertThresholds: {
      errorRate: number;
      responseTime: number;
      throughput: number;
    };
  };
  documentation: {
    enable: boolean;
    autoGenerate: boolean;
    includeExamples: boolean;
  };
  developerPortal: {
    enable: boolean;
    apiKeyManagement: boolean;
    analytics: boolean;
    testing: boolean;
  };
}

export interface ServiceMetrics {
  gateway: GatewayMetrics;
  transformation: {
    totalTransformations: number;
    successfulTransformations: number;
    failedTransformations: number;
    averageTransformationTime: number;
  };
  aggregation: {
    totalAggregations: number;
    successfulAggregations: number;
    failedAggregations: number;
    averageAggregationTime: number;
    activeAggregations: number;
  };
  composition: {
    totalCompositions: number;
    successfulCompositions: number;
    failedCompositions: number;
    averageCompositionTime: number;
    activeCompositions: number;
  };
  rateLimit: {
    totalRequests: number;
    allowedRequests: number;
    blockedRequests: number;
    violationsByRule: Record<string, number>;
    averageResponseTime: number;
  };
  security: {
    totalRequests: number;
    blockedRequests: number;
    violationsByType: Record<string, number>;
    averageRiskScore: number;
    criticalViolations: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    cacheHitRate: number;
  };
}

export interface APIRegistry {
  endpoints: APIEndpoint[];
  workflows: CompositionWorkflow[];
  transformationRules: TransformationRule[];
  rateLimitRules: RateLimitRule[];
  securityRules: SecurityRule[];
  lastUpdated: number;
  version: string;
}

export class GatewayService {
  private config: GatewayServiceConfig;
  private gateway: AdvancedGateway;
  private transformer: RequestTransformer;
  private aggregator: ResponseAggregator;
  private composer: APIComposer;
  private rateLimiter: RateLimiter;
  private securityFilter: SecurityFilter;
  private registry: APIRegistry;
  private metrics: ServiceMetrics;
  private startTime: number;
  private metricsInterval: NodeJS.Timeout;

  constructor(config: Partial<GatewayServiceConfig> = {}) {
    this.config = this.initializeConfig(config);
    this.startTime = Date.now();
    
    // Initialize components
    this.gateway = new AdvancedGateway(this.config.gateway);
    this.transformer = new RequestTransformer(this.config.transformation);
    this.aggregator = new ResponseAggregator({
      maxConcurrentRequests: this.config.aggregation.maxConcurrentRequests,
      timeout: this.config.aggregation.timeout,
      retryAttempts: this.config.aggregation.retryAttempts,
    });
    this.composer = new APIComposer({
      maxConcurrentRequests: this.config.composition.maxConcurrentRequests,
      timeout: this.config.composition.timeout,
      retryAttempts: this.config.composition.retryAttempts,
    });
    this.rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 1000,
      enableRedis: true,
    });
    this.securityFilter = new SecurityFilter({
      enableXSS: true,
      enableSQLInjection: true,
      enableCSRF: true,
      enableInputValidation: true,
    });

    this.initializeRegistry();
    this.initializeMetrics();
    this.startMetricsCollection();
  }

  private initializeConfig(userConfig: Partial<GatewayServiceConfig>): GatewayServiceConfig {
    return {
      gateway: {
        version: '1.0.0',
        enableTransformation: true,
        enableAggregation: true,
        enableComposition: true,
        enableRateLimiting: true,
        enableSecurityFilter: true,
        enableCaching: true,
        enableMonitoring: true,
        rateLimit: {
          windowMs: 60000,
          maxRequests: 1000,
          skipSuccessfulRequests: false,
          skipFailedRequests: false,
        },
        cache: {
          ttl: 300000,
          maxSize: 10000,
          strategy: 'LRU',
        },
        security: {
          enableXSS: true,
          enableSQLInjection: true,
          enableCSRF: true,
          enableInputValidation: true,
          maxRequestSize: 10485760,
        },
        transformation: {
          enableRequestTransformation: true,
          enableResponseTransformation: true,
          defaultFormat: 'json',
        },
        composition: {
          maxConcurrentRequests: 10,
          timeout: 30000,
          retryAttempts: 3,
        },
      },
      transformation: {
        enable: true,
        rules: [],
      },
      aggregation: {
        enable: true,
        maxConcurrentRequests: 10,
        timeout: 30000,
        retryAttempts: 3,
      },
      composition: {
        enable: true,
        maxConcurrentRequests: 10,
        timeout: 30000,
        retryAttempts: 3,
      },
      rateLimit: {
        enable: true,
        rules: [],
      },
      security: {
        enable: true,
        rules: [],
      },
      monitoring: {
        enable: true,
        metricsInterval: 30000,
        alertThresholds: {
          errorRate: 0.05,
          responseTime: 5000,
          throughput: 100,
        },
      },
      documentation: {
        enable: true,
        autoGenerate: true,
        includeExamples: true,
      },
      developerPortal: {
        enable: true,
        apiKeyManagement: true,
        analytics: true,
        testing: true,
      },
      ...userConfig,
    };
  }

  private initializeRegistry(): void {
    this.registry = {
      endpoints: [],
      workflows: [],
      transformationRules: [],
      rateLimitRules: [],
      securityRules: [],
      lastUpdated: Date.now(),
      version: '1.0.0',
    };

    // Load transformation rules
    for (const rule of this.config.transformation.rules) {
      this.transformer.addTransformationRule(rule);
      this.registry.transformationRules.push(rule);
    }

    // Load rate limit rules
    for (const rule of this.config.rateLimit.rules) {
      this.rateLimiter.addRule(rule);
      this.registry.rateLimitRules.push(rule);
    }

    // Load security rules
    for (const rule of this.config.security.rules) {
      this.securityFilter.addRule(rule);
      this.registry.securityRules.push(rule);
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      gateway: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        requestsPerSecond: 0,
        cacheHitRate: 0,
        rateLimitViolations: 0,
        securityViolations: 0,
        activeConnections: 0,
        uptime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      },
      transformation: {
        totalTransformations: 0,
        successfulTransformations: 0,
        failedTransformations: 0,
        averageTransformationTime: 0,
      },
      aggregation: {
        totalAggregations: 0,
        successfulAggregations: 0,
        failedAggregations: 0,
        averageAggregationTime: 0,
        activeAggregations: 0,
      },
      composition: {
        totalCompositions: 0,
        successfulCompositions: 0,
        failedCompositions: 0,
        averageCompositionTime: 0,
        activeCompositions: 0,
      },
      rateLimit: {
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        violationsByRule: {},
        averageResponseTime: 0,
      },
      security: {
        totalRequests: 0,
        blockedRequests: 0,
        violationsByType: {},
        averageRiskScore: 0,
        criticalViolations: 0,
      },
      system: {
        uptime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        activeConnections: 0,
        cacheHitRate: 0,
      },
    };
  }

  private startMetricsCollection(): void {
    if (!this.config.monitoring.enable) return;

    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.checkAlertThresholds();
    }, this.config.monitoring.metricsInterval);
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Collect gateway metrics
      this.metrics.gateway = await this.gateway.getMetrics();

      // Collect component metrics
      const rateLimitMetrics = await this.rateLimiter.getMetrics();
      this.metrics.rateLimit = {
        totalRequests: rateLimitMetrics.totalRequests,
        allowedRequests: rateLimitMetrics.allowedRequests,
        blockedRequests: rateLimitMetrics.blockedRequests,
        violationsByRule: rateLimitMetrics.violationsByRule,
        averageResponseTime: rateLimitMetrics.averageResponseTime,
      };

      const securityMetrics = await this.securityFilter.getMetrics();
      this.metrics.security = {
        totalRequests: securityMetrics.totalRequests,
        blockedRequests: securityMetrics.blockedRequests,
        violationsByType: securityMetrics.violationsByType,
        averageRiskScore: securityMetrics.averageRiskScore,
        criticalViolations: securityMetrics.criticalViolations,
      };

      // Update system metrics
      this.metrics.system = {
        uptime: Date.now() - this.startTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
        activeConnections: this.metrics.gateway.activeConnections,
        cacheHitRate: this.metrics.gateway.cacheHitRate,
      };

      // Update aggregation and composition metrics
      this.metrics.aggregation.activeAggregations = this.aggregator.getActiveRequestsCount();
      this.metrics.composition.activeCompositions = this.composer.getActiveCompositionsCount();

      // Send to monitoring service
      if (this.config.monitoring.enable) {
        await monitoringService.recordMetrics('gateway_service', this.metrics);
      }

    } catch (error) {
      logger.error('Metrics collection error:', error);
    }
  }

  private async checkAlertThresholds(): Promise<void> {
    const thresholds = this.config.monitoring.alertThresholds;
    let alertsTriggered = false;

    // Check error rate
    const errorRate = this.metrics.gateway.failedRequests / (this.metrics.gateway.totalRequests || 1);
    if (errorRate > thresholds.errorRate) {
      await monitoringService.createAlert('high_error_rate', {
        current: errorRate,
        threshold: thresholds.errorRate,
        message: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(thresholds.errorRate * 100).toFixed(2)}%`,
      });
      alertsTriggered = true;
    }

    // Check response time
    if (this.metrics.gateway.averageResponseTime > thresholds.responseTime) {
      await monitoringService.createAlert('high_response_time', {
        current: this.metrics.gateway.averageResponseTime,
        threshold: thresholds.responseTime,
        message: `Average response time ${this.metrics.gateway.averageResponseTime}ms exceeds threshold ${thresholds.responseTime}ms`,
      });
      alertsTriggered = true;
    }

    // Check throughput
    if (this.metrics.gateway.requestsPerSecond < thresholds.throughput) {
      await monitoringService.createAlert('low_throughput', {
        current: this.metrics.gateway.requestsPerSecond,
        threshold: thresholds.throughput,
        message: `Throughput ${this.metrics.gateway.requestsPerSecond} req/s below threshold ${thresholds.throughput} req/s`,
      });
      alertsTriggered = true;
    }

    if (alertsTriggered) {
      logger.warn('Gateway service alert thresholds exceeded');
    }
  }

  // API Management
  public registerEndpoint(endpoint: APIEndpoint): void {
    this.gateway.registerEndpoint(endpoint);
    this.registry.endpoints.push(endpoint);
    this.registry.lastUpdated = Date.now();
    
    logger.info(`Gateway endpoint registered: ${endpoint.id}`);
  }

  public unregisterEndpoint(endpointId: string): void {
    this.gateway.unregisterEndpoint(endpointId);
    this.registry.endpoints = this.registry.endpoints.filter(e => e.id !== endpointId);
    this.registry.lastUpdated = Date.now();
    
    logger.info(`Gateway endpoint unregistered: ${endpointId}`);
  }

  public getEndpoint(endpointId: string): APIEndpoint | undefined {
    return this.gateway.getEndpoint(endpointId);
  }

  public getAllEndpoints(): APIEndpoint[] {
    return this.gateway.getAllEndpoints();
  }

  // Workflow Management
  public registerWorkflow(workflow: CompositionWorkflow): void {
    this.composer.registerWorkflow(workflow);
    this.registry.workflows.push(workflow);
    this.registry.lastUpdated = Date.now();
    
    logger.info(`Gateway workflow registered: ${workflow.id}`);
  }

  public unregisterWorkflow(workflowId: string): void {
    this.composer.unregisterWorkflow(workflowId);
    this.registry.workflows = this.registry.workflows.filter(w => w.id !== workflowId);
    this.registry.lastUpdated = Date.now();
    
    logger.info(`Gateway workflow unregistered: ${workflowId}`);
  }

  public getWorkflow(workflowId: string): CompositionWorkflow | undefined {
    return this.composer.getWorkflow(workflowId);
  }

  public getAllWorkflows(): CompositionWorkflow[] {
    return Array.from(this.registry.workflows);
  }

  // Rule Management
  public addTransformationRule(rule: TransformationRule): void {
    this.transformer.addTransformationRule(rule);
    this.registry.transformationRules.push(rule);
    this.registry.lastUpdated = Date.now();
  }

  public addRateLimitRule(rule: RateLimitRule): void {
    this.rateLimiter.addRule(rule);
    this.registry.rateLimitRules.push(rule);
    this.registry.lastUpdated = Date.now();
  }

  public addSecurityRule(rule: SecurityRule): void {
    this.securityFilter.addRule(rule);
    this.registry.securityRules.push(rule);
    this.registry.lastUpdated = Date.now();
  }

  // Request Processing
  public async processRequest(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Apply security filter first
      if (this.config.security.enable) {
        const securityResult = await this.securityFilter.filter(req);
        if (!securityResult.valid) {
          this.metrics.security.blockedRequests++;
          this.metrics.gateway.failedRequests++;
          
          if (securityResult.blocked) {
            return res.status(403).json({
              error: 'Security violation detected',
              violations: securityResult.violations,
            });
          }
        }
      }

      // Apply rate limiting
      if (this.config.rateLimit.enable) {
        const rateLimitResult = await this.rateLimiter.checkLimit(req);
        if (!rateLimitResult.allowed) {
          this.metrics.rateLimit.blockedRequests++;
          this.metrics.gateway.failedRequests++;
          
          return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter,
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
          });
        }
      }

      // Process through gateway middleware
      await this.gateway.middleware()(req, res, () => {});

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.metrics.gateway.successfulRequests++;
      this.metrics.gateway.averageResponseTime = 
        (this.metrics.gateway.averageResponseTime * (this.metrics.gateway.totalRequests - 1) + responseTime) / this.metrics.gateway.totalRequests;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.metrics.gateway.failedRequests++;
      
      logger.error('Gateway request processing error:', error);
      
      if (this.config.monitoring.enable) {
        await monitoringService.recordError('gateway_request_error', {
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method,
          responseTime,
        });
      }

      res.status(500).json({
        error: 'Gateway processing error',
        requestId: req.headers['x-request-id'],
      });
    }
  }

  // Proxy Request (for simple upstream calls)
  public async proxyRequest(req: Request, endpoint: APIEndpoint): Promise<any> {
    const startTime = Date.now();

    try {
      // Prepare request configuration
      const requestConfig = {
        method: endpoint.upstream.method || req.method,
        url: endpoint.upstream.url,
        headers: {
          ...req.headers,
          ...endpoint.upstream.headers,
        },
        data: req.body,
        timeout: endpoint.upstream.timeout || 30000,
      };

      // Make HTTP request (simplified implementation)
      const response = await this.makeHttpRequest(requestConfig);
      const responseTime = Date.now() - startTime;

      return {
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.data,
        responseTime,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Proxy request error:', error);
      throw new Error(`Proxy request failed: ${error.message}`);
    }
  }

  private async makeHttpRequest(config: any): Promise<any> {
    // Placeholder implementation - replace with actual HTTP client
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          data: { message: 'Proxied response', url: config.url },
        });
      }, 100);
    });
  }

  // API Documentation Generation
  public generateAPIDocumentation(): any {
    if (!this.config.documentation.enable) {
      return null;
    }

    const documentation = {
      info: {
        title: 'Verinode Gateway API',
        version: this.registry.version,
        description: 'Enterprise-grade API Gateway with advanced features',
      },
      endpoints: this.registry.endpoints.map(endpoint => ({
        id: endpoint.id,
        path: endpoint.path,
        method: endpoint.method,
        version: endpoint.version,
        description: `Endpoint: ${endpoint.id}`,
        parameters: this.extractParameters(endpoint),
        requestBody: endpoint.transformation?.request ? {
          description: 'Request body schema',
          example: endpoint.transformation.request,
        } : undefined,
        responses: {
          200: { description: 'Success' },
          400: { description: 'Bad Request' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          429: { description: 'Rate Limited' },
          500: { description: 'Internal Server Error' },
        },
        rateLimit: endpoint.rateLimit,
        security: endpoint.security,
        cache: endpoint.cache,
      })),
      workflows: this.registry.workflows.map(workflow => ({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        version: workflow.version,
        steps: workflow.steps.map(step => ({
          id: step.id,
          name: step.name,
          type: step.type,
          description: `Step: ${step.name}`,
        })),
      })),
      transformationRules: this.registry.transformationRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        inputType: rule.input.type,
        outputType: rule.output.type,
        transformationType: rule.transformation.type,
      })),
      lastUpdated: this.registry.lastUpdated,
    };

    if (this.config.documentation.includeExamples) {
      documentation.examples = this.generateExamples();
    }

    return documentation;
  }

  private extractParameters(endpoint: APIEndpoint): any[] {
    const parameters: any[] = [];
    
    // Extract path parameters
    const pathParams = endpoint.path.match(/:(\w+)/g);
    if (pathParams) {
      for (const param of pathParams) {
        parameters.push({
          name: param.substring(1),
          in: 'path',
          required: true,
          type: 'string',
          description: `Path parameter: ${param}`,
        });
      }
    }

    // Extract query parameters (simplified)
    if (endpoint.transformation?.request?.query) {
      for (const [key, value] of Object.entries(endpoint.transformation.request.query)) {
        parameters.push({
          name: key,
          in: 'query',
          required: false,
          type: typeof value,
          description: `Query parameter: ${key}`,
        });
      }
    }

    return parameters;
  }

  private generateExamples(): any[] {
    return [
      {
        title: 'Simple API Call',
        description: 'Basic request through the gateway',
        request: {
          method: 'GET',
          path: '/api/v1/users',
          headers: {
            'Authorization': 'Bearer your-token',
            'Content-Type': 'application/json',
          },
        },
        response: {
          statusCode: 200,
          body: {
            users: [
              { id: 1, name: 'John Doe', email: 'john@example.com' },
              { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
            ],
          },
        },
      },
      {
        title: 'API Aggregation',
        description: 'Aggregating responses from multiple endpoints',
        request: {
          method: 'GET',
          path: '/api/v1/dashboard',
          headers: {
            'Authorization': 'Bearer your-token',
          },
        },
        response: {
          statusCode: 200,
          body: {
            user: { id: 1, name: 'John Doe' },
            stats: { totalUsers: 100, activeUsers: 75 },
            notifications: [{ id: 1, message: 'Welcome!' }],
          },
        },
      },
    ];
  }

  // Health Check
  public async healthCheck(): Promise<any> {
    const gatewayHealth = await this.gateway.healthCheck();
    const redisHealth = await redisService.healthCheck().catch(() => false);

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: this.registry.version,
      uptime: Date.now() - this.startTime,
      components: {
        gateway: gatewayHealth,
        transformer: { status: 'healthy' },
        aggregator: { status: 'healthy', activeRequests: this.aggregator.getActiveRequestsCount() },
        composer: { status: 'healthy', activeCompositions: this.composer.getActiveCompositionsCount() },
        rateLimiter: { status: 'healthy' },
        securityFilter: { status: 'healthy' },
        redis: { status: redisHealth ? 'healthy' : 'unhealthy' },
      },
      metrics: {
        totalEndpoints: this.registry.endpoints.length,
        totalWorkflows: this.registry.workflows.length,
        totalTransformationRules: this.registry.transformationRules.length,
        totalRateLimitRules: this.registry.rateLimitRules.length,
        totalSecurityRules: this.registry.securityRules.length,
      },
      config: {
        transformation: this.config.transformation.enable,
        aggregation: this.config.aggregation.enable,
        composition: this.config.composition.enable,
        rateLimit: this.config.rateLimit.enable,
        security: this.config.security.enable,
        monitoring: this.config.monitoring.enable,
        documentation: this.config.documentation.enable,
        developerPortal: this.config.developerPortal.enable,
      },
    };
  }

  // Metrics and Monitoring
  public async getMetrics(): Promise<ServiceMetrics> {
    return { ...this.metrics };
  }

  public async getRegistry(): Promise<APIRegistry> {
    return { ...this.registry };
  }

  public async resetMetrics(): Promise<void> {
    await this.gateway.resetMetrics();
    await this.rateLimiter.resetMetrics();
    await this.securityFilter.resetMetrics();
    this.initializeMetrics();
    logger.info('GatewayService metrics reset');
  }

  // Configuration Management
  public getConfig(): GatewayServiceConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<GatewayServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configurations
    this.gateway.updateConfig(this.config.gateway);
    this.transformer.updateConfig(this.config.transformation);
    this.aggregator.updateConfig(this.config.aggregation);
    this.composer.updateConfig(this.config.composition);
    this.rateLimiter.updateConfig(this.config.rateLimit);
    this.securityFilter.updateConfig(this.config.security);
    
    logger.info('GatewayService configuration updated');
  }

  // Cache Management
  public async clearCaches(): Promise<void> {
    this.aggregator.clearCache();
    this.composer.clearCache();
    this.rateLimiter.clearLocalStore();
    this.securityFilter.clearCaches();
    
    // Clear Redis cache
    await redisService.flushdb().catch(() => {});
    
    logger.info('GatewayService caches cleared');
  }

  // Cleanup
  public destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    this.rateLimiter.destroy();
    logger.info('GatewayService destroyed');
  }
}
