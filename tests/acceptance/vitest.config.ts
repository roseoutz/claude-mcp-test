import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'acceptance-tests',
    environment: 'node',
    testTimeout: 120000, // 2분 (Elasticsearch 초기화 고려)
    setupFiles: ['./setup.ts'],
    globalSetup: ['./global-setup.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true // Elasticsearch 리소스 충돌 방지
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@aws-api': path.resolve(__dirname, '../../packages/aws-api/src'),
      '@local-mcp': path.resolve(__dirname, '../../packages/local-mcp/src'),
      '@fixtures': path.resolve(__dirname, '../fixtures'),
      '@helpers': path.resolve(__dirname, '../helpers')
    }
  }
});