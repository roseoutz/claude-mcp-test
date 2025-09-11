# Task 03: 도메인 인터페이스 정의

## 목표
코드베이스 분석을 위한 핵심 인터페이스 및 서비스 계약 정의

## 작업 내용

### 1. 서비스 인터페이스 (`src/types/services.ts`)
```typescript
export interface IGitService {
  getRepositoryInfo(): Promise<Repository>;
  analyzeBranchDiff(baseBranch: string, targetBranch: string): Promise<BranchDiff>;
  getFiles(patterns?: string[]): Promise<string[]>;
  getFileContent(filePath: string, ref?: string): Promise<string>;
  checkout(branch: string): Promise<void>;
  getRecentCommits(limit?: number): Promise<CommitInfo[]>;
}

export interface IAnalysisService {
  analyzeCodebase(repoPath: string, options?: AnalysisOptions): Promise<CodebaseAnalysis>;
  analyzeFile(filePath: string, content: string): Promise<FileAnalysis>;
  extractComponents(analysis: FileAnalysis): CodeComponent[];
  calculateComplexity(content: string): number;
}

export interface IAIService {
  generateEmbedding(text: string): Promise<number[]>;
  explainCode(code: string, context?: string): Promise<string>;
  suggestImprovements(analysis: CodebaseAnalysis): Promise<string[]>;
  analyzeSecurity(code: string): Promise<SecurityIssue[]>;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

### 2. 리포지토리 패턴 (`src/types/repositories.ts`)
```typescript
export interface IVectorStore {
  store(id: string, vector: number[], metadata: Record<string, any>): Promise<void>;
  search(vector: number[], limit?: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface IMetadataStore {
  saveAnalysis(analysis: CodebaseAnalysis): Promise<string>;
  getAnalysis(id: string): Promise<CodebaseAnalysis | null>;
  listAnalyses(repoPath: string): Promise<AnalysisSummary[]>;
  deleteAnalysis(id: string): Promise<void>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

export interface AnalysisSummary {
  id: string;
  repoPath: string;
  branch: string;
  timestamp: Date;
  fileCount: number;
}
```

### 3. 도구 핸들러 인터페이스 (`src/types/handlers.ts`)
```typescript
export interface IToolHandler<TInput, TOutput> {
  validate(input: unknown): TInput;
  execute(input: TInput): Promise<TOutput>;
  format(output: TOutput): ToolOutput;
}

export abstract class BaseToolHandler<TInput, TOutput> 
  implements IToolHandler<TInput, TOutput> {
  
  abstract validate(input: unknown): TInput;
  abstract execute(input: TInput): Promise<TOutput>;
  
  format(output: TOutput): ToolOutput {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(output, null, 2)
        }
      ]
    };
  }
}
```

### 4. 옵션 및 설정 타입 (`src/types/options.ts`)
```typescript
export interface AnalysisOptions {
  includeTests?: boolean;
  maxFileSize?: number;
  filePatterns?: string[];
  excludePatterns?: string[];
  depth?: 'shallow' | 'deep';
}

export interface CacheOptions {
  ttl?: number;
  namespace?: string;
}

export interface VectorStoreOptions {
  dimension?: number;
  similarity?: 'cosine' | 'euclidean' | 'dot';
}

export interface SecurityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}
```

### 5. 팩토리 패턴 (`src/factories/service-factory.ts`)
```typescript
import { IGitService, IAnalysisService, IAIService } from '../types/services.js';
import { GitService } from '../services/git.service.js';
import { AnalysisService } from '../services/analysis.service.js';
import { AIService } from '../services/ai.service.js';

export class ServiceFactory {
  private static instances = new Map<string, any>();

  static getGitService(repoPath: string): IGitService {
    const key = `git-${repoPath}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new GitService(repoPath));
    }
    return this.instances.get(key);
  }

  static getAnalysisService(): IAnalysisService {
    const key = 'analysis';
    if (!this.instances.has(key)) {
      this.instances.set(key, new AnalysisService());
    }
    return this.instances.get(key);
  }

  static getAIService(apiKey: string): IAIService {
    const key = 'ai';
    if (!this.instances.has(key)) {
      this.instances.set(key, new AIService(apiKey));
    }
    return this.instances.get(key);
  }

  static clearInstances(): void {
    this.instances.clear();
  }
}
```

## 테스트 작성

### 인터페이스 구현 테스트 (`src/__tests__/types/interfaces.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { ServiceFactory } from '../../factories/service-factory.js';

describe('Service Interfaces', () => {
  it('should implement IGitService', () => {
    const gitService = ServiceFactory.getGitService('/test');
    
    expect(gitService.getRepositoryInfo).toBeDefined();
    expect(gitService.analyzeBranchDiff).toBeDefined();
    expect(gitService.getFiles).toBeDefined();
  });

  it('should implement IAnalysisService', () => {
    const analysisService = ServiceFactory.getAnalysisService();
    
    expect(analysisService.analyzeCodebase).toBeDefined();
    expect(analysisService.analyzeFile).toBeDefined();
    expect(analysisService.extractComponents).toBeDefined();
  });
});
```

## 체크리스트
- [ ] 서비스 인터페이스 정의
- [ ] 리포지토리 패턴 인터페이스
- [ ] 도구 핸들러 추상 클래스
- [ ] 옵션 및 설정 타입
- [ ] 서비스 팩토리 구현
- [ ] 인터페이스 테스트 작성

## 커밋 메시지
```
feat: 도메인 인터페이스 및 서비스 계약 정의

- 핵심 서비스 인터페이스 정의
- 리포지토리 패턴 구현
- 도구 핸들러 추상화
- 서비스 팩토리 패턴 적용
```

## 예상 소요 시간
1시간

## 의존성
- 타입 정의 (Task 02)

## 검증 방법
- TypeScript 컴파일 에러 없음
- 인터페이스 구현 테스트 통과