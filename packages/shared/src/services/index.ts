/**
 * 서비스 모듈 통합 Export
 * 지능형 코드 검색 시스템의 핵심 서비스들을 제공합니다
 */

// === 핵심 분석 서비스 ===
export {
  IntelligentCodeAnalyzerService
} from './intelligent-code-analyzer.service.js';

export {
  SemanticAnalyzerService,
  type SemanticMetadata,
  type CodeElement
} from './semantic-analyzer.service.js';

export {
  AIDescriptionGeneratorService,
  type AIDescriptionRequest,
  type AIDescriptionResponse
} from './ai-description-generator.service.js';

// === 검색 및 매핑 서비스 ===
export {
  KeywordMappingService,
  type KeywordMapping,
  type SearchQueryExpansion
} from './keyword-mapping.service.js';

export {
  ElasticsearchVectorStore,
  type ElasticsearchDocument,
  type SearchResult,
  type SearchResponse,
  type HybridSearchRequest
} from './elasticsearch.service.js';

// === 지원 서비스 ===
export {
  EmbeddingService,
  MockEmbeddingService
} from './embedding.service.js';

export {
  PromptManagerService,
  type PromptTemplate,
  type PromptData
} from './prompt-manager.service.js';

export {
  CodeGraphService,
  type GraphNode,
  type GraphEdge,
  type CodeGraph
} from './code-graph.service.js';

export {
  GitService
} from './git.service.js';