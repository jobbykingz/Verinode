import { CrossChainService } from '../../services/crossChain/crossChainService';

describe('CrossChainService', () => {
  let service: CrossChainService;

  beforeEach(() => {
    service = new CrossChainService();
  });

  describe('getSupportedChains', () => {
    it('should return array of supported chains', () => {
      const chains = service.getSupportedChains();
      
      expect(Array.isArray(chains)).toBe(true);
      expect(chains.length).toBeGreaterThan(0);
      
      chains.forEach(chain => {
        expect(chain).toHaveProperty('chainId');
        expect(chain).toHaveProperty('name');
        expect(chain).toHaveProperty('rpcUrl');
        expect(chain).toHaveProperty('bridgeAddress');
        expect(chain).toHaveProperty('gasPrice');
        expect(chain).toHaveProperty('blockTime');
        expect(chain).toHaveProperty('nativeCurrency');
      });
    });

    it('should include Ethereum, Polygon, and BSC', () => {
      const chains = service.getSupportedChains();
      const chainNames = chains.map(c => c.name);
      
      expect(chainNames).toContain('Ethereum');
      expect(chainNames).toContain('Polygon');
      expect(chainNames).toContain('Binance Smart Chain');
    });
  });

  describe('getChainConfig', () => {
    it('should return correct chain config for valid chain ID', () => {
      const ethConfig = service.getChainConfig(1);
      
      expect(ethConfig).toBeDefined();
      expect(ethConfig?.name).toBe('Ethereum');
      expect(ethConfig?.chainId).toBe(1);
    });

    it('should return undefined for invalid chain ID', () => {
      const config = service.getChainConfig(999);
      
      expect(config).toBeUndefined();
    });
  });

  describe('connectWallet', () => {
    it('should connect wallet successfully for valid address and chain', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const chainId = 1;
      
      const wallet = await service.connectWallet(walletAddress, chainId);
      
      expect(wallet.address).toBe(walletAddress);
      expect(wallet.chainId).toBe(chainId);
      expect(wallet.connected).toBe(true);
      expect(wallet.balance).toBeDefined();
    });

    it('should throw error for unsupported chain', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const chainId = 999;
      
      await expect(service.connectWallet(walletAddress, chainId))
        .rejects.toThrow('Chain 999 is not supported');
    });

    it('should throw error for invalid address format', async () => {
      const invalidAddress = 'invalid-address';
      const chainId = 1;
      
      await expect(service.connectWallet(invalidAddress, chainId))
        .rejects.toThrow();
    });
  });

  describe('switchChain', () => {
    beforeEach(async () => {
      await service.connectWallet('0x1234567890123456789012345678901234567890', 1);
    });

    it('should switch to supported chain successfully', async () => {
      const newChainId = 137;
      
      const wallet = await service.switchChain(newChainId);
      
      expect(wallet.chainId).toBe(newChainId);
      expect(wallet.address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should throw error when no wallet is connected', async () => {
      await service.disconnectWallet();
      
      await expect(service.switchChain(137))
        .rejects.toThrow('No wallet connected');
    });

    it('should throw error for unsupported chain', async () => {
      await expect(service.switchChain(999))
        .rejects.toThrow('Chain 999 is not supported');
    });
  });

  describe('initiateCrossChainTransfer', () => {
    beforeEach(async () => {
      await service.connectWallet('0x1234567890123456789012345678901234567890', 1);
    });

    it('should initiate transfer successfully', async () => {
      const transfer = await service.initiateCrossChainTransfer(
        1,
        137,
        '0x9876543210987654321098765432109876543210',
        '1.5',
        '0x1234567890123456789012345678901234567890'
      );
      
      expect(transfer.transferId).toBeDefined();
      expect(transfer.fromChain).toBe(1);
      expect(transfer.toChain).toBe(137);
      expect(transfer.sender).toBe('0x1234567890123456789012345678901234567890');
      expect(transfer.recipient).toBe('0x9876543210987654321098765432109876543210');
      expect(transfer.amount).toBe('1.5');
      expect(transfer.status).toBe('pending');
    });

    it('should throw error when no wallet connected', async () => {
      await service.disconnectWallet();
      
      await expect(service.initiateCrossChainTransfer(
        1,
        137,
        '0x9876543210987654321098765432109876543210',
        '1.5',
        '0x1234567890123456789012345678901234567890'
      )).rejects.toThrow('No wallet connected');
    });
  });

  describe('verifyCrossChainProof', () => {
    it('should verify proof successfully', async () => {
      const proof = await service.verifyCrossChainProof(
        'proof_001',
        1,
        137,
        'original_proof_001'
      );
      
      expect(proof.proofId).toBe('proof_001');
      expect(proof.chainId).toBe(1);
      expect(proof.verificationResult).toBeDefined();
    });

    it('should throw error for unsupported chains', async () => {
      await expect(service.verifyCrossChainProof(
        'proof_001',
        999,
        137,
        'original_proof_001'
      )).rejects.toThrow('Invalid chain configuration');
    });
  });

  describe('getTransactionHistory', () => {
    beforeEach(async () => {
      await service.connectWallet('0x1234567890123456789012345678901234567890', 1);
    });

    it('should return transaction history', async () => {
      const history = await service.getTransactionHistory(
        '0x1234567890123456789012345678901234567890',
        1
      );
      
      expect(Array.isArray(history)).toBe(true);
    });

    it('should throw error for unsupported chain', async () => {
      await expect(service.getTransactionHistory(
        '0x1234567890123456789012345678901234567890',
        999
      )).rejects.toThrow('Chain 999 is not supported');
    });
  });

  describe('estimateGasFee', () => {
    it('should return gas estimate', async () => {
      const estimate = await service.estimateGasFee(
        1,
        137,
        '1.5',
        '0x1234567890123456789012345678901234567890'
      );
      
      expect(estimate).toHaveProperty('gasLimit');
      expect(estimate).toHaveProperty('gasPrice');
      expect(estimate).toHaveProperty('totalCost');
      expect(estimate).toHaveProperty('optimizedCost');
    });

    it('should throw error for invalid amount', async () => {
      await expect(service.estimateGasFee(
        1,
        137,
        'invalid',
        '0x1234567890123456789012345678901234567890'
      )).rejects.toThrow();
    });
  });

  describe('getCurrentWallet', () => {
    it('should return null when no wallet connected', () => {
      const wallet = service.getCurrentWallet();
      expect(wallet).toBeNull();
    });

    it('should return connected wallet info', async () => {
      await service.connectWallet('0x1234567890123456789012345678901234567890', 1);
      
      const wallet = service.getCurrentWallet();
      
      expect(wallet).toBeDefined();
      expect(wallet?.address).toBe('0x1234567890123456789012345678901234567890');
      expect(wallet?.chainId).toBe(1);
      expect(wallet?.connected).toBe(true);
    });
  });

  describe('disconnectWallet', () => {
    it('should disconnect wallet successfully', async () => {
      await service.connectWallet('0x1234567890123456789012345678901234567890', 1);
      
      await service.disconnectWallet();
      
      const wallet = service.getCurrentWallet();
      expect(wallet).toBeNull();
    });
  });

  describe('getBridgeBalance', () => {
    it('should return bridge balance', async () => {
      const balance = await service.getBridgeBalance(
        1,
        '0x1234567890123456789012345678901234567890'
      );
      
      expect(typeof balance).toBe('string');
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for unsupported chain', async () => {
      await expect(service.getBridgeBalance(
        999,
        '0x1234567890123456789012345678901234567890'
      )).rejects.toThrow('Chain 999 is not supported');
    });
  });

  describe('getCrossChainStats', () => {
    it('should return cross-chain statistics', async () => {
      const stats = await service.getCrossChainStats();
      
      expect(stats).toHaveProperty('totalTransfers');
      expect(stats).toHaveProperty('successfulTransfers');
      expect(stats).toHaveProperty('totalVolume');
      expect(stats).toHaveProperty('averageTransferTime');
      expect(stats).toHaveProperty('chainStats');
      
      expect(typeof stats.totalTransfers).toBe('number');
      expect(typeof stats.successfulTransfers).toBe('number');
      expect(typeof stats.totalVolume).toBe('string');
      expect(typeof stats.averageTransferTime).toBe('number');
      expect(typeof stats.chainStats).toBe('object');
    });
  });
});
