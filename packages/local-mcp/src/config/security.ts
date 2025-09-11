// 보안 설정 및 검증

import path from 'path';

export interface SecurityConfig {
  // 파일 시스템 접근 제한
  allowedPaths: string[];
  blockedPaths: string[];
  blockedFiles: string[];
  maxFileSize: number; // bytes
  allowedExtensions: string[];
  
  // 네트워크 접근 제한
  allowedDomains: string[];
  maxRequestsPerMinute: number;
  
  // Git 저장소 접근 제한
  requireAuthentication: boolean;
  allowedGitHosts: string[];
  
  // 분석 제한
  maxFilesPerAnalysis: number;
  analysisTimeout: number; // milliseconds
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowedPaths: [
    // 사용자 홈 디렉토리의 특정 폴더만 허용
    path.join(process.env.HOME || '~', 'Projects'),
    path.join(process.env.HOME || '~', 'Development'),
    path.join(process.env.HOME || '~', 'workspace'),
  ],
  
  blockedPaths: [
    // 시스템 중요 디렉토리 차단
    '/etc',
    '/var',
    '/usr',
    '/bin',
    '/sbin',
    '/System',
    '/Applications',
    path.join(process.env.HOME || '~', '.ssh'),
    path.join(process.env.HOME || '~', '.aws'),
    path.join(process.env.HOME || '~', '.docker'),
  ],
  
  blockedFiles: [
    // 민감한 파일들 차단
    '.env',
    '.env.local',
    '.env.production',
    'id_rsa',
    'id_dsa',
    'id_ecdsa',
    'id_ed25519',
    'credentials',
    'config',
    'secret',
    'password',
    'token',
    'key.pem',
    'cert.pem',
    '.p12',
    '.pfx',
    'wallet.dat',
    'keystore',
  ],
  
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  allowedExtensions: [
    '.ts', '.js', '.tsx', '.jsx',
    '.py', '.java', '.kt', '.go', 
    '.rs', '.cpp', '.c', '.cs',
    '.rb', '.php', '.swift', '.scala',
    '.json', '.yaml', '.yml', '.md',
    '.txt', '.xml', '.html', '.css',
  ],
  
  allowedDomains: [
    'github.com',
    'gitlab.com',
    'bitbucket.org',
  ],
  
  maxRequestsPerMinute: 60,
  requireAuthentication: true,
  
  allowedGitHosts: [
    'github.com',
    'gitlab.com', 
    'bitbucket.org',
  ],
  
  maxFilesPerAnalysis: 1000,
  analysisTimeout: 30000, // 30초
};

export class SecurityValidator {
  constructor(private config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {}

  /**
   * 파일 경로가 안전한지 검증
   */
  validateFilePath(filePath: string): { isValid: boolean; reason?: string } {
    const absolutePath = path.resolve(filePath);
    
    // 경로 순회 공격 방지
    if (absolutePath.includes('..')) {
      return { isValid: false, reason: '경로 순회 시도가 감지되었습니다' };
    }
    
    // 차단된 경로 확인
    for (const blockedPath of this.config.blockedPaths) {
      if (absolutePath.startsWith(blockedPath)) {
        return { isValid: false, reason: `차단된 경로입니다: ${blockedPath}` };
      }
    }
    
    // 허용된 경로 확인
    const isAllowed = this.config.allowedPaths.some(allowedPath => 
      absolutePath.startsWith(allowedPath)
    );
    
    if (!isAllowed) {
      return { isValid: false, reason: '허용되지 않은 경로입니다' };
    }
    
    return { isValid: true };
  }

  /**
   * 파일명이 안전한지 검증
   */
  validateFileName(fileName: string): { isValid: boolean; reason?: string } {
    const lowerFileName = fileName.toLowerCase();
    
    // 차단된 파일명 확인
    for (const blockedFile of this.config.blockedFiles) {
      if (lowerFileName.includes(blockedFile.toLowerCase())) {
        return { isValid: false, reason: `민감한 파일이 감지되었습니다: ${blockedFile}` };
      }
    }
    
    // 허용된 확장자 확인
    const extension = path.extname(fileName).toLowerCase();
    if (extension && !this.config.allowedExtensions.includes(extension)) {
      return { isValid: false, reason: `지원되지 않는 파일 형식입니다: ${extension}` };
    }
    
    return { isValid: true };
  }

  /**
   * 파일 크기 검증
   */
  validateFileSize(size: number): { isValid: boolean; reason?: string } {
    if (size > this.config.maxFileSize) {
      return { 
        isValid: false, 
        reason: `파일 크기가 너무 큽니다. 최대 ${this.config.maxFileSize} bytes` 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Git 저장소 URL 검증
   */
  validateGitUrl(repoUrl: string): { isValid: boolean; reason?: string } {
    try {
      const url = new URL(repoUrl);
      
      // 허용된 Git 호스트 확인
      if (!this.config.allowedGitHosts.includes(url.hostname)) {
        return { isValid: false, reason: `허용되지 않은 Git 호스트입니다: ${url.hostname}` };
      }
      
      // 프로토콜 확인 (HTTPS만 허용)
      if (url.protocol !== 'https:') {
        return { isValid: false, reason: 'HTTPS 프로토콜만 허용됩니다' };
      }
      
      return { isValid: true };
    } catch (error) {
      return { isValid: false, reason: '유효하지 않은 URL입니다' };
    }
  }

  /**
   * 요청 빈도 제한 (간단한 구현)
   */
  private requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  validateRateLimit(clientId: string): { isValid: boolean; reason?: string } {
    const now = Date.now();
    const resetInterval = 60 * 1000; // 1분
    
    const clientData = this.requestCounts.get(clientId) || { count: 0, resetTime: now + resetInterval };
    
    // 시간 윈도우가 지나면 카운트 리셋
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + resetInterval;
    }
    
    // 요청 빈도 확인
    if (clientData.count >= this.config.maxRequestsPerMinute) {
      return { isValid: false, reason: '요청 빈도 제한을 초과했습니다' };
    }
    
    clientData.count++;
    this.requestCounts.set(clientId, clientData);
    
    return { isValid: true };
  }
}

/**
 * 민감한 정보가 포함된 내용을 필터링
 */
export function sanitizeContent(content: string): string {
  // API 키, 토큰, 패스워드 등을 마스킹
  const patterns = [
    /api[_-]?key\s*[=:]\s*["']?([a-zA-Z0-9_-]{20,})["']?/gi,
    /secret[_-]?key\s*[=:]\s*["']?([a-zA-Z0-9_-]{20,})["']?/gi,
    /access[_-]?token\s*[=:]\s*["']?([a-zA-Z0-9_-]{20,})["']?/gi,
    /password\s*[=:]\s*["']?([^\s"']{8,})["']?/gi,
    /private[_-]?key/gi,
    /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/gi,
  ];
  
  let sanitized = content;
  patterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, (match) => {
      // 첫 몇 글자만 보여주고 나머지는 마스킹
      const visible = match.substring(0, Math.min(10, match.length));
      return visible + '*'.repeat(Math.max(0, match.length - visible.length));
    });
  });
  
  return sanitized;
}

/**
 * 감사 로그 기록
 */
export function logSecurityEvent(event: {
  type: 'file_access' | 'git_access' | 'security_violation';
  path?: string;
  reason?: string;
  clientId?: string;
  timestamp?: Date;
}): void {
  const logEntry = {
    ...event,
    timestamp: event.timestamp || new Date(),
  };
  
  // 보안 이벤트를 별도 로그 파일에 기록
  console.error('[SECURITY]', JSON.stringify(logEntry));
  
  // 실제 운영 환경에서는 SIEM이나 별도 로그 시스템으로 전송
}