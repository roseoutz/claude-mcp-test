# Task 07: Git 서비스 구현

## 목표
simple-git을 활용한 Git 작업 서비스 구현

## 작업 내용

### 1. Git 서비스 구현 (`src/services/git.service.ts`)
```typescript
import simpleGit, { SimpleGit, LogResult, DiffResult } from 'simple-git';
import { GitFile, CommitInfo, BranchDiff, Repository } from '../types/git.js';
import { GitOperationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';

export class GitService {
  private git: SimpleGit;
  
  constructor(private repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  /**
   * 레포지토리 정보 가져오기
   */
  async getRepositoryInfo(): Promise<Repository> {
    try {
      const [branch, remotes] = await Promise.all([
        this.git.revparse(['--abbrev-ref', 'HEAD']),
        this.git.getRemotes(true),
      ]);

      const repoName = path.basename(this.repoPath);
      const remote = remotes.find(r => r.name === 'origin')?.refs.fetch;

      return {
        path: this.repoPath,
        name: repoName,
        branch: branch.trim(),
        remote,
      };
    } catch (error) {
      throw new GitOperationError(
        `Failed to get repository info: ${error}`,
        'getRepositoryInfo'
      );
    }
  }

  /**
   * 브랜치 간 차이 분석
   */
  async analyzeBranchDiff(
    baseBranch: string,
    targetBranch: string
  ): Promise<BranchDiff> {
    try {
      // 브랜치 존재 확인
      await this.validateBranches([baseBranch, targetBranch]);

      // 커밋 로그 가져오기
      const log = await this.git.log({
        from: baseBranch,
        to: targetBranch,
      });

      // 파일 차이 가져오기
      const diffSummary = await this.git.diffSummary([
        `${baseBranch}...${targetBranch}`,
      ]);

      // 각 커밋의 상세 정보 수집
      const commits: CommitInfo[] = await Promise.all(
        log.all.map(async (commit) => {
          const files = await this.getCommitFiles(commit.hash);
          return {
            hash: commit.hash,
            author: commit.author_name,
            email: commit.author_email,
            date: new Date(commit.date),
            message: commit.message,
            files,
          };
        })
      );

      return {
        baseBranch,
        targetBranch,
        commits,
        filesChanged: diffSummary.files.length,
        additions: diffSummary.insertions,
        deletions: diffSummary.deletions,
      };
    } catch (error) {
      throw new GitOperationError(
        `Failed to analyze branch diff: ${error}`,
        'analyzeBranchDiff'
      );
    }
  }

  /**
   * 특정 커밋의 파일 변경사항 가져오기
   */
  private async getCommitFiles(hash: string): Promise<GitFile[]> {
    const diff = await this.git.diff([
      `${hash}^`,
      hash,
      '--name-status',
    ]);

    const files: GitFile[] = [];
    const lines = diff.split('\n').filter(Boolean);

    for (const line of lines) {
      const [status, ...pathParts] = line.split('\t');
      const filePath = pathParts.join('\t');
      
      if (!filePath) continue;

      const stats = await this.getFileStats(hash, filePath);
      
      files.push({
        path: filePath,
        status: this.mapGitStatus(status),
        additions: stats.additions,
        deletions: stats.deletions,
      });
    }

    return files;
  }

  /**
   * 파일 통계 가져오기
   */
  private async getFileStats(
    hash: string,
    filePath: string
  ): Promise<{ additions: number; deletions: number }> {
    try {
      const stat = await this.git.raw([
        'diff',
        '--numstat',
        `${hash}^`,
        hash,
        '--',
        filePath,
      ]);

      const [additions, deletions] = stat.split('\t').map(Number);
      return {
        additions: isNaN(additions) ? 0 : additions,
        deletions: isNaN(deletions) ? 0 : deletions,
      };
    } catch {
      return { additions: 0, deletions: 0 };
    }
  }

  /**
   * Git 상태 코드 매핑
   */
  private mapGitStatus(status: string): GitFile['status'] {
    switch (status) {
      case 'A': return 'added';
      case 'M': return 'modified';
      case 'D': return 'deleted';
      case 'R': return 'renamed';
      default: return 'modified';
    }
  }

  /**
   * 브랜치 존재 확인
   */
  private async validateBranches(branches: string[]): Promise<void> {
    const allBranches = await this.git.branch();
    const branchNames = allBranches.all;

    for (const branch of branches) {
      if (!branchNames.includes(branch)) {
        throw new GitOperationError(
          `Branch '${branch}' does not exist`,
          'validateBranches'
        );
      }
    }
  }

  /**
   * 파일 목록 가져오기
   */
  async getFiles(patterns: string[] = ['**/*']): Promise<string[]> {
    try {
      const files = await this.git.raw([
        'ls-files',
        ...patterns,
      ]);

      return files
        .split('\n')
        .filter(Boolean)
        .filter(file => !file.startsWith('.git/'));
    } catch (error) {
      throw new GitOperationError(
        `Failed to get files: ${error}`,
        'getFiles'
      );
    }
  }

  /**
   * 파일 내용 가져오기
   */
  async getFileContent(filePath: string, ref?: string): Promise<string> {
    try {
      if (ref) {
        return await this.git.show([`${ref}:${filePath}`]);
      } else {
        const fullPath = path.join(this.repoPath, filePath);
        return await fs.readFile(fullPath, 'utf-8');
      }
    } catch (error) {
      throw new GitOperationError(
        `Failed to read file ${filePath}: ${error}`,
        'getFileContent'
      );
    }
  }

  /**
   * 브랜치 전환
   */
  async checkout(branch: string): Promise<void> {
    try {
      await this.git.checkout(branch);
      logger.info(`Switched to branch: ${branch}`);
    } catch (error) {
      throw new GitOperationError(
        `Failed to checkout branch ${branch}: ${error}`,
        'checkout'
      );
    }
  }

  /**
   * 최근 커밋 가져오기
   */
  async getRecentCommits(limit: number = 10): Promise<CommitInfo[]> {
    try {
      const log = await this.git.log({ maxCount: limit });
      
      return log.all.map(commit => ({
        hash: commit.hash,
        author: commit.author_name,
        email: commit.author_email,
        date: new Date(commit.date),
        message: commit.message,
        files: [], // 성능상 기본적으로 비워둠
      }));
    } catch (error) {
      throw new GitOperationError(
        `Failed to get recent commits: ${error}`,
        'getRecentCommits'
      );
    }
  }
}

/**
 * Git 서비스 팩토리
 */
export function createGitService(repoPath: string): GitService {
  return new GitService(repoPath);
}
```

### 2. Git 서비스 테스트 (`src/__tests__/services/git.service.test.ts`)
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitService } from '../../services/git.service.js';
import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('GitService', () => {
  let gitService: GitService;
  let testRepoPath: string;

  beforeEach(async () => {
    // 임시 테스트 레포지토리 생성
    testRepoPath = path.join(os.tmpdir(), `test-repo-${Date.now()}`);
    await fs.mkdir(testRepoPath, { recursive: true });
    
    const git = simpleGit(testRepoPath);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
    
    // 테스트 파일 생성
    await fs.writeFile(
      path.join(testRepoPath, 'test.txt'),
      'Hello World'
    );
    await git.add('.');
    await git.commit('Initial commit');
    
    gitService = new GitService(testRepoPath);
  });

  afterEach(async () => {
    // 테스트 레포지토리 정리
    await fs.rm(testRepoPath, { recursive: true, force: true });
  });

  describe('getRepositoryInfo', () => {
    it('should return repository information', async () => {
      const info = await gitService.getRepositoryInfo();
      
      expect(info.path).toBe(testRepoPath);
      expect(info.name).toMatch(/test-repo-/);
      expect(info.branch).toBe('master');
    });
  });

  describe('getFiles', () => {
    it('should return list of files', async () => {
      const files = await gitService.getFiles();
      
      expect(files).toContain('test.txt');
      expect(files).not.toContain('.git/config');
    });
  });

  describe('getFileContent', () => {
    it('should return file content', async () => {
      const content = await gitService.getFileContent('test.txt');
      
      expect(content).toBe('Hello World');
    });
  });

  describe('getRecentCommits', () => {
    it('should return recent commits', async () => {
      const commits = await gitService.getRecentCommits(5);
      
      expect(commits).toHaveLength(1);
      expect(commits[0].message).toBe('Initial commit');
      expect(commits[0].author).toBe('Test User');
    });
  });

  describe('analyzeBranchDiff', () => {
    it('should analyze differences between branches', async () => {
      const git = simpleGit(testRepoPath);
      
      // 새 브랜치 생성 및 변경사항 추가
      await git.checkout(['-b', 'feature']);
      await fs.writeFile(
        path.join(testRepoPath, 'feature.txt'),
        'Feature content'
      );
      await git.add('.');
      await git.commit('Add feature');
      
      const diff = await gitService.analyzeBranchDiff('master', 'feature');
      
      expect(diff.baseBranch).toBe('master');
      expect(diff.targetBranch).toBe('feature');
      expect(diff.filesChanged).toBe(1);
      expect(diff.commits).toHaveLength(1);
    });
  });
});
```

### 3. Git 유틸리티 함수 (`src/utils/git-utils.ts`)
```typescript
import { glob } from 'glob';
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
};

/**
 * 파일 경로에서 언어 감지
 */
export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  
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
  ];
  
  return testPatterns.some(pattern => 
    glob.minimatch(filePath, pattern)
  );
}

/**
 * 파일 크기 포맷팅
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
```

## 체크리스트
- [ ] GitService 클래스 구현
- [ ] 레포지토리 정보 조회 기능
- [ ] 브랜치 차이 분석 기능
- [ ] 파일 목록 및 내용 조회 기능
- [ ] 커밋 히스토리 조회 기능
- [ ] Git 유틸리티 함수 구현
- [ ] 단위 테스트 작성
- [ ] 에러 처리 구현

## 커밋 메시지
```
feat: Git 서비스 구현

- simple-git 기반 Git 작업 서비스
- 브랜치 차이 분석 기능
- 파일 조회 및 커밋 히스토리 기능
- Git 유틸리티 함수 추가
```

## 예상 소요 시간
2시간

## 의존성
- simple-git
- glob

## 검증 방법
- Git 명령어 정상 실행 확인
- 브랜치 분석 기능 테스트
- 파일 조회 기능 테스트
- 단위 테스트 통과