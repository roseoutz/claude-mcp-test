/**
 * 대화형 코드 채팅 서비스
 * 하이브리드 검색 + LLM을 결합한 자연어 코드 질의응답
 */

import OpenAI from 'openai';
import { IVectorStore } from '../domain/ports/outbound/vector-store.port.js';
import { EmbeddingService } from './embedding.service.js';
import { KeywordMappingService } from './keyword-mapping.service.js';
import { config } from '../config/config-loader.js';
import { logger } from '../utils/logger.js';

export interface CodeChatContext {
  filePath: string;
  content: string;
  metadata: {
    className?: string;
    language?: string;
    purpose?: string;
    methods?: string[];
    lineStart?: number;
    lineEnd?: number;
  };
  relevanceScore: number;
}

export interface ChatResponse {
  answer: string;
  sources: CodeChatContext[];
  confidence: number;
  searchTermsUsed: string[];
}

export class ConversationalCodeChatService {
  private openai: OpenAI;
  private embeddingService: EmbeddingService;
  private keywordMapping: KeywordMappingService;
  private vectorStore: IVectorStore;

  constructor(
    vectorStore: IVectorStore,
    embeddingService?: EmbeddingService,
    keywordMapping?: KeywordMappingService
  ) {
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService || new EmbeddingService();
    this.keywordMapping = keywordMapping || new KeywordMappingService();

    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  /**
   * 사용자 질문에 대해 코드베이스를 검색하고 자연어로 답변 생성
   */
  async askAboutCode(
    userQuestion: string,
    options: {
      maxSources?: number;
      includeCode?: boolean;
      language?: string;
      contextWindow?: number;
    } = {}
  ): Promise<ChatResponse> {
    const {
      maxSources = 5,
      includeCode = true,
      language = 'korean',
      contextWindow = 3000
    } = options;

    try {
      // 1. 키워드 확장 및 검색 최적화
      const expandedQuery = await this.keywordMapping.expandQuery(userQuestion);
      logger.info('Expanded search query', {
        original: userQuestion,
        expanded: expandedQuery.expandedTerms
      });

      // 2. 하이브리드 검색 실행
      const searchTerms = [userQuestion, ...expandedQuery.expandedTerms.slice(0, 3)];
      const allSources: CodeChatContext[] = [];

      for (const term of searchTerms) {
        const embedding = await this.embeddingService.generateEmbedding(term);
        const results = await this.vectorStore.hybridSearch(term, embedding, maxSources);

        // 검색 결과를 ChatContext로 변환
        const contexts = results.map(result => ({
          filePath: result.metadata?.filePath || 'unknown',
          content: result.content,
          metadata: {
            className: result.metadata?.className,
            language: result.metadata?.language,
            purpose: result.metadata?.purpose,
            methods: result.metadata?.methods,
            lineStart: result.metadata?.lineStart,
            lineEnd: result.metadata?.lineEnd,
          },
          relevanceScore: result.score
        }));

        allSources.push(...contexts);
      }

      // 3. 중복 제거 및 상위 결과 선택
      const uniqueSources = this.deduplicateAndRankSources(allSources, maxSources);

      if (uniqueSources.length === 0) {
        return {
          answer: "죄송합니다. 질문과 관련된 코드를 찾을 수 없습니다. 다른 키워드나 더 구체적인 질문을 시도해보세요.",
          sources: [],
          confidence: 0,
          searchTermsUsed: searchTerms
        };
      }

      // 4. LLM 컨텍스트 구성
      const context = this.buildLLMContext(uniqueSources, contextWindow, includeCode);

      // 5. LLM에게 질문하여 자연어 답변 생성
      const answer = await this.generateLLMResponse(userQuestion, context, language);

      // 6. 신뢰도 계산
      const confidence = this.calculateConfidence(uniqueSources, userQuestion);

      return {
        answer,
        sources: uniqueSources,
        confidence,
        searchTermsUsed: searchTerms
      };

    } catch (error) {
      logger.error('Code chat error', error);
      throw new Error(`코드 질의응답 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 코드 변경사항에 대한 설명 요청
   */
  async explainCodeDiff(
    beforeCode: string,
    afterCode: string,
    filePath: string,
    userQuestion?: string
  ): Promise<string> {
    const defaultQuestion = "이 코드 변경사항이 무엇을 하는지 설명해주세요.";
    const question = userQuestion || defaultQuestion;

    const context = `
파일: ${filePath}

변경 전:
\`\`\`
${beforeCode}
\`\`\`

변경 후:
\`\`\`
${afterCode}
\`\`\`
`;

    return this.generateLLMResponse(question, context, 'korean');
  }

  /**
   * 중복 제거 및 관련도 기반 정렬
   */
  private deduplicateAndRankSources(
    sources: CodeChatContext[],
    maxCount: number
  ): CodeChatContext[] {
    // 파일 경로 기준 중복 제거
    const seen = new Set<string>();
    const unique = sources.filter(source => {
      const key = source.filePath;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 관련도 기준 정렬 및 상위 선택
    return unique
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxCount);
  }

  /**
   * LLM 컨텍스트 구성
   */
  private buildLLMContext(
    sources: CodeChatContext[],
    maxLength: number,
    includeCode: boolean
  ): string {
    let context = '';
    let currentLength = 0;

    for (const source of sources) {
      const sourceInfo = `
파일: ${source.filePath}
${source.metadata.className ? `클래스: ${source.metadata.className}` : ''}
${source.metadata.purpose ? `목적: ${source.metadata.purpose}` : ''}
${source.metadata.methods ? `주요 메서드: ${source.metadata.methods.join(', ')}` : ''}
관련도: ${(source.relevanceScore * 100).toFixed(1)}%

${includeCode ? `코드:\n\`\`\`${source.metadata.language || ''}\n${source.content}\n\`\`\`` : ''}
`;

      if (currentLength + sourceInfo.length > maxLength) {
        break;
      }

      context += sourceInfo + '\n\n';
      currentLength += sourceInfo.length;
    }

    return context;
  }

  /**
   * LLM 응답 생성
   */
  private async generateLLMResponse(
    question: string,
    context: string,
    language: string
  ): Promise<string> {
    const systemPrompt = language === 'korean'
      ? `당신은 숙련된 소프트웨어 개발자이자 코드 분석 전문가입니다.
제공된 코드베이스 정보를 바탕으로 사용자의 질문에 정확하고 도움이 되는 답변을 제공하세요.

답변 가이드라인:
1. 구체적이고 실용적인 설명을 제공하세요
2. 코드의 목적과 동작 방식을 명확히 설명하세요
3. 필요시 코드 예시나 개선 제안을 포함하세요
4. 기술적 용어는 쉽게 풀어서 설명하세요
5. 한국어로 자연스럽게 답변하세요`
      : `You are an experienced software developer and code analysis expert.
Provide accurate and helpful answers based on the provided codebase information.

Guidelines:
1. Provide specific and practical explanations
2. Clearly explain the purpose and behavior of code
3. Include code examples or improvement suggestions when necessary
4. Explain technical terms in an accessible way
5. Answer naturally in English`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `질문: ${question}\n\n코드베이스 정보:\n${context}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    return response.choices[0]?.message?.content || '답변을 생성할 수 없습니다.';
  }

  /**
   * 답변 신뢰도 계산
   */
  private calculateConfidence(sources: CodeChatContext[], question: string): number {
    if (sources.length === 0) return 0;

    // 평균 관련도 스코어 기반 신뢰도
    const avgRelevance = sources.reduce((sum, source) => sum + source.relevanceScore, 0) / sources.length;

    // 소스 개수 보너스 (더 많은 소스 = 더 높은 신뢰도)
    const sourceBonus = Math.min(sources.length / 5, 1) * 0.2;

    // 최종 신뢰도 (0-1 범위)
    return Math.min(avgRelevance + sourceBonus, 1);
  }

  /**
   * 대화 히스토리를 고려한 연속 질문 처리
   */
  async followUpQuestion(
    currentQuestion: string,
    previousContext: CodeChatContext[],
    chatHistory: Array<{ question: string; answer: string }> = []
  ): Promise<ChatResponse> {
    // 이전 컨텍스트와 새로운 검색 결과를 결합
    const newResults = await this.askAboutCode(currentQuestion, { maxSources: 3 });

    // 이전 컨텍스트와 병합
    const combinedSources = [...previousContext, ...newResults.sources]
      .filter((source, index, arr) =>
        arr.findIndex(s => s.filePath === source.filePath) === index
      );

    // 대화 히스토리를 포함한 컨텍스트 구성
    const historyContext = chatHistory
      .map(chat => `Q: ${chat.question}\nA: ${chat.answer}`)
      .join('\n\n');

    const fullContext = `
대화 기록:
${historyContext}

현재 관련 코드:
${this.buildLLMContext(combinedSources, 2500, true)}
`;

    const answer = await this.generateLLMResponse(
      `이전 대화를 참고하여 다음 질문에 답해주세요: ${currentQuestion}`,
      fullContext,
      'korean'
    );

    return {
      answer,
      sources: combinedSources,
      confidence: this.calculateConfidence(combinedSources, currentQuestion),
      searchTermsUsed: [currentQuestion]
    };
  }
}