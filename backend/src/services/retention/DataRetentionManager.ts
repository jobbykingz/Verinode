import { AuditLog, IAuditLog } from '../models/AuditLog';
import { AuditStorage } from '../audit/AuditStorage';
import { auditService } from '../services/audit/AuditService';
import winston from 'winston';
import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';

/**
 * Retention Policy Configuration
 */
export interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    minAge: number; // days
    maxAge?: number; // days
    severity?: string[]; // severities to retain
    eventTypes?: string[]; // specific event types to retain
    complianceFrameworks?: string[]; // compliance requirements
    customFilter?: any; // MongoDB filter
  };
  actions: {
    archive: boolean;
    delete: boolean;
    compress: boolean;
    encrypt: boolean;
    exportBeforeDelete?: boolean;
    exportFormat?: 'json' | 'csv' | 'xml';
  };
  schedule: {
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    timezone: string;
    time?: string; // HH:MM format
    dayOfWeek?: number; // 0-6 (Sunday-Saturday)
    dayOfMonth?: number; // 1-31
  };
  notifications: {
    enabled: boolean;
    email?: string[];
    webhook?: string;
    onFailure: boolean;
    onSuccess: boolean;
  };
}

/**
 * Archive Metadata
 */
export interface ArchiveMetadata {
  archiveId: string;
  policyId: string;
  createdAt: Date;
  recordCount: number;
  sizeBytes: number;
  compressed: boolean;
  encrypted: boolean;
  retentionPeriod: number;
  expiresAt?: Date;
  checksum: string;
  location: string;
}

/**
 * Retention Statistics
 */
export interface RetentionStatistics {
  totalRecords: number;
  archivedRecords: number;
  deletedRecords: number;
  pendingArchival: number;
  pendingDeletion: number;
  storageSaved: number; // bytes
  lastRun?: Date;
  nextRun?: Date;
  activePolicies: number;
  failedPolicies: number;
}

/**
 * Data Retention Manager
 * 
 * Manages data retention policies and automated archiving:
 * - Configurable retention policies
 * - Automated archival and deletion
 * - Compliance-based retention rules
 * - Scheduled execution
 * - Performance optimization
 * - Audit trail of retention actions
 */
export class DataRetentionManager {
  private logger: winston.Logger;
  private policies: Map<string, RetentionPolicy> = new Map();
  private archiveMetadata: Map<string, ArchiveMetadata> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;
  private storage: AuditStorage;

  constructor(storage: AuditStorage) {
    this.storage = storage;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/data-retention.log' }),
        new winston.transports.Console()
      ]
    });

    this.initializeDefaultPolicies();
  }

  /**
   * Initialize the retention manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing data retention manager...');

      // Load existing policies
      await this.loadPolicies();
      
      // Load archive metadata
      await this.loadArchiveMetadata();
      
      // Schedule active policies
      await this.scheduleActivePolicies();

      this.isRunning = true;
      this.logger.info('Data retention manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize data retention manager', { error });
      throw error;
    }
  }

  /**
   * Create a new retention policy
   */
  async createPolicy(policy: Omit<RetentionPolicy, 'id'>): Promise<RetentionPolicy> {
    try {
      const newPolicy: RetentionPolicy = {
        ...policy,
        id: `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // Validate policy
      this.validatePolicy(newPolicy);

      // Save policy
      this.policies.set(newPolicy.id, newPolicy);
      await this.savePolicies();

      // Schedule if enabled
      if (newPolicy.enabled) {
        await this.schedulePolicy(newPolicy);
      }

      this.logger.info('Retention policy created', { policyId: newPolicy.id, name: newPolicy.name });
      
      return newPolicy;
    } catch (error) {
      this.logger.error('Failed to create retention policy', { error });
      throw error;
    }
  }

  /**
   * Update an existing retention policy
   */
  async updatePolicy(policyId: string, updates: Partial<RetentionPolicy>): Promise<RetentionPolicy> {
    try {
      const existing = this.policies.get(policyId);
      if (!existing) {
        throw new Error(`Policy not found: ${policyId}`);
      }

      const updated: RetentionPolicy = { ...existing, ...updates };
      
      // Validate updated policy
      this.validatePolicy(updated);

      // Unschedule existing task
      if (this.scheduledTasks.has(policyId)) {
        this.scheduledTasks.get(policyId)!.stop();
        this.scheduledTasks.delete(policyId);
      }

      // Update policy
      this.policies.set(policyId, updated);
      await this.savePolicies();

      // Reschedule if enabled
      if (updated.enabled) {
        await this.schedulePolicy(updated);
      }

      this.logger.info('Retention policy updated', { policyId, name: updated.name });
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to update retention policy', { error, policyId });
      throw error;
    }
  }

  /**
   * Delete a retention policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error(`Policy not found: ${policyId}`);
      }

      // Stop scheduled task
      if (this.scheduledTasks.has(policyId)) {
        this.scheduledTasks.get(policyId)!.stop();
        this.scheduledTasks.delete(policyId);
      }

      // Remove policy
      this.policies.delete(policyId);
      await this.savePolicies();

      this.logger.info('Retention policy deleted', { policyId, name: policy.name });
    } catch (error) {
      this.logger.error('Failed to delete retention policy', { error, policyId });
      throw error;
    }
  }

  /**
   * Get all retention policies
   */
  getPolicies(): RetentionPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get a specific retention policy
   */
  getPolicy(policyId: string): RetentionPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Execute a retention policy manually
   */
  async executePolicy(policyId: string): Promise<{
    archived: number;
    deleted: number;
    errors: string[];
  }> {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error(`Policy not found: ${policyId}`);
      }

      this.logger.info('Executing retention policy', { policyId, name: policy.name });

      const result = await this.processRetentionPolicy(policy);
      
      // Log execution
      await this.logPolicyExecution(policy, result);
      
      // Send notifications
      if (policy.notifications.enabled) {
        await this.sendNotifications(policy, result);
      }

      this.logger.info('Retention policy executed successfully', {
        policyId,
        archived: result.archived,
        deleted: result.deleted,
        errors: result.errors.length
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to execute retention policy', { error, policyId });
      throw error;
    }
  }

  /**
   * Get retention statistics
   */
  async getStatistics(): Promise<RetentionStatistics> {
    try {
      const now = new Date();
      const totalRecords = await AuditLog.countDocuments();
      const archivedRecords = await AuditLog.countDocuments({ isArchived: true });
      
      // Calculate pending archival (records older than min age but not archived)
      const minAge = Math.min(...Array.from(this.policies.values())
        .filter(p => p.enabled)
        .map(p => p.conditions.minAge));
      
      const cutoffDate = new Date(now.getTime() - minAge * 24 * 60 * 60 * 1000);
      const pendingArchival = await AuditLog.countDocuments({
        timestamp: { $lt: cutoffDate },
        isArchived: false
      });

      // Calculate pending deletion (archived records past retention period)
      const pendingDeletion = await AuditLog.countDocuments({
        isArchived: true,
        retentionPeriod: { $lt: now }
      });

      const activePolicies = Array.from(this.policies.values()).filter(p => p.enabled).length;
      const failedPolicies = 0; // Would track failed executions

      return {
        totalRecords,
        archivedRecords,
        deletedRecords: 0, // Would track actual deletions
        pendingArchival,
        pendingDeletion,
        storageSaved: 0, // Would calculate actual storage savings
        lastRun: undefined, // Would track last execution time
        nextRun: undefined, // Would calculate next scheduled run
        activePolicies,
        failedPolicies
      };
    } catch (error) {
      this.logger.error('Failed to get retention statistics', { error });
      throw error;
    }
  }

  /**
   * Get archive metadata
   */
  getArchiveMetadata(): ArchiveMetadata[] {
    return Array.from(this.archiveMetadata.values());
  }

  /**
   * Restore from archive
   */
  async restoreFromArchive(archiveId: string): Promise<void> {
    try {
      const metadata = this.archiveMetadata.get(archiveId);
      if (!metadata) {
        throw new Error(`Archive not found: ${archiveId}`);
      }

      this.logger.info('Restoring from archive', { archiveId });

      await this.storage.restoreFromArchive(archiveId);

      this.logger.info('Archive restored successfully', { archiveId });
    } catch (error) {
      this.logger.error('Failed to restore from archive', { error, archiveId });
      throw error;
    }
  }

  /**
   * Cleanup expired archives
   */
  async cleanupExpiredArchives(): Promise<number> {
    try {
      const now = new Date();
      let cleaned = 0;

      for (const [archiveId, metadata] of this.archiveMetadata.entries()) {
        if (metadata.expiresAt && metadata.expiresAt < now) {
          try {
            // Delete archive file
            await fs.unlink(metadata.location);
            
            // Remove from metadata
            this.archiveMetadata.delete(archiveId);
            
            cleaned++;
            
            this.logger.info('Expired archive cleaned up', { archiveId });
          } catch (error) {
            this.logger.error('Failed to cleanup expired archive', { error, archiveId });
          }
        }
      }

      await this.saveArchiveMetadata();

      this.logger.info('Archive cleanup completed', { cleaned });
      return cleaned;
    } catch (error) {
      this.logger.error('Failed to cleanup expired archives', { error });
      throw error;
    }
  }

  /**
   * Stop the retention manager
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping data retention manager...');

      // Stop all scheduled tasks
      for (const [policyId, task] of this.scheduledTasks.entries()) {
        task.stop();
        this.logger.debug('Stopped scheduled task', { policyId });
      }
      this.scheduledTasks.clear();

      this.isRunning = false;
      this.logger.info('Data retention manager stopped');
    } catch (error) {
      this.logger.error('Failed to stop data retention manager', { error });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private initializeDefaultPolicies(): void {
    // Default 7-year retention for compliance
    const defaultPolicy: RetentionPolicy = {
      id: 'default-7year',
      name: 'Default 7-Year Retention',
      description: 'Retain all audit logs for 7 years for compliance',
      enabled: true,
      conditions: {
        minAge: 365 * 7, // 7 years
        severity: ['low', 'medium', 'high', 'critical']
      },
      actions: {
        archive: true,
        delete: false,
        compress: true,
        encrypt: false
      },
      schedule: {
        frequency: 'daily',
        timezone: 'UTC',
        time: '02:00'
      },
      notifications: {
        enabled: true,
        onFailure: true,
        onSuccess: false
      }
    };

    this.policies.set(defaultPolicy.id, defaultPolicy);
  }

  private async loadPolicies(): Promise<void> {
    try {
      const policiesPath = path.join(process.cwd(), 'data', 'retention-policies.json');
      
      try {
        const data = await fs.readFile(policiesPath, 'utf-8');
        const policies: RetentionPolicy[] = JSON.parse(data);
        
        this.policies.clear();
        policies.forEach(policy => {
          this.policies.set(policy.id, policy);
        });
        
        this.logger.info('Loaded retention policies', { count: policies.length });
      } catch (error) {
        // File doesn't exist, use defaults
        await this.savePolicies();
      }
    } catch (error) {
      this.logger.error('Failed to load retention policies', { error });
    }
  }

  private async savePolicies(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      const policiesPath = path.join(dataDir, 'retention-policies.json');
      const policies = Array.from(this.policies.values());
      await fs.writeFile(policiesPath, JSON.stringify(policies, null, 2));
      
      this.logger.debug('Saved retention policies', { count: policies.length });
    } catch (error) {
      this.logger.error('Failed to save retention policies', { error });
    }
  }

  private async loadArchiveMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(process.cwd(), 'data', 'archive-metadata.json');
      
      try {
        const data = await fs.readFile(metadataPath, 'utf-8');
        const metadata: ArchiveMetadata[] = JSON.parse(data);
        
        this.archiveMetadata.clear();
        metadata.forEach(meta => {
          this.archiveMetadata.set(meta.archiveId, meta);
        });
        
        this.logger.info('Loaded archive metadata', { count: metadata.length });
      } catch (error) {
        // File doesn't exist, create empty
        await this.saveArchiveMetadata();
      }
    } catch (error) {
      this.logger.error('Failed to load archive metadata', { error });
    }
  }

  private async saveArchiveMetadata(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      const metadataPath = path.join(dataDir, 'archive-metadata.json');
      const metadata = Array.from(this.archiveMetadata.values());
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      this.logger.debug('Saved archive metadata', { count: metadata.length });
    } catch (error) {
      this.logger.error('Failed to save archive metadata', { error });
    }
  }

  private async scheduleActivePolicies(): Promise<void> {
    for (const policy of this.policies.values()) {
      if (policy.enabled) {
        await this.schedulePolicy(policy);
      }
    }
  }

  private async schedulePolicy(policy: RetentionPolicy): Promise<void> {
    try {
      const cronExpression = this.buildCronExpression(policy);
      
      const task = cron.schedule(cronExpression, async () => {
        try {
          await this.executePolicy(policy.id);
        } catch (error) {
          this.logger.error('Scheduled policy execution failed', { 
            error, 
            policyId: policy.id 
          });
        }
      }, {
        scheduled: false,
        timezone: policy.schedule.timezone
      });

      task.start();
      this.scheduledTasks.set(policy.id, task);
      
      this.logger.info('Policy scheduled', { 
        policyId: policy.id, 
        cronExpression 
      });
    } catch (error) {
      this.logger.error('Failed to schedule policy', { error, policyId: policy.id });
    }
  }

  private buildCronExpression(policy: RetentionPolicy): string {
    const { frequency, time, dayOfWeek, dayOfMonth } = policy.schedule;
    
    switch (frequency) {
      case 'hourly':
        return '0 * * * *';
      case 'daily':
        const dailyTime = time || '02:00';
        const [hour, minute] = dailyTime.split(':');
        return `${minute} ${hour} * * *`;
      case 'weekly':
        const weeklyTime = time || '02:00';
        const weeklyDay = dayOfWeek || 0; // Sunday
        const [weeklyHour, weeklyMinute] = weeklyTime.split(':');
        return `${weeklyMinute} ${weeklyHour} * * ${weeklyDay}`;
      case 'monthly':
        const monthlyTime = time || '02:00';
        const monthlyDay = dayOfMonth || 1;
        const [monthlyHour, monthlyMinute] = monthlyTime.split(':');
        return `${monthlyMinute} ${monthlyHour} ${monthlyDay} * *`;
      default:
        return '0 2 * * *'; // Daily at 2 AM
    }
  }

  private validatePolicy(policy: RetentionPolicy): void {
    if (!policy.name || policy.name.trim().length === 0) {
      throw new Error('Policy name is required');
    }

    if (policy.conditions.minAge < 0) {
      throw new Error('Minimum age must be positive');
    }

    if (policy.conditions.maxAge && policy.conditions.maxAge <= policy.conditions.minAge) {
      throw new Error('Maximum age must be greater than minimum age');
    }

    if (policy.actions.delete && !policy.actions.archive) {
      throw new Error('Cannot delete without archiving first');
    }
  }

  private async processRetentionPolicy(policy: RetentionPolicy): Promise<{
    archived: number;
    deleted: number;
    errors: string[];
  }> {
    const result = {
      archived: 0,
      deleted: 0,
      errors: [] as string[]
    };

    try {
      // Build query for records to process
      const query = this.buildRetentionQuery(policy);
      
      // Find records to process
      const records = await AuditLog.find(query).limit(10000); // Process in batches
      
      if (records.length === 0) {
        this.logger.info('No records found for retention policy', { policyId: policy.id });
        return result;
      }

      // Archive records if required
      if (policy.actions.archive) {
        try {
          const archiveDate = new Date();
          await this.storage.archive(archiveDate);
          
          // Update archive metadata
          const archiveMetadata: ArchiveMetadata = {
            archiveId: `archive_${Date.now()}_${policy.id}`,
            policyId: policy.id,
            createdAt: new Date(),
            recordCount: records.length,
            sizeBytes: records.length * 1024, // Estimate
            compressed: policy.actions.compress,
            encrypted: policy.actions.encrypt,
            retentionPeriod: policy.conditions.maxAge || policy.conditions.minAge,
            checksum: 'pending',
            location: `./archives/archive_${Date.now()}.audit`
          };
          
          this.archiveMetadata.set(archiveMetadata.archiveId, archiveMetadata);
          await this.saveArchiveMetadata();
          
          result.archived = records.length;
          
          this.logger.info('Records archived', { 
            policyId: policy.id, 
            count: records.length 
          });
        } catch (error) {
          result.errors.push(`Archive failed: ${error}`);
          this.logger.error('Archive failed', { error, policyId: policy.id });
        }
      }

      // Delete records if required
      if (policy.actions.delete && policy.actions.archive) {
        try {
          // Only delete archived records that are past retention period
          const deleteQuery = {
            ...query,
            isArchived: true,
            archivedAt: { $lt: new Date(Date.now() - (policy.conditions.maxAge || policy.conditions.minAge) * 24 * 60 * 60 * 1000) }
          };
          
          const deleteResult = await AuditLog.deleteMany(deleteQuery);
          result.deleted = deleteResult.deletedCount || 0;
          
          this.logger.info('Records deleted', { 
            policyId: policy.id, 
            count: result.deleted 
          });
        } catch (error) {
          result.errors.push(`Delete failed: ${error}`);
          this.logger.error('Delete failed', { error, policyId: policy.id });
        }
      }

    } catch (error) {
      result.errors.push(`Processing failed: ${error}`);
      this.logger.error('Policy processing failed', { error, policyId: policy.id });
    }

    return result;
  }

  private buildRetentionQuery(policy: RetentionPolicy): any {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - policy.conditions.minAge * 24 * 60 * 60 * 1000);
    
    const query: any = {
      timestamp: { $lt: cutoffDate },
      isArchived: false
    };

    // Add severity filter
    if (policy.conditions.severity && policy.conditions.severity.length > 0) {
      query.severity = { $in: policy.conditions.severity };
    }

    // Add event type filter
    if (policy.conditions.eventTypes && policy.conditions.eventTypes.length > 0) {
      query.eventType = { $in: policy.conditions.eventTypes };
    }

    // Add compliance framework filter
    if (policy.conditions.complianceFrameworks && policy.conditions.complianceFrameworks.length > 0) {
      query.complianceFrameworks = { $in: policy.conditions.complianceFrameworks };
    }

    // Add custom filter
    if (policy.conditions.customFilter) {
      Object.assign(query, policy.conditions.customFilter);
    }

    return query;
  }

  private async logPolicyExecution(
    policy: RetentionPolicy, 
    result: { archived: number; deleted: number; errors: string[] }
  ): Promise<void> {
    try {
      await auditService.logEvent({
        eventType: 'DATA_ARCHIVE' as any,
        severity: 'medium' as any,
        status: 'success' as any,
        action: 'retention_policy_execution',
        resourceType: 'RetentionPolicy',
        resourceId: policy.id,
        metadata: {
          policyName: policy.name,
          archived: result.archived,
          deleted: result.deleted,
          errors: result.errors
        },
        tags: ['retention', 'policy', 'archive']
      });
    } catch (error) {
      this.logger.error('Failed to log policy execution', { error });
    }
  }

  private async sendNotifications(
    policy: RetentionPolicy, 
    result: { archived: number; deleted: number; errors: string[] }
  ): Promise<void> {
    // Implementation would depend on notification system
    // For now, just log
    this.logger.info('Policy execution notification', {
      policyId: policy.id,
      result
    });
  }
}

export default DataRetentionManager;
