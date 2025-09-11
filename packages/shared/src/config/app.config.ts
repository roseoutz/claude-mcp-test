import { config } from './config-loader.js';
import type { 
  SecurityConfig, 
  MCPServerConfig, 
  AppConfig,
  AIConfig,
  CacheConfig,
  VectorStoreConfig,
  GitConfig,
  DatabaseConfig
} from '../types/config.js';
import { FilePath } from '../domain/value-objects/index.js';

export class ApplicationConfig {
  /**
   * 보안 설정 가져오기
   */
  static getSecurityConfig(): SecurityConfig {
    return config.getSecurityConfig();
  }

  /**
   * MCP 서버 설정 가져오기
   */
  static getMCPServerConfig(): MCPServerConfig {
    return config.getMCPServerConfig();
  }

  /**
   * 애플리케이션 설정 가져오기
   */
  static getAppConfig(): AppConfig {
    return config.getAppConfig();
  }

  /**
   * AI 설정 가져오기
   */
  static getAIConfig(): AIConfig {
    return config.getAIConfig();
  }

  /**
   * 캐시 설정 가져오기
   */
  static getCacheConfig(): CacheConfig {
    return config.getCacheConfig();
  }

  /**
   * 벡터 스토어 설정 가져오기
   */
  static getVectorStoreConfig(): VectorStoreConfig {
    return config.getVectorStoreConfig();
  }

  /**
   * Git 설정 가져오기
   */
  static getGitConfig(): GitConfig {
    return config.getGitConfig();
  }

  /**
   * 데이터베이스 설정 가져오기
   */
  static getDatabaseConfig(): DatabaseConfig {
    return config.getDatabaseConfig();
  }

  /**
   * 허용된 파일 확장자 목록 가져오기
   */
  static getAllowedExtensions(): string[] {
    return config.get('ALLOWED_FILE_EXTENSIONS').split(',').map(e => e.trim());
  }

  /**
   * 제외된 경로 목록 가져오기
   */
  static getExcludedPaths(): string[] {
    return config.get('EXCLUDED_PATHS').split(',').map(p => p.trim());
  }

  /**
   * 파일이 허용되는지 확인
   */
  static isFileAllowed(filePath: string): boolean {
    const path = new FilePath(filePath);
    
    // 확장자 확인
    const extensions = this.getAllowedExtensions();
    const hasAllowedExtension = extensions.some(ext => 
      path.value.endsWith(ext)
    );
    
    if (!hasAllowedExtension) {
      return false;
    }
    
    // 제외 경로 확인
    const excludedPaths = this.getExcludedPaths();
    const isExcluded = excludedPaths.some(excluded => 
      path.value.includes(excluded)
    );
    
    return !isExcluded;
  }

  /**
   * 파일 크기가 허용 범위 내인지 확인
   */
  static isFileSizeAllowed(sizeInBytes: number): boolean {
    const maxSize = config.get('MAX_FILE_SIZE');
    return sizeInBytes <= maxSize;
  }

  /**
   * 현재 환경이 개발 환경인지 확인
   */
  static isDevelopment(): boolean {
    return config.get('NODE_ENV') === 'development';
  }

  /**
   * 현재 환경이 프로덕션 환경인지 확인
   */
  static isProduction(): boolean {
    return config.get('NODE_ENV') === 'production';
  }

  /**
   * 현재 환경이 테스트 환경인지 확인
   */
  static isTest(): boolean {
    return config.get('NODE_ENV') === 'test';
  }

  /**
   * AI 기능이 활성화되어 있는지 확인
   */
  static isAIEnabled(): boolean {
    return !!(config.get('OPENAI_API_KEY') || config.get('ANTHROPIC_API_KEY'));
  }

  /**
   * GitHub 통합이 활성화되어 있는지 확인
   */
  static isGitHubEnabled(): boolean {
    return !!config.get('GITHUB_TOKEN');
  }

  /**
   * GitLab 통합이 활성화되어 있는지 확인
   */
  static isGitLabEnabled(): boolean {
    return !!config.get('GITLAB_TOKEN');
  }

  /**
   * Bitbucket 통합이 활성화되어 있는지 확인
   */
  static isBitbucketEnabled(): boolean {
    return !!config.get('BITBUCKET_TOKEN');
  }

  /**
   * 캐시가 활성화되어 있는지 확인
   */
  static isCacheEnabled(): boolean {
    return config.get('CACHE_ENABLED');
  }

  /**
   * Rate limiting이 활성화되어 있는지 확인
   */
  static isRateLimitEnabled(): boolean {
    return config.get('RATE_LIMIT_ENABLED');
  }

  /**
   * 감사 로그가 활성화되어 있는지 확인
   */
  static isAuditLogEnabled(): boolean {
    return config.get('ENABLE_AUDIT_LOG');
  }

  /**
   * 디버그 모드인지 확인
   */
  static isDebugMode(): boolean {
    return config.get('LOG_LEVEL') === 'debug';
  }

  /**
   * 설정 요약 정보 가져오기
   */
  static getConfigSummary(): {
    environment: string;
    features: {
      ai: boolean;
      github: boolean;
      gitlab: boolean;
      bitbucket: boolean;
      cache: boolean;
      rateLimiting: boolean;
      auditLog: boolean;
    };
    services: {
      aiProvider?: string;
      cacheType?: string;
      databaseType: string;
      vectorStore: string;
    };
  } {
    return {
      environment: config.get('NODE_ENV'),
      features: {
        ai: this.isAIEnabled(),
        github: this.isGitHubEnabled(),
        gitlab: this.isGitLabEnabled(),
        bitbucket: this.isBitbucketEnabled(),
        cache: this.isCacheEnabled(),
        rateLimiting: this.isRateLimitEnabled(),
        auditLog: this.isAuditLogEnabled(),
      },
      services: {
        aiProvider: config.get('OPENAI_API_KEY') ? 'OpenAI' : 
                   config.get('ANTHROPIC_API_KEY') ? 'Anthropic' : undefined,
        cacheType: this.isCacheEnabled() ? config.get('CACHE_TYPE') : undefined,
        databaseType: config.get('DATABASE_TYPE'),
        vectorStore: config.get('VECTOR_STORE_PROVIDER'),
      },
    };
  }

  /**
   * 설정 검증 결과 가져오기
   */
  static validateConfiguration(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // AI 설정 검증
    if (!this.isAIEnabled()) {
      warnings.push('AI features are disabled - no API key configured');
    }

    // Git 통합 검증
    if (!this.isGitHubEnabled() && !this.isGitLabEnabled() && !this.isBitbucketEnabled()) {
      warnings.push('No Git platform integration configured');
    }

    // 프로덕션 환경 검증
    if (this.isProduction()) {
      if (this.isDebugMode()) {
        warnings.push('Debug logging is enabled in production');
      }
      
      if (!this.isAuditLogEnabled()) {
        warnings.push('Audit logging is disabled in production');
      }
      
      if (!this.isRateLimitEnabled()) {
        warnings.push('Rate limiting is disabled in production');
      }
    }

    // 파일 크기 제한 검증
    const maxSize = config.get('MAX_FILE_SIZE');
    if (maxSize > 10485760) { // 10MB
      warnings.push(`MAX_FILE_SIZE is set to ${maxSize} bytes, which may impact performance`);
    }

    // 캐시 설정 검증
    if (this.isCacheEnabled() && config.get('CACHE_TYPE') === 'redis') {
      if (!config.get('REDIS_PASSWORD') && this.isProduction()) {
        warnings.push('Redis cache is configured without password in production');
      }
    }

    // 데이터베이스 설정 검증
    const dbType = config.get('DATABASE_TYPE');
    if (dbType !== 'sqlite' && !config.get('DATABASE_CONNECTION_STRING')) {
      if (!config.get('DATABASE_HOST') || !config.get('DATABASE_NAME')) {
        errors.push(`Database configuration incomplete for ${dbType}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}