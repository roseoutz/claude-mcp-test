/**
 * 코드 설명 및 키워드 생성 서비스
 * 임베딩 기반 유사성을 활용한 간단한 설명 생성 (LLM 없음)
 */

import { EmbeddingService } from './embedding.service';
import { SemanticMetadata } from './semantic-analyzer.service';
import { PromptManagerService } from './prompt-manager.service';

export interface AIDescriptionRequest {
  name: string;
  type: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'type';
  codeContext: string;
  filePath: string;
}

export interface AIDescriptionResponse {
  description: string;
  purpose: string;
  keywords: string[];
  synonyms: string[];
  usagePatterns: string[];
  relatedConcepts: string[];
  confidence: number;
}

export class AIDescriptionGeneratorService {
  private descriptionCache = new Map<string, AIDescriptionResponse>();

  constructor(
    private aiService: AIService,
    private promptManager: PromptManagerService
  ) {}

  /**
   * 서비스 초기화 (프롬프트 로드)
   */
  async initialize(): Promise<void> {
    await this.promptManager.loadPrompts();
  }

  /**
   * 단일 코드 요소의 설명과 키워드 생성
   */
  async generateDescription(request: AIDescriptionRequest): Promise<AIDescriptionResponse> {
    const cacheKey = this.getCacheKey(request);

    // 캐시에서 확인
    if (this.descriptionCache.has(cacheKey)) {
      return this.descriptionCache.get(cacheKey)!;
    }

    try {
      const response = await this.callAI(request);
      this.descriptionCache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.warn('AI description generation failed:', error);
      return this.generateFallbackDescription(request);
    }
  }

  /**
   * 여러 코드 요소를 배치로 처리
   */
  async generateBatchDescriptions(requests: AIDescriptionRequest[]): Promise<AIDescriptionResponse[]> {
    const results: AIDescriptionResponse[] = [];

    // 배치 크기로 나누어 처리 (API 제한 고려)
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(request => this.generateDescription(request))
      );
      results.push(...batchResults);

      // API 레이트 제한을 위한 지연
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * AI를 통한 설명 생성
   */
  private async callAI(request: AIDescriptionRequest): Promise<AIDescriptionResponse> {
    // 프롬프트 매니저에서 시스템 프롬프트 가져오기
    const systemPrompt = this.promptManager.getSystemPrompt('code_analyzer');

    // 타입에 따른 분석 프롬프트 생성
    const userPrompt = this.promptManager.getAnalysisPromptForType(request.type, {
      filePath: request.filePath,
      name: request.name,
      codeContext: request.codeContext
    });

    // AI 매개변수 가져오기
    const aiParams = this.promptManager.getAIParams();

    const response = await this.aiService.chat([
      systemPrompt,
      {
        role: 'user',
        content: userPrompt
      }
    ], {
      temperature: aiParams.temperature,
      maxTokens: aiParams.maxTokens,
      topP: aiParams.topP
    });

    return this.parseAIResponse(response);
  }


  /**
   * AI 응답 파싱 및 검증
   */
  private parseAIResponse(response: string): AIDescriptionResponse {
    try {
      // JSON만 추출 (```json 블록이 있는 경우 처리)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 프롬프트 매니저에서 검증 설정 가져오기
      const validation = this.promptManager.getValidationSettings();

      // 필수 필드 검증
      for (const field of validation.requiredFields) {
        if (!parsed[field]) {
          console.warn(`Missing required field: ${field}`);
        }
      }

      // 신뢰도 점수 검증
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
      if (confidence < validation.confidenceThreshold) {
        console.warn(`Low confidence score: ${confidence}`);
      }

      return {
        description: parsed.description || '',
        purpose: parsed.purpose || '',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
        usagePatterns: Array.isArray(parsed.usagePatterns) ? parsed.usagePatterns : [],
        relatedConcepts: Array.isArray(parsed.relatedConcepts) ? parsed.relatedConcepts : [],
        confidence
      };
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      throw new Error('Invalid AI response format');
    }
  }

  /**
   * AI 실패 시 대안 설명 생성
   */
  private generateFallbackDescription(request: AIDescriptionRequest): AIDescriptionResponse {
    const { name, type } = request;

    // 프롬프트 매니저에서 대체 응답 생성
    const fallback = this.promptManager.generateFallbackResponse(name, type);

    // 키워드 규칙을 사용해 추가 키워드 생성
    const keywordRules = this.promptManager.getKeywordRules();
    const additionalKeywords = this.extractKeywordsFromRules(name, keywordRules);

    return {
      description: fallback.description,
      purpose: fallback.purpose,
      keywords: [...fallback.keywords, ...additionalKeywords],
      synonyms: this.generateSynonyms([...fallback.keywords, ...additionalKeywords]),
      usagePatterns: [this.getBasicUsagePattern(type)],
      relatedConcepts: this.getRelatedConceptsFromDomain(name),
      confidence: fallback.confidence
    };
  }

  /**
   * 규칙에서 키워드 추출
   */
  private extractKeywordsFromRules(name: string, rules: any): string[] {
    const lowerName = name.toLowerCase();
    const keywords: string[] = [];

    Object.entries(rules).forEach(([pattern, rule]: [string, any]) => {
      if (rule.trigger.some((trigger: string) => lowerName.includes(trigger))) {
        keywords.push(...rule.keywords);
      }
    });

    return keywords;
  }

  /**
   * 도메인에서 관련 개념 추출
   */
  private getRelatedConceptsFromDomain(name: string): string[] {
    const domainTerms = this.promptManager.getAllDomainTerms();
    const concepts: string[] = [];

    Object.entries(domainTerms).forEach(([domain, terms]) => {
      if (terms.english.some(term => name.toLowerCase().includes(term.toLowerCase())) ||
          terms.keywords.some(keyword => name.includes(keyword))) {
        concepts.push(...terms.keywords, ...terms.english);
      }
    });

    return concepts.slice(0, 5); // 최대 5개
  }

  /**
   * 기본 키워드 추출
   */
  private extractBasicKeywords(name: string, type: string): string[] {
    const keywords: string[] = [name.toLowerCase(), type];

    // camelCase 분리
    const words = name.replace(/([A-Z])/g, ' $1').trim().split(' ');
    keywords.push(...words.map(w => w.toLowerCase()));

    // 일반적인 패턴 매칭
    const patterns = [
      { pattern: /create|add|insert/, keywords: ['생성', '추가', 'create', 'add'] },
      { pattern: /update|modify|edit/, keywords: ['수정', '업데이트', 'update', 'modify'] },
      { pattern: /delete|remove/, keywords: ['삭제', '제거', 'delete', 'remove'] },
      { pattern: /get|find|fetch/, keywords: ['조회', '검색', 'get', 'find', 'fetch'] },
      { pattern: /validate|check/, keywords: ['검증', '확인', 'validate', 'check'] },
      { pattern: /handle|process/, keywords: ['처리', '핸들링', 'handle', 'process'] }
    ];

    for (const { pattern, keywords: patternKeywords } of patterns) {
      if (pattern.test(name.toLowerCase())) {
        keywords.push(...patternKeywords);
      }
    }

    return [...new Set(keywords)];
  }

  /**
   * 동의어 생성
   */
  private generateSynonyms(keywords: string[]): string[] {
    const synonymMap: { [key: string]: string[] } = {
      '생성': ['만들기', '작성', '구성', 'create', 'build', 'make'],
      '수정': ['변경', '업데이트', '편집', 'update', 'modify', 'change'],
      '삭제': ['제거', '삭제', 'delete', 'remove', 'destroy'],
      '조회': ['검색', '찾기', '가져오기', 'get', 'find', 'fetch', 'retrieve'],
      '검증': ['확인', '체크', 'validate', 'verify', 'check'],
      '처리': ['핸들링', '가공', 'handle', 'process', 'manage']
    };

    const synonyms: string[] = [];
    for (const keyword of keywords) {
      if (synonymMap[keyword]) {
        synonyms.push(...synonymMap[keyword]);
      }
    }

    return [...new Set(synonyms)];
  }

  /**
   * 타입별 설명
   */
  private getTypeDescription(type: string): string {
    switch (type) {
      case 'class': return '는 특정 기능을 담당하는 클래스입니다.';
      case 'function': return '는 특정 작업을 수행하는 함수입니다.';
      case 'method': return '는 클래스의 동작을 정의하는 메서드입니다.';
      case 'variable': return '는 데이터를 저장하는 변수입니다.';
      default: return '는 코드 요소입니다.';
    }
  }

  /**
   * 목적 추론
   */
  private inferPurpose(name: string, type: string): string {
    if (name.includes('service')) return '비즈니스 로직을 처리합니다';
    if (name.includes('controller')) return '요청을 처리하고 응답을 반환합니다';
    if (name.includes('repository')) return '데이터 저장소와의 상호작용을 담당합니다';
    if (name.includes('util') || name.includes('helper')) return '공통 유틸리티 기능을 제공합니다';
    if (name.includes('config')) return '설정 정보를 관리합니다';

    return `${type} 역할을 수행합니다`;
  }

  /**
   * 기본 사용 패턴
   */
  private getBasicUsagePattern(type: string): string {
    switch (type) {
      case 'class': return '인스턴스 생성 후 메서드 호출';
      case 'function': return '필요한 매개변수와 함께 직접 호출';
      case 'method': return '객체 인스턴스를 통해 호출';
      case 'variable': return '값 할당 및 참조';
      default: return '코드 내에서 직접 사용';
    }
  }

  /**
   * 관련 개념
   */
  private getRelatedConcepts(name: string): string[] {
    const concepts: string[] = [];

    if (name.includes('auth')) concepts.push('인증', '보안', 'authentication', 'security');
    if (name.includes('user')) concepts.push('사용자', '계정', 'user management', 'profile');
    if (name.includes('payment')) concepts.push('결제', '금융', 'billing', 'transaction');
    if (name.includes('api')) concepts.push('API', '인터페이스', 'endpoint', 'web service');
    if (name.includes('db') || name.includes('database')) concepts.push('데이터베이스', 'persistence', 'storage');

    return concepts;
  }

  /**
   * 캐시 키 생성
   */
  private getCacheKey(request: AIDescriptionRequest): string {
    return `${request.filePath}:${request.name}:${request.type}`;
  }

  /**
   * 캐시 클리어
   */
  clearCache(): void {
    this.descriptionCache.clear();
  }

  /**
   * 캐시 통계
   */
  getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.descriptionCache.size
    };
  }
}