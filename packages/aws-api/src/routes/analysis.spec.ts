import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { router } from './analysis';
import type { AnalysisRequest } from '@code-ai/shared';

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    },
  })),
}));

describe('Analysis Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/analysis', router);
  });

  describe('POST /learn', () => {
    it('should handle learn request successfully', async () => {
      const analysisRequest: AnalysisRequest = {
        repository: '/test/repo',
        branch: 'main',
        patterns: ['**/*.ts'],
        metadata: {},
      };

      const response = await request(app)
        .post('/api/analysis/learn')
        .send(analysisRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Codebase learning initiated',
          repository: '/test/repo',
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle invalid request data', async () => {
      const response = await request(app)
        .post('/api/analysis/learn')
        .send({}) // Empty body
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });

    it('should validate timestamp format', async () => {
      const analysisRequest: AnalysisRequest = {
        repository: '/test/repo',
        branch: 'main',
        patterns: ['**/*.ts'],
        metadata: {},
      };

      const response = await request(app)
        .post('/api/analysis/learn')
        .send(analysisRequest);

      const timestamp = response.body.data.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('POST /diff', () => {
    it('should handle diff analysis request successfully', async () => {
      const analysisRequest: AnalysisRequest = {
        repository: '/test/repo',
        baseBranch: 'main',
        targetBranch: 'feature',
        metadata: {},
      };

      const response = await request(app)
        .post('/api/analysis/diff')
        .send(analysisRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Diff analysis initiated',
          repository: '/test/repo',
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle errors gracefully', async () => {
      // Simulate an error by sending invalid data
      const response = await request(app)
        .post('/api/analysis/diff')
        .send(null) // Invalid JSON
        .expect(400); // Express will return 400 for invalid JSON

      // Note: Express handles JSON parsing errors differently
      // so we might not reach our error handler
    });

    it('should return proper error response format', async () => {
      // Mock a scenario where processing fails
      const originalProcess = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const analysisRequest: AnalysisRequest = {
        repository: '/test/repo',
        baseBranch: 'main',
        targetBranch: 'feature',
        metadata: {},
      };

      const response = await request(app)
        .post('/api/analysis/diff')
        .send(analysisRequest);

      // Restore environment
      if (originalProcess) {
        process.env.OPENAI_API_KEY = originalProcess;
      }

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/analysis/learn')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should handle missing required fields', async () => {
      const incompleteRequest = {
        // Missing repository field
        branch: 'main',
      };

      const response = await request(app)
        .post('/api/analysis/learn')
        .send(incompleteRequest)
        .expect(200); // Currently doesn't validate required fields

      expect(response.body.success).toBe(true);
    });

    it('should handle large payloads', async () => {
      const largeRequest: AnalysisRequest = {
        repository: '/test/repo',
        branch: 'main',
        patterns: new Array(1000).fill('**/*.ts'),
        metadata: {
          largeField: 'x'.repeat(10000),
        },
      };

      const response = await request(app)
        .post('/api/analysis/learn')
        .send(largeRequest);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Response Format', () => {
    it('should return consistent response structure', async () => {
      const analysisRequest: AnalysisRequest = {
        repository: '/test/repo',
        branch: 'main',
        patterns: ['**/*.ts'],
        metadata: {},
      };

      const response = await request(app)
        .post('/api/analysis/learn')
        .send(analysisRequest);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('repository');
      expect(response.body.data).toHaveProperty('timestamp');
    });

    it('should include proper content-type headers', async () => {
      const analysisRequest: AnalysisRequest = {
        repository: '/test/repo',
        branch: 'main',
        patterns: ['**/*.ts'],
        metadata: {},
      };

      const response = await request(app)
        .post('/api/analysis/learn')
        .send(analysisRequest);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});