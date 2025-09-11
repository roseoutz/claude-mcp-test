/**
 * Inbound Ports (Primary Ports)
 * 애플리케이션 외부에서 내부로 들어오는 인터페이스
 * Use Cases를 통해 비즈니스 로직을 실행
 */

import type { 
  LearnCodebaseInput, 
  AnalyzeDiffInput, 
  SearchCodeInput, 
  ExplainFeatureInput,
  AnalyzeImpactInput 
} from '../../../types/mcp.js';
import type { 
  CodebaseAnalysis, 
  BranchDiff, 
  ImpactAnalysis 
} from '../../../types/analysis.js';

/**
 * 코드베이스 학습 Use Case
 */
export interface ILearnCodebaseUseCase {
  execute(input: LearnCodebaseInput): Promise<{
    sessionId: string;
    analysis: CodebaseAnalysis;
  }>;
}

/**
 * 브랜치 차이 분석 Use Case
 */
export interface IAnalyzeDiffUseCase {
  execute(input: AnalyzeDiffInput): Promise<BranchDiff>;
}

/**
 * 코드 검색 Use Case
 */
export interface ISearchCodeUseCase {
  execute(input: SearchCodeInput): AsyncIterable<{
    filePath: string;
    lineNumber: number;
    snippet: string;
    relevance: number;
  }>;
}

/**
 * 기능 설명 Use Case
 */
export interface IExplainFeatureUseCase {
  execute(input: ExplainFeatureInput): Promise<{
    featureId: string;
    explanation: string;
    codeExamples?: Array<{
      filePath: string;
      snippet: string;
      description: string;
    }>;
  }>;
}

/**
 * 영향도 분석 Use Case
 */
export interface IAnalyzeImpactUseCase {
  execute(input: AnalyzeImpactInput): Promise<ImpactAnalysis>;
}

/**
 * 대화형 채팅 Use Case
 */
export interface IChatWithCodeUseCase {
  startSession(sessionId: string): Promise<void>;
  sendMessage(sessionId: string, message: string, context?: string[]): Promise<void>;
  receiveMessages(sessionId: string): AsyncIterable<{
    response: string;
    references: Array<{
      filePath: string;
      lineNumber: number;
      snippet: string;
    }>;
  }>;
  endSession(sessionId: string): Promise<void>;
}