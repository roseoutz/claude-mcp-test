import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OpenAI } from 'openai';
import { Readable } from 'stream';
import { AnalysisService } from '../services/analysis.service';
import { StorageService } from '../services/storage.service';
import {
  LearnRequest,
  LearnResponse,
  AnalyzeRequest,
  AnalyzeProgress,
  SearchRequest,
  SearchResult,
  ChatMessage,
  ChatResponse,
  DiffRequest,
  DiffResult,
  SessionData,
} from '../types/grpc.types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROTO_PATH = join(__dirname, '../../../shared/proto/analysis.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

interface ProtoGrpcType {
  codeai: {
    AnalysisService: {
      service: grpc.ServiceDefinition;
    };
  };
}

const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class AnalysisServiceImpl {
  private sessions: Map<string, SessionData> = new Map();
  private analysisService: AnalysisService;
  private storageService: StorageService;

  constructor() {
    this.analysisService = new AnalysisService();
    this.storageService = new StorageService();
  }

  async learnCodebase(
    call: grpc.ServerUnaryCall<LearnRequest, LearnResponse>,
    callback: grpc.sendUnaryData<LearnResponse>
  ): Promise<void> {
    try {
      const { repository_path, branch, file_patterns } = call.request;
      const sessionId = `session_${Date.now()}`;

      // AnalysisService를 사용하여 실제 학습 수행
      const result = await this.analysisService.startLearning(
        sessionId,
        repository_path,
        branch,
        file_patterns
      );

      const response: LearnResponse = {
        success: true,
        session_id: sessionId,
        files_processed: result.filesProcessed || 0,
        total_size_bytes: result.totalSize || 0,
        message: result.message || 'Learning completed',
      };

      callback(null, response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
        details: errorMessage,
      } as grpc.ServiceError);
    }
  }

  async analyzeCodebase(call: grpc.ServerWritableStream<AnalyzeRequest, AnalyzeProgress>): Promise<void> {
    try {
      const { session_id, analysis_type } = call.request;

      // AnalysisService를 사용하여 실제 분석 수행
      const analysisResult = await this.analysisService.analyzeCode(session_id, analysis_type);

      // 최종 결과 전송
      const finalProgress: AnalyzeProgress = {
        stage: 'complete',
        progress: 1.0,
        current_file: '',
        message: 'Analysis complete',
        final_result: analysisResult.result,
      };

      call.write(finalProgress);
      call.end();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      call.destroy(err);
    }
  }

  async searchCode(call: grpc.ServerWritableStream<SearchRequest, SearchResult>): Promise<void> {
    try {
      const { session_id, query, semantic_search } = call.request;

      // AnalysisService를 사용하여 검색 수행
      const results = await this.analysisService.searchCode(session_id, query, semantic_search);

      // 결과를 스트리밍으로 전송
      for (const result of results) {
        const searchResult: SearchResult = {
          file_path: result.file || result.filePath || '',
          line_number: result.line || result.lineNumber || 0,
          code_snippet: result.content || result.code || '',
          relevance_score: result.score || result.similarity || 0,
          explanation: result.explanation || '',
        };
        call.write(searchResult);
      }

      call.end();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      call.destroy(err);
    }
  }

  async chatWithCode(call: grpc.ServerDuplexStream<ChatMessage, ChatResponse>): Promise<void> {
    // 양방향 스트리밍 구현
    call.on('data', async (message: ChatMessage) => {
      try {
        const { session_id, message: userMessage, context_files } = message;
        
        // OpenAI 스트리밍 응답 구현
        const stream = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a code analysis assistant.',
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          stream: true,
        });

        let fullResponse = '';
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          fullResponse += content;
          
          if (content) {
            call.write({
              response: content,
              references: [],
              is_complete: false,
              thinking_process: '',
            });
          }
        }

        // 완료 메시지 전송
        call.write({
          response: '',
          references: [
            {
              file_path: context_files?.[0] || 'src/example.ts',
              start_line: 1,
              end_line: 10,
              snippet: '// Referenced code',
              relevance: 'High relevance to the question',
            },
          ],
          is_complete: true,
          thinking_process: 'Analysis completed successfully',
        });
      } catch (error) {
        console.error('Chat error:', error);
      }
    });

    call.on('end', () => {
      call.end();
    });
  }

  async analyzeDiff(call: grpc.ServerWritableStream<DiffRequest, DiffResult>): Promise<void> {
    try {
      const { session_id, base_branch, target_branch, include_impact_analysis } = call.request;

      // AnalysisService를 사용하여 Diff 분석 수행
      const diffResults = await this.analysisService.analyzeDiff(
        session_id,
        base_branch,
        target_branch,
        include_impact_analysis
      );

      // 결과를 스트리밍으로 전송
      for (const result of diffResults) {
        const diffResult: DiffResult = {
          file_path: result.filePath || result.file_path || '',
          changes: result.changes || [],
          impact_summary: result.impactSummary || result.impact_summary,
          affected_components: result.affectedComponents || result.affected_components || [],
        };
        call.write(diffResult);
      }

      call.end();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      call.destroy(err);
    }
  }
}

export function startGrpcServer(port: number = 50051): grpc.Server {
  const server = new grpc.Server();
  const serviceImpl = new AnalysisServiceImpl();

  server.addService(proto.codeai.AnalysisService.service, {
    learnCodebase: serviceImpl.learnCodebase.bind(serviceImpl),
    analyzeCodebase: serviceImpl.analyzeCodebase.bind(serviceImpl),
    searchCode: serviceImpl.searchCode.bind(serviceImpl),
    chatWithCode: serviceImpl.chatWithCode.bind(serviceImpl),
    analyzeDiff: serviceImpl.analyzeDiff.bind(serviceImpl),
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Failed to start gRPC server:', error);
        return;
      }
      console.log(`gRPC server listening on port ${port}`);
    }
  );

  return server;
}