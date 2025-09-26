/**
 * Vector Store Service Implementation
 * Elasticsearch 하이브리드 서치와 인메모리 벡터 스토어 구현
 *
 * @description
 * 코드베이스 임베딩을 저장하고 하이브리드 검색을 수행하는 벡터 데이터베이스 서비스입니다.
 * Elasticsearch(프로덕션용)와 InMemoryVectorStore(개발/테스트용) 두 가지 구현을 제공합니다.
 *
 * @architecture_pattern
 * - Strategy Pattern: IVectorStore 인터페이스를 통한 다중 구현체 지원
 * - Factory Pattern: VectorStoreFactory를 통한 구현체 생성
 * - Adapter Pattern: 외부 벡터 DB와 도메인 로직 사이의 어댑터
 *
 * @vector_operations
 * 1. Document Storage: 텍스트와 메타데이터를 벡터로 변환하여 저장
 * 2. Hybrid Search: kNN 벡터 검색 + BM25 키워드 검색 결합
 * 3. Batch Operations: 대량 문서 처리를 위한 배치 연산
 * 4. Collection Management: 인덱스 생성 및 관리
 * 5. Metadata Filtering: 메타데이터 기반 검색 결과 필터링
 *
 * @implementation_strategy
 * - ElasticsearchVectorStore: Elasticsearch 기반 하이브리드 검색 엔진
 * - InMemoryVectorStore: 메모리 기반 벡터 저장 및 검색
 * - VectorStoreFactory: 설정에 따른 적절한 구현체 선택
 *
 * @performance_characteristics
 * - Elasticsearch: 하이브리드 검색, 확장성, 실시간 검색 지원
 * - InMemory: 빠른 속도, 휘발성 저장, 개발/테스트 최적화
 * - 벡터 차원: 1536 (OpenAI text-embedding-ada-002 모델 기준)
 */

import { IVectorStore, ILogger } from '../domain/ports/outbound/index.js';
import { config } from '../config/config-loader.js';
import { calculateSimilarity, isValidVector } from '../utils/vector-utils.js';
import { ElasticsearchVectorStore } from './elasticsearch.service.js';

export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, any>;
}



/**
 * 벡터 스토어 팩토리
 */
export class VectorStoreFactory {
  /**
   * 설정에 따라 Elasticsearch 벡터 스토어 인스턴스 생성
   */
  static createFromConfig(logger?: ILogger): IVectorStore {
    const vectorConfig = config.getVectorStoreConfig();

    logger?.info('Creating Elasticsearch vector store (only supported provider)');
    return new ElasticsearchVectorStore(vectorConfig.collection, logger);
  }

  /**
   * Elasticsearch 벡터 스토어 생성
   */
  static createElasticsearchStore(
    collection?: string,
    logger?: ILogger
  ): ElasticsearchVectorStore {
    return new ElasticsearchVectorStore(collection, logger);
  }
}