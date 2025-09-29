/**
 * Learn Codebase Tool Handler
 * 코드베이스를 분석하고 학습하여 벡터 스토어에 저장
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { LearnCodebaseInput } from '../types/mcp.js';
import { ApplicationConfig } from '../config/app.config.js';
import { ElasticsearchVectorStore } from '../services/elasticsearch.service.js';
import { logger } from '../utils/logger.js';
import { 
  createTextResponse, 
  createErrorResponse, 
  createProgressResponse,
  createSuccessResponse,
  createStatsResponse
} from '../utils/mcp-formatter.js';
import { 
  splitTextIntoChunks, 
  preprocessCodeForEmbedding,
  isValidTextForEmbedding 
} from '../utils/vector-utils.js';
import { FilePath, Language } from '../domain/value-objects/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 코드베이스 학습 도구 핸들러
 */
export async function handleLearnCodebase(args: LearnCodebaseInput): Promise<CallToolResult> {
  const toolLogger = logger.withContext('learn-codebase');
  
  try {
    toolLogger.info('Starting codebase learning', args);

    // 입력 검증
    const validation = validateInput(args);
    if (!validation.isValid) {
      return createErrorResponse(`Invalid input: ${validation.errors.join(', ')}`);
    }

    const {
      repoPath,
      branch = 'main',
      includeTests = false,
      maxFileSize = ApplicationConfig.getSecurityConfig().maxFileSize,
      filePatterns = [],
      excludePatterns = []
    } = args;

    // 디렉토리 존재 확인
    if (!await directoryExists(repoPath)) {
      return createErrorResponse(`Directory not found: ${repoPath}`);
    }

    toolLogger.info('Scanning files...');
    
    // 파일 스캔
    const files = await scanCodebaseFiles(repoPath, {
      includeTests,
      maxFileSize,
      filePatterns,
      excludePatterns
    });

    if (files.length === 0) {
      return createTextResponse('No valid files found to analyze.');
    }

    toolLogger.info(`Found ${files.length} files to process`);

    // 벡터 스토어 초기화
    const vectorStore = new ElasticsearchVectorStore(`codebase_${generateCollectionId(repoPath)}`);
    await vectorStore.initialize(`codebase_${generateCollectionId(repoPath)}`);

    // 파일들을 청크 단위로 처리
    const stats = {
      totalFiles: files.length,
      processedFiles: 0,
      totalChunks: 0,
      skippedFiles: 0,
      errors: 0,
      languages: new Map<string, number>()
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        toolLogger.debug(`Processing file: ${file.path}`);
        
        const content = await fs.readFile(file.path, 'utf-8');
        const cleanContent = preprocessCodeForEmbedding(content);

        if (!isValidTextForEmbedding(cleanContent, 20)) {
          stats.skippedFiles++;
          continue;
        }

        // 파일을 청크로 분할
        const chunks = splitTextIntoChunks(cleanContent, 1000, 100);
        
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          const chunkId = `${file.relativePath}#chunk_${chunkIndex}`;
          
          const metadata = {
            filePath: file.relativePath,
            language: file.language,
            chunkIndex,
            totalChunks: chunks.length,
            fileSize: file.size,
            lastModified: file.lastModified.toISOString(),
            repoPath: path.resolve(repoPath),
            branch
          };

          await vectorStore.addDocument(chunkId, chunk, metadata);
          stats.totalChunks++;
        }

        stats.processedFiles++;
        
        // 언어별 통계
        const currentCount = stats.languages.get(file.language) || 0;
        stats.languages.set(file.language, currentCount + 1);

        // 진행률 업데이트 (10% 간격으로)
        if (i % Math.max(1, Math.floor(files.length / 10)) === 0) {
          toolLogger.info(`Progress: ${i + 1}/${files.length} files processed`);
        }

      } catch (error) {
        toolLogger.error(`Error processing file ${file.path}`, error as Error);
        stats.errors++;
      }
    }

    const finalStats = {
      totalFiles: stats.totalFiles,
      processedFiles: stats.processedFiles,
      totalChunks: stats.totalChunks,
      skippedFiles: stats.skippedFiles,
      errorCount: stats.errors,
      languages: Object.fromEntries(stats.languages),
      repository: path.resolve(repoPath),
      branch,
      timestamp: new Date().toISOString()
    };

    toolLogger.info('Codebase learning completed', finalStats);

    if (stats.errors > 0) {
      return createSuccessResponse(
        `Codebase learning completed with ${stats.errors} errors`,
        finalStats
      );
    }

    return createSuccessResponse('Codebase learning completed successfully', finalStats);

  } catch (error) {
    toolLogger.error('Failed to learn codebase', error as Error);
    return createErrorResponse(error as Error);
  }
}

/**
 * 입력 검증
 */
function validateInput(args: LearnCodebaseInput): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!args.repoPath) {
    errors.push('repoPath is required');
  }

  if (args.maxFileSize && args.maxFileSize < 1024) {
    errors.push('maxFileSize must be at least 1024 bytes');
  }

  if (args.maxFileSize && args.maxFileSize > 50 * 1024 * 1024) {
    errors.push('maxFileSize cannot exceed 50MB');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 디렉토리 존재 확인
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 컬렉션 ID 생성
 */
function generateCollectionId(repoPath: string): string {
  const normalized = path.resolve(repoPath);
  const name = path.basename(normalized);
  const hash = Buffer.from(normalized).toString('base64url').substring(0, 8);
  return `${name}_${hash}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * 코드베이스 파일 스캔
 */
async function scanCodebaseFiles(
  repoPath: string,
  options: {
    includeTests: boolean;
    maxFileSize: number;
    filePatterns?: string[];
    excludePatterns?: string[];
  }
): Promise<Array<{
  path: string;
  relativePath: string;
  language: string;
  size: number;
  lastModified: Date;
}>> {
  const files: Array<{
    path: string;
    relativePath: string;
    language: string;
    size: number;
    lastModified: Date;
  }> = [];

  const scanDirectory = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoPath, fullPath);

      if (entry.isDirectory()) {
        // 제외할 디렉토리 패턴 확인
        if (shouldExcludeDirectory(relativePath)) {
          continue;
        }
        
        await scanDirectory(fullPath);
      } else if (entry.isFile()) {
        try {
          // 파일 필터링
          if (!shouldIncludeFile(relativePath, options)) {
            continue;
          }

          const stats = await fs.stat(fullPath);
          
          if (stats.size > options.maxFileSize) {
            continue;
          }

          const filePath = new FilePath(relativePath);
          let language: string;

          try {
            const lang = Language.fromFilePath(relativePath);
            language = lang.value;
          } catch {
            // 알 수 없는 확장자는 건너뜀
            continue;
          }

          files.push({
            path: fullPath,
            relativePath,
            language,
            size: stats.size,
            lastModified: stats.mtime
          });

        } catch (error) {
          // 파일 접근 오류 무시
          continue;
        }
      }
    }
  };

  await scanDirectory(repoPath);
  return files;
}

/**
 * 디렉토리 제외 여부 확인
 */
function shouldExcludeDirectory(relativePath: string): boolean {
  const excludePatterns = ApplicationConfig.getExcludedPaths();
  const commonExcludes = [
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    'dist',
    'build',
    'target',
    'out',
    'bin',
    'obj',
    '.next',
    '.nuxt',
    'vendor',
    'deps',
    '__pycache__',
    '.pytest_cache',
    'coverage',
    '.coverage',
    '.nyc_output'
  ];

  const allExcludes = [...excludePatterns, ...commonExcludes];
  
  return allExcludes.some(pattern => 
    relativePath.includes(pattern) || relativePath.startsWith(pattern)
  );
}

/**
 * 파일 포함 여부 확인
 */
function shouldIncludeFile(
  relativePath: string,
  options: {
    includeTests: boolean;
    filePatterns?: string[];
    excludePatterns?: string[];
  }
): boolean {
  // 허용된 파일인지 확인
  if (!ApplicationConfig.isFileAllowed(relativePath)) {
    return false;
  }

  // 테스트 파일 처리
  if (!options.includeTests && isTestFile(relativePath)) {
    return false;
  }

  // 사용자 정의 패턴 확인
  if (options.filePatterns && options.filePatterns.length > 0) {
    const matches = options.filePatterns.some(pattern => 
      new RegExp(pattern).test(relativePath)
    );
    if (!matches) {
      return false;
    }
  }

  if (options.excludePatterns && options.excludePatterns.length > 0) {
    const excluded = options.excludePatterns.some(pattern => 
      new RegExp(pattern).test(relativePath)
    );
    if (excluded) {
      return false;
    }
  }

  return true;
}

/**
 * 테스트 파일 여부 확인
 */
function isTestFile(filePath: string): boolean {
  const testPatterns = [
    /\.test\./,
    /\.spec\./,
    /_test\./,
    /_spec\./,
    /test_/,
    /spec_/,
    /\/tests?\//,
    /\/specs?\//,
    /\/__tests__\//,
    /\.tests?\./
  ];

  return testPatterns.some(pattern => pattern.test(filePath));
}