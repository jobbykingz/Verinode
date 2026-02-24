import express from 'express';
import { expirationController } from '../controllers/expirationController';
import { expirationService } from '../services/expirationService';

const router = express.Router();

router.post('/configure', expirationController.configure);
router.get('/:proofId/status', expirationController.status);
router.post('/:proofId/renew', expirationController.renew);
router.post('/bulk-renew', expirationController.bulkRenew);
router.get('/analytics/summary', expirationController.analytics);

expirationService.startScheduler();

export = router;
