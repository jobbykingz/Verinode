import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class DataCompressor {
  /**
   * Compresses data if the benefit exceeds a threshold (e.g., > 1KB)
   */
  async compress(data: Buffer): Promise<{ buffer: Buffer, compressed: boolean, originalSize: number }> {
    if (data.length < 1024) {
      return { buffer: data, compressed: false, originalSize: data.length };
    }

    const compressed = await gzip(data);
    
    // Only return compressed if it's actually smaller
    if (compressed.length < data.length) {
      return { buffer: compressed, compressed: true, originalSize: data.length };
    }
    return { buffer: data, compressed: false, originalSize: data.length };
  }

  async decompress(data: Buffer): Promise<Buffer> {
    return await gunzip(data);
  }
}