/**
 * Vector Store Service Implementation
 * ChromaDB와 인메모리 벡터 스토어 구현
 */

// import { ChromaApi } from 'chromadb'; // Temporarily disabled due to API compatibility issues
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
      case 'chromadb':
        logger?.info('Creating ChromaDB vector store (stub)');
        return new ChromaVectorStore(vectorConfig.collection, logger);
      
      default:
        logger?.info('Creating in-memory vector store');
        return new InMemoryVectorStore(logger);
    }
  }

  /**
   * ChromaDB 벡터 스토어 생성
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