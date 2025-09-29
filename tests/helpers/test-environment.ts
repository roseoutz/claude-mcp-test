/**
 * 인수테스트 환경 설정 헬퍼
 */
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { ElasticsearchVectorStore } from '@shared/services/elasticsearch.service';
import { MCPServer } from '@shared/server/mcp-server';
import { AnalysisService } from '@aws-api/services/analysis.service';
import path from 'path';
import { promises as fs } from 'fs';

export interface TestEnvironment {
  elasticsearch: StartedTestContainer;
  vectorStore: ElasticsearchVectorStore;
  mcpServer: MCPServer;
  analysisService: AnalysisService;
  cleanup: () => Promise<void>;
}

/**
 * 테스트 환경 설정
 */
export class TestEnvironmentManager {
  private static instance: TestEnvironment | null = null;

  /**
   * 테스트 환경 초기화
   */
  static async setup(): Promise<TestEnvironment> {
    if (TestEnvironmentManager.instance) {
      return TestEnvironmentManager.instance;
    }

    console.log('🚀 Setting up test environment...');

    // 1. Elasticsearch 컨테이너 시작
    const elasticsearch = await new GenericContainer('elasticsearch:8.11.3')
      .withEnvironment({
        'discovery.type': 'single-node',
        'xpack.security.enabled': 'false',
        'ES_JAVA_OPTS': '-Xms512m -Xmx512m'
      })
      .withExposedPorts(9200)
      .withHealthCheck({
        command: ['curl', '-f', 'http://localhost:9200/_cluster/health'],
        interval: 5000,
        timeout: 10000,
        retries: 10
      })
      .withWaitStrategy({
        type: 'http',
        port: 9200,
        path: '/_cluster/health'
      })
      .start();

    console.log(`✅ Elasticsearch started on port ${elasticsearch.getMappedPort(9200)}`);

    // 2. 벡터 스토어 초기화
    const elasticsearchUrl = `http://localhost:${elasticsearch.getMappedPort(9200)}`;
    process.env.ELASTICSEARCH_URL = elasticsearchUrl;

    const vectorStore = new ElasticsearchVectorStore('test-index');
    await vectorStore.initialize('test-codebase');

    // 3. MCP 서버 초기화
    const mcpServer = new MCPServer();

    // 4. Analysis Service 초기화
    const analysisService = new AnalysisService();
    await analysisService.initialize();

    console.log('✅ Test environment ready');

    const environment: TestEnvironment = {
      elasticsearch,
      vectorStore,
      mcpServer,
      analysisService,
      cleanup: async () => {
        console.log('🧹 Cleaning up test environment...');
        await elasticsearch.stop();
        console.log('✅ Test environment cleaned up');
      }
    };

    TestEnvironmentManager.instance = environment;
    return environment;
  }

  /**
   * 테스트 환경 정리
   */
  static async cleanup(): Promise<void> {
    if (TestEnvironmentManager.instance) {
      await TestEnvironmentManager.instance.cleanup();
      TestEnvironmentManager.instance = null;
    }
  }
}

/**
 * 테스트용 샘플 코드베이스 생성
 */
export async function createTestCodebase(tempDir: string): Promise<void> {
  const files = {
    'src/user.service.ts': `
export class UserService {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user || null;
  }

  async create(userData: CreateUserData): Promise<User> {
    const user = new User(userData);
    this.users.set(user.id, user);
    return user;
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    // TODO: 비밀번호 해싱 추가
    user.password = newPassword;
  }
}

interface User {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
}

interface CreateUserData {
  email: string;
  password: string;
}
    `,
    'src/auth.controller.ts': `
import { UserService } from './user.service';

export class AuthController {
  constructor(private userService: UserService) {}

  async login(email: string, password: string): Promise<string> {
    const user = await this.userService.findByEmail(email);
    if (!user || user.password !== password) {
      throw new Error('Invalid credentials');
    }

    // JWT 토큰 생성 (실제로는 더 복잡한 로직)
    return 'jwt-token-' + user.id;
  }

  async register(userData: RegisterData): Promise<User> {
    return await this.userService.create(userData);
  }
}

interface RegisterData {
  email: string;
  password: string;
}
    `,
    'src/database.ts': `
export class Database {
  private connection: any;

  async connect(): Promise<void> {
    // 데이터베이스 연결 로직
    this.connection = { status: 'connected' };
  }

  async query(sql: string, params: any[]): Promise<any[]> {
    // SQL 인젝션 취약점 존재
    const query = sql + params.join(' ');
    return [];
  }

  async close(): Promise<void> {
    this.connection = null;
  }
}
    `,
    'tests/user.test.ts': `
import { UserService } from '../src/user.service';
import { describe, it, expect } from 'vitest';

describe('UserService', () => {
  it('should create user', async () => {
    const service = new UserService();
    const user = await service.create({
      email: 'test@example.com',
      password: 'password123'
    });

    expect(user.email).toBe('test@example.com');
  });
});
    `,
    'package.json': JSON.stringify({
      name: 'test-codebase',
      version: '1.0.0',
      dependencies: {
        'express': '^4.18.2'
      },
      devDependencies: {
        'vitest': '^1.2.2',
        'typescript': '^5.3.3'
      }
    }, null, 2),
    'README.md': `
# Test Codebase

이것은 테스트용 코드베이스입니다.

## 구조
- UserService: 사용자 관리 서비스
- AuthController: 인증 컨트롤러
- Database: 데이터베이스 연결 클래스

## 알려진 문제점
- SQL 인젝션 취약점 (database.ts)
- 비밀번호 해싱 누락 (user.service.ts)
- 에러 처리 부족
    `
  };

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tempDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content.trim());
  }

  // Git 저장소 초기화
  const { execSync } = await import('child_process');
  execSync('git init', { cwd: tempDir });
  execSync('git add .', { cwd: tempDir });
  execSync('git commit -m "Initial commit"', { cwd: tempDir });
}