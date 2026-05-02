import { Router } from 'express';
import * as ctrl from '../controllers/sign.controller';

const router = Router();

// Public routes — no JWT required
router.get('/:token', ctrl.getSigningSession);
router.post('/:token', ctrl.submitSignature);

export default router;
