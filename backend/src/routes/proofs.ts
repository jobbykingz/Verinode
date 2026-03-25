import express, { Request, Response, Router } from 'express';
import { body, validationResult } from 'express-validator';
import { enforceQuota } from '../middleware/quota';
import { ResourceType } from '../models/ResourceQuota';
import UsageTrackingService from '../services/tenant/UsageTrackingService';

const router: Router = express.Router();

// Mock storage - replace with database or persistent model
let proofs: any[] = [];
let proofIdCounter = 1;

/**
 * @route POST /api/proofs/issue
 * @desc Issue a new proof (Protected by Quota)
 */
router.post('/issue', [
  enforceQuota(ResourceType.PROOFS),
  body('eventData').notEmpty().withMessage('Event data is required'),
  body('hash').isLength({ min: 64 }).withMessage('Hash must be at least 64 characters')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { eventData, hash, issuerAddress } = req.body;
    const user = (req as any).user;
    const tenantId = user?.tenantId || user?.id;

    // 1. Create the proof object
    const proof = {
      id: proofIdCounter++,
      issuer: issuerAddress,
      eventData,
      hash,
      timestamp: new Date().toISOString(),
      verified: false,
      stellarTxId: null
    };

    proofs.push(proof);

    // 2. Track usage (Increment the counter)
    if (tenantId) {
      await UsageTrackingService.trackUsage(tenantId.toString(), ResourceType.PROOFS, 1);
    }
    
    res.status(201).json({
      success: true,
      proof,
      message: 'Proof issued successfully',
      quotaRemaining: (req as any).quotaStatus?.remaining
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/proofs/:id
 */
router.get('/:id', (req: Request, res: Response) => {
  const proof = proofs.find(p => p.id === parseInt(req.params.id));
  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }
  res.json({ proof });
});

/**
 * @route GET /api/proofs
 */
router.get('/', (req: Request, res: Response) => {
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

/**
 * @route POST /api/proofs/verify/:id
 */
router.post('/verify/:id', async (req: Request, res: Response) => {
  try {
    const proof = proofs.find(p => p.id === parseInt(req.params.id));
    if (!proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }

    // Mock verification
    proof.verified = true;
    proof.verifiedAt = new Date().toISOString();
    
    res.json({
      success: true,
      proof,
      message: 'Proof verified successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
