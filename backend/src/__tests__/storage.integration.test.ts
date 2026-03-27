import { DecentralizedStorageService, StorageType } from '../src/services/storage/DecentralizedStorageService';
import { IPFSService } from '../src/services/storage/IPFSService';
import { ArweaveService } from '../src/services/storage/ArweaveService';
import { StorageReference } from '../src/models/StorageReference';

/**
 * Integration tests for Decentralized Storage Service
 * These tests verify the complete integration between IPFS, Arweave, and the storage manager
 */

describe('DecentralizedStorageService Integration', () => {
  let storageService: DecentralizedStorageService;
  let mockIPFSService: jest.Mocked<IPFSService>;
  let mockArweaveService: jest.Mocked<ArweaveService>;

  const mockConfig = {
    ipfs: {
      apiUrl: 'https://ipfs.infura.io:5001',
      gatewayUrl: 'https://ipfs.io',
      projectSecret: 'test-secret',
      projectId: 'test-project',
      timeout: 30000,
      retryAttempts: 3,
      enablePubSub: true
    },
    arweave: {
      gatewayUrl: 'https://arweave.net',
      nodeUrl: 'https://arweave.net',
      wallet: {
        jwk: { test: 'wallet' },
        address: 'test-address'
      },
      timeout: 60000,
      retryAttempts: 3,
      currency: 'AR',
      rewardMultiplier: 1
    },
    defaultType: StorageType.HYBRID,
    redundancyFactor: 3,
    verificationInterval: 86400,
    autoRepair: true,
    costThreshold: 1000000,
    enableCaching: true,
    cacheSize: 100 * 1024 * 1024 // 100MB
  };

  const mockPolicy = {
    defaultType: StorageType.HYBRID,
    redundancyFactor: 3,
    verificationInterval: 86400,
    autoRepair: true,
    costThreshold: 1000000,
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    allowedMimeTypes: ['*/*']
  };

  beforeEach(() => {
    // Mock IPFS service
    mockIPFSService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      uploadData: jest.fn().mockResolvedValue({
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        size: 1024,
        path: '/test',
        hash: 'QmHash123',
        timestamp: Date.now()
      }),
      retrieveData: jest.fn().mockResolvedValue(Buffer.from('test data')),
      pinContent: jest.fn().mockResolvedValue({
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        status: 'pinned',
        timestamp: Date.now()
      }),
      verifyContent: jest.fn().mockResolvedValue(true),
      getStats: jest.fn().mockResolvedValue({
        totalFiles: 10,
        totalSize: 10240,
        pinnedFiles: 8,
        replicationCount: 24,
        averageReplicationFactor: 2.4,
        storageUtilization: 0.01
      }),
      healthCheck: jest.fn().mockResolvedValue({
        healthy: true,
        details: { version: '0.1.0' }
      }),
      cleanup: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock Arweave service
    mockArweaveService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      storeData: jest.fn().mockResolvedValue({
        transactionId: 'arweave-tx-123',
        size: 1024,
        reward: 1000000000,
        timestamp: Date.now(),
        confirmed: false
      }),
      retrieveData: jest.fn().mockResolvedValue(Buffer.from('test data')),
      verifyContentIntegrity: jest.fn().mockResolvedValue(true),
      getStats: jest.fn().mockResolvedValue({
        totalFiles: 5,
        totalSize: 5120,
        totalRewards: 5000000000,
        confirmedFiles: 4,
        pendingFiles: 1,
        averageReward: 1000000000,
        storageUtilization: 0.005
      }),
      healthCheck: jest.fn().mockResolvedValue({
        healthy: true,
        details: { networkInfo: { height: 1000000 } }
      }),
      cleanup: jest.fn().mockResolvedValue(undefined)
    } as any;

    storageService = new DecentralizedStorageService(mockConfig, mockPolicy);
    // Replace the internal services with mocks
    (storageService as any).ipfsService = mockIPFSService;
    (storageService as any).arweaveService = mockArweaveService;
  });

  afterEach(async () => {
    await storageService.cleanup();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with both services', async () => {
      await storageService.initialize();
      
      expect(mockIPFSService.initialize).toHaveBeenCalled();
      expect(mockArweaveService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization failure gracefully', async () => {
      mockIPFSService.initialize.mockRejectedValue(new Error('IPFS init failed'));
      
      await expect(storageService.initialize()).rejects.toThrow('Storage service initialization failed');
    });
  });

  describe('Data Storage Operations', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    it('should store data on IPFS', async () => {
      const testData = Buffer.from('test data for IPFS');
      const result = await storageService.storeData(testData, {
        storageType: StorageType.IPFS,
        contentType: 'text/plain'
      });

      expect(result.storageType).toBe(StorageType.IPFS);
      expect(result.ipfsRef).toBeDefined();
      expect(result.ipfsRef?.cid).toBe('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
      expect(mockIPFSService.uploadData).toHaveBeenCalled();
    });

    it('should store data on Arweave', async () => {
      const testData = Buffer.from('test data for Arweave');
      const result = await storageService.storeData(testData, {
        storageType: StorageType.ARWEAVE,
        contentType: 'text/plain'
      });

      expect(result.storageType).toBe(StorageType.ARWEAVE);
      expect(result.arweaveRef).toBeDefined();
      expect(result.arweaveRef?.transactionId).toBe('arweave-tx-123');
      expect(mockArweaveService.storeData).toHaveBeenCalled();
    });

    it('should store data on both IPFS and Arweave for hybrid storage', async () => {
      const testData = Buffer.from('test data for hybrid');
      const result = await storageService.storeData(testData, {
        storageType: StorageType.HYBRID,
        contentType: 'text/plain'
      });

      expect(result.storageType).toBe(StorageType.HYBRID);
      expect(result.ipfsRef).toBeDefined();
      expect(result.arweaveRef).toBeDefined();
      expect(mockIPFSService.uploadData).toHaveBeenCalled();
      expect(mockArweaveService.storeData).toHaveBeenCalled();
    });

    it('should handle file upload with metadata', async () => {
      const testFile = Buffer.from('test file content');
      const metadata = {
        name: 'test.txt',
        mimeType: 'text/plain',
        size: testFile.length,
        description: 'Test file for integration'
      };

      const result = await storageService.storeFile(testFile, metadata);

      expect(result.size).toBe(testFile.length);
      expect(result.metadata.name).toBe(metadata.name);
      expect(result.metadata.mimeType).toBe(metadata.mimeType);
    });
  });

  describe('Data Retrieval Operations', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    it('should retrieve data from IPFS storage', async () => {
      const testData = Buffer.from('test data');
      const storageResult = await storageService.storeData(testData, {
        storageType: StorageType.IPFS
      });

      const retrievedData = await storageService.retrieveData(storageResult.id);
      expect(retrievedData.toString()).toBe('test data');
      expect(mockIPFSService.retrieveData).toHaveBeenCalledWith(storageResult.ipfsRef?.cid);
    });

    it('should retrieve data from Arweave storage', async () => {
      const testData = Buffer.from('test data');
      const storageResult = await storageService.storeData(testData, {
        storageType: StorageType.ARWEAVE
      });

      const retrievedData = await storageService.retrieveData(storageResult.id);
      expect(retrievedData.toString()).toBe('test data');
      expect(mockArweaveService.retrieveData).toHaveBeenCalledWith(storageResult.arweaveRef?.transactionId);
    });

    it('should use caching for frequently accessed files', async () => {
      const testData = Buffer.from('test data');
      const storageResult = await storageService.storeData(testData, {
        storageType: StorageType.IPFS
      });

      // First retrieval
      await storageService.retrieveData(storageResult.id);
      
      // Second retrieval should use cache
      await storageService.retrieveData(storageResult.id);
      
      // IPFS service should only be called once due to caching
      expect(mockIPFSService.retrieveData).toHaveBeenCalledTimes(1);
    });
  });

  describe('Storage Verification', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    it('should verify IPFS storage integrity', async () => {
      const testData = Buffer.from('test data');
      const storageResult = await storageService.storeData(testData, {
        storageType: StorageType.IPFS
      });

      const verified = await storageService.verifyStorage(storageResult.id);
      expect(verified).toBe(true);
      expect(mockIPFSService.verifyContent).toHaveBeenCalled();
    });

    it('should verify Arweave storage integrity', async () => {
      const testData = Buffer.from('test data');
      const storageResult = await storageService.storeData(testData, {
        storageType: StorageType.ARWEAVE
      });

      const verified = await storageService.verifyStorage(storageResult.id);
      expect(verified).toBe(true);
      expect(mockArweaveService.verifyContentIntegrity).toHaveBeenCalled();
    });

    it('should verify hybrid storage (both IPFS and Arweave)', async () => {
      const testData = Buffer.from('test data');
      const storageResult = await storageService.storeData(testData, {
        storageType: StorageType.HYBRID
      });

      const verified = await storageService.verifyStorage(storageResult.id);
      expect(verified).toBe(true);
      expect(mockIPFSService.verifyContent).toHaveBeenCalled();
      expect(mockArweaveService.verifyContentIntegrity).toHaveBeenCalled();
    });

    it('should handle batch verification', async () => {
      const testData1 = Buffer.from('test data 1');
      const testData2 = Buffer.from('test data 2');
      
      const result1 = await storageService.storeData(testData1, { storageType: StorageType.IPFS });
      const result2 = await storageService.storeData(testData2, { storageType: StorageType.ARWEAVE });

      const verificationResults = await storageService.batchVerify([result1.id, result2.id]);
      
      expect(verificationResults.size).toBe(2);
      expect(verificationResults.get(result1.id)).toBe(true);
      expect(verificationResults.get(result2.id)).toBe(true);
    });
  });

  describe('Storage Metrics and Health', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    it('should provide comprehensive storage metrics', async () => {
      // Store some test data
      await storageService.storeData(Buffer.from('test1'), { storageType: StorageType.IPFS });
      await storageService.storeData(Buffer.from('test2'), { storageType: StorageType.ARWEAVE });
      await storageService.storeData(Buffer.from('test3'), { storageType: StorageType.HYBRID });

      const metrics = await storageService.getMetrics();

      expect(metrics.totalFiles).toBeGreaterThan(0);
      expect(metrics.ipfsFiles).toBeGreaterThan(0);
      expect(metrics.arweaveFiles).toBeGreaterThan(0);
      expect(metrics.hybridFiles).toBeGreaterThan(0);
      expect(metrics.verificationRate).toBeGreaterThanOrEqual(0);
      expect(metrics.averageRedundancy).toBeGreaterThan(0);
    });

    it('should perform health check on all services', async () => {
      const health = await storageService.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details.ipfs.healthy).toBe(true);
      expect(health.details.arweave.healthy).toBe(true);
      expect(mockIPFSService.healthCheck).toHaveBeenCalled();
      expect(mockArweaveService.healthCheck).toHaveBeenCalled();
    });
  });

  describe('Storage Management', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    it('should list all storage references', async () => {
      const testData1 = Buffer.from('test data 1');
      const testData2 = Buffer.from('test data 2');
      
      await storageService.storeData(testData1, { storageType: StorageType.IPFS });
      await storageService.storeData(testData2, { storageType: StorageType.ARWEAVE });

      const storageList = storageService.listStorage();
      
      expect(storageList.length).toBe(2);
      expect(storageList[0].storageType).toBe(StorageType.IPFS);
      expect(storageList[1].storageType).toBe(StorageType.ARWEAVE);
    });

    it('should filter storage by type', async () => {
      const testData = Buffer.from('test data');
      
      await storageService.storeData(testData, { storageType: StorageType.IPFS });
      await storageService.storeData(testData, { storageType: StorageType.ARWEAVE });

      const ipfsStorage = storageService.getStorageByType(StorageType.IPFS);
      const arweaveStorage = storageService.getStorageByType(StorageType.ARWEAVE);

      expect(ipfsStorage.length).toBe(1);
      expect(arweaveStorage.length).toBe(1);
      expect(ipfsStorage[0].storageType).toBe(StorageType.IPFS);
      expect(arweaveStorage[0].storageType).toBe(StorageType.ARWEAVE);
    });

    it('should delete storage references', async () => {
      const testData = Buffer.from('test data');
      const result = await storageService.storeData(testData, { storageType: StorageType.IPFS });

      const deleted = await storageService.deleteStorage(result.id);
      expect(deleted).toBe(true);

      const storageList = storageService.listStorage();
      expect(storageList.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    it('should handle IPFS service failures gracefully', async () => {
      mockIPFSService.uploadData.mockRejectedValue(new Error('IPFS upload failed'));

      await expect(
        storageService.storeData(Buffer.from('test'), { storageType: StorageType.IPFS })
      ).rejects.toThrow('Failed to store data');
    });

    it('should handle Arweave service failures gracefully', async () => {
      mockArweaveService.storeData.mockRejectedValue(new Error('Arweave upload failed'));

      await expect(
        storageService.storeData(Buffer.from('test'), { storageType: StorageType.ARWEAVE })
      ).rejects.toThrow('Failed to store data');
    });

    it('should handle retrieval failures gracefully', async () => {
      mockIPFSService.retrieveData.mockRejectedValue(new Error('IPFS retrieval failed'));
      
      const testData = Buffer.from('test');
      const result = await storageService.storeData(testData, { storageType: StorageType.IPFS });

      await expect(storageService.retrieveData(result.id)).rejects.toThrow('Failed to retrieve data');
    });
  });

  describe('Performance Optimization', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    it('should optimize redundancy based on storage type', async () => {
      const smallData = Buffer.from('small data');
      const largeData = Buffer.alloc(1024 * 1024); // 1MB

      const smallIPFSResult = await storageService.storeData(smallData, { storageType: StorageType.IPFS });
      const largeIPFSResult = await storageService.storeData(largeData, { storageType: StorageType.IPFS });
      const arweaveResult = await storageService.storeData(smallData, { storageType: StorageType.ARWEAVE });

      // IPFS should have higher redundancy for small files
      expect(smallIPFSResult.redundancyLevel).toBeGreaterThanOrEqual(largeIPFSResult.redundancyLevel);
      
      // Arweave should have lower redundancy (permanent storage)
      expect(arweaveResult.redundancyLevel).toBeLessThan(smallIPFSResult.redundancyLevel);
    });

    it('should cache frequently accessed content', async () => {
      const testData = Buffer.from('test data');
      const result = await storageService.storeData(testData, { storageType: StorageType.IPFS });

      // Multiple retrievals should improve cache hit rate
      await storageService.retrieveData(result.id);
      await storageService.retrieveData(result.id);
      await storageService.retrieveData(result.id);

      const metrics = await storageService.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });
  });
});

/**
 * Integration tests for Smart Contracts
 * These tests verify the Soroban smart contract functionality
 */
describe('Smart Contract Integration', () => {
  // These would require a Soroban test environment
  // For now, we'll outline the test structure

  describe('IPFSIntegration Contract', () => {
    it('should initialize with admin and config');
    it('should store data and generate CID');
    it('should pin and unpin content');
    it('should verify content integrity');
    it('should manage storage statistics');
    it('should handle authorization correctly');
  });

  describe('ArweaveIntegration Contract', () => {
    it('should initialize with admin and config');
    it('should store data permanently');
    it('should calculate storage costs');
    it('should verify permanent storage');
    it('should manage transaction records');
    it('should batch store multiple files');
  });

  describe('StorageManager Contract', () => {
    it('should initialize with storage policy');
    it('should store data with automatic redundancy');
    it('should retrieve data with caching');
    it('should verify storage integrity');
    it('should repair failed storage');
    it('should provide storage metrics');
  });

  describe('ContentAddressing Contract', () => {
    it('should initialize with addressing config');
    it('should generate content identifiers');
    it('should register content with metadata');
    it('should manage content versions');
    it('should verify content integrity');
    it('should handle content deduplication');
  });
});

/**
 * End-to-End Integration Tests
 * These tests verify the complete workflow from frontend to backend to blockchain
 */
describe('End-to-End Integration', () => {
  it('should complete full file upload workflow');
  it('should complete full file retrieval workflow');
  it('should handle hybrid storage with failover');
  it('should maintain data integrity across all layers');
  it('should provide consistent metrics and monitoring');
  it('should handle concurrent operations correctly');
});
