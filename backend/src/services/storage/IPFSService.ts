import { create, IPFSHTTPClient, CID } from 'ipfs-http-client';
import { create as ipfsCore, IPFS } from 'ipfs-core';
import { createRoom, PubSubRoom } from 'ipfs-pubsub-room';
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

export interface IPFSConfig {
  apiUrl: string;
  gatewayUrl: string;
  projectSecret: string;
  projectId: string;
  timeout: number;
  retryAttempts: number;
  enablePubSub: boolean;
}

export interface IPFSReference {
  cid: string;
  size: number;
  hash: string;
  timestamp: number;
  pinStatus: boolean;
  replicationFactor: number;
  gatewayUrl: string;
}

export interface IPFSUploadResult {
  cid: string;
  size: number;
  path: string;
  hash: string;
  timestamp: number;
}

export interface IPFSPinResult {
  cid: string;
  status: 'pinned' | 'unpinned' | 'pending' | 'failed';
  timestamp: number;
}

export interface IPFSStats {
  totalFiles: number;
  totalSize: number;
  pinnedFiles: number;
  replicationCount: number;
  averageReplicationFactor: number;
  storageUtilization: number;
}

export class IPFSService extends EventEmitter {
  private client: IPFSHTTPClient | null = null;
  private coreNode: IPFS | null = null;
  private room: PubSubRoom | null = null;
  private config: IPFSConfig;
  private isInitialized = false;

  constructor(config: IPFSConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize IPFS client and optional core node
   */
  async initialize(): Promise<void> {
    try {
      // Initialize HTTP client for API operations
      this.client = create({
        url: this.config.apiUrl,
        timeout: this.config.timeout,
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.projectId}:${this.config.projectSecret}`).toString('base64')}`
        }
      });

      // Test connection
      await this.client.version();
      
      // Initialize core node for advanced features
      try {
        this.coreNode = await ipfsCore({
          repo: 'verinode-ipfs',
          config: {
            Addresses: {
              Swarm: ['/ip4/0.0.0.0/tcp/4001'],
              API: '/ip4/127.0.0.1/tcp/5001',
              Gateway: '/ip4/127.0.0.1/tcp/8080'
            },
            Swarm: {
              ConnMgr: {
                LowWater: 50,
                HighWater: 300
              }
            }
          }
        });

        if (this.config.enablePubSub) {
          await this.setupPubSub();
        }
      } catch (coreError) {
        console.warn('Failed to initialize IPFS core node:', coreError);
        // Continue with HTTP client only
      }

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize IPFS service:', error);
      throw new Error(`IPFS initialization failed: ${error.message}`);
    }
  }

  /**
   * Upload data to IPFS with automatic pinning
   */
  async uploadData(
    data: Buffer | Uint8Array | string,
    options: {
      pin?: boolean;
      wrapWithDirectory?: boolean;
      timeout?: number;
      progress?: (progress: number) => void;
    } = {}
  ): Promise<IPFSUploadResult> {
    if (!this.isInitialized || !this.client) {
      throw new Error('IPFS service not initialized');
    }

    const {
      pin = true,
      wrapWithDirectory = false,
      timeout = this.config.timeout,
      progress
    } = options;

    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      
      const uploadResult = await this.client.add(buffer, {
        pin,
        wrapWithDirectory,
        timeout,
        progress: (bytes: number) => {
          const progressPercent = (bytes / buffer.length) * 100;
          progress?.(progressPercent);
          this.emit('uploadProgress', { cid: '', progress: progressPercent });
        }
      });

      const result: IPFSUploadResult = {
        cid: uploadResult.cid.toString(),
        size: uploadResult.size,
        path: uploadResult.path,
        hash: uploadResult.hash,
        timestamp: Date.now()
      };

      if (pin) {
        await this.pinContent(uploadResult.cid.toString());
      }

      this.emit('uploaded', result);
      return result;
    } catch (error) {
      this.emit('uploadError', { error: error.message });
      throw new Error(`Failed to upload to IPFS: ${error.message}`);
    }
  }

  /**
   * Upload file with metadata
   */
  async uploadFile(
    file: Buffer | Uint8Array,
    metadata: {
      name: string;
      mimeType: string;
      size: number;
      [key: string]: any;
    }
  ): Promise<IPFSUploadResult> {
    // Create directory structure with metadata
    const metadataBuffer = Buffer.from(JSON.stringify(metadata));
    
    const files = [
      {
        path: 'metadata.json',
        content: metadataBuffer
      },
      {
        path: 'content',
        content: file
      }
    ];

    if (!this.client) {
      throw new Error('IPFS client not initialized');
    }

    const result = await this.client.add(files, { wrapWithDirectory: true });
    
    return {
      cid: result.cid.toString(),
      size: result.size,
      path: result.path,
      hash: result.hash,
      timestamp: Date.now()
    };
  }

  /**
   * Retrieve data from IPFS
   */
  async retrieveData(cid: string, timeout?: number): Promise<Buffer> {
    if (!this.isInitialized || !this.client) {
      throw new Error('IPFS service not initialized');
    }

    try {
      const chunks = [];
      const stream = this.client.cat(cid, { timeout: timeout || this.config.timeout });
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const data = Buffer.concat(chunks);
      this.emit('retrieved', { cid, size: data.length });
      return data;
    } catch (error) {
      this.emit('retrieveError', { cid, error: error.message });
      throw new Error(`Failed to retrieve from IPFS: ${error.message}`);
    }
  }

  /**
   * Retrieve file with metadata
   */
  async retrieveFileWithMetadata(cid: string): Promise<{
    metadata: any;
    content: Buffer;
  }> {
    const data = await this.retrieveData(cid);
    
    // Try to parse as directory structure
    try {
      const files = await this.listDirectory(cid);
      const metadataFile = files.find(f => f.name === 'metadata.json');
      const contentFile = files.find(f => f.name === 'content');

      if (metadataFile && contentFile) {
        const metadata = await this.retrieveData(metadataFile.cid);
        const content = await this.retrieveData(contentFile.cid);
        
        return {
          metadata: JSON.parse(metadata.toString()),
          content
        };
      }
    } catch (error) {
      // Fallback to raw data
    }

    return {
      metadata: {},
      content: data
    };
  }

  /**
   * Pin content to ensure persistence
   */
  async pinContent(cid: string): Promise<IPFSPinResult> {
    if (!this.isInitialized || !this.client) {
      throw new Error('IPFS service not initialized');
    }

    try {
      await this.client.pin.add(cid);
      
      const result: IPFSPinResult = {
        cid,
        status: 'pinned',
        timestamp: Date.now()
      };

      this.emit('pinned', result);
      return result;
    } catch (error) {
      const result: IPFSPinResult = {
        cid,
        status: 'failed',
        timestamp: Date.now()
      };
      
      this.emit('pinError', { cid, error: error.message });
      throw new Error(`Failed to pin content: ${error.message}`);
    }
  }

  /**
   * Unpin content
   */
  async unpinContent(cid: string): Promise<IPFSPinResult> {
    if (!this.isInitialized || !this.client) {
      throw new Error('IPFS service not initialized');
    }

    try {
      await this.client.pin.rm(cid);
      
      const result: IPFSPinResult = {
        cid,
        status: 'unpinned',
        timestamp: Date.now()
      };

      this.emit('unpinned', result);
      return result;
    } catch (error) {
      const result: IPFSPinResult = {
        cid,
        status: 'failed',
        timestamp: Date.now()
      };
      
      this.emit('unpinError', { cid, error: error.message });
      throw new Error(`Failed to unpin content: ${error.message}`);
    }
  }

  /**
   * Check if content is pinned
   */
  async isPinned(cid: string): Promise<boolean> {
    if (!this.isInitialized || !this.client) {
      return false;
    }

    try {
      const pinResults = await this.client.pin.ls({ paths: [cid] });
      return pinResults.size > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * List pinned content
   */
  async listPinned(): Promise<string[]> {
    if (!this.isInitialized || !this.client) {
      return [];
    }

    try {
      const pins = [];
      for await (const pin of this.client.pin.ls()) {
        pins.push(pin.cid.toString());
      }
      return pins;
    } catch (error) {
      console.error('Failed to list pinned content:', error);
      return [];
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(cid: string): Promise<Array<{ name: string; cid: string; size: number }>> {
    if (!this.isInitialized || !this.client) {
      throw new Error('IPFS service not initialized');
    }

    try {
      const files = [];
      for await (const file of this.client.ls(cid)) {
        files.push({
          name: file.name || 'unnamed',
          cid: file.cid.toString(),
          size: file.size
        });
      }
      return files;
    } catch (error) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  /**
   * Verify content integrity
   */
  async verifyContent(cid: string, expectedHash?: string): Promise<boolean> {
    try {
      const data = await this.retrieveData(cid);
      const actualHash = this.calculateHash(data);
      
      if (expectedHash) {
        return actualHash === expectedHash;
      }

      // Verify CID matches content
      const computedCid = await this.calculateCID(data);
      return computedCid === cid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<IPFSStats> {
    if (!this.isInitialized || !this.client) {
      throw new Error('IPFS service not initialized');
    }

    try {
      const pinnedFiles = await this.listPinned();
      let totalSize = 0;
      let replicationCount = 0;

      for (const cid of pinnedFiles) {
        try {
          const stat = await this.client.object.stat(cid);
          totalSize += stat.CumulativeSize;
          replicationCount += stat.NumLinks || 1;
        } catch (error) {
          // Skip files that can't be stat'd
        }
      }

      const averageReplicationFactor = pinnedFiles.length > 0 ? replicationCount / pinnedFiles.length : 0;
      const storageUtilization = totalSize / (1024 * 1024 * 1024); // GB

      return {
        totalFiles: pinnedFiles.length,
        totalSize,
        pinnedFiles: pinnedFiles.length,
        replicationCount,
        averageReplicationFactor,
        storageUtilization
      };
    } catch (error) {
      throw new Error(`Failed to get IPFS stats: ${error.message}`);
    }
  }

  /**
   * Setup pubsub room for real-time communication
   */
  private async setupPubSub(): Promise<void> {
    if (!this.coreNode) {
      return;
    }

    try {
      this.room = createRoom(this.coreNode, 'verinode-storage');
      
      this.room.on('message', (message) => {
        this.emit('pubsubMessage', {
          from: message.from,
          data: message.data.toString(),
          topic: this.room?.topic
        });
      });

      this.room.on('peer joined', (peer) => {
        this.emit('peerJoined', peer);
      });

      this.room.on('peer left', (peer) => {
        this.emit('peerLeft', peer);
      });
    } catch (error) {
      console.warn('Failed to setup pubsub:', error);
    }
  }

  /**
   * Publish message to pubsub room
   */
  async publishMessage(message: string): Promise<void> {
    if (!this.room) {
      throw new Error('Pubsub not available');
    }

    try {
      await this.room.broadcast(message);
    } catch (error) {
      throw new Error(`Failed to publish message: ${error.message}`);
    }
  }

  /**
   * Calculate hash of data
   */
  private calculateHash(data: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Calculate CID from data
   */
  private async calculateCID(data: Buffer): Promise<string> {
    if (!this.client) {
      throw new Error('IPFS client not available');
    }

    const result = await this.client.add(data);
    return result.cid.toString();
  }

  /**
   * Get gateway URL for content
   */
  getGatewayUrl(cid: string): string {
    return `${this.config.gatewayUrl}/ipfs/${cid}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.room) {
        await this.room.leave();
        this.room = null;
      }

      if (this.coreNode) {
        await this.coreNode.stop();
        this.coreNode = null;
      }

      this.client = null;
      this.isInitialized = false;
      this.emit('cleanup');
    } catch (error) {
      console.error('Error during IPFS cleanup:', error);
    }
  }

  /**
   * Check service health
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      if (!this.isInitialized || !this.client) {
        return { healthy: false, details: { error: 'Service not initialized' } };
      }

      const version = await this.client.version();
      const repoStats = await this.client.repo.stat();
      
      return {
        healthy: true,
        details: {
          version: version.version,
          repoSize: repoStats.repoSize,
          numObjects: repoStats.numObjects,
          storageMax: repoStats.storageMax
        }
      };
    } catch (error) {
      return { healthy: false, details: { error: error.message } };
    }
  }
}
