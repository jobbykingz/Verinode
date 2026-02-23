const { IPFSService } = require('./ipfsService');
const { CID } = require('cids');
const { fromString: uint8arrayFromString } = require('uint8arrays/from-string');

class IPNSService {
  constructor() {
    this.ipfsService = new IPFSService();
    this.config = {
      keyType: process.env.IPNS_KEY_TYPE || 'ed25519',
      recordLifetime: process.env.IPNS_RECORD_LIFETIME || '24h',
      resolveTimeout: parseInt(process.env.IPNS_RESOLVE_TIMEOUT) || 30000,
      publishTimeout: parseInt(process.env.IPNS_PUBLISH_TIMEOUT) || 60000,
      autoRefresh: process.env.IPNS_AUTO_REFRESH === 'true',
      refreshInterval: parseInt(process.env.IPNS_REFRESH_INTERVAL) || 3600000 // 1 hour
    };
    
    this.nameRecords = new Map();
    this.refreshTimers = new Map();
  }

  async initialize() {
    await this.ipfsService.initialize();
    
    if (this.config.autoRefresh) {
      this.startAutoRefresh();
    }
    
    console.log('IPNS service initialized');
  }

  async createKey(name, options = {}) {
    try {
      await this.ipfsService.initialize();
      
      const {
        keyType = this.config.keyType,
        timeout = this.config.publishTimeout
      } = options;

      // Generate new key pair for IPNS
      const keyResult = await this.ipfsService.client.key.gen(name, {
        type: keyType,
        timeout
      });

      console.log(`Created IPNS key: ${name} with ID: ${keyResult.id}`);
      
      return {
        name,
        id: keyResult.id,
        type: keyType
      };
    } catch (error) {
      console.error(`Error creating IPNS key ${name}:`, error);
      throw new Error(`Failed to create IPNS key: ${error.message}`);
    }
  }

  async publishToIPNS(keyName, contentCID, options = {}) {
    try {
      await this.ipfsService.initialize();
      
      const {
        lifetime = this.config.recordLifetime,
        ttl = this.config.recordLifetime,
        key = keyName,
        timeout = this.config.publishTimeout,
        resolve = false
      } = options;

      // Validate CID
      if (!this.isValidCID(contentCID)) {
        throw new Error('Invalid content CID');
      }

      // Publish content to IPNS
      const publishResult = await this.ipfsService.client.name.publish(contentCID, {
        key,
        lifetime,
        ttl,
        timeout,
        resolve
      });

      const record = {
        name: keyName,
        value: publishResult.value,
        seq: publishResult.seqno,
        validity: publishResult.validity,
        publishedAt: new Date().toISOString(),
        contentCID
      };

      // Cache the record
      this.nameRecords.set(keyName, record);

      // Set up auto-refresh if enabled
      if (this.config.autoRefresh) {
        this.setupAutoRefresh(keyName);
      }

      console.log(`Published ${contentCID} to IPNS name: ${keyName}`);
      return record;
    } catch (error) {
      console.error(`Error publishing to IPNS ${keyName}:`, error);
      throw new Error(`Failed to publish to IPNS: ${error.message}`);
    }
  }

  async resolveIPNS(name, options = {}) {
    try {
      await this.ipfsService.initialize();
      
      const {
        timeout = this.config.resolveTimeout,
        nocache = false,
        recursive = false
      } = options;

      // Check cache first
      if (!nocache && this.nameRecords.has(name)) {
        const cached = this.nameRecords.get(name);
        if (this.isRecordValid(cached)) {
          return cached;
        }
      }

      // Resolve IPNS name
      const resolveResult = await this.ipfsService.client.name.resolve(name, {
        timeout,
        nocache,
        recursive
      });

      const record = {
        name,
        value: resolveResult.value,
        resolvedAt: new Date().toISOString(),
        contentCID: resolveResult.value
      };

      // Cache the resolved record
      this.nameRecords.set(name, record);

      console.log(`Resolved IPNS name: ${name} to ${resolveResult.value}`);
      return record;
    } catch (error) {
      console.error(`Error resolving IPNS name ${name}:`, error);
      throw new Error(`Failed to resolve IPNS name: ${error.message}`);
    }
  }

  async updateIPNSRecord(keyName, newContentCID, options = {}) {
    try {
      // Resolve current record first
      const currentRecord = await this.resolveIPNS(keyName);
      
      // Publish new content
      const newRecord = await this.publishToIPNS(keyName, newContentCID, options);
      
      // Update history
      const history = this.getUpdateHistory(keyName);
      history.push({
        timestamp: new Date().toISOString(),
        from: currentRecord.contentCID,
        to: newContentCID,
        seq: newRecord.seq
      });

      console.log(`Updated IPNS record ${keyName} from ${currentRecord.contentCID} to ${newContentCID}`);
      return newRecord;
    } catch (error) {
      console.error(`Error updating IPNS record ${keyName}:`, error);
      throw new Error(`Failed to update IPNS record: ${error.message}`);
    }
  }

  async listKeys() {
    try {
      await this.ipfsService.initialize();
      
      const keys = await this.ipfsService.client.key.list();
      
      return keys.map(key => ({
        name: key.name,
        id: key.id
      }));
    } catch (error) {
      console.error('Error listing IPNS keys:', error);
      throw new Error(`Failed to list IPNS keys: ${error.message}`);
    }
  }

  async removeKey(keyName) {
    try {
      await this.ipfsService.initialize();
      
      await this.ipfsService.client.key.rm(keyName);
      
      // Clean up cache and timers
      this.nameRecords.delete(keyName);
      
      if (this.refreshTimers.has(keyName)) {
        clearInterval(this.refreshTimers.get(keyName));
        this.refreshTimers.delete(keyName);
      }
      
      console.log(`Removed IPNS key: ${keyName}`);
      return true;
    } catch (error) {
      console.error(`Error removing IPNS key ${keyName}:`, error);
      throw new Error(`Failed to remove IPNS key: ${error.message}`);
    }
  }

  async importKey(keyName, pem, password = '') {
    try {
      await this.ipfsService.initialize();
      
      const keyResult = await this.ipfsService.client.key.import(keyName, pem, password);
      
      console.log(`Imported IPNS key: ${keyName}`);
      return {
        name: keyName,
        id: keyResult.id
      };
    } catch (error) {
      console.error(`Error importing IPNS key ${keyName}:`, error);
      throw new Error(`Failed to import IPNS key: ${error.message}`);
    }
  }

  async exportKey(keyName, password = '') {
    try {
      await this.ipfsService.initialize();
      
      const pem = await this.ipfsService.client.key.export(keyName, password);
      
      console.log(`Exported IPNS key: ${keyName}`);
      return pem;
    } catch (error) {
      console.error(`Error exporting IPNS key ${keyName}:`, error);
      throw new Error(`Failed to export IPNS key: ${error.message}`);
    }
  }

  async getRecordHistory(keyName) {
    try {
      // This is a simplified implementation
      // In a real implementation, you would query the IPNS record history
      const history = this.getUpdateHistory(keyName);
      const currentRecord = this.nameRecords.get(keyName);
      
      return {
        current: currentRecord,
        history: history,
        totalUpdates: history.length
      };
    } catch (error) {
      console.error(`Error getting record history for ${keyName}:`, error);
      throw new Error(`Failed to get record history: ${error.message}`);
    }
  }

  async verifyRecord(keyName, expectedCID) {
    try {
      const record = await this.resolveIPNS(keyName);
      return record.contentCID === expectedCID;
    } catch (error) {
      console.error(`Error verifying record for ${keyName}:`, error);
      return false;
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

  isRecordValid(record) {
    if (!record || !record.resolvedAt) {
      return false;
    }
    
    const recordAge = Date.now() - new Date(record.resolvedAt).getTime();
    const maxAge = this.config.refreshInterval;
    
    return recordAge < maxAge;
  }

  getUpdateHistory(keyName) {
    // This is a simplified in-memory history
    // In a real implementation, you would persist this to a database
    if (!this.nameRecords.has(`${keyName}_history`)) {
      this.nameRecords.set(`${keyName}_history`, []);
    }
    return this.nameRecords.get(`${keyName}_history`);
  }

  setupAutoRefresh(keyName) {
    // Clear existing timer if any
    if (this.refreshTimers.has(keyName)) {
      clearInterval(this.refreshTimers.get(keyName));
    }

    // Set up new refresh timer
    const timer = setInterval(async () => {
      try {
        await this.resolveIPNS(keyName, { nocache: true });
        console.log(`Auto-refreshed IPNS record: ${keyName}`);
      } catch (error) {
        console.error(`Auto-refresh failed for ${keyName}:`, error);
      }
    }, this.config.refreshInterval);

    this.refreshTimers.set(keyName, timer);
  }

  startAutoRefresh() {
    console.log('Starting IPNS auto-refresh service');
  }

  stopAutoRefresh() {
    for (const [keyName, timer] of this.refreshTimers) {
      clearInterval(timer);
    }
    this.refreshTimers.clear();
    console.log('Stopped IPNS auto-refresh service');
  }

  async getStats() {
    try {
      const keys = await this.listKeys();
      const records = Array.from(this.nameRecords.entries()).filter(([key]) => !key.endsWith('_history'));
      
      return {
        totalKeys: keys.length,
        cachedRecords: records.length,
        activeRefreshTimers: this.refreshTimers.size,
        autoRefreshEnabled: this.config.autoRefresh,
        refreshInterval: this.config.refreshInterval,
        keys: keys.map(key => ({
          name: key.name,
          id: key.id,
          hasRecord: this.nameRecords.has(key.name),
          hasAutoRefresh: this.refreshTimers.has(key.name)
        }))
      };
    } catch (error) {
      console.error('Error getting IPNS stats:', error);
      throw new Error(`Failed to get IPNS stats: ${error.message}`);
    }
  }

  async searchRecords(query) {
    try {
      const records = Array.from(this.nameRecords.entries())
        .filter(([key]) => !key.endsWith('_history'))
        .filter(([key, record]) => 
          key.toLowerCase().includes(query.toLowerCase()) ||
          record.contentCID.includes(query)
        );

      return records.map(([key, record]) => ({
        name: key,
        ...record
      }));
    } catch (error) {
      console.error('Error searching IPNS records:', error);
      throw new Error(`Failed to search IPNS records: ${error.message}`);
    }
  }

  async cleanupExpiredRecords() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, record] of this.nameRecords.entries()) {
      if (key.endsWith('_history')) continue;
      
      if (record.resolvedAt) {
        const age = now - new Date(record.resolvedAt).getTime();
        const maxAge = this.config.refreshInterval * 2; // Double the refresh interval
        
        if (age > maxAge) {
          expiredKeys.push(key);
        }
      }
    }

    for (const key of expiredKeys) {
      this.nameRecords.delete(key);
      console.log(`Cleaned up expired IPNS record: ${key}`);
    }

    return expiredKeys.length;
  }

  async shutdown() {
    this.stopAutoRefresh();
    this.nameRecords.clear();
    console.log('IPNS service shut down');
  }
}

module.exports = { IPNSService };
