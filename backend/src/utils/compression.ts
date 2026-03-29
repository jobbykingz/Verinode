import { deflate, inflate } from 'zlib';
import { promisify } from 'util';

const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);

export type CompressionAlgorithm = 'none' | 'gzip' | 'brotli' | 'lz4';

export interface CompressionResult {
  data: any;
  algorithm: CompressionAlgorithm;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export async function compress(
  data: any,
  algorithm: CompressionAlgorithm = 'gzip'
): Promise<CompressionResult> {
  const jsonString = JSON.stringify(data);
  const originalSize = Buffer.byteLength(jsonString, 'utf8');

  if (algorithm === 'none') {
    return {
      data,
      algorithm,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1
    };
  }

  try {
    let compressedData: Buffer;
    
    switch (algorithm) {
      case 'gzip':
        compressedData = await deflateAsync(Buffer.from(jsonString));
        break;
      case 'brotli':
        // For now, fallback to gzip for brotli
        compressedData = await deflateAsync(Buffer.from(jsonString));
        break;
      case 'lz4':
        // For now, fallback to gzip for lz4
        compressedData = await deflateAsync(Buffer.from(jsonString));
        break;
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }

    const compressedSize = compressedData.length;
    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

    return {
      data: compressedData,
      algorithm,
      originalSize,
      compressedSize,
      compressionRatio
    };
  } catch (error) {
    throw new Error(`Compression failed: ${error}`);
  }
}

export async function decompress(
  compressedData: Buffer | any,
  algorithm: CompressionAlgorithm = 'gzip'
): Promise<any> {
  if (algorithm === 'none') {
    return compressedData;
  }

  try {
    let decompressedData: Buffer;
    
    switch (algorithm) {
      case 'gzip':
        decompressedData = await inflateAsync(compressedData);
        break;
      case 'brotli':
        // For now, fallback to gzip for brotli
        decompressedData = await inflateAsync(compressedData);
        break;
      case 'lz4':
        // For now, fallback to gzip for lz4
        decompressedData = await inflateAsync(compressedData);
        break;
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }

    return JSON.parse(decompressedData.toString('utf8'));
  } catch (error) {
    throw new Error(`Decompression failed: ${error}`);
  }
}

export function getCompressionStats(original: any, compressed: CompressionResult): {
  spaceSaved: number;
  spaceSavedPercentage: number;
  compressionTime: number;
} {
  const spaceSaved = compressed.originalSize - compressed.compressedSize;
  const spaceSavedPercentage = (spaceSaved / compressed.originalSize) * 100;
  
  return {
    spaceSaved,
    spaceSavedPercentage,
    compressionTime: 0 // Would need to be measured during compression
  };
}
