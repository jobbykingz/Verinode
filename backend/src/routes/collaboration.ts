import { Router } from 'express';
import { CollaborationController } from '../controllers/CollaborationController';
// import { authenticate } from '../middleware/auth'; // Ensure this exists in your project

const router = Router();

router.get('/session/:proofId', CollaborationController.getSession);
router.get('/comments/:proofId', CollaborationController.getComments);
router.post('/comments/:proofId', CollaborationController.addComment);

export default router;