import express from 'express';
import cors from 'cors';
import { router as analysisRouter } from './routes/analysis';
import { router as healthRouter } from './routes/health';

// Test-only app factory that doesn't start servers
export default function createTestApp(): express.Application {
  const app = express();

  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:*'],
    credentials: true,
  }));

  app.use(express.json());

  app.use('/health', healthRouter);
  app.use('/api/v1/analysis', analysisRouter);

  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  return app;
}