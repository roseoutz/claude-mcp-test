import { Client } from '@elastic/elasticsearch';

export class ElasticsearchService {
  private client: Client;
  private indexName = 'code-embeddings';

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_AUTH === 'true' ? {
        username: process.env.ELASTICSEARCH_USERNAME!,
        password: process.env.ELASTICSEARCH_PASSWORD!
      } : undefined
    });
  }

  async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.indexName });

    if (!exists) {
      await this.client.indices.create({
        index: this.indexName,
        body: {
          mappings: {
            properties: {
              file_path: { type: 'keyword' },
              content: { type: 'text' },
              language: { type: 'keyword' },
              classes: { type: 'keyword' },
              functions: { type: 'keyword' },
              imports: { type: 'keyword' },
              description: { type: 'text' },
              embedding: {
                type: 'dense_vector',
                dims: 1536,
                index: true,
                similarity: 'cosine'
              },
              metadata: { type: 'object' },
              indexed_at: { type: 'date' }
            }
          }
        }
      });
    }
  }

  async indexDocument(doc: {
    file_path: string;
    content: string;
    embedding: number[];
    metadata: any;
    description?: string;
  }): Promise<void> {
    await this.client.index({
      index: this.indexName,
      document: {
        ...doc,
        indexed_at: new Date()
      }
    });
  }

  async bulkIndex(documents: Array<any>): Promise<void> {
    const operations = documents.flatMap(doc => [
      { index: { _index: this.indexName } },
      { ...doc, indexed_at: new Date() }
    ]);

    const response = await this.client.bulk({
      operations,
      refresh: true
    });

    if (response.errors) {
      console.error('Bulk indexing errors:', response.items);
    }
  }

  async semanticSearch(queryEmbedding: number[], size: number = 10): Promise<any[]> {
    const response = await this.client.search({
      index: this.indexName,
      body: {
        knn: {
          field: 'embedding',
          query_vector: queryEmbedding,
          k: size,
          num_candidates: 100
        },
        _source: ['file_path', 'content', 'description', 'metadata', 'language']
      }
    });

    return response.hits.hits.map(hit => ({
      ...hit._source,
      score: hit._score
    }));
  }

  async hybridSearch(query: string, queryEmbedding: number[], size: number = 10): Promise<any[]> {
    const response = await this.client.search({
      index: this.indexName,
      body: {
        size,
        query: {
          bool: {
            should: [
              // 텍스트 매칭
              {
                multi_match: {
                  query,
                  fields: ['content^2', 'description', 'functions', 'classes'],
                  type: 'best_fields',
                  fuzziness: 'AUTO'
                }
              }
            ]
          }
        },
        knn: {
          field: 'embedding',
          query_vector: queryEmbedding,
          k: size,
          num_candidates: 100
        }
      }
    });

    return response.hits.hits.map(hit => ({
      ...hit._source,
      score: hit._score
    }));
  }

  async clearIndex(): Promise<void> {
    try {
      await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: {
            match_all: {}
          }
        }
      });
    } catch (error) {
      console.error('Error clearing index:', error);
    }
  }
}