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
  const allowedOrigins = env.FRONTEND_URL.split(',').map(s => s.trim());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // server-to-server / curl
      const ok = allowedOrigins.some(a =>
        a.startsWith('*.') ? origin.endsWith(a.slice(1)) : a === origin
      );
      callback(ok ? null : new Error('Not allowed by CORS'), ok);
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(pinoHttp());

  app.use('/api', router);
  app.use(errorHandler);

  return app;
}
