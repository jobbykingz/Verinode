const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { IPFSService } = require('../services/ipfsService');
const { PinningService } = require('../services/pinningService');
const { IPNSService } = require('../services/ipnsService');
const { ContentVerification } = require('../utils/contentVerification');
const IPFSContent = require('../models/IPFSContent');
const ipfsConfig = require('../../config/ipfsConfig');

// Initialize services
const ipfsService = new IPFSService();
const pinningService = new PinningService();
const ipnsService = new IPNSService();
const contentVerification = new ContentVerification();

// Initialize services on startup
const initializeServices = async () => {
  try {
    await ipfsService.initialize();
    await pinningService.initialize();
    await ipnsService.initialize();
    console.log('IPFS routes initialized successfully');
  } catch (error) {
    console.error('Failed to initialize IPFS services:', error);
  }
};

initializeServices();

// Content management routes

// Upload content to IPFS
router.post('/upload', [
  body('content').notEmpty().withMessage('Content is required'),
  body('name').optional().isString().withMessage('Name must be a string'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('contentType').optional().isString().withMessage('Content type must be a string'),
  body('pin').optional().isBoolean().withMessage('Pin must be boolean'),
  body('pinningStrategy').optional().isIn(['immediate', 'delayed', 'conditional', 'backup']).withMessage('Invalid pinning strategy')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      content,
      name = `content-${Date.now()}`,
      description = '',
      contentType = 'json',
      pin = true,
      pinningStrategy = 'immediate',
      owner = req.user?.address || 'anonymous',
      issuer = req.user?.address || 'anonymous',
      privacySettings = {}
    } = req.body;

    // Add content to IPFS
    const ipfsResult = await ipfsService.addContent(content, {
      pin: false, // We'll handle pinning separately
      wrapWithDirectory: false
    });

    // Calculate content hash
    const contentHash = contentVerification.calculateHash(content);

    // Create database record
    const ipfsContent = new IPFSContent({
      cid: ipfsResult.cid,
      name,
      description,
      contentType,
      size: ipfsResult.size,
      hash: contentHash,
      owner,
      issuer,
      privacySettings: {
        public: privacySettings.public || false,
        allowedUsers: privacySettings.allowedUsers || [],
        allowedRoles: privacySettings.allowedRoles || [],
        encryptionEnabled: privacySettings.encryptionEnabled || false
      },
      pinning: {
        isPinned: false,
        pinningStrategy,
        pinningPriority: 'normal'
      },
      verification: {
        contentHash,
        verified: false,
        verificationAttempts: 0
      }
    });

    await ipfsContent.save();

    // Pin content if requested
    let pinResult = null;
    if (pin) {
      try {
        pinResult = await pinningService.pinContent(ipfsResult.cid, {
          strategy: pinningStrategy,
          priority: 'normal',
          metadata: {
            name,
            contentType,
            owner,
            uploadedAt: new Date().toISOString()
          }
        });

        // Update database record
        ipfsContent.pinning.isPinned = true;
        ipfsContent.pinning.pinnedAt = new Date();
        await ipfsContent.save();

      } catch (pinError) {
        console.warn('Pinning failed:', pinError.message);
      }
    }

    // Verify content integrity
    try {
      const verificationResult = await contentVerification.verifyIPFSContent(
        ipfsService,
        ipfsResult.cid,
        contentHash
      );

      ipfsContent.verification.verified = verificationResult.verified;
      ipfsContent.verification.verifiedAt = new Date();
      await ipfsContent.save();

    } catch (verificationError) {
      console.warn('Content verification failed:', verificationError.message);
    }

    res.status(201).json({
      success: true,
      content: {
        cid: ipfsResult.cid,
        name,
        description,
        contentType,
        size: ipfsResult.size,
        hash: contentHash,
        gatewayURL: `http://localhost:8080/ipfs/${ipfsResult.cid}`,
        uploadedAt: ipfsContent.uploadedAt
      },
      pinning: pinResult,
      message: 'Content uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get content from IPFS
router.get('/content/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const { format = 'json', includeMetadata = 'false' } = req.query;

    // Validate CID
    const cidValidation = contentVerification.verifyCID(cid);
    if (!cidValidation.valid) {
      return res.status(400).json({ error: 'Invalid CID format' });
    }

    // Get content from IPFS
    let content;
    if (format === 'json') {
      content = await ipfsService.getContentAsJSON(cid);
    } else if (format === 'string') {
      content = await ipfsService.getContentAsString(cid);
    } else {
      content = await ipfsService.getContent(cid);
    }

    // Get metadata if requested
    let metadata = null;
    if (includeMetadata === 'true') {
      metadata = await IPFSContent.findOne({ cid });
    }

    res.json({
      success: true,
      cid,
      content,
      metadata,
      format,
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Content retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pinning routes

// Pin content
router.post('/pin/:cid', [
  body('strategy').optional().isIn(['immediate', 'delayed', 'conditional', 'backup']).withMessage('Invalid pinning strategy'),
  body('priority').optional().isIn(['low', 'normal', 'high']).withMessage('Invalid priority')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cid } = req.params;
    const { strategy = 'immediate', priority = 'normal' } = req.body;

    // Validate CID
    const cidValidation = contentVerification.verifyCID(cid);
    if (!cidValidation.valid) {
      return res.status(400).json({ error: 'Invalid CID format' });
    }

    const pinResult = await pinningService.pinContent(cid, {
      strategy,
      priority,
      metadata: {
        pinnedBy: req.user?.address || 'anonymous',
        pinnedAt: new Date().toISOString()
      }
    });

    // Update database record
    const ipfsContent = await IPFSContent.findOne({ cid });
    if (ipfsContent) {
      ipfsContent.pinning.isPinned = true;
      ipfsContent.pinning.pinningStrategy = strategy;
      ipfsContent.pinning.pinningPriority = priority;
      ipfsContent.pinning.pinnedAt = new Date();
      await ipfsContent.save();
    }

    res.json({
      success: true,
      pinResult,
      message: 'Content pinned successfully'
    });

  } catch (error) {
    console.error('Pinning error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unpin content
router.delete('/pin/:cid', async (req, res) => {
  try {
    const { cid } = req.params;

    // Validate CID
    const cidValidation = contentVerification.verifyCID(cid);
    if (!cidValidation.valid) {
      return res.status(400).json({ error: 'Invalid CID format' });
    }

    const unpinResult = await pinningService.unpinContent(cid);

    // Update database record
    const ipfsContent = await IPFSContent.findOne({ cid });
    if (ipfsContent) {
      ipfsContent.pinning.isPinned = false;
      await ipfsContent.save();
    }

    res.json({
      success: true,
      unpinResult,
      message: 'Content unpinned successfully'
    });

  } catch (error) {
    console.error('Unpinning error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List pinned content
router.get('/pins', [
  query('strategy').optional().isIn(['immediate', 'delayed', 'conditional', 'backup']).withMessage('Invalid pinning strategy'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { strategy, limit = 50 } = req.query;

    const pinnedContent = await IPFSContent.find({
      'pinning.isPinned': true,
      ...(strategy && { 'pinning.pinningStrategy': strategy })
    })
    .sort({ 'pinning.pinnedAt': -1 })
    .limit(parseInt(limit));

    res.json({
      success: true,
      pins: pinnedContent,
      total: pinnedContent.length,
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('List pins error:', error);
    res.status(500).json({ error: error.message });
  }
});

// IPNS routes

// Create IPNS key
router.post('/ipns/key', [
  body('name').notEmpty().withMessage('Key name is required'),
  body('keyType').optional().isIn(['ed25519', 'rsa']).withMessage('Invalid key type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, keyType = 'ed25519' } = req.body;

    const keyResult = await ipnsService.createKey(name, { keyType });

    res.json({
      success: true,
      key: keyResult,
      message: 'IPNS key created successfully'
    });

  } catch (error) {
    console.error('Create IPNS key error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Publish to IPNS
router.post('/ipns/publish', [
  body('keyName').notEmpty().withMessage('Key name is required'),
  body('cid').notEmpty().withMessage('CID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { keyName, cid, lifetime = '24h' } = req.body;

    // Validate CID
    const cidValidation = contentVerification.verifyCID(cid);
    if (!cidValidation.valid) {
      return res.status(400).json({ error: 'Invalid CID format' });
    }

    const publishResult = await ipnsService.publishToIPNS(keyName, cid, { lifetime });

    res.json({
      success: true,
      record: publishResult,
      message: 'Content published to IPNS successfully'
    });

  } catch (error) {
    console.error('IPNS publish error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resolve IPNS name
router.get('/ipns/resolve/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { timeout = 30000 } = req.query;

    const resolveResult = await ipnsService.resolveIPNS(name, { 
      timeout: parseInt(timeout) 
    });

    res.json({
      success: true,
      resolution: resolveResult,
      message: 'IPNS name resolved successfully'
    });

  } catch (error) {
    console.error('IPNS resolve error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List IPNS keys
router.get('/ipns/keys', async (req, res) => {
  try {
    const keys = await ipnsService.listKeys();

    res.json({
      success: true,
      keys,
      total: keys.length,
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('List IPNS keys error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verification routes

// Verify content integrity
router.post('/verify/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const { expectedHash } = req.body;

    // Validate CID
    const cidValidation = contentVerification.verifyCID(cid);
    if (!cidValidation.valid) {
      return res.status(400).json({ error: 'Invalid CID format' });
    }

    const verificationResult = await contentVerification.verifyIPFSContent(
      ipfsService,
      cid,
      expectedHash
    );

    // Update database record
    const ipfsContent = await IPFSContent.findOne({ cid });
    if (ipfsContent) {
      ipfsContent.verification.verified = verificationResult.verified;
      ipfsContent.verification.verifiedAt = new Date();
      ipfsContent.verification.verificationAttempts += 1;
      await ipfsContent.save();
    }

    res.json({
      success: true,
      verification: verificationResult,
      message: verificationResult.verified ? 'Content verified successfully' : 'Content verification failed'
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch verification
router.post('/verify/batch', [
  body('items').isArray().withMessage('Items must be an array'),
  body('items.*.cid').notEmpty().withMessage('Each item must have a CID'),
  body('items.*.expectedHash').optional().isString().withMessage('Expected hash must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { items } = req.body;

    const batchResult = await contentVerification.verifyBatch(ipfsService, items);

    res.json({
      success: true,
      batch: batchResult,
      message: 'Batch verification completed'
    });

  } catch (error) {
    console.error('Batch verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Statistics and monitoring routes

// Get IPFS statistics
router.get('/stats', async (req, res) => {
  try {
    const ipfsStats = await ipfsService.getStats();
    const dbStats = await IPFSContent.getStats();
    const pinningStats = await pinningService.getQueueStatus();
    const ipnsStats = await ipnsService.getStats();

    res.json({
      success: true,
      ipfs: ipfsStats,
      database: dbStats,
      pinning: pinningStats,
      ipns: ipnsStats,
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
router.get('/health', async (req, res) => {
  try {
    const ipfsStats = await ipfsService.getStats();
    
    res.json({
      status: 'healthy',
      ipfs: {
        connected: true,
        version: ipfsStats.version
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Content search and filtering
router.get('/search', [
  query('q').optional().isString().withMessage('Query must be a string'),
  query('contentType').optional().isString().withMessage('Content type must be a string'),
  query('owner').optional().isString().withMessage('Owner must be a string'),
  query('verified').optional().isBoolean().withMessage('Verified must be boolean'),
  query('pinned').optional().isBoolean().withMessage('Pinned must be boolean'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      q,
      contentType,
      owner,
      verified,
      pinned,
      limit = 50,
      skip = 0
    } = req.query;

    // Build query
    const query = {};
    
    if (contentType) query.contentType = contentType;
    if (owner) query.owner = owner;
    if (verified !== undefined) query['verification.verified'] = verified === 'true';
    if (pinned !== undefined) query['pinning.isPinned'] = pinned === 'true';
    
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { cid: { $regex: q, $options: 'i' } }
      ];
    }

    const results = await IPFSContent.find(query)
      .sort({ uploadedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await IPFSContent.countDocuments(query);

    res.json({
      success: true,
      results,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
