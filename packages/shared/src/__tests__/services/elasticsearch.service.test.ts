/**
 * Elasticsearch Vector Store Service 테스트
 * 하이브리드 서치 기능 및 Elasticsearch 연동 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ElasticsearchVectorStore, ElasticsearchVectorStoreFactory } from '../../services/elasticsearch.service.js';
import { logger } from '../../utils/logger.js';

// Create complete mock client
const createMockClient = () => ({
  ping: vi.fn(),
  indices: {
    exists: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    stats: vi.fn()
  },
  index: vi.fn(),
  bulk: vi.fn(),
  search: vi.fn(),
  delete: vi.fn(),
  deleteByQuery: vi.fn(),
  count: vi.fn(),
  cluster: {
    health: vi.fn()
  }
});

// Mock Elasticsearch constructor
let mockClientInstance: ReturnType<typeof createMockClient>;

vi.mock('@elastic/elasticsearch', () => {
  return {
    Client: vi.fn().mockImplementation(() => {
      mockClientInstance = createMockClient();
      return mockClientInstance;
    })
  };
});

describe('ElasticsearchVectorStore', () => {
  let vectorStore: ElasticsearchVectorStore;
  const testIndexName = 'test-codebase-index';

  beforeEach(() => {
    vi.clearAllMocks();
    vectorStore = new ElasticsearchVectorStore(testIndexName, logger);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('초기화', () => {
    it('성공적으로 초기화되어야 한다', async () => {
      mockClientInstance.ping.mockResolvedValueOnce({});
      mockClientInstance.indices.exists.mockResolvedValueOnce(false);
      mockClientInstance.indices.create.mockResolvedValueOnce({ acknowledged: true });

      await vectorStore.initialize(testIndexName);

      expect(mockClientInstance.ping).toHaveBeenCalledTimes(1);
      expect(mockClientInstance.indices.exists).toHaveBeenCalledWith({ index: testIndexName });
      expect(mockClientInstance.indices.create).toHaveBeenCalledWith({
        index: testIndexName,
        body: {
          settings: expect.objectContaining({
            analysis: expect.any(Object),
            similarity: expect.any(Object)
          }),
          mappings: expect.objectContaining({
            properties: expect.objectContaining({
              content: expect.any(Object),
              embedding: expect.any(Object),
              metadata: expect.any(Object)
            })
          })
        }
      });
    });

    it('기존 인덱스가 있으면 재사용해야 한다', async () => {
      mockClientInstance.ping.mockResolvedValueOnce({});
      mockClientInstance.indices.exists.mockResolvedValueOnce(true);

      await vectorStore.initialize(testIndexName);

      expect(mockClientInstance.ping).toHaveBeenCalledTimes(1);
      expect(mockClientInstance.indices.exists).toHaveBeenCalledWith({ index: testIndexName });
      expect(mockClientInstance.indices.create).not.toHaveBeenCalled();
    });

    it('Elasticsearch 연결 실패 시 에러를 던져야 한다', async () => {
      const error = new Error('Connection failed');
      mockClientInstance.ping.mockRejectedValueOnce(error);

      await expect(vectorStore.initialize(testIndexName)).rejects.toThrow(
        'Elasticsearch initialization failed: Connection failed'
      );
    });

    it('중복 초기화를 방지해야 한다', async () => {
      mockClientInstance.ping.mockResolvedValue({});
      mockClientInstance.indices.exists.mockResolvedValue(true);

      await vectorStore.initialize(testIndexName);
      await vectorStore.initialize(testIndexName);

      expect(mockClientInstance.ping).toHaveBeenCalledTimes(1);
    });
  });

  describe('문서 추가', () => {
    beforeEach(async () => {
      mockClientInstance.ping.mockResolvedValueOnce({});
      mockClientInstance.indices.exists.mockResolvedValueOnce(true);
      await vectorStore.initialize(testIndexName);
    });

    it('단일 문서를 추가할 수 있어야 한다', async () => {
      const testId = 'test-doc-1';
      const testContent = 'function test() { return "hello"; }';
      const testMetadata = { language: 'javascript', filePath: 'test.js' };

      mockClientInstance.index.mockResolvedValueOnce({ result: 'created' });

      await vectorStore.addDocument(testId, testContent, testMetadata);

      expect(mockClientInstance.index).toHaveBeenCalledWith({
        index: testIndexName,
        id: testId,
        body: {
          id: testId,
          content: testContent,
          metadata: expect.objectContaining({
            ...testMetadata,
            timestamp: expect.any(String)
          })
        },
        refresh: 'wait_for'
      });
    });

    it('여러 문서를 한 번에 추가할 수 있어야 한다', async () => {
      const testDocuments = [
        {
          id: 'doc1',
          content: 'function add(a, b) { return a + b; }',
          metadata: { language: 'javascript' }
        },
        {
          id: 'doc2',
          content: 'def subtract(a, b): return a - b',
          metadata: { language: 'python' }
        }
      ];

      mockClientInstance.bulk.mockResolvedValueOnce({ errors: false, items: [] });

      await vectorStore.addDocuments(testDocuments);

      expect(mockClientInstance.bulk).toHaveBeenCalledWith({
        body: expect.arrayContaining([
          { index: { _index: testIndexName, _id: 'doc1' } },
          expect.objectContaining({
            id: 'doc1',
            content: 'function add(a, b) { return a + b; }',
            metadata: expect.objectContaining({ language: 'javascript' })
          }),
          { index: { _index: testIndexName, _id: 'doc2' } },
          expect.objectContaining({
            id: 'doc2',
            content: 'def subtract(a, b): return a - b',
            metadata: expect.objectContaining({ language: 'python' })
          })
        ]),
        refresh: 'wait_for'
      });
    });

    it('임베딩과 함께 문서를 추가할 수 있어야 한다', async () => {
      const testId = 'test-doc-embedding';
      const testContent = 'async function fetchData() { return await api.get(); }';
      const testEmbedding = new Array(1536).fill(0).map(() => Math.random());
      const testMetadata = { language: 'typescript' };

      mockClientInstance.index.mockResolvedValueOnce({ result: 'created' });

      await vectorStore.addDocumentWithEmbedding(testId, testContent, testEmbedding, testMetadata);

      expect(mockClientInstance.index).toHaveBeenCalledWith({
        index: testIndexName,
        id: testId,
        body: {
          id: testId,
          content: testContent,
          embedding: testEmbedding,
          metadata: expect.objectContaining({
            ...testMetadata,
            timestamp: expect.any(String)
          })
        },
        refresh: 'wait_for'
      });
    });
  });

  describe('검색', () => {
    beforeEach(async () => {
      mockClientInstance.ping.mockResolvedValueOnce({});
      mockClientInstance.indices.exists.mockResolvedValueOnce(true);
      await vectorStore.initialize(testIndexName);
    });

    it('키워드 검색을 수행할 수 있어야 한다', async () => {
      const query = 'function test';
      const limit = 5;

      const mockSearchResponse = {
        body: {
          hits: {
            hits: [
              {
                _id: 'doc1',
                _score: 0.8,
                _source: {
                  content: 'function test() { return true; }',
                  metadata: { language: 'javascript' }
                }
              },
              {
                _id: 'doc2',
                _score: 0.6,
                _source: {
                  content: 'function testCase() { expect(true); }',
                  metadata: { language: 'javascript' }
                }
              }
            ]
          }
        }
      };

      mockClientInstance.search.mockResolvedValueOnce(mockSearchResponse);

      const results = await vectorStore.search(query, limit);

      expect(mockClientInstance.search).toHaveBeenCalledWith({
        index: testIndexName,
        body: {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query,
                    fields: ['content^2', 'content.raw', 'metadata.filePath'],
                    type: 'best_fields',
                    fuzziness: 'AUTO'
                  }
                }
              ]
            }
          },
          size: limit * 2, // internal limit multiplier
          _source: ['content', 'metadata']
        }
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 'doc1',
        score: 0.8,
        content: 'function test() { return true; }',
        metadata: { language: 'javascript' }
      });
    });

    it('검색 오류 시 빈 배열을 반환해야 한다', async () => {
      const error = new Error('Search failed');
      mockClientInstance.search.mockRejectedValueOnce(error);

      const results = await vectorStore.search('test query');

      expect(results).toEqual([]);
    });
  });

  describe('문서 삭제', () => {
    beforeEach(async () => {
      mockClientInstance.ping.mockResolvedValueOnce({});
      mockClientInstance.indices.exists.mockResolvedValueOnce(true);
      await vectorStore.initialize(testIndexName);
    });

    it('단일 문서를 삭제할 수 있어야 한다', async () => {
      const docId = 'test-doc';
      mockClientInstance.delete.mockResolvedValueOnce({ result: 'deleted' });

      await vectorStore.delete(docId);

      expect(mockClientInstance.delete).toHaveBeenCalledWith({
        index: testIndexName,
        id: docId,
        refresh: 'wait_for'
      });
    });

    it('존재하지 않는 문서 삭제 시 에러를 던지지 않아야 한다', async () => {
      const docId = 'non-existent-doc';
      const error = { meta: { statusCode: 404 } };
      mockClientInstance.delete.mockRejectedValueOnce(error);

      await expect(vectorStore.delete(docId)).resolves.not.toThrow();
    });

    it('모든 문서를 삭제할 수 있어야 한다', async () => {
      mockClientInstance.deleteByQuery.mockResolvedValueOnce({ deleted: 10 });

      await vectorStore.clear();

      expect(mockClientInstance.deleteByQuery).toHaveBeenCalledWith({
        index: testIndexName,
        body: { query: { match_all: {} } },
        refresh: true
      });
    });
  });

  describe('문서 수 조회', () => {
    beforeEach(async () => {
      mockClientInstance.ping.mockResolvedValueOnce({});
      mockClientInstance.indices.exists.mockResolvedValueOnce(true);
      await vectorStore.initialize(testIndexName);
    });

    it('문서 수를 조회할 수 있어야 한다', async () => {
      const expectedCount = 42;
      mockClientInstance.count.mockResolvedValueOnce({ body: { count: expectedCount } });

      const count = await vectorStore.count();

      expect(mockClientInstance.count).toHaveBeenCalledWith({ index: testIndexName });
      expect(count).toBe(expectedCount);
    });

    it('조회 오류 시 0을 반환해야 한다', async () => {
      mockClientInstance.count.mockRejectedValueOnce(new Error('Count failed'));

      const count = await vectorStore.count();

      expect(count).toBe(0);
    });
  });

  describe('초기화되지 않은 상태에서의 작업', () => {
    it('초기화되지 않은 상태에서 작업 시 에러를 던져야 한다', async () => {
      const uninitializedStore = new ElasticsearchVectorStore(testIndexName, logger);

      await expect(uninitializedStore.addDocument('id', 'content')).rejects.toThrow(
        'ElasticsearchVectorStore not initialized'
      );

      await expect(uninitializedStore.search('query')).rejects.toThrow(
        'ElasticsearchVectorStore not initialized'
      );

      await expect(uninitializedStore.delete('id')).rejects.toThrow(
        'ElasticsearchVectorStore not initialized'
      );

      await expect(uninitializedStore.count()).rejects.toThrow(
        'ElasticsearchVectorStore not initialized'
      );
    });
  });
});

describe('ElasticsearchVectorStoreFactory', () => {
  it('설정에서 Elasticsearch 벡터 스토어를 생성할 수 있어야 한다', () => {
    const store = ElasticsearchVectorStoreFactory.createFromConfig(logger);

    expect(store).toBeInstanceOf(ElasticsearchVectorStore);
  });

  it('커스텀 인덱스명으로 벡터 스토어를 생성할 수 있어야 한다', () => {
    const customIndexName = 'custom-index';
    const store = ElasticsearchVectorStoreFactory.create(customIndexName, logger);

    expect(store).toBeInstanceOf(ElasticsearchVectorStore);
  });
});