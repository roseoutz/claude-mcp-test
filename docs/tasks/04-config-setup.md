# Task 04: 설정 관리 구현

## 목표
환경 변수 및 애플리케이션 설정 관리 시스템 구현

## 작업 내용

### 1. 환경 변수 스키마 (`src/config/env.schema.ts`)
```typescript
import { z } from 'zod';

export const envSchema = z.object({
  // 서버 설정
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // MCP 설정
  MCP_SERVER_NAME: z.string().default('code-ai-mcp'),
  MCP_SERVER_VERSION: z.string().default('1.0.0'),
  
  // AI 설정
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(2000),
  
  // Git 설정
  GITHUB_TOKEN: z.string().optional(),
  DEFAULT_BRANCH: z.string().default('main'),
  
  // 보안 설정
  MAX_FILE_SIZE: z.coerce.number().default(1048576), // 1MB
  ALLOWED_FILE_EXTENSIONS: z.string().default('.ts,.js,.py,.java,.go,.rs'),
  EXCLUDED_PATHS: z.string().default('node_modules,.git,dist,build'),
  
  // 캐시 설정
  CACHE_TTL: z.coerce.number().default(3600), // 1 hour
  CACHE_NAMESPACE: z.string().default('mcp'),
  
  // 벡터 DB 설정
  VECTOR_DIMENSION: z.coerce.number().default(1536),
  VECTOR_SIMILARITY: z.enum(['cosine', 'euclidean', 'dot']).default('cosine'),
});

export type EnvConfig = z.infer<typeof envSchema>;
```

### 2. 설정 로더 (`src/config/config-loader.ts`)
```typescript
import dotenv from 'dotenv';
import { envSchema, EnvConfig } from './env.schema.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: EnvConfig;

  private constructor() {
    this.loadEnvironment();
    this.validateConfig();
  }

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  private loadEnvironment(): void {
    // .env 파일 로드 (여러 위치 시도)
    const envPaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(__dirname, '../../.env'),
    ];

    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        logger.debug(`Loaded environment from: ${envPath}`);
        break;
      }
    }
  }

  private validateConfig(): void {
    try {
      this.config = envSchema.parse(process.env);
      logger.info('Configuration validated successfully');
    } catch (error) {
      logger.error('Configuration validation failed:', error);
      throw new Error(`Invalid configuration: ${error}`);
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

  // 민감한 정보 마스킹
  getSafeConfig(): Partial<EnvConfig> {
    const safeConfig = { ...this.config };
    
    // 민감한 키들 마스킹
    const sensitiveKeys = ['OPENAI_API_KEY', 'GITHUB_TOKEN'];
    for (const key of sensitiveKeys) {
      if (key in safeConfig) {
        (safeConfig as any)[key] = '***MASKED***';
      }
    }
    
    return safeConfig;
  }
}

// 싱글톤 export
export const config = ConfigLoader.getInstance();
```

### 3. 애플리케이션 설정 (`src/config/app.config.ts`)
```typescript
import { config } from './config-loader.js';
import { SecurityConfig, MCPServerConfig, AppConfig } from '../types/config.js';

export class ApplicationConfig {
  static getSecurityConfig(): SecurityConfig {
    return {
      maxFileSize: config.get('MAX_FILE_SIZE'),
      allowedPaths: [],
      excludedPaths: config.get('EXCLUDED_PATHS').split(','),
      enableAuditLog: config.get('NODE_ENV') === 'production',
    };
  }

  static getMCPServerConfig(): MCPServerConfig {
    return {
      name: config.get('MCP_SERVER_NAME'),
      version: config.get('MCP_SERVER_VERSION'),
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
    };
  }

  static getAppConfig(): AppConfig {
    return {
      env: config.get('NODE_ENV'),
      logLevel: config.get('LOG_LEVEL'),
      openaiApiKey: config.get('OPENAI_API_KEY'),
      githubToken: config.get('GITHUB_TOKEN'),
    };
  }

  static getAIConfig() {
    return {
      apiKey: config.get('OPENAI_API_KEY'),
      model: config.get('OPENAI_MODEL'),
      maxTokens: config.get('OPENAI_MAX_TOKENS'),
    };
  }

  static getCacheConfig() {
    return {
      ttl: config.get('CACHE_TTL'),
      namespace: config.get('CACHE_NAMESPACE'),
    };
  }

  static getVectorStoreConfig() {
    return {
      dimension: config.get('VECTOR_DIMENSION'),
      similarity: config.get('VECTOR_SIMILARITY'),
    };
  }

  static getAllowedExtensions(): string[] {
    return config.get('ALLOWED_FILE_EXTENSIONS').split(',');
  }

  static isFileAllowed(filePath: string): boolean {
    const extensions = this.getAllowedExtensions();
    return extensions.some(ext => filePath.endsWith(ext));
  }
}
```

### 4. 설정 검증 유틸리티 (`src/utils/config-validator.ts`)
```typescript
import { config } from '../config/config-loader.js';
import { logger } from './logger.js';

export class ConfigValidator {
  static validateStartup(): void {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 필수 설정 확인
    if (!config.get('OPENAI_API_KEY')) {
      warnings.push('OPENAI_API_KEY is not set - AI features will be disabled');
    }

    if (!config.get('GITHUB_TOKEN')) {
      warnings.push('GITHUB_TOKEN is not set - Private repositories access will be limited');
    }

    // 보안 설정 확인
    if (config.get('NODE_ENV') === 'production') {
      if (config.get('LOG_LEVEL') === 'debug') {
        warnings.push('Debug logging is enabled in production');
      }
    }

    // 파일 크기 제한 확인
    const maxSize = config.get('MAX_FILE_SIZE');
    if (maxSize > 10485760) { // 10MB
      warnings.push(`MAX_FILE_SIZE is set to ${maxSize} bytes, which may impact performance`);
    }

    // 에러가 있으면 시작 중단
    if (errors.length > 0) {
      errors.forEach(error => logger.error(error));
      throw new Error('Configuration validation failed');
    }

    // 경고 출력
    warnings.forEach(warning => logger.warn(warning));
  }

  static checkRequiredServices(): void {
    const services = [];

    if (config.get('OPENAI_API_KEY')) {
      services.push('OpenAI API');
    }

    if (config.get('GITHUB_TOKEN')) {
      services.push('GitHub API');
    }

    logger.info(`Available services: ${services.join(', ') || 'None'}`);
  }
}
```

### 5. .env.example 파일
```bash
# Server Configuration
NODE_ENV=development
LOG_LEVEL=info

# MCP Configuration
MCP_SERVER_NAME=code-ai-mcp
MCP_SERVER_VERSION=1.0.0

# AI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000

# Git Configuration
GITHUB_TOKEN=your_github_token_here
DEFAULT_BRANCH=main

# Security Configuration
MAX_FILE_SIZE=1048576
ALLOWED_FILE_EXTENSIONS=.ts,.js,.py,.java,.go,.rs,.md,.json,.yaml
EXCLUDED_PATHS=node_modules,.git,dist,build,coverage,.next,.cache

# Cache Configuration
CACHE_TTL=3600
CACHE_NAMESPACE=mcp

# Vector Store Configuration
VECTOR_DIMENSION=1536
VECTOR_SIMILARITY=cosine
```

## 테스트 작성

### 설정 테스트 (`src/__tests__/config/config-loader.test.ts`)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigLoader } from '../../config/config-loader.js';

describe('ConfigLoader', () => {
  let configLoader: ConfigLoader;

  beforeEach(() => {
    // 테스트용 환경 변수 설정
    process.env.NODE_ENV = 'test';
    process.env.MCP_SERVER_NAME = 'test-server';
    
    configLoader = ConfigLoader.getInstance();
  });

  it('should load configuration', () => {
    expect(configLoader.get('NODE_ENV')).toBe('test');
    expect(configLoader.get('MCP_SERVER_NAME')).toBe('test-server');
  });

  it('should mask sensitive configuration', () => {
    configLoader.set('OPENAI_API_KEY', 'secret-key');
    const safeConfig = configLoader.getSafeConfig();
    
    expect(safeConfig.OPENAI_API_KEY).toBe('***MASKED***');
  });

  it('should validate configuration schema', () => {
    expect(() => {
      configLoader.get('LOG_LEVEL');
    }).not.toThrow();
  });
});
```

## 체크리스트
- [ ] 환경 변수 스키마 정의 (Zod)
- [ ] 설정 로더 구현
- [ ] 애플리케이션 설정 클래스
- [ ] 설정 검증 유틸리티
- [ ] .env.example 파일 생성
- [ ] 단위 테스트 작성

## 커밋 메시지
```
feat: 설정 관리 시스템 구현

- Zod 기반 환경 변수 검증
- 싱글톤 설정 로더
- 민감 정보 마스킹 기능
- 시작 시 설정 검증
```

## 예상 소요 시간
1시간 30분

## 의존성
- zod
- dotenv

## 검증 방법
- 환경 변수 로드 확인
- 설정 검증 테스트
- 민감 정보 마스킹 확인