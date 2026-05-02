import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import * as ctrl from '../controllers/documents.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

const router = Router();

router.get('/', requireAuth, ctrl.listDocuments);
router.post('/', requireAuth, upload.single('file'), ctrl.uploadDocument);
router.get('/:id', requireAuth, ctrl.getDocument);
router.delete('/:id', requireAuth, ctrl.deleteDocument);
router.post('/:id/signers', requireAuth, ctrl.addSigners);
router.post('/:id/send', requireAuth, ctrl.sendDocument);
router.get('/:id/download', requireAuth, ctrl.downloadDocument);

export default router;
