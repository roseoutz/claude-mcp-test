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

  // Handle JSON parsing errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON format',
      });
    }
    
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  return app;
}