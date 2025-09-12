import { glob } from 'glob';
import { minimatch } from 'minimatch';
import path from 'path';

/**
 * .gitignore 패턴을 glob 패턴으로 변환
 */
export function gitignoreToGlob(pattern: string): string {
  // 주석 제거
  if (pattern.startsWith('#')) return '';
  
  // 빈 줄 제거
  if (!pattern.trim()) return '';
  
  // 디렉토리 패턴
  if (pattern.endsWith('/')) {
    return `**/${pattern}**`;
  }
  
  // 와일드카드 패턴
  if (pattern.includes('*')) {
    return `**/${pattern}`;
  }
  
  // 일반 파일/디렉토리
  return `**/${pattern}`;
}

/**
 * 언어별 파일 확장자 매핑
 */
export const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx', '.d.ts'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py', '.pyw', '.pyi'],
  java: ['.java'],
  kotlin: ['.kt', '.kts'],
  go: ['.go'],
  rust: ['.rs'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
  csharp: ['.cs'],
  ruby: ['.rb'],
  php: ['.php'],
  swift: ['.swift'],
  markdown: ['.md', '.mdx'],
  json: ['.json'],
  yaml: ['.yml', '.yaml'],
  xml: ['.xml'],
  html: ['.html', '.htm'],
  css: ['.css', '.scss', '.sass', '.less'],
  sql: ['.sql'],
  dockerfile: ['Dockerfile'],
  shell: ['.sh', '.bash', '.zsh'],
  powershell: ['.ps1', '.psm1'],
  vim: ['.vim'],
  lua: ['.lua'],
  perl: ['.pl', '.pm'],
  r: ['.r', '.R'],
  matlab: ['.m'],
  scala: ['.scala'],
  clojure: ['.clj', '.cljs'],
  haskell: ['.hs'],
  erlang: ['.erl'],
  elixir: ['.ex', '.exs'],
  dart: ['.dart'],
  vue: ['.vue'],
  svelte: ['.svelte'],
};

/**
 * 파일 경로에서 언어 감지
 */
export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);
  
  // 특수한 파일명 처리
  if (basename === 'Dockerfile' || basename.startsWith('Dockerfile.')) {
    return 'dockerfile';
  }
  
  if (basename === 'Makefile' || basename === 'makefile') {
    return 'makefile';
  }
  
  // 확장자로 언어 감지
  for (const [language, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return language;
    }
  }
  
  return 'unknown';
}

/**
 * 테스트 파일인지 확인
 */
export function isTestFile(filePath: string): boolean {
  const testPatterns = [
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/test/**',
    '**/tests/**',
    '**/testing/**',
    '**/*_test.*',
    '**/*Test.*',
    '**/*Spec.*',
  ];
  
  return testPatterns.some(pattern => 
    minimatch(filePath, pattern, { nocase: true })
  );
}

/**
 * 설정 파일인지 확인
 */
export function isConfigFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  
  // 명시적 설정 파일들
  const explicitConfigFiles = [
    // Node.js/JavaScript 관련
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'tsconfig.json',
    'jsconfig.json',
    'webpack.config.js',
    'webpack.config.ts',
    'vite.config.js',
    'vite.config.ts',
    'rollup.config.js',
    'rollup.config.ts',
    'babel.config.js',
    'babel.config.json',
    '.babelrc',
    '.babelrc.json',
    'jest.config.js',
    'jest.config.ts',
    'jest.config.json',
    'vitest.config.js',
    'vitest.config.ts',
    'eslint.config.js',
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.json',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    'prettier.config.js',
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.yaml',
    '.prettierrc.yml',
    // Spring/Java 관련
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'settings.gradle',
    'settings.gradle.kts',
    'gradle.properties',
    'gradlew',
    'gradlew.bat',
    'application.properties',
    'application.yml',
    'application.yaml',
    'bootstrap.properties',
    'bootstrap.yml',
    'bootstrap.yaml',
    'logback.xml',
    'logback-spring.xml',
    'log4j2.xml',
    'spring.properties',
    'persistence.xml',
    'web.xml',
    // Android 관련
    'build.gradle',
    'app.gradle',
    'settings.gradle',
    'gradle.properties',
    'local.properties',
    'proguard-rules.pro',
    'proguard-project.txt',
    'project.properties',
    'AndroidManifest.xml',
    'google-services.json',
    'fabric.properties',
    // iOS/Swift 관련
    'Podfile',
    'Podfile.lock',
    'Package.swift',
    'project.pbxproj',
    'Info.plist',
    'GoogleService-Info.plist',
    'Cartfile',
    'Cartfile.resolved',
    // Docker/기타
    'docker-compose.yml',
    'docker-compose.yaml',
    'Dockerfile',
    'Makefile',
    'CMakeLists.txt',
    '.gitignore',
    '.gitattributes',
    '.editorconfig',
    '.nvmrc',
    '.node-version',
  ];
  
  // 명시적 파일명 매칭
  if (explicitConfigFiles.includes(basename)) {
    return true;
  }
  
  // 패턴 매칭
  const configPatterns = [
    '**/*.config.*',
    '**/.*rc*',
    '**/.env*',
    '**/Dockerfile*',
    '**/*.toml',
    '**/*.ini',
  ];
  
  return configPatterns.some(pattern => 
    minimatch(filePath, pattern, { nocase: true })
  );
}

/**
 * 문서 파일인지 확인
 */
export function isDocumentFile(filePath: string): boolean {
  const docPatterns = [
    '**/*.md',
    '**/*.mdx',
    '**/*.txt',
    '**/*.rst',
    '**/*.adoc',
    '**/README*',
    '**/CHANGELOG*',
    '**/LICENSE*',
    '**/CONTRIBUTING*',
    '**/docs/**',
    '**/documentation/**',
  ];
  
  return docPatterns.some(pattern => 
    minimatch(filePath, pattern, { nocase: true })
  );
}

/**
 * 바이너리 파일인지 확인
 */
export function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = [
    '.exe', '.dll', '.so', '.dylib',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
    '.bin', '.dat', '.db', '.sqlite',
    '.woff', '.woff2', '.ttf', '.eot',
    '.class', '.jar', '.war',
    '.pyc', '.pyo',
    '.o', '.obj', '.lib', '.a',
  ];
  
  const ext = path.extname(filePath).toLowerCase();
  return binaryExtensions.includes(ext);
}

/**
 * 파일 크기 포맷팅
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

/**
 * 파일 복잡도 계산
 */
export function calculateFileComplexity(content: string, language: string): number {
  let complexity = 0;
  
  switch (language) {
    case 'typescript':
    case 'javascript':
      // 함수, 클래스, if/else, 루프 등
      complexity += (content.match(/function\s+\w+|class\s+\w+|\bif\s*\(|\bfor\s*\(|\bwhile\s*\(/g) || []).length;
      break;
      
    case 'python':
      complexity += (content.match(/def\s+\w+|class\s+\w+|\bif\s+|\bfor\s+|\bwhile\s+/g) || []).length;
      break;
      
    case 'java':
    case 'csharp':
      complexity += (content.match(/public\s+\w+|private\s+\w+|class\s+\w+|\bif\s*\(|\bfor\s*\(|\bwhile\s*\(/g) || []).length;
      break;
      
    default:
      // 기본적인 복잡도 계산 (줄 수 기반)
      complexity = content.split('\n').filter(line => line.trim().length > 0).length / 10;
  }
  
  return Math.min(complexity, 100); // 최대값 제한
}

/**
 * Git 상태에 따른 파일 분류
 */
export function categorizeFilesByStatus(files: Array<{ path: string; status: string }>): {
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: string[];
} {
  const result = {
    added: [] as string[],
    modified: [] as string[],
    deleted: [] as string[],
    renamed: [] as string[],
  };
  
  files.forEach(file => {
    switch (file.status) {
      case 'added':
      case 'A':
        result.added.push(file.path);
        break;
      case 'modified':
      case 'M':
        result.modified.push(file.path);
        break;
      case 'deleted':
      case 'D':
        result.deleted.push(file.path);
        break;
      case 'renamed':
      case 'R':
        result.renamed.push(file.path);
        break;
    }
  });
  
  return result;
}

/**
 * 파일 경로 정규화
 */
export function normalizeFilePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * 파일이 중요한 시스템 파일인지 확인
 */
export function isCriticalFile(filePath: string): boolean {
  const criticalPatterns = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Cargo.toml',
    'Cargo.lock',
    'go.mod',
    'go.sum',
    'requirements.txt',
    'Pipfile',
    'pyproject.toml',
    'composer.json',
    'composer.lock',
    '**/src/main.*',
    '**/src/index.*',
    '**/src/app.*',
    '**/main.go',
    '**/main.py',
    '**/index.html',
    '**/Dockerfile',
    '**/docker-compose.*',
    '**/.github/workflows/**',
  ];
  
  return criticalPatterns.some(pattern => 
    minimatch(filePath, pattern, { nocase: true })
  );
}

/**
 * 커밋 메시지에서 타입 추출 (Conventional Commits)
 */
export function extractCommitType(message: string): {
  type: string;
  scope?: string;
  description: string;
  isBreaking: boolean;
} {
  const conventionalPattern = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
  const match = message.match(conventionalPattern);
  
  if (match) {
    const [, type, scope, breaking, description] = match;
    return {
      type,
      scope,
      description,
      isBreaking: Boolean(breaking),
    };
  }
  
  return {
    type: 'unknown',
    description: message,
    isBreaking: false,
  };
}