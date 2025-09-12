import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryVectorStore,
  ChromaVectorStore,
  VectorStoreFactory
} from '../../services/vector-store.service.js';

describe('VectorStore Services', () => {
  describe('InMemoryVectorStore', () => {
    let vectorStore: InMemoryVectorStore;

    beforeEach(async () => {
      vectorStore = new InMemoryVectorStore();
      await vectorStore.initialize('test-collection');
    });

    describe('initialization', () => {
      it('should initialize successfully', async () => {
        const newStore = new InMemoryVectorStore();
        await newStore.initialize('test');
        // Initialization should complete without errors
      });

      it('should not reinitialize if already initialized', async () => {
        // Should not throw when called multiple times
        await vectorStore.initialize('test-collection');
        await vectorStore.initialize('another-collection');
      });
    });

    describe('document management', () => {
      it('should add a document', async () => {
        await vectorStore.addDocument('doc1', 'This is a test document', {
          category: 'test',
          tags: ['sample']
        });

        const count = await vectorStore.count();
        expect(count).toBe(1);
      });

      it('should add multiple documents', async () => {
        const documents = [
          { id: 'doc1', content: 'First document', metadata: { type: 'first' } },
          { id: 'doc2', content: 'Second document', metadata: { type: 'second' } },
          { id: 'doc3', content: 'Third document', metadata: { type: 'third' } }
        ];

        await vectorStore.addDocuments(documents);

        const count = await vectorStore.count();
        expect(count).toBe(3);
      });

      it('should search documents by text', async () => {
        await vectorStore.addDocuments([
          { id: 'doc1', content: 'JavaScript programming tutorial', metadata: { lang: 'js' } },
          { id: 'doc2', content: 'Python programming guide', metadata: { lang: 'python' } },
          { id: 'doc3', content: 'TypeScript advanced features', metadata: { lang: 'ts' } }
        ]);

        const results = await vectorStore.search('programming', 2);

        expect(results).toHaveLength(2);
        expect(results[0].content).toContain('programming');
        expect(results[0].score).toBeGreaterThan(0);
      });

      it('should filter search results', async () => {
        await vectorStore.addDocuments([
          { id: 'doc1', content: 'JavaScript tutorial', metadata: { lang: 'js', level: 'beginner' } },
          { id: 'doc2', content: 'JavaScript guide', metadata: { lang: 'js', level: 'advanced' } },
          { id: 'doc3', content: 'Python tutorial', metadata: { lang: 'python', level: 'beginner' } }
        ]);

        const results = await vectorStore.search('tutorial', 10, { lang: 'js' });

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('doc1');
        expect(results[0].metadata.lang).toBe('js');
      });
    });

    describe('deletion', () => {
      beforeEach(async () => {
        await vectorStore.addDocuments([
          { id: 'doc1', content: 'First document', metadata: {} },
          { id: 'doc2', content: 'Second document', metadata: {} },
          { id: 'doc3', content: 'Third document', metadata: {} }
        ]);
      });

      it('should delete a single document', async () => {
        await vectorStore.delete('doc1');

        const count = await vectorStore.count();
        expect(count).toBe(2);
      });

      it('should delete multiple documents', async () => {
        await vectorStore.deleteMany(['doc1', 'doc3']);

        const count = await vectorStore.count();
        expect(count).toBe(1);
      });

      it('should clear all documents', async () => {
        await vectorStore.clear();

        const count = await vectorStore.count();
        expect(count).toBe(0);
      });
    });

    describe('error handling', () => {
      it('should throw error when not initialized', async () => {
        const newStore = new InMemoryVectorStore();

        await expect(newStore.addDocument('doc1', 'content', {}))
          .rejects.toThrow('not initialized');

        await expect(newStore.search('query'))
          .rejects.toThrow('not initialized');

        await expect(newStore.delete('doc1'))
          .rejects.toThrow('not initialized');

        await expect(newStore.count())
          .rejects.toThrow('not initialized');
      });
    });
  });

  describe('ChromaVectorStore', () => {
    let vectorStore: ChromaVectorStore;

    beforeEach(async () => {
      vectorStore = new ChromaVectorStore();
      await vectorStore.initialize('test-collection');
    });

    it('should initialize successfully', async () => {
      const newStore = new ChromaVectorStore();
      await newStore.initialize('test');
      // Should complete without errors (stub implementation)
    });

    it('should handle document operations as stubs', async () => {
      // All operations should complete without errors but do nothing
      await vectorStore.addDocument('doc1', 'content', {});
      
      const results = await vectorStore.search('query');
      expect(results).toHaveLength(0);
      
      const count = await vectorStore.count();
      expect(count).toBe(0);
    });
  });

  describe('VectorStoreFactory', () => {
    it('should create ChromaDB store', () => {
      const store = VectorStoreFactory.createChromaStore();
      expect(store).toBeInstanceOf(ChromaVectorStore);
    });

    it('should create memory store', () => {
      const store = VectorStoreFactory.createMemoryStore();
      expect(store).toBeInstanceOf(InMemoryVectorStore);
    });

    it('should create from config (chromadb by default)', () => {
      const store = VectorStoreFactory.createFromConfig();
      expect(store).toBeInstanceOf(ChromaVectorStore);
    });
  });
});