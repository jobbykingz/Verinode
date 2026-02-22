const { IPFSService } = require('./ipfsService');

class PinningService {
  constructor() {
    this.ipfsService = new IPFSService();
    this.pinningStrategies = {
      IMMEDIATE: 'immediate',
      DELAYED: 'delayed',
      CONDITIONAL: 'conditional',
      BACKUP: 'backup'
    };
    this.pinningQueue = [];
    this.backupServices = new Map();
    this.config = {
      maxRetries: parseInt(process.env.PINNING_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.PINNING_RETRY_DELAY) || 5000,
      backupEnabled: process.env.PINNING_BACKUP_ENABLED === 'true',
      autoPinCritical: process.env.PINNING_AUTO_CRITICAL === 'true',
      pinningDelay: parseInt(process.env.PINNING_DELAY) || 30000
    };
  }

  async initialize() {
    await this.ipfsService.initialize();
    
    if (this.config.backupEnabled) {
      await this.initializeBackupServices();
    }
    
    // Start processing pinning queue
    this.startPinningProcessor();
    
    console.log('Pinning service initialized');
  }

  async initializeBackupServices() {
    // Initialize backup pinning services (e.g., Pinata, Infura, etc.)
    // This is a placeholder for actual backup service implementations
    this.backupServices.set('pinata', {
      name: 'Pinata',
      enabled: process.env.PINATA_API_KEY ? true : false,
      pin: this.pinToPinata.bind(this)
    });
    
    this.backupServices.set('infura', {
      name: 'Infura',
      enabled: process.env.INFURA_PROJECT_ID ? true : false,
      pin: this.pinToInfura.bind(this)
    });
  }

  async pinContent(cid, options = {}) {
    try {
      const {
        strategy = this.pinningStrategies.IMMEDIATE,
        priority = 'normal',
        metadata = {},
        backup = this.config.backupEnabled,
        retryCount = 0
      } = options;

      const pinningJob = {
        cid,
        strategy,
        priority,
        metadata,
        backup,
        retryCount,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      switch (strategy) {
        case this.pinningStrategies.IMMEDIATE:
          return await this.executePinning(pinningJob);
          
        case this.pinningStrategies.DELAYED:
          this.addToQueue(pinningJob);
          return { cid, status: 'queued', message: 'Content queued for pinning' };
          
        case this.pinningStrategies.CONDITIONAL:
          return await this.conditionalPinning(pinningJob);
          
        case this.pinningStrategies.BACKUP:
          return await this.backupPinning(pinningJob);
          
        default:
          throw new Error(`Unknown pinning strategy: ${strategy}`);
      }
    } catch (error) {
      console.error(`Error pinning content ${cid}:`, error);
      throw new Error(`Pinning failed: ${error.message}`);
    }
  }

  async executePinning(job) {
    try {
      // Pin to local IPFS node
      await this.ipfsService.pinContent(job.cid);
      
      const result = {
        cid: job.cid,
        status: 'pinned',
        timestamp: new Date().toISOString(),
        strategy: job.strategy,
        metadata: job.metadata
      };

      // Backup to external services if enabled
      if (job.backup && this.config.backupEnabled) {
        await this.backupToExternalServices(job.cid, job.metadata);
      }

      console.log(`Successfully pinned content: ${job.cid}`);
      return result;
    } catch (error) {
      if (job.retryCount < this.config.maxRetries) {
        console.log(`Retrying pinning for ${job.cid}, attempt ${job.retryCount + 1}`);
        await this.delay(this.config.retryDelay);
        job.retryCount++;
        return await this.executePinning(job);
      }
      throw error;
    }
  }

  async conditionalPinning(job) {
    // Implement conditional pinning logic
    // For example, pin based on content importance, size, or other criteria
    const contentSize = await this.getContentSize(job.cid);
    const isCritical = job.metadata.critical || this.config.autoPinCritical;
    
    if (isCritical || contentSize < 1024 * 1024) { // Pin if critical or < 1MB
      return await this.executePinning(job);
    } else {
      this.addToQueue(job);
      return { cid: job.cid, status: 'conditional', message: 'Content queued for conditional pinning' };
    }
  }

  async backupPinning(job) {
    // Pin to backup services only
    const backupResults = await this.backupToExternalServices(job.cid, job.metadata);
    
    return {
      cid: job.cid,
      status: 'backed_up',
      timestamp: new Date().toISOString(),
      backupResults,
      message: 'Content pinned to backup services'
    };
  }

  async backupToExternalServices(cid, metadata) {
    const results = [];
    
    for (const [serviceId, service] of this.backupServices) {
      if (service.enabled) {
        try {
          const result = await service.pin(cid, metadata);
          results.push({
            service: service.name,
            status: 'success',
            result
          });
        } catch (error) {
          console.error(`Failed to pin to ${service.name}:`, error);
          results.push({
            service: service.name,
            status: 'error',
            error: error.message
          });
        }
      }
    }
    
    return results;
  }

  async unpinContent(cid, options = {}) {
    try {
      const { backup = true } = options;
      
      // Unpin from local IPFS node
      await this.ipfsService.unpinContent(cid);
      
      const result = {
        cid,
        status: 'unpinned',
        timestamp: new Date().toISOString()
      };

      // Unpin from backup services if enabled
      if (backup && this.config.backupEnabled) {
        await this.unpinFromExternalServices(cid);
      }

      console.log(`Successfully unpinned content: ${cid}`);
      return result;
    } catch (error) {
      console.error(`Error unpinning content ${cid}:`, error);
      throw new Error(`Unpinning failed: ${error.message}`);
    }
  }

  async unpinFromExternalServices(cid) {
    for (const [serviceId, service] of this.backupServices) {
      if (service.enabled && service.unpin) {
        try {
          await service.unpin(cid);
        } catch (error) {
          console.error(`Failed to unpin from ${service.name}:`, error);
        }
      }
    }
  }

  addToQueue(job) {
    // Add to queue based on priority
    if (job.priority === 'high') {
      this.pinningQueue.unshift(job);
    } else {
      this.pinningQueue.push(job);
    }
  }

  startPinningProcessor() {
    setInterval(async () => {
      if (this.pinningQueue.length > 0) {
        const job = this.pinningQueue.shift();
        try {
          await this.executePinning(job);
        } catch (error) {
          console.error(`Failed to process pinning job for ${job.cid}:`, error);
        }
      }
    }, this.config.pinningDelay);
  }

  async isPinned(cid) {
    try {
      return await this.ipfsService.isPinned(cid);
    } catch (error) {
      console.error('Error checking pin status:', error);
      return false;
    }
  }

  async listPinnedContent() {
    try {
      return await this.ipfsService.listPinnedContent();
    } catch (error) {
      console.error('Error listing pinned content:', error);
      throw new Error(`Failed to list pinned content: ${error.message}`);
    }
  }

  async getPinningStatus(cid) {
    try {
      const isPinned = await this.isPinned(cid);
      const queuePosition = this.pinningQueue.findIndex(job => job.cid === cid);
      
      return {
        cid,
        pinned: isPinned,
        queued: queuePosition !== -1,
        queuePosition: queuePosition !== -1 ? queuePosition + 1 : null
      };
    } catch (error) {
      console.error('Error getting pinning status:', error);
      throw new Error(`Failed to get pinning status: ${error.message}`);
    }
  }

  async getContentSize(cid) {
    try {
      const stats = await this.ipfsService.getStats();
      // This is a simplified implementation
      // In a real implementation, you would get the actual content size
      return 0;
    } catch (error) {
      console.error('Error getting content size:', error);
      return 0;
    }
  }

  // Placeholder methods for external pinning services
  async pinToPinata(cid, metadata) {
    const axios = require('axios');
    
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinByHash',
      {
        hashToPin: cid,
        pinataMetadata: metadata
      },
      {
        headers: {
          'pinata_api_key': process.env.PINATA_API_KEY,
          'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY
        }
      }
    );
    
    return response.data;
  }

  async pinToInfura(cid, metadata) {
    const axios = require('axios');
    
    const response = await axios.post(
      `https://ipfs.infura.io:5001/api/v0/pin/add?arg=${cid}`,
      {},
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.INFURA_PROJECT_ID}:${process.env.INFURA_PROJECT_SECRET}`).toString('base64')}`
        }
      }
    );
    
    return response.data;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getQueueStatus() {
    return {
      queueLength: this.pinningQueue.length,
      queuedItems: this.pinningQueue.map(job => ({
        cid: job.cid,
        priority: job.priority,
        timestamp: job.timestamp
      }))
    };
  }

  async getBackupServiceStatus() {
    const status = {};
    for (const [serviceId, service] of this.backupServices) {
      status[serviceId] = {
        name: service.name,
        enabled: service.enabled
      };
    }
    return status;
  }
}

module.exports = { PinningService };
