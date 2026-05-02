import { Request, Response, NextFunction } from 'express';
import { supabaseAnon } from '../lib/supabase';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  req.user = { id: data.user.id, email: data.user.email! };
  next();
}
