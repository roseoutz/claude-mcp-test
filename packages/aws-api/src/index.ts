import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ApiResponse } from '@code-ai/shared';
import { router as healthRouter } from './routes/health.js';
import { router as codeAnalysisRouter } from './routes/code-analysis.js';
import { router as codeSearchRouter } from './routes/code-search.js';
import { router as testBugsRouter } from './routes/test-bugs.js';
import { startGrpcServer } from './grpc/grpc.server.js';

const app = express();
const HTTP_PORT = process.env.PORT || 3000;
const GRPC_PORT = process.env.GRPC_PORT || 50051;

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:*'],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));

app.use('/health', healthRouter);
app.use('/api/v1/analyze', codeAnalysisRouter);
app.use('/api/v1/search', codeSearchRouter);
app.use('/api/test/bugs', testBugsRouter);

app.use((err: Error, req: express.Request, res: express.Response<ApiResponse>, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// HTTP 서버 시작
app.listen(HTTP_PORT, () => {
  console.log(`AWS API HTTP Server running on port ${HTTP_PORT}`);
});

// gRPC 서버 시작
startGrpcServer(Number(GRPC_PORT));
console.log(`AWS API gRPC Server starting on port ${GRPC_PORT}`);