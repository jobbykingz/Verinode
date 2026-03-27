import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { ProofController } from '../controllers/proofController';
import { authMiddleware } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Validation middleware
const createProofValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Description must be between 1 and 2000 characters'),
  body('proofType')
    .isIn(['identity', 'education', 'employment', 'financial', 'health', 'legal', 'property', 'digital', 'custom'])
    .withMessage('Invalid proof type'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  body('eventData')
    .optional()
    .isObject()
    .withMessage('Event data must be an object'),
  body('recipientAddress')
    .optional()
    .isEmail()
    .withMessage('Recipient address must be a valid email'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters')
];

const updateProofValidation = [
  param('id')
    .isLength({ min: 1 })
    .withMessage('Proof ID is required'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Description must be between 1 and 2000 characters'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  body('eventData')
    .optional()
    .isObject()
    .withMessage('Event data must be an object'),
  body('recipientAddress')
    .optional()
    .isEmail()
    .withMessage('Recipient address must be a valid email'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters')
];

const verifyProofValidation = [
  param('id')
    .isLength({ min: 1 })
    .withMessage('Proof ID is required'),
  body('verificationMethod')
    .isIn(['manual', 'automated', 'blockchain', 'external'])
    .withMessage('Invalid verification method'),
  body('additionalData')
    .optional()
    .isObject()
    .withMessage('Additional data must be an object')
];

const batchOperationsValidation = [
  body('operations')
    .isArray({ min: 1, max: 100 })
    .withMessage('Operations must be an array with 1-100 items'),
  body('operations.*.type')
    .isIn(['create', 'verify', 'update', 'delete'])
    .withMessage('Invalid operation type'),
  body('operations.*.proofId')
    .if(body('operations.*.type').in(['verify', 'update', 'delete']))
    .isLength({ min: 1 })
    .withMessage('Proof ID is required for update, verify, and delete operations'),
  body('operations.*.data')
    .if(body('operations.*.type').in(['create', 'update']))
    .isObject()
    .withMessage('Data is required for create and update operations'),
  body('operations.*.verificationMethod')
    .if(body('operations.*.type').equals('verify'))
    .isIn(['manual', 'automated', 'blockchain', 'external'])
    .withMessage('Verification method is required for verify operations')
];

const shareProofValidation = [
  param('id')
    .isLength({ min: 1 })
    .withMessage('Proof ID is required'),
  body('recipientEmail')
    .isEmail()
    .withMessage('Recipient email must be valid'),
  body('permissions')
    .isArray({ min: 1 })
    .withMessage('At least one permission is required'),
  body('permissions.*')
    .isIn(['view', 'edit', 'share', 'verify'])
    .withMessage('Invalid permission type'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message must not exceed 500 characters')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'title', 'status', 'proofType'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search query is required'),
  ...paginationValidation,
  query('proofType')
    .optional()
    .isIn(['identity', 'education', 'employment', 'financial', 'health', 'legal', 'property', 'digital', 'custom'])
    .withMessage('Invalid proof type'),
  query('status')
    .optional()
    .isIn(['draft', 'verified', 'verification_failed', 'revoked'])
    .withMessage('Invalid status'),
  query('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return true; // Will be split in controller
      }
      if (Array.isArray(value)) {
        return value.every(tag => typeof tag === 'string');
      }
      throw new Error('Tags must be a string or array of strings');
    }),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date')
];

// Routes

/**
 * @route   POST /api/proofs
 * @desc    Create a new proof
 * @access  Private
 */
router.post('/', 
  rateLimiter.proofCreation,
  createProofValidation,
  ProofController.createProof
);

/**
 * @route   GET /api/proofs/user
 * @desc    Get user's proofs with filtering and pagination
 * @access  Private
 */
router.get('/user',
  rateLimiter.general,
  paginationValidation,
  ProofController.getUserProofs
);

/**
 * @route   GET /api/proofs/search
 * @desc    Search proofs
 * @access  Private
 */
router.get('/search',
  rateLimiter.search,
  searchValidation,
  ProofController.searchProofs
);

/**
 * @route   GET /api/proofs/stats
 * @desc    Get proof statistics
 * @access  Private
 */
router.get('/stats',
  rateLimiter.general,
  query('timeRange')
    .optional()
    .isIn(['7d', '30d', '90d'])
    .withMessage('Time range must be 7d, 30d, or 90d'),
  ProofController.getProofStats
);

/**
 * @route   GET /api/proofs/export
 * @desc    Export proofs
 * @access  Private
 */
router.get('/export',
  rateLimiter.export,
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),
  query('proofType')
    .optional()
    .isIn(['identity', 'education', 'employment', 'financial', 'health', 'legal', 'property', 'digital', 'custom'])
    .withMessage('Invalid proof type'),
  query('status')
    .optional()
    .isIn(['draft', 'verified', 'verification_failed', 'revoked'])
    .withMessage('Invalid status'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date'),
  ProofController.exportProofs
);

/**
 * @route   POST /api/proofs/batch
 * @desc    Batch proof operations
 * @access  Private
 */
router.post('/batch',
  rateLimiter.batch,
  batchOperationsValidation,
  ProofController.batchOperations
);

/**
 * @route   GET /api/proofs/:id
 * @desc    Get proof by ID
 * @access  Private
 */
router.get('/:id',
  rateLimiter.general,
  param('id')
    .isLength({ min: 1 })
    .withMessage('Proof ID is required'),
  ProofController.getProofById
);

/**
 * @route   PUT /api/proofs/:id
 * @desc    Update proof
 * @access  Private
 */
router.put('/:id',
  rateLimiter.proofUpdate,
  updateProofValidation,
  ProofController.updateProof
);

/**
 * @route   DELETE /api/proofs/:id
 * @desc    Delete proof
 * @access  Private
 */
router.delete('/:id',
  rateLimiter.proofDeletion,
  param('id')
    .isLength({ min: 1 })
    .withMessage('Proof ID is required'),
  ProofController.deleteProof
);

/**
 * @route   POST /api/proofs/:id/verify
 * @desc    Verify a proof
 * @access  Private
 */
router.post('/:id/verify',
  rateLimiter.verification,
  verifyProofValidation,
  ProofController.verifyProof
);

/**
 * @route   GET /api/proofs/:id/history
 * @desc    Get proof history/audit trail
 * @access  Private
 */
router.get('/:id/history',
  rateLimiter.general,
  param('id')
    .isLength({ min: 1 })
    .withMessage('Proof ID is required'),
  ProofController.getProofHistory
);

/**
 * @route   POST /api/proofs/:id/share
 * @desc    Share proof
 * @access  Private
 */
router.post('/:id/share',
  rateLimiter.sharing,
  shareProofValidation,
  ProofController.shareProof
);

export default router;
