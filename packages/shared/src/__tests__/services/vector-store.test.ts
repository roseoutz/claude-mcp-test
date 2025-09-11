import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVectorStore, VectorStoreFactory } from '../../services/vector-store.service.js';
import { 
  normalizeVector, 
  calculateSimilarity, 
  splitTextIntoChunks,
  preprocessTextForEmbedding,
  isValidTextForEmbedding,
  isValidVector
} from '../../utils/vector-utils.js';

describe('VectorStore', () => {
  describe('InMemoryVectorStore', () => {
    let vectorStore: InMemoryVectorStore;

    beforeEach(() => {
      vectorStore = new InMemoryVectorStore();
    });

    it('should initialize successfully', async () => {
      await expect(vectorStore.initialize('test-collection')).resolves.toBeUndefined();
    });

    it('should store and search documents', async () => {
      await vectorStore.initialize('test');
      
      const documents = [
        {
          id: 'doc1',
          content: 'This is a test document about machine learning',
          metadata: { type: 'article', category: 'tech' }
        },
        {
          id: 'doc2', 
          content: 'Another document discussing artificial intelligence',
          metadata: { type: 'blog', category: 'tech' }
        },
        {
          id: 'doc3',
          content: 'A cooking recipe for chocolate cake',
          metadata: { type: 'recipe', category: 'food' }
        }
      ];

      await vectorStore.addDocuments(documents);

      expect(vectorStore.getDocumentCount()).toBe(3);

      // 텍스트 검색 테스트
      const results = await vectorStore.search('machine learning', 10);
      expect(results.length).toBeGreaterThan(0);
      
      // 가장 관련성 높은 문서가 첫 번째여야 함
      const firstResult = results[0];
      expect(firstResult.id).toBe('doc1');
      expect(firstResult.score).toBeGreaterThan(0);

      // 'machine' 단어로도 검색 테스트
      const machineResults = await vectorStore.search('machine', 10);
      expect(machineResults.length).toBeGreaterThan(0);
      expect(machineResults.some(r => r.id === 'doc1')).toBe(true);
    });

    it('should filter documents by metadata', async () => {
      await vectorStore.initialize('test');
      
      await vectorStore.addDocuments([
        {
          id: 'tech1',
          content: 'Technology article',
          metadata: { category: 'tech', published: true }
        },
        {
          id: 'food1',
          content: 'Food recipe',
          metadata: { category: 'food', published: true }
        },
        {
          id: 'tech2',
          content: 'Draft tech article',
          metadata: { category: 'tech', published: false }
        }
      ]);

      // 카테고리 필터링
      const techResults = await vectorStore.search('article', 10, { category: 'tech' });
      expect(techResults).toHaveLength(2);
      expect(techResults.every(r => r.metadata.category === 'tech')).toBe(true);

      // 복합 필터링
      const publishedTechResults = await vectorStore.search('article', 10, { 
        category: 'tech', 
        published: true 
      });
      expect(publishedTechResults).toHaveLength(1);
      expect(publishedTechResults[0].id).toBe('tech1');
    });

    it('should store and search by vectors', async () => {
      await vectorStore.initialize('test');

      const vector1 = [1, 0, 0];
      const vector2 = [0.9, 0.1, 0];
      const vector3 = [0, 1, 0];

      await vectorStore.storeVector('vec1', vector1, 'Document 1', { name: 'vec1' });
      await vectorStore.storeVector('vec2', vector2, 'Document 2', { name: 'vec2' });
      await vectorStore.storeVector('vec3', vector3, 'Document 3', { name: 'vec3' });

      const results = await vectorStore.searchByVector([1, 0, 0], 2);
      
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('vec1');
      expect(results[1].id).toBe('vec2');
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[0].score).toBeCloseTo(1.0, 5);
    });

    it('should handle vector validation', async () => {
      await vectorStore.initialize('test');

      // 유효하지 않은 벡터로 저장 시도
      await expect(
        vectorStore.storeVector('invalid', [NaN, 1, 2], 'content')
      ).rejects.toThrow('Invalid vector');

      await expect(
        vectorStore.storeVector('invalid', [], 'content')
      ).rejects.toThrow('Invalid vector');

      // 유효하지 않은 벡터로 검색 시도
      await expect(
        vectorStore.searchByVector([Infinity, 1])
      ).rejects.toThrow('Invalid query vector');
    });

    it('should delete documents', async () => {
      await vectorStore.initialize('test');

      await vectorStore.addDocument('test-id', 'test content', { type: 'test' });
      expect(vectorStore.getDocument('test-id')).toBeTruthy();

      await vectorStore.delete('test-id');
      expect(vectorStore.getDocument('test-id')).toBeNull();
      expect(vectorStore.getDocumentCount()).toBe(0);
    });

    it('should delete multiple documents', async () => {
      await vectorStore.initialize('test');

      await vectorStore.addDocuments([
        { id: 'id1', content: 'content1', metadata: {} },
        { id: 'id2', content: 'content2', metadata: {} },
        { id: 'id3', content: 'content3', metadata: {} }
      ]);

      expect(vectorStore.getDocumentCount()).toBe(3);

      await vectorStore.deleteMany(['id1', 'id3']);
      expect(vectorStore.getDocumentCount()).toBe(1);
      expect(vectorStore.getDocument('id2')).toBeTruthy();
      expect(vectorStore.getDocument('id1')).toBeNull();
      expect(vectorStore.getDocument('id3')).toBeNull();
    });

    it('should clear all documents', async () => {
      await vectorStore.initialize('test');

      await vectorStore.addDocuments([
        { id: 'id1', content: 'content1', metadata: {} },
        { id: 'id2', content: 'content2', metadata: {} }
      ]);

      expect(vectorStore.getDocumentCount()).toBe(2);

      await vectorStore.clear();
      expect(vectorStore.getDocumentCount()).toBe(0);
    });
  });

  describe('Vector Utilities', () => {
    describe('normalizeVector', () => {
      it('should normalize vectors correctly', () => {
        const vector = [3, 4];
        const normalized = normalizeVector(vector);
        
        expect(normalized[0]).toBeCloseTo(0.6, 5);
        expect(normalized[1]).toBeCloseTo(0.8, 5);
      });

      it('should handle zero vectors', () => {
        const vector = [0, 0, 0];
        const normalized = normalizeVector(vector);
        
        expect(normalized).toEqual([0, 0, 0]);
      });

      it('should handle invalid vectors', () => {
        const vector = [NaN, Infinity];
        const normalized = normalizeVector(vector);
        
        expect(normalized).toEqual([0, 0]);
      });
    });

    describe('calculateSimilarity', () => {
      it('should calculate cosine similarity correctly', () => {
        const vec1 = [1, 0];
        const vec2 = [1, 0];
        const vec3 = [0, 1];

        expect(calculateSimilarity(vec1, vec2, 'cosine')).toBeCloseTo(1.0, 5);
        expect(calculateSimilarity(vec1, vec3, 'cosine')).toBeCloseTo(0.0, 5);
      });

      it('should calculate euclidean similarity correctly', () => {
        const vec1 = [0, 0];
        const vec2 = [0, 0];
        const vec3 = [1, 1];

        const sim1 = calculateSimilarity(vec1, vec2, 'euclidean');
        const sim2 = calculateSimilarity(vec1, vec3, 'euclidean');

        expect(sim1).toBe(1.0); // Same vectors
        expect(sim2).toBeLessThan(sim1); // Different vectors
      });

      it('should calculate dot product correctly', () => {
        const vec1 = [1, 2];
        const vec2 = [3, 4];

        const dotProduct = calculateSimilarity(vec1, vec2, 'dot');
        expect(dotProduct).toBe(11); // 1*3 + 2*4 = 11
      });

      it('should throw error for mismatched dimensions', () => {
        expect(() => {
          calculateSimilarity([1, 2], [1, 2, 3]);
        }).toThrow('Vectors must have the same dimension');
      });

      it('should throw error for unknown method', () => {
        expect(() => {
          calculateSimilarity([1, 2], [1, 2], 'unknown' as any);
        }).toThrow('Unknown similarity method');
      });
    });

    describe('splitTextIntoChunks', () => {
      it('should split text into chunks', () => {
        const text = 'Line 1\nLine 2\nLine 3\nLine 4';
        const chunks = splitTextIntoChunks(text, 10, 2);
        
        expect(chunks.length).toBeGreaterThan(1);
        chunks.forEach(chunk => {
          expect(chunk.length).toBeLessThanOrEqual(12); // 10 + 2 overlap margin
        });
      });

      it('should handle overlap correctly', () => {
        const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const chunks = splitTextIntoChunks(text, 10, 3);
        
        expect(chunks.length).toBeGreaterThan(1);
        
        // 오버랩 확인 (간단한 체크)
        if (chunks.length > 1) {
          const firstChunkEnd = chunks[0].slice(-3);
          const secondChunkStart = chunks[1].slice(0, 3);
          // 완전히 같지는 않을 수 있지만 일부 겹침이 있어야 함
          expect(chunks[1]).toContain(firstChunkEnd.slice(-1));
        }
      });

      it('should handle empty text', () => {
        expect(splitTextIntoChunks('')).toEqual([]);
        expect(splitTextIntoChunks('   ')).toEqual([]);
      });

      it('should handle single line text', () => {
        const text = 'Short text';
        const chunks = splitTextIntoChunks(text, 100);
        
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe(text);
      });
    });

    describe('preprocessTextForEmbedding', () => {
      it('should clean up text properly', () => {
        const text = '  Multiple   spaces\n\nand\r\ntabs\t\there  ';
        const cleaned = preprocessTextForEmbedding(text);
        
        expect(cleaned).toBe('Multiple spaces and tabs here');
      });

      it('should handle empty text', () => {
        expect(preprocessTextForEmbedding('')).toBe('');
        expect(preprocessTextForEmbedding('   ')).toBe('');
      });

      it('should clean up punctuation', () => {
        const text = 'Text with... multiple dots!!! and questions???';
        const cleaned = preprocessTextForEmbedding(text);
        
        expect(cleaned).toBe('Text with... multiple dots! and questions?');
      });
    });

    describe('isValidTextForEmbedding', () => {
      it('should validate text length', () => {
        expect(isValidTextForEmbedding('short')).toBe(false);
        expect(isValidTextForEmbedding('This is a valid text for embedding')).toBe(true);
        expect(isValidTextForEmbedding('x'.repeat(9000))).toBe(false);
      });

      it('should handle invalid input', () => {
        expect(isValidTextForEmbedding('')).toBe(false);
        expect(isValidTextForEmbedding(null as any)).toBe(false);
        expect(isValidTextForEmbedding(undefined as any)).toBe(false);
      });
    });

    describe('isValidVector', () => {
      it('should validate vectors correctly', () => {
        expect(isValidVector([1, 2, 3])).toBe(true);
        expect(isValidVector([0, -1, 3.14])).toBe(true);
        expect(isValidVector([])).toBe(false);
        expect(isValidVector([NaN, 1, 2])).toBe(false);
        expect(isValidVector([Infinity, 1])).toBe(false);
        expect(isValidVector(['a', 'b'] as any)).toBe(false);
        expect(isValidVector(null as any)).toBe(false);
      });
    });
  });

  describe('VectorStoreFactory', () => {
    it('should create memory store', () => {
      const store = VectorStoreFactory.create('memory');
      expect(store).toBeInstanceOf(InMemoryVectorStore);
    });

    it('should throw error for unknown type', () => {
      expect(() => {
        VectorStoreFactory.create('unknown' as any);
      }).toThrow('Unknown vector store type');
    });
  });
});