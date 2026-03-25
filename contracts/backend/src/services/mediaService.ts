import { Request, Response } from 'express';
import crypto from 'crypto';
import MediaProof, { IMediaProof } from '../models/MediaProof';
import { VideoCompressionService } from './videoCompression';
import { VoiceBiometricsService } from './voiceBiometrics';
import { MediaAuthenticityService } from './mediaAuthenticity';

export interface UploadResult {
  success: boolean;
  proofId?: string;
  url?: string;
  error?: string;
  metadata?: {
    size: number;
    duration: number;
    resolution?: { width: number; height: number };
  };
}

export interface VerificationResult {
  success: boolean;
  verified: boolean;
  confidence: number;
  details: {
    authenticityCheck: boolean;
    tamperingDetected: boolean;
    watermarkValid: boolean;
    metadataIntact: boolean;
  };
}

export class MediaService {
  private videoCompression: VideoCompressionService;
  private voiceBiometrics: VoiceBiometricsService;
  private authenticityService: MediaAuthenticityService;

  constructor() {
    this.videoCompression = new VideoCompressionService();
    this.voiceBiometrics = new VoiceBiometricsService();
    this.authenticityService = new MediaAuthenticityService();
  }

  /**
   * Upload and process media proof
   */
  async uploadMediaProof(
    file: Express.Multer.File,
    ownerId: string,
    type: 'VIDEO' | 'AUDIO' | 'STREAM',
    options: {
      compress?: boolean;
      watermark?: boolean;
      watermarkContent?: string;
      isPublic?: boolean;
    } = {}
  ): Promise<UploadResult> {
    try {
      const proofId = this.generateProofId();
      
      // Generate file hash for authenticity
      const fileHash = await this.generateFileHash(file.path);
      const signature = this.signHash(fileHash);

      // Extract metadata
      const metadata = await this.extractMetadata(file, type);

      // Create storage paths
      const storagePath = this.generateStoragePath(proofId, file.originalname);
      const originalUrl = await this.storeFile(file.path, storagePath);

      // Create media proof document
      const mediaProof = new MediaProof({
        proofId,
        type,
        ownerId,
        status: 'PROCESSING',
        mediaMetadata: {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          duration: metadata.duration,
          resolution: metadata.resolution,
          bitrate: metadata.bitrate,
          codec: metadata.codec,
          frameRate: metadata.frameRate
        },
        storage: {
          originalUrl,
          storageProvider: 'LOCAL',
          path: storagePath
        },
        compression: {
          enabled: options.compress !== false,
          algorithm: 'H264',
          originalSize: file.size,
          quality: 0.8
        },
        authenticity: {
          hash: fileHash,
          signature,
          timestamp: new Date(),
          verified: false,
          tamperingDetected: false,
          metadataIntact: true
        },
        accessControl: {
          isPublic: options.isPublic || false,
          allowedUsers: [ownerId],
          downloadAllowed: false,
          currentViews: 0
        }
      });

      await mediaProof.save();

      // Process asynchronously
      this.processMediaProof(mediaProof, file, options).catch(console.error);

      return {
        success: true,
        proofId,
        url: originalUrl,
        metadata: {
          size: file.size,
          duration: metadata.duration,
          resolution: metadata.resolution
        }
      };
    } catch (error) {
      console.error('Media upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Process media proof (compression, watermarking, etc.)
   */
  private async processMediaProof(
    mediaProof: IMediaProof,
    file: Express.Multer.File,
    options: {
      compress?: boolean;
      watermark?: boolean;
      watermarkContent?: string;
    }
  ): Promise<void> {
    try {
      // Apply compression if enabled
      if (options.compress !== false && mediaProof.type === 'VIDEO') {
        const compressedResult = await this.videoCompression.compressVideo(
          file.path,
          {
            quality: 0.8,
            targetResolution: mediaProof.mediaMetadata.resolution,
            codec: 'H264'
          }
        );

        if (compressedResult.success) {
          mediaProof.storage.compressedUrl = compressedResult.outputPath;
          mediaProof.compression.compressedSize = compressedResult.size;
          mediaProof.compression.compressionRatio = 
            mediaProof.compression.originalSize / compressedResult.size;
        }
      }

      // Apply watermark if enabled
      if (options.watermark && options.watermarkContent) {
        await this.applyWatermark(mediaProof, options.watermarkContent);
      }

      // Verify authenticity
      const authenticityResult = await this.authenticityService.verifyAuthenticity(
        mediaProof.authenticity.hash,
        mediaProof.authenticity.signature
      );

      mediaProof.authenticity.verified = authenticityResult.valid;
      mediaProof.authenticity.tamperingDetected = authenticityResult.tamperingDetected;
      mediaProof.status = 'VERIFIED';
      mediaProof.processedAt = new Date();

      await mediaProof.save();
    } catch (error) {
      console.error('Media processing error:', error);
      mediaProof.status = 'FAILED';
      await mediaProof.save();
    }
  }

  /**
   * Verify media proof authenticity
   */
  async verifyMediaProof(proofId: string): Promise<VerificationResult> {
    try {
      const mediaProof = await MediaProof.findOne({ proofId });
      
      if (!mediaProof) {
        return {
          success: false,
          verified: false,
          confidence: 0,
          details: {
            authenticityCheck: false,
            tamperingDetected: true,
            watermarkValid: false,
            metadataIntact: false
          }
        };
      }

      // Verify file hash
      const authenticityResult = await this.authenticityService.verifyAuthenticity(
        mediaProof.authenticity.hash,
        mediaProof.authenticity.signature
      );

      // Verify watermark if present
      let watermarkValid = true;
      if (mediaProof.watermark?.enabled) {
        watermarkValid = await this.authenticityService.verifyWatermark(
          mediaProof.storage.originalUrl,
          mediaProof.watermark.content
        );
      }

      const confidence = this.calculateConfidenceScore(
        authenticityResult.valid,
        !authenticityResult.tamperingDetected,
        watermarkValid,
        mediaProof.authenticity.metadataIntact
      );

      return {
        success: true,
        verified: authenticityResult.valid && !authenticityResult.tamperingDetected,
        confidence,
        details: {
          authenticityCheck: authenticityResult.valid,
          tamperingDetected: authenticityResult.tamperingDetected,
          watermarkValid,
          metadataIntact: mediaProof.authenticity.metadataIntact
        }
      };
    } catch (error) {
      console.error('Media verification error:', error);
      return {
        success: false,
        verified: false,
        confidence: 0,
        details: {
          authenticityCheck: false,
          tamperingDetected: true,
          watermarkValid: false,
          metadataIntact: false
        }
      };
    }
  }

  /**
   * Get media proof by ID
   */
  async getMediaProof(proofId: string, requesterId: string): Promise<IMediaProof | null> {
    const mediaProof = await MediaProof.findOne({ proofId });
    
    if (!mediaProof) return null;
    
    // Check access permissions
    if (!this.hasAccess(mediaProof, requesterId)) {
      return null;
    }

    // Increment view count
    mediaProof.accessControl.currentViews++;
    await mediaProof.save();

    return mediaProof;
  }

  /**
   * Get all media proofs for a user
   */
  async getUserMediaProofs(userId: string): Promise<IMediaProof[]> {
    return MediaProof.find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .select('-authenticity.signature');
  }

  /**
   * Delete media proof
   */
  async deleteMediaProof(proofId: string, ownerId: string): Promise<boolean> {
    const mediaProof = await MediaProof.findOne({ proofId, ownerId });
    
    if (!mediaProof) return false;

    // Delete files from storage
    await this.deleteFile(mediaProof.storage.path);
    if (mediaProof.storage.compressedUrl) {
      await this.deleteFile(mediaProof.storage.compressedUrl);
    }

    await MediaProof.deleteOne({ proofId });
    return true;
  }

  /**
   * Update access control settings
   */
  async updateAccessControl(
    proofId: string,
    ownerId: string,
    settings: {
      isPublic?: boolean;
      allowedUsers?: string[];
      downloadAllowed?: boolean;
      expiresAt?: Date;
    }
  ): Promise<boolean> {
    const result = await MediaProof.updateOne(
      { proofId, ownerId },
      { $set: { accessControl: settings } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Generate unique proof ID
   */
  private generateProofId(): string {
    return `media_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`;
  }

  /**
   * Generate file hash
   */
  private async generateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = require('fs').createReadStream(filePath);
      
      stream.on('error', reject);
      stream.on('data', (chunk: Buffer) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  /**
   * Sign hash with private key
   */
  private signHash(hash: string): string {
    const privateKey = process.env.MEDIA_SIGNING_KEY || 'default-key';
    return crypto
      .createHmac('sha256', privateKey)
      .update(hash)
      .digest('hex');
  }

  /**
   * Extract media metadata
   */
  private async extractMetadata(
    file: Express.Multer.File,
    type: 'VIDEO' | 'AUDIO' | 'STREAM'
  ): Promise<{
    duration: number;
    resolution?: { width: number; height: number };
    bitrate?: number;
    codec?: string;
    frameRate?: number;
  }> {
    // Placeholder for actual metadata extraction
    // In production, use ffprobe or similar
    return {
      duration: 0,
      resolution: type === 'VIDEO' ? { width: 1920, height: 1080 } : undefined,
      bitrate: 5000000,
      codec: type === 'VIDEO' ? 'H264' : 'AAC',
      frameRate: type === 'VIDEO' ? 30 : undefined
    };
  }

  /**
   * Store file and return URL
   */
  private async storeFile(sourcePath: string, destinationPath: string): Promise<string> {
    // Placeholder for actual storage implementation
    // In production, upload to S3, IPFS, etc.
    return `/media/${destinationPath}`;
  }

  /**
   * Delete file from storage
   */
  private async deleteFile(filePath: string): Promise<void> {
    // Placeholder for actual deletion implementation
    const fs = require('fs').promises;
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('File deletion error:', error);
    }
  }

  /**
   * Apply watermark to media
   */
  private async applyWatermark(
    mediaProof: IMediaProof,
    content: string
  ): Promise<void> {
    // Placeholder for actual watermarking implementation
    mediaProof.watermark = {
      enabled: true,
      type: 'INVISIBLE',
      content,
      position: { x: 10, y: 10 },
      opacity: 0.5,
      appliedAt: new Date()
    };
  }

  /**
   * Check if user has access to media
   */
  private hasAccess(mediaProof: IMediaProof, userId: string): boolean {
    if (mediaProof.accessControl.isPublic) return true;
    if (mediaProof.ownerId === userId) return true;
    if (mediaProof.accessControl.allowedUsers.includes(userId)) return true;
    
    // Check expiration
    if (mediaProof.accessControl.expiresAt && 
        new Date() > mediaProof.accessControl.expiresAt) {
      return false;
    }

    // Check max views
    if (mediaProof.accessControl.maxViews && 
        mediaProof.accessControl.currentViews >= mediaProof.accessControl.maxViews) {
      return false;
    }

    return false;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(
    authentic: boolean,
    notTampered: boolean,
    watermarkValid: boolean,
    metadataIntact: boolean
  ): number {
    let score = 0;
    if (authentic) score += 0.4;
    if (notTampered) score += 0.3;
    if (watermarkValid) score += 0.2;
    if (metadataIntact) score += 0.1;
    return Math.round(score * 100) / 100;
  }

  /**
   * Generate storage path
   */
  private generateStoragePath(proofId: string, originalName: string): string {
    const ext = originalName.split('.').pop();
    return `${proofId}/${proofId}.${ext}`;
  }
}

export default new MediaService();
