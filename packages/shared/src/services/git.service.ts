import simpleGit, { SimpleGit, LogResult, DiffResult } from 'simple-git';
import { GitFile, CommitInfo, BranchDiff, Repository } from '../types/git.js';
import { GitOperationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';

export class GitService {
  private git: SimpleGit;
  private gitLogger = logger.withContext('git-service');
  
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
        'getRepositoryInfo',
        this.repoPath
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
      this.gitLogger.info(`Analyzing diff between ${baseBranch} and ${targetBranch}`);
      
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
        'analyzeBranchDiff',
        this.repoPath
      );
    }
  }

  /**
   * 특정 커밋의 파일 변경사항 가져오기
   */
  private async getCommitFiles(hash: string): Promise<GitFile[]> {
    try {
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
    } catch (error) {
      this.gitLogger.warn(`Failed to get commit files for ${hash}`, error as Error);
      return [];
    }
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
    try {
      const allBranches = await this.git.branch();
      const branchNames = allBranches.all;

      for (const branch of branches) {
        if (!branchNames.includes(branch)) {
          throw new GitOperationError(
            `Branch '${branch}' does not exist`,
            'validateBranches',
            this.repoPath
          );
        }
      }
    } catch (error) {
      if (error instanceof GitOperationError) {
        throw error;
      }
      throw new GitOperationError(
        `Failed to validate branches: ${error}`,
        'validateBranches',
        this.repoPath
      );
    }
  }

  /**
   * 파일 목록 가져오기
   */
  async getFiles(patterns: string[] = []): Promise<string[]> {
    try {
      const args = ['ls-files'];
      if (patterns.length > 0) {
        args.push(...patterns);
      }
      
      const files = await this.git.raw(args);

      return files
        .split('\n')
        .filter(Boolean)
        .filter(file => !file.startsWith('.git/'));
    } catch (error) {
      throw new GitOperationError(
        `Failed to get files: ${error}`,
        'getFiles',
        this.repoPath
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
        'getFileContent',
        this.repoPath
      );
    }
  }

  /**
   * 브랜치 전환
   */
  async checkout(branch: string): Promise<void> {
    try {
      await this.git.checkout(branch);
      this.gitLogger.info(`Switched to branch: ${branch}`);
    } catch (error) {
      throw new GitOperationError(
        `Failed to checkout branch ${branch}: ${error}`,
        'checkout',
        this.repoPath
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
        'getRecentCommits',
        this.repoPath
      );
    }
  }

  /**
   * 브랜치 목록 가져오기
   */
  async getBranches(): Promise<string[]> {
    try {
      const branches = await this.git.branch();
      return branches.all.filter(branch => !branch.startsWith('remotes/'));
    } catch (error) {
      throw new GitOperationError(
        `Failed to get branches: ${error}`,
        'getBranches',
        this.repoPath
      );
    }
  }

  /**
   * 현재 브랜치 가져오기
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch (error) {
      throw new GitOperationError(
        `Failed to get current branch: ${error}`,
        'getCurrentBranch',
        this.repoPath
      );
    }
  }

  /**
   * 저장소가 Git 저장소인지 확인
   */
  async isRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 워킹 디렉토리 상태 확인
   */
  async isClean(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return status.files.length === 0;
    } catch {
      return false;
    }
  }

  /**
   * 태그 목록 가져오기
   */
  async getTags(): Promise<string[]> {
    try {
      const tags = await this.git.tags();
      return tags.all;
    } catch (error) {
      throw new GitOperationError(
        `Failed to get tags: ${error}`,
        'getTags',
        this.repoPath
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