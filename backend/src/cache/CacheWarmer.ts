import { EventEmitter } from 'events';
import { WinstonLogger } from '../utils/logger';
import { CacheConfig, CachePriority, WarmingStrategy } from '../config/cache';
import { DistributedCache } from './DistributedCache';

export interface WarmingJob {
  id: string;
  name: string;
  strategy: WarmingStrategy;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  keysProcessed: number;
  totalKeys: number;
  error?: string;
  retryCount: number;
}

export interface WarmingResult {
  jobId: string;
  keysWarmed: number;
  keysFailed: number;
  duration: number;
  memoryUsed: number;
  error?: string;
}

export interface CacheWarmerOptions {
  concurrency: number;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  progressCallback?: (job: WarmingJob) => void;
}

export class CacheWarmer extends EventEmitter {
  private distributedCache: DistributedCache;
  private config: CacheConfig;
  private logger: WinstonLogger;
  private activeJobs: Map<string, WarmingJob>;
  private jobQueue: WarmingJob[];
  private isRunning: boolean = false;
  private warmingInterval?: NodeJS.Timeout;

  constructor(distributedCache: DistributedCache, config: CacheConfig) {
    super();
    this.distributedCache = distributedCache;
    this.config = config;
    this.logger = new WinstonLogger();
    this.activeJobs = new Map();
    this.jobQueue = [];
  }

  /**
   * Start the cache warming service
   */
  async start(): Promise<void> {
    try {
      if (this.config.warming.enabled) {
        this.logger.info('Starting cache warming service');
        this.isRunning = true;
        
        // Schedule periodic warming
        this.scheduleWarming();
        
        // Run initial warming
        await this.runScheduledWarming();
        
        this.emit('started');
      }
    } catch (error) {
      this.logger.error('Failed to start cache warming service', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the cache warming service
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping cache warming service');
      this.isRunning = false;
      
      if (this.warmingInterval) {
        clearInterval(this.warmingInterval);
      }
      
      // Wait for active jobs to complete
      await this.waitForActiveJobs();
      
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Failed to stop cache warming service', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Warm cache with specific strategy
   */
  async warmCache(strategy: WarmingStrategy, options?: CacheWarmerOptions): Promise<WarmingResult> {
    const jobId = this.generateJobId();
    const job: WarmingJob = {
      id: jobId,
      name: strategy.name,
      strategy,
      status: 'pending',
      progress: 0,
      keysProcessed: 0,
      totalKeys: 0,
      retryCount: 0
    };

    try {
      this.logger.info(`Starting cache warming job: ${strategy.name}`);
      this.activeJobs.set(jobId, job);
      
      job.status = 'running';
      job.startTime = new Date();
      
      const result = await this.executeWarmingJob(job, options);
      
      job.status = result.error ? 'failed' : 'completed';
      job.endTime = new Date();
      job.progress = 100;
      
      if (result.error) {
        job.error = result.error;
      }
      
      this.emit('jobCompleted', { job, result });
      return result;
      
    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error(`Cache warming job failed: ${strategy.name}`, error);
      this.emit('jobFailed', { job, error });
      
      return {
        jobId,
        keysWarmed: job.keysProcessed,
        keysFailed: 0,
        duration: job.endTime ? job.endTime.getTime() - job.startTime.getTime() : 0,
        memoryUsed: 0,
        error: job.error
      };
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Warm multiple strategies
   */
  async warmMultiple(strategies: WarmingStrategy[], options?: CacheWarmerOptions): Promise<WarmingResult[]> {
    const results: WarmingResult[] = [];
    
    for (const strategy of strategies) {
      try {
        const result = await this.warmCache(strategy, options);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to warm cache with strategy: ${strategy.name}`, error);
        results.push({
          jobId: this.generateJobId(),
          keysWarmed: 0,
          keysFailed: 0,
          duration: 0,
          memoryUsed: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  /**
   * Get warming job status
   */
  getJobStatus(jobId: string): WarmingJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): WarmingJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get warming statistics
   */
  getStatistics(): any {
    const completedJobs = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'completed');
    
    const failedJobs = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'failed');
    
    const totalKeysWarmed = completedJobs.reduce((sum, job) => sum + job.keysProcessed, 0);
    const totalDuration = completedJobs.reduce((sum, job) => {
      return sum + (job.endTime && job.startTime ? 
        job.endTime.getTime() - job.startTime.getTime() : 0);
    }, 0);

    return {
      activeJobs: this.activeJobs.size,
      queuedJobs: this.jobQueue.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      totalKeysWarmed,
      averageJobDuration: completedJobs.length > 0 ? totalDuration / completedJobs.length : 0,
      successRate: this.activeJobs.size > 0 ? 
        completedJobs.length / (completedJobs.length + failedJobs.length) : 0
    };
  }

  // Private methods

  private scheduleWarming(): void {
    const cronExpression = this.config.warming.schedule;
    
    // Parse cron expression and set interval
    // For simplicity, using setInterval with fixed interval
    const intervalMs = this.parseCronToMs(cronExpression);
    
    this.warmingInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.runScheduledWarming();
      }
    }, intervalMs);
  }

  private async runScheduledWarming(): Promise<void> {
    try {
      this.logger.info('Running scheduled cache warming');
      
      for (const strategy of this.config.warming.strategies) {
        if (this.shouldRunStrategy(strategy)) {
          await this.warmCache(strategy, {
            concurrency: this.config.warming.concurrency,
            batchSize: this.config.warming.batchSize,
            retryAttempts: 3,
            retryDelay: 1000,
            progressCallback: (job) => this.emit('progress', job)
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to run scheduled warming', error);
      this.emit('error', error);
    }
  }

  private shouldRunStrategy(strategy: WarmingStrategy): boolean {
    // Check if strategy should run based on conditions
    if (!strategy.config.conditions) {
      return true;
    }

    // Implement condition checking logic
    // For now, always return true
    return true;
  }

  private async executeWarmingJob(job: WarmingJob, options?: CacheWarmerOptions): Promise<WarmingResult> {
    const startTime = Date.now();
    const opts = options || {
      concurrency: this.config.warming.concurrency,
      batchSize: this.config.warming.batchSize,
      retryAttempts: 3,
      retryDelay: 1000
    };

    try {
      switch (job.strategy.type) {
        case 'precompute':
          return await this.executePrecomputeStrategy(job, opts);
        case 'predictive':
          return await this.executePredictiveStrategy(job, opts);
        case 'scheduled':
          return await this.executeScheduledStrategy(job, opts);
        case 'event-driven':
          return await this.executeEventDrivenStrategy(job, opts);
        default:
          throw new Error(`Unknown warming strategy type: ${job.strategy.type}`);
      }
    } catch (error) {
      return {
        jobId: job.id,
        keysWarmed: job.keysProcessed,
        keysFailed: 0,
        duration: Date.now() - startTime,
        memoryUsed: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executePrecomputeStrategy(job: WarmingJob, options: CacheWarmerOptions): Promise<WarmingResult> {
    const { dataSources, batchSize } = job.strategy.config;
    let keysWarmed = 0;
    let keysFailed = 0;

    for (const dataSource of dataSources) {
      try {
        const data = await this.fetchDataSourceData(dataSource);
        const batches = this.createBatches(data, batchSize);
        
        for (const batch of batches) {
          await this.processBatch(batch, job, options);
          keysWarmed += batch.length;
          job.keysProcessed = keysWarmed;
          job.progress = (keysWarmed / job.totalKeys) * 100;
          
          if (options.progressCallback) {
            options.progressCallback(job);
          }
        }
      } catch (error) {
        keysFailed++;
        this.logger.error(`Failed to warm data source: ${dataSource}`, error);
      }
    }

    return {
      jobId: job.id,
      keysWarmed,
      keysFailed,
      duration: Date.now() - (job.startTime?.getTime() || Date.now()),
      memoryUsed: 0
    };
  }

  private async executePredictiveStrategy(job: WarmingJob, options: CacheWarmerOptions): Promise<WarmingResult> {
    // Implement predictive warming based on access patterns
    const predictedKeys = await this.getPredictedKeys(job.strategy.config.dataSources);
    const batches = this.createBatches(predictedKeys, options.batchSize);
    let keysWarmed = 0;

    for (const batch of batches) {
      await this.processBatch(batch, job, options);
      keysWarmed += batch.length;
      job.keysProcessed = keysWarmed;
      job.progress = (keysWarmed / job.totalKeys) * 100;
      
      if (options.progressCallback) {
        options.progressCallback(job);
      }
    }

    return {
      jobId: job.id,
      keysWarmed,
      keysFailed: 0,
      duration: Date.now() - (job.startTime?.getTime() || Date.now()),
      memoryUsed: 0
    };
  }

  private async executeScheduledStrategy(job: WarmingJob, options: CacheWarmerOptions): Promise<WarmingResult> {
    // Similar to precompute but based on schedule
    return this.executePrecomputeStrategy(job, options);
  }

  private async executeEventDrivenStrategy(job: WarmingJob, options: CacheWarmerOptions): Promise<WarmingResult> {
    // Implement event-driven warming
    // For now, return empty result
    return {
      jobId: job.id,
      keysWarmed: 0,
      keysFailed: 0,
      duration: 0,
      memoryUsed: 0
    };
  }

  private async fetchDataSourceData(dataSource: string): Promise<any[]> {
    // This would integrate with actual data sources
    // For now, return mock data
    switch (dataSource) {
      case 'user_profiles':
        return this.getMockUserProfiles();
      case 'user_preferences':
        return this.getMockUserPreferences();
      case 'proofs':
        return this.getMockProofs();
      case 'proof_metadata':
        return this.getMockProofMetadata();
      default:
        return [];
    }
  }

  private async getPredictedKeys(dataSources: string[]): Promise<string[]> {
    // Implement predictive logic based on access patterns
    // For now, return empty array
    return [];
  }

  private createBatches<T>(data: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processBatch(batch: any[], job: WarmingJob, options: CacheWarmerOptions): Promise<void> {
    const promises = batch.map(async (item) => {
      try {
        const key = this.generateCacheKey(item);
        const ttl = this.calculateTTL(item, job.strategy);
        await this.distributedCache.set(key, item, ttl);
      } catch (error) {
        this.logger.error(`Failed to process batch item`, error);
      }
    });

    // Limit concurrency
    const concurrencyLimit = Math.min(options.concurrency, batch.length);
    for (let i = 0; i < promises.length; i += concurrencyLimit) {
      await Promise.all(promises.slice(i, i + concurrencyLimit));
    }
  }

  private generateCacheKey(item: any): string {
    // Generate cache key based on item type and ID
    if (item.id && item.type) {
      return `${item.type}:${item.id}`;
    }
    return `item:${JSON.stringify(item)}`;
  }

  private calculateTTL(item: any, strategy: WarmingStrategy): number {
    // Calculate TTL based on item and strategy
    return strategy.config.frequency ? 
      this.parseFrequencyToSeconds(strategy.config.frequency) : 
      this.config.levels.l2.ttl;
  }

  private async waitForActiveJobs(): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseCronToMs(cronExpression: string): number {
    // Simplified cron parsing - would use proper cron library
    return 600000; // 10 minutes default
  }

  private parseFrequencyToSeconds(frequency: string): number {
    // Parse frequency string to seconds
    // Simplified implementation
    return 3600; // 1 hour default
  }

  // Mock data methods (would be replaced with actual data fetching)

  private async getMockUserProfiles(): Promise<any[]> {
    return Array.from({ length: 100 }, (_, i) => ({
      id: `user_${i}`,
      type: 'user_profile',
      name: `User ${i}`,
      email: `user${i}@example.com`,
      preferences: {}
    }));
  }

  private async getMockUserPreferences(): Promise<any[]> {
    return Array.from({ length: 50 }, (_, i) => ({
      id: `prefs_${i}`,
      type: 'user_preferences',
      userId: `user_${i}`,
      theme: 'dark',
      language: 'en'
    }));
  }

  private async getMockProofs(): Promise<any[]> {
    return Array.from({ length: 200 }, (_, i) => ({
      id: `proof_${i}`,
      type: 'proof',
      title: `Proof ${i}`,
      content: `Content for proof ${i}`,
      createdAt: new Date()
    }));
  }

  private async getMockProofMetadata(): Promise<any[]> {
    return Array.from({ length: 100 }, (_, i) => ({
      id: `meta_${i}`,
      type: 'proof_metadata',
      proofId: `proof_${i}`,
      metadata: { category: 'test', tags: ['tag1', 'tag2'] }
    }));
  }
}
