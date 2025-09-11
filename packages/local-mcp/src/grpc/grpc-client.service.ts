import { Injectable, OnModuleInit } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { Observable, Subject } from 'rxjs';

const PROTO_PATH = join(__dirname, '../../../shared/proto/analysis.proto');

@Injectable()
export class GrpcClientService implements OnModuleInit {
  private client: any;

  onModuleInit() {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto = grpc.loadPackageDefinition(packageDefinition) as any;
    
    const grpcUrl = process.env.GRPC_SERVER_URL || 'localhost:50051';
    this.client = new proto.codeai.AnalysisService(
      grpcUrl,
      grpc.credentials.createInsecure()
    );

    console.log(`gRPC client connected to ${grpcUrl}`);
  }

  // Unary RPC - 단순 학습 요청
  async learnCodebase(repositoryPath: string, branch: string, filePatterns: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.learnCodebase(
        {
          repository_path: repositoryPath,
          branch,
          file_patterns: filePatterns,
          metadata: {},
        },
        (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  // Server Streaming - 분석 진행 상황 받기
  analyzeCodebase(sessionId: string, analysisType: string): Observable<any> {
    const subject = new Subject<any>();
    
    const call = this.client.analyzeCodebase({
      session_id: sessionId,
      analysis_type: analysisType,
      options: {},
    });

    call.on('data', (data: any) => {
      subject.next(data);
    });

    call.on('error', (error: any) => {
      subject.error(error);
    });

    call.on('end', () => {
      subject.complete();
    });

    return subject.asObservable();
  }

  // Server Streaming - 코드 검색
  searchCode(sessionId: string, query: string, semanticSearch: boolean = false): Observable<any> {
    const subject = new Subject<any>();
    
    const call = this.client.searchCode({
      session_id: sessionId,
      query,
      file_types: [],
      max_results: 10,
      semantic_search: semanticSearch,
    });

    call.on('data', (data: any) => {
      subject.next(data);
    });

    call.on('error', (error: any) => {
      subject.error(error);
    });

    call.on('end', () => {
      subject.complete();
    });

    return subject.asObservable();
  }

  // Bidirectional Streaming - 대화형 채팅
  chatWithCode(): { 
    send: (message: any) => void; 
    responses$: Observable<any>;
    end: () => void;
  } {
    const subject = new Subject<any>();
    const call = this.client.chatWithCode();

    call.on('data', (data: any) => {
      subject.next(data);
    });

    call.on('error', (error: any) => {
      subject.error(error);
    });

    call.on('end', () => {
      subject.complete();
    });

    return {
      send: (message: any) => {
        call.write(message);
      },
      responses$: subject.asObservable(),
      end: () => {
        call.end();
      },
    };
  }

  // Server Streaming - Diff 분석
  analyzeDiff(
    sessionId: string, 
    baseBranch: string, 
    targetBranch: string,
    includeImpactAnalysis: boolean = false
  ): Observable<any> {
    const subject = new Subject<any>();
    
    const call = this.client.analyzeDiff({
      session_id: sessionId,
      base_branch: baseBranch,
      target_branch: targetBranch,
      include_impact_analysis: includeImpactAnalysis,
    });

    call.on('data', (data: any) => {
      subject.next(data);
    });

    call.on('error', (error: any) => {
      subject.error(error);
    });

    call.on('end', () => {
      subject.complete();
    });

    return subject.asObservable();
  }
}