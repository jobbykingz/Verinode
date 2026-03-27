import { TransactionBuilder, Server, Networks, Keypair, StrKey } from '@stellar/stellar-sdk';
import MultiSigWallet, { IMultiSigWallet } from '../models/MultiSigWallet';
import SignatureRequest, { ISignatureRequest } from '../models/SignatureRequest';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface CreateWalletRequest {
  name: string;
  description?: string;
  network: 'STELLAR' | 'ETHEREUM' | 'POLYGON';
  threshold: number;
  signers: Array<{
    address: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'SIGNER';
    weight?: number;
  }>;
  createdBy: string;
  security?: {
    dailyLimit?: number;
    singleTransactionLimit?: number;
    allowedOperations?: string[];
    timeLockPeriod?: number;
  };
  recovery?: {
    enabled?: boolean;
    method?: 'SOCIAL_RECOVERY' | 'BACKUP_SIGNATURES' | 'TIME_DELAY';
    recoverySigners?: Array<{
      address: string;
      name: string;
      trusted?: boolean;
    }>;
  };
}

export interface CreateSignatureRequest {
  walletId: string;
  type: 'PROOF_CREATION' | 'PROOF_VERIFICATION' | 'CONTRACT_INTERACTION' | 'TOKEN_TRANSFER' | 'CONFIG_CHANGE' | 'SIGNER_MANAGEMENT' | 'EMERGENCY_ACTIONS';
  title: string;
  description: string;
  payload: any;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  expiresIn?: number; // in hours
  createdBy: string;
  ipAddress: string;
  userAgent: string;
  relatedProofId?: string;
  relatedContractAddress?: string;
}

export class MultiSigService {
  private stellarServer: Server;
  
  constructor() {
    // Initialize Stellar server for testnet by default
    this.stellarServer = new Server('https://horizon-testnet.stellar.org');
  }

  /**
   * Create a new multi-signature wallet
   */
  async createWallet(request: CreateWalletRequest): Promise<IMultiSigWallet> {
    try {
      // Validate request
      this.validateCreateWalletRequest(request);

      // Generate unique wallet ID
      const walletId = this.generateWalletId();

      // Create wallet document
      const wallet = new MultiSigWallet({
        walletId,
        name: request.name,
        description: request.description,
        config: {
          threshold: request.threshold,
          signers: request.signers.map(signer => ({
            ...signer,
            weight: signer.weight || 1,
            active: true,
            addedAt: new Date()
          })),
          maxSigners: 10,
          allowSignerRemoval: true,
          requireAllForCritical: false
        },
        state: {
          isActive: true,
          isFrozen: false,
          network: request.network
        },
        security: {
          dailyLimit: request.security?.dailyLimit || 1000000,
          singleTransactionLimit: request.security?.singleTransactionLimit || 100000,
          requireConfirmation: true,
          allowedOperations: request.security?.allowedOperations || [
            'PROOF_CREATION',
            'PROOF_VERIFICATION',
            'CONTRACT_INTERACTION',
            'TOKEN_TRANSFER'
          ],
          timeLockPeriod: request.security?.timeLockPeriod || 3600,
          autoRecoveryEnabled: false
        },
        recovery: {
          enabled: request.recovery?.enabled || false,
          method: request.recovery?.method || 'SOCIAL_RECOVERY',
          recoverySigners: request.recovery?.recoverySigners || [],
          recoveryThreshold: 2,
          recoveryPeriod: 168
        },
        metadata: {
          createdBy: request.createdBy,
          createdAt: new Date(),
          lastModified: new Date(),
          lastModifiedBy: request.createdBy,
          version: 1,
          tags: []
        },
        stats: {
          totalTransactions: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          pendingSignatures: 0,
          averageConfirmationTime: 0
        }
      });

      // Validate threshold
      if (!wallet.isValidThreshold()) {
        throw new Error('Invalid threshold: must be between 1 and number of active signers');
      }

      // Save wallet
      await wallet.save();

      // If Stellar network, create multi-signature account
      if (request.network === 'STELLAR') {
        await this.createStellarMultiSigAccount(wallet);
      }

      logger.info(`Multi-sig wallet created: ${walletId}`);
      return wallet;

    } catch (error) {
      logger.error('Error creating multi-sig wallet:', error);
      throw error;
    }
  }

  /**
   * Create a signature request
   */
  async createSignatureRequest(request: CreateSignatureRequest): Promise<ISignatureRequest> {
    try {
      // Validate request
      await this.validateSignatureRequest(request);

      // Get wallet
      const wallet = await MultiSigWallet.findOne({ 
        walletId: request.walletId,
        'state.isActive': true,
        'state.isFrozen': false
      });

      if (!wallet) {
        throw new Error('Wallet not found or inactive');
      }

      // Generate request ID and security data
      const requestId = this.generateRequestId();
      const nonce = crypto.randomBytes(32).toString('hex');
      const hash = this.calculateRequestHash(request.payload, nonce);

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (request.expiresIn || 24));

      // Get required weight from wallet
      const requiredWeight = this.calculateRequiredWeight(wallet, request.type);

      // Create signature request
      const signatureRequest = new SignatureRequest({
        requestId,
        walletId: request.walletId,
        request: {
          type: request.type,
          title: request.title,
          description: request.description,
          payload: request.payload,
          priority: request.priority || 'MEDIUM'
        },
        signatures: [],
        status: 'PENDING',
        timing: {
          createdAt: new Date(),
          expiresAt
        },
        threshold: {
          required: wallet.config.threshold,
          currentWeight: 0,
          requiredWeight,
          isMet: false
        },
        security: {
          nonce,
          hash,
          requiresConfirmation: request.type === 'CONFIG_CHANGE' || request.type === 'SIGNER_MANAGEMENT',
          confirmed: false
        },
        notifications: {
          sent: false,
          channels: ['EMAIL', 'IN_APP'],
          reminderCount: 0
        },
        metadata: {
          createdBy: request.createdBy,
          relatedProofId: request.relatedProofId,
          relatedContractAddress: request.relatedContractAddress,
          tags: []
        },
        audit: {
          createdAt: new Date(),
          createdBy: request.createdBy,
          lastModified: new Date(),
          lastModifiedBy: request.createdBy,
          version: 1,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent
        }
      });

      await signatureRequest.save();

      // Update wallet stats
      wallet.stats.pendingSignatures += 1;
      await wallet.save();

      logger.info(`Signature request created: ${requestId} for wallet: ${request.walletId}`);
      return signatureRequest;

    } catch (error) {
      logger.error('Error creating signature request:', error);
      throw error;
    }
  }

  /**
   * Add signature to a request
   */
  async addSignature(
    requestId: string, 
    signerAddress: string, 
    signature: string,
    metadata?: {
      userAgent?: string;
      ipAddress?: string;
      deviceInfo?: string;
    }
  ): Promise<ISignatureRequest> {
    try {
      // Get signature request
      const signatureRequest = await SignatureRequest.findOne({ requestId });
      if (!signatureRequest) {
        throw new Error('Signature request not found');
      }

      // Validate signer
      const wallet = await MultiSigWallet.findOne({ walletId: signatureRequest.walletId });
      if (!wallet) {
        throw new Error('Associated wallet not found');
      }

      const signer = wallet.getSignerByAddress(signerAddress);
      if (!signer) {
        throw new Error('Signer not found or inactive');
      }

      // Check if can sign
      if (!signatureRequest.canSign(signerAddress)) {
        throw new Error('Cannot sign: request not in signable state');
      }

      // Verify signature
      const isValidSignature = await this.verifySignature(
        signatureRequest.security.hash,
        signature,
        signerAddress
      );

      if (!isValidSignature) {
        throw new Error('Invalid signature');
      }

      // Add signature
      await signatureRequest.addSignature(signerAddress, signature, signer.weight, metadata);

      // Update wallet stats if threshold met
      if (signatureRequest.threshold.isMet) {
        wallet.stats.pendingSignatures = Math.max(0, wallet.stats.pendingSignatures - 1);
        await wallet.save();
      }

      logger.info(`Signature added to request ${requestId} by ${signerAddress}`);
      return signatureRequest;

    } catch (error) {
      logger.error('Error adding signature:', error);
      throw error;
    }
  }

  /**
   * Execute an approved signature request
   */
  async executeRequest(requestId: string): Promise<ISignatureRequest> {
    try {
      const signatureRequest = await SignatureRequest.findOne({ requestId });
      if (!signatureRequest) {
        throw new Error('Signature request not found');
      }

      if (signatureRequest.status !== 'APPROVED') {
        throw new Error('Request not approved for execution');
      }

      if (signatureRequest.isExpired()) {
        throw new Error('Request has expired');
      }

      const wallet = await MultiSigWallet.findOne({ walletId: signatureRequest.walletId });
      if (!wallet) {
        throw new Error('Associated wallet not found');
      }

      // Execute based on request type
      let executionResult;
      switch (signatureRequest.request.type) {
        case 'PROOF_CREATION':
          executionResult = await this.executeProofCreation(signatureRequest, wallet);
          break;
        case 'PROOF_VERIFICATION':
          executionResult = await this.executeProofVerification(signatureRequest, wallet);
          break;
        case 'CONTRACT_INTERACTION':
          executionResult = await this.executeContractInteraction(signatureRequest, wallet);
          break;
        case 'TOKEN_TRANSFER':
          executionResult = await this.executeTokenTransfer(signatureRequest, wallet);
          break;
        case 'CONFIG_CHANGE':
          executionResult = await this.executeConfigChange(signatureRequest, wallet);
          break;
        case 'SIGNER_MANAGEMENT':
          executionResult = await this.executeSignerManagement(signatureRequest, wallet);
          break;
        case 'EMERGENCY_ACTIONS':
          executionResult = await this.executeEmergencyActions(signatureRequest, wallet);
          break;
        default:
          throw new Error('Unknown request type');
      }

      // Update request with execution result
      signatureRequest.execution = executionResult;
      signatureRequest.status = executionResult.success ? 'EXECUTED' : 'FAILED';
      signatureRequest.timing.executedAt = new Date();
      signatureRequest.timing.timeToExecution = 
        signatureRequest.timing.executedAt.getTime() - signatureRequest.timing.createdAt.getTime();

      await signatureRequest.save();

      // Update wallet stats
      if (executionResult.success) {
        wallet.stats.successfulTransactions += 1;
      } else {
        wallet.stats.failedTransactions += 1;
      }
      wallet.stats.totalTransactions += 1;
      await wallet.save();

      logger.info(`Request ${requestId} executed with status: ${signatureRequest.status}`);
      return signatureRequest;

    } catch (error) {
      logger.error('Error executing request:', error);
      throw error;
    }
  }

  // Private helper methods

  private validateCreateWalletRequest(request: CreateWalletRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Wallet name is required');
    }

    if (!request.signers || request.signers.length < 2) {
      throw new Error('At least 2 signers are required');
    }

    if (request.threshold < 1 || request.threshold > request.signers.length) {
      throw new Error('Threshold must be between 1 and number of signers');
    }

    // Validate signer addresses
    for (const signer of request.signers) {
      if (!signer.address || !signer.name) {
        throw new Error('Signer address and name are required');
      }
    }
  }

  private async validateSignatureRequest(request: CreateSignatureRequest): Promise<void> {
    if (!request.title || request.title.trim().length === 0) {
      throw new Error('Request title is required');
    }

    if (!request.description || request.description.trim().length === 0) {
      throw new Error('Request description is required');
    }

    if (!request.payload) {
      throw new Error('Request payload is required');
    }
  }

  private generateWalletId(): string {
    return `wallet_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private calculateRequestHash(payload: any, nonce: string): string {
    const data = JSON.stringify(payload) + nonce;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateRequiredWeight(wallet: IMultiSigWallet, requestType: string): number {
    // For critical operations, require all signers
    if (wallet.config.requireAllForCritical && 
        (requestType === 'CONFIG_CHANGE' || requestType === 'SIGNER_MANAGEMENT')) {
      return wallet.calculateTotalWeight();
    }

    // Otherwise use standard threshold
    return wallet.config.threshold;
  }

  private async verifySignature(hash: string, signature: string, signerAddress: string): Promise<boolean> {
    // Implement signature verification based on network
    // This is a placeholder - actual implementation would depend on the cryptographic scheme
    try {
      if (signerAddress.startsWith('G')) { // Stellar address
        return this.verifyStellarSignature(hash, signature, signerAddress);
      } else if (signerAddress.startsWith('0x')) { // Ethereum address
        return this.verifyEthereumSignature(hash, signature, signerAddress);
      }
      return false;
    } catch (error) {
      logger.error('Signature verification error:', error);
      return false;
    }
  }

  private verifyStellarSignature(hash: string, signature: string, signerAddress: string): boolean {
    // Implement Stellar signature verification
    // This is a placeholder - actual implementation would use Stellar SDK
    return true; // Placeholder
  }

  private verifyEthereumSignature(hash: string, signature: string, signerAddress: string): boolean {
    // Implement Ethereum signature verification
    // This is a placeholder - actual implementation would use ethers.js or similar
    return true; // Placeholder
  }

  private async createStellarMultiSigAccount(wallet: IMultiSigWallet): Promise<void> {
    // Implement Stellar multi-sig account creation
    // This is a placeholder - actual implementation would create and fund the account
    logger.info(`Creating Stellar multi-sig account for wallet: ${wallet.walletId}`);
  }

  private async executeProofCreation(request: ISignatureRequest, wallet: IMultiSigWallet): Promise<any> {
    // Implement proof creation execution
    return { success: true, transactionHash: '0x...' };
  }

  private async executeProofVerification(request: ISignatureRequest, wallet: IMultiSigWallet): Promise<any> {
    // Implement proof verification execution
    return { success: true, transactionHash: '0x...' };
  }

  private async executeContractInteraction(request: ISignatureRequest, wallet: IMultiSigWallet): Promise<any> {
    // Implement contract interaction execution
    return { success: true, transactionHash: '0x...' };
  }

  private async executeTokenTransfer(request: ISignatureRequest, wallet: IMultiSigWallet): Promise<any> {
    // Implement token transfer execution
    return { success: true, transactionHash: '0x...' };
  }

  private async executeConfigChange(request: ISignatureRequest, wallet: IMultiSigWallet): Promise<any> {
    // Implement config change execution
    return { success: true, transactionHash: '0x...' };
  }

  private async executeSignerManagement(request: ISignatureRequest, wallet: IMultiSigWallet): Promise<any> {
    // Implement signer management execution
    return { success: true, transactionHash: '0x...' };
  }

  private async executeEmergencyActions(request: ISignatureRequest, wallet: IMultiSigWallet): Promise<any> {
    // Implement emergency actions execution
    return { success: true, transactionHash: '0x...' };
  }
}
