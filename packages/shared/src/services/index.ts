export {
  ChromaVectorStore,
  InMemoryVectorStore,
  VectorStoreFactory,
  type VectorSearchResult
} from './vector-store.service.js';

export {
  ElasticsearchVectorStore,
  ElasticsearchVectorStoreFactory,
  type ElasticsearchDocument,
  type HybridSearchResult
} from './elasticsearch.service.js';

export {
  GitService,
  createGitService
} from './git.service.js';