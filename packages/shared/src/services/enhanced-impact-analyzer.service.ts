/**
 * 메타데이터 강화 임베딩 기반 영향도 분석 서비스
 * 코드 구조와 메타데이터를 결합하여 더 정확한 영향도 분석 제공
 */

import { EmbeddingService } from './embedding.service.js';
import { ElasticsearchVectorStore, SearchResult, HybridSearchRequest } from './elasticsearch.service.js';
import { IntelligentCodeAnalyzerService } from './intelligent-code-analyzer.service.js';
import { SemanticAnalyzerService } from './semantic-analyzer.service.js';

export interface CodeMetadata {
  // 기본 정보
  className: string;
  packageName: string;
  filePath: string;

  // 구조 정보
  methods: string[];
  fields: string[];
  imports: string[];
  annotations: string[];

  // 의존성
  dependencies: string[];
  injectedServices: string[];

  // 아키텍처
  layer: ArchitectureLayer;
  purpose: string;
  businessDomain: string;

  // 특성
  isInterface: boolean;
  isAbstract: boolean;
  isImplementation: boolean;
  hasMainLogic: boolean;
  complexity: ComplexityLevel;

  // 의미적 특성 (임베딩 기반으로 추론)
  semanticDomainScores?: {
    [domain: string]: number;  // 동적 도메인 점수 (0-1)
  };
}

export enum ArchitectureLayer {
  PRESENTATION = 'Presentation Layer',
  BUSINESS = 'Business Layer',
  PERSISTENCE = 'Persistence Layer',
  TRANSFER = 'Transfer Layer',
  CONFIGURATION = 'Configuration Layer',
  SECURITY = 'Security Layer',
  UTILITY = 'Utility Layer',
  INFRASTRUCTURE = 'Infrastructure Layer'
}

export enum ComplexityLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export interface ImpactAnalysisRequest {
  title: string;
  description: string;
  query: string;
  keywords?: string[];
  type?: 'auth' | 'crypto' | 'tax' | 'general';
  businessDomain?: string;
  targetLayer?: ArchitectureLayer;
  preferImplementation?: boolean;
  maxResults?: number;
}

export interface ImpactAnalysisResult {
  filePath: string;
  className: string;
  similarity: number;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  metadata: CodeMetadata;
  enhancedText?: string;
  reasoning?: string;
}

export interface ImpactAnalysisResponse {
  request: ImpactAnalysisRequest;
  results: ImpactAnalysisResult[];
  analysis: {
    coreModificationPoints: string[];
    impactPropagationPath: string[];
    considerations: string[];
    testingAreas: string[];
    estimatedEffort: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export class EnhancedImpactAnalyzerService {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStore: ElasticsearchVectorStore,
    private readonly codeAnalyzer: IntelligentCodeAnalyzerService,
    private readonly semanticAnalyzer: SemanticAnalyzerService
  ) {}

  /**
   * 메타데이터 강화 텍스트 생성
   */
  private createEnhancedEmbeddingText(
    code: string,
    metadata: CodeMetadata
  ): string {
    return `
## File Classification
- Business Domain: ${metadata.businessDomain}
- Architecture Layer: ${metadata.layer}
- Purpose: ${metadata.purpose}
- Implementation Type: ${metadata.isImplementation ? 'Concrete Implementation' : metadata.isInterface ? 'Interface' : 'Abstract/Utility'}

## Component Information
- Package: ${metadata.packageName}
- Class: ${metadata.className}
- Complexity: ${metadata.complexity}

## Core Responsibilities
${metadata.methods.slice(0, 10).map(m => `- ${m}: ${this.inferMethodPurpose(m)}`).join('\n')}

## Dependencies and Relations
- Injected Services: ${metadata.injectedServices.join(', ') || 'None'}
- External Dependencies: ${metadata.dependencies.join(', ') || 'None'}
- Annotations: ${metadata.annotations.join(', ') || 'None'}

## Domain Keywords
${this.generateDomainKeywords(metadata).join(', ')}

## Semantic Domain Analysis
${metadata.semanticDomainScores ?
  Object.entries(metadata.semanticDomainScores)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([domain, score]) => `- ${domain}: ${(score * 100).toFixed(1)}%`)
    .join('\n')
  : '- Domain analysis pending'}

## Source Code Summary
${code.substring(0, 2000)}
`;
  }

  /**
   * 코드에서 메타데이터 추출
   */
  async extractMetadata(filePath: string, code: string): Promise<CodeMetadata> {
    // SemanticAnalyzer를 활용한 기본 분석
    const semanticData = await this.semanticAnalyzer.analyze(code);

    return {
      className: this.extractClassName(code),
      packageName: this.extractPackageName(code),
      filePath,
      methods: this.extractMethods(code),
      fields: this.extractFields(code),
      imports: this.extractImports(code),
      annotations: this.extractAnnotations(code),
      dependencies: this.extractDependencies(code),
      injectedServices: this.extractInjectedServices(code),
      layer: this.inferArchitectureLayer(filePath),
      purpose: this.inferPurpose(filePath, code),
      businessDomain: this.inferBusinessDomain(filePath, code),
      isInterface: code.includes('interface '),
      isAbstract: code.includes('abstract class'),
      isImplementation: filePath.includes('impl/'),
      hasMainLogic: this.hasMainBusinessLogic(code),
      complexity: this.calculateComplexity(code),
      // 의미적 도메인 점수는 임베딩 후 계산
      semanticDomainScores: {}
    };
  }

  /**
   * 영향도 분석 수행
   */
  async analyzeImpact(request: ImpactAnalysisRequest): Promise<ImpactAnalysisResponse> {
    // 1. 쿼리 강화
    const enhancedQuery = this.enhanceQuery(request);

    // 2. 벡터 검색 수행
    const searchRequest: HybridSearchRequest = {
      query: enhancedQuery,
      keywords: request.keywords || [],
      size: request.maxResults || 15,
      knnBoost: 0.7,
      keywordBoost: 0.3
    };

    const searchResults = await this.vectorStore.hybridSearch(searchRequest);

    // 3. 결과 처리 및 가중치 적용
    const results = await this.processResults(searchResults.hits, request);

    // 4. AI 기반 분석
    const analysis = await this.performAIAnalysis(request, results);

    return {
      request,
      results,
      analysis
    };
  }

  /**
   * 검색 결과 처리 및 메타데이터 가중치 적용
   */
  private async processResults(
    hits: SearchResult[],
    request: ImpactAnalysisRequest
  ): Promise<ImpactAnalysisResult[]> {
    const results: ImpactAnalysisResult[] = [];

    for (const hit of hits) {
      const metadata = await this.extractMetadata(
        hit.document.filePath,
        hit.document.content
      );

      let similarity = hit.score;
      let multiplier = 1.0;

      // 구현체 우선 가중치
      if (request.preferImplementation && metadata.isImplementation) {
        multiplier *= 1.3;
      }

      // 비즈니스 도메인 매칭
      if (request.businessDomain &&
          metadata.businessDomain.toLowerCase().includes(request.businessDomain.toLowerCase())) {
        multiplier *= 1.25;
      }

      // 아키텍처 레이어 매칭
      if (request.targetLayer && metadata.layer === request.targetLayer) {
        multiplier *= 1.2;
      }

      // 의미적 도메인 점수 기반 가중치 (범용적)
      if (request.type && metadata.semanticDomainScores) {
        const domainScore = metadata.semanticDomainScores[request.type] || 0;
        if (domainScore > 0.5) {
          multiplier *= (1 + domainScore * 0.35);
        }
      }

      similarity = Math.min(similarity * multiplier, 1.0);

      results.push({
        filePath: metadata.filePath,
        className: metadata.className,
        similarity,
        impactLevel: this.calculateImpactLevel(similarity),
        metadata,
        enhancedText: this.createEnhancedEmbeddingText(hit.document.content, metadata)
      });
    }

    // 유사도 기준 정렬
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, request.maxResults || 15);
  }

  /**
   * AI 기반 분석
   */
  private async performAIAnalysis(
    request: ImpactAnalysisRequest,
    results: ImpactAnalysisResult[]
  ): Promise<ImpactAnalysisResponse['analysis']> {
    // 실제 구현에서는 OpenAI API 호출
    // 여기서는 구조화된 분석 결과 반환

    const topResults = results.slice(0, 5);

    return {
      coreModificationPoints: topResults
        .filter(r => r.metadata.isImplementation)
        .map(r => `${r.className} (${r.filePath})`),

      impactPropagationPath: this.tracePropagationPath(topResults),

      considerations: this.generateConsiderations(request, topResults),

      testingAreas: this.identifyTestingAreas(topResults),

      estimatedEffort: this.estimateEffort(results),

      riskLevel: this.assessRiskLevel(results)
    };
  }

  /**
   * 쿼리 강화
   */
  private enhanceQuery(request: ImpactAnalysisRequest): string {
    return `
Query Intent: ${request.title}
Change Description: ${request.description}
Search Keywords: ${request.query}
Domain Context: ${request.businessDomain || 'General'}
Target Layer: ${request.targetLayer || 'Any'}
Implementation Focus: ${request.preferImplementation ? 'Prefer concrete implementations' : 'Any'}
Feature Type: ${request.type || 'General'}
Related Keywords: ${(request.keywords || []).join(', ')}
`;
  }

  /**
   * 영향 전파 경로 추적
   */
  private tracePropagationPath(results: ImpactAnalysisResult[]): string[] {
    const path: string[] = [];

    // 구현체 -> 인터페이스 -> 의존 클래스 순으로 경로 구성
    const implementations = results.filter(r => r.metadata.isImplementation);
    const interfaces = results.filter(r => r.metadata.isInterface);
    const others = results.filter(r => !r.metadata.isImplementation && !r.metadata.isInterface);

    implementations.forEach(r => {
      path.push(`${r.className} (Implementation)`);
    });

    interfaces.forEach(r => {
      path.push(`${r.className} (Interface)`);
    });

    others.slice(0, 3).forEach(r => {
      path.push(`${r.className} (${r.metadata.layer})`);
    });

    return path;
  }

  /**
   * 고려사항 생성 (범용적 접근)
   */
  private generateConsiderations(
    request: ImpactAnalysisRequest,
    results: ImpactAnalysisResult[]
  ): string[] {
    const considerations: string[] = [];

    // 복잡도 기반 고려사항
    if (results.some(r => r.metadata.complexity === ComplexityLevel.HIGH)) {
      considerations.push('High complexity code requires thorough testing');
      considerations.push('Consider breaking down complex logic into smaller units');
    }

    // 의존성 기반 고려사항
    const avgDependencies = results.reduce((sum, r) => sum + r.metadata.dependencies.length, 0) / results.length;
    if (avgDependencies > 5) {
      considerations.push('Multiple dependencies require integration testing');
      considerations.push('Check for circular dependencies');
    }

    // 구현체 vs 인터페이스
    const hasInterfaces = results.some(r => r.metadata.isInterface);
    const hasImplementations = results.some(r => r.metadata.isImplementation);
    if (hasInterfaces && hasImplementations) {
      considerations.push('Changes affect both interfaces and implementations');
      considerations.push('Ensure all implementations comply with interface changes');
    }

    // 아키텍처 레이어 기반
    const affectedLayers = [...new Set(results.map(r => r.metadata.layer))];
    if (affectedLayers.length > 2) {
      considerations.push('Changes span multiple architectural layers');
      considerations.push('Review cross-layer communication patterns');
    }

    // 높은 영향도
    const highImpactCount = results.filter(r => r.impactLevel === 'HIGH').length;
    if (highImpactCount > 3) {
      considerations.push('Significant number of high-impact changes');
      considerations.push('Consider phased rollout strategy');
    }

    return considerations;
  }

  /**
   * 테스트 영역 식별 (범용적 접근)
   */
  private identifyTestingAreas(results: ImpactAnalysisResult[]): string[] {
    const areas = new Set<string>();

    // 아키텍처 레이어 기반 테스트 영역
    results.forEach(r => {
      switch (r.metadata.layer) {
        case ArchitectureLayer.BUSINESS:
          areas.add('Business logic validation');
          areas.add('Service layer integration');
          break;
        case ArchitectureLayer.PERSISTENCE:
          areas.add('Data persistence operations');
          areas.add('Database transaction handling');
          break;
        case ArchitectureLayer.PRESENTATION:
          areas.add('API endpoint testing');
          areas.add('Request/Response validation');
          break;
        case ArchitectureLayer.SECURITY:
          areas.add('Security policies and access control');
          break;
        case ArchitectureLayer.CONFIGURATION:
          areas.add('Configuration loading and validation');
          break;
      }
    });

    // 메서드 패턴 기반 테스트 영역
    results.forEach(r => {
      const methods = r.metadata.methods || [];
      if (methods.some(m => m.includes('validate'))) areas.add('Validation logic');
      if (methods.some(m => m.includes('calculate') || m.includes('compute'))) areas.add('Calculation accuracy');
      if (methods.some(m => m.includes('process') || m.includes('handle'))) areas.add('Process flow');
      if (methods.some(m => m.includes('convert') || m.includes('transform'))) areas.add('Data transformation');
    });

    // 복잡도 기반 테스트
    if (results.some(r => r.metadata.complexity === ComplexityLevel.HIGH)) {
      areas.add('Edge case handling');
      areas.add('Performance testing');
    }

    // 의존성 기반 테스트
    if (results.some(r => r.metadata.dependencies.length > 3)) {
      areas.add('Integration testing');
      areas.add('Mock/Stub verification');
    }

    return Array.from(areas);
  }

  /**
   * 작업량 추정
   */
  private estimateEffort(results: ImpactAnalysisResult[]): string {
    const highImpact = results.filter(r => r.impactLevel === 'HIGH').length;
    const mediumImpact = results.filter(r => r.impactLevel === 'MEDIUM').length;

    const hours = highImpact * 4 + mediumImpact * 2;
    const days = Math.ceil(hours / 8);

    return `${days} days (${hours} hours)`;
  }

  /**
   * 리스크 레벨 평가
   */
  private assessRiskLevel(results: ImpactAnalysisResult[]): 'HIGH' | 'MEDIUM' | 'LOW' {
    const highImpact = results.filter(r => r.impactLevel === 'HIGH').length;
    const hasSecurityImpact = results.some(r =>
      r.metadata.hasCryptoKeywords ||
      r.metadata.hasAuthKeywords
    );

    if (highImpact > 5 || hasSecurityImpact) return 'HIGH';
    if (highImpact > 2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 영향도 레벨 계산
   */
  private calculateImpactLevel(similarity: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (similarity > 0.8) return 'HIGH';
    if (similarity > 0.6) return 'MEDIUM';
    return 'LOW';
  }

  // === 유틸리티 메서드 ===

  private inferMethodPurpose(methodName: string): string {
    if (methodName.startsWith('get')) return 'retrieves data';
    if (methodName.startsWith('set')) return 'modifies data';
    if (methodName.startsWith('create') || methodName.startsWith('generate')) return 'creates objects';
    if (methodName.startsWith('validate')) return 'validates data';
    if (methodName.startsWith('calculate')) return 'performs calculations';
    if (methodName.startsWith('process')) return 'processes data';
    if (methodName.startsWith('handle')) return 'handles events';
    return 'performs operations';
  }

  private generateDomainKeywords(metadata: CodeMetadata): string[] {
    const keywords: string[] = [];

    if (metadata.className) {
      keywords.push(...this.camelCaseToWords(metadata.className));
    }

    if (metadata.methods) {
      metadata.methods.slice(0, 5).forEach(m => {
        keywords.push(...this.camelCaseToWords(m));
      });
    }

    return [...new Set(keywords)];
  }

  private camelCaseToWords(str: string): string[] {
    return str.replace(/([A-Z])/g, ' $1').trim().toLowerCase().split(' ');
  }

  private hasKeywords(content: string, keywords: string[]): boolean {
    const contentLower = content.toLowerCase();
    return keywords.some(k => contentLower.includes(k));
  }

  private hasMainBusinessLogic(content: string): boolean {
    const businessKeywords = [
      'calculate', 'process', 'validate', 'generate',
      'handle', 'execute', 'transform', 'convert'
    ];
    return this.hasKeywords(content, businessKeywords);
  }

  private calculateComplexity(content: string): ComplexityLevel {
    const lines = content.split('\n').length;
    const conditions = (content.match(/if\s*\(|switch\s*\(|for\s*\(|while\s*\(/g) || []).length;

    const score = lines * 0.01 + conditions * 3;

    if (score > 100) return ComplexityLevel.HIGH;
    if (score > 50) return ComplexityLevel.MEDIUM;
    return ComplexityLevel.LOW;
  }

  // === 추출 메서드들 ===

  private extractClassName(content: string): string {
    const match = content.match(/(?:class|interface)\s+(\w+)/);
    return match?.[1] || 'Unknown';
  }

  private extractPackageName(content: string): string {
    const match = content.match(/package\s+([^;]+);/);
    return match?.[1] || '';
  }

  private extractMethods(content: string): string[] {
    const regex = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+(?:<[\w\s,?]+>)?)\s+(\w+)\s*\(/g;
    const methods: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (!['if', 'for', 'while', 'switch'].includes(match[1])) {
        methods.push(match[1]);
      }
    }
    return [...new Set(methods)];
  }

  private extractFields(content: string): string[] {
    const regex = /(?:private|protected|public)\s+(?:static\s+)?(?:final\s+)?(\w+)\s+(\w+);/g;
    const fields: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      fields.push(`${match[2]}: ${match[1]}`);
    }
    return fields;
  }

  private extractImports(content: string): string[] {
    const regex = /import\s+(?:static\s+)?([^;]+);/g;
    const imports: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1].split('.').pop() || match[1]);
    }
    return imports;
  }

  private extractAnnotations(content: string): string[] {
    const regex = /@(\w+)/g;
    const annotations: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (!['Override', 'param', 'return'].includes(match[1])) {
        annotations.push(match[1]);
      }
    }
    return [...new Set(annotations)];
  }

  private extractDependencies(content: string): string[] {
    const regex = /(\w+Service|\w+Repository|\w+Manager|\w+Handler)/g;
    const deps: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    return [...new Set(deps)];
  }

  private extractInjectedServices(content: string): string[] {
    const services: string[] = [];
    const regex = /(?:@Autowired|@Inject|private\s+final)\s+(\w+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      services.push(match[1]);
    }
    return [...new Set(services)];
  }

  private inferArchitectureLayer(filePath: string): ArchitectureLayer {
    const path = filePath.toLowerCase();
    if (path.includes('controller')) return ArchitectureLayer.PRESENTATION;
    if (path.includes('service') || path.includes('handler')) return ArchitectureLayer.BUSINESS;
    if (path.includes('repository') || path.includes('entity')) return ArchitectureLayer.PERSISTENCE;
    if (path.includes('dto')) return ArchitectureLayer.TRANSFER;
    if (path.includes('config')) return ArchitectureLayer.CONFIGURATION;
    if (path.includes('security')) return ArchitectureLayer.SECURITY;
    if (path.includes('util')) return ArchitectureLayer.UTILITY;
    return ArchitectureLayer.INFRASTRUCTURE;
  }

  private inferPurpose(filePath: string, content: string): string {
    const path = filePath.toLowerCase();
    const contentLower = content.toLowerCase();

    if (path.includes('handler')) {
      if (contentLower.includes('refund')) return 'Handles refund calculation';
      if (contentLower.includes('tax')) return 'Handles tax calculation';
      return 'Handles business logic';
    }

    if (path.includes('service')) {
      if (contentLower.includes('token')) return 'JWT token management';
      if (contentLower.includes('crypto')) return 'Cryptographic operations';
      return 'Business service';
    }

    if (path.includes('controller')) return 'REST API endpoint';
    if (path.includes('repository')) return 'Data persistence';
    return 'General implementation';
  }

  private inferBusinessDomain(filePath: string, content: string): string {
    const path = filePath.toLowerCase();
    const contentLower = content.toLowerCase();

    if (path.includes('refund') || contentLower.includes('refund')) return 'Tax Refund';
    if (path.includes('tax') || contentLower.includes('tax')) return 'Tax Calculation';
    if (path.includes('token') || path.includes('jwt')) return 'Token Management';
    if (path.includes('auth') || path.includes('login')) return 'Authentication';
    if (path.includes('crypto')) return 'Cryptography';
    return 'General Business';
  }
}