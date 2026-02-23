import { Config, HttpClient, Utils } from './utils';
import { ProofError, ValidationError, ErrorHandler } from './errors';
import { WalletService } from './wallet';

/**
 * Proof types
 */
export type ProofType = 'document' | 'image' | 'video' | 'audio' | 'generic';

/**
 * Proof creation options
 */
export interface ProofCreateOptions {
  /**
   * Type of proof to create
   */
  type: ProofType;

  /**
   * Content to create proof for
   */
  content: string | ArrayBuffer | File;

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;

  /**
   * Optional expiration date
   */
  expiresAt?: Date;

  /**
   * Optional custom template
   */
  templateId?: string;

  /**
   * Whether to store on blockchain
   */
  onChain?: boolean;
}

/**
 * Proof verification options
 */
export interface ProofVerifyOptions {
  /**
   * Proof hash to verify
   */
  proofHash: string;

  /**
   * Optional content to verify against
   */
  content?: string | ArrayBuffer | File;

  /**
   * Whether to verify on blockchain
   */
  onChain?: boolean;
}

/**
 * Proof information
 */
export interface Proof {
  /**
   * Unique proof identifier
   */
  id: string;

  /**
   * Proof hash
   */
  hash: string;

  /**
   * Proof type
   */
  type: ProofType;

  /**
   * Creator address
   */
  creator: string;

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Expiration timestamp
   */
  expiresAt?: Date;

  /**
   * Metadata
   */
  metadata?: Record<string, any>;

  /**
   * Blockchain transaction hash (if on-chain)
   */
  transactionHash?: string;

  /**
   * Verification status
   */
  verified: boolean;

  /**
   * Verification count
   */
  verificationCount: number;
}

/**
 * Proof creation result
 */
export interface ProofCreateResult {
  /**
   * Created proof
   */
  proof: Proof;

  /**
   * Transaction hash (if on-chain)
   */
  transactionHash?: string;

  /**
   * Estimated cost (if applicable)
   */
  estimatedCost?: number;
}

/**
 * Proof verification result
 */
export interface ProofVerifyResult {
  /**
   * Whether proof is valid
   */
  valid: boolean;

  /**
   * Verification details
   */
  details: {
    /**
     * Hash matches
     */
    hashMatch: boolean;

    /**
     * Not expired
     */
    notExpired: boolean;

    /**
     * Creator verified
     */
    creatorVerified: boolean;

    /**
     * Blockchain verification (if applicable)
     */
    blockchainVerified?: boolean;
  };

  /**
   * Verification timestamp
   */
  verifiedAt: Date;

  /**
   * Proof information
   */
  proof: Proof;
}

/**
 * Proof service for creating and managing proofs
 */
export class ProofService {
  private config: Config;
  private httpClient: HttpClient;
  private walletService: WalletService;

  constructor(config: Config, walletService?: WalletService) {
    this.config = config;
    this.httpClient = new HttpClient(config);
    this.walletService = walletService || new WalletService(config);
  }

  /**
   * Create a new proof
   */
  public async create(options: ProofCreateOptions): Promise<ProofCreateResult> {
    return ErrorHandler.wrap(async () => {
      // Validate options
      this.validateCreateOptions(options);

      // Get creator address
      let creatorAddress: string;
      if (this.walletService.isConnected()) {
        creatorAddress = await this.walletService.getAddress();
      } else {
        throw new ProofError('Wallet must be connected to create proofs');
      }

      // Process content
      const contentHash = await this.hashContent(options.content);
      
      // Prepare proof data
      const proofData = {
        type: options.type,
        hash: contentHash,
        creator: creatorAddress,
        metadata: options.metadata || {},
        expiresAt: options.expiresAt ? Utils.formatDate(options.expiresAt) : undefined,
        templateId: options.templateId,
        onChain: options.onChain || false
      };

      // Create proof
      const response = await this.httpClient.post<ProofCreateResult>('/proofs', proofData);
      
      // If on-chain, sign and submit transaction
      let transactionHash: string | undefined;
      if (options.onChain) {
        transactionHash = await this.submitToBlockchain(response.data.proof);
      }

      return {
        proof: {
          ...response.data.proof,
          createdAt: new Date(response.data.proof.createdAt),
          expiresAt: response.data.proof.expiresAt ? new Date(response.data.proof.expiresAt) : undefined
        },
        transactionHash,
        estimatedCost: response.data.estimatedCost
      };
    });
  }

  /**
   * Get proof by ID or hash
   */
  public async get(proofId: string): Promise<Proof> {
    return ErrorHandler.wrap(async () => {
      const response = await this.httpClient.get<Proof>(`/proofs/${proofId}`);
      
      return {
        ...response.data,
        createdAt: new Date(response.data.createdAt),
        expiresAt: response.data.expiresAt ? new Date(response.data.expiresAt) : undefined
      };
    });
  }

  /**
   * List proofs for current user
   */
  public async list(options?: {
    limit?: number;
    offset?: number;
    type?: ProofType;
    verified?: boolean;
  }): Promise<Proof[]> {
    return ErrorHandler.wrap(async () => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.type) params.append('type', options.type);
      if (options?.verified !== undefined) params.append('verified', options.verified.toString());

      const response = await this.httpClient.get<Proof[]>(`/proofs?${params.toString()}`);
      
      return response.data.map(proof => ({
        ...proof,
        createdAt: new Date(proof.createdAt),
        expiresAt: proof.expiresAt ? new Date(proof.expiresAt) : undefined
      }));
    });
  }

  /**
   * Delete a proof
   */
  public async delete(proofId: string): Promise<void> {
    return ErrorHandler.wrap(async () => {
      await this.httpClient.delete(`/proofs/${proofId}`);
    });
  }

  /**
   * Hash content for proof creation
   */
  private async hashContent(content: string | ArrayBuffer | File): Promise<string> {
    try {
      let buffer: ArrayBuffer;

      if (typeof content === 'string') {
        // String content
        const encoder = new TextEncoder();
        buffer = encoder.encode(content);
      } else if (content instanceof ArrayBuffer) {
        // ArrayBuffer content
        buffer = content;
      } else if (typeof File !== 'undefined' && content instanceof File) {
        // File content
        buffer = await content.arrayBuffer();
      } else {
        throw new ValidationError('Invalid content type');
      }

      // Create SHA-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      throw new ProofError('Failed to hash content', { error });
    }
  }

  /**
   * Validate proof creation options
   */
  private validateCreateOptions(options: ProofCreateOptions): void {
    if (!options.type) {
      throw new ValidationError('Proof type is required');
    }

    if (!options.content) {
      throw new ValidationError('Content is required');
    }

    const validTypes: ProofType[] = ['document', 'image', 'video', 'audio', 'generic'];
    if (!validTypes.includes(options.type)) {
      throw new ValidationError(`Invalid proof type: ${options.type}`);
    }

    if (options.expiresAt && options.expiresAt < new Date()) {
      throw new ValidationError('Expiration date cannot be in the past');
    }
  }

  /**
   * Submit proof to blockchain
   */
  private async submitToBlockchain(proof: Proof): Promise<string> {
    try {
      // Create blockchain transaction
      const transaction = {
        proofId: proof.id,
        hash: proof.hash,
        creator: proof.creator,
        timestamp: Utils.formatDate(proof.createdAt)
      };

      // Sign transaction
      const signedTransaction = await this.walletService.signTransaction(transaction);
      
      // Submit to blockchain
      const response = await this.httpClient.post<{ transactionHash: string }>('/blockchain/submit', {
        transaction: signedTransaction,
        network: this.config.getNetwork()
      });

      return response.data.transactionHash;
    } catch (error) {
      throw ErrorHandler.handleAxiosError(error);
    }
  }

  /**
   * Get proof cost estimate
   */
  public async getCostEstimate(options: ProofCreateOptions): Promise<{
    baseCost: number;
    blockchainFee?: number;
    total: number;
  }> {
    return ErrorHandler.wrap(async () => {
      const response = await this.httpClient.post('/proofs/estimate-cost', {
        type: options.type,
        onChain: options.onChain || false,
        metadataSize: options.metadata ? JSON.stringify(options.metadata).length : 0
      });

      return response.data;
    });
  }

  /**
   * Get proof templates
   */
  public async getTemplates(): Promise<any[]> {
    return ErrorHandler.wrap(async () => {
      const response = await this.httpClient.get<any[]>('/templates');
      return response.data;
    });
  }

  /**
   * Get proof statistics
   */
  public async getStats(): Promise<{
    total: number;
    verified: number;
    byType: Record<ProofType, number>;
    recent: Proof[];
  }> {
    return ErrorHandler.wrap(async () => {
      const response = await this.httpClient.get('/proofs/stats');
      
      return {
        ...response.data,
        recent: response.data.recent.map((proof: any) => ({
          ...proof,
          createdAt: new Date(proof.createdAt),
          expiresAt: proof.expiresAt ? new Date(proof.expiresAt) : undefined
        }))
      };
    });
  }
}