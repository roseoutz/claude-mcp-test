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

  /**
   * 🐛 버그 9: 잘못된 배열 조작
   * 배열을 순회하면서 삭제하면 인덱스 문제 발생
   */
  async deleteDocumentsByPattern(pattern: string): Promise<number> {
    const response = await this.client.search({
      index: this.indexName,
      body: {
        query: {
          wildcard: {
            file_path: pattern
          }
        },
        size: 1000
      }
    });

    const hits = response.hits.hits;

    // 🔴 치명적 버그: 배열을 순회하면서 삭제
    // splice로 인한 인덱스 불일치로 일부 문서 삭제 안 됨
    for (let i = 0; i < hits.length; i++) {
      const id = hits[i]._id;
      await this.client.delete({
        index: this.indexName,
        id: id!
      });

      // 🔴 삭제 후에도 hits 배열은 그대로, 인덱스 어긋남
    }

    return hits.length;
  }

  /**
   * 🐛 버그 10: 비동기 작업을 동기처럼 처리
   * await 없이 Promise 반환
   */
  getAllDocuments(): Promise<any[]> {
    // 🔴 치명적 버그: async 없이 await 사용 불가
    // Promise를 반환하지만 await이 없어서 완료 보장 안 됨
    const response = this.client.search({
      index: this.indexName,
      body: {
        query: { match_all: {} },
        size: 10000  // 🔴 너무 큰 size, 메모리 문제 유발 가능
      }
    });

    // 🔴 Promise를 바로 반환, then 체이닝 필요
    return response as any;
  }
}