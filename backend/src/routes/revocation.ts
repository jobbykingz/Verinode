import { Router } from 'express';
import { RevocationController } from '../controllers/RevocationController';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validation';

const router = Router();
const revocationController = new RevocationController();

/**
 * @route POST /api/revocation/revoke
 * @desc Revoke a single proof
 * @access Private
 */
router.post('/revoke', [
  body('proofId')
    .notEmpty()
    .withMessage('Proof ID is required')
    .isString()
    .withMessage('Proof ID must be a string'),
  body('reason')
    .notEmpty()
    .withMessage('Revocation reason is required')
    .isIn(['COMPROMISED', 'EXPIRED', 'FRAUDULENT', 'INVALIDATED', 'SUPERSEDED', 'WITHDRAWN'])
    .withMessage('Invalid revocation reason'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isString()
    .withMessage('Description must be a string')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('evidence')
    .optional()
    .isArray()
    .withMessage('Evidence must be an array'),
  body('evidence.*.type')
    .optional()
    .isString()
    .withMessage('Evidence type must be a string'),
  body('evidence.*.description')
    .optional()
    .isString()
    .withMessage('Evidence description must be a string'),
  body('evidence.*.data')
    .optional()
    .isString()
    .withMessage('Evidence data must be a string'),
  body('notifyStakeholders')
    .optional()
    .isBoolean()
    .withMessage('Notify stakeholders must be a boolean')
], validateRequest, revocationController.revokeProof.bind(revocationController));

/**
 * @route POST /api/revocation/bulk-revoke
 * @desc Revoke multiple proofs in bulk
 * @access Private
 */
router.post('/bulk-revoke', [
  body('proofIds')
    .notEmpty()
    .withMessage('Proof IDs are required')
    .isArray({ min: 1, max: 1000 })
    .withMessage('Proof IDs must be an array with 1-1000 items'),
  body('proofIds.*')
    .notEmpty()
    .withMessage('Each proof ID is required')
    .isString()
    .withMessage('Each proof ID must be a string'),
  body('reason')
    .notEmpty()
    .withMessage('Revocation reason is required')
    .isIn(['COMPROMISED', 'EXPIRED', 'FRAUDULENT', 'INVALIDATED', 'SUPERSEDED', 'WITHDRAWN'])
    .withMessage('Invalid revocation reason'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isString()
    .withMessage('Description must be a string')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('notifyStakeholders')
    .optional()
    .isBoolean()
    .withMessage('Notify stakeholders must be a boolean')
], validateRequest, revocationController.bulkRevokeProofs.bind(revocationController));

/**
 * @route GET /api/revocation/check/:proofId
 * @desc Check if a proof is revoked
 * @access Public
 */
router.get('/check/:proofId', [
  param('proofId')
    .notEmpty()
    .withMessage('Proof ID is required')
    .isString()
    .withMessage('Proof ID must be a string')
], validateRequest, revocationController.checkRevocationStatus.bind(revocationController));

/**
 * @route GET /api/revocation/details/:proofId
 * @desc Get revocation details
 * @access Private
 */
router.get('/details/:proofId', [
  param('proofId')
    .notEmpty()
    .withMessage('Proof ID is required')
    .isString()
    .withMessage('Proof ID must be a string')
], validateRequest, revocationController.getRevocationDetails.bind(revocationController));

/**
 * @route GET /api/revocation/active
 * @desc Get all active revocations
 * @access Private
 */
router.get('/active', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
], validateRequest, revocationController.getActiveRevocations.bind(revocationController));

/**
 * @route GET /api/revocation/reason/:reason
 * @desc Get revocations by reason
 * @access Private
 */
router.get('/reason/:reason', [
  param('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .isIn(['COMPROMISED', 'EXPIRED', 'FRAUDULENT', 'INVALIDATED', 'SUPERSEDED', 'WITHDRAWN'])
    .withMessage('Invalid revocation reason')
], validateRequest, revocationController.getRevocationsByReason.bind(revocationController));

/**
 * @route GET /api/revocation/stats
 * @desc Get revocation statistics
 * @access Private
 */
router.get('/stats', revocationController.getRevocationStats.bind(revocationController));

/**
 * @route POST /api/revocation/restore/:proofId
 * @desc Restore a revoked proof
 * @access Private
 */
router.post('/restore/:proofId', [
  param('proofId')
    .notEmpty()
    .withMessage('Proof ID is required')
    .isString()
    .withMessage('Proof ID must be a string'),
  body('reason')
    .notEmpty()
    .withMessage('Restoration reason is required')
    .isString()
    .withMessage('Restoration reason must be a string')
    .isLength({ min: 10, max: 500 })
    .withMessage('Restoration reason must be between 10 and 500 characters')
], validateRequest, revocationController.restoreRevocation.bind(revocationController));

/**
 * @route GET /api/revocation/export
 * @desc Export Certificate Revocation List (CRL)
 * @access Private
 */
router.get('/export', [
  query('format')
    .optional()
    .isIn(['json', 'crl', 'csv'])
    .withMessage('Format must be one of: json, crl, csv')
], validateRequest, revocationController.exportCRL.bind(revocationController));

/**
 * @route POST /api/revocation/import
 * @desc Import Certificate Revocation List (CRL)
 * @access Private
 */
router.post('/import', [
  query('format')
    .optional()
    .isIn(['json', 'crl', 'csv'])
    .withMessage('Format must be one of: json, crl, csv'),
  body()
    .notEmpty()
    .withMessage('Request body is required')
], validateRequest, revocationController.importCRL.bind(revocationController));

/**
 * @route POST /api/revocation/auto-revoke-expired
 * @desc Auto-revoke expired proofs
 * @access Private
 */
router.post('/auto-revoke-expired', revocationController.autoRevokeExpiredProofs.bind(revocationController));

export default router;
