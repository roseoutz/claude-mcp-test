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
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      // 정리 실패는 무시 (Windows에서 발생 가능)
      console.warn(`Failed to clean up test repo: ${error}`);
    }
  });

  describe('getRepositoryInfo', () => {
    it('should return repository information', async () => {
      const info = await gitService.getRepositoryInfo();
      
      expect(info.path).toBe(testRepoPath);
      expect(info.name).toMatch(/test-repo-/);
      expect(typeof info.branch).toBe('string');
      expect(info.branch.length).toBeGreaterThan(0);
    });
  });

  describe('isRepository', () => {
    it('should return true for valid git repository', async () => {
      const isRepo = await gitService.isRepository();
      expect(isRepo).toBe(true);
    });
    
    it('should return false for non-git directory', async () => {
      const nonGitPath = path.join(os.tmpdir(), `non-git-${Date.now()}`);
      await fs.mkdir(nonGitPath, { recursive: true });
      
      const nonGitService = new GitService(nonGitPath);
      const isRepo = await nonGitService.isRepository();
      
      expect(isRepo).toBe(false);
      
      await fs.rm(nonGitPath, { recursive: true, force: true });
    });
  });

  describe('getFiles', () => {
    it('should return list of files', async () => {
      const files = await gitService.getFiles();
      
      expect(files).toContain('test.txt');
      expect(files).not.toContain('.git/config');
      expect(files.every(file => !file.startsWith('.git/'))).toBe(true);
    });
  });

  describe('getFileContent', () => {
    it('should return file content', async () => {
      const content = await gitService.getFileContent('test.txt');
      
      expect(content).toBe('Hello World');
    });
    
    it('should throw error for non-existent file', async () => {
      await expect(
        gitService.getFileContent('non-existent.txt')
      ).rejects.toThrow();
    });
  });

  describe('getRecentCommits', () => {
    it('should return recent commits', async () => {
      const commits = await gitService.getRecentCommits(5);
      
      expect(commits).toHaveLength(1);
      expect(commits[0].message).toBe('Initial commit');
      expect(commits[0].author).toBe('Test User');
      expect(commits[0].email).toBe('test@example.com');
      expect(commits[0].hash).toMatch(/^[a-f0-9]{40}$/);
      expect(commits[0].date).toBeInstanceOf(Date);
    });
    
    it('should limit number of commits returned', async () => {
      const git = simpleGit(testRepoPath);
      
      // 추가 커밋 생성
      await fs.writeFile(path.join(testRepoPath, 'test2.txt'), 'Second file');
      await git.add('.');
      await git.commit('Second commit');
      
      await fs.writeFile(path.join(testRepoPath, 'test3.txt'), 'Third file');
      await git.add('.');
      await git.commit('Third commit');
      
      const commits = await gitService.getRecentCommits(2);
      expect(commits).toHaveLength(2);
      expect(commits[0].message).toBe('Third commit');
      expect(commits[1].message).toBe('Second commit');
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      const branch = await gitService.getCurrentBranch();
      expect(typeof branch).toBe('string');
      expect(branch.length).toBeGreaterThan(0);
    });
  });

  describe('getBranches', () => {
    it('should return list of branches', async () => {
      const branches = await gitService.getBranches();
      expect(branches).toBeInstanceOf(Array);
      expect(branches.length).toBeGreaterThanOrEqual(1);
      
      // 원격 브랜치는 제외되어야 함
      expect(branches.every(branch => !branch.startsWith('remotes/'))).toBe(true);
    });
  });

  describe('isClean', () => {
    it('should return true for clean working directory', async () => {
      const isClean = await gitService.isClean();
      expect(isClean).toBe(true);
    });
    
    it('should return false for dirty working directory', async () => {
      // 파일 수정
      await fs.writeFile(
        path.join(testRepoPath, 'test.txt'),
        'Modified content'
      );
      
      const isClean = await gitService.isClean();
      expect(isClean).toBe(false);
    });
  });

  describe('analyzeBranchDiff', () => {
    it('should analyze differences between branches', async () => {
      const git = simpleGit(testRepoPath);
      const initialBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
      
      // 새 브랜치 생성 및 변경사항 추가
      await git.checkout(['-b', 'feature']);
      await fs.writeFile(
        path.join(testRepoPath, 'feature.txt'),
        'Feature content'
      );
      await git.add('.');
      await git.commit('Add feature');
      
      const diff = await gitService.analyzeBranchDiff(initialBranch.trim(), 'feature');
      
      expect(diff.baseBranch).toBe(initialBranch.trim());
      expect(diff.targetBranch).toBe('feature');
      expect(diff.filesChanged).toBe(1);
      expect(diff.additions).toBeGreaterThan(0);
      expect(diff.commits).toHaveLength(1);
      expect(diff.commits[0].message).toBe('Add feature');
    });
    
    it('should throw error for non-existent branch', async () => {
      await expect(
        gitService.analyzeBranchDiff('main', 'non-existent-branch')
      ).rejects.toThrow();
    });
  });

  describe('getTags', () => {
    it('should return empty array when no tags exist', async () => {
      const tags = await gitService.getTags();
      expect(tags).toBeInstanceOf(Array);
      expect(tags).toHaveLength(0);
    });
    
    it('should return tags when they exist', async () => {
      const git = simpleGit(testRepoPath);
      await git.addAnnotatedTag('v1.0.0', 'Version 1.0.0');
      
      const tags = await gitService.getTags();
      expect(tags).toContain('v1.0.0');
    });
  });

  describe('checkout', () => {
    it('should switch to existing branch', async () => {
      const git = simpleGit(testRepoPath);
      await git.checkout(['-b', 'test-branch']);
      
      // 다른 브랜치로 전환
      const initialBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
      await gitService.checkout(initialBranch.trim());
      
      const currentBranch = await gitService.getCurrentBranch();
      expect(currentBranch).toBe(initialBranch.trim());
    });
    
    it('should throw error for non-existent branch', async () => {
      await expect(
        gitService.checkout('non-existent-branch')
      ).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle invalid repository path', () => {
      expect(() => {
        new GitService('/non/existent/path');
      }).toThrow();
    });
    
    it('should handle git operation errors gracefully', async () => {
      // Git 저장소가 아닌 디렉토리에서 Git 작업 시도
      const nonGitPath = path.join(os.tmpdir(), `non-git-${Date.now()}`);
      await fs.mkdir(nonGitPath, { recursive: true });
      
      const invalidService = new GitService(nonGitPath);
      
      await expect(
        invalidService.getRepositoryInfo()
      ).rejects.toThrow();
      
      await fs.rm(nonGitPath, { recursive: true, force: true });
    });
  });
});