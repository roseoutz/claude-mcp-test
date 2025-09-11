import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApplicationConfig } from '../../config/app.config.js';
import { config } from '../../config/config-loader.js';

describe('ApplicationConfig', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    
    // 환경 변수 초기화
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITLAB_TOKEN;
    delete process.env.BITBUCKET_TOKEN;
    
    // 테스트용 기본 환경 변수 설정
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'info';
    process.env.CACHE_ENABLED = 'true';
    process.env.CACHE_TYPE = 'memory';
    process.env.ALLOWED_FILE_EXTENSIONS = '.ts,.js,.py';
    process.env.EXCLUDED_PATHS = 'node_modules,.git,dist';
    process.env.MAX_FILE_SIZE = '1048576';
    
    // ConfigLoader 재초기화
    (config as any).constructor.instance = undefined;
    config.reload();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('File Validation', () => {
    it('should validate allowed file extensions', () => {
      expect(ApplicationConfig.isFileAllowed('/src/index.ts')).toBe(true);
      expect(ApplicationConfig.isFileAllowed('/lib/utils.js')).toBe(true);
      expect(ApplicationConfig.isFileAllowed('/scripts/test.py')).toBe(true);
      expect(ApplicationConfig.isFileAllowed('/docs/README.md')).toBe(false);
    });

    it('should exclude files in excluded paths', () => {
      expect(ApplicationConfig.isFileAllowed('/node_modules/package/index.js')).toBe(false);
      expect(ApplicationConfig.isFileAllowed('/.git/config')).toBe(false);
      expect(ApplicationConfig.isFileAllowed('/dist/bundle.js')).toBe(false);
    });

    it('should validate file size', () => {
      expect(ApplicationConfig.isFileSizeAllowed(524288)).toBe(true);
      expect(ApplicationConfig.isFileSizeAllowed(1048576)).toBe(true);
      expect(ApplicationConfig.isFileSizeAllowed(2097152)).toBe(false);
    });
  });

  describe('Environment Checks', () => {
    it('should identify development environment', () => {
      config.set('NODE_ENV', 'development');
      expect(ApplicationConfig.isDevelopment()).toBe(true);
      expect(ApplicationConfig.isProduction()).toBe(false);
      expect(ApplicationConfig.isTest()).toBe(false);
    });

    it('should identify production environment', () => {
      config.set('NODE_ENV', 'production');
      expect(ApplicationConfig.isDevelopment()).toBe(false);
      expect(ApplicationConfig.isProduction()).toBe(true);
      expect(ApplicationConfig.isTest()).toBe(false);
    });

    it('should identify test environment', () => {
      config.set('NODE_ENV', 'test');
      expect(ApplicationConfig.isDevelopment()).toBe(false);
      expect(ApplicationConfig.isProduction()).toBe(false);
      expect(ApplicationConfig.isTest()).toBe(true);
    });
  });

  describe('Feature Flags', () => {
    it('should detect AI enablement', () => {
      expect(ApplicationConfig.isAIEnabled()).toBe(false);
      
      config.set('OPENAI_API_KEY', 'test-key');
      expect(ApplicationConfig.isAIEnabled()).toBe(true);
      
      config.set('OPENAI_API_KEY', undefined);
      config.set('ANTHROPIC_API_KEY', 'test-key');
      expect(ApplicationConfig.isAIEnabled()).toBe(true);
    });

    it('should detect GitHub enablement', () => {
      expect(ApplicationConfig.isGitHubEnabled()).toBe(false);
      
      config.set('GITHUB_TOKEN', 'ghp_test');
      expect(ApplicationConfig.isGitHubEnabled()).toBe(true);
    });

    it('should detect cache enablement', () => {
      config.set('CACHE_ENABLED', true);
      expect(ApplicationConfig.isCacheEnabled()).toBe(true);
      
      config.set('CACHE_ENABLED', false);
      expect(ApplicationConfig.isCacheEnabled()).toBe(false);
    });

    it('should detect rate limiting enablement', () => {
      config.set('RATE_LIMIT_ENABLED', false);
      expect(ApplicationConfig.isRateLimitEnabled()).toBe(false);
      
      config.set('RATE_LIMIT_ENABLED', true);
      expect(ApplicationConfig.isRateLimitEnabled()).toBe(true);
    });

    it('should detect audit log enablement', () => {
      config.set('ENABLE_AUDIT_LOG', false);
      expect(ApplicationConfig.isAuditLogEnabled()).toBe(false);
      
      config.set('ENABLE_AUDIT_LOG', true);
      expect(ApplicationConfig.isAuditLogEnabled()).toBe(true);
    });

    it('should detect debug mode', () => {
      config.set('LOG_LEVEL', 'info');
      expect(ApplicationConfig.isDebugMode()).toBe(false);
      
      config.set('LOG_LEVEL', 'debug');
      expect(ApplicationConfig.isDebugMode()).toBe(true);
    });
  });

  describe('Configuration Retrieval', () => {
    it('should get security configuration', () => {
      config.set('MAX_FILE_SIZE', 2097152);
      config.set('EXCLUDED_PATHS', 'node_modules,.git');
      config.set('ENABLE_AUDIT_LOG', true);
      
      const securityConfig = ApplicationConfig.getSecurityConfig();
      
      expect(securityConfig.maxFileSize).toBe(2097152);
      expect(securityConfig.excludedPaths).toEqual(['node_modules', '.git']);
      expect(securityConfig.enableAuditLog).toBe(true);
    });

    it('should get MCP server configuration', () => {
      config.set('MCP_SERVER_NAME', 'test-server');
      config.set('MCP_SERVER_VERSION', '2.0.0');
      
      const mcpConfig = ApplicationConfig.getMCPServerConfig();
      
      expect(mcpConfig.name).toBe('test-server');
      expect(mcpConfig.version).toBe('2.0.0');
      expect(mcpConfig.capabilities.tools).toBe(true);
    });

    it('should get app configuration', () => {
      config.set('NODE_ENV', 'production');
      config.set('LOG_LEVEL', 'warn');
      config.set('SERVER_PORT', 8080);
      
      const appConfig = ApplicationConfig.getAppConfig();
      
      expect(appConfig.env).toBe('production');
      expect(appConfig.logLevel).toBe('warn');
      expect(appConfig.port).toBe(8080);
    });
  });

  describe('Configuration Summary', () => {
    it('should generate configuration summary', () => {
      config.set('NODE_ENV', 'development');
      config.set('OPENAI_API_KEY', 'test');
      config.set('GITHUB_TOKEN', 'ghp_test');
      config.set('CACHE_ENABLED', true);
      config.set('CACHE_TYPE', 'redis');
      
      const summary = ApplicationConfig.getConfigSummary();
      
      expect(summary.environment).toBe('development');
      expect(summary.features.ai).toBe(true);
      expect(summary.features.github).toBe(true);
      expect(summary.features.cache).toBe(true);
      expect(summary.services.aiProvider).toBe('OpenAI');
      expect(summary.services.cacheType).toBe('redis');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration with warnings', () => {
      config.set('NODE_ENV', 'production');
      config.set('LOG_LEVEL', 'debug');
      config.set('ENABLE_AUDIT_LOG', false);
      
      const validation = ApplicationConfig.validateConfiguration();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toContain('Debug logging is enabled in production');
      expect(validation.warnings).toContain('Audit logging is disabled in production');
    });

    it('should validate database configuration', () => {
      config.set('DATABASE_TYPE', 'postgres');
      config.set('DATABASE_HOST', undefined);
      config.set('DATABASE_NAME', undefined);
      config.set('DATABASE_CONNECTION_STRING', undefined);
      
      const validation = ApplicationConfig.validateConfiguration();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Database configuration incomplete for postgres');
    });

    it('should validate Redis configuration in production', () => {
      config.set('NODE_ENV', 'production');
      config.set('CACHE_TYPE', 'redis');
      config.set('CACHE_ENABLED', true);
      config.set('REDIS_PASSWORD', undefined);
      
      const validation = ApplicationConfig.validateConfiguration();
      
      expect(validation.warnings).toContain('Redis cache is configured without password in production');
    });

    it('should validate file size limits', () => {
      config.set('MAX_FILE_SIZE', 52428800); // 50MB
      
      const validation = ApplicationConfig.validateConfiguration();
      
      expect(validation.warnings).toContain('MAX_FILE_SIZE is set to 52428800 bytes, which may impact performance');
    });
  });

  describe('Path and Extension Helpers', () => {
    it('should get allowed extensions list', () => {
      config.set('ALLOWED_FILE_EXTENSIONS', '.ts,.js,.py,.java');
      
      const extensions = ApplicationConfig.getAllowedExtensions();
      
      expect(extensions).toEqual(['.ts', '.js', '.py', '.java']);
    });

    it('should get excluded paths list', () => {
      config.set('EXCLUDED_PATHS', 'node_modules,.git,dist,build');
      
      const paths = ApplicationConfig.getExcludedPaths();
      
      expect(paths).toEqual(['node_modules', '.git', 'dist', 'build']);
    });

    it('should handle paths with spaces', () => {
      config.set('EXCLUDED_PATHS', 'node_modules, .git, dist , build');
      
      const paths = ApplicationConfig.getExcludedPaths();
      
      expect(paths).toEqual(['node_modules', '.git', 'dist', 'build']);
    });
  });
});