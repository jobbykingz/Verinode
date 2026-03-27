import { Request } from 'express';
import { logger } from '../utils/logger';

export interface CompositionConfig {
  maxConcurrentRequests: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableCaching: boolean;
  cacheTTL: number;
  enableOrchestration: boolean;
  enableWorkflow: boolean;
}

export interface CompositionStep {
  id: string;
  name: string;
  type: 'http' | 'transform' | 'condition' | 'loop' | 'parallel' | 'merge' | 'filter';
  config: any;
  inputs?: string[];
  outputs?: string[];
  condition?: string;
  onError?: 'stop' | 'continue' | 'retry';
  retryCount?: number;
  timeout?: number;
  cache?: {
    enabled: boolean;
    ttl: number;
    key?: string;
  };
}

export interface CompositionWorkflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  steps: CompositionStep[];
  variables?: Record<string, any>;
  errorHandling?: {
    strategy: 'stop' | 'continue' | 'rollback';
    fallback?: string;
  };
  metadata?: {
    author: string;
    tags: string[];
    createdAt: number;
    updatedAt: number;
  };
}

export interface CompositionContext {
  requestId: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  variables: Record<string, any>;
  results: Record<string, any>;
  errors: Record<string, any>;
  metadata: Record<string, any>;
}

export interface CompositionResult {
  success: boolean;
  data: any;
  context: CompositionContext;
  execution: {
    workflowId: string;
    startTime: number;
    endTime: number;
    duration: number;
    steps: Array<{
      id: string;
      name: string;
      status: 'success' | 'error' | 'skipped' | 'timeout';
      startTime: number;
      endTime: number;
      duration: number;
      input?: any;
      output?: any;
      error?: string;
      cached?: boolean;
    }>;
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    skippedSteps: number;
    cachedSteps: number;
  };
}

export interface APIEndpoint {
  id: string;
  upstream: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  authentication?: {
    type: 'bearer' | 'basic' | 'apikey' | 'oauth2';
    credentials: any;
  };
  validation?: {
    request?: any;
    response?: any;
  };
  transformation?: {
    request?: any;
    response?: any;
  };
  rateLimit?: {
    requests: number;
    window: number;
  };
}

export class APIComposer {
  private config: CompositionConfig;
  private workflows: Map<string, CompositionWorkflow> = new Map();
  private endpoints: Map<string, APIEndpoint> = new Map();
  private cache: Map<string, any> = new Map();
  private activeCompositions: Map<string, Promise<CompositionResult>> = new Map();

  constructor(config: Partial<CompositionConfig> = {}) {
    this.config = {
      maxConcurrentRequests: 10,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableCaching: true,
      cacheTTL: 300000,
      enableOrchestration: true,
      enableWorkflow: true,
      ...config,
    };
  }

  public registerWorkflow(workflow: CompositionWorkflow): void {
    this.workflows.set(workflow.id, workflow);
    logger.info(`Composition workflow registered: ${workflow.id} v${workflow.version}`);
  }

  public unregisterWorkflow(workflowId: string): void {
    if (this.workflows.delete(workflowId)) {
      logger.info(`Composition workflow unregistered: ${workflowId}`);
    }
  }

  public registerEndpoint(endpoint: APIEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
    logger.info(`API endpoint registered: ${endpoint.id}`);
  }

  public unregisterEndpoint(endpointId: string): void {
    if (this.endpoints.delete(endpointId)) {
      logger.info(`API endpoint unregistered: ${endpointId}`);
    }
  }

  public async compose(req: Request, endpoint: any): Promise<any> {
    const compositionId = this.generateCompositionId();
    const startTime = Date.now();

    try {
      logger.info(`Starting composition: ${compositionId}`);

      // Check if composition is already in progress
      if (this.activeCompositions.has(compositionId)) {
        logger.info(`Composition already in progress: ${compositionId}`);
        return this.activeCompositions.get(compositionId);
      }

      // Create composition promise
      const compositionPromise = this.performComposition(req, endpoint, compositionId, startTime);
      
      // Store active composition
      this.activeCompositions.set(compositionId, compositionPromise);

      try {
        const result = await compositionPromise;
        return result;
      } finally {
        // Clean up active composition
        this.activeCompositions.delete(compositionId);
      }

    } catch (error) {
      logger.error(`Composition failed for ${compositionId}:`, error);
      throw new Error(`Composition failed: ${error.message}`);
    }
  }

  private async performComposition(
    req: Request,
    endpoint: any,
    compositionId: string,
    startTime: number
  ): Promise<CompositionResult> {
    // Initialize composition context
    const context: CompositionContext = {
      requestId: compositionId,
      timestamp: startTime,
      userId: req.headers['x-user-id'] as string,
      sessionId: req.headers['x-session-id'] as string,
      variables: endpoint.variables || {},
      results: {},
      errors: {},
      metadata: {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers,
        body: req.body,
      },
    };

    // Determine composition type
    if (endpoint.workflow) {
      return await this.executeWorkflow(req, endpoint.workflow, context);
    } else if (endpoint.orchestration) {
      return await this.executeOrchestration(req, endpoint.orchestration, context);
    } else {
      return await this.executeSimpleComposition(req, endpoint, context);
    }
  }

  private async executeWorkflow(
    req: Request,
    workflowId: string,
    context: CompositionContext
  ): Promise<CompositionResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    logger.info(`Executing workflow: ${workflowId}`);
    const startTime = Date.now();

    try {
      const stepResults: any[] = [];

      for (const step of workflow.steps) {
        const stepResult = await this.executeStep(req, step, context);
        stepResults.push(stepResult);

        // Handle step errors based on workflow configuration
        if (!stepResult.success && workflow.errorHandling?.strategy === 'stop') {
          throw new Error(`Workflow stopped at step ${step.id}: ${stepResult.error}`);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        success: true,
        data: context.results,
        context,
        execution: {
          workflowId,
          startTime,
          endTime,
          duration,
          steps: stepResults,
          totalSteps: workflow.steps.length,
          successfulSteps: stepResults.filter(s => s.status === 'success').length,
          failedSteps: stepResults.filter(s => s.status === 'error').length,
          skippedSteps: stepResults.filter(s => s.status === 'skipped').length,
          cachedSteps: stepResults.filter(s => s.cached).length,
        },
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        success: false,
        data: null,
        context,
        execution: {
          workflowId,
          startTime,
          endTime,
          duration,
          steps: [],
          totalSteps: workflow.steps.length,
          successfulSteps: 0,
          failedSteps: 1,
          skippedSteps: 0,
          cachedSteps: 0,
        },
      };
    }
  }

  private async executeStep(
    req: Request,
    step: CompositionStep,
    context: CompositionContext
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Check if step should be executed based on condition
      if (step.condition && !this.evaluateCondition(step.condition, context)) {
        return {
          id: step.id,
          name: step.name,
          status: 'skipped',
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
        };
      }

      // Check cache
      let cached = false;
      if (step.cache?.enabled && this.config.enableCaching) {
        const cachedResult = await this.getCachedStepResult(step, context);
        if (cachedResult) {
          context.results[step.id] = cachedResult.output;
          return {
            id: step.id,
            name: step.name,
            status: 'success',
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            input: cachedResult.input,
            output: cachedResult.output,
            cached: true,
          };
        }
      }

      // Execute step based on type
      let result: any;
      switch (step.type) {
        case 'http':
          result = await this.executeHttpStep(req, step, context);
          break;
        case 'transform':
          result = await this.executeTransformStep(step, context);
          break;
        case 'condition':
          result = await this.executeConditionStep(step, context);
          break;
        case 'loop':
          result = await this.executeLoopStep(req, step, context);
          break;
        case 'parallel':
          result = await this.executeParallelStep(req, step, context);
          break;
        case 'merge':
          result = await this.executeMergeStep(step, context);
          break;
        case 'filter':
          result = await this.executeFilterStep(step, context);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      // Cache result if enabled
      if (step.cache?.enabled && this.config.enableCaching) {
        await this.setCachedStepResult(step, context, result);
      }

      // Store result in context
      context.results[step.id] = result;

      return {
        id: step.id,
        name: step.name,
        status: 'success',
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        input: step.inputs ? this.getStepInputs(step, context) : undefined,
        output: result,
        cached,
      };

    } catch (error) {
      context.errors[step.id] = error.message;

      // Handle error based on step configuration
      if (step.onError === 'retry' && (step.retryCount || 0) < this.config.retryAttempts) {
        step.retryCount = (step.retryCount || 0) + 1;
        await this.sleep(this.config.retryDelay * step.retryCount);
        return await this.executeStep(req, step, context);
      }

      return {
        id: step.id,
        name: step.name,
        status: 'error',
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async executeHttpStep(req: Request, step: CompositionStep, context: CompositionContext): Promise<any> {
    const endpointId = step.config.endpoint;
    const endpoint = this.endpoints.get(endpointId);
    
    if (!endpoint) {
      throw new Error(`HTTP endpoint not found: ${endpointId}`);
    }

    // Prepare request
    const requestConfig = this.prepareHttpRequest(req, endpoint, step, context);

    // Make HTTP request
    const response = await this.makeHttpRequest(requestConfig);

    // Apply response transformation
    if (endpoint.transformation?.response) {
      return this.applyTransformation(response.data, endpoint.transformation.response, context);
    }

    return response.data;
  }

  private async executeTransformStep(step: CompositionStep, context: CompositionContext): Promise<any> {
    const input = this.getStepInputs(step, context);
    const transformation = step.config.transformation;

    if (!transformation) {
      throw new Error(`Transform step ${step.id} missing transformation configuration`);
    }

    return this.applyTransformation(input, transformation, context);
  }

  private async executeConditionStep(step: CompositionStep, context: CompositionContext): Promise<any> {
    const condition = step.config.condition;
    const thenBranch = step.config.then;
    const elseBranch = step.config.else;

    const result = this.evaluateCondition(condition, context);

    if (result && thenBranch) {
      return await this.executeBranch(thenBranch, context);
    } else if (!result && elseBranch) {
      return await this.executeBranch(elseBranch, context);
    }

    return result;
  }

  private async executeLoopStep(req: Request, step: CompositionStep, context: CompositionContext): Promise<any> {
    const items = this.evaluateExpression(step.config.items, context);
    const loopBody = step.config.body;
    const results: any[] = [];

    if (!Array.isArray(items)) {
      throw new Error(`Loop step ${step.id} requires an array of items`);
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const loopContext = {
        ...context,
        variables: {
          ...context.variables,
          item,
          index: i,
        },
      };

      const result = await this.executeBranch(loopBody, loopContext);
      results.push(result);
    }

    return results;
  }

  private async executeParallelStep(req: Request, step: CompositionStep, context: CompositionContext): Promise<any> {
    const branches = step.config.branches;
    const promises = branches.map((branch: any) => this.executeBranch(branch, context));

    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => ({
      branch: index,
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null,
    }));
  }

  private async executeMergeStep(step: CompositionStep, context: CompositionContext): Promise<any> {
    const sources = step.config.sources;
    const mergeStrategy = step.config.strategy || 'merge';
    const mergeKey = step.config.key;

    const sourceData = sources.map((source: string) => context.results[source] || {});

    switch (mergeStrategy) {
      case 'merge':
        return this.deepMerge(...sourceData);
      case 'combine':
        return { combined: sourceData };
      case 'join':
        return this.joinArrays(sourceData, mergeKey);
      default:
        return sourceData;
    }
  }

  private async executeFilterStep(step: CompositionStep, context: CompositionContext): Promise<any> {
    const source = step.config.source;
    const filterCondition = step.config.condition;
    const sourceData = context.results[source] || [];

    if (!Array.isArray(sourceData)) {
      throw new Error(`Filter step ${step.id} requires an array source`);
    }

    return sourceData.filter((item: any) => {
      const filterContext = {
        ...context,
        variables: {
          ...context.variables,
          item,
        },
      };
      return this.evaluateCondition(filterCondition, filterContext);
    });
  }

  private async executeBranch(branch: any, context: CompositionContext): Promise<any> {
    if (branch.type === 'step') {
      return await this.executeStep({} as Request, branch, context);
    } else if (branch.type === 'workflow') {
      return await this.executeWorkflow({} as Request, branch.workflowId, context);
    } else if (branch.type === 'expression') {
      return this.evaluateExpression(branch.expression, context);
    } else {
      return branch;
    }
  }

  private async executeOrchestration(req: Request, orchestration: any, context: CompositionContext): Promise<CompositionResult> {
    // Orchestration is similar to workflow but with additional features
    return await this.executeWorkflow(req, orchestration.workflowId, context);
  }

  private async executeSimpleComposition(req: Request, endpoint: any, context: CompositionContext): Promise<CompositionResult> {
    // Simple composition - just call the upstream endpoint
    const startTime = Date.now();
    
    try {
      const response = await this.callUpstream(req, endpoint);
      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        success: true,
        data: response,
        context,
        execution: {
          workflowId: 'simple',
          startTime,
          endTime,
          duration,
          steps: [],
          totalSteps: 1,
          successfulSteps: 1,
          failedSteps: 0,
          skippedSteps: 0,
          cachedSteps: 0,
        },
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        success: false,
        data: null,
        context,
        execution: {
          workflowId: 'simple',
          startTime,
          endTime,
          duration,
          steps: [],
          totalSteps: 1,
          successfulSteps: 0,
          failedSteps: 1,
          skippedSteps: 0,
          cachedSteps: 0,
        },
      };
    }
  }

  private prepareHttpRequest(req: Request, endpoint: APIEndpoint, step: CompositionStep, context: CompositionContext): any {
    const requestConfig: any = {
      method: endpoint.method,
      url: endpoint.upstream,
      timeout: endpoint.timeout || this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Verinode-Composer/1.0',
        ...endpoint.headers,
      },
    };

    // Apply request transformation
    if (endpoint.transformation?.request) {
      requestConfig.data = this.applyTransformation(req.body, endpoint.transformation.request, context);
    } else {
      requestConfig.data = req.body;
    }

    // Add authentication
    if (endpoint.authentication) {
      this.addAuthentication(requestConfig, endpoint.authentication);
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

  private addAuthentication(requestConfig: any, authentication: any): void {
    switch (authentication.type) {
      case 'bearer':
        requestConfig.headers['Authorization'] = `Bearer ${authentication.credentials.token}`;
        break;
      case 'basic':
        const credentials = Buffer.from(`${authentication.credentials.username}:${authentication.credentials.password}`).toString('base64');
        requestConfig.headers['Authorization'] = `Basic ${credentials}`;
        break;
      case 'apikey':
        requestConfig.headers['X-API-Key'] = authentication.credentials.key;
        break;
      case 'oauth2':
        requestConfig.headers['Authorization'] = `Bearer ${authentication.credentials.accessToken}`;
        break;
    }
  }

  private async makeHttpRequest(requestConfig: any): Promise<any> {
    // Placeholder implementation - replace with actual HTTP client
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({
          data: { message: 'Simulated HTTP response', url: requestConfig.url },
          statusCode: 200,
        });
      }, 100);
    });
  }

  private async callUpstream(req: Request, endpoint: any): Promise<any> {
    // Simple upstream call
    return { message: 'Upstream response', endpoint: endpoint.upstream };
  }

  private applyTransformation(data: any, transformation: any, context: CompositionContext): any {
    // Simple transformation implementation
    if (typeof transformation === 'object') {
      return { ...data, ...transformation };
    } else if (typeof transformation === 'string') {
      return this.evaluateExpression(transformation, context);
    }
    return data;
  }

  private evaluateCondition(condition: string, context: CompositionContext): boolean {
    // Simple condition evaluation - in production, use a proper expression parser
    try {
      const func = new Function('context', `return ${condition}`);
      return func(context);
    } catch (error) {
      logger.error('Condition evaluation error:', error);
      return false;
    }
  }

  private evaluateExpression(expression: string, context: CompositionContext): any {
    // Simple expression evaluation - in production, use a proper expression parser
    try {
      const func = new Function('context', `return ${expression}`);
      return func(context);
    } catch (error) {
      logger.error('Expression evaluation error:', error);
      return null;
    }
  }

  private getStepInputs(step: CompositionStep, context: CompositionContext): any {
    if (!step.inputs) {
      return null;
    }

    const inputs: any = {};
    for (const input of step.inputs) {
      inputs[input] = context.results[input] || context.variables[input];
    }
    return inputs;
  }

  private deepMerge(...objects: any[]): any {
    const result = {};
    for (const obj of objects) {
      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (typeof obj[key] === 'object' && typeof result[key] === 'object') {
              result[key] = this.deepMerge(result[key], obj[key]);
            } else {
              result[key] = obj[key];
            }
          }
        }
      }
    }
    return result;
  }

  private joinArrays(arrays: any[], key?: string): any[] {
    if (!key) {
      return arrays.flat();
    }

    const merged = new Map();
    for (const arr of arrays) {
      for (const item of arr) {
        const keyValue = item[key];
        if (keyValue !== undefined) {
          merged.set(keyValue, { ...merged.get(keyValue), ...item });
        }
      }
    }
    return Array.from(merged.values());
  }

  private async getCachedStepResult(step: CompositionStep, context: CompositionContext): Promise<any> {
    if (!this.config.enableCaching || !step.cache?.enabled) {
      return null;
    }

    const cacheKey = this.generateStepCacheKey(step, context);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  private async setCachedStepResult(step: CompositionStep, context: CompositionContext, result: any): Promise<void> {
    if (!this.config.enableCaching || !step.cache?.enabled) {
      return;
    }

    const cacheKey = this.generateStepCacheKey(step, context);
    const ttl = step.cache.ttl || this.config.cacheTTL;

    this.cache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + ttl,
    });
  }

  private generateStepCacheKey(step: CompositionStep, context: CompositionContext): string {
    const key = step.cache?.key || `step:${step.id}`;
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

  private generateCompositionId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getActiveCompositionsCount(): number {
    return this.activeCompositions.size;
  }

  public getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  public clearCache(): void {
    this.cache.clear();
    logger.info('APIComposer cache cleared');
  }

  public getConfig(): CompositionConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<CompositionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('APIComposer configuration updated');
  }
}
