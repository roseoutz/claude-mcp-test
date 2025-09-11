import { Controller, Post, Body, Param, Delete, Sse } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { GrpcClientService } from '../grpc/grpc-client.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly grpcClient: GrpcClientService,
  ) {}

  @Post('learn')
  async learnCodebase(@Body() body: {
    repository: string;
    branch?: string;
    patterns?: string[];
  }) {
    const { repository, branch = 'main', patterns = ['**/*.{js,ts,jsx,tsx}'] } = body;
    return await this.grpcClient.learnCodebase(repository, branch, patterns);
  }

  @Sse('analyze/:sessionId/stream')
  analyzeStream(@Param('sessionId') sessionId: string): Observable<any> {
    return this.grpcClient.analyzeCodebase(sessionId, 'architecture').pipe(
      map((data) => ({ data }))
    );
  }

  @Post('analyze')
  async analyze(@Body() body: {
    sessionId: string;
    analysisType: string;
  }) {
    return await this.analysisService.performAnalysis(body.sessionId, body.analysisType);
  }

  @Sse('search/:sessionId/stream')
  searchStream(
    @Param('sessionId') sessionId: string,
    @Body() body: { query: string; semantic?: boolean }
  ): Observable<any> {
    return this.grpcClient.searchCode(sessionId, body.query, body.semantic).pipe(
      map((data) => ({ data }))
    );
  }

  @Post('chat/start')
  async startChat(@Body() body: { sessionId: string }) {
    return await this.analysisService.startChatSession(body.sessionId);
  }

  @Post('chat/:sessionId/message')
  async sendChatMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string; contextFiles?: string[] }
  ) {
    return await this.analysisService.sendChatMessage(
      sessionId,
      body.message,
      body.contextFiles
    );
  }

  @Delete('chat/:sessionId')
  async endChat(@Param('sessionId') sessionId: string) {
    return await this.analysisService.endChatSession(sessionId);
  }

  @Sse('diff/:sessionId/stream')
  diffStream(
    @Param('sessionId') sessionId: string,
    @Body() body: {
      baseBranch: string;
      targetBranch: string;
      includeImpact?: boolean;
    }
  ): Observable<any> {
    return this.grpcClient
      .analyzeDiff(sessionId, body.baseBranch, body.targetBranch, body.includeImpact)
      .pipe(map((data) => ({ data })));
  }
}