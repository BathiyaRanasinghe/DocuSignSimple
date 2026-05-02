import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error(err);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message ?? 'Internal server error' });
}
