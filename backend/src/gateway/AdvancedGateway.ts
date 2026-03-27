import { Request, Response, NextFunction } from 'express';
import { RequestTransformer } from './RequestTransformer';
import { ResponseAggregator } from './ResponseAggregator';
import { APIComposer } from './APIComposer';
import { RateLimiter } from './RateLimiter';
import { SecurityFilter } from './SecurityFilter';
import { GatewayService } from '../services/gateway/GatewayService';
import { monitoringService } from '../services/monitoringService';
import { redisService } from '../services/redisService';
import { logger } from '../utils/logger';

export interface GatewayConfig {
  version: string;
  enableTransformation: boolean;
  enableAggregation: boolean;
  enableComposition: boolean;
  enableRateLimiting: boolean;
  enableSecurityFilter: boolean;
  enableCaching: boolean;
  enableMonitoring: boolean;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  cache: {
    ttl: number;
    maxSize: number;
    strategy: 'LRU' | 'LFU' | 'FIFO';
  };
  security: {
    enableXSS: boolean;
    enableSQLInjection: boolean;
    enableCSRF: boolean;
    enableInputValidation: boolean;
    maxRequestSize: number;
  };
  transformation: {
    enableRequestTransformation: boolean;
    enableResponseTransformation: boolean;
    defaultFormat: 'json' | 'xml' | 'yaml';
  };
  composition: {
    maxConcurrentRequests: number;
    timeout: number;
    retryAttempts: number;
  };
}

export interface APIEndpoint {
  id: string;
  path: string;
  method: string;
  version: string;
  upstream: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
    retries?: number;
  };
  transformation?: {
    request?: {
      headers?: Record<string, string>;
      body?: any;
      query?: Record<string, string>;
    };
    response?: {
      headers?: Record<string, string>;
      body?: any;
      statusCode?: number;
    };
  };
  aggregation?: {
    endpoints: Array<{
      id: string;
      upstream: string;
      mapping?: Record<string, string>;
    }>;
    strategy: 'merge' | 'chain' | 'parallel';
  };
  rateLimit?: {
    requests: number;
    window: number;
    burst?: number;
  };
  security?: {
    authentication: boolean;
    authorization: boolean;
    validation: boolean;
    requiredPermissions?: string[];
  };
  cache?: {
    enabled: boolean;
    ttl: number;
    key?: string;
    tags?: string[];
  };
}

export interface GatewayMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  cacheHitRate: number;
  rateLimitViolations: number;
  securityViolations: number;
  activeConnections: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export class AdvancedGateway {
  private config: GatewayConfig;
  private transformer: RequestTransformer;
  private aggregator: ResponseAggregator;
  private composer: APIComposer;
  private rateLimiter: RateLimiter;
  private securityFilter: SecurityFilter;
  private gatewayService: GatewayService;
  private endpoints: Map<string, APIEndpoint> = new Map();
  private metrics: GatewayMetrics;
  private startTime: number;

  constructor(config: Partial<GatewayConfig> = {}) {
    this.config = {
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
        maxRequestSize: 10485760, // 10MB
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
      ...config,
    };

    this.transformer = new RequestTransformer(this.config.transformation);
    this.aggregator = new ResponseAggregator();
    this.composer = new APIComposer(this.config.composition);
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
    this.securityFilter = new SecurityFilter(this.config.security);
    this.gatewayService = new GatewayService();
    
    this.startTime = Date.now();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.metrics = {
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
    };
  }

  public registerEndpoint(endpoint: APIEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
    logger.info(`Gateway endpoint registered: ${endpoint.id} - ${endpoint.method} ${endpoint.path}`);
  }

  public unregisterEndpoint(endpointId: string): void {
    if (this.endpoints.delete(endpointId)) {
      logger.info(`Gateway endpoint unregistered: ${endpointId}`);
    }
  }

  public getEndpoint(endpointId: string): APIEndpoint | undefined {
    return this.endpoints.get(endpointId);
  }

  public getAllEndpoints(): APIEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  public middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      this.metrics.totalRequests++;
      this.metrics.activeConnections++;

      try {
        // Find matching endpoint
        const endpoint = this.findMatchingEndpoint(req);
        if (!endpoint) {
          this.metrics.failedRequests++;
          return res.status(404).json({ error: 'Endpoint not found' });
        }

        // Apply security filter
        if (this.config.enableSecurityFilter && endpoint.security?.validation) {
          const securityResult = await this.securityFilter.filter(req);
          if (!securityResult.valid) {
            this.metrics.securityViolations++;
            this.metrics.failedRequests++;
            return res.status(403).json({ 
              error: 'Security violation', 
              details: securityResult.reason 
            });
          }
        }

        // Apply rate limiting
        if (this.config.enableRateLimiting && endpoint.rateLimit) {
          const rateLimitResult = await this.rateLimiter.checkLimit(req, endpoint.rateLimit);
          if (!rateLimitResult.allowed) {
            this.metrics.rateLimitViolations++;
            this.metrics.failedRequests++;
            return res.status(429).json({ 
              error: 'Rate limit exceeded',
              retryAfter: rateLimitResult.retryAfter 
            });
          }
        }

        // Check cache
        let cachedResponse = null;
        if (this.config.enableCaching && endpoint.cache?.enabled) {
          cachedResponse = await this.getCachedResponse(req, endpoint);
          if (cachedResponse) {
            this.metrics.cacheHitRate = this.calculateCacheHitRate();
            return this.sendCachedResponse(res, cachedResponse);
          }
        }

        // Transform request
        if (this.config.enableTransformation && endpoint.transformation?.request) {
          req = await this.transformer.transformRequest(req, endpoint.transformation.request);
        }

        // Process request based on endpoint configuration
        let response;
        if (endpoint.aggregation) {
          response = await this.aggregator.aggregate(req, endpoint.aggregation);
        } else if (endpoint.composition) {
          response = await this.composer.compose(req, endpoint);
        } else {
          response = await this.gatewayService.proxyRequest(req, endpoint);
        }

        // Transform response
        if (this.config.enableTransformation && endpoint.transformation?.response) {
          response = await this.transformer.transformResponse(response, endpoint.transformation.response);
        }

        // Cache response
        if (this.config.enableCaching && endpoint.cache?.enabled) {
          await this.setCachedResponse(req, endpoint, response);
        }

        // Update metrics
        const responseTime = Date.now() - startTime;
        this.updateMetrics(responseTime, true);

        // Send response
        res.status(response.statusCode || 200);
        if (response.headers) {
          Object.entries(response.headers).forEach(([key, value]) => {
            res.set(key, value as string);
          });
        }
        res.json(response.body);

      } catch (error) {
        const responseTime = Date.now() - startTime;
        this.updateMetrics(responseTime, false);
        
        logger.error('Gateway middleware error:', error);
        
        if (this.config.enableMonitoring) {
          await monitoringService.recordError('gateway_error', {
            error: error.message,
            stack: error.stack,
            path: req.path,
            method: req.method,
          });
        }

        res.status(500).json({ 
          error: 'Internal gateway error',
          requestId: req.headers['x-request-id'],
        });
      } finally {
        this.metrics.activeConnections--;
      }
    };
  }

  private findMatchingEndpoint(req: Request): APIEndpoint | undefined {
    for (const endpoint of this.endpoints.values()) {
      if (this.matchesEndpoint(req, endpoint)) {
        return endpoint;
      }
    }
    return undefined;
  }

  private matchesEndpoint(req: Request, endpoint: APIEndpoint): boolean {
    const methodMatch = endpoint.method === req.method.toLowerCase();
    const pathMatch = this.matchPath(req.path, endpoint.path);
    return methodMatch && pathMatch;
  }

  private matchPath(requestPath: string, endpointPath: string): boolean {
    // Simple path matching - can be enhanced with regex for parameters
    const normalizedRequest = requestPath.replace(/\/+/g, '/').replace(/\/$/, '');
    const normalizedEndpoint = endpointPath.replace(/\/+/g, '/').replace(/\/$/, '');
    
    if (normalizedEndpoint.includes(':')) {
      // Parameterized path - use regex
      const regex = new RegExp(normalizedEndpoint.replace(/:[^/]+/g, '[^/]+'));
      return regex.test(normalizedRequest);
    }
    
    return normalizedRequest === normalizedEndpoint;
  }

  private async getCachedResponse(req: Request, endpoint: APIEndpoint): Promise<any> {
    if (!this.config.enableCaching || !endpoint.cache?.enabled) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(req, endpoint);
      return await redisService.get(cacheKey);
    } catch (error) {
      logger.error('Cache retrieval error:', error);
      return null;
    }
  }

  private async setCachedResponse(req: Request, endpoint: APIEndpoint, response: any): Promise<void> {
    if (!this.config.enableCaching || !endpoint.cache?.enabled) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(req, endpoint);
      const ttl = endpoint.cache.ttl || this.config.cache.ttl;
      await redisService.set(cacheKey, JSON.stringify(response), ttl);
    } catch (error) {
      logger.error('Cache storage error:', error);
    }
  }

  private generateCacheKey(req: Request, endpoint: APIEndpoint): string {
    const key = endpoint.cache?.key || `gateway:${endpoint.id}:${req.method}:${req.path}`;
    const queryParams = new URLSearchParams(req.query as any).toString();
    return queryParams ? `${key}:${queryParams}` : key;
  }

  private sendCachedResponse(res: Response, cachedResponse: any): void {
    const response = JSON.parse(cachedResponse);
    res.status(response.statusCode || 200);
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        res.set(key, value as string);
      });
    }
    res.set('X-Cache', 'HIT');
    res.json(response.body);
  }

  private calculateCacheHitRate(): number {
    // This would need to track cache hits/misses over time
    return 0.85; // Placeholder
  }

  private updateMetrics(responseTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    // Update requests per second
    this.metrics.uptime = Date.now() - this.startTime;
    this.metrics.requestsPerSecond = totalRequests / (this.metrics.uptime / 1000);

    // Update system metrics
    this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    // CPU usage would require additional monitoring
  }

  public async getMetrics(): Promise<GatewayMetrics> {
    return { ...this.metrics };
  }

  public async resetMetrics(): Promise<void> {
    this.initializeMetrics();
    logger.info('Gateway metrics reset');
  }

  public async healthCheck(): Promise<{ status: string; timestamp: string; details: any }> {
    const details = {
      endpoints: this.endpoints.size,
      uptime: this.metrics.uptime,
      memoryUsage: this.metrics.memoryUsage,
      activeConnections: this.metrics.activeConnections,
      config: {
        transformation: this.config.enableTransformation,
        aggregation: this.config.enableAggregation,
        composition: this.config.enableComposition,
        rateLimiting: this.config.enableRateLimiting,
        security: this.config.enableSecurityFilter,
        caching: this.config.enableCaching,
        monitoring: this.config.enableMonitoring,
      },
    };

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details,
    };
  }

  public getConfig(): GatewayConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<GatewayConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Gateway configuration updated');
  }
}
