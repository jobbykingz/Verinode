import express, { Router } from 'express';
import QuotaController from '../controllers/QuotaController';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../middleware/rbac';

const router: Router = express.Router();

/**
 * Public/Self (for a single tenant to view their current status)
 */
router.get('/status', authenticate, QuotaController.getStatus);

/**
 * Admin: Management and overrides
 */
router.get('/status/:tenantId', authenticate, hasPermission('rbac:manage'), QuotaController.getStatus);
router.get('/history/:tenantId/:resourceType', authenticate, hasPermission('rbac:manage'), QuotaController.getHistory);

/**
 * Admin: Configure limits
 */
router.post('/set', authenticate, hasPermission('rbac:manage'), QuotaController.setQuota);
router.post('/override', authenticate, hasPermission('rbac:manage'), QuotaController.overrideQuota);

export default router;
