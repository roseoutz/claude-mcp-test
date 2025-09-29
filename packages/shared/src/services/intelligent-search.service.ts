/**
 * Intelligent Search Service
 * AI + 그래프 + 하이브리드 검색을 결합한 지능형 검색 엔진
 *
 * @description
 * 코드 그래프 관계와 AI 임베딩을 결합하여 더 정확하고
 * 컨텍스트를 이해하는 검색 결과를 제공합니다.
 *
 * @search_strategies
 * 1. Semantic Search: 임베딩 기반 의미적 유사성
 * 2. Structural Search: 코드 그래프 구조적 관계
 * 3. Contextual Search: 주변 컨텍스트와 의존성 고려
 * 4. Pattern Search: 디자인 패턴 및 아키텍처 패턴
 * 5. Impact Search: 변경 영향도 기반 관련 코드
 *
 * @ranking_algorithm
 * - Vector Similarity: 의미적 유사성 점수 (30%)
 * - Graph Centrality: 코드 중요도 점수 (25%)
 * - Relation Strength: 관계 강도 점수 (20%)
 * - Context Relevance: 컨텍스트 관련성 (15%)
 * - Pattern Match: 패턴 매칭 점수 (10%)
 */

import { ElasticsearchVectorStore, HybridSearchResult } from './elasticsearch.service';
import { CodeGraphService } from './code-graph.service';
import { AIService } from './ai.service';

export interface IntelligentSearchResult extends HybridSearchResult {
  intelligenceScore: number;
  relevanceFactors: {
    semanticSimilarity: number;
    structuralRelevance: number;
    contextualFit: number;
    patternMatch: number;
    importance: number;
  };
  relatedNodes: Array<{
    id: string;
    type: string;
    relation: string;
    strength: number;
  }>;
  suggestedActions: string[];
}

export interface SearchContext {
  currentFile?: string;
  currentFunction?: string;
  currentClass?: string;
  recentlyViewed?: string[];
  taskContext?: string;
  codebaseArea?: string;
}

export interface SearchIntent {
  type: 'find_similar' | 'find_dependencies' | 'find_usage' | 'find_pattern' | 'impact_analysis' | 'architecture_search';
  confidence: number;
  keywords: string[];
  filters: {
    languages?: string[];
    fileTypes?: string[];
    patterns?: string[];
    timeRange?: {
      from: Date;
      to: Date;
    };
  };
}

/**
 * Intelligent Search Service
 * 다양한 검색 전략을 조합한 지능형 코드 검색
 */
export class IntelligentSearchService {
  private vectorStore: ElasticsearchVectorStore;
  private graphService: CodeGraphService;
  private aiService: AIService;

  constructor(
    vectorStore: ElasticsearchVectorStore,
    graphService: CodeGraphService,
    aiService: AIService
  ) {
    this.vectorStore = vectorStore;
    this.graphService = graphService;
    this.aiService = aiService;
  }

  /**
   * 지능형 검색 수행
   * 쿼리를 분석하여 최적의 검색 전략을 선택하고 결과를 랭킹
   */
  async intelligentSearch(
    query: string,
    context?: SearchContext,
    limit: number = 10
  ): Promise<IntelligentSearchResult[]> {
    try {
      // 1. 검색 의도 분석
      const searchIntent = await this.analyzeSearchIntent(query, context);

      // 2. 다중 검색 전략 수행
      const [semanticResults, structuralResults, contextualResults, patternResults] = await Promise.all([
        this.performSemanticSearch(query, limit),
        this.performStructuralSearch(query, context, limit),
        this.performContextualSearch(query, context, limit),
        this.performPatternSearch(query, searchIntent, limit)
      ]);

      // 3. 결과 통합 및 중복 제거
      const combinedResults = this.combineSearchResults([
        semanticResults,
        structuralResults,
        contextualResults,
        patternResults
      ]);

      // 4. 지능형 랭킹 적용
      const rankedResults = await this.applyIntelligentRanking(combinedResults, query, context);

      // 5. 결과 강화 (관련 노드 및 제안 추가)
      const enhancedResults = await this.enhanceResults(rankedResults, context);

      return enhancedResults.slice(0, limit);

    } catch (error) {
      console.warn('Intelligent search failed, falling back to basic search:', error);
      return this.fallbackToBasicSearch(query, limit);
    }
  }

  /**
   * 검색 의도 분석
   */
  private async analyzeSearchIntent(query: string, context?: SearchContext): Promise<SearchIntent> {
    // AI를 통한 의도 분석
    const analysisPrompt = `Analyze the search intent for: "${query}"
    Context: ${JSON.stringify(context)}

    Determine the type of search and extract keywords.`;

    try {
      const response = await this.aiService.generateCompletion(analysisPrompt, {
        maxTokens: 200,
        temperature: 0.1
      });

      // 간단한 휴리스틱으로 의도 분류
      let type: SearchIntent['type'] = 'find_similar';
      if (query.includes('depend') || query.includes('import')) type = 'find_dependencies';
      else if (query.includes('usage') || query.includes('used')) type = 'find_usage';
      else if (query.includes('pattern') || query.includes('design')) type = 'find_pattern';
      else if (query.includes('impact') || query.includes('affect')) type = 'impact_analysis';
      else if (query.includes('architecture') || query.includes('structure')) type = 'architecture_search';

      return {
        type,
        confidence: 0.8,
        keywords: query.split(/\s+/).filter(word => word.length > 2),
        filters: {
          languages: ['kotlin', 'java'],
          fileTypes: ['.kt', '.java']
        }
      };
    } catch (error) {
      // 기본 의도 반환
      return {
        type: 'find_similar',
        confidence: 0.5,
        keywords: query.split(/\s+/),
        filters: {}
      };
    }
  }

  /**
   * 의미적 검색 (임베딩 기반)
   */
  private async performSemanticSearch(query: string, limit: number): Promise<HybridSearchResult[]> {
    try {
      return await this.vectorStore.hybridSearch(query, undefined, limit);
    } catch (error) {
      console.warn('Semantic search failed:', error);
      return [];
    }
  }

  /**
   * 구조적 검색 (그래프 기반)
   */
  private async performStructuralSearch(
    query: string,
    context?: SearchContext,
    limit: number = 10
  ): Promise<HybridSearchResult[]> {
    try {
      // 그래프 기반 검색 로직
      if (context?.currentFile) {
        const relatedNodes = this.graphService.findRelatedNodes(context.currentFile);
        // 관련 노드들을 검색 결과로 변환
        return [];
      }
      return [];
    } catch (error) {
      console.warn('Structural search failed:', error);
      return [];
    }
  }

  /**
   * 컨텍스트 검색 (현재 작업 컨텍스트 기반)
   */
  private async performContextualSearch(
    query: string,
    context?: SearchContext,
    limit: number = 10
  ): Promise<HybridSearchResult[]> {
    try {
      // 컨텍스트 기반 검색 로직
      return [];
    } catch (error) {
      console.warn('Contextual search failed:', error);
      return [];
    }
  }

  /**
   * 패턴 검색 (디자인 패턴 기반)
   */
  private async performPatternSearch(
    query: string,
    intent: SearchIntent,
    limit: number = 10
  ): Promise<HybridSearchResult[]> {
    try {
      // 패턴 기반 검색 로직
      return [];
    } catch (error) {
      console.warn('Pattern search failed:', error);
      return [];
    }
  }

  /**
   * 검색 결과 통합 및 중복 제거
   */
  private combineSearchResults(resultSets: HybridSearchResult[][]): HybridSearchResult[] {
    const seen = new Set<string>();
    const combined: HybridSearchResult[] = [];

    for (const results of resultSets) {
      for (const result of results) {
        const key = `${result.id}_${result.metadata?.filePath}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(result);
        }
      }
    }

    return combined;
  }

  /**
   * 지능형 랭킹 알고리즘 적용
   */
  private async applyIntelligentRanking(
    results: HybridSearchResult[],
    query: string,
    context?: SearchContext
  ): Promise<IntelligentSearchResult[]> {
    const enhancedResults: IntelligentSearchResult[] = [];

    for (const result of results) {
      const relevanceFactors = this.calculateRelevanceFactors(result, query, context);
      const intelligenceScore = this.calculateIntelligenceScore(relevanceFactors);

      enhancedResults.push({
        ...result,
        intelligenceScore,
        relevanceFactors,
        relatedNodes: [],
        suggestedActions: []
      });
    }

    return enhancedResults.sort((a, b) => b.intelligenceScore - a.intelligenceScore);
  }

  /**
   * 관련성 요소 계산
   */
  private calculateRelevanceFactors(
    result: HybridSearchResult,
    query: string,
    context?: SearchContext
  ) {
    const semanticSimilarity = result.score || 0;
    const structuralRelevance = this.calculateStructuralRelevance(result, context);
    const contextualFit = this.calculateContextualFit(result, context);
    const patternMatch = this.calculatePatternMatch(result, query);
    const importance = result.metadata?.graphMetadata?.centrality?.pagerank || 0;

    return {
      semanticSimilarity,
      structuralRelevance,
      contextualFit,
      patternMatch,
      importance
    };
  }

  /**
   * 구조적 관련성 계산
   */
  private calculateStructuralRelevance(result: HybridSearchResult, context?: SearchContext): number {
    // 그래프 기반 구조적 관련성 계산
    return 0.5; // 기본값
  }

  /**
   * 컨텍스트 적합도 계산
   */
  private calculateContextualFit(result: HybridSearchResult, context?: SearchContext): number {
    if (!context) return 0.3;

    let fit = 0;

    // 현재 파일과의 관련성
    if (context.currentFile && result.metadata?.filePath === context.currentFile) {
      fit += 0.5;
    }

    // 최근 조회한 파일들과의 관련성
    if (context.recentlyViewed) {
      const isRecent = context.recentlyViewed.some(file =>
        result.metadata?.filePath?.includes(file)
      );
      if (isRecent) fit += 0.3;
    }

    return Math.min(1, fit);
  }

  /**
   * 패턴 매칭 점수 계산
   */
  private calculatePatternMatch(result: HybridSearchResult, query: string): number {
    const queryLower = query.toLowerCase();
    const contentLower = result.content.toLowerCase();

    // 키워드 매칭
    const keywords = queryLower.split(/\s+/);
    const matches = keywords.filter(keyword => contentLower.includes(keyword));

    return matches.length / keywords.length;
  }

  /**
   * 지능형 점수 계산
   */
  private calculateIntelligenceScore(factors: IntelligentSearchResult['relevanceFactors']): number {
    const weights = {
      semanticSimilarity: 0.30,
      structuralRelevance: 0.25,
      contextualFit: 0.15,
      patternMatch: 0.10,
      importance: 0.20
    };

    return Object.entries(factors).reduce((score, [key, value]) => {
      const weight = weights[key as keyof typeof weights] || 0;
      return score + (value * weight);
    }, 0);
  }

  /**
   * 결과 강화 (관련 노드 및 제안 추가)
   */
  private async enhanceResults(
    results: IntelligentSearchResult[],
    context?: SearchContext
  ): Promise<IntelligentSearchResult[]> {
    for (const result of results) {
      result.relatedNodes = this.findRelatedNodes(result);
      result.suggestedActions = this.generateSuggestions(result, context);
    }
    return results;
  }

  /**
   * 관련 노드 찾기
   */
  private findRelatedNodes(result: IntelligentSearchResult): Array<{
    id: string;
    type: string;
    relation: string;
    strength: number;
  }> {
    // 그래프 서비스를 통해 관련 노드 찾기
    return [];
  }

  /**
   * 제안 사항 생성
   */
  private generateSuggestions(result: IntelligentSearchResult, context?: SearchContext): string[] {
    const suggestions: string[] = [];

    // 기본 제안들
    if (result.relevanceFactors.semanticSimilarity > 0.8) {
      suggestions.push('High semantic relevance - consider for implementation');
    }

    if (result.relevanceFactors.importance > 0.7) {
      suggestions.push('Critical component - changes may have wide impact');
    }

    return suggestions;
  }

  /**
   * 기본 검색으로 폴백
   */
  private async fallbackToBasicSearch(query: string, limit: number): Promise<IntelligentSearchResult[]> {
    try {
      const basicResults = await this.vectorStore.hybridSearch(query, undefined, limit);

      return basicResults.map(result => ({
        ...result,
        intelligenceScore: result.score || 0.5,
        relevanceFactors: {
          semanticSimilarity: result.score || 0.5,
          structuralRelevance: 0.3,
          contextualFit: 0.3,
          patternMatch: 0.3,
          importance: 0.3
        },
        relatedNodes: [],
        suggestedActions: ['Basic search result']
      }));
    } catch (error) {
      console.error('Fallback search also failed:', error);
      return [];
    }
  }
}