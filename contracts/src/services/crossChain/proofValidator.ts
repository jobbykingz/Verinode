import { ethers } from 'ethers';
import { createHash, createHmac } from 'crypto';
import { CrossChainProof, VerificationResult } from './crossChainService';

export interface ProofValidationConfig {
  chainId: number;
  confirmationBlocks: number;
  trustLevel: number;
  verifierAddresses: string[];
  maxProofAge: number; // in seconds
  minConfirmations: number;
}

export interface ValidationResult {
  isValid: boolean;
  result: VerificationResult;
  details: string;
  confidence: number;
  gasUsed?: string;
  verificationTime: number;
}

export interface MerkleProof {
  root: string;
  proof: string[];
  leaf: string;
  path: number[];
}

export class CrossChainProofValidator {
  private validationConfigs: Map<number, ProofValidationConfig> = new Map();
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private proofCache: Map<string, ValidationResult> = new Map();
  private readonly CACHE_DURATION = 300000; // 5 minutes

  constructor() {
    this.initializeValidationConfigs();
  }

  private initializeValidationConfigs() {
    const configs: ProofValidationConfig[] = [
      {
        chainId: 1, // Ethereum
        confirmationBlocks: 12,
        trustLevel: 95,
        verifierAddresses: [
          '0x0000000000000000000000000000000000000000', // Placeholder
        ],
        maxProofAge: 3600, // 1 hour
        minConfirmations: 12
      },
      {
        chainId: 137, // Polygon
        confirmationBlocks: 30,
        trustLevel: 90,
        verifierAddresses: [
          '0x0000000000000000000000000000000000000000', // Placeholder
        ],
        maxProofAge: 1800, // 30 minutes
        minConfirmations: 30
      },
      {
        chainId: 56, // BSC
        confirmationBlocks: 20,
        trustLevel: 92,
        verifierAddresses: [
          '0x0000000000000000000000000000000000000000', // Placeholder
        ],
        maxProofAge: 2400, // 40 minutes
        minConfirmations: 20
      }
    ];

    configs.forEach(config => {
      this.validationConfigs.set(config.chainId, config);
      this.initializeProvider(config.chainId);
    });
  }

  private initializeProvider(chainId: number) {
    const rpcUrls: { [key: number]: string } = {
      1: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
      137: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      56: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org'
    };

    if (rpcUrls[chainId]) {
      this.providers.set(chainId, new ethers.JsonRpcProvider(rpcUrls[chainId]));
    }
  }

  public async validateCrossChainProof(proof: CrossChainProof): Promise<ValidationResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(proof);
    const cached = this.proofCache.get(cacheKey);
    if (cached && (Date.now() - cached.verificationTime) < this.CACHE_DURATION) {
      return cached;
    }

    try {
      // Validate basic proof structure
      const structureValidation = this.validateProofStructure(proof);
      if (!structureValidation.isValid) {
        return structureValidation;
      }

      // Get validation config for the chain
      const config = this.validationConfigs.get(proof.chainId);
      if (!config) {
        return {
          isValid: false,
          result: VerificationResult.INVALID,
          details: `Chain ${proof.chainId} not supported for validation`,
          confidence: 0,
          verificationTime: Date.now() - startTime
        };
      }

      // Validate transaction on source chain
      const transactionValidation = await this.validateTransaction(proof, config);
      if (!transactionValidation.isValid) {
        return transactionValidation;
      }

      // Validate Merkle proof
      const merkleValidation = this.validateMerkleProof(proof);
      if (!merkleValidation.isValid) {
        return merkleValidation;
      }

      // Validate proof age
      const ageValidation = this.validateProofAge(proof, config);
      if (!ageValidation.isValid) {
        return ageValidation;
      }

      // Validate verifier signature
      const signatureValidation = await this.validateVerifierSignature(proof, config);
      if (!signatureValidation.isValid) {
        return signatureValidation;
      }

      const result: ValidationResult = {
        isValid: true,
        result: VerificationResult.VALID,
        details: 'Cross-chain proof validation successful',
        confidence: this.calculateConfidence(proof, config),
        verificationTime: Date.now() - startTime
      };

      // Cache the result
      this.proofCache.set(cacheKey, result);

      return result;

    } catch (error) {
      return {
        isValid: false,
        result: VerificationResult.INVALID,
        details: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        verificationTime: Date.now() - startTime
      };
    }
  }

  private validateProofStructure(proof: CrossChainProof): ValidationResult {
    if (!proof.proofId || proof.proofId.length === 0) {
      return {
        isValid: false,
        result: VerificationResult.MALFORMED_PROOF,
        details: 'Invalid proof ID',
        confidence: 0,
        verificationTime: 0
      };
    }

    if (!proof.transactionHash || proof.transactionHash.length !== 66) {
      return {
        isValid: false,
        result: VerificationResult.MALFORMED_PROOF,
        details: 'Invalid transaction hash format',
        confidence: 0,
        verificationTime: 0
      };
    }

    if (!proof.merkleRoot || proof.merkleRoot.length !== 66) {
      return {
        isValid: false,
        result: VerificationResult.MALFORMED_PROOF,
        details: 'Invalid Merkle root format',
        confidence: 0,
        verificationTime: 0
      };
    }

    return {
      isValid: true,
      result: VerificationResult.VALID,
      details: 'Proof structure validation passed',
      confidence: 100,
      verificationTime: 0
    };
  }

  private async validateTransaction(
    proof: CrossChainProof,
    config: ProofValidationConfig
  ): Promise<ValidationResult> {
    const provider = this.providers.get(proof.chainId);
    if (!provider) {
      return {
        isValid: false,
        result: VerificationResult.INVALID,
        details: `Provider not available for chain ${proof.chainId}`,
        confidence: 0,
        verificationTime: 0
      };
    }

    try {
      // Get transaction
      const tx = await provider.getTransaction(proof.transactionHash);
      if (!tx) {
        return {
          isValid: false,
          result: VerificationResult.INVALID,
          details: 'Transaction not found',
          confidence: 0,
          verificationTime: 0
        };
      }

      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(proof.transactionHash);
      if (!receipt) {
        return {
          isValid: false,
          result: VerificationResult.INVALID,
          details: 'Transaction receipt not found',
          confidence: 0,
          verificationTime: 0
        };
      }

      // Check if transaction was successful
      if (receipt.status !== 1) {
        return {
          isValid: false,
          result: VerificationResult.INVALID,
          details: 'Transaction failed',
          confidence: 0,
          verificationTime: 0
        };
      }

      // Check confirmations
      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;
      
      if (confirmations < config.minConfirmations) {
        return {
          isValid: false,
          result: VerificationResult.INSUFFICIENT_CONFIRMATIONS,
          details: `Insufficient confirmations: ${confirmations}/${config.minConfirmations}`,
          confidence: (confirmations / config.minConfirmations) * 100,
          verificationTime: 0
        };
      }

      // Validate block number matches
      if (receipt.blockNumber !== proof.blockNumber) {
        return {
          isValid: false,
          result: VerificationResult.INVALID,
          details: `Block number mismatch: expected ${proof.blockNumber}, got ${receipt.blockNumber}`,
          confidence: 0,
          verificationTime: 0
        };
      }

      return {
        isValid: true,
        result: VerificationResult.VALID,
        details: 'Transaction validation successful',
        confidence: 100,
        verificationTime: 0
      };

    } catch (error) {
      return {
        isValid: false,
        result: VerificationResult.INVALID,
        details: `Transaction validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        verificationTime: 0
      };
    }
  }

  private validateMerkleProof(proof: CrossChainProof): ValidationResult {
    try {
      // Convert hex strings to buffers
      const root = Buffer.from(proof.merkleRoot.slice(2), 'hex');
      const proofBuffers = proof.merkleProof.map(p => Buffer.from(p.slice(2), 'hex'));
      
      // Reconstruct the Merkle proof validation
      // This is a simplified version - in production, you'd use proper Merkle tree libraries
      let computedHash = Buffer.from(proof.proofData.slice(2), 'hex');
      
      for (const proofElement of proofBuffers) {
        const combined = Buffer.concat([computedHash, proofElement]);
        computedHash = createHash('sha256').update(combined).digest();
      }

      const isValid = computedHash.equals(root);

      return {
        isValid,
        result: isValid ? VerificationResult.VALID : VerificationResult.INVALID,
        details: isValid ? 'Merkle proof validation successful' : 'Merkle proof validation failed',
        confidence: isValid ? 100 : 0,
        verificationTime: 0
      };

    } catch (error) {
      return {
        isValid: false,
        result: VerificationResult.MALFORMED_PROOF,
        details: `Merkle proof validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        verificationTime: 0
      };
    }
  }

  private validateProofAge(proof: CrossChainProof, config: ProofValidationConfig): ValidationResult {
    const now = Math.floor(Date.now() / 1000);
    const proofAge = now - proof.timestamp;

    if (proofAge > config.maxProofAge) {
      return {
        isValid: false,
        result: VerificationResult.EXPIRED,
        details: `Proof expired: ${proofAge}s old, max age: ${config.maxProofAge}s`,
        confidence: Math.max(0, 100 - ((proofAge - config.maxProofAge) / config.maxProofAge) * 100),
        verificationTime: 0
      };
    }

    return {
      isValid: true,
      result: VerificationResult.VALID,
      details: 'Proof age validation successful',
      confidence: 100,
      verificationTime: 0
    };
  }

  private async validateVerifierSignature(
    proof: CrossChainProof,
    config: ProofValidationConfig
  ): Promise<ValidationResult> {
    try {
      // Create message hash for signature verification
      const message = this.createVerificationMessage(proof);
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));

      // Check if any verifier address signed the proof
      for (const verifierAddress of config.verifierAddresses) {
        try {
          const recoveredAddress = ethers.recoverAddress(messageHash, proof.verifierSignature);
          if (recoveredAddress.toLowerCase() === verifierAddress.toLowerCase()) {
            return {
              isValid: true,
              result: VerificationResult.VALID,
              details: 'Verifier signature validation successful',
              confidence: 100,
              verificationTime: 0
            };
          }
        } catch {
          // Continue to next verifier
        }
      }

      return {
        isValid: false,
        result: VerificationResult.INVALID,
        details: 'Invalid verifier signature',
        confidence: 0,
        verificationTime: 0
      };

    } catch (error) {
      return {
        isValid: false,
        result: VerificationResult.INVALID,
        details: `Signature validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        verificationTime: 0
      };
    }
  }

  private createVerificationMessage(proof: CrossChainProof): string {
    return JSON.stringify({
      proofId: proof.proofId,
      chainId: proof.chainId,
      blockNumber: proof.blockNumber,
      transactionHash: proof.transactionHash,
      merkleRoot: proof.merkleRoot,
      timestamp: proof.timestamp
    });
  }

  private calculateConfidence(proof: CrossChainProof, config: ProofValidationConfig): number {
    let confidence = 100;

    // Adjust confidence based on trust level
    confidence = (confidence * config.trustLevel) / 100;

    // Adjust confidence based on proof age (newer proofs have higher confidence)
    const now = Math.floor(Date.now() / 1000);
    const proofAge = now - proof.timestamp;
    const agePenalty = (proofAge / config.maxProofAge) * 10; // Max 10% penalty
    confidence -= agePenalty;

    return Math.max(0, Math.min(100, confidence));
  }

  private generateCacheKey(proof: CrossChainProof): string {
    return `${proof.chainId}-${proof.transactionHash}-${proof.merkleRoot}`;
  }

  public clearCache(): void {
    this.proofCache.clear();
  }

  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.proofCache.size,
      keys: Array.from(this.proofCache.keys())
    };
  }
}
