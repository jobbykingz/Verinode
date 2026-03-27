import { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  UploadFile,
  UploadConfig,
  UploadProgress,
  UploadStatus,
  UploadChunk,
  UploadError,
  CloudStorageConfig,
  ResumableUploadConfig,
  SecurityConfig,
} from '../../types/fileUpload';

export interface UploadSession {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunks: UploadChunk[];
  uploadedChunks: Set<number>;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: UploadError;
  metadata: Record<string, any>;
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  url?: string;
  checksum: string;
  metadata: Record<string, any>;
  uploadedAt: Date;
  error?: string;
}

export class UploadService extends EventEmitter {
  private config: UploadConfig;
  private storageConfig: CloudStorageConfig;
  private resumableConfig: ResumableUploadConfig;
  private securityConfig: SecurityConfig;
  private uploadDir: string;
  private tempDir: string;
  private sessions: Map<string, UploadSession> = new Map();
  private activeConnections: Map<string, any> = new Map();

  constructor(config: Partial<UploadConfig> = {}) {
    super();
    
    this.config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      allowedTypes: [],
      blockedTypes: ['application/x-executable', 'application/x-msdownload'],
      chunkSize: 1024 * 1024, // 1MB
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      enableResumable: true,
      enableChunked: true,
      enableCompression: false,
      enableEncryption: false,
      enableValidation: true,
      enableVirusScanning: false,
      enableThumbnailGeneration: true,
      enableMetadataExtraction: true,
      storageProvider: {
        name: 'local',
        type: 'local',
        config: {},
      },
      compressionLevel: 6,
      validationRules: [],
      virusScanner: {
        provider: 'custom',
        config: {},
        enabled: false,
      },
      thumbnailConfig: {
        enabled: true,
        maxWidth: 800,
        maxHeight: 600,
        quality: 80,
        format: 'jpeg',
        generateMultiple: false,
        sizes: [],
      },
      ...config,
    };
    
    this.storageConfig = {
      provider: 'local',
      region: 'us-east-1',
      bucket: 'uploads',
      credentials: {},
      encryption: {
        enabled: false,
        algorithm: 'AES-256',
      },
      compression: {
        enabled: false,
        algorithm: 'gzip',
        level: 6,
      },
      cors: {
        enabled: true,
        origins: ['*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers: {},
      },
    };
    
    this.resumableConfig = {
      enabled: true,
      chunkSize: this.config.chunkSize,
      maxChunkSize: 100 * 1024 * 1024,
      minChunkSize: 100 * 1024,
      testChunks: true,
      parallelUploads: 3,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      storageMethod: 'local',
    };
    
    this.securityConfig = {
      enableVirusScanning: false,
      enableContentValidation: true,
      enableChecksumValidation: true,
      enableMetadataExtraction: true,
      enableEncryption: false,
      enableAccessControl: false,
      allowedOrigins: ['*'],
      blockedOrigins: [],
      maxUploadSize: this.config.maxFileSize,
      maxFileAge: 365 * 24 * 60 * 60 * 1000,
      requireAuthentication: false,
      enableAuditLogging: true,
    };
    
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.tempDir = path.join(process.cwd(), 'temp');
    
    this.initializeDirectories();
  }

  /**
   * Initialize upload directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log('Upload directories initialized');
    } catch (error) {
      console.error('Failed to initialize directories:', error);
      throw error;
    }
  }

  /**
   * Initialize upload session
   */
  async initializeUpload(
    fileId: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    totalChunks: number,
    metadata: Record<string, any> = {}
  ): Promise<UploadSession> {
    const sessionId = uuidv4();
    
    // Create chunks
    const chunks: UploadChunk[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, fileSize);
      
      chunks.push({
        id: `${sessionId}_chunk_${i}`,
        index: i,
        start,
        end,
        size: end - start,
        data: new ArrayBuffer(0),
        checksum: '',
        uploaded: false,
        retries: 0,
      });
    }
    
    const session: UploadSession = {
      id: sessionId,
      fileId,
      fileName,
      fileSize,
      mimeType,
      chunks,
      uploadedChunks: new Set(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };
    
    this.sessions.set(sessionId, session);
    
    // Clean up old sessions
    this.cleanupOldSessions();
    
    this.emit('sessionInitialized', { sessionId, fileId });
    
    return session;
  }

  /**
   * Upload chunk
   */
  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunkData: Buffer,
    checksum: string
  ): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    const chunk = session.chunks[chunkIndex];
    if (!chunk) {
      return { success: false, error: 'Chunk not found' };
    }
    
    try {
      // Validate checksum
      if (this.securityConfig.enableChecksumValidation) {
        const calculatedChecksum = crypto
          .createHash('md5')
          .update(chunkData)
          .digest('hex');
        
        if (calculatedChecksum !== checksum) {
          throw new Error('Chunk checksum mismatch');
        }
      }
      
      // Validate chunk size
      if (chunkData.length !== chunk.size) {
        throw new Error('Chunk size mismatch');
      }
      
      // Store chunk data
      const chunkPath = path.join(this.tempDir, `${sessionId}_chunk_${chunkIndex}`);
      await fs.writeFile(chunkPath, chunkData);
      
      // Update chunk
      chunk.data = chunkData.buffer;
      chunk.checksum = checksum;
      chunk.uploaded = true;
      chunk.retries = 0;
      
      session.uploadedChunks.add(chunkIndex);
      session.updatedAt = new Date();
      
      // Check if upload is complete
      if (session.uploadedChunks.size === session.chunks.length) {
        await this.completeUpload(sessionId);
      }
      
      this.emit('chunkUploaded', { sessionId, chunkIndex });
      
      return { success: true };
    } catch (error) {
      chunk.retries++;
      chunk.error = {
        code: 'CHUNK_UPLOAD_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        timestamp: new Date(),
        retryCount: chunk.retries,
        maxRetries: this.config.maxRetries,
      };
      
      session.updatedAt = new Date();
      
      this.emit('chunkError', { sessionId, chunkIndex, error: chunk.error });
      
      if (chunk.retries >= this.config.maxRetries) {
        session.status = 'failed';
        session.error = chunk.error;
        this.emit('uploadFailed', { sessionId, error: chunk.error });
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Complete upload
   */
  private async completeUpload(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    try {
      session.status = 'uploading';
      session.updatedAt = new Date();
      
      // Combine chunks into final file
      const finalPath = path.join(this.uploadDir, session.fileId);
      const writeStream = fs.createWriteStream(finalPath);
      
      // Write chunks in order
      for (let i = 0; i < session.chunks.length; i++) {
        const chunk = session.chunks[i];
        if (chunk.uploaded && chunk.data) {
          const chunkBuffer = Buffer.from(chunk.data);
          writeStream.write(chunkBuffer);
        }
      }
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        writeStream.end();
      });
      
      // Verify final file
      const stats = await fs.stat(finalPath);
      if (stats.size !== session.fileSize) {
        throw new Error('File size mismatch after combining chunks');
      }
      
      // Generate final checksum
      const fileBuffer = await fs.readFile(finalPath);
      const finalChecksum = crypto
        .createHash('sha256')
        .update(fileBuffer)
        .digest('hex');
      
      // Clean up temporary chunks
      await this.cleanupChunks(sessionId);
      
      // Update session
      session.status = 'completed';
      session.completedAt = new Date();
      session.updatedAt = new Date();
      
      // Generate file URL
      const url = this.generateFileUrl(session.fileId, session.fileName);
      
      this.emit('uploadCompleted', {
        sessionId,
        fileId: session.fileId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        mimeType: session.mimeType,
        filePath: finalPath,
        url,
        checksum: finalChecksum,
        metadata: session.metadata,
        uploadedAt: session.completedAt,
      });
      
      console.log(`Upload completed: ${session.fileName} (${session.fileId})`);
    } catch (error) {
      session.status = 'failed';
      session.error = {
        code: 'UPLOAD_COMPLETION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      };
      
      this.emit('uploadFailed', { sessionId, error: session.error });
    }
  }

  /**
   * Get upload session
   */
  getUploadSession(sessionId: string): UploadSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get upload status
   */
  getUploadStatus(sessionId: string): {
    status: string;
    progress: number;
    uploadedChunks: number;
    totalChunks: number;
    error?: UploadError;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    return {
      status: session.status,
      progress: (session.uploadedChunks.size / session.chunks.length) * 100,
      uploadedChunks: session.uploadedChunks.size,
      totalChunks: session.chunks.length,
      error: session.error,
    };
  }

  /**
   * Pause upload
   */
  pauseUpload(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'uploading') return false;
    
    session.status = 'paused';
    session.updatedAt = new Date();
    
    this.emit('uploadPaused', { sessionId });
    
    return true;
  }

  /**
   * Resume upload
   */
  resumeUpload(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') return false;
    
    session.status = 'uploading';
    session.updatedAt = new Date();
    
    this.emit('uploadResumed', { sessionId });
    
    return true;
  }

  /**
   * Cancel upload
   */
  cancelUpload(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.status = 'cancelled';
    session.updatedAt = new Date();
    
    // Clean up chunks
    this.cleanupChunks(sessionId);
    
    this.emit('uploadCancelled', { sessionId });
    
    return true;
  }

  /**
   * Retry upload
   */
  retryUpload(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'failed') return false;
    
    // Reset failed chunks
    session.chunks.forEach(chunk => {
      if (chunk.error) {
        chunk.uploaded = false;
        chunk.retries = 0;
        chunk.error = undefined;
      }
    });
    
    session.uploadedChunks.clear();
    session.status = 'pending';
    session.error = undefined;
    session.updatedAt = new Date();
    
    this.emit('uploadRetried', { sessionId });
    
    return true;
  }

  /**
   * Delete upload
   */
  async deleteUpload(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    try {
      // Delete file if it exists
      const filePath = path.join(this.uploadDir, session.fileId);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, which is fine
      }
      
      // Clean up chunks
      await this.cleanupChunks(sessionId);
      
      // Remove session
      this.sessions.delete(sessionId);
      
      this.emit('uploadDeleted', { sessionId });
      
      return true;
    } catch (error) {
      console.error('Failed to delete upload:', error);
      return false;
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): UploadSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.status !== 'completed' && session.status !== 'cancelled'
    );
  }

  /**
   * Get upload statistics
   */
  getUploadStats() {
    const sessions = Array.from(this.sessions.values());
    
    return {
      total: sessions.length,
      pending: sessions.filter(s => s.status === 'pending').length,
      uploading: sessions.filter(s => s.status === 'uploading').length,
      paused: sessions.filter(s => s.status === 'paused').length,
      completed: sessions.filter(s => s.status === 'completed').length,
      failed: sessions.filter(s => s.status === 'failed').length,
      cancelled: sessions.filter(s => s.status === 'cancelled').length,
      totalSize: sessions.reduce((sum, s) => sum + s.fileSize, 0),
      uploadedSize: sessions.reduce((sum, s) => {
        const progress = s.uploadedChunks.size / s.chunks.length;
        return sum + (s.fileSize * progress);
      }, 0),
    };
  }

  /**
   * Clean up old sessions
   */
  private async cleanupOldSessions(): Promise<void> {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.createdAt.getTime() > maxAge) {
        if (session.status === 'completed' || session.status === 'cancelled' || session.status === 'failed') {
          await this.deleteUpload(sessionId);
        }
      }
    }
  }

  /**
   * Clean up chunks
   */
  private async cleanupChunks(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) return;
      
      for (let i = 0; i < session.chunks.length; i++) {
        const chunkPath = path.join(this.tempDir, `${sessionId}_chunk_${i}`);
        try {
          await fs.unlink(chunkPath);
        } catch (error) {
          // Chunk file might not exist
        }
      }
    } catch (error) {
      console.error('Failed to cleanup chunks:', error);
    }
  }

  /**
   * Generate file URL
   */
  private generateFileUrl(fileId: string, fileName: string): string {
    if (this.storageConfig.provider === 'local') {
      return `/uploads/${fileId}/${fileName}`;
    }
    
    // For other storage providers, generate appropriate URL
    return `/uploads/${fileId}/${fileName}`;
  }

  /**
   * Validate upload request
   */
  validateUploadRequest(
    fileSize: number,
    mimeType: string,
    fileName: string
  ): { valid: boolean; error?: string } {
    // Check file size
    if (fileSize > this.config.maxFileSize) {
      return {
        valid: false,
        error: `File size (${fileSize}) exceeds maximum allowed size (${this.config.maxFileSize})`,
      };
    }
    
    // Check file type
    if (this.config.allowedTypes.length > 0 && !this.config.allowedTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `File type (${mimeType}) is not allowed`,
      };
    }
    
    // Check blocked file types
    if (this.config.blockedTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `File type (${mimeType}) is blocked`,
      };
    }
    
    // Check file name
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(fileName)) {
      return {
        valid: false,
        error: 'File name contains invalid characters',
      };
    }
    
    return { valid: true };
  }

  /**
   * Create multer middleware for file uploads
   */
  createMulterMiddleware() {
    const storage = multer.diskStorage({
      destination: this.tempDir,
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix);
      },
    });
    
    return multer({
      storage,
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
  }

  /**
   * Handle upload request
   */
  async handleUpload(req: Request, res: Response): Promise<void> {
    try {
      const { fileId, fileName, fileSize, mimeType, totalChunks } = req.body;
      
      // Validate request
      const validation = this.validateUploadRequest(
        parseInt(fileSize),
        mimeType,
        fileName
      );
      
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }
      
      // Initialize session
      const session = await this.initializeUpload(
        fileId,
        fileName,
        parseInt(fileSize),
        mimeType,
        parseInt(totalChunks)
      );
      
      res.status(200).json({
        sessionId: session.id,
        fileId: session.fileId,
        chunkSize: this.config.chunkSize,
        maxRetries: this.config.maxRetries,
      });
    } catch (error) {
      console.error('Upload initialization failed:', error);
      res.status(500).json({ error: 'Failed to initialize upload' });
    }
  }

  /**
   * Handle chunk upload request
   */
  async handleChunkUpload(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, chunkIndex, checksum } = req.body;
      
      const session = this.getUploadSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Upload session not found' });
        return;
      }
      
      if (!req.file) {
        res.status(400).json({ error: 'No file data provided' });
        return;
      }
      
      // Read chunk data
      const chunkData = await fs.readFile(req.file.path);
      await fs.unlink(req.file.path); // Clean up temporary file
      
      // Upload chunk
      const result = await this.uploadChunk(
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
      console.error('Chunk upload failed:', error);
      res.status(500).json({ error: 'Failed to upload chunk' });
    }
  }

  /**
   * Handle upload status request
   */
  async handleUploadStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      const status = this.getUploadStatus(sessionId);
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
}

// Export singleton instance
let uploadService: UploadService | null = null;

export const getUploadService = (config?: Partial<UploadConfig>): UploadService => {
  if (!uploadService) {
    uploadService = new UploadService(config);
  }
  return uploadService;
};

// Export utility functions
export const createUploadService = (config?: Partial<UploadConfig>): UploadService => {
  return new UploadService(config);
};
