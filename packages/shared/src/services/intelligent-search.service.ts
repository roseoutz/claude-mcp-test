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

import { ElasticsearchVectorStore, HybridSearchResult } from './elasticsearch.service.js';
import { CodeGraphService, GraphMetadata } from './code-graph.service.js';
import { AIService } from './ai.service.js';
import { logger } from '../utils/logger.js';

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
  taskContext?: string; // 'debugging', 'refactoring', 'feature-development', etc.
  codebaseArea?: string; // 'frontend', 'backend', 'database', etc.
}

export interface SearchIntent {
  type: 'find_similar' | 'find_dependencies' | 'find_usage' | 'find_pattern' | 'impact_analysis' | 'architecture_search';
  confidence: number;
  keywords: string[];
  filters: {
    languages?: string[];
    fileTypes?: string[];
    patterns?: string[];
    timeRange?: { from: Date; to: Date };
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
    context: SearchContext = {},
    limit: number = 10
  ): Promise<IntelligentSearchResult[]> {
    logger.info(`Performing intelligent search for: "${query}"`);

    try {
      // 1. 검색 의도 분석
      const intent = await this.analyzeSearchIntent(query, context);
      logger.debug(`Search intent: ${intent.type} (confidence: ${intent.confidence})`);

      // 2. 쿼리 임베딩 생성
      const queryEmbedding = await this.aiService.generateEmbedding(query);

      // 3. 다중 검색 전략 실행
      const searchResults = await Promise.all([
        this.performSemanticSearch(query, queryEmbedding, intent, limit * 2),
        this.performStructuralSearch(query, intent, context, limit * 2),
        this.performContextualSearch(query, context, limit),
        this.performPatternSearch(intent, limit)
      ]);

      // 4. 결과 통합 및 중복 제거
      const combinedResults = this.combineSearchResults(searchResults);

      // 5. 지능형 랭킹 적용
      const rankedResults = await this.applyIntelligentRanking(
        combinedResults,
        query,
        queryEmbedding,
        intent,
        context
      );

      // 6. 관련 노드 및 제안 사항 추가
      const enhancedResults = await this.enhanceResults(rankedResults, context);

      logger.info(`Intelligent search returned ${enhancedResults.length} results`);
      return enhancedResults.slice(0, limit);

    } catch (error) {
      logger.error('Failed to perform intelligent search:', error as Error);
      // 폴백: 기본 하이브리드 검색
      return this.fallbackToBasicSearch(query, limit);
    }
  }

  /**
   * 검색 의도 분석
   */
  private async analyzeSearchIntent(query: string, context: SearchContext): Promise<SearchIntent> {
    // AI를 사용한 검색 의도 분석
    const analysisPrompt = `
    Analyze this code search query and determine the search intent:
    Query: "${query}"
    Context: ${JSON.stringify(context)}

    Classify the intent as one of:
    - find_similar: Looking for similar code patterns
    - find_dependencies: Looking for dependencies or imports
    - find_usage: Looking for where something is used
    - find_pattern: Looking for specific design patterns
    - impact_analysis: Analyzing impact of changes
    - architecture_search: Understanding system architecture

    Also extract relevant keywords and suggest filters.
    Return as JSON.
    `;

    try {
      const analysisResult = await this.aiService.explainCode(analysisPrompt, 'text', 'search_intent_analysis');

      // JSON 파싱 시도
      const match = analysisResult.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          type: parsed.type || 'find_similar',
          confidence: parsed.confidence || 0.7,
          keywords: parsed.keywords || query.split(' '),
          filters: parsed.filters || {}
        };
      }
    } catch (error) {
      logger.warn('Failed to analyze search intent, using default:', error as Error);
    }

    // 기본 의도 분석 (패턴 매칭 기반)
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('extends') || lowerQuery.includes('implements') || lowerQuery.includes('inherit')) {
      return { type: 'find_dependencies', confidence: 0.8, keywords: [query], filters: {} };
    } else if (lowerQuery.includes('used') || lowerQuery.includes('called') || lowerQuery.includes('reference')) {
      return { type: 'find_usage', confidence: 0.8, keywords: [query], filters: {} };
    } else if (lowerQuery.includes('pattern') || lowerQuery.includes('design')) {
      return { type: 'find_pattern', confidence: 0.8, keywords: [query], filters: {} };
    } else if (lowerQuery.includes('impact') || lowerQuery.includes('affect') || lowerQuery.includes('change')) {
      return { type: 'impact_analysis', confidence: 0.8, keywords: [query], filters: {} };
    } else {
      return { type: 'find_similar', confidence: 0.6, keywords: query.split(' '), filters: {} };
    }
  }

  /**
   * 의미적 검색 (임베딩 기반)
   */
  private async performSemanticSearch(
    query: string,
    queryEmbedding: number[],
    intent: SearchIntent,
    limit: number
  ): Promise<HybridSearchResult[]> {
    return await this.vectorStore.hybridSearch(query, queryEmbedding, limit);
  }

  /**
   * 구조적 검색 (그래프 기반)
   */
  private async performStructuralSearch(
    query: string,
    intent: SearchIntent,
    context: SearchContext,
    limit: number
  ): Promise<HybridSearchResult[]> {
    const results: HybridSearchResult[] = [];

    switch (intent.type) {
      case 'find_dependencies':
        if (context.currentFunction) {
          const depResults = await this.vectorStore.searchByRelation(
            context.currentFunction,
            ['extends', 'implements', 'imports', 'depends_on'],
            2,
            limit
          );
          results.push(...depResults);
        }
        break;

      case 'find_usage':
        if (context.currentFunction) {
          const usageResults = await this.vectorStore.searchByRelation(
            context.currentFunction,
            ['calls', 'uses', 'references'],
            3,
            limit
          );
          results.push(...usageResults);
        }
        break;

      case 'find_pattern':
        if (intent.filters.patterns) {
          const patternResults = await this.vectorStore.searchByPattern(
            intent.filters.patterns,
            limit
          );
          results.push(...patternResults);
        }
        break;

      case 'impact_analysis':
        if (context.currentFunction) {
          const impactAnalysis = await this.vectorStore.analyzeImpact(context.currentFunction);
          results.push(...impactAnalysis.directlyAffected);
          results.push(...impactAnalysis.indirectlyAffected);
        }
        break;
    }

    return results;
  }

  /**
   * 컨텍스트 검색 (현재 작업 컨텍스트 기반)
   */
  private async performContextualSearch(
    query: string,
    context: SearchContext,
    limit: number
  ): Promise<HybridSearchResult[]> {
    const results: HybridSearchResult[] = [];

    // 현재 파일과 같은 클러스터 내 검색
    if (context.currentFile) {
      // 현재 파일의 클러스터 ID 추정 (실제로는 그래프에서 찾아야 함)
      const clusterResults = await this.vectorStore.searchByCluster('cluster_current', undefined, limit);
      results.push(...clusterResults);
    }

    // 최근 본 코드와 관련된 검색
    if (context.recentlyViewed) {
      for (const recentId of context.recentlyViewed.slice(0, 3)) {
        const relatedResults = await this.vectorStore.searchByRelation(recentId, [], 2, 5);
        results.push(...relatedResults);
      }
    }

    return results;
  }

  /**
   * 패턴 검색 (디자인 패턴 기반)
   */
  private async performPatternSearch(
    intent: SearchIntent,
    limit: number
  ): Promise<HybridSearchResult[]> {
    if (intent.type !== 'find_pattern' || !intent.filters.patterns) {
      return [];
    }

    return await this.vectorStore.searchByPattern(intent.filters.patterns, limit);
  }

  /**
   * 검색 결과 통합 및 중복 제거
   */
  private combineSearchResults(searchResults: HybridSearchResult[][]): HybridSearchResult[] {
    const resultMap = new Map<string, HybridSearchResult>();

    for (const results of searchResults) {
      for (const result of results) {
        if (!resultMap.has(result.id)) {
          resultMap.set(result.id, result);
        } else {
          // 중복된 결과의 경우 더 높은 점수를 유지
          const existing = resultMap.get(result.id)!;
          if (result.score > existing.score) {
            resultMap.set(result.id, result);
          }
        }
      }
    }

    return Array.from(resultMap.values());
  }

  /**
   * 지능형 랭킹 알고리즘 적용
   */
  private async applyIntelligentRanking(
    results: HybridSearchResult[],
    query: string,
    queryEmbedding: number[],
    intent: SearchIntent,
    context: SearchContext
  ): Promise<IntelligentSearchResult[]> {
    const enhancedResults: IntelligentSearchResult[] = [];

    for (const result of results) {
      const relevanceFactors = await this.calculateRelevanceFactors(
        result,
        query,
        queryEmbedding,
        intent,
        context
      );

      const intelligenceScore = this.calculateIntelligenceScore(relevanceFactors, intent);

      enhancedResults.push({
        ...result,
        intelligenceScore,
        relevanceFactors,
        relatedNodes: [],
        suggestedActions: []
      });
    }

    // 지능형 점수로 정렬
    return enhancedResults.sort((a, b) => b.intelligenceScore - a.intelligenceScore);
  }

  /**
   * 관련성 요소 계산
   */
  private async calculateRelevanceFactors(
    result: HybridSearchResult,
    query: string,
    queryEmbedding: number[],
    intent: SearchIntent,
    context: SearchContext
  ) {
    const graphMetadata = result.metadata?.graphMetadata;

    return {
      semanticSimilarity: result.score || 0, // 기존 벡터 유사성 점수
      structuralRelevance: graphMetadata?.centrality?.pagerank || 0,
      contextualFit: this.calculateContextualFit(result, context),
      patternMatch: this.calculatePatternMatch(result, intent),
      importance: graphMetadata?.centrality?.degree || 0
    };
  }

  /**
   * 컨텍스트 적합도 계산
   */
  private calculateContextualFit(result: HybridSearchResult, context: SearchContext): number {
    let score = 0;

    // 같은 파일에 있으면 높은 점수
    if (context.currentFile && result.metadata?.filePath === context.currentFile) {
      score += 0.5;
    }

    // 같은 언어면 가산점
    if (context.codebaseArea && result.metadata?.language?.includes(context.codebaseArea)) {
      score += 0.2;
    }

    // 최근 본 코드와 관련있으면 가산점
    if (context.recentlyViewed?.some(recent =>
      result.metadata?.graphMetadata?.indirectRelations?.siblings?.includes(recent)
    )) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 패턴 매칭 점수 계산
   */
  private calculatePatternMatch(result: HybridSearchResult, intent: SearchIntent): number {
    if (intent.type !== 'find_pattern' || !intent.filters.patterns) {
      return 0;
    }

    const resultPatterns = result.metadata?.graphMetadata?.indirectRelations?.patterns || [];
    const matchedPatterns = intent.filters.patterns.filter(pattern =>
      resultPatterns.includes(pattern)
    );

    return matchedPatterns.length / intent.filters.patterns.length;
  }

  /**
   * 지능형 점수 계산
   */
  private calculateIntelligenceScore(
    factors: IntelligentSearchResult['relevanceFactors'],
    intent: SearchIntent
  ): number {
    // 검색 의도에 따른 가중치 조정
    let weights = {
      semanticSimilarity: 0.30,
      structuralRelevance: 0.25,
      contextualFit: 0.15,
      patternMatch: 0.10,
      importance: 0.20
    };

    switch (intent.type) {
      case 'find_pattern':
        weights = { ...weights, patternMatch: 0.40, semanticSimilarity: 0.20 };
        break;
      case 'find_dependencies':
        weights = { ...weights, structuralRelevance: 0.40, importance: 0.30 };
        break;
      case 'impact_analysis':
        weights = { ...weights, importance: 0.35, structuralRelevance: 0.35 };
        break;
    }

    return (
      factors.semanticSimilarity * weights.semanticSimilarity +
      factors.structuralRelevance * weights.structuralRelevance +
      factors.contextualFit * weights.contextualFit +
      factors.patternMatch * weights.patternMatch +
      factors.importance * weights.importance
    ) * intent.confidence;
  }

  /**
   * 결과 강화 (관련 노드 및 제안 추가)
   */
  private async enhanceResults(
    results: IntelligentSearchResult[],
    context: SearchContext
  ): Promise<IntelligentSearchResult[]> {
    for (const result of results) {
      // 관련 노드 추가
      if (result.metadata?.graphMetadata?.nodeId) {
        const relatedNodes = await this.findRelatedNodes(result.metadata.graphMetadata.nodeId);
        result.relatedNodes = relatedNodes;
      }

      // 제안 사항 추가
      result.suggestedActions = this.generateSuggestions(result, context);
    }

    return results;
  }

  /**
   * 관련 노드 찾기
   */
  private async findRelatedNodes(nodeId: string) {
    const related = await this.vectorStore.searchByRelation(nodeId, [], 1, 5);
    return related.map(r => ({
      id: r.id,
      type: r.metadata?.type || 'unknown',
      relation: 'related',
      strength: r.score
    }));
  }

  /**
   * 제안 사항 생성
   */
  private generateSuggestions(result: IntelligentSearchResult, context: SearchContext): string[] {
    const suggestions: string[] = [];

    // 중요도 기반 제안
    if (result.relevanceFactors.importance > 0.7) {
      suggestions.push('이 코드는 시스템에서 중요한 역할을 합니다. 변경 시 주의하세요.');
    }

    // 패턴 기반 제안
    if (result.relevanceFactors.patternMatch > 0.5) {
      suggestions.push('디자인 패턴이 적용된 코드입니다. 패턴의 의도를 고려하여 수정하세요.');
    }

    // 컨텍스트 기반 제안
    if (context.taskContext === 'debugging' && result.relevanceFactors.structuralRelevance > 0.6) {
      suggestions.push('이 코드와 연결된 다른 컴포넌트들도 확인해보세요.');
    }

    return suggestions;
  }

  /**
   * 기본 검색으로 폴백
   */
  private async fallbackToBasicSearch(query: string, limit: number): Promise<IntelligentSearchResult[]> {
    logger.warn('Falling back to basic hybrid search');

    const basicResults = await this.vectorStore.search(query, limit);

    return basicResults.map(result => ({
      ...result,
      searchType: 'hybrid' as const,
      intelligenceScore: result.score,
      relevanceFactors: {
        semanticSimilarity: result.score,
        structuralRelevance: 0,
        contextualFit: 0,
        patternMatch: 0,
        importance: 0
      },
      relatedNodes: [],
      suggestedActions: ['기본 검색 결과입니다.']
    }));
  }
}