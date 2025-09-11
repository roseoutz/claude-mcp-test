import { describe, it, expect } from 'vitest';
import {
  MCPError,
  ValidationError,
  GitOperationError,
  AIServiceError,
  FileSystemError,
  NetworkError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  isOperationalError,
  formatError,
  getStatusCode,
} from '../../types/errors.js';

describe('Error Classes', () => {
  describe('MCPError', () => {
    it('should create base error with correct properties', () => {
      const error = new MCPError('Test error', 'TEST_ERROR', 500, { foo: 'bar' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MCPError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.name).toBe('MCPError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new MCPError('Test error', 'TEST_ERROR', 500);
      const json = error.toJSON();
      
      expect(json).toHaveProperty('name', 'MCPError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('code', 'TEST_ERROR');
      expect(json).toHaveProperty('statusCode', 500);
      expect(json).toHaveProperty('stack');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field info', () => {
      const error = new ValidationError('Invalid email', 'email', 'not-an-email');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(MCPError);
      expect(error.message).toBe('Invalid email');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe('email');
      expect(error.value).toBe('not-an-email');
    });
  });

  describe('GitOperationError', () => {
    it('should create git operation error', () => {
      const error = new GitOperationError('Failed to clone', 'clone', '/path/to/repo');
      
      expect(error).toBeInstanceOf(GitOperationError);
      expect(error.code).toBe('GIT_OPERATION_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.operation).toBe('clone');
      expect(error.repository).toBe('/path/to/repo');
    });
  });

  describe('AIServiceError', () => {
    it('should create AI service error', () => {
      const error = new AIServiceError('API limit exceeded', 'openai', 'gpt-4');
      
      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('AI_SERVICE_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.service).toBe('openai');
      expect(error.model).toBe('gpt-4');
    });
  });

  describe('FileSystemError', () => {
    it('should create filesystem error', () => {
      const error = new FileSystemError('File not found', '/path/to/file', 'read');
      
      expect(error).toBeInstanceOf(FileSystemError);
      expect(error.code).toBe('FILE_SYSTEM_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.path).toBe('/path/to/file');
      expect(error.operation).toBe('read');
    });
  });

  describe('NetworkError', () => {
    it('should create network error', () => {
      const error = new NetworkError('Connection refused', 'http://api.example.com', 'GET');
      
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.url).toBe('http://api.example.com');
      expect(error.method).toBe('GET');
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Invalid token', 'bearer');
      
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error.realm).toBe('bearer');
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error', () => {
      const error = new AuthorizationError('Access denied', 'repository', 'write');
      
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.statusCode).toBe(403);
      expect(error.resource).toBe('repository');
      expect(error.action).toBe('write');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error', () => {
      const error = new NotFoundError('Repository not found', 'repository:123');
      
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.statusCode).toBe(404);
      expect(error.resource).toBe('repository:123');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError('Too many requests', 60);
      
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('Request timeout', 30000);
      
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.statusCode).toBe(408);
      expect(error.timeout).toBe(30000);
    });
  });

  describe('Error utility functions', () => {
    it('should identify operational errors', () => {
      const mcpError = new MCPError('Test', 'TEST', 500);
      const regularError = new Error('Regular error');
      
      expect(isOperationalError(mcpError)).toBe(true);
      expect(isOperationalError(regularError)).toBe(false);
    });

    it('should format errors correctly', () => {
      const mcpError = new MCPError('Test error', 'TEST_ERROR');
      const regularError = new Error('Regular error');
      const stringError = 'String error';
      
      expect(formatError(mcpError)).toBe('[TEST_ERROR] Test error');
      expect(formatError(regularError)).toBe('Regular error');
      expect(formatError(stringError)).toBe('String error');
      expect(formatError(null)).toBe('null');
      expect(formatError(undefined)).toBe('undefined');
    });

    it('should get correct status codes', () => {
      const mcpError = new MCPError('Test', 'TEST', 400);
      const notFoundError = new NotFoundError('Not found');
      const regularError = new Error('Regular');
      
      expect(getStatusCode(mcpError)).toBe(400);
      expect(getStatusCode(notFoundError)).toBe(404);
      expect(getStatusCode(regularError)).toBe(500);
    });
  });
});