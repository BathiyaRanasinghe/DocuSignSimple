import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as documentService from '../services/document.service';

export async function listDocuments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const docs = await documentService.listByOwner(req.user!.id);
    res.json({ data: docs });
  } catch (err) { next(err); }
}

export async function uploadDocument(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file provided' });
      return;
    }
    const doc = await documentService.upload({
      ownerId: req.user!.id,
      title: req.body.title || req.file.originalname,
      buffer: req.file.buffer,
    });
    res.status(201).json({ data: doc });
  } catch (err) { next(err); }
}

export async function getDocument(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const doc = await documentService.getById(req.params.id, req.user!.id);
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }
    res.json({ data: doc });
  } catch (err) { next(err); }
}

export async function deleteDocument(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await documentService.remove(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function addSigners(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { signers } = req.body;
    if (!Array.isArray(signers) || signers.length === 0) {
      res.status(400).json({ error: 'signers array is required' });
      return;
    }
    const result = await documentService.addSigners(req.params.id, req.user!.id, signers);
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
}

export async function sendDocument(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await documentService.send(req.params.id, req.user!.id);
    res.json({ message: 'Document sent for signing' });
  } catch (err) { next(err); }
}

export async function downloadDocument(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const url = await documentService.getDownloadUrl(req.params.id, req.user!.id);
    res.json({ data: { url } });
  } catch (err) { next(err); }
}
