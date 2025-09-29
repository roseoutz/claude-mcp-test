/**
 * 프롬프트 템플릿 관리 서비스
 * YAML 파일에서 프롬프트를 로드하고 동적으로 생성하는 기능 제공
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PromptTemplate {
  template: string;
  variables?: string[];
}

export interface PromptData {
  system_prompts: {
    [key: string]: {
      role: string;
      instructions: string;
    };
  };
  analysis_prompts: {
    [key: string]: PromptTemplate;
  };
  search_prompts: {
    [key: string]: PromptTemplate;
  };
  feedback_prompts: {
    [key: string]: PromptTemplate;
  };
  settings: {
    ai_params: {
      temperature: number;
      max_tokens: number;
      top_p: number;
    };
    validation: {
      required_fields: string[];
      confidence_threshold: number;
    };
    fallback: {
      description: string;
      purpose: string;
      keywords: string[];
      confidence: number;
    };
  };
  keyword_rules: {
    patterns: {
      [key: string]: {
        trigger: string[];
        keywords: string[];
        synonyms: string[];
      };
    };
  };
  domain_terms: {
    [domain: string]: {
      keywords: string[];
      english: string[];
    };
  };
}

export class PromptManagerService {
  private promptData: PromptData | null = null;
  private promptsPath: string;

  constructor(promptsPath?: string) {
    this.promptsPath = promptsPath || path.join(__dirname, '../prompts/code-analysis-prompts.yaml');
  }

  /**
   * 프롬프트 데이터 로드
   */
  async loadPrompts(): Promise<void> {
    try {
      const yamlContent = await fs.readFile(this.promptsPath, 'utf8');
      this.promptData = yaml.load(yamlContent) as PromptData;
    } catch (error) {
      console.error('Failed to load prompts:', error);
      throw new Error(`Could not load prompt templates from ${this.promptsPath}`);
    }
  }

  /**
   * 시스템 프롬프트 가져오기
   */
  getSystemPrompt(promptKey: string): { role: string; content: string } {
    this.ensureLoaded();

    const systemPrompt = this.promptData!.system_prompts[promptKey];
    if (!systemPrompt) {
      throw new Error(`System prompt not found: ${promptKey}`);
    }

    return {
      role: 'system',
      content: `${systemPrompt.role}\n\n${systemPrompt.instructions}`
    };
  }

  /**
   * 분석 프롬프트 생성
   */
  generateAnalysisPrompt(
    promptKey: string,
    variables: { [key: string]: any }
  ): string {
    this.ensureLoaded();

    const prompt = this.promptData!.analysis_prompts[promptKey];
    if (!prompt) {
      throw new Error(`Analysis prompt not found: ${promptKey}`);
    }

    return this.interpolateTemplate(prompt.template, variables);
  }

  /**
   * 검색 프롬프트 생성
   */
  generateSearchPrompt(
    promptKey: string,
    variables: { [key: string]: any }
  ): string {
    this.ensureLoaded();

    const prompt = this.promptData!.search_prompts[promptKey];
    if (!prompt) {
      throw new Error(`Search prompt not found: ${promptKey}`);
    }

    return this.interpolateTemplate(prompt.template, variables);
  }

  /**
   * 피드백 프롬프트 생성
   */
  generateFeedbackPrompt(
    promptKey: string,
    variables: { [key: string]: any }
  ): string {
    this.ensureLoaded();

    const prompt = this.promptData!.feedback_prompts[promptKey];
    if (!prompt) {
      throw new Error(`Feedback prompt not found: ${promptKey}`);
    }

    return this.interpolateTemplate(prompt.template, variables);
  }

  /**
   * 타입별 분석 프롬프트 자동 선택
   */
  getAnalysisPromptForType(
    elementType: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'type',
    variables: { [key: string]: any }
  ): string {
    const promptMap: { [key: string]: string } = {
      'class': 'class_analysis',
      'function': 'function_analysis',
      'method': 'method_analysis',
      'variable': 'variable_analysis',
      'interface': 'class_analysis',  // 인터페이스는 클래스와 유사하게 처리
      'type': 'class_analysis'        // 타입도 클래스와 유사하게 처리
    };

    const promptKey = promptMap[elementType] || 'function_analysis';
    return this.generateAnalysisPrompt(promptKey, variables);
  }

  /**
   * AI 매개변수 가져오기
   */
  getAIParams(): {
    temperature: number;
    maxTokens: number;
    topP: number;
  } {
    this.ensureLoaded();

    const params = this.promptData!.settings.ai_params;
    return {
      temperature: params.temperature,
      maxTokens: params.max_tokens,
      topP: params.top_p
    };
  }

  /**
   * 검증 설정 가져오기
   */
  getValidationSettings(): {
    requiredFields: string[];
    confidenceThreshold: number;
  } {
    this.ensureLoaded();

    const validation = this.promptData!.settings.validation;
    return {
      requiredFields: validation.required_fields,
      confidenceThreshold: validation.confidence_threshold
    };
  }

  /**
   * 대체 응답 생성
   */
  generateFallbackResponse(
    name: string,
    type: string
  ): {
    description: string;
    purpose: string;
    keywords: string[];
    confidence: number;
  } {
    this.ensureLoaded();

    const fallback = this.promptData!.settings.fallback;

    return {
      description: fallback.description.replace('{name}', name).replace('{type}', type),
      purpose: fallback.purpose.replace('{name}', name).replace('{type}', type),
      keywords: fallback.keywords.map(k => k.replace('{name}', name)),
      confidence: fallback.confidence
    };
  }

  /**
   * 키워드 패턴 규칙 가져오기
   */
  getKeywordRules(): { [pattern: string]: { trigger: string[]; keywords: string[]; synonyms: string[] } } {
    this.ensureLoaded();
    return this.promptData!.keyword_rules.patterns;
  }

  /**
   * 도메인별 전문 용어 가져오기
   */
  getDomainTerms(domain: string): { keywords: string[]; english: string[] } | null {
    this.ensureLoaded();
    return this.promptData!.domain_terms[domain] || null;
  }

  /**
   * 모든 도메인 용어 가져오기
   */
  getAllDomainTerms(): { [domain: string]: { keywords: string[]; english: string[] } } {
    this.ensureLoaded();
    return this.promptData!.domain_terms;
  }

  /**
   * 프롬프트 템플릿에서 변수 보간
   */
  private interpolateTemplate(template: string, variables: { [key: string]: any }): string {
    let result = template;

    // 중괄호로 감싸진 변수들을 찾아서 치환
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, String(value));
    });

    return result;
  }

  /**
   * 프롬프트가 로드되었는지 확인
   */
  private ensureLoaded(): void {
    if (!this.promptData) {
      throw new Error('Prompts not loaded. Call loadPrompts() first.');
    }
  }

  /**
   * 프롬프트 데이터 다시 로드
   */
  async reloadPrompts(): Promise<void> {
    await this.loadPrompts();
  }

  /**
   * 사용 가능한 프롬프트 키 조회
   */
  getAvailablePrompts(): {
    system: string[];
    analysis: string[];
    search: string[];
    feedback: string[];
  } {
    this.ensureLoaded();

    return {
      system: Object.keys(this.promptData!.system_prompts),
      analysis: Object.keys(this.promptData!.analysis_prompts),
      search: Object.keys(this.promptData!.search_prompts),
      feedback: Object.keys(this.promptData!.feedback_prompts)
    };
  }

  /**
   * 프롬프트 템플릿 검증
   */
  validatePrompt(promptKey: string, category: 'analysis' | 'search' | 'feedback'): {
    isValid: boolean;
    missingVariables?: string[];
    errors?: string[];
  } {
    this.ensureLoaded();

    const prompts = this.promptData![`${category}_prompts`];
    const prompt = prompts[promptKey];

    if (!prompt) {
      return {
        isValid: false,
        errors: [`Prompt not found: ${promptKey}`]
      };
    }

    // 템플릿에서 사용된 변수들 추출
    const variableRegex = /{(\w+)}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(prompt.template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return {
      isValid: true,
      missingVariables: variables // 실제로는 제공된 변수와 비교해야 함
    };
  }

  /**
   * 프롬프트 통계 정보
   */
  getPromptStats(): {
    totalPrompts: number;
    promptsByCategory: { [category: string]: number };
    totalVariables: number;
  } {
    this.ensureLoaded();

    const data = this.promptData!;
    const categories = ['system_prompts', 'analysis_prompts', 'search_prompts', 'feedback_prompts'];

    let totalPrompts = 0;
    const promptsByCategory: { [category: string]: number } = {};
    let totalVariables = 0;

    categories.forEach(category => {
      const count = Object.keys(data[category as keyof PromptData] as any).length;
      promptsByCategory[category] = count;
      totalPrompts += count;

      // 변수 개수 계산 (간단 구현)
      Object.values(data[category as keyof PromptData] as any).forEach((prompt: any) => {
        if (prompt.template) {
          const matches = prompt.template.match(/{(\w+)}/g);
          if (matches) {
            totalVariables += matches.length;
          }
        }
      });
    });

    return {
      totalPrompts,
      promptsByCategory,
      totalVariables
    };
  }
}

// 전역 인스턴스 생성 (싱글톤 패턴)
export const promptManager = new PromptManagerService();

// 모듈 로드 시 프롬프트 자동 로드
promptManager.loadPrompts().catch(error => {
  console.warn('Failed to auto-load prompts:', error);
});