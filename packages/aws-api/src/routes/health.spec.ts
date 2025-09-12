import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { router } from './health';

describe('Health Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/health', router);
  });

  describe('GET /', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        service: 'aws-api',
      });
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const timestamp = response.body.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should return correct content type', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
        expect(response.body.service).toBe('aws-api');
      });
    });

    it('should return fresh timestamp on each request', async () => {
      const response1 = await request(app).get('/health');
      
      // Wait a small amount to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const response2 = await request(app).get('/health');

      expect(response1.body.timestamp).not.toBe(response2.body.timestamp);
      expect(new Date(response1.body.timestamp).getTime()).toBeLessThan(
        new Date(response2.body.timestamp).getTime()
      );
    });

    it('should not accept POST requests', async () => {
      await request(app)
        .post('/health')
        .expect(404);
    });

    it('should not accept PUT requests', async () => {
      await request(app)
        .put('/health')
        .expect(404);
    });

    it('should not accept DELETE requests', async () => {
      await request(app)
        .delete('/health')
        .expect(404);
    });
  });

  describe('Response Structure', () => {
    it('should have exactly 3 properties', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const keys = Object.keys(response.body);
      expect(keys).toHaveLength(3);
      expect(keys).toContain('status');
      expect(keys).toContain('timestamp');
      expect(keys).toContain('service');
    });

    it('should have consistent property types', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(typeof response.body.status).toBe('string');
      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.service).toBe('string');
    });

    it('should return immutable service name', async () => {
      const responses = await Promise.all([
        request(app).get('/health'),
        request(app).get('/health'),
        request(app).get('/health'),
      ]);

      responses.forEach((response) => {
        expect(response.body.service).toBe('aws-api');
      });
    });
  });
});