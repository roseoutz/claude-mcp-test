/**
 * 지능형 코드 검색 시스템 단순화된 통합 테스트
 * 핵심 기능들을 검증하는 단순한 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  AIDescriptionGeneratorService,
  KeywordMappingService,
  PromptManagerService
} from '../../packages/shared/src/services';
import { AIDescriptionRequest } from '../../packages/shared/src/types/intelligent-search';

describe('지능형 코드 검색 시스템 단순 테스트', () => {
  describe('AI 설명 생성 서비스', () => {
    it('Mock AI 서비스로 설명을 생성할 수 있어야 함', async () => {
      // Mock AI 서비스
      const mockAIService = {
        chat: async (messages: any[], options?: any) => {
          return JSON.stringify({
            description: "사용자 관리를 위한 서비스 클래스입니다.",
            purpose: "사용자 인증과 관리 기능을 제공합니다.",
            keywords: ["user", "사용자", "service", "서비스"],
            synonyms: ["member", "account"],
            usagePatterns: ["의존성 주입으로 사용"],
            relatedConcepts: ["authentication", "management"],
            confidence: 0.9
          });
        }
      };

      // Mock 프롬프트 매니저
      const mockPromptManager = {
        loadPrompts: async () => {},
        getSystemPrompt: () => ({
          role: 'system',
          content: 'You are a code analyzer.'
        }),
        getAnalysisPromptForType: () => 'Analyze this code',
        getAIParams: () => ({
          temperature: 0.3,
          maxTokens: 1000,
          topP: 0.9
        }),
        getValidationSettings: () => ({
          requiredFields: ['description'],
          confidenceThreshold: 0.3
        }),
        generateFallbackResponse: (name: string, type: string) => ({
          description: `${name}은 ${type} 역할을 수행합니다.`,
          purpose: `${name}의 주요 목적입니다.`,
          keywords: [name, type],
          confidence: 0.5
        }),
        getKeywordRules: () => ({}),
        getAllDomainTerms: () => ({})
      };

      const generator = new AIDescriptionGeneratorService(
        mockAIService as any,
        mockPromptManager as any
      );

      await generator.initialize();

      const request: AIDescriptionRequest = {
        name: 'UserService',
        type: 'class',
        codeContext: 'export class UserService { ... }',
        filePath: 'user.service.ts'
      };

      const result = await generator.generateDescription(request);

      expect(result.description).toContain('사용자');
      expect(result.keywords).toContain('user');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('캐시가 올바르게 작동해야 함', async () => {
      const mockAIService = {
        chat: vi.fn().mockResolvedValue(JSON.stringify({
          description: "테스트 설명",
          purpose: "테스트 목적",
          keywords: ["test"],
          synonyms: [],
          usagePatterns: [],
          relatedConcepts: [],
          confidence: 0.8
        }))
      };

      const mockPromptManager = {
        loadPrompts: async () => {},
        getSystemPrompt: () => ({ role: 'system', content: 'Test' }),
        getAnalysisPromptForType: () => 'Test prompt',
        getAIParams: () => ({ temperature: 0.3, maxTokens: 1000, topP: 0.9 }),
        getValidationSettings: () => ({ requiredFields: [], confidenceThreshold: 0.3 }),
        generateFallbackResponse: (name: string, type: string) => ({
          description: `${name}은 ${type} 역할을 수행합니다.`,
          purpose: `${name}의 주요 목적입니다.`,
          keywords: [name, type],
          confidence: 0.5
        }),
        getKeywordRules: () => ({}),
        getAllDomainTerms: () => ({})
      };

      const generator = new AIDescriptionGeneratorService(
        mockAIService as any,
        mockPromptManager as any
      );

      const request: AIDescriptionRequest = {
        name: 'TestFunction',
        type: 'function',
        codeContext: 'function test() {}',
        filePath: 'test.ts'
      };

      // 첫 번째 호출
      await generator.generateDescription(request);

      // 두 번째 호출 (캐시에서 가져와야 함)
      await generator.generateDescription(request);

      // AI 서비스는 한 번만 호출되어야 함 (캐시 때문에)
      expect((mockAIService.chat as any).callCount).toBe(1);
    });
  });

  describe('키워드 매핑 서비스', () => {
    it('검색 쿼리 확장이 작동해야 함', () => {
      const mappingService = new KeywordMappingService();

      const expansion = mappingService.expandSearchQuery('사용자 로그인');

      expect(expansion.originalQuery).toBe('사용자 로그인');
      expect(expansion.expandedKeywords.length).toBeGreaterThan(0);
      expect(expansion.synonyms.length).toBeGreaterThan(0);

      // 확장된 키워드에 관련 용어들이 포함되어야 함
      const allTerms = expansion.expandedKeywords.map(k => k.keyword).concat(expansion.synonyms);
      expect(allTerms.some(term => term.includes('login') || term.includes('user'))).toBe(true);
    });

    it('유사한 키워드를 찾을 수 있어야 함', () => {
      const mappingService = new KeywordMappingService();

      const similarKeywords = mappingService.findSimilarKeywords('login', 0.3);

      expect(similarKeywords.length).toBeGreaterThan(0);
      expect(similarKeywords.some(k => k.synonyms.includes('signin'))).toBe(true);
    });

    it('키워드 유사도를 계산할 수 있어야 함', () => {
      const mappingService = new KeywordMappingService();

      const similarity = mappingService.calculateSimilarity('login', 'signin');

      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThanOrEqual(1.0);
    });

    it('도메인별 키워드를 가져올 수 있어야 함', () => {
      const mappingService = new KeywordMappingService();

      const authKeywords = mappingService.getKeywordsByDomain('authentication');

      expect(authKeywords.length).toBeGreaterThan(0);
      expect(authKeywords.some(k => k.keyword === 'login')).toBe(true);
    });
  });

  describe('프롬프트 매니저 서비스', () => {
    it('대체 응답을 생성할 수 있어야 함', () => {
      // Mock 프롬프트 데이터를 가진 프롬프트 매니저
      const promptManager = new PromptManagerService();

      // 프롬프트 데이터를 직접 설정
      (promptManager as any).promptData = {
        settings: {
          fallback: {
            description: '{name}은 {type} 역할을 수행하는 코드 요소입니다.',
            purpose: '{name}의 주요 목적은 {type} 기능을 제공하는 것입니다.',
            keywords: ['{name}', '{type}'],
            confidence: 0.5
          }
        }
      };

      const fallback = promptManager.generateFallbackResponse('UserService', 'class');

      expect(fallback.description).toContain('UserService');
      expect(fallback.description).toContain('class');
      expect(fallback.keywords).toContain('UserService');
      expect(fallback.confidence).toBe(0.5);
    });
  });

  describe('통합 시나리오', () => {
    it('전체 워크플로우가 작동해야 함', async () => {
      // 1. 키워드 서비스로 검색 쿼리 확장
      const keywordService = new KeywordMappingService();
      const expansion = keywordService.expandSearchQuery('사용자 인증 로그인');

      expect(expansion.originalQuery).toBe('사용자 인증 로그인');
      expect(expansion.expandedKeywords.length).toBeGreaterThan(0);

      // 2. 유사한 키워드 찾기
      const similarKeywords = keywordService.findSimilarKeywords('login', 0.3);
      expect(similarKeywords.length).toBeGreaterThan(0);

      // 3. 도메인별 키워드 가져오기
      const authKeywords = keywordService.getKeywordsByDomain('authentication');
      expect(authKeywords.length).toBeGreaterThan(0);

      console.log('✅ 전체 워크플로우 테스트 통과');
      console.log(`원본 쿼리: "${expansion.originalQuery}"`);
      console.log(`확장된 키워드 수: ${expansion.expandedKeywords.length}`);
      console.log(`동의어 수: ${expansion.synonyms.length}`);
      console.log(`유사 키워드 수: ${similarKeywords.length}`);
      console.log(`인증 도메인 키워드 수: ${authKeywords.length}`);
    });
  });
});

// Mock vitest functions
if (typeof vi === 'undefined') {
  (globalThis as any).vi = {
    fn: (impl?: Function) => {
      let callCount = 0;
      let mockResolvedValue: any;

      const mockFn = async (...args: any[]) => {
        callCount++;
        if (mockResolvedValue !== undefined) {
          return Promise.resolve(mockResolvedValue);
        }
        if (impl) {
          return impl(...args);
        }
        return undefined;
      };

      (mockFn as any).mockResolvedValue = (value: any) => {
        mockResolvedValue = value;
        return mockFn;
      };

      (mockFn as any).mockReturnValue = (value: any) => {
        mockResolvedValue = value;
        return mockFn;
      };

      Object.defineProperty(mockFn, 'callCount', {
        get: () => callCount
      });

      // vitest expect.toHaveBeenCalledTimes 호환성
      (mockFn as any).toHaveBeenCalledTimes = (expectedCount: number) => {
        return callCount === expectedCount;
      };

      return mockFn;
    }
  };
}