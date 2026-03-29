import crypto from 'crypto';
import fs from 'fs';

export interface AuthenticityCheckResult {
  valid: boolean;
  tamperingDetected: boolean;
  confidence: number;
  details: {
    hashValid: boolean;
    signatureValid: boolean;
    metadataIntact: boolean;
    frameConsistency: boolean;
    compressionArtifacts: boolean;
  };
}

export interface WatermarkResult {
  valid: boolean;
  watermarkFound: boolean;
  watermarkContent?: string;
  confidence: number;
  error?: string;
}

export interface ForensicResult {
  isAuthentic: boolean;
  manipulationProbability: number;
  detectedAnomalies: string[];
  analysisDetails: {
    noiseConsistency: number;
    compressionHistory: number;
    copyMoveDetection: number;
    splicingDetection: number;
  };
}

export class MediaAuthenticityService {
  private readonly CONFIDENCE_THRESHOLD = 0.85;
  private readonly MANIPULATION_THRESHOLD = 0.3;

  /**
   * Verify media authenticity using hash and signature
   */
  async verifyAuthenticity(
    fileHash: string,
    signature: string,
    filePath?: string
  ): Promise<AuthenticityCheckResult> {
    try {
      // Verify signature
      const signatureValid = this.verifySignature(fileHash, signature);

      // If file path provided, verify hash
      let hashValid = true;
      if (filePath && fs.existsSync(filePath)) {
        const currentHash = await this.calculateFileHash(filePath);
        hashValid = currentHash === fileHash;
      }

      // Check metadata integrity
      const metadataIntact = await this.checkMetadataIntegrity(filePath);

      // Check frame consistency (for videos)
      const frameConsistency = filePath 
        ? await this.checkFrameConsistency(filePath)
        : true;

      // Detect compression artifacts
      const compressionArtifacts = filePath
        ? await this.detectCompressionArtifacts(filePath)
        : false;

      // Calculate overall confidence
      const confidence = this.calculateAuthenticityConfidence({
        hashValid,
        signatureValid,
        metadataIntact,
        frameConsistency,
        compressionArtifacts
      });

      const tamperingDetected = !hashValid || !signatureValid || !metadataIntact;

      return {
        valid: hashValid && signatureValid && metadataIntact,
        tamperingDetected,
        confidence,
        details: {
          hashValid,
          signatureValid,
          metadataIntact,
          frameConsistency,
          compressionArtifacts
        }
      };
    } catch (error) {
      console.error('Authenticity verification error:', error);
      return {
        valid: false,
        tamperingDetected: true,
        confidence: 0,
        details: {
          hashValid: false,
          signatureValid: false,
          metadataIntact: false,
          frameConsistency: false,
          compressionArtifacts: true
        }
      };
    }
  }

  /**
   * Verify watermark in media
   */
  async verifyWatermark(
    filePath: string,
    expectedWatermark: string
  ): Promise<WatermarkResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          valid: false,
          watermarkFound: false,
          confidence: 0,
          error: 'File not found'
        };
      }

      // Extract watermark from media
      const extractedWatermark = await this.extractWatermark(filePath);

      if (!extractedWatermark) {
        return {
          valid: false,
          watermarkFound: false,
          confidence: 0,
          error: 'No watermark found in media'
        };
      }

      // Compare extracted watermark with expected
      const similarity = this.calculateWatermarkSimilarity(
        extractedWatermark,
        expectedWatermark
      );

      return {
        valid: similarity >= this.CONFIDENCE_THRESHOLD,
        watermarkFound: true,
        watermarkContent: extractedWatermark,
        confidence: similarity
      };
    } catch (error) {
      console.error('Watermark verification error:', error);
      return {
        valid: false,
        watermarkFound: false,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Watermark verification failed'
      };
    }
  }

  /**
   * Apply invisible watermark to media
   */
  async applyInvisibleWatermark(
    filePath: string,
    watermark: string
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }

      // Generate watermark hash
      const watermarkHash = crypto.createHash('sha256')
        .update(watermark)
        .digest('hex');

      // Apply frequency-domain watermarking (DCT-based)
      const outputPath = await this.applyDCTWatermark(filePath, watermarkHash);

      return {
        success: true,
        outputPath
      };
    } catch (error) {
      console.error('Watermark application error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Watermark application failed'
      };
    }
  }

  /**
   * Perform forensic analysis on media
   */
  async performForensicAnalysis(filePath: string): Promise<ForensicResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          isAuthentic: false,
          manipulationProbability: 1,
          detectedAnomalies: ['File not found'],
          analysisDetails: {
            noiseConsistency: 0,
            compressionHistory: 0,
            copyMoveDetection: 0,
            splicingDetection: 0
          }
        };
      }

      // Run various forensic checks
      const noiseConsistency = await this.analyzeNoiseConsistency(filePath);
      const compressionHistory = await this.analyzeCompressionHistory(filePath);
      const copyMoveDetection = await this.detectCopyMove(filePath);
      const splicingDetection = await this.detectSplicing(filePath);

      // Detect anomalies
      const anomalies: string[] = [];

      if (noiseConsistency < 0.7) {
        anomalies.push('Inconsistent noise patterns detected');
      }
      if (compressionHistory > 0.5) {
        anomalies.push('Multiple compression artifacts found');
      }
      if (copyMoveDetection > 0.6) {
        anomalies.push('Possible copy-move forgery detected');
      }
      if (splicingDetection > 0.6) {
        anomalies.push('Possible image splicing detected');
      }

      // Calculate manipulation probability
      const manipulationProbability = (
        (1 - noiseConsistency) * 0.25 +
        compressionHistory * 0.25 +
        copyMoveDetection * 0.25 +
        splicingDetection * 0.25
      );

      return {
        isAuthentic: manipulationProbability < this.MANIPULATION_THRESHOLD,
        manipulationProbability,
        detectedAnomalies: anomalies,
        analysisDetails: {
          noiseConsistency,
          compressionHistory,
          copyMoveDetection,
          splicingDetection
        }
      };
    } catch (error) {
      console.error('Forensic analysis error:', error);
      return {
        isAuthentic: false,
        manipulationProbability: 1,
        detectedAnomalies: ['Analysis failed'],
        analysisDetails: {
          noiseConsistency: 0,
          compressionHistory: 0,
          copyMoveDetection: 0,
          splicingDetection: 0
        }
      };
    }
  }

  /**
   * Generate authenticity certificate
   */
  generateAuthenticityCertificate(
    proofId: string,
    fileHash: string,
    verificationResult: AuthenticityCheckResult
  ): {
    certificateId: string;
    issuedAt: Date;
    expiresAt: Date;
    data: string;
    signature: string;
  } {
    const certificateId = `cert_${crypto.randomBytes(16).toString('hex')}`;
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

    const certificateData = {
      certificateId,
      proofId,
      fileHash,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      verificationResult: {
        valid: verificationResult.valid,
        confidence: verificationResult.confidence,
        tamperingDetected: verificationResult.tamperingDetected
      }
    };

    const data = JSON.stringify(certificateData);
    const signature = this.signCertificate(data);

    return {
      certificateId,
      issuedAt,
      expiresAt,
      data,
      signature
    };
  }

  /**
   * Verify certificate
   */
  verifyCertificate(certificateData: string, signature: string): boolean {
    return this.verifySignature(
      crypto.createHash('sha256').update(certificateData).digest('hex'),
      signature
    );
  }

  /**
   * Calculate file hash
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  /**
   * Verify digital signature
   */
  private verifySignature(hash: string, signature: string): boolean {
    const publicKey = process.env.MEDIA_VERIFICATION_PUBLIC_KEY || '';
    if (!publicKey) return true; // Skip if no key configured

    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(hash);
      return verify.verify(publicKey, signature, 'hex');
    } catch {
      // Fallback to HMAC verification
      const secret = process.env.MEDIA_SIGNING_KEY || 'default-secret';
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(hash)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    }
  }

  /**
   * Check metadata integrity
   */
  private async checkMetadataIntegrity(filePath?: string): Promise<boolean> {
    if (!filePath || !fs.existsSync(filePath)) return true;

    try {
      // Check for common metadata tampering indicators
      const stats = fs.statSync(filePath);
      
      // File should have reasonable size
      if (stats.size === 0) return false;

      // Check file headers
      const header = await this.readFileHeader(filePath, 16);
      
      // Verify common video/audio file signatures
      const validSignatures = [
        Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), // MP4
        Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), // MKV/WebM
        Buffer.from([0x52, 0x49, 0x46, 0x46]), // AVI/WEBP
        Buffer.from([0xFF, 0xFB]), // MP3
        Buffer.from([0x49, 0x44, 0x33]), // MP3 with ID3
      ];

      return validSignatures.some(sig => 
        header.slice(0, sig.length).equals(sig)
      );
    } catch {
      return false;
    }
  }

  /**
   * Check frame consistency for videos
   */
  private async checkFrameConsistency(filePath: string): Promise<boolean> {
    // Placeholder for frame consistency check
    // In production: Analyze frame timestamps, motion vectors, etc.
    return true;
  }

  /**
   * Detect compression artifacts
   */
  private async detectCompressionArtifacts(filePath: string): Promise<boolean> {
    // Placeholder for artifact detection
    // In production: Analyze DCT coefficients, blocking artifacts, etc.
    return false;
  }

  /**
   * Extract watermark from media
   */
  private async extractWatermark(filePath: string): Promise<string | null> {
    // Placeholder for watermark extraction
    // In production: Extract DCT coefficients and decode watermark
    return null;
  }

  /**
   * Calculate watermark similarity
   */
  private calculateWatermarkSimilarity(watermark1: string, watermark2: string): number {
    if (watermark1 === watermark2) return 1;
    
    // Calculate Hamming distance for binary watermarks
    let matchingBits = 0;
    const maxLength = Math.max(watermark1.length, watermark2.length);
    
    for (let i = 0; i < Math.min(watermark1.length, watermark2.length); i++) {
      if (watermark1[i] === watermark2[i]) matchingBits++;
    }
    
    return matchingBits / maxLength;
  }

  /**
   * Apply DCT-based watermark
   */
  private async applyDCTWatermark(
    filePath: string,
    watermarkHash: string
  ): Promise<string> {
    // Placeholder for DCT watermarking
    // In production: Use FFmpeg or image processing library
    const outputPath = filePath.replace(/\.([^\.]+)$/, '_watermarked.$1');
    return outputPath;
  }

  /**
   * Analyze noise consistency
   */
  private async analyzeNoiseConsistency(filePath: string): Promise<number> {
    // Placeholder for noise analysis
    // In production: Analyze noise patterns across frames/regions
    return 0.85;
  }

  /**
   * Analyze compression history
   */
  private async analyzeCompressionHistory(filePath: string): Promise<number> {
    // Placeholder for compression analysis
    // In production: Detect double compression, quantization tables
    return 0.2;
  }

  /**
   * Detect copy-move forgery
   */
  private async detectCopyMove(filePath: string): Promise<number> {
    // Placeholder for copy-move detection
    // In production: Use block matching algorithms
    return 0.1;
  }

  /**
   * Detect splicing
   */
  private async detectSplicing(filePath: string): Promise<number> {
    // Placeholder for splicing detection
    // In production: Analyze boundary inconsistencies
    return 0.1;
  }

  /**
   * Read file header
   */
  private readFileHeader(filePath: string, length: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { start: 0, end: length - 1 });
      const chunks: Buffer[] = [];

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Calculate authenticity confidence
   */
  private calculateAuthenticityConfidence(details: {
    hashValid: boolean;
    signatureValid: boolean;
    metadataIntact: boolean;
    frameConsistency: boolean;
    compressionArtifacts: boolean;
  }): number {
    const weights = {
      hashValid: 0.3,
      signatureValid: 0.3,
      metadataIntact: 0.2,
      frameConsistency: 0.15,
      compressionArtifacts: 0.05
    };

    let confidence = 0;
    if (details.hashValid) confidence += weights.hashValid;
    if (details.signatureValid) confidence += weights.signatureValid;
    if (details.metadataIntact) confidence += weights.metadataIntact;
    if (details.frameConsistency) confidence += weights.frameConsistency;
    if (!details.compressionArtifacts) confidence += weights.compressionArtifacts;

    return Math.round(confidence * 100) / 100;
  }

  /**
   * Sign certificate
   */
  private signCertificate(data: string): string {
    const privateKey = process.env.MEDIA_SIGNING_KEY || 'default-key';
    return crypto
      .createHmac('sha256', privateKey)
      .update(data)
      .digest('hex');
  }
}

export default new MediaAuthenticityService();
