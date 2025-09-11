import dotenv from 'dotenv';
import { envSchema, EnvConfig } from './env.schema.js';
import { ILogger } from '../domain/ports/outbound/index.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config!: EnvConfig;
  private logger?: ILogger;

  private constructor(logger?: ILogger) {
    this.logger = logger;
    this.loadEnvironment();
    this.validateConfig();
  }

  static getInstance(logger?: ILogger): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader(logger);
    }
    return ConfigLoader.instance;
  }

  private loadEnvironment(): void {
    // .env 파일 로드 (여러 위치 시도)
    const envPaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(__dirname, '../../.env'),
      path.resolve(__dirname, '../../../.env'),
      path.resolve(__dirname, '../../../../.env'),
    ];

    let loaded = false;
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const result = dotenv.config({ path: envPath });
        if (result.parsed) {
          this.logger?.debug(`Loaded environment from: ${envPath}`, { path: envPath });
          loaded = true;
          break;
        }
      }
    }

    if (!loaded) {
      this.logger?.warn('No .env file found, using process environment variables only');
    }
  }

  private validateConfig(): void {
    try {
      this.config = envSchema.parse(process.env);
      this.logger?.info('Configuration validated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error('Configuration validation failed', error as Error);
      throw new Error(`Invalid configuration: ${errorMessage}`);
    }
  }

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key];
  }

  getAll(): EnvConfig {
    return { ...this.config };
  }

  // 설정 값 동적 업데이트 (테스트용)
  set<K extends keyof EnvConfig>(key: K, value: EnvConfig[K]): void {
    this.config[key] = value;
  }

  // 설정 재로드
  reload(): void {
    this.loadEnvironment();
    this.validateConfig();
  }

  // 민감한 정보 마스킹
  getSafeConfig(): Partial<EnvConfig> {
    const safeConfig = { ...this.config };
    
    // 민감한 키들 마스킹
    const sensitiveKeys: (keyof EnvConfig)[] = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GITHUB_TOKEN',
      'GITLAB_TOKEN',
      'BITBUCKET_TOKEN',
      'REDIS_PASSWORD',
      'DATABASE_PASSWORD',
      'DATABASE_CONNECTION_STRING',
      'VECTOR_STORE_API_KEY',
    ];
    
    for (const key of sensitiveKeys) {
      if (key in safeConfig && safeConfig[key] !== undefined && safeConfig[key] !== '') {
        (safeConfig as any)[key] = '***MASKED***';
      }
    }
    
    return safeConfig;
  }

  // 설정 내보내기 (디버깅용)
  export(): string {
    const safeConfig = this.getSafeConfig();
    return JSON.stringify(safeConfig, null, 2);
  }

  // 특정 설정 그룹 가져오기
  getAIConfig() {
    return {
      openai: this.config.OPENAI_API_KEY ? {
        apiKey: this.config.OPENAI_API_KEY,
        model: this.config.OPENAI_MODEL,
        maxTokens: this.config.OPENAI_MAX_TOKENS,
        temperature: this.config.OPENAI_TEMPERATURE,
      } : undefined,
      anthropic: this.config.ANTHROPIC_API_KEY ? {
        apiKey: this.config.ANTHROPIC_API_KEY,
        model: this.config.ANTHROPIC_MODEL,
        maxTokens: this.config.ANTHROPIC_MAX_TOKENS,
        temperature: this.config.OPENAI_TEMPERATURE,
      } : undefined,
      embedding: {
        provider: this.config.EMBEDDING_PROVIDER,
        model: this.config.EMBEDDING_MODEL,
        dimensions: this.config.EMBEDDING_DIMENSIONS,
      },
    };
  }

  getCacheConfig() {
    return {
      enabled: this.config.CACHE_ENABLED,
      type: this.config.CACHE_TYPE,
      ttl: this.config.CACHE_TTL,
      maxSize: this.config.CACHE_MAX_SIZE,
      redis: this.config.CACHE_TYPE === 'redis' ? {
        host: this.config.REDIS_HOST,
        port: this.config.REDIS_PORT,
        password: this.config.REDIS_PASSWORD,
        db: this.config.REDIS_DB,
      } : undefined,
    };
  }

  getVectorStoreConfig() {
    return {
      provider: this.config.VECTOR_STORE_PROVIDER,
      url: this.config.VECTOR_STORE_URL,
      apiKey: this.config.VECTOR_STORE_API_KEY,
      collection: this.config.VECTOR_STORE_COLLECTION,
      dimensions: this.config.VECTOR_DIMENSION,
      similarity: this.config.VECTOR_SIMILARITY,
    };
  }

  getGitConfig() {
    return {
      defaultBranch: this.config.DEFAULT_BRANCH,
      githubToken: this.config.GITHUB_TOKEN,
      gitlabToken: this.config.GITLAB_TOKEN,
      bitbucketToken: this.config.BITBUCKET_TOKEN,
      timeout: this.config.GIT_TIMEOUT,
      maxDepth: this.config.GIT_MAX_DEPTH,
    };
  }

  getDatabaseConfig() {
    return {
      type: this.config.DATABASE_TYPE,
      host: this.config.DATABASE_HOST,
      port: this.config.DATABASE_PORT,
      database: this.config.DATABASE_NAME,
      username: this.config.DATABASE_USER,
      password: this.config.DATABASE_PASSWORD,
      connectionString: this.config.DATABASE_CONNECTION_STRING,
      pool: {
        min: this.config.DATABASE_POOL_MIN,
        max: this.config.DATABASE_POOL_MAX,
      },
    };
  }

  getSecurityConfig() {
    return {
      maxFileSize: this.config.MAX_FILE_SIZE,
      maxFileSizeMB: this.config.MAX_FILE_SIZE_MB,
      allowedPaths: [],
      excludedPaths: this.config.EXCLUDED_PATHS.split(',').map(p => p.trim()),
      allowedExtensions: this.config.ALLOWED_FILE_EXTENSIONS.split(',').map(e => e.trim()),
      enableAuditLog: this.config.ENABLE_AUDIT_LOG,
      rateLimiting: this.config.RATE_LIMIT_ENABLED ? {
        enabled: true,
        maxRequests: this.config.RATE_LIMIT_MAX_REQUESTS,
        windowMs: this.config.RATE_LIMIT_WINDOW_MS,
      } : undefined,
    };
  }

  getMCPServerConfig() {
    return {
      name: this.config.MCP_SERVER_NAME,
      version: this.config.MCP_SERVER_VERSION,
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
        sampling: false,
      },
      transport: {
        type: 'stdio' as const,
        options: {},
      },
    };
  }

  getAppConfig() {
    return {
      env: this.config.NODE_ENV,
      logLevel: this.config.LOG_LEVEL,
      port: this.config.SERVER_PORT,
      host: this.config.SERVER_HOST,
      cors: this.config.CORS_ENABLED ? {
        enabled: true,
        origins: this.config.CORS_ORIGINS.split(',').map(o => o.trim()),
      } : undefined,
    };
  }
}

// 기본 싱글톤 export (로거 없이)
export const config = ConfigLoader.getInstance();