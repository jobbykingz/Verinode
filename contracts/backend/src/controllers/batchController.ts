import { Request, Response } from 'express';
import { batchService } from '../services/batchService';
import { queueService } from '../services/queueService';

export class BatchController {
  /**
   * Create a new batch operation
   */
  async createBatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || req.body.userId;
      const { type, items, config, notifications } = req.body;

      if (!type || !items || !Array.isArray(items)) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: type, items'
        });
        return;
      }

      if (items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Items array cannot be empty'
        });
        return;
      }

      if (items.length > 10000) {
        res.status(400).json({
          success: false,
          error: 'Maximum 10,000 items allowed per batch'
        });
        return;
      }

      const result = await batchService.createBatch(userId, {
        type,
        items,
        config,
        notifications
      });

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Create batch controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get batch status
   */
  async getBatchStatus(req: Request, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      const userId = (req as any).user?.id || req.query.userId as string;

      const status = await batchService.getBatchStatus(batchId, userId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Batch not found'
        });
        return;
      }

      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Get batch status controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get batch results
   */
  async getBatchResults(req: Request, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      const userId = (req as any).user?.id || req.query.userId as string;

      const result = await batchService.getBatchResults(batchId, userId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Get batch results controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Cancel a batch
   */
  async cancelBatch(req: Request, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      const userId = (req as any).user?.id || req.body.userId;

      const result = await batchService.cancelBatch(batchId, userId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Cancel batch controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Retry failed items
   */
  async retryBatch(req: Request, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      const userId = (req as any).user?.id || req.body.userId;

      const result = await batchService.retryFailedItems(batchId, userId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Retry batch controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get user batches
   */
  async getUserBatches(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || req.query.userId as string;
      const { status, type, limit = '20', offset = '0' } = req.query;

      const result = await batchService.getUserBatches(userId, {
        status: status as string,
        type: type as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get user batches controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Upload batch file
   */
  async uploadBatchFile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const file = (req as any).file;

      if (!file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
        return;
      }

      // Parse file based on mimetype
      let items: any[] = [];
      const content = file.buffer.toString('utf-8');

      if (file.mimetype === 'application/json') {
        items = JSON.parse(content);
      } else if (file.mimetype === 'text/csv') {
        items = this.parseCSV(content);
      } else {
        res.status(400).json({
          success: false,
          error: 'Unsupported file format. Use JSON or CSV'
        });
        return;
      }

      if (!Array.isArray(items)) {
        res.status(400).json({
          success: false,
          error: 'File must contain an array of items'
        });
        return;
      }

      res.json({
        success: true,
        items,
        count: items.length,
        fileName: file.originalname
      });
    } catch (error) {
      console.error('Upload batch file controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get queue status
   */
  async getQueueStatus(req: Request, res: Response): Promise<void> {
    try {
      const { queueName } = req.params;

      if (queueName) {
        const status = queueService.getQueueStatus(queueName);
        if (!status) {
          res.status(404).json({
            success: false,
            error: 'Queue not found'
          });
          return;
        }
        res.json({
          success: true,
          queue: queueName,
          status
        });
      } else {
        const statuses = queueService.getAllQueueStatuses();
        res.json({
          success: true,
          queues: statuses
        });
      }
    } catch (error) {
      console.error('Get queue status controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Export batch results
   */
  async exportResults(req: Request, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      const userId = (req as any).user?.id || req.query.userId as string;
      const format = (req.query.format as string) || 'json';

      const result = await batchService.getBatchResults(batchId, userId);

      if (!result.success || !result.items) {
        res.status(404).json(result);
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `batch_${batchId}_${timestamp}`;

      switch (format.toLowerCase()) {
        case 'csv':
          const csv = this.convertToCSV(result.items);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          res.send(csv);
          break;

        case 'json':
        default:
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
          res.json(result.items);
          break;
      }
    } catch (error) {
      console.error('Export results controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get batch analytics
   */
  async getBatchAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || req.query.userId as string;
      const { days = '30' } = req.query;

      const since = new Date();
      since.setDate(since.getDate() - parseInt(days as string));

      // Get all user batches
      const { batches } = await batchService.getUserBatches(userId, {
        limit: 1000
      });

      // Calculate analytics
      const analytics = {
        totalBatches: batches.length,
        byType: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        averageProcessingTime: 0,
        successRate: 0,
        totalItemsProcessed: 0,
        averageItemsPerBatch: 0,
        trends: {
          daily: [] as Array<{ date: string; count: number; success: number }>
        }
      };

      let totalProcessingTime = 0;
      let completedBatches = 0;
      let successfulBatches = 0;

      for (const batch of batches) {
        // Count by type
        analytics.byType[batch.type!] = (analytics.byType[batch.type!] || 0) + 1;

        // Count by status
        analytics.byStatus[batch.status!] = (analytics.byStatus[batch.status!] || 0) + 1;

        // Processing time
        if (batch.metrics?.processingTime) {
          totalProcessingTime += batch.metrics.processingTime;
        }

        if (batch.status === 'COMPLETED' || batch.status === 'FAILED') {
          completedBatches++;
          if (batch.status === 'COMPLETED') {
            successfulBatches++;
          }
        }

        analytics.totalItemsProcessed += batch.totalItems || 0;
      }

      if (completedBatches > 0) {
        analytics.averageProcessingTime = totalProcessingTime / completedBatches;
        analytics.successRate = (successfulBatches / completedBatches) * 100;
      }

      if (batches.length > 0) {
        analytics.averageItemsPerBatch = analytics.totalItemsProcessed / batches.length;
      }

      res.json({
        success: true,
        analytics
      });
    } catch (error) {
      console.error('Get batch analytics controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Parse CSV content
   */
  private parseCSV(content: string): any[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const items: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const item: any = {};
      headers.forEach((header, index) => {
        item[header] = values[index] || '';
      });
      items.push(item);
    }

    return items;
  }

  /**
   * Convert items to CSV
   */
  private convertToCSV(items: any[]): string {
    if (items.length === 0) return '';

    const headers = Object.keys(items[0]);
    const csvRows = [headers.join(',')];

    for (const item of items) {
      const values = headers.map(header => {
        const value = item[header];
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}

export const batchController = new BatchController();
