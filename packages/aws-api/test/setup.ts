import { vi } from 'vitest';

// Global test setup for aws-api package
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.AWS_REGION = 'us-east-1';
  process.env.DYNAMODB_TABLE = 'test-table';
  process.env.S3_BUCKET = 'test-bucket';
  process.env.GRPC_PORT = '50051';

  // Mock AWS SDK clients
  vi.mock('@aws-sdk/client-s3');
  vi.mock('@aws-sdk/client-dynamodb');
  vi.mock('@aws-sdk/lib-dynamodb');
  
  // Mock OpenAI
  vi.mock('openai');
  
  // Mock gRPC modules
  vi.mock('@grpc/grpc-js');
  vi.mock('@grpc/proto-loader');
});

afterAll(() => {
  // Cleanup after all tests
  vi.clearAllMocks();
});

afterEach(() => {
  // Reset mocks between tests
  vi.resetAllMocks();
});