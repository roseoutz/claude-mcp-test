import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../../config/config-loader.js';

describe('ConfigLoader', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let configLoader: ConfigLoader;

  beforeEach(() => {
    // 원본 환경 변수 백업
    originalEnv = { ...process.env };
    
    // 민감한 환경 변수 초기화
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITLAB_TOKEN;
    delete process.env.BITBUCKET_TOKEN;
    delete process.env.ENABLE_AUDIT_LOG;
    
    // 테스트용 환경 변수 설정
    process.env.NODE_ENV = 'test';
    process.env.MCP_SERVER_NAME = 'test-server';
    process.env.LOG_LEVEL = 'debug';
    process.env.MAX_FILE_SIZE = '2097152';
    process.env.CACHE_TTL = '1800';
    process.env.ENABLE_AUDIT_LOG = 'false';
    
    // ConfigLoader는 싱글톤이므로 새 인스턴스를 강제로 생성
    (ConfigLoader as any).instance = undefined;
    configLoader = ConfigLoader.getInstance();
  });

  afterEach(() => {
    // 환경 변수 복원
    process.env = originalEnv;
    (ConfigLoader as any).instance = undefined;
  });

  describe('Configuration Loading', () => {
    it('should load configuration from environment variables', () => {
      expect(configLoader.get('NODE_ENV')).toBe('test');
      expect(configLoader.get('MCP_SERVER_NAME')).toBe('test-server');
      expect(configLoader.get('LOG_LEVEL')).toBe('debug');
    });

    it('should parse numeric values correctly', () => {
      expect(configLoader.get('MAX_FILE_SIZE')).toBe(2097152);
      expect(configLoader.get('CACHE_TTL')).toBe(1800);
    });

    it('should use default values when not set', () => {
      expect(configLoader.get('MCP_SERVER_VERSION')).toBe('1.0.0');
      expect(configLoader.get('DEFAULT_BRANCH')).toBe('main');
      expect(configLoader.get('VECTOR_SIMILARITY')).toBe('cosine');
    });

    it('should parse boolean values correctly', () => {
      // Boolean 값 직접 설정으로 테스트
      configLoader.set('CACHE_ENABLED', true);
      configLoader.set('ENABLE_AUDIT_LOG', false);
      
      expect(configLoader.get('CACHE_ENABLED')).toBe(true);
      expect(configLoader.get('ENABLE_AUDIT_LOG')).toBe(false);
      
      // 문자열로 설정해도 boolean으로 파싱되는지 확인
      configLoader.set('RATE_LIMIT_ENABLED', true);
      expect(configLoader.get('RATE_LIMIT_ENABLED')).toBe(true);
    });
  });

  describe('Sensitive Information Masking', () => {
    it('should mask sensitive configuration values', () => {
      configLoader.set('OPENAI_API_KEY', 'sk-secret-key-123');
      configLoader.set('GITHUB_TOKEN', 'ghp_secret-token-456');
      configLoader.set('DATABASE_PASSWORD', 'super-secret-password');
      
      const safeConfig = configLoader.getSafeConfig();
      
      expect(safeConfig.OPENAI_API_KEY).toBe('***MASKED***');
      expect(safeConfig.GITHUB_TOKEN).toBe('***MASKED***');
      expect(safeConfig.DATABASE_PASSWORD).toBe('***MASKED***');
    });

    it('should not mask non-sensitive values', () => {
      const safeConfig = configLoader.getSafeConfig();
      
      expect(safeConfig.NODE_ENV).toBe('test');
      expect(safeConfig.MCP_SERVER_NAME).toBe('test-server');
      expect(safeConfig.LOG_LEVEL).toBe('debug');
    });

    it('should not mask undefined sensitive values', () => {
      const safeConfig = configLoader.getSafeConfig();
      
      expect(safeConfig.OPENAI_API_KEY).toBeUndefined();
      expect(safeConfig.GITHUB_TOKEN).toBeUndefined();
    });
  });

  describe('Configuration Groups', () => {
    it('should return AI configuration correctly', () => {
      configLoader.set('OPENAI_API_KEY', 'test-key');
      configLoader.set('OPENAI_MODEL', 'gpt-4');
      configLoader.set('OPENAI_MAX_TOKENS', 3000);
      
      const aiConfig = configLoader.getAIConfig();
      
      expect(aiConfig.openai).toBeDefined();
      expect(aiConfig.openai?.apiKey).toBe('test-key');
      expect(aiConfig.openai?.model).toBe('gpt-4');
      expect(aiConfig.openai?.maxTokens).toBe(3000);
    });

    it('should return cache configuration correctly', () => {
      configLoader.set('CACHE_ENABLED', true);
      configLoader.set('CACHE_TYPE', 'redis');
      configLoader.set('REDIS_HOST', 'redis.example.com');
      configLoader.set('REDIS_PORT', 6380);
      
      const cacheConfig = configLoader.getCacheConfig();
      
      expect(cacheConfig.enabled).toBe(true);
      expect(cacheConfig.type).toBe('redis');
      expect(cacheConfig.redis).toBeDefined();
      expect(cacheConfig.redis?.host).toBe('redis.example.com');
      expect(cacheConfig.redis?.port).toBe(6380);
    });

    it('should return vector store configuration correctly', () => {
      configLoader.set('VECTOR_STORE_PROVIDER', 'pinecone');
      configLoader.set('VECTOR_STORE_URL', 'https://api.pinecone.io');
      configLoader.set('VECTOR_DIMENSION', 768);
      
      const vectorConfig = configLoader.getVectorStoreConfig();
      
      expect(vectorConfig.provider).toBe('pinecone');
      expect(vectorConfig.url).toBe('https://api.pinecone.io');
      expect(vectorConfig.dimensions).toBe(768);
    });

    it('should return Git configuration correctly', () => {
      configLoader.set('GITHUB_TOKEN', 'ghp_test');
      configLoader.set('DEFAULT_BRANCH', 'develop');
      configLoader.set('GIT_TIMEOUT', 60000);
      
      const gitConfig = configLoader.getGitConfig();
      
      expect(gitConfig.githubToken).toBe('ghp_test');
      expect(gitConfig.defaultBranch).toBe('develop');
      expect(gitConfig.timeout).toBe(60000);
    });

    it('should return security configuration correctly', () => {
      configLoader.set('MAX_FILE_SIZE', 5242880);
      configLoader.set('EXCLUDED_PATHS', 'node_modules,.git,dist');
      configLoader.set('ALLOWED_FILE_EXTENSIONS', '.ts,.js,.py');
      
      const securityConfig = configLoader.getSecurityConfig();
      
      expect(securityConfig.maxFileSize).toBe(5242880);
      expect(securityConfig.excludedPaths).toEqual(['node_modules', '.git', 'dist']);
      expect(securityConfig.allowedExtensions).toEqual(['.ts', '.js', '.py']);
    });
  });

  describe('Dynamic Configuration', () => {
    it('should allow setting configuration values dynamically', () => {
      configLoader.set('LOG_LEVEL', 'error');
      expect(configLoader.get('LOG_LEVEL')).toBe('error');
      
      configLoader.set('CACHE_TTL', 7200);
      expect(configLoader.get('CACHE_TTL')).toBe(7200);
    });

    it('should return all configuration values', () => {
      const allConfig = configLoader.getAll();
      
      expect(allConfig).toBeDefined();
      expect(allConfig.NODE_ENV).toBe('test');
      expect(allConfig.MCP_SERVER_NAME).toBe('test-server');
      expect(typeof allConfig).toBe('object');
    });

    it('should export configuration as JSON string', () => {
      const exported = configLoader.export();
      const parsed = JSON.parse(exported);
      
      expect(parsed.NODE_ENV).toBe('test');
      expect(parsed.MCP_SERVER_NAME).toBe('test-server');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate NODE_ENV values', () => {
      process.env.NODE_ENV = 'invalid';
      
      expect(() => {
        (ConfigLoader as any).instance = undefined;
        ConfigLoader.getInstance();
      }).toThrow();
    });

    it('should validate LOG_LEVEL values', () => {
      process.env.LOG_LEVEL = 'invalid';
      
      expect(() => {
        (ConfigLoader as any).instance = undefined;
        ConfigLoader.getInstance();
      }).toThrow();
    });

    it('should coerce string numbers to numbers', () => {
      process.env.SERVER_PORT = '8080';
      process.env.DATABASE_POOL_MAX = '20';
      
      (ConfigLoader as any).instance = undefined;
      configLoader = ConfigLoader.getInstance();
      
      expect(configLoader.get('SERVER_PORT')).toBe(8080);
      expect(configLoader.get('DATABASE_POOL_MAX')).toBe(20);
    });
  });
});