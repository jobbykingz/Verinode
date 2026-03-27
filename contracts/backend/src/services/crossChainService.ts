import { ethers } from 'ethers';
import { Web3 } from 'web3';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';

export interface ChainConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  bridgeAddress: string;
  gasPrice: number;
  blockTime: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface CrossChainProof {
  proofId: string;
  sourceChain: number;
  targetChain: number;
  proofData: string;
  sourceVerification: boolean;
  targetVerification: boolean;
  timestamp: number;
  gasUsed: number;
}

export interface VerificationResult {
  chainId: number;
  proofId: string;
  verified: boolean;
  verifier: string;
  timestamp: number;
  gasUsed: number;
  verificationHash: string;
}

export class CrossChainService {
  private chainConfigs: Map<number, ChainConfig> = new Map();
  private providers: Map<number, ethers.providers.JsonRpcProvider | Web3> = new Map();
  private wallets: Map<number, ethers.Wallet> = new Map();

  constructor() {
    this.initializeChains();
  }

  private initializeChains() {
    // Ethereum Mainnet
    this.chainConfigs.set(1, {
      chainId: 1,
      chainName: 'Ethereum',
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
      bridgeAddress: process.env.ETHEREUM_BRIDGE_ADDRESS || '',
      gasPrice: 20000000000, // 20 gwei
      blockTime: 12000,
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      }
    });

    // Polygon Mainnet
    this.chainConfigs.set(137, {
      chainId: 137,
      chainName: 'Polygon',
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      bridgeAddress: process.env.POLYGON_BRIDGE_ADDRESS || '',
      gasPrice: 30000000000, // 30 gwei
      blockTime: 2000,
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      }
    });

    // BSC Mainnet
    this.chainConfigs.set(56, {
      chainId: 56,
      chainName: 'BSC',
      rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
      bridgeAddress: process.env.BSC_BRIDGE_ADDRESS || '',
      gasPrice: 5000000000, // 5 gwei
      blockTime: 3000,
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
      }
    });

    this.initializeProviders();
  }

  private initializeProviders() {
    for (const [chainId, config] of this.chainConfigs) {
      if (chainId === 1 || chainId === 137 || chainId === 56) {
        // EVM chains
        const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        this.providers.set(chainId, provider);
      }
    }
  }

  public async switchChain(chainId: number, privateKey: string): Promise<boolean> {
    try {
      const config = this.chainConfigs.get(chainId);
      if (!config) {
        throw new Error(`Chain ${chainId} not supported`);
      }

      const provider = this.providers.get(chainId) as ethers.providers.JsonRpcProvider;
      const wallet = new ethers.Wallet(privateKey, provider);
      this.wallets.set(chainId, wallet);

      // Verify connection
      const network = await provider.getNetwork();
      return network.chainId === chainId;
    } catch (error) {
      console.error('Failed to switch chain:', error);
      return false;
    }
  }

  public async submitCrossChainProof(
    sourceChain: number,
    targetChain: number,
    proofData: string,
    privateKey: string
  ): Promise<string> {
    try {
      const wallet = this.wallets.get(sourceChain);
      if (!wallet) {
        throw new Error('Wallet not initialized for source chain');
      }

      const config = this.chainConfigs.get(targetChain);
      if (!config) {
        throw new Error('Target chain not supported');
      }

      // Create proof submission transaction
      const tx = {
        to: config.bridgeAddress,
        data: this.encodeProofSubmission(sourceChain, targetChain, proofData),
        gasLimit: ethers.BigNumber.from('200000'),
        gasPrice: ethers.BigNumber.from(config.gasPrice)
      };

      const transaction = await wallet.sendTransaction(tx);
      const receipt = await transaction.wait();

      return receipt.transactionHash;
    } catch (error) {
      console.error('Failed to submit cross-chain proof:', error);
      throw error;
    }
  }

  public async verifyProofOnChain(
    chainId: number,
    proofId: string,
    privateKey: string
  ): Promise<VerificationResult> {
    try {
      const wallet = this.wallets.get(chainId);
      if (!wallet) {
        throw new Error('Wallet not initialized for chain');
      }

      const config = this.chainConfigs.get(chainId);
      if (!config) {
        throw new Error('Chain not supported');
      }

      // Create verification transaction
      const tx = {
        to: config.bridgeAddress,
        data: this.encodeProofVerification(proofId),
        gasLimit: ethers.BigNumber.from('100000'),
        gasPrice: ethers.BigNumber.from(config.gasPrice)
      };

      const startTime = Date.now();
      const transaction = await wallet.sendTransaction(tx);
      const receipt = await transaction.wait();
      const endTime = Date.now();

      // Parse verification result from receipt logs
      const verificationResult = this.parseVerificationResult(receipt);

      return {
        chainId,
        proofId,
        verified: verificationResult.verified,
        verifier: wallet.address,
        timestamp: Math.floor(endTime / 1000),
        gasUsed: receipt.gasUsed.toNumber(),
        verificationHash: receipt.transactionHash
      };
    } catch (error) {
      console.error('Failed to verify proof on chain:', error);
      throw error;
    }
  }

  public async batchVerifyProofs(
    chainId: number,
    proofIds: string[],
    privateKey: string
  ): Promise<VerificationResult[]> {
    try {
      const wallet = this.wallets.get(chainId);
      if (!wallet) {
        throw new Error('Wallet not initialized for chain');
      }

      const config = this.chainConfigs.get(chainId);
      if (!config) {
        throw new Error('Chain not supported');
      }

      // Create batch verification transaction
      const tx = {
        to: config.bridgeAddress,
        data: this.encodeBatchVerification(proofIds),
        gasLimit: ethers.BigNumber.from('300000'),
        gasPrice: ethers.BigNumber.from(config.gasPrice)
      };

      const transaction = await wallet.sendTransaction(tx);
      const receipt = await transaction.wait();

      // Parse batch verification results
      return this.parseBatchVerificationResults(receipt, chainId, proofIds);
    } catch (error) {
      console.error('Failed to batch verify proofs:', error);
      throw error;
    }
  }

  public async getCrossChainProof(proofId: string, chainId: number): Promise<CrossChainProof | null> {
    try {
      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error('Provider not available for chain');
      }

      const config = this.chainConfigs.get(chainId);
      if (!config) {
        throw new Error('Chain not supported');
      }

      // Call contract to get proof details
      const contract = new ethers.Contract(
        config.bridgeAddress,
        ['function getCrossChainProof(uint256) view returns (tuple)'],
        provider
      );

      const proof = await contract.getCrossChainProof(proofId);
      
      return {
        proofId,
        sourceChain: proof.sourceChain,
        targetChain: proof.targetChain,
        proofData: proof.proofData,
        sourceVerification: proof.sourceVerification,
        targetVerification: proof.targetVerification,
        timestamp: proof.timestamp,
        gasUsed: proof.gasUsed
      };
    } catch (error) {
      console.error('Failed to get cross-chain proof:', error);
      return null;
    }
  }

  public async isFullyVerified(proofId: string, requiredChains: number[]): Promise<boolean> {
    try {
      for (const chainId of requiredChains) {
        const proof = await this.getCrossChainProof(proofId, chainId);
        if (!proof || !proof.sourceVerification || !proof.targetVerification) {
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to check full verification:', error);
      return false;
    }
  }

  public async getChainStatus(chainId: number): Promise<any> {
    try {
      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error('Provider not available for chain');
      }

      const config = this.chainConfigs.get(chainId);
      if (!config) {
        throw new Error('Chain not supported');
      }

      const [blockNumber, gasPrice] = await Promise.all([
        provider.getBlockNumber(),
        (provider as ethers.providers.JsonRpcProvider).getGasPrice()
      ]);

      return {
        chainId,
        chainName: config.chainName,
        blockNumber,
        gasPrice: gasPrice.toString(),
        blockTime: config.blockTime,
        nativeCurrency: config.nativeCurrency
      };
    } catch (error) {
      console.error('Failed to get chain status:', error);
      throw error;
    }
  }

  public getSupportedChains(): number[] {
    return Array.from(this.chainConfigs.keys());
  }

  public getChainConfig(chainId: number): ChainConfig | undefined {
    return this.chainConfigs.get(chainId);
  }

  // Helper methods for encoding/decoding contract data
  private encodeProofSubmission(sourceChain: number, targetChain: number, proofData: string): string {
    // Simplified encoding - in practice, use proper ABI encoding
    const iface = new ethers.utils.Interface([
      'function submitCrossChainProof(uint256,uint256,bytes)'
    ]);
    return iface.encodeFunctionData('submitCrossChainProof', [sourceChain, targetChain, proofData]);
  }

  private encodeProofVerification(proofId: string): string {
    const iface = new ethers.utils.Interface([
      'function verifyProof(uint256)'
    ]);
    return iface.encodeFunctionData('verifyProof', [proofId]);
  }

  private encodeBatchVerification(proofIds: string[]): string {
    const iface = new ethers.utils.Interface([
      'function batchVerifyProofs(uint256[])'
    ]);
    return iface.encodeFunctionData('batchVerifyProofs', [proofIds]);
  }

  private parseVerificationResult(receipt: any): { verified: boolean } {
    // Simplified parsing - in practice, parse actual contract events
    return { verified: true };
  }

  private parseBatchVerificationResults(receipt: any, chainId: number, proofIds: string[]): VerificationResult[] {
    // Simplified parsing - in practice, parse actual contract events
    return proofIds.map(proofId => ({
      chainId,
      proofId,
      verified: true,
      verifier: '',
      timestamp: Math.floor(Date.now() / 1000),
      gasUsed: 50000,
      verificationHash: receipt.transactionHash
    }));
  }

  public async estimateGasCost(chainId: number, functionName: string, params: any[]): Promise<string> {
    try {
      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error('Provider not available for chain');
      }

      const config = this.chainConfigs.get(chainId);
      if (!config) {
        throw new Error('Chain not supported');
      }

      const contract = new ethers.Contract(
        config.bridgeAddress,
        ['function submitCrossChainProof(uint256,uint256,bytes)', 'function verifyProof(uint256)'],
        provider
      );

      const gasEstimate = await contract.estimateGas[functionName](...params);
      const gasPrice = await (provider as ethers.providers.JsonRpcProvider).getGasPrice();
      
      const gasCost = gasEstimate.mul(gasPrice);
      return ethers.utils.formatEther(gasCost);
    } catch (error) {
      console.error('Failed to estimate gas cost:', error);
      return '0';
    }
  }
}
