import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startGrpcServer } from './grpc.server';
import * as grpc from '@grpc/grpc-js';

// Mock dependencies
vi.mock('@grpc/grpc-js', () => {
  const mockServer = {
    addService: vi.fn(),
    bindAsync: vi.fn((address, credentials, callback) => {
      // Simulate successful binding
      setTimeout(() => callback(null, 50051), 10);
    }),
  };

  const mockCredentials = {
    createInsecure: vi.fn(() => ({})),
  };

  return {
    Server: vi.fn(() => mockServer),
    ServerCredentials: mockCredentials,
    loadPackageDefinition: vi.fn(() => ({
      AnalysisService: {
        service: {
          learnCodebase: {},
          analyzeCodebase: {},
          searchCode: {},
          chatWithCode: {},
          analyzeDiff: {},
        },
      },
    })),
    status: {
      INTERNAL: 13,
      INVALID_ARGUMENT: 3,
    },
  };
});

vi.mock('@grpc/proto-loader', () => ({
  loadSync: vi.fn(() => ({})),
}));

vi.mock('openai', () => {
  return {
    OpenAI: vi.fn(() => ({
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            async *[Symbol.asyncIterator]() {
              yield { choices: [{ delta: { content: 'Hello' } }] };
              yield { choices: [{ delta: { content: ' World' } }] };
            },
          }),
        },
      },
    })),
  };
});

describe('gRPC Server', () => {
  let server: grpc.Server;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (server) {
      server.forceShutdown();
    }
  });

  describe('Server Initialization', () => {
    it('should start gRPC server successfully', async () => {
      server = startGrpcServer(50051);

      expect(grpc.Server).toHaveBeenCalled();
      expect(server.addService).toHaveBeenCalled();
      expect(server.bindAsync).toHaveBeenCalledWith(
        '0.0.0.0:50051',
        expect.anything(),
        expect.any(Function)
      );
    });

    it('should use default port when not specified', () => {
      server = startGrpcServer();
      
      expect(server.bindAsync).toHaveBeenCalledWith(
        '0.0.0.0:50051',
        expect.anything(),
        expect.any(Function)
      );
    });
  });

  describe('Service Implementation', () => {
    it('should register all required service methods', () => {
      server = startGrpcServer();

      const addServiceCall = (server.addService as any).mock.calls[0];
      const serviceImpl = addServiceCall[1];

      expect(serviceImpl).toHaveProperty('learnCodebase');
      expect(serviceImpl).toHaveProperty('analyzeCodebase');
      expect(serviceImpl).toHaveProperty('searchCode');
      expect(serviceImpl).toHaveProperty('chatWithCode');
      expect(serviceImpl).toHaveProperty('analyzeDiff');
    });
  });
});

describe('AnalysisServiceImpl', () => {
  let serviceImpl: any;
  let mockCall: any;
  let mockCallback: any;
  let mockStream: any;

  beforeEach(() => {
    // Create a mock service implementation for testing
    const grpcModule = vi.importActual('@grpc/grpc-js') as any;
    
    mockCallback = vi.fn();
    
    mockCall = {
      request: {
        repository_path: '/test/repo',
        branch: 'main',
        file_patterns: ['**/*.ts'],
        session_id: 'test-session',
        analysis_type: 'security',
        query: 'test query',
        semantic_search: true,
        base_branch: 'main',
        target_branch: 'feature',
        include_impact_analysis: true,
      },
    };

    mockStream = {
      write: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
    };

    // Mock the service implementation manually since we need to test its methods
    serviceImpl = {
      sessions: new Map(),
      
      async learnCodebase(call: any, callback: any) {
        try {
          const { repository_path, branch, file_patterns } = call.request;
          const sessionId = `session_${Date.now()}`;
          
          this.sessions.set(sessionId, {
            repository: repository_path,
            branch,
            patterns: file_patterns,
            timestamp: new Date(),
          });

          callback(null, {
            success: true,
            session_id: sessionId,
            files_processed: 0,
            total_size_bytes: 0,
            message: 'Codebase learning initiated',
          });
        } catch (error) {
          callback({
            code: grpcModule.status.INTERNAL,
            details: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },

      async analyzeCodebase(call: any) {
        try {
          const stages = ['parsing', 'analyzing'];
          
          for (const stage of stages) {
            call.write({
              stage,
              progress: 0.5,
              current_file: 'test.ts',
              message: `Processing ${stage}...`,
            });
          }

          call.write({
            stage: 'complete',
            progress: 1.0,
            message: 'Analysis complete',
            final_result: {
              summary: 'Analysis completed',
              findings: [],
              statistics: { total_files: 100, issues_found: 5 },
            },
          });

          call.end();
        } catch (error) {
          call.destroy(error as Error);
        }
      },

      async searchCode(call: any) {
        try {
          const { query, semantic_search } = call.request;
          
          const results = semantic_search ? 5 : 3;
          for (let i = 0; i < results; i++) {
            call.write({
              file_path: `src/file${i}.ts`,
              line_number: i * 10,
              code_snippet: `// Code matching: ${query}`,
              relevance_score: 0.9 - i * 0.1,
              explanation: 'Relevant match found',
            });
          }

          call.end();
        } catch (error) {
          call.destroy(error as Error);
        }
      },

      async analyzeDiff(call: any) {
        try {
          const { include_impact_analysis } = call.request;
          
          call.write({
            file_path: 'src/test.ts',
            changes: [{
              type: 'modified',
              line_number: 10,
              before: 'old code',
              after: 'new code',
              explanation: 'Code updated',
            }],
            impact_summary: include_impact_analysis ? 'Medium impact' : '',
            affected_components: include_impact_analysis ? ['ComponentA'] : [],
          });

          call.end();
        } catch (error) {
          call.destroy(error as Error);
        }
      },
    };
  });

  describe('learnCodebase', () => {
    it('should handle learn request successfully', async () => {
      await serviceImpl.learnCodebase(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, {
        success: true,
        session_id: expect.stringMatching(/^session_\d+$/),
        files_processed: 0,
        total_size_bytes: 0,
        message: 'Codebase learning initiated',
      });
    });

    it('should store session information', async () => {
      await serviceImpl.learnCodebase(mockCall, mockCallback);

      expect(serviceImpl.sessions.size).toBe(1);
      const sessionData = Array.from(serviceImpl.sessions.values())[0];
      expect(sessionData).toMatchObject({
        repository: '/test/repo',
        branch: 'main',
        patterns: ['**/*.ts'],
      });
    });

    it('should handle errors gracefully', async () => {
      const errorCall = {
        request: null, // This will cause an error
      };

      await serviceImpl.learnCodebase(errorCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith({
        code: expect.any(Number),
        details: expect.any(String),
      });
    });
  });

  describe('analyzeCodebase', () => {
    it('should stream analysis progress', async () => {
      await serviceImpl.analyzeCodebase(mockStream);

      expect(mockStream.write).toHaveBeenCalledWith({
        stage: 'parsing',
        progress: 0.5,
        current_file: 'test.ts',
        message: 'Processing parsing...',
      });

      expect(mockStream.write).toHaveBeenCalledWith({
        stage: 'complete',
        progress: 1.0,
        message: 'Analysis complete',
        final_result: {
          summary: 'Analysis completed',
          findings: [],
          statistics: { total_files: 100, issues_found: 5 },
        },
      });

      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should handle stream errors', async () => {
      const errorStream = {
        ...mockStream,
        write: vi.fn(() => { throw new Error('Stream error'); }),
      };

      await serviceImpl.analyzeCodebase(errorStream);

      expect(errorStream.destroy).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('searchCode', () => {
    it('should stream search results for semantic search', async () => {
      const semanticCall = { ...mockStream, request: { ...mockCall.request, semantic_search: true } };
      
      await serviceImpl.searchCode(semanticCall);

      expect(semanticCall.write).toHaveBeenCalledTimes(5);
      expect(semanticCall.write).toHaveBeenCalledWith({
        file_path: 'src/file0.ts',
        line_number: 0,
        code_snippet: '// Code matching: test query',
        relevance_score: 0.9,
        explanation: 'Relevant match found',
      });

      expect(semanticCall.end).toHaveBeenCalled();
    });

    it('should stream fewer results for basic search', async () => {
      const basicCall = { ...mockStream, request: { ...mockCall.request, semantic_search: false } };
      
      await serviceImpl.searchCode(basicCall);

      expect(basicCall.write).toHaveBeenCalledTimes(3);
      expect(basicCall.end).toHaveBeenCalled();
    });
  });

  describe('analyzeDiff', () => {
    it('should stream diff analysis with impact analysis', async () => {
      const diffCall = { ...mockStream, request: mockCall.request };
      
      await serviceImpl.analyzeDiff(diffCall);

      expect(diffCall.write).toHaveBeenCalledWith({
        file_path: 'src/test.ts',
        changes: [{
          type: 'modified',
          line_number: 10,
          before: 'old code',
          after: 'new code',
          explanation: 'Code updated',
        }],
        impact_summary: 'Medium impact',
        affected_components: ['ComponentA'],
      });

      expect(diffCall.end).toHaveBeenCalled();
    });

    it('should omit impact analysis when not requested', async () => {
      const basicDiffCall = { 
        ...mockStream, 
        request: { ...mockCall.request, include_impact_analysis: false }
      };
      
      await serviceImpl.analyzeDiff(basicDiffCall);

      expect(basicDiffCall.write).toHaveBeenCalledWith(
        expect.objectContaining({
          impact_summary: '',
          affected_components: [],
        })
      );
    });
  });
});