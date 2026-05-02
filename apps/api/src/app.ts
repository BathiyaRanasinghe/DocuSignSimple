import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '50mb' }));
  app.use(pinoHttp());

  app.use('/api', router);
  app.use(errorHandler);

  return app;
}
