import { CrossChainService } from '../services/crossChain/crossChainService';
import { BridgeService } from '../services/crossChain/bridgeService';
import { GasOptimizer } from '../services/crossChain/gasOptimizer';
import { CrossChainProofValidator } from '../services/crossChain/proofValidator';
import { VerificationResult } from '../services/crossChain/crossChainService';

describe('Cross-Chain Functionality Tests', () => {
  let crossChainService: CrossChainService;
  let bridgeService: BridgeService;
  let gasOptimizer: GasOptimizer;
  let proofValidator: CrossChainProofValidator;

  beforeEach(() => {
    crossChainService = new CrossChainService();
    bridgeService = new BridgeService();
    gasOptimizer = new GasOptimizer();
    proofValidator = new CrossChainProofValidator();
  });

  describe('CrossChainService', () => {
    describe('getSupportedChains', () => {
      it('should return supported chains', () => {
        const chains = crossChainService.getSupportedChains();
        expect(chains).toHaveLength(3); // Ethereum, Polygon, BSC
        expect(chains[0]).toHaveProperty('chainId');
        expect(chains[0]).toHaveProperty('name');
        expect(chains[0]).toHaveProperty('nativeCurrency');
      });

      it('should include Ethereum mainnet', () => {
        const chains = crossChainService.getSupportedChains();
        const ethereum = chains.find(c => c.chainId === 1);
        expect(ethereum).toBeDefined();
        expect(ethereum?.name).toBe('Ethereum');
        expect(ethereum?.nativeCurrency.symbol).toBe('ETH');
      });

      it('should include Polygon mainnet', () => {
        const chains = crossChainService.getSupportedChains();
        const polygon = chains.find(c => c.chainId === 137);
        expect(polygon).toBeDefined();
        expect(polygon?.name).toBe('Polygon');
        expect(polygon?.nativeCurrency.symbol).toBe('MATIC');
      });

      it('should include BSC mainnet', () => {
        const chains = crossChainService.getSupportedChains();
        const bsc = chains.find(c => c.chainId === 56);
        expect(bsc).toBeDefined();
        expect(bsc?.name).toBe('BSC');
        expect(bsc?.nativeCurrency.symbol).toBe('BNB');
      });
    });

    describe('initiateTransfer', () => {
      it('should initiate a cross-chain transfer', async () => {
        const transferData = {
          transferId: 'test-transfer-1',
          fromChain: 1,
          toChain: 137,
          sender: '0x1234567890123456789012345678901234567890',
          recipient: '0x0987654321098765432109876543210987654321',
          amount: '1.5',
          tokenAddress: '0xA0b86a33E6417c5c8c5c8c8c8c8c8c8c8c8c8c8c'
        };

        const transfer = await crossChainService.initiateTransfer(transferData);

        expect(transfer.transferId).toBe(transferData.transferId);
        expect(transfer.fromChain).toBe(transferData.fromChain);
        expect(transfer.toChain).toBe(transferData.toChain);
        expect(transfer.status).toBe('pending');
        expect(transfer.proofHash).toBeDefined();
        expect(transfer.timestamp).toBeDefined();
      });

      it('should throw error for unsupported chain', async () => {
        const transferData = {
          transferId: 'test-transfer-2',
          fromChain: 999, // Unsupported chain
          toChain: 137,
          sender: '0x1234567890123456789012345678901234567890',
          recipient: '0x0987654321098765432109876543210987654321',
          amount: '1.5',
          tokenAddress: '0xA0b86a33E6417c5c8c5c8c8c8c8c8c8c8c8c8c8c'
        };

        await expect(crossChainService.initiateTransfer(transferData))
          .rejects.toThrow('Unsupported chain(s) for transfer');
      });
    });

    describe('completeTransfer', () => {
      it('should complete a pending transfer', async () => {
        // First initiate a transfer
        const transferData = {
          transferId: 'test-transfer-3',
          fromChain: 1,
          toChain: 137,
          sender: '0x1234567890123456789012345678901234567890',
          recipient: '0x0987654321098765432109876543210987654321',
          amount: '2.0',
          tokenAddress: '0xA0b86a33E6417c5c8c5c8c8c8c8c8c8c8c8c8c8c'
        };

        await crossChainService.initiateTransfer(transferData);

        // Then complete it
        const completedTransfer = await crossChainService.completeTransfer('test-transfer-3');

        expect(completedTransfer.status).toBe('completed');
        expect(completedTransfer.gasUsed).toBeDefined();
        expect(completedTransfer.fees).toBeDefined();
      });

      it('should throw error for non-existent transfer', async () => {
        await expect(crossChainService.completeTransfer('non-existent-transfer'))
          .rejects.toThrow('Transfer non-existent-transfer not found');
      });
    });

    describe('switchChain', () => {
      it('should switch to supported chain', async () => {
        const walletInfo = await crossChainService.switchChain(
          '0x1234567890123456789012345678901234567890',
          137
        );

        expect(walletInfo.chainId).toBe(137);
        expect(walletInfo.address).toBe('0x1234567890123456789012345678901234567890');
        expect(walletInfo.connected).toBe(true);
      });

      it('should throw error for unsupported chain', async () => {
        await expect(crossChainService.switchChain(
          '0x1234567890123456789012345678901234567890',
          999
        )).rejects.toThrow('Chain 999 not supported');
      });
    });
  });

  describe('BridgeService', () => {
    describe('estimateGasCost', () => {
      it('should estimate gas cost for transfer', async () => {
        const gasCost = await bridgeService.estimateGasCost(1, 137, '1.0');
        
        expect(gasCost).toBeDefined();
        expect(typeof gasCost).toBe('string');
        expect(parseFloat(gasCost)).toBeGreaterThan(0);
      });
    });

    describe('calculateFees', () => {
      it('should calculate bridge fees correctly', () => {
        const fees = bridgeService.calculateFees('100', '0.01');
        
        expect(parseFloat(fees)).toBeGreaterThan(0.01); // Should include bridge fee
        expect(parseFloat(fees)).toBeLessThan(1); // Should be reasonable
      });
    });
  });

  describe('GasOptimizer', () => {
    describe('optimizeGas', () => {
      it('should optimize gas for cross-chain transfer', async () => {
        const optimization = await gasOptimizer.optimizeGas(1, 137, '1.0');
        
        expect(optimization.gasLimit).toBeDefined();
        expect(optimization.gasPrice).toBeDefined();
        expect(optimization.estimatedCost).toBeDefined();
        expect(optimization.optimizedCost).toBeDefined();
        expect(optimization.savings).toBeDefined();
        expect(optimization.savingsPercentage).toBeGreaterThan(0);
      });

      it('should achieve at least 50% gas savings', async () => {
        const optimization = await gasOptimizer.optimizeGas(1, 137, '1.0');
        
        expect(optimization.savingsPercentage).toBeGreaterThanOrEqual(50);
      });
    });

    describe('getOptimalGasPrice', () => {
      it('should return optimal gas price for chain', () => {
        const optimalPrice = gasOptimizer.getOptimalGasPrice(1);
        
        expect(optimalPrice).toBeGreaterThan(0);
        expect(typeof optimalPrice).toBe('number');
      });
    });
  });

  describe('CrossChainProofValidator', () => {
    describe('validateCrossChainProof', () => {
      it('should validate a correct proof', async () => {
        const validProof = {
          proofId: 'proof-123',
          chainId: 1,
          blockNumber: 12345,
          transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          proofData: '0xabcdef1234567890',
          merkleRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          merkleProof: ['0x1234', '0x5678'],
          timestamp: Math.floor(Date.now() / 1000),
          verificationResult: VerificationResult.VALID
        };

        const result = await proofValidator.validateCrossChainProof(validProof);

        expect(result.isValid).toBe(true);
        expect(result.result).toBe(VerificationResult.VALID);
        expect(result.confidence).toBeGreaterThan(0);
      });

      it('should reject malformed proof', async () => {
        const malformedProof = {
          proofId: '', // Empty proof ID
          chainId: 1,
          blockNumber: 12345,
          transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          proofData: '0xabcdef1234567890',
          merkleRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          merkleProof: ['0x1234', '0x5678'],
          timestamp: Math.floor(Date.now() / 1000),
          verificationResult: VerificationResult.VALID
        };

        const result = await proofValidator.validateCrossChainProof(malformedProof);

        expect(result.isValid).toBe(false);
        expect(result.result).toBe(VerificationResult.MALFORMED_PROOF);
      });

      it('should reject expired proof', async () => {
        const expiredProof = {
          proofId: 'proof-456',
          chainId: 1,
          blockNumber: 12345,
          transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          proofData: '0xabcdef1234567890',
          merkleRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          merkleProof: ['0x1234', '0x5678'],
          timestamp: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
          verificationResult: VerificationResult.VALID
        };

        const result = await proofValidator.validateCrossChainProof(expiredProof);

        expect(result.isValid).toBe(false);
        expect(result.result).toBe(VerificationResult.EXPIRED);
      });
    });

    describe('cache functionality', () => {
      it('should cache validation results', async () => {
        const proof = {
          proofId: 'proof-cache-test',
          chainId: 1,
          blockNumber: 12345,
          transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          proofData: '0xabcdef1234567890',
          merkleRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          merkleProof: ['0x1234', '0x5678'],
          timestamp: Math.floor(Date.now() / 1000),
          verificationResult: VerificationResult.VALID
        };

        // First validation
        const result1 = await proofValidator.validateCrossChainProof(proof);
        
        // Second validation (should use cache)
        const result2 = await proofValidator.validateCrossChainProof(proof);

        expect(result1).toEqual(result2);
        
        const cacheStats = proofValidator.getCacheStats();
        expect(cacheStats.size).toBeGreaterThan(0);
      });

      it('should clear cache', () => {
        proofValidator.clearCache();
        const cacheStats = proofValidator.getCacheStats();
        expect(cacheStats.size).toBe(0);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should complete full cross-chain transfer flow', async () => {
      // 1. Initiate transfer
      const transferData = {
        transferId: 'integration-test-1',
        fromChain: 1,
        toChain: 137,
        sender: '0x1234567890123456789012345678901234567890',
        recipient: '0x0987654321098765432109876543210987654321',
        amount: '5.0',
        tokenAddress: '0xA0b86a33E6417c5c8c5c8c8c8c8c8c8c8c8c8c8c'
      };

      const initiatedTransfer = await crossChainService.initiateTransfer(transferData);
      expect(initiatedTransfer.status).toBe('pending');

      // 2. Optimize gas
      const gasOptimization = await gasOptimizer.optimizeGas(1, 137, '5.0');
      expect(gasOptimization.savingsPercentage).toBeGreaterThanOrEqual(50);

      // 3. Complete transfer
      const completedTransfer = await crossChainService.completeTransfer('integration-test-1');
      expect(completedTransfer.status).toBe('completed');
      expect(completedTransfer.gasUsed).toBeDefined();
      expect(completedTransfer.fees).toBeDefined();

      // 4. Verify transfer status
      const transferStatus = await crossChainService.getTransferStatus('integration-test-1');
      expect(transferStatus?.status).toBe('completed');
    });

    it('should handle chain switching with wallet', async () => {
      const address = '0x1234567890123456789012345678901234567890';

      // Switch to Polygon
      const polygonWallet = await crossChainService.switchChain(address, 137);
      expect(polygonWallet.chainId).toBe(137);

      // Switch to BSC
      const bscWallet = await crossChainService.switchChain(address, 56);
      expect(bscWallet.chainId).toBe(56);

      // Switch back to Ethereum
      const ethWallet = await crossChainService.switchChain(address, 1);
      expect(ethWallet.chainId).toBe(1);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent transfers', async () => {
      const transfers = Array.from({ length: 10 }, (_, i) => ({
        transferId: `concurrent-test-${i}`,
        fromChain: 1,
        toChain: 137,
        sender: `0x${i.toString().padStart(40, '1')}`,
        recipient: `0x${i.toString().padStart(40, '2')}`,
        amount: '1.0',
        tokenAddress: '0xA0b86a33E6417c5c8c5c8c8c8c8c8c8c8c8c8c8c'
      }));

      const startTime = Date.now();
      
      const results = await Promise.all(
        transfers.map(transfer => crossChainService.initiateTransfer(transfer))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(10);
      expect(results.every(r => r.status === 'pending')).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should optimize gas quickly', async () => {
      const startTime = Date.now();
      
      const optimization = await gasOptimizer.optimizeGas(1, 137, '10.0');
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(optimization.savingsPercentage).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
