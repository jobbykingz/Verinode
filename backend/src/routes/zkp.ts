import { Router } from 'express';
import { ZKProofController } from '../controllers/ZKProofController';
import { body, param, query } from 'express-validator';

const router = Router();
const zkProofController = new ZKProofController();

/**
 * @route POST /api/zkp/generate
 * @desc Generate a new ZK proof
 * @access Private
 */
router.post('/generate', [
  body('circuitId')
    .notEmpty()
    .withMessage('Circuit ID is required')
    .isString(),
  body('proofType')
    .notEmpty()
    .withMessage('Proof type is required')
    .isIn(['range_proof', 'membership_proof', 'equality_proof', 'knowledge_proof', 'set_membership_proof', 'ring_signature', 'bulletproofs', 'schnorr_proof', 'pedersen_commitment'])
    .withMessage('Invalid proof type'),
  body('witness')
    .notEmpty()
    .withMessage('Witness data is required'),
  body('publicInputs')
    .notEmpty()
    .withMessage('Public inputs are required'),
  body('provingKey')
    .notEmpty()
    .withMessage('Proving key is required'),
  body('parameters.securityLevel')
    .optional()
    .isInt({ min: 80, max: 256 })
    .withMessage('Security level must be between 80 and 256'),
  body('parameters.timeout')
    .optional()
    .isInt({ min: 5000, max: 300000 })
    .withMessage('Timeout must be between 5 seconds and 5 minutes'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high')
], zkProofController.generateProof.bind(zkProofController));

/**
 * @route POST /api/zkp/generate-batch
 * @desc Generate multiple ZK proofs in batch
 * @access Private
 */
router.post('/generate-batch', [
  body('requests')
    .isArray({ min: 1, max: 100 })
    .withMessage('Requests must be an array with 1-100 items'),
  body('requests.*.circuitId')
    .notEmpty()
    .withMessage('Each request must include circuitId'),
  body('requests.*.proofType')
    .notEmpty()
    .withMessage('Each request must include proofType'),
  body('requests.*.witness')
    .notEmpty()
    .withMessage('Each request must include witness'),
  body('requests.*.publicInputs')
    .notEmpty()
    .withMessage('Each request must include publicInputs'),
  body('requests.*.provingKey')
    .notEmpty()
    .withMessage('Each request must include provingKey')
], zkProofController.generateBatchProofs.bind(zkProofController));

/**
 * @route POST /api/zkp/verify
 * @desc Verify a ZK proof
 * @access Public
 */
router.post('/verify', [
  body('proofId')
    .notEmpty()
    .withMessage('Proof ID is required')
    .isString(),
  body('proofType')
    .notEmpty()
    .withMessage('Proof type is required')
    .isIn(['range_proof', 'membership_proof', 'equality_proof', 'knowledge_proof', 'set_membership_proof', 'ring_signature', 'bulletproofs', 'schnorr_proof', 'pedersen_commitment'])
    .withMessage('Invalid proof type'),
  body('circuitId')
    .notEmpty()
    .withMessage('Circuit ID is required')
    .isString(),
  body('proofData')
    .notEmpty()
    .withMessage('Proof data is required'),
  body('publicInputs')
    .notEmpty()
    .withMessage('Public inputs are required'),
  body('verificationKey')
    .notEmpty()
    .withMessage('Verification key is required'),
  body('requestedBy')
    .optional()
    .isString()
    .withMessage('Requested by must be a string'),
  body('parameters')
    .optional()
    .isObject()
    .withMessage('Parameters must be an object')
], zkProofController.verifyProof.bind(zkProofController));

/**
 * @route POST /api/zkp/verify-batch
 * @desc Verify multiple ZK proofs in batch
 * @access Public
 */
router.post('/verify-batch', [
  body('requests')
    .isArray({ min: 1, max: 50 })
    .withMessage('Requests must be an array with 1-50 items'),
  body('requests.*.proofId')
    .notEmpty()
    .withMessage('Each request must include proofId'),
  body('requests.*.proofType')
    .notEmpty()
    .withMessage('Each request must include proofType'),
  body('requests.*.circuitId')
    .notEmpty()
    .withMessage('Each request must include circuitId'),
  body('requests.*.proofData')
    .notEmpty()
    .withMessage('Each request must include proofData'),
  body('requests.*.publicInputs')
    .notEmpty()
    .withMessage('Each request must include publicInputs'),
  body('requests.*.verificationKey')
    .notEmpty()
    .withMessage('Each request must include verificationKey')
], zkProofController.verifyBatchProofs.bind(zkProofController));

/**
 * @route GET /api/zkp/generation-status/:requestId
 * @desc Get proof generation status
 * @access Private
 */
router.get('/generation-status/:requestId', [
  param('requestId')
    .notEmpty()
    .withMessage('Request ID is required')
    .isString()
], zkProofController.getGenerationStatus.bind(zkProofController));

/**
 * @route GET /api/zkp/verification-status/:requestId
 * @desc Get verification status
 * @access Private
 */
router.get('/verification-status/:requestId', [
  param('requestId')
    .notEmpty()
    .withMessage('Request ID is required')
    .isString()
], zkProofController.getVerificationStatus.bind(zkProofController));

/**
 * @route POST /api/zkp/cancel-generation/:requestId
 * @desc Cancel generation request
 * @access Private
 */
router.post('/cancel-generation/:requestId', [
  param('requestId')
    .notEmpty()
    .withMessage('Request ID is required')
    .isString(),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
], zkProofController.cancelGeneration.bind(zkProofController));

/**
 * @route GET /api/zkp/circuits
 * @desc Get available circuits
 * @access Public
 */
router.get('/circuits', [
  query('proofType')
    .optional()
    .isIn(['range_proof', 'membership_proof', 'equality_proof', 'knowledge_proof', 'set_membership_proof', 'ring_signature', 'bulletproofs', 'schnorr_proof', 'pedersen_commitment'])
    .withMessage('Invalid proof type')
], zkProofController.getAvailableCircuits.bind(zkProofController));

/**
 * @route GET /api/zkp/statistics
 * @desc Get service statistics
 * @access Private
 */
router.get('/statistics', zkProofController.getStatistics.bind(zkProofController));

/**
 * @route POST /api/zkp/queue-generation
 * @desc Queue proof generation
 * @access Private
 */
router.post('/queue-generation', [
  body('circuitId')
    .notEmpty()
    .withMessage('Circuit ID is required')
    .isString(),
  body('proofType')
    .notEmpty()
    .withMessage('Proof type is required')
    .isIn(['range_proof', 'membership_proof', 'equality_proof', 'knowledge_proof', 'set_membership_proof', 'ring_signature', 'bulletproofs', 'schnorr_proof', 'pedersen_commitment'])
    .withMessage('Invalid proof type'),
  body('witness')
    .notEmpty()
    .withMessage('Witness data is required'),
  body('publicInputs')
    .notEmpty()
    .withMessage('Public inputs are required'),
  body('provingKey')
    .notEmpty()
    .withMessage('Proving key is required'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high')
], zkProofController.queueGeneration.bind(zkProofController));

/**
 * @route GET /api/zkp/active-generations
 * @desc Get active generations
 * @access Private
 */
router.get('/active-generations', zkProofController.getActiveGenerations.bind(zkProofController));

export default router;
