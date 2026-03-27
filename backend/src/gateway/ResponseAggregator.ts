import { Request } from 'express';
import { logger } from '../utils/logger';

export interface AggregationConfig {
  maxConcurrentRequests: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableCaching: boolean;
  cacheTTL: number;
}

export interface AggregationEndpoint {
  id: string;
  upstream: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  weight?: number;
  priority?: number;
  mapping?: Record<string, string>;
  transform?: {
    request?: any;
    response?: any;
  };
  cache?: {
    enabled: boolean;
    ttl: number;
    key?: string;
  };
  fallback?: {
    enabled: boolean;
    upstream: string;
    condition?: string;
  };
}

export interface AggregationStrategy {
  type: 'merge' | 'chain' | 'parallel' | 'fanout' | 'reduce';
  options?: {
    mergeKey?: string;
    mergeStrategy?: 'replace' | 'append' | 'merge' | 'combine';
    timeout?: number;
    maxErrors?: number;
    continueOnError?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  };
}

export interface AggregationRequest {
  endpoints: AggregationEndpoint[];
  strategy: AggregationStrategy;
  context?: any;
  metadata?: {
    requestId: string;
    timestamp: number;
    userId?: string;
    sessionId?: string;
  };
}

export interface AggregationResponse {
  data: any;
  metadata: {
    requestId: string;
    timestamp: number;
    duration: number;
    endpoints: Array<{
      id: string;
      upstream: string;
      status: 'success' | 'error' | 'timeout' | 'fallback';
      responseTime: number;
      statusCode?: number;
      error?: string;
      cached?: boolean;
    }>;
    strategy: AggregationStrategy;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cachedRequests: number;
  };
}

export interface AggregationError {
  endpoint: string;
  error: string;
  statusCode?: number;
  timestamp: number;
}

export class ResponseAggregator {
  private config: AggregationConfig;
  private cache: Map<string, any> = new Map();
  private activeRequests: Map<string, Promise<any>> = new Map();

  constructor(config: Partial<AggregationConfig> = {}) {
    this.config = {
      maxConcurrentRequests: 10,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableCaching: true,
      cacheTTL: 300000,
      ...config,
    };
  }

  public async aggregate(req: Request, aggregationRequest: AggregationRequest): Promise<AggregationResponse> {
    const startTime = Date.now();
    const requestId = aggregationRequest.metadata?.requestId || this.generateRequestId();

    try {
      logger.info(`Starting aggregation for request: ${requestId}`);

      // Check if aggregation is already in progress
      if (this.activeRequests.has(requestId)) {
        logger.info(`Aggregation already in progress for request: ${requestId}`);
        return this.activeRequests.get(requestId);
      }

      // Create aggregation promise
      const aggregationPromise = this.performAggregation(req, aggregationRequest, requestId, startTime);
      
      // Store active request
      this.activeRequests.set(requestId, aggregationPromise);

      try {
        const result = await aggregationPromise;
        return result;
      } finally {
        // Clean up active request
        this.activeRequests.delete(requestId);
      }

    } catch (error) {
      logger.error(`Aggregation failed for request ${requestId}:`, error);
      throw new Error(`Aggregation failed: ${error.message}`);
    }
  }

  private async performAggregation(
    req: Request,
    aggregationRequest: AggregationRequest,
    requestId: string,
    startTime: number
  ): Promise<AggregationResponse> {
    const { endpoints, strategy, context, metadata } = aggregationRequest;

    // Validate concurrent request limit
    if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
      throw new Error('Maximum concurrent aggregation requests exceeded');
    }

    // Execute aggregation based on strategy
    let result: any;
    switch (strategy.type) {
      case 'merge':
        result = await this.mergeStrategy(req, endpoints, strategy.options, context);
        break;
      case 'chain':
        result = await this.chainStrategy(req, endpoints, strategy.options, context);
        break;
      case 'parallel':
        result = await this.parallelStrategy(req, endpoints, strategy.options, context);
        break;
      case 'fanout':
        result = await this.fanoutStrategy(req, endpoints, strategy.options, context);
        break;
      case 'reduce':
        result = await this.reduceStrategy(req, endpoints, strategy.options, context);
        break;
      default:
        throw new Error(`Unknown aggregation strategy: ${strategy.type}`);
    }

    const duration = Date.now() - startTime;

    return {
      data: result.data,
      metadata: {
        requestId,
        timestamp: metadata?.timestamp || startTime,
        duration,
        endpoints: result.endpoints,
        strategy,
        totalRequests: endpoints.length,
        successfulRequests: result.endpoints.filter(e => e.status === 'success').length,
        failedRequests: result.endpoints.filter(e => e.status === 'error').length,
        cachedRequests: result.endpoints.filter(e => e.cached).length,
      },
    };
  }

  private async mergeStrategy(
    req: Request,
    endpoints: AggregationEndpoint[],
    options: any = {},
    context: any
  ): Promise<any> {
    const responses = await this.parallelStrategy(req, endpoints, options, context);
    const mergedData = this.mergeResponses(responses.data, options);
    
    return {
      data: mergedData,
      endpoints: responses.endpoints,
    };
  }

  private async chainStrategy(
    req: Request,
    endpoints: AggregationEndpoint[],
    options: any = {},
    context: any
  ): Promise<any> {
    const results: any[] = [];
    const endpointResults: any[] = [];
    let accumulatedData = {};

    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        
        // Pass accumulated data to next endpoint
        const enhancedContext = {
          ...context,
          accumulated: accumulatedData,
          previousResults: results,
        };

        const response = await this.callEndpoint(req, endpoint, enhancedContext);
        const responseTime = Date.now() - startTime;

        results.push(response.data);
        accumulatedData = { ...accumulatedData, ...response.data };

        endpointResults.push({
          id: endpoint.id,
          upstream: endpoint.upstream,
          status: 'success',
          responseTime,
          statusCode: response.statusCode,
          cached: response.cached,
        });

      } catch (error) {
        if (!options.continueOnError) {
          throw error;
        }

        endpointResults.push({
          id: endpoint.id,
          upstream: endpoint.upstream,
          status: 'error',
          responseTime: 0,
          error: error.message,
        });

        if (options.maxErrors && endpointResults.filter(e => e.status === 'error').length >= options.maxErrors) {
          throw new Error('Maximum error threshold reached in chain strategy');
        }
      }
    }

    return {
      data: accumulatedData,
      endpoints: endpointResults,
    };
  }

  private async parallelStrategy(
    req: Request,
    endpoints: AggregationEndpoint[],
    options: any = {},
    context: any
  ): Promise<any> {
    const promises = endpoints.map(endpoint => 
      this.callEndpointWithFallback(req, endpoint, context)
    );

    const results = await Promise.allSettled(promises);
    const responses: any[] = [];
    const endpointResults: any[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const endpoint = endpoints[i];

      if (result.status === 'fulfilled') {
        responses.push(result.value.data);
        endpointResults.push({
          id: endpoint.id,
          upstream: endpoint.upstream,
          status: 'success',
          responseTime: result.value.responseTime,
          statusCode: result.value.statusCode,
          cached: result.value.cached,
        });
      } else {
        if (!options.continueOnError) {
          throw new Error(`Parallel strategy failed: ${result.reason}`);
        }

        endpointResults.push({
          id: endpoint.id,
          upstream: endpoint.upstream,
          status: 'error',
          responseTime: 0,
          error: result.reason.message,
        });

        if (options.maxErrors && endpointResults.filter(e => e.status === 'error').length >= options.maxErrors) {
          throw new Error('Maximum error threshold reached in parallel strategy');
        }
      }
    }

    return {
      data: responses,
      endpoints: endpointResults,
    };
  }

  private async fanoutStrategy(
    req: Request,
    endpoints: AggregationEndpoint[],
    options: any = {},
    context: any
  ): Promise<any> {
    // Fanout is similar to parallel but with additional fan-out logic
    const parallelResult = await this.parallelStrategy(req, endpoints, options, context);
    
    // Apply fan-out specific transformations
    const fanoutData = this.applyFanoutTransformations(parallelResult.data, options);

    return {
      data: fanoutData,
      endpoints: parallelResult.endpoints,
    };
  }

  private async reduceStrategy(
    req: Request,
    endpoints: AggregationEndpoint[],
    options: any = {},
    context: any
  ): Promise<any> {
    const parallelResult = await this.parallelStrategy(req, endpoints, options, context);
    
    // Apply reduce operation
    const reducedData = this.applyReduceOperation(parallelResult.data, options);

    return {
      data: reducedData,
      endpoints: parallelResult.endpoints,
    };
  }

  private async callEndpointWithFallback(
    req: Request,
    endpoint: AggregationEndpoint,
    context: any
  ): Promise<any> {
    try {
      return await this.callEndpoint(req, endpoint, context);
    } catch (error) {
      if (endpoint.fallback?.enabled) {
        logger.info(`Using fallback for endpoint ${endpoint.id}: ${endpoint.fallback.upstream}`);
        
        const fallbackEndpoint: AggregationEndpoint = {
          ...endpoint,
          id: `${endpoint.id}-fallback`,
          upstream: endpoint.fallback.upstream,
        };

        return await this.callEndpoint(req, fallbackEndpoint, context);
      }
      throw error;
    }
  }

  private async callEndpoint(
    req: Request,
    endpoint: AggregationEndpoint,
    context: any
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Check cache first
      if (endpoint.cache?.enabled && this.config.enableCaching) {
        const cached = await this.getCachedResponse(endpoint, context);
        if (cached) {
          return {
            data: cached.data,
            statusCode: cached.statusCode,
            responseTime: Date.now() - startTime,
            cached: true,
          };
        }
      }

      // Prepare request
      const requestConfig = this.prepareRequest(req, endpoint, context);

      // Make HTTP request
      const response = await this.makeHttpRequest(requestConfig);
      const responseTime = Date.now() - startTime;

      // Cache response if enabled
      if (endpoint.cache?.enabled && this.config.enableCaching) {
        await this.setCachedResponse(endpoint, context, response);
      }

      return {
        data: response.data,
        statusCode: response.statusCode,
        responseTime,
        cached: false,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(`Endpoint call failed for ${endpoint.id}:`, error);
      throw error;
    }
  }

  private prepareRequest(req: Request, endpoint: AggregationEndpoint, context: any): any {
    const requestConfig: any = {
      method: endpoint.method,
      url: endpoint.upstream,
      timeout: endpoint.timeout || this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Verinode-Gateway/1.0',
        ...endpoint.headers,
      },
    };

    // Apply request transformation
    if (endpoint.transform?.request) {
      requestConfig.data = this.applyTransformation(req.body, endpoint.transform.request, context);
    } else {
      requestConfig.data = req.body;
    }

    // Add context headers
    if (context.userId) {
      requestConfig.headers['X-User-ID'] = context.userId;
    }
    if (context.sessionId) {
      requestConfig.headers['X-Session-ID'] = context.sessionId;
    }

    return requestConfig;
  }

  private async makeHttpRequest(requestConfig: any): Promise<any> {
    // This is a simplified HTTP client implementation
    // In production, use a proper HTTP client like axios or fetch
    const maxRetries = this.config.retryAttempts;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Simulate HTTP request - replace with actual HTTP client
        const response = await this.simulateHttpRequest(requestConfig);
        return response;
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private async simulateHttpRequest(requestConfig: any): Promise<any> {
    // Placeholder implementation - replace with actual HTTP client
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate successful response
        resolve({
          data: { message: 'Simulated response', url: requestConfig.url },
          statusCode: 200,
        });
      }, 100);
    });
  }

  private applyTransformation(data: any, transformation: any, context: any): any {
    // Simple transformation - in production, use RequestTransformer
    if (typeof transformation === 'object') {
      return { ...data, ...transformation };
    }
    return data;
  }

  private mergeResponses(responses: any[], options: any): any {
    if (!Array.isArray(responses)) {
      return responses;
    }

    const mergeKey = options.mergeKey || 'data';
    const mergeStrategy = options.mergeStrategy || 'merge';

    switch (mergeStrategy) {
      case 'replace':
        return responses[responses.length - 1] || {};
      
      case 'append':
        return responses.reduce((acc, response) => {
          if (Array.isArray(acc[mergeKey]) && Array.isArray(response[mergeKey])) {
            acc[mergeKey] = [...acc[mergeKey], ...response[mergeKey]];
          }
          return acc;
        }, {});
      
      case 'combine':
        return responses.reduce((acc, response, index) => {
          acc[`endpoint_${index}`] = response;
          return acc;
        }, {});
      
      case 'merge':
      default:
        return responses.reduce((acc, response) => {
          return this.deepMerge(acc, response);
        }, {});
    }
  }

  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }

    if (typeof source !== 'object' || typeof target !== 'object') {
      return source;
    }

    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && typeof result[key] === 'object') {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  private applyFanoutTransformations(data: any[], options: any): any {
    // Apply fan-out specific transformations
    if (options.sortBy) {
      data.sort((a, b) => {
        const aValue = this.getNestedValue(a, options.sortBy);
        const bValue = this.getNestedValue(b, options.sortBy);
        
        if (options.sortOrder === 'desc') {
          return bValue - aValue;
        }
        return aValue - bValue;
      });
    }

    if (options.offset || options.limit) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      data = data.slice(start, end);
    }

    return data;
  }

  private applyReduceOperation(data: any[], options: any): any {
    if (!Array.isArray(data)) {
      return data;
    }

    // Apply reduce operation based on options
    if (options.reduceFunction) {
      // Custom reduce function would need to be executed in a secure environment
      return data.reduce(options.reduceFunction, options.initialValue);
    }

    // Default reduce operations
    switch (options.operation) {
      case 'sum':
        return data.reduce((sum, item) => sum + (item.value || 0), 0);
      case 'count':
        return data.length;
      case 'average':
        return data.reduce((sum, item) => sum + (item.value || 0), 0) / data.length;
      case 'min':
        return Math.min(...data.map(item => item.value || 0));
      case 'max':
        return Math.max(...data.map(item => item.value || 0));
      default:
        return data;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private async getCachedResponse(endpoint: AggregationEndpoint, context: any): Promise<any> {
    if (!this.config.enableCaching || !endpoint.cache?.enabled) {
      return null;
    }

    const cacheKey = this.generateCacheKey(endpoint, context);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  private async setCachedResponse(endpoint: AggregationEndpoint, context: any, response: any): Promise<void> {
    if (!this.config.enableCaching || !endpoint.cache?.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey(endpoint, context);
    const ttl = endpoint.cache.ttl || this.config.cacheTTL;

    this.cache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + ttl,
    });
  }

  private generateCacheKey(endpoint: AggregationEndpoint, context: any): string {
    const key = endpoint.cache?.key || `agg:${endpoint.id}`;
    const contextHash = this.hashObject(context);
    return `${key}:${contextHash}`;
  }

  private hashObject(obj: any): string {
    // Simple hash function - in production, use a proper hashing library
    return Buffer.from(JSON.stringify(obj)).toString('base64').substring(0, 16);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `agg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getActiveRequestsCount(): number {
    return this.activeRequests.size;
  }

  public getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  public clearCache(): void {
    this.cache.clear();
    logger.info('ResponseAggregator cache cleared');
  }

  public getConfig(): AggregationConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<AggregationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('ResponseAggregator configuration updated');
  }
}
