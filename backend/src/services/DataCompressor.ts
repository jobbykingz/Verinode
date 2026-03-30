import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class DataCompressor {
  /**
   * Compresses data using Gzip
   * @param data Buffer to compress
   * @returns Compressed Buffer
   */
  public async compress(data: Buffer): Promise<Buffer> {
    try {
      return await gzip(data);
    } catch (error) {
      console.error('Compression failed:', error);
      throw new Error('Failed to compress data');
    }
  }

  /**
   * Decompresses Gzip data
   * @param compressedData Buffer to decompress
   * @returns Decompressed Buffer
   */
  public async decompress(compressedData: Buffer): Promise<Buffer> {
    try {
      return await gunzip(compressedData);
    } catch (error) {
      console.error('Decompression failed:', error);
      throw new Error('Failed to decompress data');
    }
  }

  public getCompressionRatio(original: number, compressed: number): number {
    return original > 0 ? (original - compressed) / original : 0;
  }
}