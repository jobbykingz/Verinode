import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { MultiSigService, CreateWalletRequest, CreateSignatureRequest } from '../services/multisig/MultiSigService';
import { SignatureService } from '../services/multisig/SignatureService';
import { logger } from '../utils/logger';

export class MultiSigController {
  private multiSigService: MultiSigService;
  private signatureService: SignatureService;

  constructor() {
    this.multiSigService = new MultiSigService();
    this.signatureService = new SignatureService();
  }

  /**
   * Create a new multi-signature wallet
   */
  createWallet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const walletRequest: CreateWalletRequest = {
        name: req.body.name,
        description: req.body.description,
        network: req.body.network,
        threshold: req.body.threshold,
        signers: req.body.signers,
        createdBy: req.user?.id || 'anonymous',
        security: req.body.security,
        recovery: req.body.recovery
      };

      const wallet = await this.multiSigService.createWallet(walletRequest);

      res.status(201).json({
        success: true,
        data: {
          walletId: wallet.walletId,
          name: wallet.name,
          network: wallet.state.network,
          threshold: wallet.config.threshold,
          signers: wallet.config.signers,
          createdAt: wallet.metadata.createdAt
        },
        message: 'Multi-signature wallet created successfully'
      });

    } catch (error) {
      logger.error('Error in createWallet controller:', error);
      next(error);
    }
  };

  /**
   * Get wallet details
   */
  getWallet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { walletId } = req.params;
      const wallet = await this.multiSigService.getWallet(walletId);

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }

      res.json({
        success: true,
        data: wallet
      });

    } catch (error) {
      logger.error('Error in getWallet controller:', error);
      next(error);
    }
  };

  /**
   * List wallets for a user
   */
  listWallets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || 'anonymous';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const network = req.query.network as string;

      const wallets = await this.multiSigService.listWallets(userId, {
        page,
        limit,
        network
      });

      res.json({
        success: true,
        data: wallets.wallets,
        pagination: {
          page: wallets.page,
          limit: wallets.limit,
          total: wallets.total,
          pages: wallets.pages
        }
      });

    } catch (error) {
      logger.error('Error in listWallets controller:', error);
      next(error);
    }
  };

  /**
   * Create a signature request
   */
  createSignatureRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const signatureRequest: CreateSignatureRequest = {
        walletId: req.body.walletId,
        type: req.body.type,
        title: req.body.title,
        description: req.body.description,
        payload: req.body.payload,
        priority: req.body.priority,
        expiresIn: req.body.expiresIn,
        createdBy: req.user?.id || 'anonymous',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        relatedProofId: req.body.relatedProofId,
        relatedContractAddress: req.body.relatedContractAddress
      };

      const request = await this.multiSigService.createSignatureRequest(signatureRequest);

      res.status(201).json({
        success: true,
        data: {
          requestId: request.requestId,
          walletId: request.walletId,
          type: request.request.type,
          title: request.request.title,
          status: request.status,
          threshold: request.threshold,
          timing: request.timing,
          createdAt: request.timing.createdAt
        },
        message: 'Signature request created successfully'
      });

    } catch (error) {
      logger.error('Error in createSignatureRequest controller:', error);
      next(error);
    }
  };

  /**
   * Get signature request details
   */
  getSignatureRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { requestId } = req.params;
      const request = await this.multiSigService.getSignatureRequest(requestId);

      if (!request) {
        return res.status(404).json({
          success: false,
          error: 'Signature request not found'
        });
      }

      res.json({
        success: true,
        data: request
      });

    } catch (error) {
      logger.error('Error in getSignatureRequest controller:', error);
      next(error);
    }
  };

  /**
   * List signature requests for a wallet
   */
  listSignatureRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { walletId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const type = req.query.type as string;

      const requests = await this.multiSigService.listSignatureRequests(walletId, {
        page,
        limit,
        status,
        type
      });

      res.json({
        success: true,
        data: requests.requests,
        pagination: {
          page: requests.page,
          limit: requests.limit,
          total: requests.total,
          pages: requests.pages
        }
      });

    } catch (error) {
      logger.error('Error in listSignatureRequests controller:', error);
      next(error);
    }
  };

  /**
   * Add signature to a request
   */
  addSignature = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { requestId } = req.params;
      const { signerAddress, signature } = req.body;

      const request = await this.multiSigService.addSignature(
        requestId,
        signerAddress,
        signature,
        {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          deviceInfo: req.body.deviceInfo
        }
      );

      res.json({
        success: true,
        data: {
          requestId: request.requestId,
          status: request.status,
          threshold: request.threshold,
          signatures: request.signatures,
          timing: request.timing
        },
        message: 'Signature added successfully'
      });

    } catch (error) {
      logger.error('Error in addSignature controller:', error);
      next(error);
    }
  };

  /**
   * Execute an approved signature request
   */
  executeRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { requestId } = req.params;
      const request = await this.multiSigService.executeRequest(requestId);

      res.json({
        success: true,
        data: {
          requestId: request.requestId,
          status: request.status,
          execution: request.execution,
          timing: request.timing
        },
        message: 'Request executed successfully'
      });

    } catch (error) {
      logger.error('Error in executeRequest controller:', error);
      next(error);
    }
  };

  /**
   * Get signature statistics for a wallet
   */
  getSignatureStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { walletId } = req.params;
      const stats = await this.signatureService.getSignatureStats(walletId);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error in getSignatureStats controller:', error);
      next(error);
    }
  };

  /**
   * Detect suspicious signature patterns
   */
  detectSuspiciousPatterns = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { walletId } = req.params;
      const patterns = await this.signatureService.detectSuspiciousPatterns(walletId);

      res.json({
        success: true,
        data: patterns
      });

    } catch (error) {
      logger.error('Error in detectSuspiciousPatterns controller:', error);
      next(error);
    }
  };

  /**
   * Generate signature challenge
   */
  generateChallenge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { requestId } = req.params;
      const { signerAddress } = req.body;

      const challenge = await this.signatureService.generateSignatureChallenge(
        requestId,
        signerAddress,
        {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        }
      );

      res.json({
        success: true,
        data: challenge,
        message: 'Challenge generated successfully'
      });

    } catch (error) {
      logger.error('Error in generateChallenge controller:', error);
      next(error);
    }
  };

  /**
   * Verify challenge signature
   */
  verifyChallenge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { requestId } = req.params;
      const { signerAddress, challengeSignature } = req.body;

      const isValid = await this.signatureService.verifyChallengeSignature(
        requestId,
        signerAddress,
        challengeSignature
      );

      res.json({
        success: true,
        data: { isValid },
        message: isValid ? 'Challenge verified successfully' : 'Challenge verification failed'
      });

    } catch (error) {
      logger.error('Error in verifyChallenge controller:', error);
      next(error);
    }
  };

  /**
   * Update wallet configuration
   */
  updateWalletConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { walletId } = req.params;
      const updates = req.body;

      const wallet = await this.multiSigService.updateWalletConfig(walletId, updates, req.user?.id);

      res.json({
        success: true,
        data: wallet,
        message: 'Wallet configuration updated successfully'
      });

    } catch (error) {
      logger.error('Error in updateWalletConfig controller:', error);
      next(error);
    }
  };

  /**
   * Add or remove signers from wallet
   */
  manageSigners = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { walletId } = req.params;
      const { action, signers } = req.body;

      const wallet = await this.multiSigService.manageSigners(walletId, action, signers, req.user?.id);

      res.json({
        success: true,
        data: wallet,
        message: `Signers ${action}d successfully`
      });

    } catch (error) {
      logger.error('Error in manageSigners controller:', error);
      next(error);
    }
  };

  /**
   * Freeze or unfreeze wallet
   */
  freezeWallet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { walletId } = req.params;
      const { freeze, reason } = req.body;

      const wallet = await this.multiSigService.freezeWallet(walletId, freeze, reason, req.user?.id);

      res.json({
        success: true,
        data: {
          walletId: wallet.walletId,
          isFrozen: wallet.state.isFrozen,
          frozenBy: wallet.state.frozenBy,
          frozenAt: wallet.state.frozenAt,
          freezeReason: wallet.state.freezeReason
        },
        message: `Wallet ${freeze ? 'frozen' : 'unfrozen'} successfully`
      });

    } catch (error) {
      logger.error('Error in freezeWallet controller:', error);
      next(error);
    }
  };
}

// Validation middleware
export const validateCreateWallet = [
  body('name').notEmpty().withMessage('Wallet name is required'),
  body('network').isIn(['STELLAR', 'ETHEREUM', 'POLYGON']).withMessage('Invalid network'),
  body('threshold').isInt({ min: 1 }).withMessage('Threshold must be at least 1'),
  body('signers').isArray({ min: 2 }).withMessage('At least 2 signers are required'),
  body('signers.*.address').notEmpty().withMessage('Signer address is required'),
  body('signers.*.name').notEmpty().withMessage('Signer name is required'),
  body('signers.*.role').isIn(['OWNER', 'ADMIN', 'SIGNER']).withMessage('Invalid signer role')
];

export const validateCreateSignatureRequest = [
  body('walletId').notEmpty().withMessage('Wallet ID is required'),
  body('type').isIn(['PROOF_CREATION', 'PROOF_VERIFICATION', 'CONTRACT_INTERACTION', 'TOKEN_TRANSFER', 'CONFIG_CHANGE', 'SIGNER_MANAGEMENT', 'EMERGENCY_ACTIONS']).withMessage('Invalid request type'),
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('payload').notEmpty().withMessage('Payload is required'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Invalid priority'),
  body('expiresIn').optional().isInt({ min: 1, max: 168 }).withMessage('Expiration must be between 1 and 168 hours')
];

export const validateAddSignature = [
  body('signerAddress').notEmpty().withMessage('Signer address is required'),
  body('signature').notEmpty().withMessage('Signature is required')
];

export const validateGenerateChallenge = [
  body('signerAddress').notEmpty().withMessage('Signer address is required')
];

export const validateVerifyChallenge = [
  body('signerAddress').notEmpty().withMessage('Signer address is required'),
  body('challengeSignature').notEmpty().withMessage('Challenge signature is required')
];

export const validateUpdateWalletConfig = [
  body('threshold').optional().isInt({ min: 1 }).withMessage('Threshold must be at least 1'),
  body('security.dailyLimit').optional().isInt({ min: 0 }).withMessage('Daily limit must be non-negative'),
  body('security.singleTransactionLimit').optional().isInt({ min: 0 }).withMessage('Single transaction limit must be non-negative')
];

export const validateManageSigners = [
  body('action').isIn(['add', 'remove']).withMessage('Action must be add or remove'),
  body('signers').isArray().withMessage('Signers array is required'),
  body('signers.*.address').notEmpty().withMessage('Signer address is required'),
  body('signers.*.name').notEmpty().withMessage('Signer name is required')
];

export const validateFreezeWallet = [
  body('freeze').isBoolean().withMessage('Freeze must be boolean'),
  body('reason').optional().notEmpty().withMessage('Reason cannot be empty when provided')
];

export const validateWalletId = [
  param('walletId').notEmpty().withMessage('Wallet ID is required')
];

export const validateRequestId = [
  param('requestId').notEmpty().withMessage('Request ID is required')
];
