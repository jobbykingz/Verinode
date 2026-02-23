import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface CompressionOptions {
  quality?: number; // 0.1 to 1.0
  targetResolution?: { width: number; height: number };
  targetBitrate?: number;
  codec?: 'H264' | 'H265' | 'VP9';
  audioCodec?: 'AAC' | 'MP3' | 'OPUS';
  preserveMetadata?: boolean;
  fastStart?: boolean;
}

export interface CompressionResult {
  success: boolean;
  outputPath?: string;
  size?: number;
  compressionRatio?: number;
  duration?: number;
  error?: string;
  metadata?: {
    width: number;
    height: number;
    bitrate: number;
    codec: string;
    duration: number;
  };
}

export interface BatchCompressionResult {
  success: boolean;
  results: CompressionResult[];
  totalOriginalSize: number;
  totalCompressedSize: number;
  overallRatio: number;
  errors: string[];
}

export class VideoCompressionService {
  private readonly DEFAULT_QUALITY = 0.8;
  private readonly DEFAULT_CODEC = 'H264';
  private readonly DEFAULT_AUDIO_CODEC = 'AAC';

  /**
   * Compress a single video file
   */
  async compressVideo(
    inputPath: string,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    try {
      // Validate input file
      if (!fs.existsSync(inputPath)) {
        return { success: false, error: 'Input file not found' };
      }

      const inputStats = fs.statSync(inputPath);
      const originalSize = inputStats.size;

      // Generate output path
      const outputPath = this.generateOutputPath(inputPath);

      // Build FFmpeg command
      const ffmpegArgs = this.buildFFmpegArgs(inputPath, outputPath, options);

      // Execute compression
      await this.executeFFmpeg(ffmpegArgs);

      // Verify output
      if (!fs.existsSync(outputPath)) {
        return { success: false, error: 'Compression failed - no output file' };
      }

      const outputStats = fs.statSync(outputPath);
      const compressedSize = outputStats.size;

      // Extract metadata
      const metadata = await this.extractMetadata(outputPath);

      const compressionRatio = originalSize / compressedSize;

      return {
        success: true,
        outputPath,
        size: compressedSize,
        compressionRatio,
        duration: metadata.duration,
        metadata
      };
    } catch (error) {
      console.error('Video compression error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compression failed'
      };
    }
  }

  /**
   * Compress multiple videos in batch
   */
  async compressBatch(
    inputPaths: string[],
    options: CompressionOptions = {}
  ): Promise<BatchCompressionResult> {
    const results: CompressionResult[] = [];
    const errors: string[] = [];
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    // Process in parallel with concurrency limit
    const CONCURRENCY = 3;
    const chunks = this.chunkArray(inputPaths, CONCURRENCY);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (inputPath) => {
          const inputStats = fs.existsSync(inputPath) ? fs.statSync(inputPath) : null;
          const originalSize = inputStats?.size || 0;

          const result = await this.compressVideo(inputPath, options);

          if (result.success && result.size) {
            totalOriginalSize += originalSize;
            totalCompressedSize += result.size;
          } else if (result.error) {
            errors.push(`${path.basename(inputPath)}: ${result.error}`);
          }

          return result;
        })
      );

      results.push(...chunkResults);
    }

    const overallRatio = totalCompressedSize > 0 
      ? totalOriginalSize / totalCompressedSize 
      : 0;

    return {
      success: errors.length === 0,
      results,
      totalOriginalSize,
      totalCompressedSize,
      overallRatio,
      errors
    };
  }

  /**
   * Generate thumbnail from video
   */
  async generateThumbnail(
    videoPath: string,
    timeOffset: number = 0,
    options: {
      width?: number;
      height?: number;
      quality?: number;
    } = {}
  ): Promise<{ success: boolean; thumbnailPath?: string; error?: string }> {
    try {
      if (!fs.existsSync(videoPath)) {
        return { success: false, error: 'Video file not found' };
      }

      const outputDir = path.dirname(videoPath);
      const basename = path.basename(videoPath, path.extname(videoPath));
      const thumbnailPath = path.join(outputDir, `${basename}_thumb.jpg`);

      const width = options.width || 320;
      const height = options.height || 180;
      const quality = options.quality || 2; // 1-31, lower is better

      const args = [
        '-i', videoPath,
        '-ss', timeOffset.toString(),
        '-vframes', '1',
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        '-q:v', quality.toString(),
        '-y',
        thumbnailPath
      ];

      await this.executeFFmpeg(args);

      if (!fs.existsSync(thumbnailPath)) {
        return { success: false, error: 'Thumbnail generation failed' };
      }

      return { success: true, thumbnailPath };
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Thumbnail generation failed'
      };
    }
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(videoPath: string): Promise<{
    success: boolean;
    metadata?: {
      duration: number;
      width: number;
      height: number;
      bitrate: number;
      codec: string;
      frameRate: number;
      audioCodec?: string;
      audioBitrate?: number;
    };
    error?: string;
  }> {
    try {
      if (!fs.existsSync(videoPath)) {
        return { success: false, error: 'Video file not found' };
      }

      const metadata = await this.extractMetadata(videoPath);

      return {
        success: true,
        metadata
      };
    } catch (error) {
      console.error('Metadata extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Metadata extraction failed'
      };
    }
  }

  /**
   * Estimate compressed file size
   */
  estimateCompressedSize(
    originalSize: number,
    originalDuration: number,
    options: CompressionOptions = {}
  ): number {
    const quality = options.quality || this.DEFAULT_QUALITY;
    const targetBitrate = options.targetBitrate || this.estimateBitrate(quality);
    
    // Calculate estimated size: bitrate * duration / 8 (bits to bytes)
    const estimatedSize = (targetBitrate * originalDuration) / 8;
    
    // Add audio estimate (128 kbps default)
    const audioEstimate = (128000 * originalDuration) / 8;
    
    return Math.min(estimatedSize + audioEstimate, originalSize * 0.95);
  }

  /**
   * Build FFmpeg command arguments
   */
  private buildFFmpegArgs(
    inputPath: string,
    outputPath: string,
    options: CompressionOptions
  ): string[] {
    const quality = options.quality || this.DEFAULT_QUALITY;
    const codec = options.codec || this.DEFAULT_CODEC;
    const audioCodec = options.audioCodec || this.DEFAULT_AUDIO_CODEC;

    const args: string[] = [
      '-i', inputPath,
      '-c:v', this.getVideoCodec(codec),
      '-preset', 'medium', // encoding speed/compression ratio
      '-crf', this.getCRFValue(quality).toString(),
    ];

    // Add resolution scaling if specified
    if (options.targetResolution) {
      const { width, height } = options.targetResolution;
      args.push('-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);
    }

    // Add bitrate limit if specified
    if (options.targetBitrate) {
      args.push('-maxrate', `${options.targetBitrate}`, '-bufsize', `${options.targetBitrate * 2}`);
    }

    // Audio settings
    args.push(
      '-c:a', this.getAudioCodec(audioCodec),
      '-b:a', '128k',
      '-ar', '44100'
    );

    // Fast start for web streaming
    if (options.fastStart !== false) {
      args.push('-movflags', '+faststart');
    }

    // Metadata handling
    if (options.preserveMetadata === false) {
      args.push('-map_metadata', '-1');
    }

    // Overwrite output
    args.push('-y', outputPath);

    return args;
  }

  /**
   * Execute FFmpeg command
   */
  private executeFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`Failed to start FFmpeg: ${error.message}`));
      });
    });
  }

  /**
   * Extract video metadata using FFprobe
   */
  private extractMetadata(videoPath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    bitrate: number;
    codec: string;
    frameRate: number;
    audioCodec?: string;
    audioBitrate?: number;
  }> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,bit_rate,codec_name,r_frame_rate,duration',
        '-show_entries', 'format=duration,bit_rate',
        '-of', 'json',
        videoPath
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFprobe failed: ${stderr}`));
          return;
        }

        try {
          const data = JSON.parse(stdout);
          const stream = data.streams?.[0] || {};
          const format = data.format || {};

          // Parse frame rate (e.g., "30/1" -> 30)
          const frameRateStr = stream.r_frame_rate || '30/1';
          const [num, den] = frameRateStr.split('/').map(Number);
          const frameRate = den ? num / den : num;

          resolve({
            duration: parseFloat(stream.duration || format.duration || '0'),
            width: stream.width || 0,
            height: stream.height || 0,
            bitrate: parseInt(stream.bit_rate || format.bit_rate || '0'),
            codec: stream.codec_name || 'unknown',
            frameRate,
            audioCodec: undefined,
            audioBitrate: undefined
          });
        } catch (error) {
          reject(new Error('Failed to parse FFprobe output'));
        }
      });

      ffprobe.on('error', (error) => {
        reject(new Error(`Failed to start FFprobe: ${error.message}`));
      });
    });
  }

  /**
   * Generate output file path
   */
  private generateOutputPath(inputPath: string): string {
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath, path.extname(inputPath));
    return path.join(dir, `${basename}_compressed.mp4`);
  }

  /**
   * Get video codec name for FFmpeg
   */
  private getVideoCodec(codec: string): string {
    const codecMap: Record<string, string> = {
      'H264': 'libx264',
      'H265': 'libx265',
      'VP9': 'libvpx-vp9'
    };
    return codecMap[codec] || 'libx264';
  }

  /**
   * Get audio codec name for FFmpeg
   */
  private getAudioCodec(codec: string): string {
    const codecMap: Record<string, string> = {
      'AAC': 'aac',
      'MP3': 'libmp3lame',
      'OPUS': 'libopus'
    };
    return codecMap[codec] || 'aac';
  }

  /**
   * Get CRF (Constant Rate Factor) value based on quality
   */
  private getCRFValue(quality: number): number {
    // CRF range: 0-51, where 0 is lossless and 51 is worst
    // Map 0.1-1.0 quality to 28-18 CRF (good quality range)
    const minCRF = 18;
    const maxCRF = 28;
    return Math.round(maxCRF - (quality * (maxCRF - minCRF)));
  }

  /**
   * Estimate target bitrate based on quality
   */
  private estimateBitrate(quality: number): number {
    // Estimate bitrate in bits per second
    // Range: 500 kbps to 8000 kbps
    const minBitrate = 500000;
    const maxBitrate = 8000000;
    return Math.round(minBitrate + (quality * (maxBitrate - minBitrate)));
  }

  /**
   * Chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export default new VideoCompressionService();
