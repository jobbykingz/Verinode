import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
  FileMetadata,
  FileDimensions,
  ThumbnailConfig,
  FileProcessingOptions,
  Geolocation,
  CameraInfo,
  DeviceInfo,
} from '../../types/fileUpload';

export interface ProcessingResult {
  success: boolean;
  originalPath: string;
  processedPath?: string;
  thumbnailPath?: string;
  metadata?: FileMetadata;
  error?: string;
  warnings?: string[];
}

export interface ImageProcessingOptions {
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  crop?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  rotate?: number;
  flip?: boolean;
  flop?: boolean;
  grayscale?: boolean;
  blur?: number;
  sharpen?: boolean;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'gif';
  watermark?: {
    text?: string;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity?: number;
    size?: number;
    color?: string;
  };
}

export interface VideoProcessingOptions {
  thumbnail?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png';
    time?: number; // Extract thumbnail at specific time
  };
  metadata?: boolean;
  extractFrames?: {
    count?: number;
    interval?: number;
    format?: 'jpeg' | 'png';
  };
  compress?: boolean;
  quality?: number;
}

export interface AudioProcessingOptions {
  metadata?: boolean;
  normalize?: boolean;
  trim?: boolean;
  fade?: {
    in?: number;
    out?: number;
  };
  volume?: number;
  format?: 'mp3' | 'wav' | 'ogg' | 'aac';
  quality?: number;
}

export interface DocumentProcessingOptions {
  text?: boolean;
  metadata?: boolean;
  images?: boolean;
  compress?: boolean;
  password?: string;
  watermark?: {
    text?: string;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity?: number;
    size?: number;
    color?: string;
  };
}

export class FileProcessor extends EventEmitter {
  private uploadDir: string;
  private processedDir: string;
  private thumbnailsDir: string;
  private tempDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.processedDir = path.join(process.cwd(), 'processed');
    this.thumbnailsDir = path.join(process.cwd(), 'thumbnails');
    this.tempDir = path.join(process.cwd(), 'temp');
    
    this.initializeDirectories();
  }

  /**
   * Initialize processing directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.processedDir, { recursive: true });
      await fs.mkdir(this.thumbnailsDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log('File processor directories initialized');
    } catch (error) {
      console.error('Failed to initialize directories:', error);
      throw error;
    }
  }

  /**
   * Process image file
   */
  async processImage(
    filePath: string,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const originalPath = filePath;
    const fileExtension = path.extname(filePath);
    const baseName = path.basename(filePath, fileExtension);
    const processedPath = path.join(this.processedDir, `${baseName}_processed${options.format || '.jpeg'}`);
    
    try {
      let image = sharp(filePath);
      
      // Apply transformations
      if (options.resize) {
        const { width, height, fit = 'cover' } = options.resize;
        image = image.resize(width, height, { fit });
      }
      
      if (options.crop) {
        const { left, top, width, height } = options.crop;
        image = image.extract({ left, top, width, height });
      }
      
      if (options.rotate) {
        image = image.rotate(options.rotate);
      }
      
      if (options.flip) {
        image = image.flop();
      }
      
      if (options.flop) {
        image = image.flip();
      }
      
      if (options.grayscale) {
        image = image.greyscale();
      }
      
      if (options.blur) {
        image = image.blur(options.blur);
      }
      
      if (options.sharpen) {
        image = image.sharpen();
      }
      
      if (options.watermark) {
        image = await this.addWatermark(image, options.watermark);
      }
      
      // Save processed image
      const info = await image.metadata();
      await image.toFile(processedPath, {
        quality: options.quality || 80,
        format: options.format || 'jpeg',
      });
      
      // Extract metadata
      const metadata = await this.extractImageMetadata(filePath);
      
      // Generate thumbnail
      let thumbnailPath: string | undefined;
      if (options.resize) {
        thumbnailPath = await this.generateImageThumbnail(processedPath, {
          maxWidth: 200,
          maxHeight: 200,
          quality: 60,
          format: 'jpeg',
        });
      }
      
      this.emit('imageProcessed', {
        originalPath,
        processedPath,
        thumbnailPath,
        metadata,
        options,
      });
      
      return {
        success: true,
        originalPath,
        processedPath,
        thumbnailPath,
        metadata,
      };
    } catch (error) {
      console.error('Failed to process image:', error);
      return {
        success: false,
        originalPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process video file
   */
  async processVideo(
    filePath: string,
    options: VideoProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const originalPath = filePath;
    const fileExtension = path.extname(filePath);
    const baseName = path.basename(filePath, fileExtension);
    const processedPath = path.join(this.processedDir, `${baseName}_processed.mp4`);
    
    try {
      // For video processing, we would use ffmpeg or similar
      // For now, we'll just copy the file and extract metadata
      await fs.copyFile(filePath, processedPath);
      
      // Extract metadata
      const metadata = await this.extractVideoMetadata(filePath);
      
      // Generate thumbnail
      let thumbnailPath: string | undefined;
      if (options.thumbnail) {
        thumbnailPath = await this.generateVideoThumbnail(filePath, options.thumbnail);
      }
      
      this.emit('videoProcessed', {
        originalPath,
        processedPath,
        thumbnailPath,
        metadata,
        options,
      });
      
      return {
        success: true,
        originalPath,
        processedPath,
        thumbnailPath,
        metadata,
      };
    } catch (error) {
      console.error('Failed to process video:', error);
      return {
        success: false,
        originalPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process audio file
   */
  async processAudio(
    filePath: string,
    options: AudioProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const originalPath = filePath;
    const fileExtension = path.extname(filePath);
    const baseName = path.basename(filePath, fileExtension);
    const processedPath = path.join(this.processedDir, `${baseName}_processed.mp3`);
    
    try {
      // For audio processing, we would use ffmpeg or similar
      // For now, we'll just copy the file and extract metadata
      await fs.copyFile(filePath, processedPath);
      
      // Extract metadata
      const metadata = await this.extractAudioMetadata(filePath);
      
      this.emit('audioProcessed', {
        originalPath,
        processedPath,
        metadata,
        options,
      });
      
      return {
        success: true,
        originalPath,
        processedPath,
        metadata,
      };
    } catch (error) {
      console.error('Failed to process audio:', error);
      return {
        success: false,
        originalPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process document file
   */
  async processDocument(
    filePath: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const originalPath = filePath;
    const fileExtension = path.extname(filePath);
    const baseName = path.basename(filePath, fileExtension);
    const processedPath = path.join(this.processedDir, `${baseName}_processed${fileExtension}`);
    
    try {
      // For document processing, we would use appropriate libraries
      // For now, we'll just copy the file
      await fs.copyFile(filePath, processedPath);
      
      // Extract metadata
      const metadata = await this.extractDocumentMetadata(filePath);
      
      this.emit('documentProcessed', {
        originalPath,
        processedPath,
        metadata,
        options,
      });
      
      return {
        success: true,
        originalPath,
        processedPath,
        metadata,
      };
    } catch (error) {
      console.error('Failed to process document:', error);
      return {
        success: false,
        originalPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate image thumbnail
   */
  async generateImageThumbnail(
    filePath: string,
    config: ThumbnailConfig
  ): Promise<string> {
    const fileExtension = path.extname(filePath);
    const baseName = path.basename(filePath, fileExtension);
    const thumbnailPath = path.join(this.thumbnailsDir, `${baseName}_thumb.${config.format}`);
    
    try {
      await sharp(filePath)
        .resize(config.maxWidth, config.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toFile(thumbnailPath, {
          quality: config.quality,
          format: config.format as any,
        });
      
      return thumbnailPath;
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      throw error;
    }
  }

  /**
   * Generate video thumbnail
   */
  async generateVideoThumbnail(
    filePath: string,
    config: {
      width?: number;
      height?: number;
      quality?: number;
      format?: string;
      time?: number;
    } = {}
  ): Promise<string> {
    const fileExtension = path.extname(filePath);
    const baseName = path.basename(filePath, fileExtension);
    const thumbnailPath = path.join(this.thumbnailsDir, `${baseName}_thumb.${config.format || 'jpeg'}`);
    
    try {
      // For video thumbnails, we would use ffmpeg
      // For now, create a placeholder
      const placeholderPath = path.join(this.thumbnailsDir, `${baseName}_thumb.jpeg`);
      await fs.writeFile(placeholderPath, Buffer.from(''));
      
      return placeholderPath;
    } catch (error) {
      console.error('Failed to generate video thumbnail:', error);
      throw error;
    }
  }

  /**
   * Extract image metadata
   */
  async extractImageMetadata(filePath: string): Promise<FileMetadata> {
    try {
      const metadata = await sharp(filePath).metadata();
      
      const imageMetadata: FileMetadata = {
        dimensions: {
          width: metadata.width || 0,
          height: metadata.height || 0,
          aspectRatio: (metadata.width || 0) / (metadata.height || 1),
        },
        // Extract EXIF data if available
        // This would require a library like exif-js
      };
      
      return imageMetadata;
    } catch (error) {
      console.error('Failed to extract image metadata:', error);
      return {};
    }
  }

  /**
   * Extract video metadata
   */
  async extractVideoMetadata(filePath: string): Promise<FileMetadata> {
    try {
      // For video metadata, we would use ffprobe or similar
      // For now, return basic metadata
      const stats = await fs.stat(filePath);
      
      return {
        duration: 0, // Would be extracted from video
        bitrate: 0, // Would be extracted from video
        dimensions: {
          width: 0,
          height: 0,
          aspectRatio: 1,
        },
      };
    } catch (error) {
      console.error('Failed to extract video metadata:', error);
      return {};
    }
  }

  /**
   * Extract audio metadata
   */
  async extractAudioMetadata(filePath: string): Promise<FileMetadata> {
    try {
      // For audio metadata, we would use music-metadata or similar
      // For now, return basic metadata
      const stats = await fs.stat(filePath);
      
      return {
        duration: 0, // Would be extracted from audio
        bitrate: 128, // Default bitrate
        dimensions: {
          width: 0,
          height: 0,
          aspectRatio: 1,
        },
      };
    } catch (error) {
      console.error('Failed to extract audio metadata:', error);
      return {};
    }
  }

  /**
   * Extract document metadata
   */
  async extractDocumentMetadata(filePath: string): Promise<FileMetadata> {
    try {
      // For document metadata, we would use appropriate libraries
      // For PDF: pdf-parse, for documents: mammoth, etc.
      // For now, return basic metadata
      const stats = await fs.stat(filePath);
      
      return {
        dimensions: {
          width: 0,
          height: 0,
          aspectRatio: 1,
        },
      };
    } catch (error) {
      console.error('Failed to extract document metadata:', error);
      return {};
    }
  }

  /**
   * Add watermark to image
   */
  private async addWatermark(
    image: sharp.Sharp,
    watermarkConfig: {
      text?: string;
      position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      opacity?: number;
      size?: number;
      color?: string;
    }
  ): Promise<sharp.Sharp> {
    if (!watermarkConfig.text) return image;
    
    const {
      text = 'Watermark',
      position = 'center',
      opacity = 0.5,
      size = 48,
      color = 'rgba(255, 255, 255, 0.5)',
    } = watermarkConfig;
    
    // Create watermark SVG
    const watermarkSvg = `
      <svg width="${size}" height="${size}">
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" 
              font-family="Arial" font-size="${size}" fill="${color}" opacity="${opacity}">
          ${text}
        </text>
      </svg>
    `;
    
    // Get image dimensions
    const metadata = await image.metadata();
    const { width, height } = metadata;
    
    // Calculate watermark position
    let x = 0;
    let y = 0;
    
    switch (position) {
      case 'center':
        x = (width - size) / 2;
        y = (height - size) / 2;
        break;
      case 'top-left':
        x = 20;
        y = 20;
        break;
      case 'top-right':
        x = width - size - 20;
        y = 20;
        break;
      case 'bottom-left':
        x = 20;
        y = height - size - 20;
        break;
      case 'bottom-right':
        x = width - size - 20;
        y = height - size - 20;
        break;
    }
    
    // Composite watermark
    return image.composite([
      {
        input: Buffer.from(watermarkSvg),
        left: x,
        top: y,
      },
    ]);
  }

  /**
   * Batch process files
   */
  async batchProcessFiles(
    files: Array<{
      filePath: string;
      type: 'image' | 'video' | 'audio' | 'document';
      options?: any;
    }>
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    for (const file of files) {
      let result: ProcessingResult;
      
      switch (file.type) {
        case 'image':
          result = await this.processImage(file.filePath, file.options);
          break;
        case 'video':
          result = await this.processVideo(file.filePath, file.options);
          break;
        case 'audio':
          result = await this.processAudio(file.filePath, file.options);
          break;
        case 'document':
          result = await this.processDocument(file.filePath, file.options);
          break;
        default:
          result = {
            success: false,
            originalPath: file.filePath,
            error: 'Unsupported file type',
          };
      }
      
      results.push(result);
    }
    
    return results;
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        // Delete files older than 1 hour
        if (Date.now() - stats.mtime.getTime() > 60 * 60 * 1000) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      processedDir: this.processedDir,
      thumbnailsDir: this.thumbnailsDir,
      tempDir: this.tempDir,
    };
  }
}

// Export singleton instance
let fileProcessor: FileProcessor | null = null;

export const getFileProcessor = (): FileProcessor => {
  if (!fileProcessor) {
    fileProcessor = new FileProcessor();
  }
  return fileProcessor;
};

// Export utility functions
export const processImageFile = async (
  filePath: string,
  options?: ImageProcessingOptions
): Promise<ProcessingResult> => {
  const processor = getFileProcessor();
  return processor.processImage(filePath, options);
};

export const processVideoFile = async (
  filePath: string,
  options?: VideoProcessingOptions
): Promise<ProcessingResult> => {
  const processor = getFileProcessor();
  return processor.processVideo(filePath, options);
};

export const processAudioFile = async (
  filePath: string,
  options?: AudioProcessingOptions
): Promise<ProcessingResult> => {
  const processor = getFileProcessor();
  return processor.processAudio(filePath, options);
};

export const processDocumentFile = async (
  filePath: string,
  options?: DocumentProcessingOptions
): Promise<ProcessingResult> => {
  const processor = getFileProcessor();
  return processor.processDocument(filePath, options);
};

export const createFileProcessor = (): FileProcessor => {
  return new FileProcessor();
};
