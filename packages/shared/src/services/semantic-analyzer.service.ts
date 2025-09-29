/**
 * 코드 의미 분석 서비스
 * 각 클래스, 함수, 변수의 역할과 목적을 분석하고 자연어 설명과 키워드를 생성
 */

import { AIService } from './ai.service';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export interface SemanticMetadata {
  // 기본 정보
  name: string;
  type: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'type';
  location: {
    file: string;
    line: number;
    column: number;
  };

  // 의미적 정보
  description: string;           // AI가 생성한 자연어 설명
  purpose: string;              // 주요 목적/역할
  domain: string;               // 도메인 분류 (auth, payment, user, etc)

  // 키워드 매핑
  keywords: string[];           // 관련 키워드들
  synonyms: string[];          // 동의어들
  tags: string[];              // 분류 태그들

  // 컨텍스트 정보
  parameters?: SemanticParameter[];
  returnType?: string;
  usagePatterns: string[];     // 사용 패턴들
  relatedConcepts: string[];   // 관련 개념들
}

export interface SemanticParameter {
  name: string;
  type: string;
  description: string;
  keywords: string[];
}

export interface DomainKeywordMap {
  [domain: string]: {
    keywords: string[];
    synonyms: string[];
    patterns: string[];
  };
}

export class SemanticAnalyzerService {
  constructor(private aiService: AIService) {}

  /**
   * 도메인별 키워드 매핑 테이블
   */
  private static readonly DOMAIN_KEYWORDS: DomainKeywordMap = {
    authentication: {
      keywords: ['login', 'signin', 'auth', 'token', 'session', 'credential', 'password', 'verify'],
      synonyms: ['authenticate', 'authorize', 'validate', 'check'],
      patterns: ['.*[Ll]ogin.*', '.*[Aa]uth.*', '.*[Tt]oken.*', '.*[Ss]ession.*']
    },
    user: {
      keywords: ['user', 'profile', 'account', 'member', 'person', 'customer'],
      synonyms: ['client', 'subscriber', 'participant', 'individual'],
      patterns: ['.*[Uu]ser.*', '.*[Pp]rofile.*', '.*[Aa]ccount.*']
    },
    payment: {
      keywords: ['payment', 'billing', 'invoice', 'transaction', 'money', 'price', 'cost'],
      synonyms: ['charge', 'fee', 'purchase', 'buy', 'sell'],
      patterns: ['.*[Pp]ayment.*', '.*[Bb]illing.*', '.*[Tt]ransaction.*']
    },
    database: {
      keywords: ['database', 'db', 'query', 'table', 'schema', 'migrate', 'sql'],
      synonyms: ['storage', 'repository', 'persist', 'store'],
      patterns: ['.*[Dd]atabase.*', '.*[Qq]uery.*', '.*[Tt]able.*']
    },
    api: {
      keywords: ['api', 'endpoint', 'route', 'handler', 'controller', 'service'],
      synonyms: ['interface', 'gateway', 'bridge'],
      patterns: ['.*[Aa]pi.*', '.*[Cc]ontroller.*', '.*[Ss]ervice.*']
    },
    validation: {
      keywords: ['validate', 'check', 'verify', 'sanitize', 'clean', 'format'],
      synonyms: ['ensure', 'confirm', 'test'],
      patterns: ['.*[Vv]alidate.*', '.*[Cc]heck.*', '.*[Vv]erify.*']
    },
    error: {
      keywords: ['error', 'exception', 'fail', 'throw', 'catch', 'handle'],
      synonyms: ['mistake', 'bug', 'issue', 'problem'],
      patterns: ['.*[Ee]rror.*', '.*[Ee]xception.*', '.*[Ff]ail.*']
    },
    utility: {
      keywords: ['util', 'helper', 'tool', 'common', 'shared', 'format'],
      synonyms: ['assist', 'support', 'aid'],
      patterns: ['.*[Uu]til.*', '.*[Hh]elper.*', '.*[Tt]ool.*']
    }
  };

  /**
   * 파일의 모든 코드 요소에 대한 의미적 메타데이터 생성
   */
  async analyzeFile(filePath: string, content: string): Promise<SemanticMetadata[]> {
    const results: SemanticMetadata[] = [];

    try {
      const ast = acorn.parse(content, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true
      });

      // AST 순회하며 각 요소 분석
      walk.simple(ast, {
        ClassDeclaration: (node: any) => {
          results.push(this.analyzeClass(node, filePath, content));
        },
        FunctionDeclaration: (node: any) => {
          results.push(this.analyzeFunction(node, filePath, content));
        },
        MethodDefinition: (node: any) => {
          results.push(this.analyzeMethod(node, filePath, content));
        },
        VariableDeclarator: (node: any) => {
          if (this.isSignificantVariable(node)) {
            results.push(this.analyzeVariable(node, filePath, content));
          }
        }
      });

      // AI를 사용해 설명과 키워드 생성
      for (const metadata of results) {
        await this.enhanceWithAI(metadata, content);
      }

    } catch (error) {
      console.warn(`AST parsing failed for ${filePath}:`, error);
      // TypeScript나 다른 언어의 경우 대안적 분석 수행
      return this.fallbackAnalysis(filePath, content);
    }

    return results;
  }

  /**
   * 클래스 분석
   */
  private analyzeClass(node: any, filePath: string, content: string): SemanticMetadata {
    const name = node.id?.name || 'Unknown';
    const line = node.loc?.start.line || 0;

    return {
      name,
      type: 'class',
      location: { file: filePath, line, column: node.loc?.start.column || 0 },
      description: '',
      purpose: '',
      domain: this.inferDomain(name),
      keywords: this.extractKeywords(name),
      synonyms: [],
      tags: ['class'],
      usagePatterns: [],
      relatedConcepts: []
    };
  }

  /**
   * 함수 분석
   */
  private analyzeFunction(node: any, filePath: string, content: string): SemanticMetadata {
    const name = node.id?.name || 'anonymous';
    const line = node.loc?.start.line || 0;

    return {
      name,
      type: 'function',
      location: { file: filePath, line, column: node.loc?.start.column || 0 },
      description: '',
      purpose: '',
      domain: this.inferDomain(name),
      keywords: this.extractKeywords(name),
      synonyms: [],
      tags: ['function'],
      parameters: this.extractParameters(node),
      returnType: this.inferReturnType(node),
      usagePatterns: [],
      relatedConcepts: []
    };
  }

  /**
   * 메서드 분석
   */
  private analyzeMethod(node: any, filePath: string, content: string): SemanticMetadata {
    const name = node.key?.name || 'unknown';
    const line = node.loc?.start.line || 0;

    return {
      name,
      type: 'method',
      location: { file: filePath, line, column: node.loc?.start.column || 0 },
      description: '',
      purpose: '',
      domain: this.inferDomain(name),
      keywords: this.extractKeywords(name),
      synonyms: [],
      tags: ['method'],
      parameters: this.extractParameters(node.value),
      returnType: this.inferReturnType(node.value),
      usagePatterns: [],
      relatedConcepts: []
    };
  }

  /**
   * 변수 분석
   */
  private analyzeVariable(node: any, filePath: string, content: string): SemanticMetadata {
    const name = node.id?.name || 'unknown';
    const line = node.loc?.start.line || 0;

    return {
      name,
      type: 'variable',
      location: { file: filePath, line, column: node.loc?.start.column || 0 },
      description: '',
      purpose: '',
      domain: this.inferDomain(name),
      keywords: this.extractKeywords(name),
      synonyms: [],
      tags: ['variable'],
      usagePatterns: [],
      relatedConcepts: []
    };
  }

  /**
   * AI를 사용해 메타데이터 향상
   */
  private async enhanceWithAI(metadata: SemanticMetadata, fileContent: string): Promise<void> {
    const codeContext = this.extractCodeContext(metadata, fileContent);

    const prompt = `
코드 요소를 분석하고 다음 정보를 JSON 형태로 제공해주세요:

코드 컨텍스트:
\`\`\`typescript
${codeContext}
\`\`\`

요소명: ${metadata.name}
타입: ${metadata.type}

다음 형태로 응답해주세요:
{
  "description": "이 ${metadata.type}의 역할과 기능에 대한 자연스러운 한국어 설명",
  "purpose": "주요 목적을 한 문장으로",
  "keywords": ["관련", "키워드", "목록"],
  "synonyms": ["동의어", "목록"],
  "usagePatterns": ["사용", "패턴", "설명"],
  "relatedConcepts": ["관련", "개념", "목록"]
}
`;

    try {
      const response = await this.aiService.chat([
        { role: 'system', content: '당신은 코드 분석 전문가입니다. 코드의 의미와 목적을 정확히 파악하여 자연어로 설명합니다.' },
        { role: 'user', content: prompt }
      ]);

      const aiResult = JSON.parse(response);

      metadata.description = aiResult.description || '';
      metadata.purpose = aiResult.purpose || '';
      metadata.keywords.push(...(aiResult.keywords || []));
      metadata.synonyms = aiResult.synonyms || [];
      metadata.usagePatterns = aiResult.usagePatterns || [];
      metadata.relatedConcepts = aiResult.relatedConcepts || [];

    } catch (error) {
      console.warn('AI enhancement failed:', error);
      // AI 실패 시 규칙 기반 대안 사용
      this.enhanceWithRules(metadata);
    }
  }

  /**
   * 규칙 기반 메타데이터 향상
   */
  private enhanceWithRules(metadata: SemanticMetadata): void {
    const name = metadata.name.toLowerCase();

    // 이름에서 패턴 추출
    if (name.includes('create') || name.includes('add') || name.includes('insert')) {
      metadata.purpose = '새로운 데이터나 객체를 생성합니다';
      metadata.keywords.push('생성', '추가', '삽입');
      metadata.tags.push('creation');
    } else if (name.includes('update') || name.includes('modify') || name.includes('edit')) {
      metadata.purpose = '기존 데이터나 객체를 수정합니다';
      metadata.keywords.push('수정', '업데이트', '변경');
      metadata.tags.push('modification');
    } else if (name.includes('delete') || name.includes('remove')) {
      metadata.purpose = '데이터나 객체를 삭제합니다';
      metadata.keywords.push('삭제', '제거');
      metadata.tags.push('deletion');
    } else if (name.includes('get') || name.includes('find') || name.includes('fetch')) {
      metadata.purpose = '데이터나 객체를 조회합니다';
      metadata.keywords.push('조회', '검색', '가져오기');
      metadata.tags.push('retrieval');
    }

    // 도메인 특화 키워드 추가
    const domainData = SemanticAnalyzerService.DOMAIN_KEYWORDS[metadata.domain];
    if (domainData) {
      metadata.keywords.push(...domainData.keywords);
      metadata.synonyms.push(...domainData.synonyms);
    }
  }

  /**
   * 도메인 추론
   */
  private inferDomain(name: string): string {
    const lowerName = name.toLowerCase();

    for (const [domain, data] of Object.entries(SemanticAnalyzerService.DOMAIN_KEYWORDS)) {
      if (data.patterns.some(pattern => new RegExp(pattern).test(name))) {
        return domain;
      }
      if (data.keywords.some(keyword => lowerName.includes(keyword))) {
        return domain;
      }
    }

    return 'general';
  }

  /**
   * 키워드 추출
   */
  private extractKeywords(name: string): string[] {
    const keywords: string[] = [];

    // camelCase를 단어로 분리
    const words = name.replace(/([A-Z])/g, ' $1').trim().toLowerCase().split(' ');
    keywords.push(...words);

    // 전체 이름도 키워드로 추가
    keywords.push(name.toLowerCase());

    return keywords;
  }

  /**
   * 파라미터 추출
   */
  private extractParameters(node: any): SemanticParameter[] {
    if (!node?.params) return [];

    return node.params.map((param: any) => ({
      name: param.name || 'unknown',
      type: this.inferParameterType(param),
      description: '',
      keywords: this.extractKeywords(param.name || '')
    }));
  }

  /**
   * 파라미터 타입 추론
   */
  private inferParameterType(param: any): string {
    // TypeScript 타입 정보가 있는 경우
    if (param.typeAnnotation) {
      return 'typed'; // 실제로는 타입 정보 추출
    }
    return 'unknown';
  }

  /**
   * 반환 타입 추론
   */
  private inferReturnType(node: any): string {
    if (node.returnType) {
      return 'typed'; // 실제로는 반환 타입 정보 추출
    }
    return 'unknown';
  }

  /**
   * 중요한 변수인지 판단
   */
  private isSignificantVariable(node: any): boolean {
    const name = node.id?.name;
    if (!name) return false;

    // 상수나 설정 변수들은 의미가 있음
    return name.toUpperCase() === name ||
           name.includes('CONFIG') ||
           name.includes('CONSTANT');
  }

  /**
   * 코드 컨텍스트 추출
   */
  private extractCodeContext(metadata: SemanticMetadata, content: string): string {
    const lines = content.split('\n');
    const startLine = Math.max(0, metadata.location.line - 3);
    const endLine = Math.min(lines.length, metadata.location.line + 10);

    return lines.slice(startLine, endLine).join('\n');
  }

  /**
   * AST 파싱 실패 시 대안 분석
   */
  private async fallbackAnalysis(filePath: string, content: string): Promise<SemanticMetadata[]> {
    const results: SemanticMetadata[] = [];

    // 정규식을 사용한 기본적인 분석
    const classMatches = content.matchAll(/class\s+(\w+)/g);
    for (const match of classMatches) {
      results.push({
        name: match[1],
        type: 'class',
        location: { file: filePath, line: 0, column: 0 },
        description: '',
        purpose: '',
        domain: this.inferDomain(match[1]),
        keywords: this.extractKeywords(match[1]),
        synonyms: [],
        tags: ['class'],
        usagePatterns: [],
        relatedConcepts: []
      });
    }

    const functionMatches = content.matchAll(/function\s+(\w+)/g);
    for (const match of functionMatches) {
      results.push({
        name: match[1],
        type: 'function',
        location: { file: filePath, line: 0, column: 0 },
        description: '',
        purpose: '',
        domain: this.inferDomain(match[1]),
        keywords: this.extractKeywords(match[1]),
        synonyms: [],
        tags: ['function'],
        usagePatterns: [],
        relatedConcepts: []
      });
    }

    return results;
  }

  /**
   * 의미적 검색을 위한 검색 쿼리 확장
   */
  expandSearchQuery(query: string): {
    originalQuery: string;
    expandedTerms: string[];
    synonyms: string[];
    relatedConcepts: string[];
  } {
    const expandedTerms: string[] = [query];
    const synonyms: string[] = [];
    const relatedConcepts: string[] = [];

    const lowerQuery = query.toLowerCase();

    // 도메인 키워드 매핑에서 관련 용어 찾기
    for (const [domain, data] of Object.entries(SemanticAnalyzerService.DOMAIN_KEYWORDS)) {
      if (data.keywords.some(keyword => lowerQuery.includes(keyword))) {
        expandedTerms.push(...data.keywords);
        synonyms.push(...data.synonyms);
        relatedConcepts.push(domain);
      }
    }

    return {
      originalQuery: query,
      expandedTerms: [...new Set(expandedTerms)],
      synonyms: [...new Set(synonyms)],
      relatedConcepts: [...new Set(relatedConcepts)]
    };
  }
}