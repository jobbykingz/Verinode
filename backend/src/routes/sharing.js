const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrivacyControlsService } = require('../security/privacyControls');
const { SelectiveDisclosureService } = require('../security/selectiveDisclosure');

const router = express.Router();

// Initialize services
const privacyService = new PrivacyControlsService();
const disclosureService = new SelectiveDisclosureService();

// Mock storage for sharing
let sharingRequests = [];
let sharedProofs = [];

/**
 * @route POST /api/sharing/request-access
 * @desc Request access to a proof
 */
router.post('/request-access', [
  body('proofId').notEmpty().withMessage('Proof ID is required'),
  body('requesterAddress').notEmpty().withMessage('Requester address is required'),
  body('requestedActions').isArray().withMessage('Requested actions are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { proofId, requesterAddress, requestedActions, reason } = req.body;
    
    // Create access request
    const requestId = await privacyService.requestAccess(
      proofId,
      requesterAddress,
      requestedActions,
      reason
    );
    
    const request = {
      id: requestId,
      proofId,
      requesterAddress,
      requestedActions,
      reason,
      status: 'pending',
      timestamp: new Date().toISOString()
    };
    
    sharingRequests.push(request);
    
    res.json({
      success: true,
      requestId,
      message: 'Access request submitted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/sharing/approve-request
 * @desc Approve an access request
 */
router.post('/approve-request', [
  body('requestId').notEmpty().withMessage('Request ID is required'),
  body('approverAddress').notEmpty().withMessage('Approver address is required'),
  body('permissions').isArray().withMessage('Permissions are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId, approverAddress, permissions } = req.body;
    
    // Find the request
    const requestIndex = sharingRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const request = sharingRequests[requestIndex];
    
    // Grant consent
    const consentId = await privacyService.grantConsent(
      request.proofId,
      approverAddress, // Assuming approver is the proof owner
      request.requesterAddress,
      permissions,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    );
    
    // Update request status
    request.status = 'approved';
    sharingRequests[requestIndex] = request;
    
    res.json({
      success: true,
      consentId,
      message: 'Access request approved'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/sharing/create-selective-share
 * @desc Create a selective disclosure for sharing
 */
router.post('/create-selective-share', [
  body('proofId').notEmpty().withMessage('Proof ID is required'),
  body('disclosedFields').isArray().withMessage('Disclosed fields are required'),
  body('recipient').notEmpty().withMessage('Recipient is required'),
  body('purpose').notEmpty().withMessage('Purpose is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { proofId, disclosedFields, recipient, purpose, proofData, ownerPrivateKey } = req.body;
    
    // Create selective disclosure
    const policy = await disclosureService.createDisclosurePolicy(
      { id: proofId, ...proofData },
      disclosedFields,
      purpose,
      recipient,
      ownerPrivateKey
    );
    
    const selectiveData = disclosureService.generateSelectiveDisclosure(
      { id: proofId, ...proofData },
      policy
    );
    
    // Store the shared proof
    const sharedProof = {
      id: await privacyService.constructor.generateRandomBytes(16), // In a real implementation
      originalProofId: proofId,
      selectiveData,
      policy,
      sharedAt: new Date().toISOString(),
      recipient
    };
    
    sharedProofs.push(sharedProof);
    
    res.json({
      success: true,
      sharedProof,
      message: 'Selective sharing created successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/sharing/get-shared-proof/:shareId
 * @desc Get a shared proof
 */
router.get('/get-shared-proof/:shareId', async (req, res) => {
  try {
    const shareId = req.params.shareId;
    
    // Find the shared proof
    const sharedProof = sharedProofs.find(sp => sp.id === shareId);
    if (!sharedProof) {
      return res.status(404).json({ error: 'Shared proof not found' });
    }
    
    // Verify the request is coming from the intended recipient
    // In a real implementation, this would involve proper authentication
    const requesterAddress = req.query.requester; // This should come from authenticated user
    
    if (sharedProof.recipient !== requesterAddress) {
      return res.status(403).json({ error: 'Access denied: Not authorized recipient' });
    }
    
    res.json({
      success: true,
      sharedProof
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/sharing/pending-requests
 * @desc Get pending access requests for a proof owner
 */
router.get('/pending-requests/:ownerAddress', async (req, res) => {
  try {
    const ownerAddress = req.params.ownerAddress;
    
    // In a real implementation, this would check if the owner is authenticated
    // and return requests for proofs owned by this address
    
    const pendingRequests = sharingRequests.filter(
      req => req.status === 'pending'
    );
    
    res.json({
      success: true,
      requests: pendingRequests
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/sharing/revoke-access
 * @desc Revoke access to a proof
 */
router.post('/revoke-access', [
  body('consentId').notEmpty().withMessage('Consent ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { consentId } = req.body;
    
    const success = privacyService.revokeConsent(consentId);
    
    if (!success) {
      return res.status(404).json({ error: 'Consent record not found' });
    }
    
    res.json({
      success: true,
      message: 'Access revoked successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;