import { promises as fs } from 'fs';
import path from 'path';
import { simpleGit } from 'simple-git';
import { glob } from 'glob';

import { ToolResult } from '../types/mcp.js';
import { CodebaseAnalysisResult, FileAnalysis } from '../types/analysis.js';

interface LearnCodebaseParams {
  repoPath: string;
  branch?: string;
}

// 지원되는 프로그래밍 언어 확장자
const SUPPORTED_EXTENSIONS = {
  '.ts': 'TypeScript',
  '.js': 'JavaScript', 
  '.tsx': 'TypeScript React',
  '.jsx': 'JavaScript React',
  '.py': 'Python',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.go': 'Go',
  '.rs': 'Rust',
  '.cpp': 'C++',
  '.c': 'C',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.swift': 'Swift',
  '.scala': 'Scala',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.md': 'Markdown',
};

// 테스트 파일 패턴
const TEST_PATTERNS = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/test/**/*',
  '**/tests/**/*',
  '**/__tests__/**/*',
];

// 설정 파일 패턴
const CONFIG_PATTERNS = [
  '**/package.json',
  '**/tsconfig.json',
  '**/build.gradle*',
  '**/pom.xml',
  '**/Cargo.toml',
  '**/.env*',
  '**/docker-compose.yml',
  '**/Dockerfile',
  '**/*.config.*',
];

export async function handleLearnCodebase(params: LearnCodebaseParams): Promise<ToolResult> {
  const startTime = Date.now();
  const { repoPath, branch = 'main' } = params;

  try {
    // Git 레포지토리 검증
    await validateGitRepository(repoPath, branch);

    // 파일 분석 시작
    const analysisResult = await analyzeCodebase(repoPath, branch);
    
    const analysisTime = ((Date.now() - startTime) / 1000).toFixed(1);
    analysisResult.analysisTime = `${analysisTime}초`;

    const resultText = formatAnalysisResult(analysisResult);

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    };
  } catch (error) {
    throw new Error(`코드베이스 학습 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

async function validateGitRepository(repoPath: string, branch: string): Promise<void> {
  try {
    // 디렉토리 존재 확인
    await fs.access(repoPath);
    
    const git = simpleGit(repoPath);
    
    // Git 레포지토리인지 확인
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error(`${repoPath}는 Git 레포지토리가 아닙니다`);
    }

    // 브랜치 존재 확인
    const branches = await git.branchLocal();
    if (!branches.all.includes(branch)) {
      throw new Error(`브랜치 '${branch}'가 존재하지 않습니다`);
    }

    // 브랜치 체크아웃
    await git.checkout(branch);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Git 레포지토리 검증 실패');
  }
}

async function analyzeCodebase(repoPath: string, branch: string): Promise<CodebaseAnalysisResult> {
  // 모든 소스 코드 파일 찾기
  const allFiles = await findSourceFiles(repoPath);
  const fileAnalyses = await Promise.all(
    allFiles.map(filePath => analyzeFile(path.join(repoPath, filePath)))
  );

  // 통계 계산
  const statistics = calculateStatistics(allFiles, fileAnalyses, repoPath);
  
  // 컴포넌트 식별
  const components = identifyComponents(fileAnalyses);

  return {
    filesAnalyzed: allFiles.length,
    featuresExtracted: components.length,
    componentsIdentified: components.length,
    branch,
    statistics,
    identifiedComponents: components,
    analysisTime: '', // 호출하는 곳에서 설정됨
  };
}

async function findSourceFiles(repoPath: string): Promise<string[]> {
  const extensions = Object.keys(SUPPORTED_EXTENSIONS);
  const patterns = extensions.map(ext => `**/*${ext}`);
  
  const allFiles = await glob(patterns, {
    cwd: repoPath,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/target/**',
      '**/.git/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.nuxt/**',
    ],
  });

  return allFiles;
}

async function analyzeFile(filePath: string): Promise<FileAnalysis> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const ext = path.extname(filePath);
    const language = SUPPORTED_EXTENSIONS[ext as keyof typeof SUPPORTED_EXTENSIONS] || 'Unknown';

    // 기본적인 복잡도 계산 (순환 복잡도 근사치)
    const complexity = calculateComplexity(content);

    // 의존성 추출
    const dependencies = extractDependencies(content, language);

    // 함수/메서드 추출
    const functions = extractFunctions(content, language);

    return {
      path: filePath,
      language,
      lines: lines.length,
      complexity,
      dependencies,
      exports: [], // 향후 구현
      functions,
    };
  } catch (error) {
    // 파일 읽기 실패 시 기본값 반환
    return {
      path: filePath,
      language: 'Unknown',
      lines: 0,
      complexity: 0,
      dependencies: [],
      exports: [],
      functions: [],
    };
  }
}

function calculateComplexity(content: string): number {
  // 간단한 순환 복잡도 근사 계산
  const complexityKeywords = [
    /\bif\b/g,
    /\belse\b/g,
    /\bwhile\b/g,
    /\bfor\b/g,
    /\bswitch\b/g,
    /\bcase\b/g,
    /\btry\b/g,
    /\bcatch\b/g,
    /\b\?\b/g, // 삼항 연산자
  ];

  let complexity = 1; // 기본 복잡도

  complexityKeywords.forEach(regex => {
    const matches = content.match(regex);
    if (matches) {
      complexity += matches.length;
    }
  });

  return complexity;
}

function extractDependencies(content: string, language: string): string[] {
  const dependencies: string[] = [];

  if (language.includes('TypeScript') || language.includes('JavaScript')) {
    // import 문 추출
    const importMatches = content.match(/import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g);
    const requireMatches = content.match(/require\(['"`]([^'"`]+)['"`]\)/g);

    if (importMatches) {
      importMatches.forEach(match => {
        const moduleMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/);
        if (moduleMatch) {
          dependencies.push(moduleMatch[1]);
        }
      });
    }

    if (requireMatches) {
      requireMatches.forEach(match => {
        const moduleMatch = match.match(/require\(['"`]([^'"`]+)['"`]\)/);
        if (moduleMatch) {
          dependencies.push(moduleMatch[1]);
        }
      });
    }
  }

  return Array.from(new Set(dependencies)); // 중복 제거
}

function extractFunctions(content: string, language: string): FileAnalysis['functions'] {
  const functions: FileAnalysis['functions'] = [];

  if (language.includes('TypeScript') || language.includes('JavaScript')) {
    // 함수 선언 패턴
    const functionPatterns = [
      /function\s+(\w+)\s*\(([^)]*)\)/g,
      /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/g,
      /(\w+)\s*:\s*\(([^)]*)\)\s*=>/g, // 메서드
    ];

    const lines = content.split('\n');
    
    functionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const functionName = match[1];
        const parameters = match[2].split(',').map(p => p.trim()).filter(p => p);
        
        // 라인 번호 찾기 (근사치)
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        
        functions.push({
          name: functionName,
          lineStart: lineNumber,
          lineEnd: lineNumber, // 정확한 끝 라인은 더 복잡한 파싱 필요
          parameters,
        });
      }
    });
  }

  return functions;
}

function calculateStatistics(allFiles: string[], fileAnalyses: FileAnalysis[], repoPath: string): CodebaseAnalysisResult['statistics'] {
  // 테스트 파일 카운트
  const testFiles = allFiles.filter(file => 
    TEST_PATTERNS.some(pattern => 
      file.includes('test') || file.includes('spec') || file.includes('__tests__')
    )
  );

  // 설정 파일 카운트  
  const configFiles = allFiles.filter(file =>
    CONFIG_PATTERNS.some(pattern => {
      const filename = path.basename(file);
      return filename === 'package.json' || 
             filename === 'tsconfig.json' || 
             filename.includes('.config.') ||
             filename.startsWith('.env');
    })
  );

  // 언어별 통계
  const languageMap = new Map<string, number>();
  fileAnalyses.forEach(analysis => {
    const count = languageMap.get(analysis.language) || 0;
    languageMap.set(analysis.language, count + 1);
  });

  const supportedLanguages = Array.from(languageMap.keys()).filter(lang => lang !== 'Unknown');
  const totalLines = fileAnalyses.reduce((sum, analysis) => sum + analysis.lines, 0);

  return {
    totalFiles: allFiles.length,
    totalLines,
    testFiles: testFiles.length,
    configFiles: configFiles.length,
    supportedLanguages,
  };
}

function identifyComponents(fileAnalyses: FileAnalysis[]): CodebaseAnalysisResult['identifiedComponents'] {
  const components: CodebaseAnalysisResult['identifiedComponents'] = [];

  fileAnalyses.forEach(analysis => {
    const pathParts = analysis.path.split('/');
    const filename = path.basename(analysis.path, path.extname(analysis.path));

    let componentType: 'service' | 'component' | 'utility' | 'config' = 'component';
    let description = '';

    // 파일 경로와 이름으로 컴포넌트 타입 추정
    if (pathParts.some(part => part.includes('service') || part.includes('Service'))) {
      componentType = 'service';
      description = `${filename} 서비스 - 비즈니스 로직을 처리하는 서비스 클래스`;
    } else if (pathParts.some(part => part.includes('util') || part.includes('helper'))) {
      componentType = 'utility';
      description = `${filename} 유틸리티 - 공통 기능을 제공하는 유틸리티 함수`;
    } else if (filename.includes('config') || filename.includes('Config')) {
      componentType = 'config';
      description = `${filename} 설정 - 애플리케이션 설정을 관리`;
    } else {
      description = `${filename} 컴포넌트 - ${analysis.language}로 구현된 모듈`;
    }

    // 주요 컴포넌트만 포함 (복잡도나 함수 수 기준)
    if (analysis.functions.length > 2 || analysis.complexity > 5) {
      components.push({
        name: filename,
        description,
        path: analysis.path,
        type: componentType,
      });
    }
  });

  return components.slice(0, 10); // 상위 10개만 반환
}

function formatAnalysisResult(result: CodebaseAnalysisResult): string {
  return `코드베이스 학습 완료:

분석된 파일: ${result.statistics.totalFiles}개
지원 언어: ${result.statistics.supportedLanguages.join(', ')}
분석 시간: ${result.analysisTime}

주요 통계:
- 총 라인 수: ${result.statistics.totalLines.toLocaleString()}
- 테스트 파일: ${result.statistics.testFiles}개
- 설정 파일: ${result.statistics.configFiles}개

주요 컴포넌트:
${result.identifiedComponents.map(comp => `- ${comp.name}: ${comp.description}`).join('\n')}`;
}