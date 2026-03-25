import { Router } from 'express';
import { MultiSigController } from '../controllers/MultiSigController';
import {
  validateCreateWallet,
  validateCreateSignatureRequest,
  validateAddSignature,
  validateGenerateChallenge,
  validateVerifyChallenge,
  validateUpdateWalletConfig,
  validateManageSigners,
  validateFreezeWallet,
  validateWalletId,
  validateRequestId
} from '../controllers/MultiSigController';
import { authenticateToken } from '../middleware/auth';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const multiSigController = new MultiSigController();

// Rate limiting for sensitive operations
const sensitiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many sensitive requests, please try again later'
  }
});

const standardRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  }
});

// Wallet management routes
router.post('/wallets', 
  authenticateToken,
  standardRateLimit,
  validateCreateWallet,
  multiSigController.createWallet
);

router.get('/wallets',
  authenticateToken,
  standardRateLimit,
  multiSigController.listWallets
);

router.get('/wallets/:walletId',
  authenticateToken,
  standardRateLimit,
  validateWalletId,
  multiSigController.getWallet
);

router.put('/wallets/:walletId/config',
  authenticateToken,
  sensitiveRateLimit,
  validateWalletId,
  validateUpdateWalletConfig,
  multiSigController.updateWalletConfig
);

router.put('/wallets/:walletId/signers',
  authenticateToken,
  sensitiveRateLimit,
  validateWalletId,
  validateManageSigners,
  multiSigController.manageSigners
);

router.put('/wallets/:walletId/freeze',
  authenticateToken,
  sensitiveRateLimit,
  validateWalletId,
  validateFreezeWallet,
  multiSigController.freezeWallet
);

// Signature request routes
router.post('/signature-requests',
  authenticateToken,
  standardRateLimit,
  validateCreateSignatureRequest,
  multiSigController.createSignatureRequest
);

router.get('/wallets/:walletId/signature-requests',
  authenticateToken,
  standardRateLimit,
  validateWalletId,
  multiSigController.listSignatureRequests
);

router.get('/signature-requests/:requestId',
  authenticateToken,
  standardRateLimit,
  validateRequestId,
  multiSigController.getSignatureRequest
);

router.post('/signature-requests/:requestId/signatures',
  authenticateToken,
  standardRateLimit,
  validateRequestId,
  validateAddSignature,
  multiSigController.addSignature
);

router.post('/signature-requests/:requestId/execute',
  authenticateToken,
  sensitiveRateLimit,
  validateRequestId,
  multiSigController.executeRequest
);

// Challenge verification routes
router.post('/signature-requests/:requestId/challenge',
  authenticateToken,
  standardRateLimit,
  validateRequestId,
  validateGenerateChallenge,
  multiSigController.generateChallenge
);

router.post('/signature-requests/:requestId/verify-challenge',
  authenticateToken,
  standardRateLimit,
  validateRequestId,
  validateVerifyChallenge,
  multiSigController.verifyChallenge
);

// Analytics and monitoring routes
router.get('/wallets/:walletId/signature-stats',
  authenticateToken,
  standardRateLimit,
  validateWalletId,
  multiSigController.getSignatureStats
);

router.get('/wallets/:walletId/suspicious-patterns',
  authenticateToken,
  standardRateLimit,
  validateWalletId,
  multiSigController.detectSuspiciousPatterns
);

// Batch operations routes
router.post('/signature-requests/batch',
  authenticateToken,
  standardRateLimit,
  multiSigController.createBatchSignatureRequests
);

router.post('/signature-requests/batch-signatures',
  authenticateToken,
  standardRateLimit,
  multiSigController.addBatchSignatures
);

router.post('/signature-requests/batch-execute',
  authenticateToken,
  sensitiveRateLimit,
  multiSigController.executeBatchRequests
);

// Recovery routes
router.post('/wallets/:walletId/initiate-recovery',
  authenticateToken,
  sensitiveRateLimit,
  validateWalletId,
  multiSigController.initiateRecovery
);

router.post('/wallets/:walletId/complete-recovery',
  authenticateToken,
  sensitiveRateLimit,
  validateWalletId,
  multiSigController.completeRecovery
);

router.get('/wallets/:walletId/recovery-status',
  authenticateToken,
  standardRateLimit,
  validateWalletId,
  multiSigController.getRecoveryStatus
);

// Notification routes
router.post('/signature-requests/:requestId/notify',
  authenticateToken,
  standardRateLimit,
  validateRequestId,
  multiSigController.sendNotification
);

router.put('/signature-requests/:requestId/notification-preferences',
  authenticateToken,
  standardRateLimit,
  validateRequestId,
  multiSigController.updateNotificationPreferences
);

// Audit and compliance routes
router.get('/wallets/:walletId/audit-log',
  authenticateToken,
  standardRateLimit,
  validateWalletId,
  multiSigController.getAuditLog
);

router.get('/signature-requests/:requestId/audit-trail',
  authenticateToken,
  standardRateLimit,
  validateRequestId,
  multiSigController.getAuditTrail
);

router.post('/wallets/:walletId/export-audit',
  authenticateToken,
  standardRateLimit,
  validateWalletId,
  multiSigController.exportAuditData
);

// Health and monitoring routes
router.get('/health/multisig',
  (req, res) => {
    res.json({
      success: true,
      service: 'multisig',
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }
);

router.get('/metrics/multisig',
  authenticateToken,
  standardRateLimit,
  multiSigController.getServiceMetrics
);

export default router;
