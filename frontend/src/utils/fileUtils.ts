import {
  FileValidationResult,
  FileValidationOptions,
  FileProcessingOptions,
  FileMetadata,
  FileDimensions,
  Geolocation,
  CameraInfo,
  DeviceInfo,
  ThumbnailConfig,
  ValidationError,
  ValidationWarning,
} from '../types/fileUpload';

/**
 * Validate files against various criteria
 */
export const validateFiles = async (
  files: File[],
  options: FileValidationOptions = {}
): Promise<FileValidationResult[]> => {
  const results: FileValidationResult[] = [];
  
  for (const file of files) {
    const result: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };
    
    // File size validation
    if (options.maxSize && file.size > options.maxSize) {
      result.isValid = false;
      result.errors.push({
        type: 'fileSize',
        message: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(options.maxSize)})`,
        field: 'size',
        value: file.size,
      });
    }
    
    // File type validation
    if (options.allowedTypes && options.allowedTypes.length > 0) {
      const isAllowed = options.allowedTypes.some(type => {
        if (type.includes('*')) {
          const wildcard = type.replace('*', '');
          return file.type.startsWith(wildcard);
        }
        return file.type === type;
      });
      
      if (!isAllowed) {
        result.isValid = false;
        result.errors.push({
          type: 'fileType',
          message: `File type (${file.type}) is not allowed`,
          field: 'type',
          value: file.type,
        });
      }
    }
    
    // Blocked file types
    if (options.blockedTypes && options.blockedTypes.includes(file.type)) {
      result.isValid = false;
      result.errors.push({
        type: 'fileType',
        message: `File type (${file.type}) is blocked`,
        field: 'type',
        value: file.type,
      });
    }
    
    // File name validation
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(file.name)) {
      result.warnings.push({
        type: 'fileName',
        message: 'File name contains invalid characters',
        field: 'name',
        value: file.name,
      });
    }
    
    // File name length
    if (file.name.length > 255) {
      result.warnings.push({
        type: 'fileName',
        message: 'File name is too long (max 255 characters)',
        field: 'name',
        value: file.name,
      });
    }
    
    // Virus scanning
    if (options.enableVirusScanning) {
      try {
        const virusResult = await scanForVirus(file);
        if (!virusResult.clean) {
          result.isValid = false;
          result.errors.push({
            type: 'virus',
            message: `Virus detected: ${virusResult.threat}`,
            field: 'virus',
            value: virusResult.threat,
          });
        }
      } catch (error) {
        result.warnings.push({
          type: 'virus',
          message: 'Virus scan failed',
          field: 'virus',
          value: error,
        });
      }
    }
    
    // Content validation
    if (options.enableContentValidation) {
      try {
        const contentResult = await validateContent(file);
        if (!contentResult.valid) {
          result.isValid = false;
          result.errors.push(...contentResult.errors);
        }
        result.warnings.push(...contentResult.warnings);
      } catch (error) {
        result.warnings.push({
          type: 'content',
          message: 'Content validation failed',
          field: 'content',
          value: error,
        });
      }
    }
    
    // Custom validation
    if (options.customValidation) {
      try {
        const customResult = await options.customValidation(file);
        if (!customResult.isValid) {
          result.isValid = false;
          result.errors.push(...customResult.errors);
        }
        result.warnings.push(...customResult.warnings);
      } catch (error) {
        result.warnings.push({
          type: 'custom',
          message: 'Custom validation failed',
          field: 'custom',
          value: error,
        });
      }
    }
    
    results.push(result);
  }
  
  return results;
};

/**
 * Generate thumbnails for image files
 */
export const generateThumbnails = async (
  file: File,
  config: ThumbnailConfig
): Promise<string> => {
  if (!config.enabled || !file.type.startsWith('image/')) {
    return '';
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate dimensions
        let { width, height } = calculateDimensions(
          img.width,
          img.height,
          config.maxWidth,
          config.maxHeight
        );
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              resolve(url);
            } else {
              reject(new Error('Failed to generate thumbnail'));
            }
          },
          `image/${config.format}`,
          config.quality / 100
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
};

/**
 * Extract metadata from files
 */
export const extractMetadata = async (file: File): Promise<FileMetadata> => {
  const metadata: FileMetadata = {
    originalName: file.name,
    extension: file.name.split('.').pop() || '',
    mimeType: file.type,
    encoding: (file as any).encoding || 'utf-8',
  };
  
  // Extract image metadata
  if (file.type.startsWith('image/')) {
    try {
      const imageMetadata = await extractImageMetadata(file);
      Object.assign(metadata, imageMetadata);
    } catch (error) {
      console.warn('Failed to extract image metadata:', error);
    }
  }
  
  // Extract video metadata
  if (file.type.startsWith('video/')) {
    try {
      const videoMetadata = await extractVideoMetadata(file);
      Object.assign(metadata, videoMetadata);
    } catch (error) {
      console.warn('Failed to extract video metadata:', error);
    }
  }
  
  // Extract audio metadata
  if (file.type.startsWith('audio/')) {
    try {
      const audioMetadata = await extractAudioMetadata(file);
      Object.assign(metadata, audioMetadata);
    } catch (error) {
      console.warn('Failed to extract audio metadata:', error);
    }
  }
  
  // Extract document metadata
  if (file.type.includes('pdf') || file.type.includes('document')) {
    try {
      const documentMetadata = await extractDocumentMetadata(file);
      Object.assign(metadata, documentMetadata);
    } catch (error) {
      console.warn('Failed to extract document metadata:', error);
    }
  }
  
  // Generate checksum
  try {
    metadata.checksum = await generateChecksum(file);
  } catch (error) {
    console.warn('Failed to generate checksum:', error);
  }
  
  // Extract device info
  metadata.deviceInfo = getDeviceInfo();
  
  return metadata;
};

/**
 * Compress image files
 */
export const compressImage = async (
  file: File,
  options: {
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
    format?: string;
  } = {}
): Promise<File> => {
  const {
    quality = 0.8,
    maxWidth = 1920,
    maxHeight = 1080,
    format = 'image/jpeg',
  } = options;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate dimensions
        let { width, height } = calculateDimensions(
          img.width,
          img.height,
          maxWidth,
          maxHeight
        );
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw compressed image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: format,
                lastModified: file.lastModified,
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          format,
          quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file for compression'));
    };
    
    reader.readAsDataURL(file);
  });
};

/**
 * Convert file to base64
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert file to base64'));
    reader.readAsDataURL(file);
  });
};

/**
 * Convert base64 to file
 */
export const base64ToFile = (
  base64: string,
  filename: string,
  mimeType?: string
): File => {
  const byteString = atob(base64.split(',')[1]);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  
  const blob = new Blob([uint8Array], { type: mimeType || 'application/octet-stream' });
  return new File([blob], filename);
};

/**
 * Download file
 */
export const downloadFile = (file: File, filename?: string): void => {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get file icon based on MIME type
 */
export const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'videocam';
  if (mimeType.startsWith('audio/')) return 'music-note';
  if (mimeType.includes('pdf')) return 'picture-as-pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'grid-on';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'slideshow';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'folder-zip';
  if (mimeType.includes('text')) return 'text-fields';
  return 'insert-drive-file';
};

/**
 * Get file color based on MIME type
 */
export const getFileColor = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return '#4ECDC4';
  if (mimeType.startsWith('video/')) return '#FF6B6B';
  if (mimeType.startsWith('audio/')) return '#9B59B6';
  if (mimeType.includes('pdf')) return '#E91E63';
  if (mimeType.includes('word') || mimeType.includes('document')) return '#3498DB';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '#2ECC71';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '#F39C12';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '#95A5A6';
  if (mimeType.includes('text')) return '#7F8C8D';
  return '#34495E';
};

/**
 * Check if file type is supported for preview
 */
export const isPreviewSupported = (mimeType: string): boolean => {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    mimeType.includes('pdf') ||
    mimeType.includes('text')
  );
};

/**
 * Check if file type is supported for editing
 */
export const isEditable = (mimeType: string): boolean => {
  return (
    mimeType.includes('text') ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation')
  );
};

/**
 * Get file category
 */
export const getFileCategory = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf')) return 'documents';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'documents';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'documents';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'documents';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archives';
  if (mimeType.includes('text')) return 'documents';
  return 'other';
};

/**
 * Create file preview URL
 */
export const createPreviewUrl = (file: File): string => {
  return URL.createObjectURL(file);
};

/**
 * Revoke file preview URL
 */
export const revokePreviewUrl = (url: string): void => {
  URL.revokeObjectURL(url);
};

/**
 * Split file into chunks
 */
export const splitFileIntoChunks = (
  file: File,
  chunkSize: number
): ArrayBuffer[] => {
  const chunks: ArrayBuffer[] = [];
  const fileSize = file.size;
  
  for (let start = 0; start < fileSize; start += chunkSize) {
    const end = Math.min(start + chunkSize, fileSize);
    const chunk = file.slice(start, end);
    chunks.push(chunk);
  }
  
  return chunks;
};

/**
 * Calculate file dimensions maintaining aspect ratio
 */
const calculateDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  const aspectRatio = originalWidth / originalHeight;
  
  let width = originalWidth;
  let height = originalHeight;
  
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }
  
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  return { width, height };
};

/**
 * Extract image metadata
 */
const extractImageMetadata = async (file: File): Promise<Partial<FileMetadata>> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        dimensions: {
          width: img.width,
          height: img.height,
          aspectRatio: img.width / img.height,
        },
      });
    };
    
    // Try to extract EXIF data (would need a library like exif-js)
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Extract video metadata
 */
const extractVideoMetadata = async (file: File): Promise<Partial<FileMetadata>> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration * 1000, // Convert to milliseconds
        dimensions: {
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: video.videoWidth / video.videoHeight,
        },
      });
    };
    
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Extract audio metadata
 */
const extractAudioMetadata = async (file: File): Promise<Partial<FileMetadata>> => {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.onloadedmetadata = () => {
      resolve({
        duration: audio.duration * 1000, // Convert to milliseconds
        bitrate: 128, // Default bitrate
      });
    };
    
    audio.src = URL.createObjectURL(file);
  });
};

/**
 * Extract document metadata
 */
const extractDocumentMetadata = async (file: File): Promise<Partial<FileMetadata>> => {
  // This would require specific libraries for different document types
  // For now, return basic metadata
  return Promise.resolve({});
};

/**
 * Generate file checksum
 */
const generateChecksum = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

/**
 * Scan for viruses (mock implementation)
 */
const scanForVirus = async (file: File): Promise<{ clean: boolean; threat?: string }> => {
  // This would integrate with an actual virus scanning service
  // For now, simulate the scan
  await new Promise(resolve => setTimeout(resolve, 100));
  return { clean: true };
};

/**
 * Validate file content (mock implementation)
 */
const validateContent = async (file: File): Promise<{ valid: boolean; errors: ValidationError[]; warnings: ValidationWarning[] }> => {
  // This would implement actual content validation
  // For now, return valid result
  return { valid: true, errors: [], warnings: [] };
};

/**
 * Get device information
 */
const getDeviceInfo = (): DeviceInfo => {
  return {
    platform: navigator.platform,
    version: navigator.userAgent,
    model: 'Unknown',
    brand: 'Unknown',
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
};
