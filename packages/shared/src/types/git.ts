export interface Repository {
  path: string;
  name: string;
  branch: string;
  remote?: string;
}

export interface GitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  content?: string;
}

export interface CommitInfo {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  files: GitFile[];
}

export interface BranchDiff {
  baseBranch: string;
  targetBranch: string;
  commits: CommitInfo[];
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface GitStats {
  totalCommits: number;
  totalBranches: number;
  totalTags: number;
  contributors: Array<{
    name: string;
    email: string;
    commits: number;
  }>;
  lastCommit: CommitInfo;
}