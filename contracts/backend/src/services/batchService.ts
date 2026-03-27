import crypto from 'crypto';
import { BatchOperation, IBatchOperation } from '../models/BatchOperation';
import { BatchItem, IBatchItem } from '../models/BatchItem';
import { queueService } from './queueService';

export interface BatchCreateRequest {
  type: 'CREATE' | 'VERIFY' | 'UPDATE' | 'DELETE' | 'EXPORT';
  items: any[];
  config?: {
    parallelProcessing?: boolean;
    maxConcurrency?: number;
    retryAttempts?: number;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  };
  notifications?: {
    onComplete?: boolean;
    onError?: boolean;
    email?: string;
  };
}

export interface BatchResult {
  success: boolean;
  batchId?: string;
  totalItems: number;
  status: string;
  error?: string;
}

export interface BatchStatus {
  batchId: string;
  status: string;
  progress: {
    percentage: number;
    processed: number;
    total: number;
    successful: number;
    failed: number;
    estimatedTimeRemaining: number;
  };
  stages: string[];
  errors: Array<{
    itemId: string;
    errorCode: string;
    errorMessage: string;
  }>;
}

export class BatchService {
  private readonly DEFAULT_CONFIG = {
    parallelProcessing: true,
    maxConcurrency: 10,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
    priority: 'NORMAL' as const
  };

  /**
   * Create a new batch operation
   */
  async createBatch(
    userId: string,
    request: BatchCreateRequest
  ): Promise<BatchResult> {
    try {
      const batchId = this.generateBatchId();
      const config = { ...this.DEFAULT_CONFIG, ...request.config };

      // Create batch operation
      const batchOperation = new BatchOperation({
        batchId,
        userId,
        type: request.type,
        status: 'PENDING',
        totalItems: request.items.length,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        skippedItems: 0,
        progress: {
          percentage: 0,
          currentStage: 'INITIALIZING',
          stageProgress: 0,
          estimatedTimeRemaining: 0
        },
        config,
        input: {
          source: 'API',
          data: request.items,
          options: {}
        },
        output: {
          format: 'JSON'
        },
        batchErrors: [],
        metrics: {
          processingTime: 0,
          averageItemTime: 0,
          throughput: 0,
          memoryUsage: 0,
          cpuUsage: 0
        },
        queue: {
          queueName: this.getQueueName(request.type, config.priority),
          attempts: 0,
          maxAttempts: config.retryAttempts
        },
        notifications: {
          onStart: false,
          onComplete: request.notifications?.onComplete ?? true,
          onError: request.notifications?.onError ?? true,
          email: request.notifications?.email
        }
      });

      await batchOperation.save();

      // Create batch items
      const batchItems = request.items.map((item, index) =>
        this.createBatchItem(batchId, userId, index, item, request.type)
      );

      await BatchItem.insertMany(batchItems);

      // Queue the batch for processing
      await queueService.addJob(batchOperation.queue.queueName, {
        batchId,
        userId,
        type: request.type
      }, {
        priority: this.getPriorityValue(config.priority),
        attempts: config.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: config.retryDelay
        }
      });

      // Update status to queued
      batchOperation.status = 'QUEUED';
      await batchOperation.save();

      return {
        success: true,
        batchId,
        totalItems: request.items.length,
        status: 'QUEUED'
      };
    } catch (error) {
      console.error('Create batch error:', error);
      return {
        success: false,
        totalItems: request.items.length,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Failed to create batch'
      };
    }
  }

  /**
   * Process a batch operation
   */
  async processBatch(batchId: string): Promise<void> {
    const batchOperation = await BatchOperation.findOne({ batchId });
    if (!batchOperation) {
      throw new Error(`Batch ${batchId} not found`);
    }

    try {
      // Update status to processing
      batchOperation.status = 'PROCESSING';
      batchOperation.progress.startedAt = new Date();
      batchOperation.progress.currentStage = 'PROCESSING';
      await batchOperation.save();

      // Get all pending items
      const items = await BatchItem.find({
        batchId,
        status: { $in: ['PENDING', 'RETRYING'] }
      }).sort({ index: 1 });

      if (batchOperation.config.parallelProcessing) {
        await this.processItemsParallel(batchOperation, items);
      } else {
        await this.processItemsSequential(batchOperation, items);
      }

      // Complete batch
      const success = batchOperation.failedItems === 0 ||
        (batchOperation.failedItems / batchOperation.totalItems) < 0.1; // Allow 10% failure rate

      await (batchOperation as any).complete(success);

      // Send notifications
      if (batchOperation.notifications.onComplete) {
        await this.sendCompletionNotification(batchOperation);
      }
    } catch (error) {
      console.error(`Process batch ${batchId} error:`, error);
      batchOperation.status = 'FAILED';
      await batchOperation.save();

      if (batchOperation.notifications.onError) {
        await this.sendErrorNotification(batchOperation, error as Error);
      }
    }
  }

  /**
   * Process items in parallel
   */
  private async processItemsParallel(
    batchOperation: IBatchOperation,
    items: IBatchItem[]
  ): Promise<void> {
    const concurrency = batchOperation.config.maxConcurrency;
    const chunks = this.chunkArray(items, concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(item => this.processItem(batchOperation, item));
      await Promise.all(promises);

      // Update progress after each chunk
      await this.updateBatchProgress(batchOperation);
    }
  }

  /**
   * Process items sequentially
   */
  private async processItemsSequential(
    batchOperation: IBatchOperation,
    items: IBatchItem[]
  ): Promise<void> {
    for (const item of items) {
      await this.processItem(batchOperation, item);
      await this.updateBatchProgress(batchOperation);
    }
  }

  /**
   * Process a single item
   */
  private async processItem(
    batchOperation: IBatchOperation,
    item: IBatchItem
  ): Promise<void> {
    const startTime = Date.now();

    try {
      await (item as any).startProcessing();

      // Process based on batch type
      switch (batchOperation.type) {
        case 'CREATE':
          await this.processCreateItem(item);
          break;
        case 'VERIFY':
          await this.processVerifyItem(item);
          break;
        case 'UPDATE':
          await this.processUpdateItem(item);
          break;
        case 'DELETE':
          await this.processDeleteItem(item);
          break;
        case 'EXPORT':
          await this.processExportItem(item);
          break;
      }

      await (item as any).complete(true);
      batchOperation.successfulItems += 1;
    } catch (error) {
      console.error(`Process item ${item.itemId} error:`, error);

      const errorDetails = error as Error;
      await (item as any).addError(
        'PROCESSING_ERROR',
        errorDetails.message,
        { stack: errorDetails.stack }
      );

      // Check if should retry
      if (item.retry.count < item.retry.maxRetries) {
        await (item as any).markForRetry('Processing failed', batchOperation.config.retryDelay);
      } else {
        await (item as any).complete(false);
        batchOperation.failedItems += 1;

        await (batchOperation as any).addError({
          itemId: item.itemId,
          itemIndex: item.index,
          errorCode: 'PROCESSING_ERROR',
          errorMessage: errorDetails.message,
          retryable: false,
          retryCount: item.retry.count
        });
      }
    }

    batchOperation.processedItems += 1;
    item.metrics.processingTime = Date.now() - startTime;
    await item.save();
  }

  /**
   * Process create item
   */
  private async processCreateItem(item: IBatchItem): Promise<void> {
    // Mock implementation - replace with actual proof creation logic
    await new Promise(resolve => setTimeout(resolve, 100));
    
    item.output.proofId = `proof_${crypto.randomBytes(8).toString('hex')}`;
    item.output.transactionHash = `tx_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Process verify item
   */
  private async processVerifyItem(item: IBatchItem): Promise<void> {
    // Mock implementation - replace with actual verification logic
    await new Promise(resolve => setTimeout(resolve, 50));
    
    item.output.verificationResult = {
      valid: Math.random() > 0.1,
      confidence: 0.8 + Math.random() * 0.2,
      details: {
        timestamp: new Date(),
        method: 'cryptographic'
      }
    };
  }

  /**
   * Process update item
   */
  private async processUpdateItem(item: IBatchItem): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 80));
    item.output.data = { ...item.input.data, updated: true };
  }

  /**
   * Process delete item
   */
  private async processDeleteItem(item: IBatchItem): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    item.output.data = { deleted: true };
  }

  /**
   * Process export item
   */
  private async processExportItem(item: IBatchItem): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    item.output.data = item.input.data;
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string, userId: string): Promise<BatchStatus | null> {
    const batchOperation = await BatchOperation.findOne({ batchId, userId });
    if (!batchOperation) return null;

    const recentErrors = batchOperation.batchErrors.slice(-10);

    return {
      batchId: batchOperation.batchId,
      status: batchOperation.status,
      progress: {
        percentage: batchOperation.progress.percentage,
        processed: batchOperation.processedItems,
        total: batchOperation.totalItems,
        successful: batchOperation.successfulItems,
        failed: batchOperation.failedItems,
        estimatedTimeRemaining: batchOperation.progress.estimatedTimeRemaining
      },
      stages: [batchOperation.progress.currentStage],
      errors: recentErrors.map(e => ({
        itemId: e.itemId,
        errorCode: e.errorCode,
        errorMessage: e.errorMessage
      }))
    };
  }

  /**
   * Get batch results
   */
  async getBatchResults(batchId: string, userId: string): Promise<{
    success: boolean;
    items?: any[];
    summary?: {
      total: number;
      successful: number;
      failed: number;
      processingTime: number;
    };
    error?: string;
  }> {
    try {
      const batchOperation = await BatchOperation.findOne({ batchId, userId });
      if (!batchOperation) {
        return { success: false, error: 'Batch not found' };
      }

      const items = await BatchItem.find({ batchId })
        .select('itemId index status input output error')
        .sort({ index: 1 });

      return {
        success: true,
        items: items.map(item => ({
          itemId: item.itemId,
          index: item.index,
          status: item.status,
          input: item.input.data,
          output: item.output,
          error: item.output.error
        })),
        summary: {
          total: batchOperation.totalItems,
          successful: batchOperation.successfulItems,
          failed: batchOperation.failedItems,
          processingTime: batchOperation.metrics.processingTime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get results'
      };
    }
  }

  /**
   * Cancel a batch operation
   */
  async cancelBatch(batchId: string, userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const batchOperation = await BatchOperation.findOne({ batchId, userId });
      if (!batchOperation) {
        return { success: false, error: 'Batch not found' };
      }

      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(batchOperation.status)) {
        return { success: false, error: 'Batch cannot be cancelled' };
      }

      // Remove from queue
      await queueService.removeJob(
        batchOperation.queue.queueName,
        batchOperation.queue.jobId
      );

      batchOperation.status = 'CANCELLED';
      await batchOperation.save();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel batch'
      };
    }
  }

  /**
   * Retry failed items
   */
  async retryFailedItems(batchId: string, userId: string): Promise<{
    success: boolean;
    retriedCount?: number;
    error?: string;
  }> {
    try {
      const batchOperation = await BatchOperation.findOne({ batchId, userId });
      if (!batchOperation) {
        return { success: false, error: 'Batch not found' };
      }

      const failedItems = await BatchItem.find({
        batchId,
        status: 'FAILED',
        'retry.count': { $lt: batchOperation.config.retryAttempts }
      });

      for (const item of failedItems) {
        await (item as any).markForRetry('Manual retry');
      }

      // Re-queue batch
      await queueService.addJob(batchOperation.queue.queueName, {
        batchId,
        userId,
        type: batchOperation.type
      });

      batchOperation.status = 'QUEUED';
      await batchOperation.save();

      return {
        success: true,
        retriedCount: failedItems.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry items'
      };
    }
  }

  /**
   * Get user batches
   */
  async getUserBatches(
    userId: string,
    options: {
      status?: string;
      type?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    batches: Partial<IBatchOperation>[];
    total: number;
  }> {
    const query: any = { userId };
    if (options.status) query.status = options.status;
    if (options.type) query.type = options.type;

    const [batches, total] = await Promise.all([
      BatchOperation.find(query)
        .sort({ createdAt: -1 })
        .skip(options.offset || 0)
        .limit(options.limit || 20)
        .select('-batchErrors'),
      BatchOperation.countDocuments(query)
    ]);

    return { batches, total };
  }

  /**
   * Update batch progress
   */
  private async updateBatchProgress(batchOperation: IBatchOperation): Promise<void> {
    await (batchOperation as any).updateProgress(
      batchOperation.processedItems,
      batchOperation.successfulItems,
      batchOperation.failedItems
    );
  }

  /**
   * Create batch item
   */
  private createBatchItem(
    batchId: string,
    userId: string,
    index: number,
    data: any,
    type: string
  ): Partial<IBatchItem> {
    return {
      itemId: `item_${crypto.randomBytes(8).toString('hex')}`,
      batchId,
      userId,
      index,
      input: {
        type: type as any,
        data
      },
      status: 'PENDING',
      stages: this.getProcessingStages(type),
      retry: {
        count: 0,
        maxRetries: 3
      },
      metrics: {
        processingTime: 0,
        queueTime: 0,
        attempts: 0,
        stageTimings: {}
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: []
      },
      dependencies: {
        itemIds: [],
        resolved: true
      }
    };
  }

  /**
   * Get processing stages based on type
   */
  private getProcessingStages(type: string): Array<{ name: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' }> {
    const commonStages: Array<{ name: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' }> = [
      { name: 'VALIDATION', status: 'PENDING' },
      { name: 'PROCESSING', status: 'PENDING' },
      { name: 'COMPLETION', status: 'PENDING' }
    ];

    switch (type) {
      case 'CREATE':
        return [
          { name: 'VALIDATION', status: 'PENDING' },
          { name: 'DATA_PREP', status: 'PENDING' },
          { name: 'BLOCKCHAIN_SUBMIT', status: 'PENDING' },
          { name: 'CONFIRMATION', status: 'PENDING' },
          { name: 'COMPLETION', status: 'PENDING' }
        ];
      case 'VERIFY':
        return [
          { name: 'VALIDATION', status: 'PENDING' },
          { name: 'FETCH_PROOF', status: 'PENDING' },
          { name: 'VERIFICATION', status: 'PENDING' },
          { name: 'COMPLETION', status: 'PENDING' }
        ];
      default:
        return commonStages;
    }
  }

  /**
   * Get queue name based on type and priority
   */
  private getQueueName(type: string, priority: string): string {
    if (priority === 'CRITICAL') return 'critical';
    if (priority === 'HIGH') return 'high';
    return `batch_${type.toLowerCase()}`;
  }

  /**
   * Get priority value for queue
   */
  private getPriorityValue(priority: string): number {
    const priorities: Record<string, number> = {
      CRITICAL: 1,
      HIGH: 2,
      NORMAL: 3,
      LOW: 4
    };
    return priorities[priority] || 3;
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(batchOperation: IBatchOperation): Promise<void> {
    // Mock implementation - replace with actual notification logic
    console.log(`Batch ${batchOperation.batchId} completed`);
  }

  /**
   * Send error notification
   */
  private async sendErrorNotification(
    batchOperation: IBatchOperation,
    error: Error
  ): Promise<void> {
    console.error(`Batch ${batchOperation.batchId} failed:`, error.message);
  }

  /**
   * Chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `batch_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;
  }
}

export const batchService = new BatchService();
