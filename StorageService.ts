import { MultiCloudManager } from '../storage/MultiCloudManager';
import { StorageOptimizer, StorageTier } from '../storage/StorageOptimizer';
import { DataCompressor } from '../storage/DataCompressor';

export class StorageService {
  private cloudManager: MultiCloudManager;
  private optimizer: StorageOptimizer;
  private compressor: DataCompressor;

  constructor() {
    this.cloudManager = new MultiCloudManager();
    this.optimizer = new StorageOptimizer();
    this.compressor = new DataCompressor();
  }

  async storeFile(fileName: string, content: Buffer, options: { redundant?: boolean } = {}): Promise<any> {
    // 1. Compress data
    const { buffer, compressed } = await this.compressor.compress(content);

    // 2. Upload to primary cloud (with automatic failover)
    const result = await this.cloudManager.upload(fileName, buffer);

    // 3. Handle redundancy if requested
    if (options.redundant) {
      await this.cloudManager.replicate(fileName, buffer);
    }

    return {
      fileName,
      provider: result.provider,
      url: result.url,
      isCompressed: compressed,
      tier: StorageTier.HOT
    };
  }

  async retrieveFile(fileName: string, provider: any, isCompressed: boolean): Promise<Buffer> {
    try {
      const stream = await this.cloudManager.getDownloadStream(fileName, provider);
      
      // Convert stream to Buffer
      const chunks: any[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      let data = Buffer.concat(chunks);
    
      if (isCompressed) {
        return await this.compressor.decompress(data);
      }
      return data;
    } catch (error) {
      throw new Error(`Failed to retrieve file ${fileName}: ${error.message}`);
    }
  }
}