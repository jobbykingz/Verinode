import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UploadFile,
  UploadConfig,
  UploadOptions,
  UseFileUploadReturn,
  UploadStats,
  UploadEvent,
  UploadEventType,
  DEFAULT_UPLOAD_CONFIG,
} from '../types/fileUpload';
import { getUploadService } from '../services/uploadService';

export const useFileUpload = (config: Partial<UploadConfig> = {}): UseFileUploadReturn => {
  const uploadConfig = { ...DEFAULT_UPLOAD_CONFIG, ...config };
  const uploadService = getUploadService(uploadConfig);
  
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<UploadStats>({
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
    totalBytes: 0,
    averageSpeed: 0,
    totalFiles: 0,
    fileTypeStats: {},
    dailyStats: [],
    monthlyStats: [],
  });
  
  const eventListeners = useRef<Map<string, string>>(new Map());
  const updateInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize event listeners
  useEffect(() => {
    const listeners = [
      uploadService.addEventListener('fileAdded', (data) => {
        const { file } = data;
        setFiles(prev => [...prev, file]);
      }),
      
      uploadService.addEventListener('fileRemoved', (data) => {
        const { fileId } = data;
        setFiles(prev => prev.filter(f => f.id !== fileId));
      }),
      
      uploadService.addEventListener('uploadStarted', (data) => {
        const { fileId } = data;
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: { ...f.status, state: 'uploading' } }
            : f
        ));
        setIsUploading(true);
      }),
      
      uploadService.addEventListener('uploadProgress', (data) => {
        const { fileId, progress: uploadProgress } = data;
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, progress: uploadProgress }
            : f
        ));
        
        // Update overall progress
        const currentFiles = uploadService.getActiveUploads();
        if (currentFiles.length > 0) {
          const totalProgress = currentFiles.reduce((sum, f) => sum + f.progress.percentage, 0) / currentFiles.length;
          setProgress(totalProgress);
        }
      }),
      
      uploadService.addEventListener('uploadPaused', (data) => {
        const { fileId } = data;
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: { ...f.status, state: 'paused', isPaused: true } }
            : f
        ));
        setIsPaused(true);
      }),
      
      uploadService.addEventListener('uploadResumed', (data) => {
        const { fileId } = data;
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: { ...f.status, state: 'uploading', isPaused: false } }
            : f
        ));
        setIsPaused(false);
      }),
      
      uploadService.addEventListener('uploadCompleted', (data) => {
        const { fileId, file } = data;
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: { ...f.status, state: 'completed' }, uploadedAt: file.uploadedAt }
            : f
        ));
        
        // Update stats
        const currentStats = uploadService.getUploadStats();
        setStats(prev => ({
          ...prev,
          successfulUploads: currentStats.completed,
          totalUploads: prev.totalUploads + 1,
        }));
        
        // Check if all uploads are completed
        const activeUploads = uploadService.getActiveUploads();
        const uploadingFiles = activeUploads.filter(f => f.status.state === 'uploading');
        if (uploadingFiles.length === 0) {
          setIsUploading(false);
          setIsPaused(false);
        }
      }),
      
      uploadService.addEventListener('uploadFailed', (data) => {
        const { fileId, error: uploadError } = data;
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: { ...f.status, state: 'failed' }, error: uploadError }
            : f
        ));
        
        // Update stats
        const currentStats = uploadService.getUploadStats();
        setStats(prev => ({
          ...prev,
          failedUploads: currentStats.failed,
          totalUploads: prev.totalUploads + 1,
        }));
        
        setError(new Error(uploadError.message));
        
        // Check if all uploads are completed
        const activeUploads = uploadService.getActiveUploads();
        const uploadingFiles = activeUploads.filter(f => f.status.state === 'uploading');
        if (uploadingFiles.length === 0) {
          setIsUploading(false);
          setIsPaused(false);
        }
      }),
      
      uploadService.addEventListener('uploadCancelled', (data) => {
        const { fileId } = data;
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: { ...f.status, state: 'cancelled' } }
            : f
        ));
        
        // Check if all uploads are completed
        const activeUploads = uploadService.getActiveUploads();
        const uploadingFiles = activeUploads.filter(f => f.status.state === 'uploading');
        if (uploadingFiles.length === 0) {
          setIsUploading(false);
          setIsPaused(false);
        }
      }),
    ];
    
    // Store listener IDs for cleanup
    listeners.forEach((listenerId, index) => {
      eventListeners.current.set(`listener_${index}`, listenerId);
    });
    
    // Cleanup on unmount
    return () => {
      eventListeners.current.forEach(listenerId => {
        uploadService.removeEventListener(listenerId);
      });
      eventListeners.current.clear();
    };
  }, [uploadService]);

  // Update stats periodically
  useEffect(() => {
    updateInterval.current = setInterval(() => {
      const currentStats = uploadService.getUploadStats();
      setStats(prev => ({
        ...prev,
        ...currentStats,
      }));
    }, 1000);
    
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [uploadService]);

  // Upload files
  const upload = useCallback(async (options: UploadOptions): Promise<UploadFile[]> => {
    try {
      setError(null);
      
      const uploadFiles = await uploadService.uploadFiles(options.files, {
        config: uploadConfig,
        ...options,
      });
      
      // Update local state
      setFiles(prev => [...prev, ...uploadFiles]);
      
      // Call callbacks
      if (options.onStart) {
        options.onStart(uploadFiles);
      }
      
      return uploadFiles;
    } catch (error) {
      const err = error as Error;
      setError(err);
      throw err;
    }
  }, [uploadService, uploadConfig]);

  // Pause all uploads
  const pause = useCallback(() => {
    uploadService.pauseAllUploads();
    setIsPaused(true);
  }, [uploadService]);

  // Resume all uploads
  const resume = useCallback(() => {
    uploadService.resumeAllUploads();
    setIsPaused(false);
  }, [uploadService]);

  // Cancel all uploads
  const cancel = useCallback(() => {
    uploadService.cancelAllUploads();
    setIsUploading(false);
    setIsPaused(false);
    setFiles([]);
  }, [uploadService]);

  // Retry specific file
  const retry = useCallback((fileId?: string) => {
    if (fileId) {
      uploadService.retryUpload(fileId);
    } else {
      // Retry all failed uploads
      const failedFiles = files.filter(f => f.status.state === 'failed');
      failedFiles.forEach(f => uploadService.retryUpload(f.id));
    }
  }, [uploadService, files]);

  // Remove file
  const remove = useCallback((fileId: string) => {
    uploadService.removeUpload(fileId);
  }, [uploadService]);

  // Clear all files
  const clear = useCallback(() => {
    uploadService.clearCompletedUploads();
    setFiles(prev => prev.filter(f => 
      f.status.state !== 'completed' && f.status.state !== 'failed'
    ));
  }, [uploadService]);

  // Retry all failed uploads
  const retryAll = useCallback(() => {
    uploadService.pauseAllUploads();
    const failedFiles = files.filter(f => f.status.state === 'failed');
    failedFiles.forEach(f => uploadService.retryUpload(f.id));
    uploadService.resumeAllUploads();
  }, [uploadService, files]);

  // Pause all uploads
  const pauseAll = useCallback(() => {
    uploadService.pauseAllUploads();
  }, [uploadService]);

  // Resume all uploads
  const resumeAll = useCallback(() => {
    uploadService.resumeAllUploads();
  }, [uploadService]);

  // Cancel all uploads
  const cancelAll = useCallback(() => {
    uploadService.cancelAllUploads();
  }, [uploadService]);

  // Get current stats
  const getStatsCallback = useCallback((): UploadStats => {
    return uploadService.getUploadStats();
  }, [uploadService]);

  // Additional utility methods
  const getUploadProgress = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    return file?.progress || null;
  }, [files]);

  const getUploadStatus = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    return file?.status || null;
  }, [files]);

  const isFileUploading = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    return file?.status.state === 'uploading' || false;
  }, [files]);

  const isFileCompleted = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    return file?.status.state === 'completed' || false;
  }, [files]);

  const isFileFailed = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    return file?.status.state === 'failed' || false;
  }, [files]);

  const getFileError = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    return file?.error || null;
  }, [files]);

  const getFilesByStatus = useCallback((status: string) => {
    return files.filter(f => f.status.state === status);
  }, [files]);

  const getFilesByType = useCallback((mimeType: string) => {
    return files.filter(f => f.type === mimeType);
  }, [files]);

  const getTotalSize = useCallback(() => {
    return files.reduce((sum, f) => sum + f.size, 0);
  }, [files]);

  const getUploadedSize = useCallback(() => {
    return files.reduce((sum, f) => sum + f.progress.bytesUploaded, 0);
  }, [files]);

  const getEstimatedTimeRemaining = useCallback(() => {
    const uploadingFiles = files.filter(f => f.status.state === 'uploading');
    if (uploadingFiles.length === 0) return 0;
    
    const totalRemaining = uploadingFiles.reduce((sum, f) => 
      sum + (f.progress.totalBytes - f.progress.bytesUploaded), 0
    );
    
    const averageSpeed = uploadingFiles.reduce((sum, f) => sum + f.progress.speed, 0) / uploadingFiles.length;
    
    return averageSpeed > 0 ? totalRemaining / averageSpeed : 0;
  }, [files]);

  // Initialize with existing uploads
  useEffect(() => {
    const existingUploads = uploadService.getActiveUploads();
    setFiles(existingUploads);
    
    // Set initial states
    const uploadingCount = existingUploads.filter(f => f.status.state === 'uploading').length;
    setIsUploading(uploadingCount > 0);
    
    const pausedCount = existingUploads.filter(f => f.status.state === 'paused').length;
    setIsPaused(pausedCount > 0);
    
    // Calculate initial progress
    if (existingUploads.length > 0) {
      const totalProgress = existingUploads.reduce((sum, f) => sum + f.progress.percentage, 0) / existingUploads.length;
      setProgress(totalProgress);
    }
  }, [uploadService]);

  return {
    files,
    progress,
    isUploading,
    isPaused,
    error,
    upload,
    pause,
    resume,
    cancel,
    retry,
    remove,
    clear,
    retryAll,
    pauseAll,
    resumeAll,
    cancelAll,
    getStats: getStatsCallback,
    // Additional utility methods
    getUploadProgress,
    getUploadStatus,
    isFileUploading,
    isFileCompleted,
    isFileFailed,
    getFileError,
    getFilesByStatus,
    getFilesByType,
    getTotalSize,
    getUploadedSize,
    getEstimatedTimeRemaining,
  };
};

// Additional hooks for specific use cases

export const useUploadProgress = (fileId: string) => {
  const { getUploadProgress, isFileUploading, isFileCompleted, isFileFailed } = useFileUpload();
  
  const progress = getUploadProgress(fileId);
  const uploading = isFileUploading(fileId);
  const completed = isFileCompleted(fileId);
  const failed = isFileFailed(fileId);
  
  return {
    progress,
    uploading,
    completed,
    failed,
    percentage: progress?.percentage || 0,
    speed: progress?.speed || 0,
    timeElapsed: progress?.timeElapsed || 0,
    timeRemaining: progress?.timeRemaining,
    bytesUploaded: progress?.bytesUploaded || 0,
    totalBytes: progress?.totalBytes || 0,
  };
};

export const useUploadStats = () => {
  const { getStats, files, getTotalSize, getUploadedSize } = useFileUpload();
  
  const stats = getStats();
  const totalSize = getTotalSize();
  const uploadedSize = getUploadedSize();
  
  return {
    ...stats,
    totalSize,
    uploadedSize,
    completionRate: totalSize > 0 ? uploadedSize / totalSize : 0,
    successRate: stats.totalUploads > 0 ? stats.successfulUploads / stats.totalUploads : 0,
    failureRate: stats.totalUploads > 0 ? stats.failedUploads / stats.totalUploads : 0,
  };
};

export const useUploadQueue = () => {
  const { files, pause, resume, cancel, retry, remove, clear } = useFileUpload();
  
  const pendingFiles = files.filter(f => f.status.state === 'pending');
  const uploadingFiles = files.filter(f => f.status.state === 'uploading');
  const pausedFiles = files.filter(f => f.status.state === 'paused');
  const completedFiles = files.filter(f => f.status.state === 'completed');
  const failedFiles = files.filter(f => f.status.state === 'failed');
  const cancelledFiles = files.filter(f => f.status.state === 'cancelled');
  
  return {
    files,
    pendingFiles,
    uploadingFiles,
    pausedFiles,
    completedFiles,
    failedFiles,
    cancelledFiles,
    totalCount: files.length,
    pendingCount: pendingFiles.length,
    uploadingCount: uploadingFiles.length,
    pausedCount: pausedFiles.length,
    completedCount: completedFiles.length,
    failedCount: failedFiles.length,
    cancelledCount: cancelledFiles.length,
    pause,
    resume,
    cancel,
    retry,
    remove,
    clear,
  };
};

export const useFileValidation = () => {
  const validateFiles = useCallback(async (files: File[], options: {
    maxSize?: number;
    allowedTypes?: string[];
    maxFiles?: number;
  } = {}) => {
    const results = [];
    
    for (const file of files) {
      const result = {
        file,
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
      };
      
      // Check file size
      if (options.maxSize && file.size > options.maxSize) {
        result.valid = false;
        result.errors.push(`File size (${file.size}) exceeds maximum size (${options.maxSize})`);
      }
      
      // Check file type
      if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
        result.valid = false;
        result.errors.push(`File type (${file.type}) is not allowed`);
      }
      
      // Check max files
      if (options.maxFiles && results.length >= options.maxFiles) {
        result.valid = false;
        result.errors.push(`Maximum number of files (${options.maxFiles}) exceeded`);
      }
      
      results.push(result);
    }
    
    return results;
  }, []);
  
  return { validateFiles };
};

export const useUploadHistory = () => {
  const [history, setHistory] = useState<UploadFile[]>([]);
  
  const addToHistory = useCallback((file: UploadFile) => {
    setHistory(prev => [file, ...prev.slice(0, 99)]); // Keep last 100 uploads
  }, []);
  
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);
  
  const getHistoryByDate = useCallback((date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return history.filter(file => {
      const fileDate = new Date(file.createdAt);
      return fileDate >= startOfDay && fileDate <= endOfDay;
    });
  }, [history]);
  
  const getHistoryByType = useCallback((mimeType: string) => {
    return history.filter(file => file.type === mimeType);
  }, [history]);
  
  return {
    history,
    addToHistory,
    clearHistory,
    getHistoryByDate,
    getHistoryByType,
  };
};
