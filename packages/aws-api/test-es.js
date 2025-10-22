#!/usr/bin/env node

import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: 'http://localhost:9200'
});

// 환경변수 설정
process.env.NODE_ENV = 'development';

async function testConnection() {
  try {
    // 인덱스 존재 여부 확인
    const result = await client.indices.exists({
      index: 'code-embeddings'
    });

    console.log('Index exists result:', result);

    // 인덱스가 없으면 생성
    if (!result) {
      console.log('Creating index...');
      await client.indices.create({
        index: 'code-embeddings',
        mappings: {
          properties: {
            file_path: { type: 'keyword' },
            content: { type: 'text' },
            embedding: {
              type: 'dense_vector',
              dims: 1536,
              index: true,
              similarity: 'cosine'
            }
          }
        }
      });
      console.log('Index created successfully');
    }

    console.log('Connection test successful');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.meta) {
      console.error('Meta:', error.meta);
    }
  }
}

testConnection();