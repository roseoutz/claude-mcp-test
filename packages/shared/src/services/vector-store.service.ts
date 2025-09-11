/**
 * Vector Store Service Implementation
 * ChromaDB와 인메모리 벡터 스토어 구현
 */

import { ChromaApi, Configuration } from 'chromadb';
import { IVectorStore, ILogger } from '../domain/ports/outbound/index.js';
import { config } from '../config/config-loader.js';
import { calculateSimilarity, isValidVector } from '../utils/vector-utils.js';

export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, any>;
}

/**
 * ChromaDB 벡터 스토어 구현
 */
export class ChromaVectorStore implements IVectorStore {
  private client: ChromaApi;
  private collectionName: string;
  private logger?: ILogger;
  private initialized = false;

  constructor(collectionName?: string, logger?: ILogger) {
    this.collectionName = collectionName || config.get('VECTOR_STORE_COLLECTION');
    this.logger = logger;
    
    const vectorConfig = config.getVectorStoreConfig();
    
    this.client = new ChromaApi(new Configuration({
      basePath: vectorConfig.url || 'http://localhost:8000',
    }));
  }

  async initialize(collection: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.collectionName = collection;
      
      // 컬렉션 존재 여부 확인
      try {
        await this.client.getCollection(this.collectionName);
        this.logger?.info(`Connected to existing collection: ${this.collectionName}`);
      } catch (error) {
        // 컬렉션이 존재하지 않으면 생성
        await this.client.createCollection({
          name: this.collectionName,
          metadata: {
            description: 'Code embeddings for MCP server',
            dimension: config.get('VECTOR_DIMENSION').toString(),
          }
        });
        this.logger?.info(`Created new collection: ${this.collectionName}`);
      }

      this.initialized = true;
    } catch (error) {
      this.logger?.error('Failed to initialize ChromaDB vector store', error as Error);
      throw error;
    }
  }

  async addDocument(
    id: string,
    content: string,
    metadata: Record<string, any>
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    try {
      await this.client.add(this.collectionName, {
        ids: [id],
        documents: [content],
        metadatas: [metadata],
      });
      
      this.logger?.debug(`Stored document for ID: ${id}`);
    } catch (error) {
      this.logger?.error(`Failed to store document for ID ${id}`, error as Error);
      throw error;
    }
  }

  async addDocuments(
    documents: Array<{
      id: string;
      content: string;
      metadata: Record<string, any>;
    }>
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    if (documents.length === 0) {
      return;
    }

    try {
      const ids = documents.map(doc => doc.id);
      const contents = documents.map(doc => doc.content);
      const metadatas = documents.map(doc => doc.metadata);

      await this.client.add(this.collectionName, {
        ids,
        documents: contents,
        metadatas,
      });

      this.logger?.debug(`Stored ${documents.length} documents`);
    } catch (error) {
      this.logger?.error('Failed to store documents batch', error as Error);
      throw error;
    }
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
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    try {
      const results = await this.client.query(this.collectionName, {
        queryTexts: [query],
        nResults: limit,
        where: filter,
        include: ['documents', 'metadatas', 'distances']
      });

      if (!results.ids || !results.documents || !results.metadatas || !results.distances) {
        return [];
      }

      return results.ids[0].map((id, index) => ({
        id,
        score: 1 - (results.distances![0][index] || 1), // Convert distance to similarity score
        content: results.documents![0][index] || '',
        metadata: results.metadatas![0][index] || {}
      }));
    } catch (error) {
      this.logger?.error('Failed to search vectors', error as Error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    try {
      await this.client.deleteCollection(this.collectionName, {
        ids: [id]
      });
      
      this.logger?.debug(`Deleted document for ID: ${id}`);
    } catch (error) {
      this.logger?.error(`Failed to delete document for ID ${id}`, error as Error);
      throw error;
    }
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    try {
      await this.client.deleteCollection(this.collectionName, { ids });
      this.logger?.debug(`Deleted ${ids.length} documents`);
    } catch (error) {
      this.logger?.error('Failed to delete documents batch', error as Error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    try {
      // 컬렉션 삭제 후 재생성
      await this.client.deleteCollection(this.collectionName);
      
      await this.client.createCollection({
        name: this.collectionName,
        metadata: {
          description: 'Code embeddings for MCP server',
          dimension: config.get('VECTOR_DIMENSION').toString(),
        }
      });

      this.logger?.info(`Cleared collection: ${this.collectionName}`);
    } catch (error) {
      this.logger?.error('Failed to clear vector store', error as Error);
      throw error;
    }
  }
}

/**
 * 인메모리 벡터 스토어 (테스트/개발용)
 */
export class InMemoryVectorStore implements IVectorStore {
  private documents = new Map<string, {
    content: string;
    vector?: number[];
    metadata: Record<string, any>;
  }>();
  private logger?: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger;
  }

  async initialize(_collection: string): Promise<void> {
    // 인메모리 스토어는 초기화가 필요 없음
    this.logger?.debug('InMemoryVectorStore initialized');
  }

  async addDocument(
    id: string,
    content: string,
    metadata: Record<string, any>
  ): Promise<void> {
    this.documents.set(id, {
      content,
      metadata: { ...metadata }
    });

    this.logger?.debug(`Stored document for ID: ${id}`);
  }

  async addDocuments(
    documents: Array<{
      id: string;
      content: string;
      metadata: Record<string, any>;
    }>
  ): Promise<void> {
    for (const doc of documents) {
      await this.addDocument(doc.id, doc.content, doc.metadata);
    }

    this.logger?.debug(`Stored ${documents.length} documents`);
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
    const results: Array<{
      id: string;
      score: number;
      content: string;
      metadata: Record<string, any>;
    }> = [];

    // 간단한 텍스트 매칭 (실제 임베딩 없이)
    for (const [id, data] of this.documents.entries()) {
      // 필터 적용
      if (filter && !this.matchesFilter(data.metadata, filter)) {
        continue;
      }

      // 간단한 텍스트 유사도 계산 (실제 프로젝트에서는 임베딩 사용)
      const score = this.calculateTextSimilarity(query, data.content);
      
      if (score > 0) {
        results.push({
          id,
          score,
          content: data.content,
          metadata: data.metadata
        });
      }
    }

    // 점수 기준 내림차순 정렬
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    const deleted = this.documents.delete(id);
    if (deleted) {
      this.logger?.debug(`Deleted document for ID: ${id}`);
    }
  }

  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  async clear(): Promise<void> {
    this.documents.clear();
    this.logger?.debug('Cleared in-memory vector store');
  }

  /**
   * 벡터를 직접 저장하는 메서드 (테스트용)
   */
  async storeVector(
    id: string,
    vector: number[],
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!isValidVector(vector)) {
      throw new Error(`Invalid vector for ID ${id}`);
    }

    this.documents.set(id, {
      content,
      vector,
      metadata
    });
  }

  /**
   * 벡터로 직접 검색하는 메서드 (테스트용)
   */
  async searchByVector(
    queryVector: number[],
    limit: number = 10
  ): Promise<VectorSearchResult[]> {
    if (!isValidVector(queryVector)) {
      throw new Error('Invalid query vector');
    }

    const results: VectorSearchResult[] = [];

    for (const [id, data] of this.documents.entries()) {
      if (data.vector && isValidVector(data.vector)) {
        const similarity = calculateSimilarity(queryVector, data.vector, 'cosine');
        results.push({
          id,
          score: similarity,
          content: data.content,
          metadata: data.metadata
        });
      }
    }

    // 점수 기준 내림차순 정렬
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * 저장된 문서 수 반환
   */
  getDocumentCount(): number {
    return this.documents.size;
  }

  /**
   * 특정 ID의 문서 가져오기
   */
  getDocument(id: string): { content: string; metadata: Record<string, any> } | null {
    const doc = this.documents.get(id);
    return doc ? { content: doc.content, metadata: doc.metadata } : null;
  }

  private matchesFilter(metadata: Record<string, any>, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private calculateTextSimilarity(query: string, content: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word of contentWords) {
      if (queryWords.has(word)) {
        matches++;
      }
    }

    return matches / Math.max(queryWords.size, contentWords.length);
  }
}

/**
 * 벡터 스토어 팩토리
 */
export class VectorStoreFactory {
  static create(type: 'chroma' | 'memory', logger?: ILogger): IVectorStore {
    switch (type) {
      case 'chroma':
        return new ChromaVectorStore(undefined, logger);
      case 'memory':
        return new InMemoryVectorStore(logger);
      default:
        throw new Error(`Unknown vector store type: ${type}`);
    }
  }

  static createFromConfig(logger?: ILogger): IVectorStore {
    const vectorConfig = config.getVectorStoreConfig();
    
    switch (vectorConfig.provider) {
      case 'chromadb':
        return new ChromaVectorStore(vectorConfig.collection, logger);
      default:
        // 개발 환경에서는 기본적으로 인메모리 사용
        if (config.get('NODE_ENV') === 'development') {
          return new InMemoryVectorStore(logger);
        }
        throw new Error(`Unsupported vector store provider: ${vectorConfig.provider}`);
    }
  }
}