import { config } from '../config/config-loader.js';
import { ApplicationConfig } from '../config/app.config.js';
import { ILogger } from '../domain/ports/outbound/index.js';

export class ConfigValidator {
  private static logger?: ILogger;

  /**
   * 로거 설정
   */
  static setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * 시작 시 설정 검증
   */
  static validateStartup(): void {
    const validation = ApplicationConfig.validateConfiguration();
    
    // 에러가 있으면 시작 중단
    if (!validation.valid) {
      validation.errors.forEach(error => {
        this.logger?.error(`Configuration Error: ${error}`);
      });
      throw new Error('Configuration validation failed');
    }
    
    // 경고 출력
    validation.warnings.forEach(warning => {
      this.logger?.warn(`Configuration Warning: ${warning}`);
    });
    
    // 설정 요약 출력
    const summary = ApplicationConfig.getConfigSummary();
    this.logger?.info('Configuration Summary:', summary);
  }

  /**
   * 필수 서비스 확인
   */
  static checkRequiredServices(): {
    available: string[];
    missing: string[];
  } {
    const available: string[] = [];
    const missing: string[] = [];

    // AI 서비스 확인
    if (config.get('OPENAI_API_KEY')) {
      available.push('OpenAI API');
    } else if (config.get('ANTHROPIC_API_KEY')) {
      available.push('Anthropic API');
    } else {
      missing.push('AI Service (OpenAI or Anthropic)');
    }

    // Git 서비스 확인
    if (config.get('GITHUB_TOKEN')) {
      available.push('GitHub API');
    }
    if (config.get('GITLAB_TOKEN')) {
      available.push('GitLab API');
    }
    if (config.get('BITBUCKET_TOKEN')) {
      available.push('Bitbucket API');
    }
    
    if (available.filter(s => s.includes('Git')).length === 0) {
      missing.push('Git Service (GitHub, GitLab, or Bitbucket)');
    }

    // 캐시 서비스 확인
    if (config.get('CACHE_ENABLED')) {
      const cacheType = config.get('CACHE_TYPE');
      available.push(`Cache (${cacheType})`);
      
      if (cacheType === 'redis') {
        // Redis 연결 확인은 실제 연결 시도가 필요하므로 여기서는 설정만 확인
        if (!config.get('REDIS_HOST')) {
          missing.push('Redis Host Configuration');
        }
      }
    }

    // 벡터 스토어 확인
    const vectorProvider = config.get('VECTOR_STORE_PROVIDER');
    available.push(`Vector Store (${vectorProvider})`);
    
    if (vectorProvider !== 'chromadb' && !config.get('VECTOR_STORE_URL')) {
      missing.push(`${vectorProvider} URL Configuration`);
    }

    // 데이터베이스 확인
    const dbType = config.get('DATABASE_TYPE');
    available.push(`Database (${dbType})`);

    this.logger?.info(`Available services: ${available.join(', ')}`);
    if (missing.length > 0) {
      this.logger?.warn(`Missing services: ${missing.join(', ')}`);
    }

    return { available, missing };
  }

  /**
   * 보안 설정 검증
   */
  static validateSecurity(): {
    secure: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 프로덕션 환경 보안 검증
    if (ApplicationConfig.isProduction()) {
      // 감사 로그
      if (!ApplicationConfig.isAuditLogEnabled()) {
        issues.push('Audit logging is disabled in production');
        recommendations.push('Enable ENABLE_AUDIT_LOG for production environments');
      }

      // Rate limiting
      if (!ApplicationConfig.isRateLimitEnabled()) {
        issues.push('Rate limiting is disabled in production');
        recommendations.push('Enable RATE_LIMIT_ENABLED to prevent abuse');
      }

      // 디버그 로깅
      if (ApplicationConfig.isDebugMode()) {
        issues.push('Debug logging is enabled in production');
        recommendations.push('Set LOG_LEVEL to "info" or higher in production');
      }

      // CORS 설정
      if (config.get('CORS_ORIGINS') === '*') {
        issues.push('CORS is configured to allow all origins');
        recommendations.push('Restrict CORS_ORIGINS to specific domains');
      }
    }

    // 파일 크기 제한
    const maxSize = config.get('MAX_FILE_SIZE');
    if (maxSize > 52428800) { // 50MB
      issues.push('File size limit is very high');
      recommendations.push('Consider reducing MAX_FILE_SIZE to prevent memory issues');
    }

    // API 키 보안
    const apiKeys = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GITHUB_TOKEN',
      'GITLAB_TOKEN',
      'BITBUCKET_TOKEN',
      'VECTOR_STORE_API_KEY',
    ];

    apiKeys.forEach(key => {
      const value = config.get(key as any);
      if (value && typeof value === 'string') {
        // 간단한 검증: 키가 너무 짧거나 기본값처럼 보이는지 확인
        if (value.length < 20) {
          issues.push(`${key} appears to be invalid or too short`);
        }
        if (value.includes('your_') || value.includes('xxx')) {
          issues.push(`${key} appears to be a placeholder value`);
        }
      }
    });

    // 데이터베이스 보안
    if (config.get('DATABASE_TYPE') !== 'sqlite') {
      if (!config.get('DATABASE_PASSWORD') && ApplicationConfig.isProduction()) {
        issues.push('Database configured without password in production');
        recommendations.push('Set DATABASE_PASSWORD for production databases');
      }
    }

    // Redis 보안
    if (config.get('CACHE_TYPE') === 'redis') {
      if (!config.get('REDIS_PASSWORD') && ApplicationConfig.isProduction()) {
        issues.push('Redis configured without password in production');
        recommendations.push('Set REDIS_PASSWORD for production Redis instances');
      }
    }

    return {
      secure: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * 성능 설정 검증
   */
  static validatePerformance(): {
    optimal: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 캐시 설정
    if (!ApplicationConfig.isCacheEnabled()) {
      issues.push('Cache is disabled');
      recommendations.push('Enable caching to improve performance');
    } else {
      const cacheTTL = config.get('CACHE_TTL');
      if (cacheTTL < 60) {
        issues.push('Cache TTL is very short');
        recommendations.push('Consider increasing CACHE_TTL for better cache hit ratio');
      }
      
      const cacheMaxSize = config.get('CACHE_MAX_SIZE');
      if (cacheMaxSize < 100) {
        issues.push('Cache size is very small');
        recommendations.push('Consider increasing CACHE_MAX_SIZE');
      }
    }

    // 데이터베이스 연결 풀
    const poolMax = config.get('DATABASE_POOL_MAX');
    const poolMin = config.get('DATABASE_POOL_MIN');
    
    if (poolMax < 5) {
      issues.push('Database connection pool is very small');
      recommendations.push('Consider increasing DATABASE_POOL_MAX for better concurrency');
    }
    
    if (poolMin > poolMax / 2) {
      issues.push('Database minimum pool size is too high relative to maximum');
      recommendations.push('Consider reducing DATABASE_POOL_MIN');
    }

    // AI 토큰 제한
    const maxTokens = config.get('OPENAI_MAX_TOKENS');
    if (maxTokens > 4000) {
      issues.push('AI max tokens is very high');
      recommendations.push('High token limits may increase costs and latency');
    }

    // Git 작업 제한
    const gitTimeout = config.get('GIT_TIMEOUT');
    if (gitTimeout < 10000) {
      issues.push('Git timeout is very short');
      recommendations.push('Consider increasing GIT_TIMEOUT for large repositories');
    }
    
    const gitMaxDepth = config.get('GIT_MAX_DEPTH');
    if (gitMaxDepth > 100) {
      issues.push('Git clone depth is very large');
      recommendations.push('Consider reducing GIT_MAX_DEPTH to speed up cloning');
    }

    // 벡터 차원
    const vectorDimension = config.get('VECTOR_DIMENSION');
    if (vectorDimension > 2048) {
      issues.push('Vector dimension is very high');
      recommendations.push('High vector dimensions increase memory usage and computation');
    }

    return {
      optimal: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * 전체 설정 검증 리포트 생성
   */
  static generateValidationReport(): string {
    const startup = ApplicationConfig.validateConfiguration();
    const services = this.checkRequiredServices();
    const security = this.validateSecurity();
    const performance = this.validatePerformance();
    const summary = ApplicationConfig.getConfigSummary();

    let report = '# Configuration Validation Report\n\n';
    
    // 환경 정보
    report += `## Environment\n`;
    report += `- Mode: ${summary.environment}\n`;
    report += `- Debug: ${ApplicationConfig.isDebugMode()}\n\n`;
    
    // 기능 상태
    report += `## Features\n`;
    Object.entries(summary.features).forEach(([feature, enabled]) => {
      report += `- ${feature}: ${enabled ? '✓' : '✗'}\n`;
    });
    report += '\n';
    
    // 서비스 상태
    report += `## Services\n`;
    report += `### Available\n`;
    services.available.forEach(service => {
      report += `- ✓ ${service}\n`;
    });
    if (services.missing.length > 0) {
      report += `### Missing\n`;
      services.missing.forEach(service => {
        report += `- ✗ ${service}\n`;
      });
    }
    report += '\n';
    
    // 검증 결과
    report += `## Validation Results\n`;
    
    // 시작 검증
    report += `### Startup Configuration\n`;
    report += `- Status: ${startup.valid ? '✓ Valid' : '✗ Invalid'}\n`;
    if (startup.errors.length > 0) {
      report += `- Errors:\n`;
      startup.errors.forEach(error => {
        report += `  - ${error}\n`;
      });
    }
    if (startup.warnings.length > 0) {
      report += `- Warnings:\n`;
      startup.warnings.forEach(warning => {
        report += `  - ${warning}\n`;
      });
    }
    report += '\n';
    
    // 보안 검증
    report += `### Security\n`;
    report += `- Status: ${security.secure ? '✓ Secure' : '⚠ Issues Found'}\n`;
    if (security.issues.length > 0) {
      report += `- Issues:\n`;
      security.issues.forEach(issue => {
        report += `  - ${issue}\n`;
      });
    }
    if (security.recommendations.length > 0) {
      report += `- Recommendations:\n`;
      security.recommendations.forEach(rec => {
        report += `  - ${rec}\n`;
      });
    }
    report += '\n';
    
    // 성능 검증
    report += `### Performance\n`;
    report += `- Status: ${performance.optimal ? '✓ Optimal' : '⚠ Can Be Improved'}\n`;
    if (performance.issues.length > 0) {
      report += `- Issues:\n`;
      performance.issues.forEach(issue => {
        report += `  - ${issue}\n`;
      });
    }
    if (performance.recommendations.length > 0) {
      report += `- Recommendations:\n`;
      performance.recommendations.forEach(rec => {
        report += `  - ${rec}\n`;
      });
    }
    
    return report;
  }
}