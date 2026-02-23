import { Config, HttpClient, Utils } from './utils';
import { ProofError, ValidationError, ErrorHandler } from './errors';
import { Proof, ProofVerifyOptions, ProofVerifyResult } from './proof';

/**
 * Verification service for proof verification
 */
export class VerificationService {
  private config: Config;
  private httpClient: HttpClient;

  constructor(config: Config) {
    this.config = config;
    this.httpClient = new HttpClient(config);
  }

  /**
   * Verify a proof
   */
  public async verify(options: ProofVerifyOptions): Promise<ProofVerifyResult> {
    return ErrorHandler.wrap(async () => {
      // Validate options
      this.validateVerifyOptions(options);

      // Get proof information
      const proof = await this.getProof(options.proofHash);

      // Perform verification
      const verificationResult = await this.performVerification(proof, options);

      // Record verification
      await this.recordVerification(proof.id, verificationResult.valid);

      return verificationResult;
    });
  }

  /**
   * Verify proof content matches hash
   */
  public async verifyContent(proofHash: string, content: string | ArrayBuffer | File): Promise<boolean> {
    return ErrorHandler.wrap(async () => {
      // Hash the content
      const contentHash = await this.hashContent(content);
      
      // Compare with proof hash
      return contentHash === proofHash;
    });
  }

  /**
   * Batch verify multiple proofs
   */
  public async batchVerify(proofs: ProofVerifyOptions[]): Promise<ProofVerifyResult[]> {
    return ErrorHandler.wrap(async () => {
      const results: ProofVerifyResult[] = [];
      
      for (const proofOptions of proofs) {
        try {
          const result = await this.verify(proofOptions);
          results.push(result);
        } catch (error) {
          // Add failed verification result
          results.push({
            valid: false,
            details: {
              hashMatch: false,
              notExpired: false,
              creatorVerified: false
            },
            verifiedAt: new Date(),
            proof: {} as Proof // Empty proof for failed verification
          });
        }
      }

      return results;
    });
  }

  /**
   * Get verification history for a proof
   */
  public async getVerificationHistory(proofId: string): Promise<any[]> {
    return ErrorHandler.wrap(async () => {
      const response = await this.httpClient.get<any[]>(`/proofs/${proofId}/verifications`);
      return response.data;
    });
  }

  /**
   * Get verification statistics
   */
  public async getStats(options?: {
    startDate?: Date;
    endDate?: Date;
    proofType?: string;
  }): Promise<{
    totalVerifications: number;
    successfulVerifications: number;
    failedVerifications: number;
    successRate: number;
    averageResponseTime: number;
    byProofType: Record<string, number>;
  }> {
    return ErrorHandler.wrap(async () => {
      const params = new URLSearchParams();
      if (options?.startDate) params.append('startDate', Utils.formatDate(options.startDate));
      if (options?.endDate) params.append('endDate', Utils.formatDate(options.endDate));
      if (options?.proofType) params.append('proofType', options.proofType);

      const response = await this.httpClient.get('/verifications/stats', {
        params: {}
      });

      return response.data;
    });
  }

  /**
   * Get proof information
   */
  private async getProof(proofHash: string): Promise<Proof> {
    try {
      const response = await this.httpClient.get<Proof>(`/proofs/hash/${proofHash}`);
      
      return {
        ...response.data,
        createdAt: new Date(response.data.createdAt),
        expiresAt: response.data.expiresAt ? new Date(response.data.expiresAt) : undefined
      };
    } catch (error) {
      throw ErrorHandler.handleAxiosError(error);
    }
  }

  /**
   * Perform verification logic
   */
  private async performVerification(proof: Proof, options: ProofVerifyOptions): Promise<ProofVerifyResult> {
    const details = {
      hashMatch: true,
      notExpired: true,
      creatorVerified: true,
      blockchainVerified: undefined as boolean | undefined
    };

    // Check expiration
    if (proof.expiresAt && proof.expiresAt < new Date()) {
      details.notExpired = false;
    }

    // Verify content if provided
    if (options.content) {
      const contentMatches = await this.verifyContent(proof.hash, options.content);
      details.hashMatch = contentMatches;
    }

    // Verify on blockchain if requested
    if (options.onChain && proof.transactionHash) {
      details.blockchainVerified = await this.verifyOnBlockchain(proof.transactionHash);
    }

    // Overall validity
    let valid = details.hashMatch && details.notExpired && details.creatorVerified;
    if (details.blockchainVerified !== undefined) {
      valid = valid && details.blockchainVerified;
    }

    return {
      valid,
      details,
      verifiedAt: new Date(),
      proof
    };
  }

  /**
   * Verify proof on blockchain
   */
  private async verifyOnBlockchain(transactionHash: string): Promise<boolean> {
    try {
      const response = await this.httpClient.get<{ verified: boolean }>(
        `/blockchain/verify/${transactionHash}`,
        { params: { network: this.config.getNetwork() } }
      );
      return response.data.verified;
    } catch (error) {
      ErrorHandler.logError(ErrorHandler.handleAxiosError(error), 'Blockchain verification');
      return false;
    }
  }

  /**
   * Record verification attempt
   */
  private async recordVerification(proofId: string, successful: boolean): Promise<void> {
    try {
      await this.httpClient.post('/verifications', {
        proofId,
        successful,
        timestamp: Utils.formatDate(new Date())
      });
    } catch (error) {
      // Log error but don't fail the verification
      ErrorHandler.logError(ErrorHandler.handleAxiosError(error), 'Record verification');
    }
  }

  /**
   * Hash content for verification
   */
  private async hashContent(content: string | ArrayBuffer | File): Promise<string> {
    try {
      let buffer: ArrayBuffer;

      if (typeof content === 'string') {
        const encoder = new TextEncoder();
        buffer = encoder.encode(content);
      } else if (content instanceof ArrayBuffer) {
        buffer = content;
      } else if (typeof File !== 'undefined' && content instanceof File) {
        buffer = await content.arrayBuffer();
      } else {
        throw new ValidationError('Invalid content type');
      }

      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      throw new ProofError('Failed to hash content for verification', { error });
    }
  }

  /**
   * Validate verification options
   */
  private validateVerifyOptions(options: ProofVerifyOptions): void {
    if (!options.proofHash) {
      throw new ValidationError('Proof hash is required');
    }

    if (!Utils.isValidProofHash(options.proofHash)) {
      throw new ValidationError('Invalid proof hash format');
    }
  }

  /**
   * Verify proof signature
   */
  public async verifySignature(proofHash: string, signature: string, publicKey: string): Promise<boolean> {
    return ErrorHandler.wrap(async () => {
      try {
        const response = await this.httpClient.post<{ valid: boolean }>('/verifications/signature', {
          proofHash,
          signature,
          publicKey
        });
        return response.data.valid;
      } catch (error) {
        throw ErrorHandler.handleAxiosError(error);
      }
    });
  }

  /**
   * Get verification templates
   */
  public async getVerificationTemplates(): Promise<any[]> {
    return ErrorHandler.wrap(async () => {
      const response = await this.httpClient.get<any[]>('/verifications/templates');
      return response.data;
    });
  }

  /**
   * Create custom verification template
   */
  public async createVerificationTemplate(template: any): Promise<any> {
    return ErrorHandler.wrap(async () => {
      const response = await this.httpClient.post<any>('/verifications/templates', template);
      return response.data;
    });
  }
}