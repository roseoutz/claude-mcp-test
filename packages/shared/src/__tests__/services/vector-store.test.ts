import { describe, it, expect, beforeEach } from 'vitest';
import {
  VectorStoreFactory
} from '../../services/vector-store.service.js';
import { ElasticsearchVectorStore } from '../../services/elasticsearch.service.js';

describe('VectorStore Services', () => {
  describe('VectorStoreFactory', () => {
    it('should create Elasticsearch vector store from config', () => {
      const store = VectorStoreFactory.createFromConfig();
      expect(store).toBeInstanceOf(ElasticsearchVectorStore);
    });

    it('should create Elasticsearch vector store directly', () => {
      const store = VectorStoreFactory.createElasticsearchStore('test-collection');
      expect(store).toBeInstanceOf(ElasticsearchVectorStore);
    });
  });

  describe('ElasticsearchVectorStore', () => {
    let vectorStore: ElasticsearchVectorStore;

    beforeEach(() => {
      vectorStore = new ElasticsearchVectorStore('test-collection');
    });

    describe('initialization', () => {
      it('should create instance successfully', () => {
        expect(vectorStore).toBeInstanceOf(ElasticsearchVectorStore);
      });

      it('should accept collection name in constructor', () => {
        const store = new ElasticsearchVectorStore('custom-collection');
        expect(store).toBeInstanceOf(ElasticsearchVectorStore);
      });
    });

    describe('error handling', () => {
      it('should throw error when not initialized', async () => {
        await expect(vectorStore.addDocument('test-id', 'test content')).rejects.toThrow(
          'ElasticsearchVectorStore not initialized'
        );
      });

      it('should throw error on search without initialization', async () => {
        await expect(vectorStore.search('test query')).rejects.toThrow(
          'ElasticsearchVectorStore not initialized'
        );
      });
    });
  });
});