/**
 * 🧠 지능형 코드 검색 시스템 타입 정의
 * 모든 핵심 타입들을 한 곳에 모아 관리합니다
 */

// ================================
// 🔍 검색 관련 타입
// ================================

/** 검색 옵션 */
export interface SearchOptions {
  query: string;
  size?: number;
  searchMode?: 'semantic' | 'keyword' | 'hybrid' | 'enhanced';
  domains?: string[];
  elementTypes?: string[];
  complexity?: string[];
  weights?: {
    semantic?: number;
    keyword?: number;
    vector?: number;
  };
}

/** 기본 검색 결과 */
export interface SearchResult {
  id: string;
  score: number;
  metadata: {
    filePath: string;
    semanticMetadata?: SemanticMetadata;
  };
  semanticMatches?: {
    descriptionMatch?: number;
    keywordMatch?: number;
    conceptMatch?: number;
  };
}

/** 검색 응답 */
export interface SearchResponse {
  results: SearchResult[];
  searchTime: number;
}

/** 향상된 검색 결과 */
export interface EnhancedSearchResult extends SearchResponse {
  queryExpansion?: {
    originalQuery: string;
    expandedKeywords: Array<{ keyword: string; weight: number }>;
    synonyms: string[];
    relatedTerms: string[];
  };
}

// ================================
// 📊 코드 분석 관련 타입
// ================================

/** 코드 분석 요청 */
export interface CodeAnalysisRequest {
  repositoryPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  generateDescriptions?: boolean;
  buildGraph?: boolean;
  maxFiles?: number;
  onProgress?: (progress: AnalysisProgress) => void;
}

/** 분석 진행 상황 */
export interface AnalysisProgress {
  phase: 'scanning' | 'parsing' | 'analyzing' | 'indexing' | 'complete';
  processedFiles: number;
  totalFiles: number;
  percentage: number;
}

/** 코드 분석 결과 */
export interface CodeAnalysisResult {
  success: boolean;
  error?: string;
  summary: {
    filesProcessed: number;
    elementsAnalyzed: number;
    descriptionsGenerated: number;
  };
  processingTime: {
    total: number;
    perFile?: number;
  };
  qualityMetrics: {
    descriptionQuality: number;    // 0-1: AI 설명의 품질
    keywordRelevance: number;      // 0-1: 키워드 관련성
    semanticCoverage: number;      // 0-1: 의미적 커버리지
    searchAccuracy: number;        // 0-1: 예상 검색 정확도
  };
}

// ================================
// 🏷️ 메타데이터 및 코드 요소 타입
// ================================

/** 의미적 메타데이터 */
export interface SemanticMetadata {
  // 기본 정보
  name: string;
  elementType: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'type';

  // AI 생성 정보
  description?: string;           // AI가 생성한 자연어 설명
  purpose?: string;              // 주요 목적/역할

  // 키워드 및 분류
  keywords?: string[];           // 관련 키워드들 (한국어 + 영어)
  synonyms?: string[];          // 동의어들
  domain?: string;              // 도메인 분류 (authentication, user, etc.)

  // 사용성 정보
  usagePatterns?: string[];     // 사용 패턴들
  relatedConcepts?: string[];   // 관련 개념들

  // 품질 지표
  confidence?: number;          // 0-1: AI 분석 신뢰도
  complexity?: 'low' | 'medium' | 'high';
  maintainability?: number;     // 0-1: 유지보수성 점수

  // 위치 정보
  startPosition?: number;
  endPosition?: number;
  content?: string;             // 코드 내용
}

/** 코드 요소 */
export interface CodeElement extends SemanticMetadata {
  filePath: string;
  lineNumber?: number;
  parentElement?: string;       // 상위 클래스/함수명
}

// ================================
// 🗝️ 키워드 매핑 관련 타입
// ================================

/** 키워드 매핑 */
export interface KeywordMapping {
  keyword: string;
  domain: string;
  weight: number;
  synonyms: string[];
  relatedTerms: string[];
  language: 'ko' | 'en' | 'mixed';
}

/** 검색 쿼리 확장 */
export interface SearchQueryExpansion {
  originalQuery: string;
  expandedKeywords: KeywordMapping[];
  synonyms: string[];
  relatedConcepts: string[];
  domainWeights: { [domain: string]: number };
}

// ================================
// 🤖 AI 관련 타입
// ================================

/** AI 설명 생성 요청 */
export interface AIDescriptionRequest {
  name: string;
  type: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'type';
  codeContext: string;
  filePath: string;
}

/** AI 설명 생성 응답 */
export interface AIDescriptionResponse {
  description: string;
  purpose: string;
  keywords: string[];
  synonyms: string[];
  usagePatterns: string[];
  relatedConcepts: string[];
  confidence: number;
}

// ================================
// 🗄️ 저장소 관련 타입
// ================================

/** Elasticsearch 문서 */
export interface ElasticsearchDocument {
  id: string;
  content: string;
  metadata: {
    filePath: string;
    semanticMetadata?: SemanticMetadata;
  };
}

/** 하이브리드 검색 요청 */
export interface HybridSearchRequest {
  query: string;
  size?: number;
  expandedKeywords?: string[];
  domains?: string[];
  elementTypes?: string[];
  weights?: {
    vector?: number;
    keyword?: number;
    semantic?: number;
  };
}

// ================================
// 📈 통계 및 품질 메트릭 타입
// ================================

/** 검색 품질 메트릭 */
export interface SearchQualityMetrics {
  precision: number;            // 정밀도
  recall: number;              // 재현율
  f1Score: number;             // F1 점수
  averageResponseTime: number; // 평균 응답 시간 (ms)
}

/** 키워드 유사도 */
export interface KeywordSimilarity {
  keyword1: string;
  keyword2: string;
  similarity: number;
  type: 'semantic' | 'syntactic' | 'domain' | 'synonym';
}

// ================================
// 🏗️ 구성 옵션 타입
// ================================

/** 서비스 설정 옵션 */
export interface IntelligentSearchConfig {
  // AI 설정
  aiProvider: 'openai' | 'anthropic';
  temperature: number;
  maxTokens: number;
  batchSize: number;

  // 검색 설정
  defaultSearchSize: number;
  maxSearchSize: number;
  searchTimeout: number;

  // 품질 설정
  confidenceThreshold: number;
  minKeywordLength: number;
  maxDescriptionLength: number;
}

/** 도메인별 옵션 */
export interface DomainExploreOptions {
  size?: number;
  elementTypes?: string[];
  includeRelated?: boolean;
  sortBy?: 'relevance' | 'confidence' | 'alphabetical';
}