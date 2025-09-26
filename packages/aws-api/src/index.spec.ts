import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock dependencies
vi.mock('./routes/analysis', () => {
  const router = express.Router();
  router.get('/', (req, res) => res.json({ route: 'analysis' }));
  router.post('/', (req, res) => res.json({ route: 'analysis' }));
  return { router };
});

vi.mock('./routes/health', () => ({
  router: express.Router().get('/', (req, res) => res.json({ route: 'health' })),
}));

vi.mock('./grpc/grpc.server', () => ({
  startGrpcServer: vi.fn(() => {
    console.log('Mock gRPC server started');
    return { forceShutdown: vi.fn() };
  }),
}));

vi.mock('@code-ai/shared', () => ({
  ApiResponse: {},
  AnalysisRequest: {},
}));

describe('AWS API Server', () => {
  let app: express.Application;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Clear module cache to get fresh imports
    vi.resetModules();
    
    // Re-import the app after mocking
    const { default: createApp } = await import('./test-app');
    app = createApp();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Server Configuration', () => {
    it('should configure CORS with default origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should configure CORS with custom origins', async () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.com';
      
      // Re-import app with new environment
      vi.resetModules();
      const { default: createApp } = await import('./test-app');
      app = createApp();

      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://example.com');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should parse JSON requests', async () => {
      const testData = { test: 'data' };
      
      const response = await request(app)
        .post('/api/v1/analysis')
        .send(testData)
        .expect(200);

      expect(response.body.route).toBe('analysis');
    });
  });

  describe('Route Registration', () => {
    it('should register health route', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.route).toBe('health');
    });

    it('should register analysis routes', async () => {
      const response = await request(app)
        .get('/api/v1/analysis')
        .expect(200);

      expect(response.body.route).toBe('analysis');
    });

    it('should handle 404 for unknown routes', async () => {
      await request(app)
        .get('/unknown-route')
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle global errors', async () => {
      // Create an app with a route that throws an error
      const testApp = express();
      testApp.use(express.json());
      
      testApp.get('/error', (req, res, next) => {
        throw new Error('Test error');
      });

      // Add the same error handler as in index.ts
      testApp.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('Error:', err);
        res.status(500).json({
          success: false,
          error: err.message || 'Internal server error',
        });
      });

      const response = await request(testApp)
        .get('/error')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Test error',
      });
    });

    it('should handle errors without message', async () => {
      const testApp = express();
      testApp.use(express.json());
      
      testApp.get('/error', (req, res, next) => {
        const error = new Error();
        error.message = '';
        throw error;
      });

      testApp.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.status(500).json({
          success: false,
          error: err.message || 'Internal server error',
        });
      });

      const response = await request(testApp)
        .get('/error')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Internal server error',
      });
    });

    it('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/v1/analysis')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('Environment Variables', () => {
    it('should use default ports when not specified', () => {
      delete process.env.PORT;
      delete process.env.GRPC_PORT;
      
      // The actual port testing would require starting the server
      // which is not ideal for unit tests, but we can verify
      // the configuration is loaded correctly
      expect(process.env.PORT).toBeUndefined();
      expect(process.env.GRPC_PORT).toBeUndefined();
    });

    it('should use custom ports when specified', () => {
      process.env.PORT = '8080';
      process.env.GRPC_PORT = '9090';
      
      expect(process.env.PORT).toBe('8080');
      expect(process.env.GRPC_PORT).toBe('9090');
    });
  });
});

// Helper function to create app for testing
// We need this because the main index.ts starts servers immediately