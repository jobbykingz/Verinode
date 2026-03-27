import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EncryptionService, ComputationRequest, ComputationResult } from './EncryptionService';
import { HomomorphicEncryption, EncryptedData } from '../encryption/HomomorphicEncryption';
import { MonitoringService } from '../monitoringService';

export interface ComputationJob {
  id: string;
  type: 'proof_verification' | 'data_analysis' | 'privacy_preserving_computation';
  encryptedProofIds: string[];
  operations: ComputationRequest[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  requester: string;
  results: ComputationResult[];
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface BatchComputationRequest {
  jobs: ComputationJob[];
  priority: 'low' | 'normal' | 'high';
  timeout?: number;
}

@Injectable()
export class ComputationService {
  private readonly logger = new Logger(ComputationService.name);
  private readonly activeJobs = new Map<string, ComputationJob>();
  private readonly jobQueue: ComputationJob[] = [];
  private isProcessing = false;

  constructor(
    @InjectModel('ComputationJob') private jobModel: Model<ComputationJob>,
    private encryptionService: EncryptionService,
    private he: HomomorphicEncryption,
    private monitoringService: MonitoringService,
  ) {}

  async onModuleInit() {
    // Start job processor
    this.startJobProcessor();
  }

  async submitComputationJob(
    type: ComputationJob['type'],
    encryptedProofIds: string[],
    operations: ComputationRequest[],
    requester: string
  ): Promise<string> {
    try {
      const job: ComputationJob = {
        id: this.generateJobId(),
        type,
        encryptedProofIds,
        operations,
        status: 'pending',
        requester,
        results: [],
        createdAt: new Date(),
      };

      // Save to database
      const savedJob = new this.jobModel(job);
      await savedJob.save();

      // Add to queue
      this.jobQueue.push(job);
      this.activeJobs.set(job.id, job);

      this.logger.log(`Computation job ${job.id} submitted by ${requester}`);

      await this.monitoringService.recordMetric('computation.job.submitted', 1, {
        type,
        operationCount: operations.length.toString(),
      });

      return job.id;
    } catch (error) {
      this.logger.error('Failed to submit computation job:', error);
      throw error;
    }
  }

  async submitBatchComputation(request: BatchComputationRequest): Promise<string[]> {
    const jobIds: string[] = [];

    try {
      for (const job of request.jobs) {
        const jobId = await this.submitComputationJob(
          job.type,
          job.encryptedProofIds,
          job.operations,
          job.requester
        );
        jobIds.push(jobId);
      }

      this.logger.log(`Batch computation submitted with ${jobIds.length} jobs`);
      return jobIds;
    } catch (error) {
      this.logger.error('Failed to submit batch computation:', error);
      throw error;
    }
  }

  async getJobStatus(jobId: string, requester: string): Promise<ComputationJob> {
    try {
      const job = await this.jobModel.findById(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Check if requester has access to this job
      if (job.requester !== requester) {
        throw new Error('Access denied');
      }

      return job;
    } catch (error) {
      this.logger.error(`Failed to get job status for ${jobId}:`, error);
      throw error;
    }
  }

  async cancelJob(jobId: string, requester: string): Promise<void> {
    try {
      const job = await this.jobModel.findById(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      if (job.requester !== requester) {
        throw new Error('Access denied');
      }

      if (job.status === 'running') {
        throw new Error('Cannot cancel running job');
      }

      job.status = 'failed';
      job.error = 'Cancelled by user';
      await job.save();

      // Remove from queue if pending
      const queueIndex = this.jobQueue.findIndex(j => j.id === jobId);
      if (queueIndex > -1) {
        this.jobQueue.splice(queueIndex, 1);
      }

      this.activeJobs.delete(jobId);

      this.logger.log(`Job ${jobId} cancelled by ${requester}`);
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error);
      throw error;
    }
  }

  private async startJobProcessor() {
    setInterval(async () => {
      if (this.isProcessing || this.jobQueue.length === 0) {
        return;
      }

      this.isProcessing = true;

      try {
        const job = this.jobQueue.shift();
        if (job) {
          await this.processJob(job);
        }
      } catch (error) {
        this.logger.error('Job processing error:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 1000); // Process every second
  }

  private async processJob(job: ComputationJob): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(`Starting computation job ${job.id}`);
      job.status = 'running';
      await this.jobModel.findByIdAndUpdate(job.id, { status: 'running' });

      // Process each operation
      for (const operation of job.operations) {
        const result = await this.encryptionService.performComputation(
          job.encryptedProofIds[0], // For simplicity, using first proof ID
          operation,
          job.requester
        );

        job.results.push(result);

        // Check if operation failed
        if (!result.success) {
          throw new Error(`Operation failed: ${result.error}`);
        }
      }

      job.status = 'completed';
      job.completedAt = new Date();
      await this.jobModel.findByIdAndUpdate(job.id, {
        status: 'completed',
        results: job.results,
        completedAt: job.completedAt,
      });

      const processingTime = Date.now() - startTime;
      this.logger.log(`Job ${job.id} completed in ${processingTime}ms`);

      await this.monitoringService.recordMetric('computation.job.completed', 1, {
        type: job.type,
        processingTime: processingTime.toString(),
      });

    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);

      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();

      await this.jobModel.findByIdAndUpdate(job.id, {
        status: 'failed',
        error: job.error,
        completedAt: job.completedAt,
      });

      await this.monitoringService.recordMetric('computation.job.failed', 1, {
        type: job.type,
      });
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  async performPrivacyPreservingVerification(
    encryptedProofId: string,
    verificationCriteria: any,
    requester: string
  ): Promise<ComputationResult[]> {
    try {
      // Convert verification criteria to encrypted operations
      const operations: ComputationRequest[] = this.buildVerificationOperations(verificationCriteria);

      const jobId = await this.submitComputationJob(
        'proof_verification',
        [encryptedProofId],
        operations,
        requester
      );

      // Wait for completion (in production, you'd use websockets or polling)
      let job: ComputationJob;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        job = await this.getJobStatus(jobId, requester);
      } while (job.status === 'pending' || job.status === 'running');

      if (job.status === 'failed') {
        throw new Error(`Verification failed: ${job.error}`);
      }

      return job.results;
    } catch (error) {
      this.logger.error('Privacy-preserving verification failed:', error);
      throw error;
    }
  }

  async performDataAnalysis(
    encryptedProofIds: string[],
    analysisType: 'sum' | 'average' | 'comparison',
    requester: string
  ): Promise<ComputationResult[]> {
    try {
      const operations: ComputationRequest[] = [];

      switch (analysisType) {
        case 'sum':
          // Sum all encrypted values
          operations.push({
            operation: 'add',
            operands: [], // Will be populated with encrypted data
          });
          break;

        case 'average':
          // Sum then divide by count (simplified)
          operations.push({
            operation: 'add',
            operands: [],
          });
          // Note: Division would require additional homomorphic operations
          break;

        case 'comparison':
          // Compare encrypted values
          operations.push({
            operation: 'add',
            operands: [],
          });
          break;
      }

      const jobId = await this.submitComputationJob(
        'data_analysis',
        encryptedProofIds,
        operations,
        requester
      );

      // Wait for completion
      let job: ComputationJob;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        job = await this.getJobStatus(jobId, requester);
      } while (job.status === 'pending' || job.status === 'running');

      if (job.status === 'failed') {
        throw new Error(`Data analysis failed: ${job.error}`);
      }

      return job.results;
    } catch (error) {
      this.logger.error('Data analysis failed:', error);
      throw error;
    }
  }

  private buildVerificationOperations(criteria: any): ComputationRequest[] {
    // Build homomorphic operations based on verification criteria
    const operations: ComputationRequest[] = [];

    // Example: Verify proof timestamp is within range
    if (criteria.timestampRange) {
      operations.push({
        operation: 'add',
        operands: [], // Encrypted timestamp would be compared
      });
    }

    // Example: Verify proof hash matches expected pattern
    if (criteria.hashVerification) {
      operations.push({
        operation: 'multiply',
        operands: [],
      });
    }

    return operations;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getActiveJobs(requester: string): Promise<ComputationJob[]> {
    try {
      return await this.jobModel.find({
        requester,
        status: { $in: ['pending', 'running'] }
      }).sort({ createdAt: -1 });
    } catch (error) {
      this.logger.error('Failed to get active jobs:', error);
      throw error;
    }
  }

  async getJobHistory(requester: string, limit = 50): Promise<ComputationJob[]> {
    try {
      return await this.jobModel.find({ requester })
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (error) {
      this.logger.error('Failed to get job history:', error);
      throw error;
    }
  }

  async getComputationStats(): Promise<any> {
    try {
      const totalJobs = await this.jobModel.countDocuments();
      const completedJobs = await this.jobModel.countDocuments({ status: 'completed' });
      const failedJobs = await this.jobModel.countDocuments({ status: 'failed' });
      const pendingJobs = await this.jobModel.countDocuments({ status: 'pending' });

      const avgCompletionTime = await this.jobModel.aggregate([
        { $match: { status: 'completed', completedAt: { $exists: true } } },
        {
          $group: {
            _id: null,
            avgTime: { $avg: { $subtract: ['$completedAt', '$createdAt'] } }
          }
        }
      ]);

      return {
        totalJobs,
        completedJobs,
        failedJobs,
        pendingJobs,
        successRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
        averageCompletionTime: avgCompletionTime[0]?.avgTime || 0,
        activeJobs: this.activeJobs.size,
        queuedJobs: this.jobQueue.length,
      };
    } catch (error) {
      this.logger.error('Failed to get computation stats:', error);
      throw error;
    }
  }

  async cleanupOldJobs(daysOld = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.jobModel.deleteMany({
        createdAt: { $lt: cutoffDate },
        status: { $in: ['completed', 'failed'] }
      });

      this.logger.log(`Cleaned up ${result.deletedCount} old jobs`);
      return result.deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old jobs:', error);
      throw error;
    }
  }
}