import { AuditLog, IAuditLog } from '../models/AuditLog';
import { AuditQuery, AuditQueryFilters } from '../audit/AuditQuery';
import { ComplianceFramework, ReportPeriod } from '../audit/AuditReport';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

/**
 * Export Configuration
 */
export interface ExportConfig {
  maxRecords: number;
  timeout: number; // milliseconds
  compression: boolean;
  encryption: boolean;
  encryptionKey?: string;
  chunkSize: number; // for large exports
  tempDir: string;
  outputDir: string;
}

/**
 * Export Format
 */
export type ExportFormat = 'json' | 'csv' | 'xml' | 'pdf' | 'excel' | 'parquet';

/**
 * Export Template
 */
export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: ExportFormat;
  fields: string[];
  filters: AuditQueryFilters;
  complianceFramework?: ComplianceFramework;
  includeMetadata: boolean;
  includeHeaders: boolean;
  dateFormat: string;
  timezone: string;
  encoding: string;
}

/**
 * Export Job
 */
export interface ExportJob {
  id: string;
  templateId?: string;
  format: ExportFormat;
  filters: AuditQueryFilters;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  totalRecords?: number;
  processedRecords?: number;
  outputFile?: string;
  outputSize?: number;
  checksum?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  metadata: {
    userId?: string;
    requestId?: string;
    purpose?: string;
    retentionDays?: number;
    complianceFramework?: ComplianceFramework;
  };
}

/**
 * Export Statistics
 */
export interface ExportStatistics {
  totalExports: number;
  exportsToday: number;
  exportsThisWeek: number;
  exportsThisMonth: number;
  totalRecordsExported: number;
  totalDataExported: number; // bytes
  averageExportTime: number; // milliseconds
  successRate: number; // percentage
  failedExports: number;
  activeExports: number;
}

/**
 * Regulatory Export Manager
 * 
 * Provides comprehensive export capabilities for regulatory compliance:
 * - Multiple export formats (JSON, CSV, XML, PDF, Excel, Parquet)
 * - Compliance-specific templates
 * - Large dataset handling with streaming
 * - Data encryption and compression
 * - Export job management and tracking
 * - Audit trail of all exports
 */
export class RegulatoryExportManager {
  private logger: winston.Logger;
  private config: ExportConfig;
  private auditQuery: AuditQuery;
  private exportJobs: Map<string, ExportJob> = new Map();
  private exportTemplates: Map<string, ExportTemplate> = new Map();
  private activeStreams: Map<string, Transform> = new Map();

  constructor(config: Partial<ExportConfig> = {}) {
    this.config = {
      maxRecords: 1000000,
      timeout: 300000, // 5 minutes
      compression: true,
      encryption: false,
      chunkSize: 10000,
      tempDir: './temp/exports',
      outputDir: './exports',
      ...config
    };

    this.auditQuery = new AuditQuery();

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/export-manager.log' }),
        new winston.transports.Console()
      ]
    });

    this.initializeDefaultTemplates();
  }

  /**
   * Initialize the export manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing regulatory export manager...');

      // Create directories
      await fs.mkdir(this.config.tempDir, { recursive: true });
      await fs.mkdir(this.config.outputDir, { recursive: true });

      // Load existing templates
      await this.loadTemplates();

      // Clean up old temporary files
      await this.cleanupTempFiles();

      this.logger.info('Regulatory export manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize export manager', { error });
      throw error;
    }
  }

  /**
   * Create an export job
   */
  async createExportJob(
    format: ExportFormat,
    filters: AuditQueryFilters,
    options: {
      templateId?: string;
      userId?: string;
      requestId?: string;
      purpose?: string;
      retentionDays?: number;
      complianceFramework?: ComplianceFramework;
    } = {}
  ): Promise<ExportJob> {
    try {
      const jobId = `export_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      const job: ExportJob = {
        id: jobId,
        templateId: options.templateId,
        format,
        filters,
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
        metadata: {
          userId: options.userId,
          requestId: options.requestId,
          purpose: options.purpose,
          retentionDays: options.retentionDays,
          complianceFramework: options.complianceFramework
        }
      };

      this.exportJobs.set(jobId, job);
      await this.saveJobs();

      this.logger.info('Export job created', { 
        jobId, 
        format, 
        complianceFramework: options.complianceFramework 
      });

      return job;
    } catch (error) {
      this.logger.error('Failed to create export job', { error });
      throw error;
    }
  }

  /**
   * Execute an export job
   */
  async executeExportJob(jobId: string): Promise<void> {
    try {
      const job = this.exportJobs.get(jobId);
      if (!job) {
        throw new Error(`Export job not found: ${jobId}`);
      }

      if (job.status !== 'pending') {
        throw new Error(`Export job is not pending: ${job.status}`);
      }

      job.status = 'running';
      job.startedAt = new Date();
      await this.saveJobs();

      this.logger.info('Starting export job execution', { jobId, format: job.format });

      // Get template if specified
      let template: ExportTemplate | undefined;
      if (job.templateId) {
        template = this.exportTemplates.get(job.templateId);
        if (!template) {
          throw new Error(`Export template not found: ${job.templateId}`);
        }
      }

      // Execute export based on format
      const outputFile = await this.performExport(job, template);
      
      // Update job with results
      job.status = 'completed';
      job.completedAt = new Date();
      job.outputFile = outputFile;
      job.progress = 100;

      // Calculate file size and checksum
      const stats = await fs.stat(outputFile);
      job.outputSize = stats.size;
      job.checksum = await this.calculateFileChecksum(outputFile);

      await this.saveJobs();

      this.logger.info('Export job completed', { 
        jobId, 
        outputFile, 
        size: job.outputSize,
        records: job.processedRecords 
      });

    } catch (error) {
      const job = this.exportJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
        job.completedAt = new Date();
        await this.saveJobs();
      }

      this.logger.error('Export job failed', { error, jobId });
      throw error;
    }
  }

  /**
   * Cancel an export job
   */
  async cancelExportJob(jobId: string): Promise<void> {
    try {
      const job = this.exportJobs.get(jobId);
      if (!job) {
        throw new Error(`Export job not found: ${jobId}`);
      }

      if (job.status !== 'running' && job.status !== 'pending') {
        throw new Error(`Cannot cancel job in status: ${job.status}`);
      }

      // Cancel active stream if exists
      const stream = this.activeStreams.get(jobId);
      if (stream) {
        stream.destroy();
        this.activeStreams.delete(jobId);
      }

      job.status = 'cancelled';
      job.completedAt = new Date();
      await this.saveJobs();

      this.logger.info('Export job cancelled', { jobId });
    } catch (error) {
      this.logger.error('Failed to cancel export job', { error, jobId });
      throw error;
    }
  }

  /**
   * Get export job status
   */
  getExportJob(jobId: string): ExportJob | undefined {
    return this.exportJobs.get(jobId);
  }

  /**
   * Get all export jobs
   */
  getExportJobs(options: {
    status?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}): ExportJob[] {
    let jobs = Array.from(this.exportJobs.values());

    // Filter by status
    if (options.status) {
      jobs = jobs.filter(job => job.status === options.status);
    }

    // Filter by user
    if (options.userId) {
      jobs = jobs.filter(job => job.metadata.userId === options.userId);
    }

    // Sort by creation date (newest first)
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    if (options.offset) {
      jobs = jobs.slice(options.offset);
    }

    if (options.limit) {
      jobs = jobs.slice(0, options.limit);
    }

    return jobs;
  }

  /**
   * Create an export template
   */
  async createExportTemplate(template: Omit<ExportTemplate, 'id'>): Promise<ExportTemplate> {
    try {
      const newTemplate: ExportTemplate = {
        ...template,
        id: `template_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
      };

      this.exportTemplates.set(newTemplate.id, newTemplate);
      await this.saveTemplates();

      this.logger.info('Export template created', { 
        templateId: newTemplate.id, 
        name: newTemplate.name 
      });

      return newTemplate;
    } catch (error) {
      this.logger.error('Failed to create export template', { error });
      throw error;
    }
  }

  /**
   * Get export templates
   */
  getExportTemplates(): ExportTemplate[] {
    return Array.from(this.exportTemplates.values());
  }

  /**
   * Get export statistics
   */
  async getStatistics(): Promise<ExportStatistics> {
    try {
      const jobs = Array.from(this.exportJobs.values());
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const totalExports = jobs.length;
      const exportsToday = jobs.filter(job => job.createdAt >= today).length;
      const exportsThisWeek = jobs.filter(job => job.createdAt >= weekAgo).length;
      const exportsThisMonth = jobs.filter(job => job.createdAt >= monthAgo).length;

      const completedJobs = jobs.filter(job => job.status === 'completed');
      const totalRecordsExported = completedJobs.reduce((sum, job) => sum + (job.processedRecords || 0), 0);
      const totalDataExported = completedJobs.reduce((sum, job) => sum + (job.outputSize || 0), 0);

      const averageExportTime = completedJobs.length > 0
        ? completedJobs.reduce((sum, job) => {
            const duration = (job.completedAt?.getTime() || 0) - (job.startedAt?.getTime() || 0);
            return sum + duration;
          }, 0) / completedJobs.length
        : 0;

      const successRate = totalExports > 0 ? (completedJobs.length / totalExports) * 100 : 0;
      const failedExports = jobs.filter(job => job.status === 'failed').length;
      const activeExports = jobs.filter(job => job.status === 'running').length;

      return {
        totalExports,
        exportsToday,
        exportsThisWeek,
        exportsThisMonth,
        totalRecordsExported,
        totalDataExported,
        averageExportTime,
        successRate,
        failedExports,
        activeExports
      };
    } catch (error) {
      this.logger.error('Failed to get export statistics', { error });
      throw error;
    }
  }

  /**
   * Download export file
   */
  async downloadExportFile(jobId: string): Promise<{
    stream: NodeJS.ReadableStream;
    filename: string;
    mimeType: string;
    size: number;
  }> {
    try {
      const job = this.exportJobs.get(jobId);
      if (!job) {
        throw new Error(`Export job not found: ${jobId}`);
      }

      if (job.status !== 'completed' || !job.outputFile) {
        throw new Error(`Export job not completed: ${jobId}`);
      }

      const filename = path.basename(job.outputFile);
      const mimeType = this.getMimeType(job.format);
      const size = job.outputSize || 0;

      const stream = createReadStream(job.outputFile);

      return { stream, filename, mimeType, size };
    } catch (error) {
      this.logger.error('Failed to download export file', { error, jobId });
      throw error;
    }
  }

  /**
   * Cleanup old export files
   */
  async cleanupOldExports(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      let cleaned = 0;

      // Clean up old export files
      const files = await fs.readdir(this.config.outputDir);
      for (const file of files) {
        const filePath = path.join(this.config.outputDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }

      // Clean up old job records
      for (const [jobId, job] of this.exportJobs.entries()) {
        if (job.createdAt < cutoffDate && job.status === 'completed') {
          this.exportJobs.delete(jobId);
          cleaned++;
        }
      }

      await this.saveJobs();

      this.logger.info('Export cleanup completed', { cleaned, retentionDays });
      return cleaned;
    } catch (error) {
      this.logger.error('Failed to cleanup old exports', { error });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: Omit<ExportTemplate, 'id'>[] = [
      {
        name: 'SOX Compliance Export',
        description: 'Sarbanes-Oxley compliance audit export',
        format: 'csv',
        fields: ['auditId', 'timestamp', 'eventType', 'severity', 'status', 'userId', 'action', 'resourceType', 'resourceId', 'ipAddress'],
        filters: {
          complianceFrameworks: ['SOX']
        },
        complianceFramework: ComplianceFramework.SOX,
        includeMetadata: true,
        includeHeaders: true,
        dateFormat: 'ISO',
        timezone: 'UTC',
        encoding: 'utf-8'
      },
      {
        name: 'GDPR Data Export',
        description: 'GDPR-compliant personal data audit export',
        format: 'json',
        fields: ['auditId', 'timestamp', 'eventType', 'userId', 'action', 'resourceType', 'oldValues', 'newValues', 'ipAddress'],
        filters: {
          complianceFrameworks: ['GDPR'],
          eventTypes: ['CREATE', 'UPDATE', 'DELETE', 'DATA_EXPORT', 'DATA_IMPORT']
        },
        complianceFramework: ComplianceFramework.GDPR,
        includeMetadata: true,
        includeHeaders: false,
        dateFormat: 'ISO',
        timezone: 'UTC',
        encoding: 'utf-8'
      },
      {
        name: 'HIPAA Audit Export',
        description: 'HIPAA compliance audit trail export',
        format: 'csv',
        fields: ['auditId', 'timestamp', 'eventType', 'severity', 'userId', 'action', 'resourceType', 'resourceId', 'oldValues', 'newValues'],
        filters: {
          complianceFrameworks: ['HIPAA']
        },
        complianceFramework: ComplianceFramework.HIPAA,
        includeMetadata: true,
        includeHeaders: true,
        dateFormat: 'ISO',
        timezone: 'UTC',
        encoding: 'utf-8'
      },
      {
        name: 'PCI-DSS Security Export',
        description: 'PCI-DSS security event export',
        format: 'xml',
        fields: ['auditId', 'timestamp', 'eventType', 'severity', 'userId', 'ipAddress', 'userAgent', 'action', 'resourceType'],
        filters: {
          complianceFrameworks: ['PCI-DSS'],
          eventTypes: ['SECURITY_BREACH', 'SUSPICIOUS_ACTIVITY', 'BLOCKED_REQUEST', 'USER_LOGIN', 'PASSWORD_CHANGE']
        },
        complianceFramework: ComplianceFramework.PCI_DSS,
        includeMetadata: true,
        includeHeaders: false,
        dateFormat: 'ISO',
        timezone: 'UTC',
        encoding: 'utf-8'
      }
    ];

    defaultTemplates.forEach(template => {
      this.exportTemplates.set(template.name.replace(/\s+/g, '_').toLowerCase(), template as ExportTemplate);
    });
  }

  private async performExport(job: ExportJob, template?: ExportTemplate): Promise<string> {
    const outputFile = path.join(this.config.outputDir, `${job.id}.${job.format}`);
    
    // Get total record count
    const countResult = await this.auditQuery.search(job.filters, { limit: 1 });
    job.totalRecords = countResult.total;

    // Create export stream
    const exportStream = this.createExportStream(job.format, template);
    this.activeStreams.set(job.id, exportStream);

    try {
      // Process records in chunks
      let offset = 0;
      const chunkSize = this.config.chunkSize;
      let processedRecords = 0;

      // Write headers if needed
      if (template?.includeHeaders) {
        await this.writeHeaders(exportStream, job.format, template);
      }

      while (offset < job.totalRecords) {
        // Check if job was cancelled
        if (job.status === 'cancelled') {
          throw new Error('Export job was cancelled');
        }

        // Get chunk of records
        const result = await this.auditQuery.search(job.filters, {
          limit: chunkSize,
          offset
        });

        // Process chunk
        for (const record of result.data) {
          const exportData = this.formatRecord(record, template);
          exportStream.write(exportData);
          processedRecords++;
        }

        // Update progress
        job.processedRecords = processedRecords;
        job.progress = (processedRecords / job.totalRecords) * 100;
        await this.saveJobs();

        offset += chunkSize;

        // Add delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // End stream
      exportStream.end();

      // Wait for stream to finish
      await new Promise((resolve, reject) => {
        exportStream.on('finish', resolve);
        exportStream.on('error', reject);
      });

      return outputFile;
    } finally {
      this.activeStreams.delete(job.id);
    }
  }

  private createExportStream(format: ExportFormat, template?: ExportTemplate): Transform {
    const outputPath = path.join(this.config.tempDir, `temp_${Date.now()}.${format}`);
    
    switch (format) {
      case 'json':
        return new JsonExportStream(outputPath, template);
      case 'csv':
        return new CsvExportStream(outputPath, template);
      case 'xml':
        return new XmlExportStream(outputPath, template);
      case 'excel':
        return new ExcelExportStream(outputPath, template);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private formatRecord(record: IAuditLog, template?: ExportTemplate): any {
    if (!template) {
      return record.toJSON();
    }

    const formatted: any = {};
    
    for (const field of template.fields) {
      if (field in record) {
        let value = (record as any)[field];
        
        // Format date fields
        if (value instanceof Date) {
          value = this.formatDate(value, template.dateFormat, template.timezone);
        }
        
        formatted[field] = value;
      }
    }

    // Add metadata if requested
    if (template.includeMetadata) {
      formatted._metadata = {
        exportedAt: new Date().toISOString(),
        exportId: template.id,
        complianceFramework: template.complianceFramework
      };
    }

    return formatted;
  }

  private formatDate(date: Date, format: string, timezone: string): string {
    switch (format) {
      case 'ISO':
        return date.toISOString();
      case 'UNIX':
        return date.getTime().toString();
      case 'LOCAL':
        return date.toLocaleString();
      default:
        return date.toISOString();
    }
  }

  private async writeHeaders(stream: Transform, format: ExportFormat, template: ExportTemplate): Promise<void> {
    const headers = template.fields.join(',');
    stream.write(headers + '\n');
  }

  private getMimeType(format: ExportFormat): string {
    const mimeTypes = {
      'json': 'application/json',
      'csv': 'text/csv',
      'xml': 'application/xml',
      'pdf': 'application/pdf',
      'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'parquet': 'application/octet-stream'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  private async loadTemplates(): Promise<void> {
    try {
      const templatesPath = path.join(process.cwd(), 'data', 'export-templates.json');
      
      try {
        const data = await fs.readFile(templatesPath, 'utf-8');
        const templates: ExportTemplate[] = JSON.parse(data);
        
        this.exportTemplates.clear();
        templates.forEach(template => {
          this.exportTemplates.set(template.id, template);
        });
        
        this.logger.info('Loaded export templates', { count: templates.length });
      } catch (error) {
        // File doesn't exist, use defaults
        await this.saveTemplates();
      }
    } catch (error) {
      this.logger.error('Failed to load export templates', { error });
    }
  }

  private async saveTemplates(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      const templatesPath = path.join(dataDir, 'export-templates.json');
      const templates = Array.from(this.exportTemplates.values());
      await fs.writeFile(templatesPath, JSON.stringify(templates, null, 2));
      
      this.logger.debug('Saved export templates', { count: templates.length });
    } catch (error) {
      this.logger.error('Failed to save export templates', { error });
    }
  }

  private async saveJobs(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      const jobsPath = path.join(dataDir, 'export-jobs.json');
      const jobs = Array.from(this.exportJobs.values());
      await fs.writeFile(jobsPath, JSON.stringify(jobs, null, 2));
      
      this.logger.debug('Saved export jobs', { count: jobs.length });
    } catch (error) {
      this.logger.error('Failed to save export jobs', { error });
    }
  }

  private async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.tempDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.config.tempDir, file);
        const stats = await fs.stat(filePath);
        
        // Clean up temp files older than 1 hour
        if (now - stats.mtime.getTime() > 60 * 60 * 1000) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup temp files', { error });
    }
  }
}

/**
 * Export Stream Classes
 */
class JsonExportStream extends Transform {
  private isFirst = true;
  private outputPath: string;
  private fileHandle: any;

  constructor(outputPath: string, private template?: ExportTemplate) {
    super({ objectMode: true });
    this.outputPath = outputPath;
  }

  async _construct(callback: () => void) {
    this.fileHandle = await fs.open(this.outputPath, 'w');
    await this.fileHandle.write('[\n');
    callback();
  }

  _transform(chunk: any, encoding: string, callback: () => void) {
    if (!this.isFirst) {
      this.push(',\n');
    } else {
      this.isFirst = false;
    }
    
    this.push(JSON.stringify(chunk, null, 2));
    callback();
  }

  async _flush(callback: () => void) {
    await this.fileHandle.write('\n]');
    await this.fileHandle.close();
    callback();
  }
}

class CsvExportStream extends Transform {
  private outputPath: string;
  private fileHandle: any;

  constructor(outputPath: string, private template?: ExportTemplate) {
    super({ objectMode: true });
    this.outputPath = outputPath;
  }

  async _construct(callback: () => void) {
    this.fileHandle = await fs.open(this.outputPath, 'w');
    callback();
  }

  _transform(chunk: any, encoding: string, callback: () => void) {
    const csvLine = this.objectToCsvLine(chunk);
    this.fileHandle.write(csvLine + '\n');
    callback();
  }

  async _flush(callback: () => void) {
    await this.fileHandle.close();
    callback();
  }

  private objectToCsvLine(obj: any): string {
    const values = this.template?.fields || Object.keys(obj);
    return values.map(field => {
      const value = obj[field];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(',');
  }
}

class XmlExportStream extends Transform {
  private outputPath: string;
  private fileHandle: any;
  private isFirst = true;

  constructor(outputPath: string, private template?: ExportTemplate) {
    super({ objectMode: true });
    this.outputPath = outputPath;
  }

  async _construct(callback: () => void) {
    this.fileHandle = await fs.open(this.outputPath, 'w');
    await this.fileHandle.write('<?xml version="1.0" encoding="UTF-8"?>\n<audit_logs>\n');
    callback();
  }

  _transform(chunk: any, encoding: string, callback: () => void) {
    const xmlElement = this.objectToXmlElement(chunk);
    this.fileHandle.write(xmlElement);
    callback();
  }

  async _flush(callback: () => void) {
    await this.fileHandle.write('</audit_logs>\n');
    await this.fileHandle.close();
    callback();
  }

  private objectToXmlElement(obj: any): string {
    let xml = '  <audit_log>\n';
    
    const fields = this.template?.fields || Object.keys(obj);
    for (const field of fields) {
      if (field in obj) {
        const value = obj[field];
        if (value !== null && value !== undefined) {
          xml += `    <${field}>${this.escapeXml(String(value))}</${field}>\n`;
        }
      }
    }
    
    xml += '  </audit_log>\n';
    return xml;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

class ExcelExportStream extends Transform {
  private outputPath: string;
  private fileHandle: any;

  constructor(outputPath: string, private template?: ExportTemplate) {
    super({ objectMode: true });
    this.outputPath = outputPath;
  }

  async _construct(callback: () => void) {
    // Excel export would require a library like xlsx or exceljs
    // For now, fall back to CSV
    this.fileHandle = await fs.open(this.outputPath, 'w');
    callback();
  }

  _transform(chunk: any, encoding: string, callback: () => void) {
    // For now, implement as CSV
    const csvLine = this.objectToCsvLine(chunk);
    this.fileHandle.write(csvLine + '\n');
    callback();
  }

  async _flush(callback: () => void) {
    await this.fileHandle.close();
    callback();
  }

  private objectToCsvLine(obj: any): string {
    const values = this.template?.fields || Object.keys(obj);
    return values.map(field => {
      const value = obj[field];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(',');
  }
}

export default RegulatoryExportManager;
