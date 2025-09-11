import { Injectable } from '@nestjs/common';
import { GrpcClientService } from '../grpc/grpc-client.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AnalysisService {
  private activeSessions = new Map<string, any>();

  constructor(private readonly grpcClient: GrpcClientService) {}

  async startChatSession(sessionId: string) {
    const chat = this.grpcClient.chatWithCode();
    this.activeSessions.set(sessionId, chat);
    
    // 응답 리스너 설정
    chat.responses$.subscribe({
      next: (response) => {
        console.log('Chat response:', response);
      },
      error: (error) => {
        console.error('Chat error:', error);
        this.activeSessions.delete(sessionId);
      },
      complete: () => {
        console.log('Chat session completed');
        this.activeSessions.delete(sessionId);
      },
    });

    return {
      sessionId,
      status: 'active',
    };
  }

  async sendChatMessage(sessionId: string, message: string, contextFiles: string[] = []) {
    const chat = this.activeSessions.get(sessionId);
    if (!chat) {
      throw new Error(`No active session found: ${sessionId}`);
    }

    chat.send({
      session_id: sessionId,
      message,
      context_files: contextFiles,
      metadata: {},
    });

    return {
      sent: true,
      timestamp: new Date().toISOString(),
    };
  }

  async endChatSession(sessionId: string) {
    const chat = this.activeSessions.get(sessionId);
    if (chat) {
      chat.end();
      this.activeSessions.delete(sessionId);
    }

    return {
      sessionId,
      status: 'ended',
    };
  }

  async performAnalysis(sessionId: string, analysisType: string) {
    const progressUpdates: any[] = [];

    return new Promise((resolve, reject) => {
      const subscription = this.grpcClient
        .analyzeCodebase(sessionId, analysisType)
        .subscribe({
          next: (progress) => {
            progressUpdates.push(progress);
            
            // 최종 결과가 포함된 경우
            if (progress.final_result) {
              resolve({
                sessionId,
                analysisType,
                result: progress.final_result,
                progressHistory: progressUpdates,
              });
            }
          },
          error: (error) => {
            reject(error);
          },
          complete: () => {
            if (progressUpdates.length === 0) {
              resolve({
                sessionId,
                analysisType,
                result: null,
                progressHistory: [],
              });
            }
          },
        });
    });
  }
}