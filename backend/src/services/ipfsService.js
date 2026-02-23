const { create } = require('ipfs-core');
const { create: createHttpClient } = require('ipfs-http-client');
const { CID } = require('cids');
const { all } = require('it-all');
const { toString } = require('uint8arrays/to-string');
const { fromString } = require('uint8arrays/from-string');

class IPFSService {
  constructor() {
    this.node = null;
    this.client = null;
    this.isInitialized = false;
    this.config = {
      host: process.env.IPFS_HOST || 'localhost',
      port: parseInt(process.env.IPFS_PORT) || 5001,
      protocol: process.env.IPFS_PROTOCOL || 'http',
      repo: process.env.IPFS_REPO || './ipfs-repo'
    };
  }

  async initialize() {
    try {
      if (this.isInitialized) {
        return this.node;
      }

      // Try to connect to existing IPFS node first
      try {
        this.client = createHttpClient({
          host: this.config.host,
          port: this.config.port,
          protocol: this.config.protocol
        });
        
        // Test connection
        await this.client.version();
        console.log('Connected to existing IPFS node');
      } catch (error) {
        console.log('No existing IPFS node found, creating new node...');
        // Create new IPFS node
        this.node = await create({
          repo: this.config.repo,
          config: {
            Addresses: {
              Swarm: [
                '/ip4/0.0.0.0/tcp/4001',
                '/ip4/0.0.0.0/udp/4001/quic'
              ],
              API: `/ip4/127.0.0.1/tcp/${this.config.port}`,
              Gateway: '/ip4/127.0.0.1/tcp/8080'
            },
            Swarm: {
              ConnMgr: {
                HighWater: 1000,
                LowWater: 100
              }
            }
          }
        });
        
        this.client = createHttpClient({
          host: '127.0.0.1',
          port: this.config.port,
          protocol: this.config.protocol
        });
      }

      this.isInitialized = true;
      console.log('IPFS service initialized successfully');
      return this.node;
    } catch (error) {
      console.error('Failed to initialize IPFS service:', error);
      throw new Error(`IPFS initialization failed: ${error.message}`);
    }
  }

  async addContent(content, options = {}) {
    try {
      await this.initialize();
      
      const {
        pin = true,
        wrapWithDirectory = false,
        timeout = 60000,
        progress = false
      } = options;

      let contentBuffer;
      if (typeof content === 'string') {
        contentBuffer = fromString(content);
      } else if (Buffer.isBuffer(content)) {
        contentBuffer = content;
      } else if (content instanceof Uint8Array) {
        contentBuffer = content;
      } else {
        // Convert object to JSON string
        contentBuffer = fromString(JSON.stringify(content));
      }

      const result = await this.client.add(contentBuffer, {
        pin,
        wrapWithDirectory,
        timeout,
        progress: progress ? (bytes) => console.log(`Uploaded ${bytes} bytes`) : undefined
      });

      console.log(`Content added to IPFS with CID: ${result.cid}`);
      return {
        cid: result.cid.toString(),
        size: result.size,
        path: result.path
      };
    } catch (error) {
      console.error('Error adding content to IPFS:', error);
      throw new Error(`Failed to add content to IPFS: ${error.message}`);
    }
  }

  async getContent(cid, options = {}) {
    try {
      await this.initialize();
      
      const {
        timeout = 60000,
        range = undefined
      } = options;

      const chunks = [];
      for await (const chunk of this.client.cat(cid, { timeout, range })) {
        chunks.push(chunk);
      }
      
      const content = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        content.set(chunk, offset);
        offset += chunk.length;
      }

      return content;
    } catch (error) {
      console.error('Error retrieving content from IPFS:', error);
      throw new Error(`Failed to retrieve content from IPFS: ${error.message}`);
    }
  }

  async getContentAsString(cid, options = {}) {
    try {
      const content = await this.getContent(cid, options);
      return toString(content);
    } catch (error) {
      throw new Error(`Failed to retrieve content as string: ${error.message}`);
    }
  }

  async getContentAsJSON(cid, options = {}) {
    try {
      const contentString = await this.getContentAsString(cid, options);
      return JSON.parse(contentString);
    } catch (error) {
      throw new Error(`Failed to retrieve content as JSON: ${error.message}`);
    }
  }

  async pinContent(cid) {
    try {
      await this.initialize();
      await this.client.pin.add(cid);
      console.log(`Content pinned: ${cid}`);
      return true;
    } catch (error) {
      console.error('Error pinning content:', error);
      throw new Error(`Failed to pin content: ${error.message}`);
    }
  }

  async unpinContent(cid) {
    try {
      await this.initialize();
      await this.client.pin.rm(cid);
      console.log(`Content unpinned: ${cid}`);
      return true;
    } catch (error) {
      console.error('Error unpinning content:', error);
      throw new Error(`Failed to unpin content: ${error.message}`);
    }
  }

  async isPinned(cid) {
    try {
      await this.initialize();
      const pins = await all(this.client.pin.ls());
      return pins.some(pin => pin.cid.toString() === cid);
    } catch (error) {
      console.error('Error checking pin status:', error);
      return false;
    }
  }

  async listPinnedContent() {
    try {
      await this.initialize();
      const pins = await all(this.client.pin.ls());
      return pins.map(pin => ({
        cid: pin.cid.toString(),
        type: pin.type
      }));
    } catch (error) {
      console.error('Error listing pinned content:', error);
      throw new Error(`Failed to list pinned content: ${error.message}`);
    }
  }

  async verifyContent(cid, expectedContent) {
    try {
      const retrievedContent = await this.getContent(cid);
      const expectedBuffer = typeof expectedContent === 'string' 
        ? fromString(expectedContent)
        : expectedContent;

      if (retrievedContent.length !== expectedBuffer.length) {
        return false;
      }

      for (let i = 0; i < retrievedContent.length; i++) {
        if (retrievedContent[i] !== expectedBuffer[i]) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error verifying content:', error);
      return false;
    }
  }

  async getStats() {
    try {
      await this.initialize();
      const repoStats = await this.client.repo.stat();
      const version = await this.client.version();
      
      return {
        version: version.version,
        repoSize: repoStats.repoSize,
        storageMax: repoStats.storageMax,
        numObjects: repoStats.numObjects
      };
    } catch (error) {
      console.error('Error getting IPFS stats:', error);
      throw new Error(`Failed to get IPFS stats: ${error.message}`);
    }
  }

  async shutdown() {
    try {
      if (this.node) {
        await this.node.stop();
        console.log('IPFS node stopped');
      }
      this.isInitialized = false;
    } catch (error) {
      console.error('Error shutting down IPFS service:', error);
    }
  }

  isValidCID(cid) {
    try {
      new CID(cid);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = { IPFSService };
