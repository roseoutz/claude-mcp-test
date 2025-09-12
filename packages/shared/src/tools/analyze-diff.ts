/**
 * Analyze Branch Diff Tool Handler
 * 브랜치 간 차이점을 분석하고 변경 사항을 요약
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AnalyzeDiffInput } from '../types/mcp.js';
import { logger } from '../utils/logger.js';
import { 
  createTextResponse,
  createErrorResponse,
  createStructuredResponse,
  createTableResponse
} from '../utils/mcp-formatter.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 브랜치 차이 분석 도구 핸들러
 */
export async function handleAnalyzeDiff(args: AnalyzeDiffInput): Promise<CallToolResult> {
  const toolLogger = logger.withContext('analyze-diff');
  
  try {
    toolLogger.info('Starting branch diff analysis', args);

    // 입력 검증
    const validation = validateInput(args);
    if (!validation.isValid) {
      return createErrorResponse(`Invalid input: ${validation.errors.join(', ')}`);
    }

    const {
      repoPath,
      baseBranch,
      targetBranch,
      includeStats = true,
      contextLines = 3
    } = args;

    // Git 저장소 확인
    const gitPath = path.join(repoPath, '.git');
    if (!await directoryExists(gitPath)) {
      return createErrorResponse(`Not a git repository: ${repoPath}`);
    }

    toolLogger.info(`Analyzing diff between ${baseBranch} and ${targetBranch}`);

    // 브랜치 존재 확인 (단순화된 버전 - 실제로는 git 명령어 필요)
    const diffResult = await analyzeBranchDifference(repoPath, baseBranch, targetBranch, {
      includeStats,
      contextLines
    });

    if (!diffResult.hasChanges) {
      return createTextResponse(`No differences found between branches '${baseBranch}' and '${targetBranch}'.`);
    }

    // 결과 포맷팅
    const summary = formatDiffSummary(diffResult);
    const details = {
      statistics: diffResult.stats,
      changedFiles: diffResult.files,
      commits: diffResult.commits
    };

    return createStructuredResponse(
      `Branch Diff Analysis: ${baseBranch} → ${targetBranch}`,
      details,
      {
        repository: path.resolve(repoPath),
        baseBranch,
        targetBranch,
        analysis_timestamp: new Date().toISOString()
      }
    );

  } catch (error) {
    toolLogger.error('Failed to analyze branch diff', error as Error);
    return createErrorResponse(error as Error);
  }
}

/**
 * 입력 검증
 */
function validateInput(args: AnalyzeDiffInput): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!args.repoPath) {
    errors.push('repoPath is required');
  }

  if (!args.baseBranch) {
    errors.push('baseBranch is required');
  }

  if (!args.targetBranch) {
    errors.push('targetBranch is required');
  }

  if (args.baseBranch === args.targetBranch) {
    errors.push('baseBranch and targetBranch must be different');
  }

  if (args.contextLines && (args.contextLines < 0 || args.contextLines > 10)) {
    errors.push('contextLines must be between 0 and 10');
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
 * 브랜치 차이 분석 (단순화된 버전)
 * 실제 구현에서는 git 라이브러리나 명령어를 사용해야 함
 */
async function analyzeBranchDifference(
  repoPath: string,
  baseBranch: string,
  targetBranch: string,
  options: {
    includeStats: boolean;
    contextLines: number;
  }
): Promise<{
  hasChanges: boolean;
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
    commits: number;
  };
  files: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    insertions: number;
    deletions: number;
    changes?: string[];
  }>;
  commits: Array<{
    hash: string;
    author: string;
    date: string;
    message: string;
  }>;
}> {
  // 이것은 단순화된 예시입니다
  // 실제로는 simple-git 라이브러리를 사용해야 합니다
  
  // 현재는 모의 데이터를 반환합니다
  const mockResult = {
    hasChanges: true,
    stats: {
      filesChanged: 5,
      insertions: 120,
      deletions: 45,
      commits: 3
    },
    files: [
      {
        path: 'src/components/Button.tsx',
        status: 'modified' as const,
        insertions: 25,
        deletions: 10,
        changes: [
          '+ Added new prop "variant"',
          '+ Improved accessibility',
          '- Removed deprecated className prop'
        ]
      },
      {
        path: 'src/utils/helpers.ts',
        status: 'added' as const,
        insertions: 45,
        deletions: 0,
        changes: [
          '+ Added utility functions',
          '+ Added type definitions'
        ]
      },
      {
        path: 'src/legacy/old-component.tsx',
        status: 'deleted' as const,
        insertions: 0,
        deletions: 35
      }
    ],
    commits: [
      {
        hash: 'abc123',
        author: 'Developer',
        date: new Date().toISOString(),
        message: 'feat: add new button variant'
      },
      {
        hash: 'def456',
        author: 'Developer',
        date: new Date(Date.now() - 86400000).toISOString(),
        message: 'refactor: improve utility functions'
      }
    ]
  };

  // 실제 구현에서는 git 명령어를 실행하여 실제 차이를 분석
  return mockResult;
}

/**
 * diff 결과 요약 포맷팅
 */
function formatDiffSummary(diffResult: any): string {
  const { stats } = diffResult;
  
  let summary = `📊 **Changes Summary:**\n`;
  summary += `• **Files Changed**: ${stats.filesChanged}\n`;
  summary += `• **Lines Added**: +${stats.insertions}\n`;
  summary += `• **Lines Deleted**: -${stats.deletions}\n`;
  summary += `• **Net Change**: ${stats.insertions - stats.deletions > 0 ? '+' : ''}${stats.insertions - stats.deletions}\n`;
  summary += `• **Commits**: ${stats.commits}\n\n`;
  
  // 파일별 변경 사항
  summary += `📁 **Changed Files:**\n`;
  diffResult.files.forEach((file: any) => {
    const statusIconMap: Record<string, string> = {
      'added': '🆕',
      'modified': '✏️',
      'deleted': '🗑️',
      'renamed': '↔️'
    };
    const statusIcon = statusIconMap[file.status] || '📄';
    
    summary += `${statusIcon} \`${file.path}\` `;
    
    if (file.status !== 'deleted') {
      summary += `(+${file.insertions}`;
      if (file.deletions > 0) {
        summary += ` -${file.deletions}`;
      }
      summary += `)`;
    }
    
    summary += `\n`;
    
    // 주요 변경 사항
    if (file.changes && file.changes.length > 0) {
      file.changes.slice(0, 3).forEach((change: string) => {
        summary += `  ${change}\n`;
      });
      
      if (file.changes.length > 3) {
        summary += `  ... and ${file.changes.length - 3} more changes\n`;
      }
    }
    
    summary += `\n`;
  });
  
  return summary;
}

/**
 * TODO: 실제 Git 통합
 * 이 함수들은 실제 Git 라이브러리를 사용하여 구현해야 합니다.
 * 예: simple-git, nodegit 등
 */

// 실제 구현 예시 (주석 처리)
/*
import git from 'simple-git';

async function getActualGitDiff(repoPath: string, baseBranch: string, targetBranch: string) {
  const gitRepo = git(repoPath);
  
  // 브랜치 존재 확인
  const branches = await gitRepo.branch();
  if (!branches.all.includes(baseBranch)) {
    throw new Error(`Branch '${baseBranch}' not found`);
  }
  if (!branches.all.includes(targetBranch)) {
    throw new Error(`Branch '${targetBranch}' not found`);
  }
  
  // 차이점 분석
  const diff = await gitRepo.diff([`${baseBranch}...${targetBranch}`, '--stat']);
  const commits = await gitRepo.log({ from: baseBranch, to: targetBranch });
  
  // 결과 파싱 및 반환
  return {
    hasChanges: diff.length > 0,
    stats: parseDiffStats(diff),
    files: await parseChangedFiles(gitRepo, baseBranch, targetBranch),
    commits: commits.all.map(commit => ({
      hash: commit.hash,
      author: commit.author_name,
      date: commit.date,
      message: commit.message
    }))
  };
}
*/