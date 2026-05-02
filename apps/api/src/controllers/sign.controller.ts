import { Request, Response, NextFunction } from 'express';
import * as signingService from '../services/signing.service';

export async function getSigningSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await signingService.getSession(req.params.token);

    if (!session) {
      res.status(404).json({ error: 'Invalid or expired signing link' });
      return;
    }

    // Return special states as 200 with flags so the frontend can handle them
    res.json({ data: session });
  } catch (err) { next(err); }
}

export async function submitSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const { placements } = req.body;

    if (!Array.isArray(placements) || placements.length === 0) {
      res.status(400).json({ error: 'placements array is required' });
      return;
    }

    for (const p of placements) {
      if (!p.signature_data_url || p.page_number == null || p.x == null || p.y == null) {
        res.status(400).json({ error: 'Each placement requires page_number, x, y, and signature_data_url' });
        return;
      }
    }

    const result = await signingService.submitSignature(req.params.token, placements);
    res.json({ data: result });
  } catch (err) { next(err); }
}
