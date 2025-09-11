import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { OpenAI } from 'openai';
import { Readable } from 'stream';

const PROTO_PATH = join(__dirname, '../../../shared/proto/analysis.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class AnalysisServiceImpl {
  private sessions: Map<string, any> = new Map();

  async learnCodebase(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ) {
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
        code: grpc.status.INTERNAL,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async analyzeCodebase(call: grpc.ServerWritableStream<any, any>) {
    try {
      const { session_id, analysis_type } = call.request;
      
      // 분석 진행 상황을 스트리밍으로 전송
      const stages = ['parsing', 'analyzing', 'generating'];
      
      for (const stage of stages) {
        for (let i = 0; i <= 100; i += 20) {
          call.write({
            stage,
            progress: i / 100,
            current_file: `file_${i}.ts`,
            message: `Processing ${stage}...`,
          });
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // 최종 결과 전송
      call.write({
        stage: 'complete',
        progress: 1.0,
        message: 'Analysis complete',
        final_result: {
          summary: `${analysis_type} analysis completed`,
          findings: [
            {
              type: analysis_type,
              severity: 'medium',
              file_path: 'src/example.ts',
              line_number: 42,
              description: 'Example finding',
              suggestion: 'Consider refactoring',
            },
          ],
          statistics: {
            total_files: 100,
            issues_found: 5,
          },
        },
      });

      call.end();
    } catch (error) {
      call.destroy(error as Error);
    }
  }

  async searchCode(call: grpc.ServerWritableStream<any, any>) {
    try {
      const { session_id, query, semantic_search } = call.request;
      
      if (semantic_search) {
        // OpenAI 임베딩을 사용한 시맨틱 검색
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query,
        });

        // 여기서는 예시로 몇 개의 결과를 스트리밍
        for (let i = 0; i < 5; i++) {
          call.write({
            file_path: `src/file${i}.ts`,
            line_number: i * 10,
            code_snippet: `// Example code matching: ${query}`,
            relevance_score: 0.95 - i * 0.1,
            explanation: `This code is relevant because it contains ${query}`,
          });
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } else {
        // 일반 텍스트 검색 결과 스트리밍
        for (let i = 0; i < 3; i++) {
          call.write({
            file_path: `src/basic${i}.ts`,
            line_number: i * 5,
            code_snippet: `// Basic match for: ${query}`,
            relevance_score: 0.8,
            explanation: 'Text match found',
          });
        }
      }

      call.end();
    } catch (error) {
      call.destroy(error as Error);
    }
  }

  async chatWithCode(call: grpc.ServerDuplexStream<any, any>) {
    // 양방향 스트리밍 구현
    call.on('data', async (message: any) => {
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

  async analyzeDiff(call: grpc.ServerWritableStream<any, any>) {
    try {
      const { session_id, base_branch, target_branch, include_impact_analysis } = call.request;
      
      // Diff 분석 결과를 스트리밍
      const files = ['src/app.ts', 'src/service.ts', 'src/controller.ts'];
      
      for (const file of files) {
        call.write({
          file_path: file,
          changes: [
            {
              type: 'modified',
              line_number: 10,
              before: 'const old = true;',
              after: 'const new = false;',
              explanation: 'Boolean value changed',
            },
          ],
          impact_summary: include_impact_analysis ? 'Medium impact on system' : '',
          affected_components: include_impact_analysis ? ['ComponentA', 'ComponentB'] : [],
        });
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      call.end();
    } catch (error) {
      call.destroy(error as Error);
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