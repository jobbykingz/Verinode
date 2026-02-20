const express = require('express');
const { body, validationResult } = require('express-validator');
const { ClientEncryptionService } = require('../security/clientEncryption');
const { PrivacyControlsService } = require('../security/privacyControls');
const { SelectiveDisclosureService } = require('../security/selectiveDisclosure');
const { KeyManagementService } = require('../security/keyManagement');
const { ZKProofPrivacyService } = require('../security/zkProofPrivacy');

const router = express.Router();

// Initialize privacy services
const zkService = new ZKProofPrivacyService();
zkService.initializeCircuits();

const privacyService = new PrivacyControlsService();
const disclosureService = new SelectiveDisclosureService();
const keyManagementService = new KeyManagementService();

/**
 * @route POST /api/security/encrypt
 * @desc Encrypt sensitive proof data
 * @access Private
 */
router.post('/encrypt', [
  body('data').notEmpty().withMessage('Data is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { data, password } = req.body;
    const encryptedData = ClientEncryptionService.encrypt(data, password);
    
    res.json({
      success: true,
      encryptedData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/security/decrypt
 * @desc Decrypt encrypted proof data
 * @access Private
 */
router.post('/decrypt', [
  body('encryptedData').isObject().withMessage('Encrypted data object is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { encryptedData, password } = req.body;
    const decryptedData = ClientEncryptionService.decrypt(encryptedData, password);
    
    res.json({
      success: true,
      decryptedData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/security/privacy-controls
 * @desc Set privacy controls for a proof
 * @access Private
 */
router.post('/privacy-controls', [
  body('proofId').notEmpty().withMessage('Proof ID is required'),
  body('settings').isObject().withMessage('Privacy settings are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { proofId, settings } = req.body;
    
    const validation = privacyService.validatePrivacySettings(settings);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        errors: validation.errors 
      });
    }

    // In a real implementation, would store these settings
    // For now, we'll just validate and return success
    res.json({
      success: true,
      message: 'Privacy controls set successfully',
      proofId
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/security/selective-disclosure
 * @desc Create selective disclosure for proof data
 * @access Private
 */
router.post('/selective-disclosure', [
  body('proofData').isObject().withMessage('Proof data is required'),
  body('disclosedFields').isArray().withMessage('Disclosed fields array is required'),
  body('purpose').notEmpty().withMessage('Purpose is required'),
  body('recipient').notEmpty().withMessage('Recipient is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { proofData, disclosedFields, purpose, recipient, ownerPrivateKey } = req.body;
    
    // Create disclosure policy
    const policy = await disclosureService.createDisclosurePolicy(
      proofData,
      disclosedFields,
      purpose,
      recipient,
      ownerPrivateKey
    );

    // Generate selective disclosure
    const selectiveData = disclosureService.generateSelectiveDisclosure(
      proofData,
      policy
    );

    res.json({
      success: true,
      selectiveData,
      policy
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/security/key-management/initialize
 * @desc Initialize key management system
 * @access Private
 */
router.post('/key-management/initialize', [
  body('masterPassword').notEmpty().withMessage('Master password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { masterPassword } = req.body;
    await keyManagementService.initialize(masterPassword);
    
    res.json({
      success: true,
      message: 'Key management system initialized'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/security/key-management/generate-keypair
 * @desc Generate new key pair
 * @access Private
 */
router.post('/key-management/generate-keypair', [
  body('usage').isIn(['encryption', 'signing', 'both']).withMessage('Invalid usage'),
  body('expiresInDays').optional().isInt({ min: 1 }).withMessage('Invalid expiration days')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { usage, expiresInDays } = req.body;
    const keyId = await keyManagementService.generateKeyPair(usage, expiresInDays);
    const publicKey = keyManagementService.getPublicKey(keyId);
    
    res.json({
      success: true,
      keyId,
      publicKey
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/security/zk-proof/generate
 * @desc Generate zero-knowledge proof
 * @access Private
 */
router.post('/zk-proof/generate', [
  body('circuitId').notEmpty().withMessage('Circuit ID is required'),
  body('privateInputs').isObject().withMessage('Private inputs are required'),
  body('publicInputs').isArray().withMessage('Public inputs are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { circuitId, privateInputs, publicInputs } = req.body;
    const zkProof = await zkService.generateZKProof(
      circuitId,
      privateInputs,
      publicInputs
    );
    
    res.json({
      success: true,
      zkProof
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/security/zk-proof/verify
 * @desc Verify zero-knowledge proof
 * @access Private
 */
router.post('/zk-proof/verify', [
  body('zkProof').isObject().withMessage('ZK proof is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { zkProof } = req.body;
    const isValid = await zkService.verifyZKProof(zkProof);
    
    res.json({
      success: true,
      valid: isValid
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/security/zk-proof/circuits
 * @desc Get available ZK circuits
 * @access Public
 */
router.get('/zk-proof/circuits', async (req, res) => {
  try {
    const circuits = zkService.getAvailableCircuits();
    res.json({
      success: true,
      circuits
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;