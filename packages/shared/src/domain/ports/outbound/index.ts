/**
 * Outbound Ports (Secondary Ports)
 * 애플리케이션에서 외부로 나가는 인터페이스
 * 외부 시스템과의 통합 포인트
 */

import type { 
  Repository, 
  GitFile, 
  CommitInfo, 
  BranchDiff 
} from '../../../types/git.js';
import type { 
  CodebaseAnalysis, 
  FileAnalysis,
  CodeComponent 
} from '../../../types/analysis.js';

/**
 * Git 저장소 관리 Port
 */
export interface IGitRepository {
  clone(url: string, targetPath: string): Promise<void>;
  getRepository(path: string): Promise<Repository>;
  getBranches(repoPath: string): Promise<string[]>;
  getCurrentBranch(repoPath: string): Promise<string>;
  switchBranch(repoPath: string, branch: string): Promise<void>;
  getDiff(repoPath: string, baseBranch: string, targetBranch: string): Promise<BranchDiff>;
  getCommits(repoPath: string, branch?: string, limit?: number): Promise<CommitInfo[]>;
  getFileContent(repoPath: string, filePath: string, ref?: string): Promise<string>;
  getChangedFiles(repoPath: string, since?: Date): Promise<GitFile[]>;
}

/**
 * 파일 시스템 Port
 */
export interface IFileSystemRepository {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(path: string, pattern?: string): Promise<string[]>;
  getFileStats(path: string): Promise<{
    size: number;
    createdAt: Date;
    modifiedAt: Date;
    isDirectory: boolean;
  }>;
  createDirectory(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  copyFile(source: string, destination: string): Promise<void>;
  moveFile(source: string, destination: string): Promise<void>;
}

/**
 * 벡터 스토어 Port
 */
export interface IVectorStore {
  initialize(collection: string): Promise<void>;
  addDocument(
    id: string, 
    content: string, 
    metadata: Record<string, any>
  ): Promise<void>;
  addDocuments(
    documents: Array<{
      id: string;
      content: string;
      metadata: Record<string, any>;
    }>
  ): Promise<void>;
  search(
    query: string, 
    limit?: number,
    filter?: Record<string, any>
  ): Promise<Array<{
    id: string;
    score: number;
    content: string;
    metadata: Record<string, any>;
  }>>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}

/**
 * AI 서비스 Port
 */
export interface IAIService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  analyzeCode(
    code: string, 
    language: string,
    context?: string
  ): Promise<{
    summary: string;
    complexity: number;
    components: CodeComponent[];
    dependencies: string[];
  }>;
  explainCode(
    code: string,
    language: string,
    context?: string
  ): Promise<string>;
  generateDocumentation(
    code: string,
    language: string,
    style?: 'jsdoc' | 'markdown' | 'plain'
  ): Promise<string>;
  detectVulnerabilities(
    code: string,
    language: string
  ): Promise<Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    line: number;
    description: string;
    suggestion?: string;
  }>>;
  suggestRefactoring(
    code: string,
    language: string
  ): Promise<Array<{
    type: string;
    description: string;
    before: string;
    after: string;
  }>>;
}

/**
 * 캐시 Port
 */
export interface ICacheRepository {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

/**
 * 이벤트 버스 Port
 */
export interface IEventBus {
  publish<T>(event: string, data: T): Promise<void>;
  subscribe<T>(
    event: string, 
    handler: (data: T) => Promise<void>
  ): void;
  unsubscribe(event: string, handler: Function): void;
}

/**
 * 메트릭 수집 Port
 */
export interface IMetricsCollector {
  incrementCounter(name: string, tags?: Record<string, string>): void;
  recordGauge(name: string, value: number, tags?: Record<string, string>): void;
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
  recordTiming(name: string, duration: number, tags?: Record<string, string>): void;
}

/**
 * 로깅 Port
 */
export interface ILogger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, error?: Error, context?: any): void;
  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
}

/**
 * 데이터베이스 Port
 */
export interface IDatabaseRepository {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  // Session 관리
  saveSession(session: {
    id: string;
    userId?: string;
    codebaseId: string;
    startedAt: Date;
    metadata?: Record<string, any>;
  }): Promise<void>;
  
  getSession(id: string): Promise<any | null>;
  updateSession(id: string, updates: Partial<any>): Promise<void>;
  deleteSession(id: string): Promise<void>;
  
  // Analysis 결과 저장
  saveAnalysis(analysis: {
    id: string;
    sessionId: string;
    type: string;
    result: CodebaseAnalysis;
    createdAt: Date;
  }): Promise<void>;
  
  getAnalysis(id: string): Promise<any | null>;
  getAnalysesBySession(sessionId: string): Promise<any[]>;
  
  // 통계
  getStatistics(filter?: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
  }): Promise<{
    totalSessions: number;
    totalAnalyses: number;
    averageSessionDuration: number;
    mostAnalyzedRepos: Array<{ repo: string; count: number }>;
  }>;
}