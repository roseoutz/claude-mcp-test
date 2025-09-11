# Task 08: AI Service 구현

## 목표
OpenAI (임베딩) + Claude Opus 4.1 (생성)을 활용한 AI 서비스 구현

## 작업 내용

### 1. AI 서비스 구현 (`src/services/ai.service.ts`)
```typescript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { IAIService, SecurityIssue } from '../types/services.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config-loader.js';
import { Cacheable } from '../decorators/cache.decorator.js';
import { CacheKeys } from '../utils/cache-keys.js';

export class AIService implements IAIService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private maxTokens: number;
  private cacheService?: any;

  constructor(openaiKey?: string, anthropicKey?: string) {
    // OpenAI for embeddings
    const oaiKey = openaiKey || config.get('OPENAI_API_KEY');
    if (!oaiKey) {
      logger.warn('OpenAI API key not provided, embedding features will be limited');
    }
    this.openai = new OpenAI({
      apiKey: oaiKey || 'dummy-key',
    });

    // Anthropic Claude for generation
    const claudeKey = anthropicKey || config.get('ANTHROPIC_API_KEY');
    if (!claudeKey) {
      logger.warn('Anthropic API key not provided, generation features will be limited');
    }
    this.anthropic = new Anthropic({
      apiKey: claudeKey || 'dummy-key',
    });

    this.maxTokens = config.get('MAX_TOKENS') || 4000;
  }

  setCacheService(cacheService: any): void {
    this.cacheService = cacheService;
  }

  /**
   * 텍스트 임베딩 생성
   */
  @Cacheable(
    (text: string) => CacheKeys.embedding(text),
    86400 // 24시간 캐시
  )
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      // 오류 시 랜덤 벡터 반환 (개발용)
      return Array(1536).fill(0).map(() => Math.random());
    }
  }

  /**
   * 코드 설명 생성 (Claude Opus 4.1)
   */
  async explainCode(
    code: string, 
    context?: string
  ): Promise<string> {
    try {
      const prompt = this.buildCodeExplanationPrompt(code, context);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1-20250805',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: 'You are a helpful programming assistant that explains code clearly and concisely in Korean.',
        max_tokens: this.maxTokens,
        temperature: 0.3,
      });

      return response.content[0]?.type === 'text' 
        ? response.content[0].text 
        : 'Unable to generate explanation';
    } catch (error) {
      logger.error('Failed to explain code:', error);
      return 'Error generating code explanation';
    }
  }

  /**
   * 개선 제안 생성 (Claude Opus 4.1)
   */
  async suggestImprovements(
    analysis: any
  ): Promise<string[]> {
    try {
      const prompt = this.buildImprovementPrompt(analysis);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1-20250805',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: 'You are a code review expert. Provide specific, actionable improvement suggestions in Korean.',
        max_tokens: this.maxTokens,
        temperature: 0.5,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '';
      return this.parseImprovements(content);
    } catch (error) {
      logger.error('Failed to suggest improvements:', error);
      return [];
    }
  }

  /**
   * 보안 분석 (Claude Opus 4.1)
   */
  async analyzeSecurity(code: string): Promise<SecurityIssue[]> {
    try {
      const prompt = this.buildSecurityAnalysisPrompt(code);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1-20250805',
        messages: [
          {
            role: 'user',
            content: prompt + '\n\nReturn the response as valid JSON.',
          },
        ],
        system: 'You are a security expert. Analyze code for security vulnerabilities and provide specific findings in JSON format.',
        max_tokens: this.maxTokens,
        temperature: 0.2,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '{}';
      return this.parseSecurityIssues(content);
    } catch (error) {
      logger.error('Failed to analyze security:', error);
      return [];
    }
  }

  /**
   * 코드 요약 생성 (Claude Opus 4.1)
   */
  async summarizeCode(
    code: string,
    maxLength: number = 200
  ): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1-20250805',
        messages: [
          {
            role: 'user',
            content: code,
          },
        ],
        system: `Summarize the following code in ${maxLength} characters or less in Korean. Focus on what it does, not how.`,
        max_tokens: Math.min(maxLength * 2, this.maxTokens), // 한글은 토큰이 더 필요
        temperature: 0.3,
      });

      return response.content[0]?.type === 'text'
        ? response.content[0].text
        : 'No summary available';
    } catch (error) {
      logger.error('Failed to summarize code:', error);
      return 'Error generating summary';
    }
  }

  /**
   * 자연어 쿼리를 코드 검색 쿼리로 변환 (Claude Opus 4.1)
   */
  async queryToCode(query: string): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1-20250805',
        messages: [
          {
            role: 'user',
            content: `Convert this query to a code search pattern: "${query}"`,
          },
        ],
        system: 'Convert natural language queries to code search patterns. Return only the search pattern, no explanation.',
        max_tokens: 100,
        temperature: 0.2,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text.trim()
        : query;
      return content || query;
    } catch (error) {
      logger.error('Failed to convert query:', error);
      return query;
    }
  }

  /**
   * 함수 시그니처 생성 (Claude Opus 4.1)
   */
  async generateFunctionSignature(
    description: string,
    language: string = 'typescript'
  ): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1-20250805',
        messages: [
          {
            role: 'user',
            content: description,
          },
        ],
        system: `Generate a function signature in ${language} based on the description. Include parameter types and return type. Add Korean comments.`,
        max_tokens: 200,
        temperature: 0.3,
      });

      return response.content[0]?.type === 'text'
        ? response.content[0].text
        : '';
    } catch (error) {
      logger.error('Failed to generate function signature:', error);
      return '';
    }
  }

  // Private helper methods

  private buildCodeExplanationPrompt(code: string, context?: string): string {
    let prompt = 'Explain the following code:\n\n```\n' + code + '\n```\n';
    
    if (context) {
      prompt += '\n\nAdditional context: ' + context;
    }
    
    prompt += '\n\nProvide a clear, concise explanation focusing on:';
    prompt += '\n1. What the code does';
    prompt += '\n2. Key algorithms or patterns used';
    prompt += '\n3. Any potential issues or improvements';
    
    return prompt;
  }

  private buildImprovementPrompt(analysis: any): string {
    return `Based on the following code analysis, suggest specific improvements:

Analysis Summary:
- Total Files: ${analysis.statistics?.totalFiles || 0}
- Total Lines: ${analysis.statistics?.totalLines || 0}
- Languages: ${JSON.stringify(analysis.statistics?.languages || {})}

Provide 3-5 specific, actionable improvement suggestions focusing on:
1. Code quality and maintainability
2. Performance optimizations
3. Security enhancements
4. Testing coverage
5. Documentation

Format each suggestion as a separate line starting with "- "`;
  }

  private buildSecurityAnalysisPrompt(code: string): string {
    return `Analyze the following code for security vulnerabilities:

\`\`\`
${code}
\`\`\`

Check for common security issues including:
- SQL Injection
- XSS vulnerabilities
- Insecure data handling
- Authentication/authorization issues
- Sensitive data exposure
- Input validation problems

Return the findings as a JSON array with the following structure:
{
  "issues": [
    {
      "severity": "low|medium|high|critical",
      "type": "vulnerability type",
      "message": "description of the issue",
      "line": line_number_if_applicable,
      "suggestion": "how to fix it"
    }
  ]
}`;
  }

  private parseImprovements(content: string): string[] {
    const lines = content.split('\n');
    const improvements = lines
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(Boolean);
    
    return improvements;
  }

  private parseSecurityIssues(content: string): SecurityIssue[] {
    try {
      const parsed = JSON.parse(content);
      return parsed.issues || [];
    } catch {
      // Fallback parsing if JSON parsing fails
      const issues: SecurityIssue[] = [];
      const lines = content.split('\n');
      
      for (const line of lines) {
        if (line.includes('vulnerability') || line.includes('security')) {
          issues.push({
            severity: 'medium',
            type: 'Unknown',
            message: line.trim(),
          });
        }
      }
      
      return issues;
    }
  }
}

/**
 * Mock AI Service for testing/development
 */
export class MockAIService implements IAIService {
  async generateEmbedding(text: string): Promise<number[]> {
    // 텍스트 길이 기반 더미 벡터 생성
    const seed = text.length;
    return Array(1536).fill(0).map((_, i) => 
      Math.sin(seed + i) * 0.5 + 0.5
    );
  }

  async explainCode(code: string, context?: string): Promise<string> {
    return `This code performs operations related to: ${context || 'general processing'}. 
    The implementation uses standard patterns and follows best practices.`;
  }

  async suggestImprovements(): Promise<string[]> {
    return [
      'Add comprehensive unit tests',
      'Improve error handling',
      'Add JSDoc documentation',
      'Consider extracting complex logic into separate functions',
      'Add input validation',
    ];
  }

  async analyzeSecurity(code: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    if (code.includes('eval(')) {
      issues.push({
        severity: 'critical',
        type: 'Code Injection',
        message: 'Use of eval() can lead to code injection',
        suggestion: 'Use safer alternatives like JSON.parse()',
      });
    }
    
    if (code.includes('innerHTML')) {
      issues.push({
        severity: 'high',
        type: 'XSS',
        message: 'Direct innerHTML assignment can lead to XSS',
        suggestion: 'Use textContent or sanitize HTML',
      });
    }
    
    return issues;
  }
}
```

### 2. AI 서비스 테스트 (`src/__tests__/services/ai.service.test.ts`)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MockAIService } from '../../services/ai.service.js';

describe('AIService', () => {
  let aiService: MockAIService;

  beforeEach(() => {
    aiService = new MockAIService();
  });

  describe('MockAIService', () => {
    it('should generate embeddings', async () => {
      const embedding = await aiService.generateEmbedding('test text');
      
      expect(embedding).toHaveLength(1536);
      expect(embedding.every(v => v >= 0 && v <= 1)).toBe(true);
    });

    it('should generate consistent embeddings for same text', async () => {
      const embedding1 = await aiService.generateEmbedding('test');
      const embedding2 = await aiService.generateEmbedding('test');
      
      expect(embedding1).toEqual(embedding2);
    });

    it('should explain code', async () => {
      const explanation = await aiService.explainCode(
        'function add(a, b) { return a + b; }',
        'math utility'
      );
      
      expect(explanation).toContain('math utility');
      expect(explanation.length).toBeGreaterThan(0);
    });

    it('should suggest improvements', async () => {
      const suggestions = await aiService.suggestImprovements({});
      
      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('test');
    });

    it('should analyze security issues', async () => {
      const codeWithIssues = `
        function dangerous() {
          eval(userInput);
          element.innerHTML = userContent;
        }
      `;
      
      const issues = await aiService.analyzeSecurity(codeWithIssues);
      
      expect(issues.length).toBe(2);
      expect(issues.some(i => i.type === 'Code Injection')).toBe(true);
      expect(issues.some(i => i.type === 'XSS')).toBe(true);
    });

    it('should not find issues in safe code', async () => {
      const safeCode = `
        function safe(a: number, b: number): number {
          return a + b;
        }
      `;
      
      const issues = await aiService.analyzeSecurity(safeCode);
      
      expect(issues.length).toBe(0);
    });
  });
});
```

### 3. AI 프롬프트 템플릿 (`src/utils/ai-prompts.ts`)
```typescript
/**
 * AI 프롬프트 템플릿 관리
 */
export class PromptTemplates {
  static codeReview(code: string, language: string): string {
    return `Review the following ${language} code and provide feedback:

\`\`\`${language}
${code}
\`\`\`

Focus on:
1. Code quality and readability
2. Performance considerations
3. Security vulnerabilities
4. Best practices
5. Potential bugs

Provide specific, actionable feedback.`;
  }

  static generateTests(code: string, framework: string = 'vitest'): string {
    return `Generate unit tests for the following code using ${framework}:

\`\`\`
${code}
\`\`\`

Include:
- Happy path tests
- Edge cases
- Error scenarios
- Mock external dependencies

Return only the test code, no explanations.`;
  }

  static documentCode(code: string): string {
    return `Add comprehensive JSDoc documentation to the following code:

\`\`\`
${code}
\`\`\`

Include:
- Function/class descriptions
- Parameter descriptions and types
- Return value descriptions
- Usage examples where appropriate
- Any thrown errors

Return the fully documented code.`;
  }

  static refactorCode(code: string, goal: string): string {
    return `Refactor the following code to ${goal}:

\`\`\`
${code}
\`\`\`

Maintain the same functionality while improving the code structure.
Return only the refactored code.`;
  }

  static explainError(error: string, context: string): string {
    return `Explain this error and how to fix it:

Error: ${error}

Context: ${context}

Provide:
1. What causes this error
2. Step-by-step solution
3. Code example of the fix
4. How to prevent it in the future`;
  }
}
```

### 4. 환경 설정 업데이트
```bash
# .env.example에 추가

# OpenAI (임베딩용)
OPENAI_API_KEY=sk-...

# Anthropic Claude (생성용)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus-4-1-20250805
MAX_TOKENS=4000
TEMPERATURE=0.3

# Optional: For Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

## 체크리스트
- [ ] AIService 클래스 구현
- [ ] MockAIService 구현 (테스트용)
- [ ] OpenAI 임베딩 생성 기능
- [ ] Claude Opus 4.1 코드 설명 및 분석 기능
- [ ] Claude 기반 보안 취약점 분석
- [ ] 프롬프트 템플릿 관리
- [ ] 캐싱 통합
- [ ] 단위 테스트 작성

## 커밋 메시지
```
feat: OpenAI + Claude Opus 4.1 기반 AI 서비스 구현

- OpenAI API 임베딩 생성
- Claude Opus 4.1 코드 분석 및 설명
- Claude 기반 보안 취약점 검사
- 임베딩 캐싱 지원
- Mock 서비스 (개발/테스트용)
```

## 예상 소요 시간
2시간

## 의존성
- openai
- @anthropic-ai/sdk

## 검증 방법
- OpenAI API 연결 테스트 (임베딩)
- Claude API 연결 테스트 (생성)
- 임베딩 생성 확인
- 코드 분석 정확도 테스트
- 캐싱 동작 확인