import { MultiSigService, CreateSignatureRequest } from './multisig/MultiSigService';
import { SignatureService } from './multisig/SignatureService';
import MediaProof, { IMediaProof } from '../models/MediaProof';
import MultiSigWallet, { IMultiSigWallet } from '../models/MultiSigWallet';
import SignatureRequest, { ISignatureRequest } from '../models/SignatureRequest';
import { logger } from '../utils/logger';

export interface ProofCreationRequest {
  proofData: {
    type: 'VIDEO' | 'AUDIO' | 'STREAM';
    mediaMetadata: any;
    storage: any;
    compression?: any;
    voiceBiometrics?: any;
    authenticity: any;
    watermark?: any;
    accessControl?: any;
  };
  walletId: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  expiresIn?: number;
  createdBy: string;
  ipAddress: string;
  userAgent: string;
}

export interface ProofVerificationRequest {
  proofId: string;
  verificationData: {
    facialRecognition?: any;
    voiceMatch?: any;
    livenessDetection?: any;
    additionalChecks?: any;
  };
  walletId: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  expiresIn?: number;
  createdBy: string;
  ipAddress: string;
  userAgent: string;
}

export interface ProofOperationResult {
  success: boolean;
  proofId?: string;
  requestId?: string;
  transactionHash?: string;
  error?: string;
  metadata?: any;
}

export class ProofMultiSigIntegration {
  private multiSigService: MultiSigService;
  private signatureService: SignatureService;

  constructor() {
    this.multiSigService = new MultiSigService();
    this.signatureService = new SignatureService();
  }

  /**
   * Create a new proof with multi-signature approval
   */
  async createProofWithMultiSig(request: ProofCreationRequest): Promise<ProofOperationResult> {
    try {
      // Validate wallet exists and is active
      const wallet = await MultiSigWallet.findOne({ 
        walletId: request.walletId,
        'state.isActive': true,
        'state.isFrozen': false
      });

      if (!wallet) {
        return {
          success: false,
          error: 'Wallet not found or inactive'
        };
      }

      // Check if proof creation is allowed
      if (!wallet.security.allowedOperations.includes('PROOF_CREATION')) {
        return {
          success: false,
          error: 'Proof creation not allowed for this wallet'
        };
      }

      // Generate proof ID
      const proofId = this.generateProofId();

      // Create signature request for proof creation
      const signatureRequest: CreateSignatureRequest = {
        walletId: request.walletId,
        type: 'PROOF_CREATION',
        title: `Create Proof: ${request.proofData.type}`,
        description: `Multi-signature approval required for creating ${request.proofData.type.toLowerCase()} proof`,
        payload: {
          proofId,
          proofData: request.proofData,
          operation: 'CREATE_PROOF',
          timestamp: new Date().toISOString()
        },
        priority: request.priority || 'MEDIUM',
        expiresIn: request.expiresIn || 24,
        createdBy: request.createdBy,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        relatedProofId: proofId
      };

      const signatureReq = await this.multiSigService.createSignatureRequest(signatureRequest);

      logger.info(`Proof creation signature request created: ${signatureReq.requestId} for proof: ${proofId}`);

      return {
        success: true,
        proofId,
        requestId: signatureReq.requestId,
        metadata: {
          status: 'PENDING_SIGNATURES',
          threshold: signatureReq.threshold,
          expiresAt: signatureReq.timing.expiresAt
        }
      };

    } catch (error) {
      logger.error('Error creating proof with multi-sig:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify a proof with multi-signature approval
   */
  async verifyProofWithMultiSig(request: ProofVerificationRequest): Promise<ProofOperationResult> {
    try {
      // Check if proof exists
      const proof = await MediaProof.findOne({ proofId: request.proofId });
      if (!proof) {
        return {
          success: false,
          error: 'Proof not found'
        };
      }

      // Validate wallet exists and is active
      const wallet = await MultiSigWallet.findOne({ 
        walletId: request.walletId,
        'state.isActive': true,
        'state.isFrozen': false
      });

      if (!wallet) {
        return {
          success: false,
          error: 'Wallet not found or inactive'
        };
      }

      // Check if proof verification is allowed
      if (!wallet.security.allowedOperations.includes('PROOF_VERIFICATION')) {
        return {
          success: false,
          error: 'Proof verification not allowed for this wallet'
        };
      }

      // Create signature request for proof verification
      const signatureRequest: CreateSignatureRequest = {
        walletId: request.walletId,
        type: 'PROOF_VERIFICATION',
        title: `Verify Proof: ${request.proofId}`,
        description: `Multi-signature approval required for verifying proof ${request.proofId}`,
        payload: {
          proofId: request.proofId,
          verificationData: request.verificationData,
          operation: 'VERIFY_PROOF',
          timestamp: new Date().toISOString()
        },
        priority: request.priority || 'HIGH',
        expiresIn: request.expiresIn || 12,
        createdBy: request.createdBy,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        relatedProofId: request.proofId
      };

      const signatureReq = await this.multiSigService.createSignatureRequest(signatureRequest);

      logger.info(`Proof verification signature request created: ${signatureReq.requestId} for proof: ${request.proofId}`);

      return {
        success: true,
        requestId: signatureReq.requestId,
        metadata: {
          status: 'PENDING_SIGNATURES',
          threshold: signatureReq.threshold,
          expiresAt: signatureReq.timing.expiresAt
        }
      };

    } catch (error) {
      logger.error('Error verifying proof with multi-sig:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a proof creation after multi-sig approval
   */
  async executeProofCreation(requestId: string): Promise<ProofOperationResult> {
    try {
      // Get the signature request
      const signatureRequest = await SignatureRequest.findOne({ requestId });
      if (!signatureRequest || signatureRequest.status !== 'APPROVED') {
        return {
          success: false,
          error: 'Signature request not found or not approved'
        };
      }

      const payload = signatureRequest.request.payload;
      const proofId = payload.proofId;
      const proofData = payload.proofData;

      // Create the actual proof
      const proof = new MediaProof({
        proofId,
        type: proofData.type,
        ownerId: signatureRequest.metadata.createdBy,
        status: 'PENDING',
        mediaMetadata: proofData.mediaMetadata,
        storage: proofData.storage,
        compression: proofData.compression || {
          enabled: true,
          algorithm: 'H264',
          originalSize: proofData.mediaMetadata.size,
          quality: 0.8
        },
        voiceBiometrics: proofData.voiceBiometrics,
        authenticity: proofData.authenticity,
        watermark: proofData.watermark,
        accessControl: proofData.accessControl || {
          isPublic: false,
          allowedUsers: [],
          downloadAllowed: false,
          currentViews: 0
        }
      });

      await proof.save();

      // Execute the signature request
      const executedRequest = await this.multiSigService.executeRequest(requestId);

      logger.info(`Proof creation executed: ${proofId} via request: ${requestId}`);

      return {
        success: true,
        proofId,
        requestId,
        transactionHash: executedRequest.execution?.transactionHash,
        metadata: {
          status: 'CREATED',
          proofType: proofData.type,
          createdAt: proof.createdAt
        }
      };

    } catch (error) {
      logger.error('Error executing proof creation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a proof verification after multi-sig approval
   */
  async executeProofVerification(requestId: string): Promise<ProofOperationResult> {
    try {
      // Get the signature request
      const signatureRequest = await SignatureRequest.findOne({ requestId });
      if (!signatureRequest || signatureRequest.status !== 'APPROVED') {
        return {
          success: false,
          error: 'Signature request not found or not approved'
        };
      }

      const payload = signatureRequest.request.payload;
      const proofId = payload.proofId;
      const verificationData = payload.verificationData;

      // Get the proof
      const proof = await MediaProof.findOne({ proofId });
      if (!proof) {
        return {
          success: false,
          error: 'Proof not found'
        };
      }

      // Update proof with verification results
      proof.verificationResults = {
        facialRecognition: verificationData.facialRecognition,
        voiceMatch: verificationData.voiceMatch,
        livenessDetection: verificationData.livenessDetection
      };

      proof.status = 'VERIFIED';
      proof.processedAt = new Date();

      await proof.save();

      // Execute the signature request
      const executedRequest = await this.multiSigService.executeRequest(requestId);

      logger.info(`Proof verification executed: ${proofId} via request: ${requestId}`);

      return {
        success: true,
        proofId,
        requestId,
        transactionHash: executedRequest.execution?.transactionHash,
        metadata: {
          status: 'VERIFIED',
          verificationResults: proof.verificationResults,
          verifiedAt: proof.processedAt
        }
      };

    } catch (error) {
      logger.error('Error executing proof verification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get proof operations requiring multi-sig approval
   */
  async getPendingProofOperations(walletId: string): Promise<{
    proofCreations: ISignatureRequest[];
    proofVerifications: ISignatureRequest[];
  }> {
    try {
      const pendingRequests = await SignatureRequest.find({
        walletId,
        status: 'PENDING',
        $or: [
          { 'request.type': 'PROOF_CREATION' },
          { 'request.type': 'PROOF_VERIFICATION' }
        ]
      }).sort({ 'timing.createdAt': -1 });

      const proofCreations = pendingRequests.filter(req => req.request.type === 'PROOF_CREATION');
      const proofVerifications = pendingRequests.filter(req => req.request.type === 'PROOF_VERIFICATION');

      return {
        proofCreations,
        proofVerifications
      };

    } catch (error) {
      logger.error('Error getting pending proof operations:', error);
      return {
        proofCreations: [],
        proofVerifications: []
      };
    }
  }

  /**
   * Get proof operation history for a wallet
   */
  async getProofOperationHistory(walletId: string, options?: {
    page?: number;
    limit?: number;
    operationType?: 'PROOF_CREATION' | 'PROOF_VERIFICATION';
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    operations: ISignatureRequest[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 10;
      const skip = (page - 1) * limit;

      const query: any = {
        walletId,
        $or: [
          { 'request.type': 'PROOF_CREATION' },
          { 'request.type': 'PROOF_VERIFICATION' }
        ]
      };

      if (options?.operationType) {
        query['request.type'] = options.operationType;
      }

      if (options?.status) {
        query.status = options.status;
      }

      if (options?.startDate || options?.endDate) {
        query['timing.createdAt'] = {};
        if (options.startDate) {
          query['timing.createdAt'].$gte = options.startDate;
        }
        if (options.endDate) {
          query['timing.createdAt'].$lte = options.endDate;
        }
      }

      const [operations, total] = await Promise.all([
        SignatureRequest.find(query)
          .sort({ 'timing.createdAt': -1 })
          .skip(skip)
          .limit(limit),
        SignatureRequest.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        operations,
        total,
        page,
        totalPages
      };

    } catch (error) {
      logger.error('Error getting proof operation history:', error);
      return {
        operations: [],
        total: 0,
        page: 1,
        totalPages: 0
      };
    }
  }

  /**
   * Validate proof operation against wallet security policies
   */
  async validateProofOperation(
    walletId: string, 
    operationType: 'PROOF_CREATION' | 'PROOF_VERIFICATION',
    proofData?: any
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const wallet = await MultiSigWallet.findOne({ walletId });
      if (!wallet) {
        return {
          isValid: false,
          errors: ['Wallet not found'],
          warnings: []
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // Check if operation is allowed
      if (!wallet.security.allowedOperations.includes(operationType)) {
        errors.push(`${operationType} not allowed for this wallet`);
      }

      // Check wallet state
      if (!wallet.state.isActive) {
        errors.push('Wallet is not active');
      }

      if (wallet.state.isFrozen) {
        errors.push('Wallet is frozen');
      }

      // Check daily limits if applicable
      if (operationType === 'PROOF_CREATION' && proofData) {
        const estimatedValue = this.estimateProofValue(proofData);
        if (estimatedValue > wallet.security.singleTransactionLimit) {
          errors.push('Proof exceeds single transaction limit');
        }

        if (wallet.stats.totalTransactions >= 100) { // Arbitrary daily limit
          warnings.push('Approaching daily transaction limit');
        }
      }

      // Check signer availability
      const activeSigners = wallet.config.signers.filter(s => s.active);
      if (activeSigners.length < wallet.config.threshold) {
        errors.push('Not enough active signers to meet threshold');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Error validating proof operation:', error);
      return {
        isValid: false,
        errors: ['Validation failed due to server error'],
        warnings: []
      };
    }
  }

  /**
   * Get analytics for proof operations
   */
  async getProofOperationAnalytics(walletId: string): Promise<{
    totalOperations: number;
    creationOperations: number;
    verificationOperations: number;
    successRate: number;
    averageConfirmationTime: number;
    operationBreakdown: {
      byType: Record<string, number>;
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
    };
    signerParticipation: Array<{
      signerAddress: string;
      signerName: string;
      operationsParticipated: number;
      participationRate: number;
    }>;
  }> {
    try {
      const operations = await SignatureRequest.find({
        walletId,
        $or: [
          { 'request.type': 'PROOF_CREATION' },
          { 'request.type': 'PROOF_VERIFICATION' }
        ]
      });

      const totalOperations = operations.length;
      const creationOperations = operations.filter(op => op.request.type === 'PROOF_CREATION').length;
      const verificationOperations = operations.filter(op => op.request.type === 'PROOF_VERIFICATION').length;
      const successfulOperations = operations.filter(op => op.status === 'EXECUTED').length;
      const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;

      const executedOperations = operations.filter(op => op.timing.timeToExecution);
      const averageConfirmationTime = executedOperations.length > 0
        ? executedOperations.reduce((sum, op) => sum + (op.timing.timeToExecution || 0), 0) / executedOperations.length
        : 0;

      // Operation breakdown
      const operationBreakdown = {
        byType: {
          'PROOF_CREATION': creationOperations,
          'PROOF_VERIFICATION': verificationOperations
        },
        byStatus: operations.reduce((acc, op) => {
          acc[op.status] = (acc[op.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byPriority: operations.reduce((acc, op) => {
          acc[op.request.priority] = (acc[op.request.priority] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      // Get wallet for signer info
      const wallet = await MultiSigWallet.findOne({ walletId });
      const signerParticipation = wallet?.config.signers.map(signer => {
        const participatedOperations = operations.filter(op => 
          op.signatures.some(sig => sig.signerAddress === signer.address)
        ).length;

        return {
          signerAddress: signer.address,
          signerName: signer.name,
          operationsParticipated: participatedOperations,
          participationRate: totalOperations > 0 ? (participatedOperations / totalOperations) * 100 : 0
        };
      }) || [];

      return {
        totalOperations,
        creationOperations,
        verificationOperations,
        successRate,
        averageConfirmationTime,
        operationBreakdown,
        signerParticipation
      };

    } catch (error) {
      logger.error('Error getting proof operation analytics:', error);
      return {
        totalOperations: 0,
        creationOperations: 0,
        verificationOperations: 0,
        successRate: 0,
        averageConfirmationTime: 0,
        operationBreakdown: {
          byType: {},
          byStatus: {},
          byPriority: {}
        },
        signerParticipation: []
      };
    }
  }

  // Private helper methods

  private generateProofId(): string {
    return `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateProofValue(proofData: any): number {
    // Simple estimation based on file size and complexity
    const baseValue = 100; // Base value in smallest unit
    const sizeMultiplier = (proofData.mediaMetadata?.size || 0) / 1000000; // Per MB
    const complexityMultiplier = proofData.voiceBiometrics ? 1.5 : 1.0;
    
    return Math.floor(baseValue * sizeMultiplier * complexityMultiplier);
  }
}
