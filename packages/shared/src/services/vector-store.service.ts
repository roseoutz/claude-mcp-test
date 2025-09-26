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
 * ChromaDB 벡터 스토어 구현 (임시로 스텁 버전)
 */
export class ChromaVectorStore implements IVectorStore {
  private collectionName: string;
  private logger?: ILogger;
  private initialized = false;

  constructor(collectionName?: string, logger?: ILogger) {
    this.collectionName = collectionName || config.get('VECTOR_STORE_COLLECTION');
    this.logger = logger;
    
    // ChromaDB initialization disabled due to API compatibility issues
    this.logger?.warn('ChromaDB is temporarily disabled, using stub implementation');
  }

  async initialize(collection: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    // ChromaDB disabled - using stub implementation
    this.collectionName = collection;
    this.initialized = true;
    this.logger?.info(`ChromaVectorStore (stub) initialized with collection: ${this.collectionName}`);
  }

  async addDocument(
    id: string, 
    content: string, 
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('ChromaVectorStore not initialized. Call initialize() first.');
    }

    // Stub implementation
    this.logger?.debug(`Adding document (stub): ${id}`);
  }

  async addDocuments(
    documents: Array<{
      id: string;
      content: string;
      metadata: Record<string, any>;
    }>
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('ChromaVectorStore not initialized. Call initialize() first.');
    }

    // Stub implementation
    this.logger?.debug(`Adding ${documents.length} documents (stub)`);
  }

  async search(
    query: string, 
    limit: number = 10,
    filter?: Record<string, any>
  ): Promise<Array<{
    id: string;
    score: number;
    content: string;
    metadata: Record<string, any>;
  }>> {
    if (!this.initialized) {
      throw new Error('ChromaVectorStore not initialized. Call initialize() first.');
    }

    // Stub implementation - return empty results
    this.logger?.debug(`Searching documents (stub), query: ${query}, limit: ${limit}`);
    return [];
  }

  async delete(id: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('ChromaVectorStore not initialized. Call initialize() first.');
    }

    // Stub implementation
    this.logger?.debug(`Deleting document (stub): ${id}`);
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('ChromaVectorStore not initialized. Call initialize() first.');
    }

    // Stub implementation
    this.logger?.debug(`Deleting ${ids.length} documents (stub)`);
  }

  async clear(): Promise<void> {
    if (!this.initialized) {
      throw new Error('ChromaVectorStore not initialized. Call initialize() first.');
    }

    // Stub implementation
    this.logger?.debug('Clearing all documents (stub)');
  }

  async count(): Promise<number> {
    if (!this.initialized) {
      throw new Error('ChromaVectorStore not initialized. Call initialize() first.');
    }

    // Stub implementation
    return 0;
  }
}

/**
 * 인메모리 벡터 스토어 구현
 */
export class InMemoryVectorStore implements IVectorStore {
  private documents: Map<string, {
    content: string;
    metadata: Record<string, any>;
  }> = new Map();
  
  private logger?: ILogger;
  private initialized = false;

  constructor(logger?: ILogger) {
    this.logger = logger;
  }

  async initialize(collection: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.logger?.info(`InMemoryVectorStore initialized with collection: ${collection}`);
  }

  async addDocument(
    id: string, 
    content: string, 
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('InMemoryVectorStore not initialized. Call initialize() first.');
    }

    this.documents.set(id, { content, metadata });
    this.logger?.debug(`Added document: ${id}`);
  }

  async addDocuments(
    documents: Array<{
      id: string;
      content: string;
      metadata: Record<string, any>;
    }>
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('InMemoryVectorStore not initialized. Call initialize() first.');
    }

    for (const doc of documents) {
      this.documents.set(doc.id, { content: doc.content, metadata: doc.metadata });
    }
    this.logger?.debug(`Added ${documents.length} documents`);
  }

  async search(
    query: string, 
    limit: number = 10,
    filter?: Record<string, any>
  ): Promise<Array<{
    id: string;
    score: number;
    content: string;
    metadata: Record<string, any>;
  }>> {
    if (!this.initialized) {
      throw new Error('InMemoryVectorStore not initialized. Call initialize() first.');
    }

    const results: Array<{
      id: string;
      score: number;
      content: string;
      metadata: Record<string, any>;
    }> = [];
    
    // Simple text-based search (no vector similarity)
    const queryLower = query.toLowerCase();
    
    for (const [id, data] of this.documents) {
      // Apply filter if provided
      if (filter) {
        const matches = Object.entries(filter).every(([key, value]) => 
          data.metadata[key] === value
        );
        if (!matches) continue;
      }

      // Simple text matching score
      const contentLower = data.content.toLowerCase();
      const score = contentLower.includes(queryLower) ? 
        queryLower.length / contentLower.length : 0;
      
      if (score > 0) {
        results.push({
          id,
          score,
          content: data.content,
          metadata: data.metadata
        });
      }
    }

    // Sort by score (descending) and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('InMemoryVectorStore not initialized. Call initialize() first.');
    }

    const deleted = this.documents.delete(id);
    if (deleted) {
      this.logger?.debug(`Deleted document: ${id}`);
    }
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('InMemoryVectorStore not initialized. Call initialize() first.');
    }

    let deletedCount = 0;
    for (const id of ids) {
      if (this.documents.delete(id)) {
        deletedCount++;
      }
    }
    this.logger?.debug(`Deleted ${deletedCount} documents`);
  }

  async clear(): Promise<void> {
    if (!this.initialized) {
      throw new Error('InMemoryVectorStore not initialized. Call initialize() first.');
    }

    const count = this.documents.size;
    this.documents.clear();
    this.logger?.info(`Cleared ${count} documents from memory store`);
  }

  async count(): Promise<number> {
    if (!this.initialized) {
      throw new Error('InMemoryVectorStore not initialized. Call initialize() first.');
    }

    return this.documents.size;
  }
}

/**
 * 벡터 스토어 팩토리
 */
export class VectorStoreFactory {
  /**
   * 설정에 따라 적절한 벡터 스토어 인스턴스 생성
   */
  static createFromConfig(logger?: ILogger): IVectorStore {
    const vectorConfig = config.getVectorStoreConfig();

    switch (vectorConfig.provider) {
      case 'elasticsearch':
        logger?.info('Creating Elasticsearch vector store (hybrid search)');
        return new ElasticsearchVectorStore(vectorConfig.collection, logger);

      case 'chromadb':
        logger?.info('Creating ChromaDB vector store (stub - deprecated)');
        return new ChromaVectorStore(vectorConfig.collection, logger);

      default:
        logger?.info('Creating in-memory vector store');
        return new InMemoryVectorStore(logger);
    }
  }

  /**
   * Elasticsearch 벡터 스토어 생성 (권장)
   */
  static createElasticsearchStore(
    collection?: string,
    logger?: ILogger
  ): ElasticsearchVectorStore {
    return new ElasticsearchVectorStore(collection, logger);
  }

  /**
   * ChromaDB 벡터 스토어 생성 (deprecated)
   */
  static createChromaStore(
    collection?: string,
    logger?: ILogger
  ): ChromaVectorStore {
    return new ChromaVectorStore(collection, logger);
  }

  /**
   * 인메모리 벡터 스토어 생성
   */
  static createMemoryStore(logger?: ILogger): InMemoryVectorStore {
    return new InMemoryVectorStore(logger);
  }
}