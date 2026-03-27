import { Request, Response } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getUploadService } from './UploadService';
import { getFileProcessor } from './FileProcessor';
import { getValidationService } from './ValidationService';
import {
  UploadConfig,
  UploadResult,
  UploadSession,
  FileValidationOptions,
  DEFAULT_UPLOAD_CONFIG,
} from '../../../types/fileUpload';

export interface UploadControllerConfig {
  maxFileSize: number;
  maxFiles: number;
  allowedTypes: string[];
  blockedTypes: string[];
  enableVirusScanning: boolean;
  enableContentValidation: boolean;
  enableMetadataExtraction: boolean;
  enableThumbnailGeneration: boolean;
  enableImageProcessing: boolean;
  enableVideoProcessing: boolean;
  enableAudioProcessing: boolean;
  enableDocumentProcessing: boolean;
  enableCloudStorage: boolean;
  enableResumableUpload: boolean;
  enableChunkedUpload: boolean;
  enableCompression: boolean;
  enableEncryption: boolean;
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: Record<string, string>;
  };
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
}

export class UploadController {
  private uploadService: any;
  private fileProcessor: any;
  private validationService: any;
  private config: UploadControllerConfig;

  constructor(config: Partial<UploadControllerConfig> = {}) {
    this.config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      allowedTypes: [],
      blockedTypes: [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msdos-program',
        'application/x-msi',
        'application/x-disk-copy',
        'application/vnd.android.package-archive',
      ],
      enableVirusScanning: false,
      enableContentValidation: true,
      enableMetadataExtraction: true,
      enableThumbnailGeneration: true,
      enableImageProcessing: true,
      enableVideoProcessing: false,
      enableAudioProcessing: false,
      enableDocumentProcessing: false,
      enableCloudStorage: false,
      enableResumableUpload: true,
      enableChunkedUpload: true,
      enableCompression: false,
      enableEncryption: false,
      cors: {
        enabled: true,
        origins: ['*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers: {},
      },
      rateLimiting: {
        enabled: true,
        windowMs: 60000, // 1 minute
        maxRequests: 100,
      },
      ...config,
    };
    
    this.uploadService = getUploadService({
      maxFileSize: this.config.maxFileSize,
      maxFiles: this.config.maxFiles,
      allowedTypes: this.config.allowedTypes,
      blockedTypes: this.config.blockedTypes,
      enableVirusScanning: this.config.enableVirusScanning,
      enableContentValidation: this.config.enableContentValidation,
      enableMetadataExtraction: this.config.enableMetadataExtraction,
    });
    
    this.fileProcessor = getFileProcessor();
    this.validationService = getValidationService({
      enableVirusScanning: this.config.enableVirusScanning,
      enableContentValidation: this.config.enableContentValidation,
      enableMetadataExtraction: this.config.enableMetadataExtraction,
    });
  }

  /**
   * Initialize upload session
   */
  async initializeUpload(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { fileId, fileName, fileSize, mimeType, totalChunks, metadata = req.body;
      
      // Validate request
      const validation = this.validateUploadRequest(fileSize, mimeType, fileName);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }
      
      // Initialize upload session
      const session = await this.uploadService.initializeUpload(
        fileId,
        fileName,
        fileSize,
        mimeType,
        totalChunks,
        metadata
      );
      
      res.status(200).json({
        sessionId: session.id,
        fileId: session.fileId,
        chunkSize: this.config.enableChunkedUpload ? this.uploadService['config'].chunkSize : null,
        maxRetries: this.uploadService['config'].maxRetries,
        uploadUrl: `/api/upload/${session.id}`,
        chunkUploadUrl: `/api/upload/${session.id}/chunk`,
        statusUrl: `/api/upload/${session.id}/status`,
        completeUrl: `/api/upload/${session.id}/complete`,
      });
      
      console.log(`Upload session initialized: ${session.id} for ${fileName}`);
    } catch (error) {
      console.error('Failed to initialize upload:', error);
      res.status(500).json({ error: 'Failed to initialize upload' });
    }
  }

  /**
   * Upload chunk
   */
  async uploadChunk(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { sessionId, chunkIndex, checksum } = req.body;
      
      // Get session
      const session = this.uploadService.getUploadSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Upload session not found' });
        return;
      }
      
      // Get chunk file
      if (!req.file) {
        res.status(400).json({ error: 'No chunk file provided' });
        return;
      }
      
      // Read chunk data
      const chunkData = await fs.readFile(req.file.path);
      await fs.unlink(req.file.path); // Clean up temporary file
      
      // Upload chunk
      const result = await this.uploadService.uploadChunk(
        sessionId,
        parseInt(chunkIndex),
        chunkData,
        checksum
      );
      
      if (result.success) {
        res.status(200).json({ success: true });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Failed to upload chunk:', error);
      res.status(500).json({ error: 'Failed to upload chunk' });
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      const status = this.uploadService.getUploadStatus(sessionId);
      if (!status) {
        res.status(404).json({ error: 'Upload session not found' });
        return;
      }
      
      res.status(200).json(status);
    } catch (error) {
      console.error('Failed to get upload status:', error);
      res.status(500).json({ error: 'Failed to get upload status' });
    }
  }

  /**
   * Complete upload
   */
  async completeUpload(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      const session = this.uploadService.getUploadSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Upload session not found' });
        return;
      }
      
      if (session.status !== 'uploading') {
        res.status(400).json({ error: 'Upload is not in progress' });
        return;
      }
      
      // Mark as completed
      session.status = 'completed';
      session.completedAt = new Date();
      
      // Generate final result
      const result: UploadResult = {
        success: true,
        fileId: session.fileId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        mimeType: session.mimeType,
        filePath: path.join(this.uploadService['uploadDir'], session.fileId),
        url: this.generateFileUrl(session.fileId, session.fileName),
        checksum: session.metadata.checksum || '',
        metadata: session.metadata,
        uploadedAt: session.completedAt,
      };
      
      // Clean up session
      this.uploadService.deleteUpload(sessionId);
      
      res.status(200).json(result);
      
      console.log(`Upload completed: ${session.fileName} (${session.fileId})`);
    } catch (error) {
      console.error('Failed to complete upload:', error);
      res.status(500).json({ error: 'Failed to complete upload' });
    }
  }

  /**
   * Cancel upload
   */
  async cancelUpload(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      const success = this.uploadService.cancelUpload(sessionId);
      
      if (success) {
        res.status(200).json({ success: true });
      } else {
        res.status(400).json({ error: 'Failed to cancel upload' });
      }
    } catch (error) {
      console.error('Failed to cancel upload:', error);
      res.status(500).json({ error: 'Failed to cancel upload' });
    }
  }

  /**
   * Retry upload
   */
  async retryUpload(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      const success = this.uploadService.retryUpload(sessionId);
      
      if (success) {
        res.status(200).json({ success: true });
      } else {
        res.status(400).json({ error: 'Failed to retry upload' });
      }
    } catch (error) {
      console.error('Failed to retry upload:', error);
      res.status(500).json({ error: 'Failed to retry upload' });
    }
  }

  /**
   * Delete upload
   */
  async deleteUpload(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      const success = this.uploadService.deleteUpload(sessionId);
      
      if (success) {
        res.status(200).json({ success: true });
      } else {
        res.status(400).json({ error: 'Failed to delete upload' });
      }
    } catch (error) {
      console.error('Failed to delete upload:', error);
      res.status(500).json({ error: 'Failed to delete upload' });
    }
  }

  /**
   * Get upload list
   */
  async getUploadList(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const sessions = this.uploadService.getActiveSessions();
      
      const uploads = sessions.map(session => ({
        sessionId: session.id,
        fileId: session.fileId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        mimeType: session.mimeType,
        status: session.status,
        progress: (session.uploadedChunks.size / session.chunks.length) * 100,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        completedAt: session.completedAt,
        error: session.error,
        metadata: session.metadata,
      }));
      
      res.status(200).json({
        uploads,
        total: uploads.length,
      });
    } catch (error) {
      console.error('Failed to get upload list:', error);
      res.status(500).json({ error: 'Failed to get upload list' });
    }
  }

  /**
   * Get upload statistics
   */
  async getUploadStats(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const stats = this.uploadService.getUploadStats();
      
      res.status(200).json(stats);
    } catch (error) {
      console.error('Failed to get upload statistics:', error);
      res.status(500).json({ error: 'Failed to get upload statistics' });
    }
  }

  /**
   * Process uploaded file
   */
  async processUploadedFile(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { fileId, processingOptions } = req.body;
      
      // Get uploaded file path
      const filePath = path.join(this.uploadService['uploadDir'], fileId);
      
      if (!await fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      // Read file
      const buffer = await fs.readFile(filePath);
      
      // Process file based on MIME type
      let result: any;
      
      if (fileType.startsWith('image/') && this.config.enableImageProcessing) {
        result = await this.fileProcessor.processImage(filePath, processingOptions);
      } else if (fileType.startsWith('video/') && this.config.enableVideoProcessing) {
        result = await this.fileProcessor.processVideo(filePath, processingOptions);
      } else if (fileType.startsWith('audio/') && this.config.enableAudioProcessing) {
        result = await this.fileProcessor.processAudio(filePath, processingOptions);
      } else if (
        (fileType.includes('pdf') || fileType.includes('document')) && this.config.enableDocumentProcessing
      ) {
        result = await this.fileProcessor.processDocument(filePath, processingOptions);
      } else {
        result = { success: true, originalPath: filePath };
      }
      
      if (result.success) {
        res.status(200).json({
          success: true,
          originalPath: result.originalPath,
          processedPath: result.processedPath,
          thumbnailPath: result.thumbnailPath,
          metadata: result.metadata,
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Failed to process uploaded file:', error);
      res.status(500).json({ error: 'Failed to process uploaded file' });
    }
  }

  /**
   * Validate file before upload
   */
  async validateFile(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { fileName, fileSize, mimeType } = req.body;
      
      const validation = this.validateUploadRequest(fileSize, mimeType, fileName);
      
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }
      
      res.status(200).json({ valid: true });
    } catch (error) {
      console.error('Failed to validate file:', error);
      res.status(500).json({ error: 'Failed to validate file' });
    }
  }

  /**
   * Get file preview
   */
  async getFilePreview(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { fileId } = req.params;
      
      // Get file path
      const filePath = path.join(this.uploadService['uploadDir'], fileId);
      
      if (!await fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      // Read file
      const buffer = await fs.readFile(filePath);
      
      // Generate preview
      let previewUrl: string | undefined;
      
      if (mimeType.startsWith('image/')) {
        // Generate thumbnail for image
        const thumbnailPath = await this.fileProcessor.generateImageThumbnail(filePath, {
          maxWidth: 200,
          maxHeight: 200,
          quality: 60,
          format: 'jpeg',
        });
        previewUrl = `/api/uploads/thumbnails/${fileId}_thumb.jpeg`;
      }
      
      res.status(200).json({
        fileId,
        fileName: path.basename(filePath),
        fileSize: buffer.length,
        mimeType: mimeType,
        previewUrl,
      });
    } catch (error) {
      console.error('Failed to get file preview:', error);
      res.status(500).json({ error: 'Failed to get file preview' });
    }
  }

  /**
   * Download file
   */
  async downloadFile(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { fileId } = req.params;
      
      // Get file path
      const filePath = path.join(this.uploadService['uploadDir'], fileId);
      
      if (!await fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      // Set download headers
      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);
      
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      res.status(200).send(fileBuffer);
    } catch (error) {
      console.error('Failed to download file:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  }

  /**
   * Validate upload request
   */
  private validateUploadRequest(
    fileSize: number,
    mimeType: string,
    fileName: string
  ): { valid: boolean; error?: string } {
    // File size validation
    if (fileSize > this.config.maxFileSize) {
      return {
        valid: false,
        error: `File size (${fileSize} bytes) exceeds maximum allowed size (${this.config.maxFileSize} bytes)`,
      };
    }
    
    // File type validation
    if (this.config.allowedTypes.length > 0 && !this.config.allowedTypes.includes(mimeType)) {
      const isAllowed = this.config.allowedTypes.some(type => {
      if (type.includes('*')) {
        const wildcard = type.replace('*', '');
        return mimeType.startsWith(wildcard);
      }
      return mimeType === type;
    });
      
      if (!isAllowed) {
        return {
          valid: false,
          error: `File type (${mimeType}) is not allowed`,
        };
      }
    }
    
    // Blocked file types
    if (this.config.blockedTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `File type (${mimeType}) is blocked`,
      };
    }
    
    // File name validation
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(fileName)) {
      return {
        valid: false,
        error: 'File name contains invalid characters',
      };
    }
    
    // File name length
    if (fileName.length > 255) {
      return {
        valid: false,
        error: 'File name is too long (max 255 characters)',
      };
    }
    
    return { valid: true };
  }

  /**
   * Generate file URL
   */
  private generateFileUrl(fileId: string, fileName: string): string {
    return `/uploads/${fileId}/${fileName}`;
  }

  /**
   * Create multer middleware
   */
  createMulterMiddleware() {
    const storage = require('multer').diskStorage({
      destination: this.uploadService['tempDir'],
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
      },
      limits: {
        fileSize: this.config.maxFileSize,
        files: 1,
      },
      fileFilter: (req, file, cb) => {
        const validation = this.validateUploadRequest(file.size, file.mimetype, file.originalname);
        if (!validation.valid) {
          return cb(new Error(validation.error));
        }
        cb(null, true);
      },
    });
    
    return storage;
  }

  /**
   * Create rate limiting middleware
   */
  createRateLimitingMiddleware() {
    const requestCounts = new Map();
    
    return (req: Request, res, next) => {
      const key = req.ip || 'unknown';
      const currentCount = requestCounts.get(key) || 0;
      const maxRequests = this.config.rateLimiting.maxRequests;
      
      if (currentCount >= maxRequests) {
        res.status(429).json({ error: 'Too many requests' });
        return;
      }
      
      requestCounts.set(key, currentCount + 1);
      
      // Reset count after window expires
      setTimeout(() => {
        requestCounts.set(key, Math.max(0, requestCounts.get(key) - 1));
      }, this.config.rateLimiting.windowMs);
      
      next();
    };
  }

  /**
   * Create CORS middleware
   */
  createCorsMiddleware() {
    return (req: Request, res, next) => {
      const origin = req.headers.origin;
      
      if (this.config.cors.enabled && origin) {
        const isAllowed = this.config.cors.origins.includes('*') || this.config.cors.origins.includes(origin);
        
        if (!isAllowed) {
          res.status(403).json({ error: 'Origin not allowed' });
          return;
        }
      }
      
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', this.config.cors.methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', this.config.cors.headers ? Object.keys(this.config.cors.headers).join(', ') : '');
      
      next();
    };
  }

  /**
   * Create security middleware
   */
  createSecurityMiddleware() {
    return (req: Request, res, next) => {
      // Add security headers
      res.setHeader('X-Content-Type-Options: nosniff');
      res.setHeader('X-Frame-Options: 'DENY');
      res.setHeader('X-XSS-Protection: '1; mode=block');
      res.setHeader('Referrer-Policy': 'no-referrer');
      res.setHeader('Content-Security-Policy': "default-src 'self'");
      
      next();
    };
  }

  /**
   * Create comprehensive middleware
   */
  createMiddleware() {
    return [
      this.createSecurityMiddleware(),
      this.createRateLimitingMiddleware(),
      this.createCorsMiddleware(),
      this.createMulterMiddleware(),
    ];
  }
}

// Export singleton instance
let uploadController: UploadController | null = null;

export const getUploadController = (config?: Partial<UploadControllerConfig>): UploadController => {
  if (!uploadController) {
    uploadController = new UploadController(config);
  }
  return uploadController;
};

// Export utility functions
export const createUploadController = (config?: Partial<UploadControllerConfig>): UploadController => {
  return new UploadController(config);
};

export const createUploadRoutes = (app: any, config?: Partial<UploadControllerConfig>): void => {
  const controller = getUploadController(config);
  
  // Initialize upload routes
  app.post('/api/upload/initialize', (req, res) => controller.initializeUpload(req, res));
  app.post('/api/upload/chunk', (req, res) => controller.uploadChunk(req, res));
  app.get('/api/upload/:sessionId/status', (req, res) => controller.getUploadStatus(req, res));
  app.post('/api/upload/:sessionId/complete', (req, res) => controller.completeUpload(req, res));
  app.delete('/api/upload/:sessionId', (req, res) => controller.cancelUpload(req, res));
  app.post('/api/upload/:sessionId/retry', (req, res) => controller.retryUpload(req, res));
  app.delete('/api/upload/:sessionId', (req, res) => controller.deleteUpload(req, res));
  app.get('/api/uploads', (req, res) => controller.getUploadList(req, res));
  app.get('/api/uploads/stats', (req, res) => controller.getUploadStats(req, res));
  app.post('/api/upload/validate', (req, res) => controller.validateFile(req, res));
  app.get('/api/upload/:fileId/preview', (req, res) => controller.getFilePreview(req, res));
  app.get('/api/upload/:fileId/download', (req, res) => controller.downloadFile(req, res));
};

// Export types
export { UploadControllerConfig, UploadResult, UploadSession } from '../../types/fileUpload';
