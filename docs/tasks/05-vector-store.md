# Task 05: Vector Store 구현

## 목표
ChromaDB를 활용한 벡터 임베딩 저장소 구현

## 작업 내용

### 1. ChromaDB 클라이언트 (`src/services/vector-store.service.ts`)
```typescript
import { ChromaClient, Collection, CollectionType } from 'chromadb';
import { IVectorStore, VectorSearchResult } from '../types/repositories.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config-loader.js';

export class VectorStoreService implements IVectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private readonly collectionName: string;

  constructor(collectionName: string = 'codebase_embeddings') {
    this.collectionName = collectionName;
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000'
    });
  }

  async initialize(): Promise<void> {
    try {
      // 컬렉션 생성 또는 가져오기
      const collections = await this.client.listCollections();
      const exists = collections.some(c => c.name === this.collectionName);

      if (exists) {
        this.collection = await this.client.getCollection({
          name: this.collectionName,
        });
        logger.info(`Connected to existing collection: ${this.collectionName}`);
      } else {
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: { 
            description: 'Code embeddings for MCP server',
            dimension: config.get('VECTOR_DIMENSION')
          }
        });
        logger.info(`Created new collection: ${this.collectionName}`);
      }
    } catch (error) {
      logger.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  async store(
    id: string, 
    vector: number[], 
    metadata: Record<string, any>
  ): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      await this.collection!.add({
        ids: [id],
        embeddings: [vector],
        metadatas: [metadata],
        documents: [metadata.content || ''] // ChromaDB requires documents
      });
      
      logger.debug(`Stored vector for ID: ${id}`);
    } catch (error) {
      logger.error(`Failed to store vector for ID ${id}:`, error);
      throw error;
    }
  }

  async search(
    vector: number[], 
    limit: number = 10
  ): Promise<VectorSearchResult[]> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      const results = await this.collection!.query({
        queryEmbeddings: [vector],
        nResults: limit,
      });

      if (!results.ids || !results.distances || !results.metadatas) {
        return [];
      }

      return results.ids[0].map((id, index) => ({
        id,
        score: 1 - (results.distances![0][index] || 0), // Convert distance to similarity
        metadata: results.metadatas![0][index] || {}
      }));
    } catch (error) {
      logger.error('Failed to search vectors:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      await this.collection!.delete({
        ids: [id]
      });
      logger.debug(`Deleted vector for ID: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete vector for ID ${id}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      // ChromaDB에서 컬렉션 삭제 후 재생성
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: { 
          description: 'Code embeddings for MCP server',
          dimension: config.get('VECTOR_DIMENSION')
        }
      });
      logger.info(`Cleared collection: ${this.collectionName}`);
    } catch (error) {
      logger.error('Failed to clear vector store:', error);
      throw error;
    }
  }

  async upsert(
    id: string,
    vector: number[],
    metadata: Record<string, any>
  ): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      // ChromaDB automatically handles upsert
      await this.collection!.upsert({
        ids: [id],
        embeddings: [vector],
        metadatas: [metadata],
        documents: [metadata.content || '']
      });
      
      logger.debug(`Upserted vector for ID: ${id}`);
    } catch (error) {
      logger.error(`Failed to upsert vector for ID ${id}:`, error);
      throw error;
    }
  }

  async getById(id: string): Promise<VectorSearchResult | null> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      const result = await this.collection!.get({
        ids: [id],
        include: ['embeddings', 'metadatas']
      });

      if (!result.ids || result.ids.length === 0) {
        return null;
      }

      return {
        id: result.ids[0],
        score: 1.0, // Direct retrieval has perfect score
        metadata: result.metadatas?.[0] || {}
      };
    } catch (error) {
      logger.error(`Failed to get vector for ID ${id}:`, error);
      return null;
    }
  }

  async count(): Promise<number> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      const count = await this.collection!.count();
      return count;
    } catch (error) {
      logger.error('Failed to count vectors:', error);
      return 0;
    }
  }
}

/**
 * 인메모리 벡터 스토어 (테스트/개발용)
 */
export class InMemoryVectorStore implements IVectorStore {
  private vectors = new Map<string, {
    vector: number[];
    metadata: Record<string, any>;
  }>();

  async store(
    id: string,
    vector: number[],
    metadata: Record<string, any>
  ): Promise<void> {
    this.vectors.set(id, { vector, metadata });
  }

  async search(
    queryVector: number[],
    limit: number = 10
  ): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const [id, data] of this.vectors.entries()) {
      const similarity = this.cosineSimilarity(queryVector, data.vector);
      results.push({
        id,
        score: similarity,
        metadata: data.metadata
      });
    }

    // 점수 기준 내림차순 정렬
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async clear(): Promise<void> {
    this.vectors.clear();
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}
```

### 2. 벡터 스토어 유틸리티 (`src/utils/vector-utils.ts`)
```typescript
/**
 * 텍스트를 청크로 분할
 */
export function splitTextIntoChunks(
  text: string,
  maxChunkSize: number = 1000,
  overlap: number = 100
): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk);
        // 오버랩 처리
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n' + line;
      } else {
        // 단일 라인이 maxChunkSize보다 큰 경우
        chunks.push(line.slice(0, maxChunkSize));
        currentChunk = line.slice(maxChunkSize - overlap);
      }
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * 벡터 정규화
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(
    vector.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude === 0) {
    return vector;
  }

  return vector.map(val => val / magnitude);
}

/**
 * 두 벡터 간 유사도 계산
 */
export function calculateSimilarity(
  vector1: number[],
  vector2: number[],
  method: 'cosine' | 'euclidean' | 'dot' = 'cosine'
): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  switch (method) {
    case 'cosine': {
      const dotProduct = vector1.reduce(
        (sum, val, i) => sum + val * vector2[i], 0
      );
      const mag1 = Math.sqrt(
        vector1.reduce((sum, val) => sum + val * val, 0)
      );
      const mag2 = Math.sqrt(
        vector2.reduce((sum, val) => sum + val * val, 0)
      );
      return dotProduct / (mag1 * mag2);
    }

    case 'euclidean': {
      const distance = Math.sqrt(
        vector1.reduce(
          (sum, val, i) => sum + Math.pow(val - vector2[i], 2), 0
        )
      );
      return 1 / (1 + distance); // Convert distance to similarity
    }

    case 'dot': {
      return vector1.reduce(
        (sum, val, i) => sum + val * vector2[i], 0
      );
    }

    default:
      throw new Error(`Unknown similarity method: ${method}`);
  }
}
```

### 3. 테스트 작성 (`src/__tests__/services/vector-store.test.ts`)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVectorStore } from '../../services/vector-store.service.js';
import { normalizeVector, calculateSimilarity } from '../../utils/vector-utils.js';

describe('VectorStore', () => {
  let vectorStore: InMemoryVectorStore;

  beforeEach(() => {
    vectorStore = new InMemoryVectorStore();
  });

  describe('InMemoryVectorStore', () => {
    it('should store and retrieve vectors', async () => {
      const vector = [0.1, 0.2, 0.3];
      const metadata = { file: 'test.ts', line: 10 };

      await vectorStore.store('test-id', vector, metadata);

      const results = await vectorStore.search(vector, 1);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-id');
      expect(results[0].score).toBeCloseTo(1.0);
    });

    it('should search similar vectors', async () => {
      await vectorStore.store('vec1', [1, 0, 0], { name: 'vec1' });
      await vectorStore.store('vec2', [0.9, 0.1, 0], { name: 'vec2' });
      await vectorStore.store('vec3', [0, 1, 0], { name: 'vec3' });

      const results = await vectorStore.search([1, 0, 0], 2);
      
      expect(results[0].id).toBe('vec1');
      expect(results[1].id).toBe('vec2');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should delete vectors', async () => {
      await vectorStore.store('test-id', [0.1, 0.2, 0.3], {});
      await vectorStore.delete('test-id');

      const results = await vectorStore.search([0.1, 0.2, 0.3], 10);
      expect(results).toHaveLength(0);
    });

    it('should clear all vectors', async () => {
      await vectorStore.store('id1', [1, 0, 0], {});
      await vectorStore.store('id2', [0, 1, 0], {});
      await vectorStore.clear();

      const results = await vectorStore.search([1, 0, 0], 10);
      expect(results).toHaveLength(0);
    });
  });

  describe('Vector Utilities', () => {
    it('should normalize vectors', () => {
      const vector = [3, 4];
      const normalized = normalizeVector(vector);
      
      expect(normalized[0]).toBeCloseTo(0.6);
      expect(normalized[1]).toBeCloseTo(0.8);
    });

    it('should calculate cosine similarity', () => {
      const vec1 = [1, 0];
      const vec2 = [1, 0];
      const vec3 = [0, 1];

      expect(calculateSimilarity(vec1, vec2, 'cosine')).toBeCloseTo(1.0);
      expect(calculateSimilarity(vec1, vec3, 'cosine')).toBeCloseTo(0.0);
    });
  });
});
```

### 4. Docker Compose 설정 추가
```yaml
# docker-compose.yml에 추가
chromadb:
  image: chromadb/chroma:latest
  ports:
    - "8000:8000"
  volumes:
    - ./data/chroma:/chroma/chroma
  environment:
    - IS_PERSISTENT=TRUE
    - PERSIST_DIRECTORY=/chroma/chroma
    - ANONYMIZED_TELEMETRY=FALSE
```

## 체크리스트
- [ ] VectorStoreService 클래스 구현
- [ ] InMemoryVectorStore 구현 (테스트용)
- [ ] 벡터 유틸리티 함수 구현
- [ ] ChromaDB 연동 설정
- [ ] 단위 테스트 작성
- [ ] Docker Compose 설정

## 커밋 메시지
```
feat: Vector Store 서비스 구현

- ChromaDB 클라이언트 통합
- 인메모리 벡터 스토어 (테스트용)
- 벡터 연산 유틸리티 함수
- 텍스트 청킹 기능
```

## 예상 소요 시간
2시간

## 의존성
- chromadb
- Docker (ChromaDB 실행용)

## 검증 방법
- ChromaDB 연결 테스트
- 벡터 저장/검색 기능 테스트
- 유사도 계산 정확도 확인