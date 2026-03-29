import crypto from 'crypto';
import { logger } from '../utils/logger';
import SignatureRequest, { ISignatureRequest } from '../models/SignatureRequest';
import MultiSigWallet, { IMultiSigWallet } from '../models/MultiSigWallet';

export interface SignatureVerificationResult {
  isValid: boolean;
  signerAddress?: string;
  weight?: number;
  error?: string;
}

export interface SignatureMetadata {
  userAgent?: string;
  ipAddress?: string;
  deviceInfo?: string;
  location?: {
    country?: string;
    city?: string;
  };
  timestamp: Date;
}

export interface BatchSignatureRequest {
  requestId: string;
  signatures: Array<{
    signerAddress: string;
    signature: string;
    metadata?: SignatureMetadata;
  }>;
}

export class SignatureService {
  /**
   * Verify a single signature
   */
  async verifySignature(
    hash: string, 
    signature: string, 
    signerAddress: string
  ): Promise<SignatureVerificationResult> {
    try {
      // Determine the network and verification method based on address format
      if (signerAddress.startsWith('G')) {
        // Stellar address
        return await this.verifyStellarSignature(hash, signature, signerAddress);
      } else if (signerAddress.startsWith('0x')) {
        // Ethereum address
        return await this.verifyEthereumSignature(hash, signature, signerAddress);
      } else {
        return {
          isValid: false,
          error: 'Unsupported address format'
        };
      }
    } catch (error) {
      logger.error('Signature verification error:', error);
      return {
        isValid: false,
        error: 'Verification failed'
      };
    }
  }

  /**
   * Verify multiple signatures in batch
   */
  async verifyBatchSignatures(
    hash: string,
    signatures: Array<{ signerAddress: string; signature: string }>
  ): Promise<SignatureVerificationResult[]> {
    const results = await Promise.all(
      signatures.map(sig => this.verifySignature(hash, sig.signature, sig.signerAddress))
    );

    return results;
  }

  /**
   * Add signatures to a request with validation
   */
  async addSignaturesToRequest(
    requestId: string,
    signatures: BatchSignatureRequest
  ): Promise<ISignatureRequest> {
    try {
      // Get the signature request
      const request = await SignatureRequest.findOne({ requestId });
      if (!request) {
        throw new Error('Signature request not found');
      }

      // Get the wallet to validate signers
      const wallet = await MultiSigWallet.findOne({ walletId: request.walletId });
      if (!wallet) {
        throw new Error('Associated wallet not found');
      }

      // Verify all signatures first
      const verificationResults = await this.verifyBatchSignatures(
        request.security.hash,
        signatures.signatures.map(s => ({ signerAddress: s.signerAddress, signature: s.signature }))
      );

      // Check if all signatures are valid
      const invalidSignatures = verificationResults.filter(r => !r.isValid);
      if (invalidSignatures.length > 0) {
        throw new Error(`Invalid signatures: ${invalidSignatures.map(r => r.error).join(', ')}`);
      }

      // Add each valid signature
      for (let i = 0; i < signatures.signatures.length; i++) {
        const sig = signatures.signatures[i];
        const result = verificationResults[i];

        // Check if signer is authorized
        const signer = wallet.getSignerByAddress(sig.signerAddress);
        if (!signer) {
          throw new Error(`Signer ${sig.signerAddress} not found or inactive`);
        }

        // Check if already signed
        if (request.signatures.some(s => s.signerAddress === sig.signerAddress)) {
          continue; // Skip duplicate signatures
        }

        // Add the signature
        await request.addSignature(
          sig.signerAddress,
          sig.signature,
          signer.weight,
          sig.metadata
        );
      }

      logger.info(`Added ${signatures.signatures.length} signatures to request ${requestId}`);
      return request;

    } catch (error) {
      logger.error('Error adding signatures to request:', error);
      throw error;
    }
  }

  /**
   * Generate signature challenge for a signer
   */
  async generateSignatureChallenge(
    requestId: string,
    signerAddress: string,
    metadata?: {
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<{ challenge: string; expiresAt: Date }> {
    try {
      const request = await SignatureRequest.findOne({ requestId });
      if (!request) {
        throw new Error('Signature request not found');
      }

      const wallet = await MultiSigWallet.findOne({ walletId: request.walletId });
      if (!wallet) {
        throw new Error('Associated wallet not found');
      }

      // Verify signer is authorized
      const signer = wallet.getSignerByAddress(signerAddress);
      if (!signer) {
        throw new Error('Signer not authorized');
      }

      // Generate challenge
      const challenge = this.createChallenge(request.security.nonce, signerAddress);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiry

      // Store challenge temporarily (in production, use Redis or similar)
      await this.storeChallenge(requestId, signerAddress, challenge, expiresAt);

      return { challenge, expiresAt };

    } catch (error) {
      logger.error('Error generating signature challenge:', error);
      throw error;
    }
  }

  /**
   * Verify signature challenge
   */
  async verifyChallengeSignature(
    requestId: string,
    signerAddress: string,
    challengeSignature: string
  ): Promise<boolean> {
    try {
      const storedChallenge = await this.getStoredChallenge(requestId, signerAddress);
      if (!storedChallenge) {
        return false;
      }

      // Check if challenge has expired
      if (new Date() > storedChallenge.expiresAt) {
        await this.removeChallenge(requestId, signerAddress);
        return false;
      }

      // Verify the challenge signature
      const verification = await this.verifySignature(
        storedChallenge.challenge,
        challengeSignature,
        signerAddress
      );

      if (verification.isValid) {
        // Remove the challenge after successful verification
        await this.removeChallenge(requestId, signerAddress);
      }

      return verification.isValid;

    } catch (error) {
      logger.error('Error verifying challenge signature:', error);
      return false;
    }
  }

  /**
   * Get signature statistics for a wallet
   */
  async getSignatureStats(walletId: string): Promise<{
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    executedRequests: number;
    failedRequests: number;
    averageSignaturesPerRequest: number;
    averageConfirmationTime: number;
    signerParticipation: Array<{
      signerAddress: string;
      signerName: string;
      totalSignatures: number;
      participationRate: number;
      averageResponseTime: number;
    }>;
  }> {
    try {
      const requests = await SignatureRequest.find({ walletId });
      
      const stats = {
        totalRequests: requests.length,
        pendingRequests: requests.filter(r => r.status === 'PENDING').length,
        approvedRequests: requests.filter(r => r.status === 'APPROVED').length,
        executedRequests: requests.filter(r => r.status === 'EXECUTED').length,
        failedRequests: requests.filter(r => r.status === 'FAILED').length,
        averageSignaturesPerRequest: 0,
        averageConfirmationTime: 0,
        signerParticipation: [] as any[]
      };

      // Calculate averages
      if (requests.length > 0) {
        stats.averageSignaturesPerRequest = 
          requests.reduce((sum, r) => sum + r.signatures.length, 0) / requests.length;
        
        const executedRequests = requests.filter(r => r.timing.timeToExecution);
        if (executedRequests.length > 0) {
          stats.averageConfirmationTime = 
            executedRequests.reduce((sum, r) => sum + (r.timing.timeToExecution || 0), 0) / executedRequests.length;
        }
      }

      // Calculate signer participation
      const wallet = await MultiSigWallet.findOne({ walletId });
      if (wallet) {
        stats.signerParticipation = wallet.config.signers.map(signer => {
          const signerRequests = requests.filter(r => 
            r.signatures.some(s => s.signerAddress === signer.address)
          );
          
          const totalSignatures = signerRequests.reduce((sum, r) => 
            sum + r.signatures.filter(s => s.signerAddress === signer.address).length, 0
          );

          return {
            signerAddress: signer.address,
            signerName: signer.name,
            totalSignatures,
            participationRate: requests.length > 0 ? totalSignatures / requests.length : 0,
            averageResponseTime: this.calculateAverageResponseTime(signerRequests, signer.address)
          };
        });
      }

      return stats;

    } catch (error) {
      logger.error('Error getting signature stats:', error);
      throw error;
    }
  }

  /**
   * Detect suspicious signature patterns
   */
  async detectSuspiciousPatterns(walletId: string): Promise<Array<{
    type: 'RAPID_SIGNING' | 'UNUSUAL_TIME' | 'DUPLICATE_IP' | 'SIGNATURE_ANOMALY';
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    affectedSignatures: string[];
    recommendation: string;
  }>> {
    try {
      const requests = await SignatureRequest.find({ walletId });
      const patterns = [];

      // Check for rapid signing patterns
      const rapidSignatures = this.detectRapidSigning(requests);
      if (rapidSignatures.length > 0) {
        patterns.push({
          type: 'RAPID_SIGNING' as const,
          description: 'Multiple signatures signed in unusually short time period',
          severity: 'MEDIUM' as const,
          affectedSignatures: rapidSignatures,
          recommendation: 'Review signer activity and consider additional verification'
        });
      }

      // Check for unusual signing times
      const unusualTimes = this.detectUnusualSigningTimes(requests);
      if (unusualTimes.length > 0) {
        patterns.push({
          type: 'UNUSUAL_TIME' as const,
          description: 'Signatures created at unusual hours',
          severity: 'LOW' as const,
          affectedSignatures: unusualTimes,
          recommendation: 'Monitor for potential automated or compromised signing'
        });
      }

      // Check for duplicate IP addresses
      const duplicateIPs = this.detectDuplicateIPs(requests);
      if (duplicateIPs.length > 0) {
        patterns.push({
          type: 'DUPLICATE_IP' as const,
          description: 'Multiple signatures from same IP address',
          severity: 'HIGH' as const,
          affectedSignatures: duplicateIPs,
          recommendation: 'Investigate potential shared account or automated signing'
        });
      }

      return patterns;

    } catch (error) {
      logger.error('Error detecting suspicious patterns:', error);
      return [];
    }
  }

  // Private helper methods

  private async verifyStellarSignature(
    hash: string, 
    signature: string, 
    signerAddress: string
  ): Promise<SignatureVerificationResult> {
    try {
      // Implement Stellar signature verification
      // This would use the Stellar SDK to verify the signature against the public key
      // For now, return a placeholder result
      
      // In a real implementation:
      // 1. Decode the signature
      // 2. Verify it against the signer's public key
      // 3. Check that it matches the expected hash
      
      return {
        isValid: true, // Placeholder
        signerAddress,
        weight: 1
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Stellar signature verification failed'
      };
    }
  }

  private async verifyEthereumSignature(
    hash: string, 
    signature: string, 
    signerAddress: string
  ): Promise<SignatureVerificationResult> {
    try {
      // Implement Ethereum signature verification
      // This would use ethers.js or web3.js to verify the signature
      // For now, return a placeholder result
      
      return {
        isValid: true, // Placeholder
        signerAddress,
        weight: 1
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Ethereum signature verification failed'
      };
    }
  }

  private createChallenge(nonce: string, signerAddress: string): string {
    const timestamp = Date.now().toString();
    const data = `${nonce}:${signerAddress}:${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async storeChallenge(
    requestId: string,
    signerAddress: string,
    challenge: string,
    expiresAt: Date
  ): Promise<void> {
    // In production, store in Redis or database
    // For now, this is a placeholder
    logger.info(`Storing challenge for ${signerAddress} on request ${requestId}`);
  }

  private async getStoredChallenge(requestId: string, signerAddress: string): Promise<{
    challenge: string;
    expiresAt: Date;
  } | null> {
    // In production, retrieve from Redis or database
    // For now, return null (placeholder)
    return null;
  }

  private async removeChallenge(requestId: string, signerAddress: string): Promise<void> {
    // In production, remove from Redis or database
    logger.info(`Removing challenge for ${signerAddress} on request ${requestId}`);
  }

  private calculateAverageResponseTime(requests: ISignatureRequest[], signerAddress: string): number {
    const signerSignatures = requests.flatMap(r => 
      r.signatures.filter(s => s.signerAddress === signerAddress)
    );

    if (signerSignatures.length === 0) return 0;

    const responseTimes = signerSignatures.map(signature => {
      const request = requests.find(r => 
        r.signatures.some(s => s.signerAddress === signerAddress)
      );
      if (!request) return 0;
      
      return signature.signedAt.getTime() - request.timing.createdAt.getTime();
    });

    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  private detectRapidSigning(requests: ISignatureRequest[]): string[] {
    const suspiciousSignatures: string[] = [];
    const timeThreshold = 60000; // 1 minute

    requests.forEach(request => {
      request.signatures.forEach(signature => {
        // Check if multiple signatures were created within the time threshold
        const rapidSignatures = request.signatures.filter(s => 
          Math.abs(s.signedAt.getTime() - signature.signedAt.getTime()) < timeThreshold
        );

        if (rapidSignatures.length > 2) {
          suspiciousSignatures.push(signature.signature);
        }
      });
    });

    return suspiciousSignatures;
  }

  private detectUnusualSigningTimes(requests: ISignatureRequest[]): string[] {
    const suspiciousSignatures: string[] = [];
    const businessHours = { start: 9, end: 17 }; // 9 AM to 5 PM

    requests.forEach(request => {
      request.signatures.forEach(signature => {
        const hour = signature.signedAt.getHours();
        
        // Flag signatures created outside business hours
        if (hour < businessHours.start || hour > businessHours.end) {
          suspiciousSignatures.push(signature.signature);
        }
      });
    });

    return suspiciousSignatures;
  }

  private detectDuplicateIPs(requests: ISignatureRequest[]): string[] {
    const suspiciousSignatures: string[] = [];
    const ipMap = new Map<string, string[]>();

    requests.forEach(request => {
      request.signatures.forEach(signature => {
        const ip = signature.metadata?.ipAddress;
        if (ip) {
          if (!ipMap.has(ip)) {
            ipMap.set(ip, []);
          }
          ipMap.get(ip)!.push(signature.signature);
        }
      });
    });

    // Find IPs with multiple different signers
    ipMap.forEach((signatures, ip) => {
      if (signatures.length > 1) {
        suspiciousSignatures.push(...signatures);
      }
    });

    return suspiciousSignatures;
  }
}
