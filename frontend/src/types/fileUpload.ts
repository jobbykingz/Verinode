export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  uri?: string;
  preview?: string;
  thumbnail?: string;
  metadata: FileMetadata;
  status: UploadStatus;
  progress: UploadProgress;
  error?: UploadError;
  chunks?: UploadChunk[];
  resumableKey?: string;
  priority: UploadPriority;
  tags: string[];
  uploadedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileMetadata {
  originalName: string;
  extension: string;
  mimeType: string;
  encoding?: string;
  checksum?: string;
  dimensions?: FileDimensions;
  duration?: number;
  bitrate?: number;
  frameRate?: number;
  colorSpace?: string;
  hasAudio?: boolean;
  hasVideo?: boolean;
  location?: Geolocation;
  camera?: CameraInfo;
  deviceInfo?: DeviceInfo;
  customFields?: Record<string, any>;
}

export interface FileDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface Geolocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp: number;
}

export interface CameraInfo {
  make?: string;
  model?: string;
  focalLength?: number;
  aperture?: string;
  iso?: number;
  shutterSpeed?: string;
  flash?: boolean;
  orientation?: number;
}

export interface DeviceInfo {
  platform: string;
  version: string;
  model: string;
  brand: string;
  userAgent: string;
  language: string;
  timezone: string;
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  timeElapsed: number; // milliseconds
  timeRemaining?: number; // milliseconds
  chunksCompleted: number;
  totalChunks: number;
  currentChunk?: number;
}

export interface UploadError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

export interface UploadChunk {
  id: string;
  index: number;
  start: number;
  end: number;
  size: number;
  data: ArrayBuffer;
  checksum: string;
  uploaded: boolean;
  retries: number;
  error?: UploadError;
}

export interface UploadStatus {
  state: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'validating' | 'processing';
  isPaused: boolean;
  isResumable: boolean;
  canRetry: boolean;
  canCancel: boolean;
}

export type UploadPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface UploadConfig {
  maxFileSize: number;
  maxFiles: number;
  allowedTypes: string[];
  blockedTypes: string[];
  chunkSize: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  enableResumable: boolean;
  enableChunked: boolean;
  enableCompression: boolean;
  enableEncryption: boolean;
  enableValidation: boolean;
  enableVirusScanning: boolean;
  enableThumbnailGeneration: boolean;
  enableMetadataExtraction: boolean;
  storageProvider: StorageProvider;
  compressionLevel: number;
  encryptionKey?: string;
  validationRules: ValidationRule[];
  virusScanner: VirusScanner;
  thumbnailConfig: ThumbnailConfig;
}

export interface StorageProvider {
  name: string;
  type: 's3' | 'ipfs' | 'local' | 'azure' | 'google' | 'custom';
  config: Record<string, any>;
  credentials?: Record<string, any>;
}

export interface ValidationRule {
  type: ValidationType;
  enabled: boolean;
  config: Record<string, any>;
  message: string;
}

export type ValidationType = 
  | 'fileSize'
  | 'fileType'
  | 'fileName'
  | 'virus'
  | 'content'
  | 'metadata'
  | 'checksum'
  | 'custom';

export interface VirusScanner {
  provider: 'clamav' | 'virustotal' | 'custom';
  config: Record<string, any>;
  enabled: boolean;
}

export interface ThumbnailConfig {
  enabled: boolean;
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
  generateMultiple: boolean;
  sizes: ThumbnailSize[];
}

export interface ThumbnailSize {
  name: string;
  width: number;
  height: number;
  quality: number;
}

export interface UploadQueue {
  id: string;
  name: string;
  files: UploadFile[];
  status: QueueStatus;
  progress: QueueProgress;
  settings: QueueSettings;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: QueueError;
}

export interface QueueStatus {
  state: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  isPaused: boolean;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
}

export interface QueueProgress {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  percentage: number;
  speed: number;
  timeElapsed: number;
  timeRemaining?: number;
}

export interface QueueSettings {
  maxConcurrentUploads: number;
  retryFailedFiles: boolean;
  pauseOnError: boolean;
  enableNotifications: boolean;
  enableLogging: boolean;
  priority: UploadPriority;
  autoStart: boolean;
}

export interface QueueError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  fileId?: string;
}

export interface UploadSession {
  id: string;
  name: string;
  files: UploadFile[];
  config: UploadConfig;
  status: SessionStatus;
  progress: SessionProgress;
  settings: SessionSettings;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: SessionError;
}

export interface SessionStatus {
  state: 'initializing' | 'ready' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  isPaused: boolean;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
}

export interface SessionProgress {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  percentage: number;
  speed: number;
  timeElapsed: number;
  timeRemaining?: number;
}

export interface SessionSettings {
  autoRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  enableNotifications: boolean;
  enableLogging: boolean;
  saveProgress: boolean;
  clearOnComplete: boolean;
}

export interface SessionError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  fileId?: string;
}

export interface UploadStats {
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  totalBytes: number;
  averageSpeed: number;
  totalFiles: number;
  fileTypeStats: Record<string, number>;
  dailyStats: DailyStats[];
  monthlyStats: MonthlyStats[];
}

export interface DailyStats {
  date: string;
  uploads: number;
  bytes: number;
  averageSpeed: number;
  successRate: number;
}

export interface MonthlyStats {
  month: string;
  uploads: number;
  bytes: number;
  averageSpeed: number;
  successRate: number;
}

export interface UploadEvent {
  type: UploadEventType;
  fileId?: string;
  sessionId?: string;
  queueId?: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export type UploadEventType = 
  | 'fileAdded'
  | 'fileRemoved'
  | 'uploadStarted'
  | 'uploadProgress'
  | 'uploadPaused'
  | 'uploadResumed'
  | 'uploadCompleted'
  | 'uploadFailed'
  | 'uploadCancelled'
  | 'chunkUploaded'
  | 'validationStarted'
  | 'validationCompleted'
  | 'validationFailed'
  | 'virusScanStarted'
  | 'virusScanCompleted'
  | 'virusDetected'
  | 'thumbnailGenerated'
  | 'metadataExtracted'
  | 'queueStarted'
  | 'queuePaused'
  | 'queueResumed'
  | 'queueCompleted'
  | 'queueFailed'
  | 'sessionStarted'
  | 'sessionPaused'
  | 'sessionResumed'
  | 'sessionCompleted'
  | 'sessionFailed';

export interface UploadListener {
  onEvent: (event: UploadEvent) => void;
  onError?: (error: Error) => void;
}

export interface UploadOptions {
  files: File[];
  config?: Partial<UploadConfig>;
  priority?: UploadPriority;
  tags?: string[];
  metadata?: Record<string, any>;
  onStart?: (files: UploadFile[]) => void;
  onProgress?: (file: UploadFile) => void;
  onComplete?: (file: UploadFile) => void;
  onError?: (file: UploadFile, error: UploadError) => void;
  onQueueComplete?: (queue: UploadQueue) => void;
  onSessionComplete?: (session: UploadSession) => void;
}

export interface DragDropConfig {
  enabled: boolean;
  multiple: boolean;
  accept: string;
  maxSize: number;
  maxFiles: number;
  disabled: boolean;
  className?: string;
  dragActiveClassName?: string;
  dragRejectClassName?: string;
  noClickClassName?: string;
  noDragClassName?: string;
  noDragEventsClassName?: string;
  inputProps?: Record<string, any>;
  preventDropOnInvalid: boolean;
}

export interface PreviewConfig {
  enabled: boolean;
  maxWidth: number;
  maxHeight: number;
  generateThumbnails: boolean;
  thumbnailSizes: ThumbnailSize[];
  showFileInfo: boolean;
  showMetadata: boolean;
  enableZoom: boolean;
  enableRotation: boolean;
  enableFullscreen: boolean;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: FileMetadata;
}

export interface ValidationError {
  type: ValidationType;
  message: string;
  field?: string;
  value?: any;
  rule?: ValidationRule;
}

export interface ValidationWarning {
  type: ValidationType;
  message: string;
  field?: string;
  value?: any;
  rule?: ValidationRule;
}

export interface CloudStorageConfig {
  provider: StorageProvider['type'];
  region?: string;
  bucket?: string;
  endpoint?: string;
  credentials?: {
    accessKey?: string;
    secretKey?: string;
    token?: string;
    apiKey?: string;
    [key: string]: any;
  };
  encryption?: {
    enabled: boolean;
    algorithm: string;
    key?: string;
  };
  compression?: {
    enabled: boolean;
    algorithm: string;
    level: number;
  };
  cdn?: {
    enabled: boolean;
    domain?: string;
    path?: string;
  };
  cors?: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: Record<string, string>;
  };
}

export interface ResumableUploadConfig {
  enabled: boolean;
  chunkSize: number;
  maxChunkSize: number;
  minChunkSize: number;
  testChunks: boolean;
  parallelUploads: number;
  maxRetries: number;
  retryDelay: number;
  storageMethod: 's3' | 'gcs' | 'azure' | 'custom';
}

export interface SecurityConfig {
  enableVirusScanning: boolean;
  enableContentValidation: boolean;
  enableChecksumValidation: boolean;
  enableMetadataExtraction: boolean;
  enableEncryption: boolean;
  enableAccessControl: boolean;
  allowedOrigins: string[];
  blockedOrigins: string[];
  maxUploadSize: number;
  maxFileAge: number;
  requireAuthentication: boolean;
  enableAuditLogging: boolean;
}

export interface PerformanceConfig {
  enableCompression: boolean;
  compressionLevel: number;
  enableChunking: boolean;
  chunkSize: number;
  maxConcurrentUploads: number;
  enableThrottling: boolean;
  throttleRate: number;
  enableCaching: boolean;
  cacheSize: number;
  enableOptimization: boolean;
}

export interface MobileConfig {
  enableBackgroundUpload: boolean;
  enableAutoRetry: boolean;
  enableOfflineSupport: boolean;
  enableNotification: boolean;
  enableBatteryOptimization: boolean;
  enableWiFiOnly: boolean;
  enableLowPowerMode: boolean;
  maxConcurrentUploads: number;
  chunkSize: number;
  enableProgressiveUpload: boolean;
}

export interface AccessibilityConfig {
  enableScreenReader: boolean;
  enableKeyboardNavigation: boolean;
  enableHighContrast: boolean;
  enableReducedMotion: boolean;
  enableVoiceControl: boolean;
  ariaLabels: Record<string, string>;
  descriptions: Record<string, string>;
  announcements: Record<string, string>;
}

export interface UploadManagerConfig {
  upload: UploadConfig;
  dragDrop: DragDropConfig;
  preview: PreviewConfig;
  cloudStorage: CloudStorageConfig;
  resumable: ResumableUploadConfig;
  security: SecurityConfig;
  performance: PerformanceConfig;
  mobile: MobileConfig;
  accessibility: AccessibilityConfig;
}

// Hook types
export interface UseFileUploadReturn {
  files: UploadFile[];
  progress: number;
  isUploading: boolean;
  isPaused: boolean;
  error: Error | null;
  upload: (options: UploadOptions) => Promise<UploadFile[]>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  retry: (fileId?: string) => void;
  remove: (fileId: string) => void;
  clear: () => void;
  retryAll: () => void;
  pauseAll: () => void;
  resumeAll: () void;
  cancelAll: () => void;
  getStats: () => UploadStats;
}

export interface UseUploadQueueReturn {
  queues: UploadQueue[];
  activeQueue: UploadQueue | null;
  progress: number;
  isRunning: boolean;
  isPaused: boolean;
  error: Error | null;
  createQueue: (files: File[], options?: Partial<QueueSettings>) => string;
  addToQueue: (queueId: string, files: File[]) => void;
  removeFromQueue: (queueId: string, fileId: string) => void;
  startQueue: (queueId: string) => void;
  pauseQueue: (queueId: string) => void;
  resumeQueue: (queueId: string) => void;
  cancelQueue: (queueId: string) => void;
  deleteQueue: (queueId: string) => void;
  getQueue: (queueId: string) => UploadQueue | null;
  getQueues: () => UploadQueue[];
}

// Utility types
export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  blockedTypes?: string[];
  maxFiles?: number;
  enableVirusScanning?: boolean;
  enableContentValidation?: boolean;
  customValidation?: (file: File) => Promise<FileValidationResult>;
}

export interface FileProcessingOptions {
  generateThumbnails?: boolean;
  extractMetadata?: boolean;
  compressImages?: boolean;
  resizeImages?: boolean;
  watermarkImages?: boolean;
  convertFormats?: string[];
  quality?: number;
}

export interface CloudStorageResult {
  url: string;
  key: string;
  etag?: string;
  metadata?: Record<string, any>;
  location?: string;
}

export interface UploadResult {
  success: boolean;
  file?: UploadFile;
  files?: UploadFile[];
  error?: Error;
  errors?: UploadError[];
  warnings?: ValidationWarning[];
  metadata?: Record<string, any>;
}

// Event emitter types
export interface UploadEventEmitter {
  on(event: UploadEventType, listener: (data: any) => void): void;
  off(event: UploadEventType, listener: (data: any) => void): void;
  emit(event: UploadEventType, data: any): void;
  removeAllListeners(): void;
}

// Configuration presets
export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 10,
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-rar-compressed',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
  ],
  blockedTypes: [
    'application/x-executable',
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-msi',
    'application/x-disk-copy',
    'application/vnd.android.package-archive',
  ],
  chunkSize: 1024 * 1024, // 1MB
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000, // 30 seconds
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
    sizes: [
      { name: 'small', width: 150, height: 150, quality: 60 },
      { name: 'medium', width: 300, height: 300, quality: 75 },
      { name: 'large', width: 800, height: 600, quality: 85 },
    ],
  },
};

export const DEFAULT_DRAG_DROP_CONFIG: DragDropConfig = {
  enabled: true,
  multiple: true,
  accept: '*/*',
  maxSize: DEFAULT_UPLOAD_CONFIG.maxFileSize,
  maxFiles: DEFAULT_UPLOAD_CONFIG.maxFiles,
  disabled: false,
  preventDropOnInvalid: true,
};

export const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  enabled: true,
  maxWidth: 800,
  maxHeight: 600,
  generateThumbnails: true,
  thumbnailSizes: DEFAULT_UPLOAD_CONFIG.thumbnailConfig.sizes,
  showFileInfo: true,
  showMetadata: true,
  enableZoom: true,
  enableRotation: false,
  enableFullscreen: false,
};

export const DEFAULT_CLOUD_STORAGE_CONFIG: CloudStorageConfig = {
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

export const DEFAULT_RESUMABLE_CONFIG: ResumableConfig = {
  enabled: true,
  chunkSize: DEFAULT_UPLOAD_CONFIG.chunkSize,
  maxChunkSize: 100 * 1024 * 1024, // 100MB
  minChunkSize: 100 * 1024, // 100KB
  testChunks: true,
  parallelUploads: 3,
  maxRetries: 3,
  retryDelay: 1000,
  storageMethod: 's3',
};

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enableVirusScanning: false,
  enableContentValidation: true,
  enableChecksumValidation: true,
  enableMetadataExtraction: true,
  enableEncryption: false,
  enableAccessControl: false,
  allowedOrigins: ['*'],
  blockedOrigins: [],
  maxUploadSize: DEFAULT_UPLOAD_CONFIG.maxFileSize,
  maxFileAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  requireAuthentication: false,
  enableAuditLogging: true,
};

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableCompression: false,
  compressionLevel: 6,
  enableChunking: DEFAULT_UPLOAD_CONFIG.enableChunked,
  chunkSize: DEFAULT_UPLOAD_CONFIG.chunkSize,
  maxConcurrentUploads: 3,
  enableThrottling: false,
  throttleRate: 5,
  enableCaching: true,
  cacheSize: 100 * 1024 * 1024, // 100MB
  enableOptimization: true,
};

export const DEFAULT_MOBILE_CONFIG: MobileConfig = {
  enableBackgroundUpload: true,
  enableAutoRetry: true,
  enableOfflineSupport: false,
  enableNotification: true,
  enableBatteryOptimization: true,
  enableWiFiOnly: false,
  enableLowPowerMode: true,
  maxConcurrentUploads: 2,
  chunkSize: 512 * 1024, // 512KB
  enableProgressiveUpload: true,
};

export const DEFAULT_ACCESSIBILITY_CONFIG: AccessibilityConfig = {
  enableScreenReader: true,
  enableKeyboardNavigation: true,
  enableHighContrast: false,
  enableReducedMotion: false,
  enableVoiceControl: false,
  ariaLabels: {},
  descriptions: {},
  announcements: {},
};

export const DEFAULT_UPLOAD_MANAGER_CONFIG: UploadManagerConfig = {
  upload: DEFAULT_UPLOAD_CONFIG,
  dragDrop: DEFAULT_DRAG_DROP_CONFIG,
  preview: DEFAULT_PREVIEW_CONFIG,
  cloudStorage: DEFAULT_CLOUD_STORAGE_CONFIG,
  resumable: DEFAULT_RESUMABLE_CONFIG,
  security: DEFAULT_SECURITY_CONFIG,
  performance: DEFAULT_PERFORMANCE_CONFIG,
  mobile: DEFAULT_MOBILE_CONFIG,
  accessibility: DEFAULT_ACCESSIBILITY_CONFIG,
};
