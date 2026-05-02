import { Router } from 'express';
import healthRouter from './health';
import documentsRouter from './documents';
import signRouter from './sign';

export const router = Router();

router.use('/health', healthRouter);
router.use('/documents', documentsRouter);
router.use('/sign', signRouter);
