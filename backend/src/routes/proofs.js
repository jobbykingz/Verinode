const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const StellarSDK = require('@stellar/stellar-sdk');
const { ClientEncryptionService } = require('../security/clientEncryption');
const { PrivacyControlsService } = require('../security/privacyControls');

// Mock storage - replace with database
let proofs = [];
let proofIdCounter = 1;

// Issue a new proof
router.post('/issue', [
  body('eventData').notEmpty().withMessage('Event data is required'),
  body('hash').isLength({ min: 64 }).withMessage('Hash must be at least 64 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { eventData, hash, issuerAddress, encryptionPassword, privacySettings } = req.body;
    
    // Handle encryption if requested
    let processedEventData = eventData;
    let encrypted = false;
    
    if (encryptionPassword) {
      processedEventData = ClientEncryptionService.encrypt(eventData, encryptionPassword);
      encrypted = true;
    }
    
    // Set privacy controls
    const privacyService = new PrivacyControlsService();
    const finalPrivacySettings = privacyService.createPrivacySettings(privacySettings || {});
    
    const proof = {
      id: proofIdCounter++,
      issuer: issuerAddress,
      eventData: processedEventData,
      hash,
      timestamp: new Date().toISOString(),
      verified: false,
      stellarTxId: null,
      encrypted,
      privacySettings: finalPrivacySettings
    };

    proofs.push(proof);
    
    res.status(201).json({
      success: true,
      proof,
      message: 'Proof issued successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get proof by ID
router.get('/:id', (req, res) => {
  const proof = proofs.find(p => p.id === parseInt(req.params.id));
  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }
  
  // Apply privacy controls
  const privacyService = new PrivacyControlsService();
  const userAddress = req.query.userAddress || 'anonymous'; // In real implementation, this would come from auth
  const requestedActions = req.query.actions ? req.query.actions.split(',') : ['view'];
  
  const canAccess = privacyService.canAccess(proof.privacySettings, userAddress, requestedActions);
  
  if (!canAccess.allowed) {
    return res.status(403).json({ error: canAccess.reason });
  }
  
  // Apply privacy filter to the proof data
  const filteredProof = privacyService.applyPrivacyFilter(proof, proof.privacySettings, userAddress);
  
  res.json({ proof: filteredProof });
});

// Get all proofs
router.get('/', (req, res) => {
  const { issuer, verified } = req.query;
  let filteredProofs = proofs;
  
  if (issuer) {
    filteredProofs = filteredProofs.filter(p => p.issuer === issuer);
  }
  
  if (verified !== undefined) {
    filteredProofs = filteredProofs.filter(p => p.verified === (verified === 'true'));
  }
  
  res.json({ proofs: filteredProofs });
});

// Verify a proof
router.post('/verify/:id', async (req, res) => {
  try {
    const proof = proofs.find(p => p.id === parseInt(req.params.id));
    if (!proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }
    
    // Apply privacy controls for verification
    const privacyService = new PrivacyControlsService();
    const userAddress = req.body.verifierAddress || 'anonymous'; // In real implementation, this would come from auth
    const requestedActions = ['verify'];
    
    const canAccess = privacyService.canAccess(proof.privacySettings, userAddress, requestedActions);
    
    if (!canAccess.allowed) {
      return res.status(403).json({ error: canAccess.reason });
    }
    
    // Check if selective disclosure is needed
    const selectiveFields = req.body.selectiveFields || [];
    
    if (selectiveFields.length > 0) {
      // Apply selective disclosure
      const disclosureService = new SelectiveDisclosureService();
      
      // Create a temporary policy for verification
      const policy = await disclosureService.createDisclosurePolicy(
        proof,
        selectiveFields,
        'Verification request',
        userAddress,
        'temp-key' // In real implementation, use proper key
      );
      
      const selectiveData = disclosureService.generateSelectiveDisclosure(
        proof,
        policy
      );
      
      // Mock verification on the selectively disclosed data
      proof.verified = true;
      proof.verifiedAt = new Date().toISOString();
      
      res.json({
        success: true,
        proof: selectiveData.disclosedData, // Return only selectively disclosed data
        message: 'Proof verified successfully with selective disclosure'
      });
    } else {
      // Standard verification
      proof.verified = true;
      proof.verifiedAt = new Date().toISOString();
      
      res.json({
        success: true,
        proof,
        message: 'Proof verified successfully'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
