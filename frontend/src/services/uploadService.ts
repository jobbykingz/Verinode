import {
  UploadFile,
  UploadConfig,
  UploadProgress,
  UploadStatus,
  UploadChunk,
  UploadError,
  UploadOptions,
  UploadEvent,
  UploadEventType,
  UploadListener,
  CloudStorageConfig,
  ResumableUploadConfig,
  SecurityConfig,
  DEFAULT_UPLOAD_CONFIG,
  DEFAULT_CLOUD_STORAGE_CONFIG,
  DEFAULT_RESUMABLE_CONFIG,
  DEFAULT_SECURITY_CONFIG,
} from '../types/fileUpload';

export class UploadService {
  private config: UploadConfig;
  private listeners: Map<string, UploadListener> = new Map();
  private activeUploads: Map<string, UploadFile> = new Map();
  private uploadQueue: UploadFile[] = [];
  private maxConcurrentUploads: number;
  private isPaused: boolean = false;
  private retryQueue: Map<string, NodeJS.Timeout> = new Map();
  private eventEmitter: EventTarget;

  constructor(config: Partial<UploadConfig> = {}) {
    this.config = { ...DEFAULT_UPLOAD_CONFIG, ...config };
    this.maxConcurrentUploads = 3;
    this.eventEmitter = new EventTarget();
    this.initializeEventListeners();
  }

  /**
   * Upload a single file
   */
  async uploadFile(file: File, options: Partial<UploadOptions> = {}): Promise<UploadFile> {
    const uploadFile = this.createUploadFile(file, options);
    this.activeUploads.set(uploadFile.id, uploadFile);
    
    try {
      // Validate file
      await this.validateFile(uploadFile);
      
      // Start upload
      await this.startUpload(uploadFile);
      
      return uploadFile;
    } catch (error) {
      this.handleUploadError(uploadFile, error as Error);
      throw error;
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(files: File[], options: Partial<UploadOptions> = {}): Promise<UploadFile[]> {
    const uploadFiles = files.map(file => this.createUploadFile(file, options));
    
    // Add all files to active uploads
    uploadFiles.forEach(file => this.activeUploads.set(file.id, file));
    
    // Add to queue
    this.uploadQueue.push(...uploadFiles);
    
    // Process queue
    this.processQueue();
    
    return uploadFiles;
  }

  /**
   * Pause upload
   */
  pauseUpload(fileId: string): boolean {
    const uploadFile = this.activeUploads.get(fileId);
    if (!uploadFile) return false;

    uploadFile.status.state = 'paused';
    uploadFile.status.isPaused = true;
    
    this.emitEvent('uploadPaused', { fileId });
    
    return true;
  }

  /**
   * Resume upload
   */
  resumeUpload(fileId: string): boolean {
    const uploadFile = this.activeUploads.get(fileId);
    if (!uploadFile || uploadFile.status.state !== 'paused') return false;

    uploadFile.status.state = 'uploading';
    uploadFile.status.isPaused = false;
    
    this.emitEvent('uploadResumed', { fileId });
    
    // Resume upload process
    this.resumeUploadProcess(uploadFile);
    
    return true;
  }

  /**
   * Cancel upload
   */
  cancelUpload(fileId: string): boolean {
    const uploadFile = this.activeUploads.get(fileId);
    if (!uploadFile) return false;

    uploadFile.status.state = 'cancelled';
    uploadFile.status.canCancel = false;
    
    // Clear retry timer
    const retryTimer = this.retryQueue.get(fileId);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this.retryQueue.delete(fileId);
    }
    
    this.emitEvent('uploadCancelled', { fileId });
    
    // Remove from active uploads
    this.activeUploads.delete(fileId);
    
    return true;
  }

  /**
   * Retry upload
   */
  retryUpload(fileId: string): boolean {
    const uploadFile = this.activeUploads.get(fileId);
    if (!uploadFile || !uploadFile.status.canRetry) return false;

    // Reset error
    uploadFile.error = undefined;
    uploadFile.status.state = 'pending';
    
    // Reset progress
    uploadFile.progress = {
      bytesUploaded: 0,
      totalBytes: uploadFile.size,
      percentage: 0,
      speed: 0,
      timeElapsed: 0,
      chunksCompleted: 0,
      totalChunks: uploadFile.chunks?.length || 0,
    };
    
    this.emitEvent('uploadStarted', { fileId });
    
    // Restart upload
    this.startUpload(uploadFile);
    
    return true;
  }

  /**
   * Remove upload
   */
  removeUpload(fileId: string): boolean {
    const uploadFile = this.activeUploads.get(fileId);
    if (!uploadFile) return false;

    // Cancel if still uploading
    if (uploadFile.status.state === 'uploading' || uploadFile.status.state === 'paused') {
      this.cancelUpload(fileId);
    }
    
    // Remove from queue
    this.uploadQueue = this.uploadQueue.filter(f => f.id !== fileId);
    
    // Remove from active uploads
    this.activeUploads.delete(fileId);
    
    this.emitEvent('fileRemoved', { fileId });
    
    return true;
  }

  /**
   * Get upload status
   */
  getUploadStatus(fileId: string): UploadFile | null {
    return this.activeUploads.get(fileId) || null;
  }

  /**
   * Get all active uploads
   */
  getActiveUploads(): UploadFile[] {
    return Array.from(this.activeUploads.values());
  }

  /**
   * Pause all uploads
   */
  pauseAllUploads(): void {
    this.isPaused = true;
    this.activeUploads.forEach(file => {
      if (file.status.state === 'uploading') {
        this.pauseUpload(file.id);
      }
    });
  }

  /**
   * Resume all uploads
   */
  resumeAllUploads(): void {
    this.isPaused = false;
    this.activeUploads.forEach(file => {
      if (file.status.state === 'paused') {
        this.resumeUpload(file.id);
      }
    });
  }

  /**
   * Cancel all uploads
   */
  cancelAllUploads(): void {
    this.activeUploads.forEach(file => {
      this.cancelUpload(file.id);
    });
    this.uploadQueue = [];
  }

  /**
   * Clear completed uploads
   */
  clearCompletedUploads(): void {
    const completedUploads = Array.from(this.activeUploads.values())
      .filter(file => file.status.state === 'completed' || file.status.state === 'failed');
    
    completedUploads.forEach(file => {
      this.activeUploads.delete(file.id);
    });
  }

  /**
   * Add event listener
   */
  addEventListener(event: UploadEventType, listener: (data: any) => void): string {
    const listenerId = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.listeners.set(listenerId, {
      onEvent: listener,
    });
    
    this.eventEmitter.addEventListener(event, (event: any) => {
      listener(event.detail);
    });
    
    return listenerId;
  }

  /**
   * Remove event listener
   */
  removeEventListener(listenerId: string): void {
    const listener = this.listeners.get(listenerId);
    if (listener) {
      this.listeners.delete(listenerId);
    }
  }

  /**
   * Get upload statistics
   */
  getUploadStats() {
    const uploads = Array.from(this.activeUploads.values());
    
    return {
      total: uploads.length,
      uploading: uploads.filter(f => f.status.state === 'uploading').length,
      paused: uploads.filter(f => f.status.state === 'paused').length,
      completed: uploads.filter(f => f.status.state === 'completed').length,
      failed: uploads.filter(f => f.status.state === 'failed').length,
      cancelled: uploads.filter(f => f.status.state === 'cancelled').length,
      totalBytes: uploads.reduce((sum, f) => sum + f.size, 0),
      uploadedBytes: uploads.reduce((sum, f) => sum + f.progress.bytesUploaded, 0),
      averageSpeed: uploads.reduce((sum, f) => sum + f.progress.speed, 0) / uploads.length || 0,
    };
  }

  // Private methods

  private createUploadFile(file: File, options: Partial<UploadOptions>): UploadFile {
    const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const uploadFile: UploadFile = {
      id,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified || Date.now(),
      uri: (file as any).uri || URL.createObjectURL(file),
      metadata: {
        originalName: file.name,
        extension: file.name.split('.').pop() || '',
        mimeType: file.type,
        encoding: (file as any).encoding,
      },
      status: {
        state: 'pending',
        isPaused: false,
        isResumable: this.config.enableResumable,
        canRetry: true,
        canCancel: true,
      },
      progress: {
        bytesUploaded: 0,
        totalBytes: file.size,
        percentage: 0,
        speed: 0,
        timeElapsed: 0,
        chunksCompleted: 0,
        totalChunks: 0,
      },
      priority: options.priority || 'normal',
      tags: options.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create chunks if chunked upload is enabled
    if (this.config.enableChunked && file.size > this.config.chunkSize) {
      uploadFile.chunks = this.createChunks(uploadFile);
      uploadFile.progress.totalChunks = uploadFile.chunks.length;
    }

    // Add custom metadata
    if (options.metadata) {
      uploadFile.metadata.customFields = options.metadata;
    }

    return uploadFile;
  }

  private createChunks(uploadFile: UploadFile): UploadChunk[] {
    const chunks: UploadChunk[] = [];
    const chunkSize = this.config.chunkSize;
    const totalChunks = Math.ceil(uploadFile.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, uploadFile.size);
      
      chunks.push({
        id: `${uploadFile.id}_chunk_${i}`,
        index: i,
        start,
        end,
        size: end - start,
        data: new ArrayBuffer(0), // Will be filled during upload
        checksum: '',
        uploaded: false,
        retries: 0,
      });
    }

    return chunks;
  }

  private async validateFile(uploadFile: UploadFile): Promise<void> {
    // File size validation
    if (uploadFile.size > this.config.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
    }

    // File type validation
    if (this.config.allowedTypes.length > 0 && !this.config.allowedTypes.includes(uploadFile.type)) {
      throw new Error(`File type ${uploadFile.type} is not allowed`);
    }

    // Blocked file types
    if (this.config.blockedTypes.includes(uploadFile.type)) {
      throw new Error(`File type ${uploadFile.type} is blocked`);
    }

    // Virus scanning
    if (this.config.enableVirusScanning) {
      await this.scanForViruses(uploadFile);
    }

    // Content validation
    if (this.config.enableValidation) {
      await this.validateContent(uploadFile);
    }
  }

  private async scanForViruses(uploadFile: UploadFile): Promise<void> {
    // Implement virus scanning
    // This would integrate with a virus scanning service
    console.log('Scanning for viruses:', uploadFile.name);
  }

  private async validateContent(uploadFile: UploadFile): Promise<void> {
    // Implement content validation
    // This would check file content for malicious data
    console.log('Validating content:', uploadFile.name);
  }

  private async startUpload(uploadFile: UploadFile): Promise<void> {
    uploadFile.status.state = 'uploading';
    uploadFile.progress.timeElapsed = Date.now();
    
    this.emitEvent('uploadStarted', { fileId: uploadFile.id });

    try {
      if (this.config.enableChunked && uploadFile.chunks) {
        await this.uploadChunks(uploadFile);
      } else {
        await this.uploadSingleFile(uploadFile);
      }
      
      // Mark as completed
      uploadFile.status.state = 'completed';
      uploadFile.uploadedAt = new Date();
      uploadFile.progress.percentage = 100;
      uploadFile.progress.bytesUploaded = uploadFile.size;
      
      this.emitEvent('uploadCompleted', { fileId: uploadFile.id, file: uploadFile });
      
    } catch (error) {
      this.handleUploadError(uploadFile, error as Error);
    }
  }

  private async uploadSingleFile(uploadFile: UploadFile): Promise<void> {
    const startTime = Date.now();
    
    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      if (uploadFile.status.state === 'cancelled') {
        clearInterval(uploadInterval);
        return;
      }
      
      if (uploadFile.status.state === 'paused') {
        return;
      }
      
      // Update progress
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / 5000) * 100, 100); // 5 second upload
      const uploadedBytes = Math.floor((progress / 100) * uploadFile.size);
      const speed = uploadedBytes / (elapsed / 1000);
      
      uploadFile.progress = {
        ...uploadFile.progress,
        bytesUploaded: uploadedBytes,
        percentage: progress,
        speed,
        timeElapsed: elapsed,
      };
      
      uploadFile.updatedAt = new Date();
      
      this.emitEvent('uploadProgress', { fileId: uploadFile.id, progress: uploadFile.progress });
      
      if (progress >= 100) {
        clearInterval(uploadInterval);
      }
    }, 100);
    
    // Wait for upload to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  private async uploadChunks(uploadFile: UploadFile): Promise<void> {
    if (!uploadFile.chunks) return;

    const startTime = Date.now();
    
    for (let i = 0; i < uploadFile.chunks.length; i++) {
      const chunk = uploadFile.chunks[i];
      
      if (uploadFile.status.state === 'cancelled') {
        break;
      }
      
      if (uploadFile.status.state === 'paused') {
        // Wait for resume
        await new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (uploadFile.status.state !== 'paused') {
              clearInterval(checkInterval);
              resolve(undefined);
            }
          }, 100);
        });
      }
      
      if (uploadFile.status.state === 'cancelled') {
        break;
      }
      
      try {
        // Upload chunk
        await this.uploadChunk(uploadFile, chunk);
        
        chunk.uploaded = true;
        uploadFile.progress.chunksCompleted++;
        
        // Update overall progress
        const uploadedBytes = uploadFile.chunks
          .filter(c => c.uploaded)
          .reduce((sum, c) => sum + c.size, 0);
        
        const progress = (uploadedBytes / uploadFile.size) * 100;
        const elapsed = Date.now() - startTime;
        const speed = uploadedBytes / (elapsed / 1000);
        
        uploadFile.progress = {
          ...uploadFile.progress,
          bytesUploaded: uploadedBytes,
          percentage: progress,
          speed,
          timeElapsed: elapsed,
          currentChunk: i,
        };
        
        uploadFile.updatedAt = new Date();
        
        this.emitEvent('chunkUploaded', { fileId: uploadFile.id, chunkIndex: i });
        this.emitEvent('uploadProgress', { fileId: uploadFile.id, progress: uploadFile.progress });
        
      } catch (error) {
        chunk.retries++;
        chunk.error = {
          code: 'CHUNK_UPLOAD_ERROR',
          message: `Failed to upload chunk ${i}`,
          details: error,
          timestamp: new Date(),
          retryCount: chunk.retries,
          maxRetries: this.config.maxRetries,
        };
        
        if (chunk.retries >= this.config.maxRetries) {
          throw new Error(`Failed to upload chunk ${i} after ${this.config.maxRetries} retries`);
        }
        
        // Retry delay
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        i--; // Retry this chunk
      }
    }
  }

  private async uploadChunk(uploadFile: UploadFile, chunk: UploadChunk): Promise<void> {
    // Simulate chunk upload
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // Simulate occasional failures
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error('Simulated chunk upload failure');
    }
  }

  private resumeUploadProcess(uploadFile: UploadFile): void {
    // Resume from where we left off
    if (this.config.enableChunked && uploadFile.chunks) {
      // Find next unuploaded chunk
      const nextChunkIndex = uploadFile.chunks.findIndex(chunk => !chunk.uploaded);
      if (nextChunkIndex !== -1) {
        uploadFile.progress.currentChunk = nextChunkIndex;
      }
    }
    
    // Resume upload
    this.startUpload(uploadFile);
  }

  private handleUploadError(uploadFile: UploadFile, error: Error): void {
    uploadFile.status.state = 'failed';
    uploadFile.error = {
      code: 'UPLOAD_ERROR',
      message: error.message,
      details: error,
      timestamp: new Date(),
      retryCount: uploadFile.error?.retryCount || 0,
      maxRetries: this.config.maxRetries,
    };
    
    this.emitEvent('uploadFailed', { fileId: uploadFile.id, error: uploadFile.error });
    
    // Auto-retry if enabled
    if (uploadFile.status.canRetry && uploadFile.error.retryCount < this.config.maxRetries) {
      this.scheduleRetry(uploadFile);
    }
  }

  private scheduleRetry(uploadFile: UploadFile): void {
    const retryDelay = this.config.retryDelay * Math.pow(2, uploadFile.error?.retryCount || 0);
    
    const retryTimer = setTimeout(() => {
      this.retryUpload(uploadFile.id);
    }, retryDelay);
    
    this.retryQueue.set(uploadFile.id, retryTimer);
  }

  private processQueue(): void {
    if (this.isPaused) return;
    
    const currentUploads = Array.from(this.activeUploads.values())
      .filter(file => file.status.state === 'uploading').length;
    
    if (currentUploads >= this.maxConcurrentUploads) return;
    
    const availableSlots = this.maxConcurrentUploads - currentUploads;
    const pendingFiles = this.uploadQueue.filter(file => file.status.state === 'pending');
    
    const filesToStart = pendingFiles.slice(0, availableSlots);
    
    filesToStart.forEach(file => {
      this.startUpload(file);
    });
  }

  private emitEvent(event: UploadEventType, data: any): void {
    const uploadEvent: UploadEvent = {
      type: event,
      data,
      timestamp: new Date(),
    };
    
    this.eventEmitter.dispatchEvent(new CustomEvent(event, { detail: uploadEvent }));
  }

  private initializeEventListeners(): void {
    // Process queue when upload states change
    this.eventEmitter.addEventListener('uploadCompleted', () => {
      this.processQueue();
    });
    
    this.eventEmitter.addEventListener('uploadFailed', () => {
      this.processQueue();
    });
    
    this.eventEmitter.addEventListener('uploadCancelled', () => {
      this.processQueue();
    });
  }
}

// Singleton instance
let uploadService: UploadService | null = null;

export const getUploadService = (config?: Partial<UploadConfig>): UploadService => {
  if (!uploadService) {
    uploadService = new UploadService(config);
  }
  return uploadService;
};

// Utility functions
export const createUploadService = (config?: Partial<UploadConfig>): UploadService => {
  return new UploadService(config);
};

export const uploadFile = async (
  file: File,
  options?: Partial<UploadOptions>
): Promise<UploadFile> => {
  const service = getUploadService();
  return service.uploadFile(file, options);
};

export const uploadFiles = async (
  files: File[],
  options?: Partial<UploadOptions>
): Promise<UploadFile[]> => {
  const service = getUploadService();
  return service.uploadFiles(files, options);
};
