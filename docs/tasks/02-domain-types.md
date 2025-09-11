# Task 02: 도메인 타입 정의

## 목표
코드베이스 분석을 위한 핵심 TypeScript 타입 정의

## 작업 내용

### 1. Git 관련 타입 (`src/types/git.ts`)
```typescript
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
```

### 2. 코드 분석 타입 (`src/types/analysis.ts`)
```typescript
export interface CodeComponent {
  id: string;
  name: string;
  type: 'class' | 'function' | 'interface' | 'module' | 'component';
  filePath: string;
  lineStart: number;
  lineEnd: number;
  description?: string;
  dependencies: string[];
}

export interface FileAnalysis {
  filePath: string;
  language: string;
  components: CodeComponent[];
  imports: string[];
  exports: string[];
  complexity: number;
  linesOfCode: number;
}

export interface CodebaseAnalysis {
  repository: Repository;
  timestamp: Date;
  files: FileAnalysis[];
  statistics: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
    componentCount: Record<string, number>;
  };
}

export interface ImpactAnalysis {
  change: string;
  affectedFiles: string[];
  directImpact: CodeComponent[];
  indirectImpact: CodeComponent[];
  riskLevel: 'low' | 'medium' | 'high';
  suggestions: string[];
}
```

### 3. MCP 프로토콜 타입 (`src/types/mcp.ts`)
```typescript
export interface ToolInput<T = any> {
  name: string;
  arguments: T;
}

export interface ToolOutput<T = any> {
  content: T[];
  isError?: boolean;
}

// Tool specific inputs
export interface LearnCodebaseInput {
  repoPath: string;
  branch?: string;
  includeTests?: boolean;
  maxFileSize?: number;
}

export interface AnalyzeDiffInput {
  repoPath: string;
  baseBranch: string;
  targetBranch: string;
}

export interface ExplainFeatureInput {
  featureId: string;
  includeCodeExamples?: boolean;
  depth?: 'basic' | 'detailed';
}

export interface AnalyzeImpactInput {
  changeDescription: string;
  affectedFiles: string[];
  analysisDepth?: 'basic' | 'deep';
}
```

### 4. 설정 타입 (`src/types/config.ts`)
```typescript
export interface SecurityConfig {
  maxFileSize: number;
  allowedPaths: string[];
  excludedPaths: string[];
  enableAuditLog: boolean;
}

export interface MCPServerConfig {
  name: string;
  version: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  openaiApiKey?: string;
  githubToken?: string;
}
```

### 5. 에러 타입 (`src/types/errors.ts`)
```typescript
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class GitOperationError extends MCPError {
  constructor(message: string, public operation?: string) {
    super(message, 'GIT_OPERATION_ERROR', 500);
  }
}

export class AIServiceError extends MCPError {
  constructor(message: string, public service?: string) {
    super(message, 'AI_SERVICE_ERROR', 503);
  }
}
```

## 테스트 작성

### 타입 검증 테스트 (`src/__tests__/types/validation.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { LearnCodebaseInput } from '../../types/mcp';

const LearnCodebaseInputSchema = z.object({
  repoPath: z.string().min(1),
  branch: z.string().optional(),
  includeTests: z.boolean().optional(),
  maxFileSize: z.number().positive().optional()
});

describe('Type Validation', () => {
  it('should validate LearnCodebaseInput', () => {
    const validInput: LearnCodebaseInput = {
      repoPath: '/path/to/repo',
      branch: 'main'
    };
    
    expect(() => 
      LearnCodebaseInputSchema.parse(validInput)
    ).not.toThrow();
  });
  
  it('should reject invalid input', () => {
    const invalidInput = { repoPath: '' };
    
    expect(() => 
      LearnCodebaseInputSchema.parse(invalidInput)
    ).toThrow();
  });
});
```

## 체크리스트
- [ ] Git 관련 타입 정의
- [ ] 코드 분석 타입 정의
- [ ] MCP 프로토콜 타입 정의
- [ ] 설정 타입 정의
- [ ] 에러 타입 정의
- [ ] 타입 검증 테스트 작성
- [ ] TSDoc 주석 추가

## 커밋 메시지
```
feat: 도메인 타입 정의 추가

- Git, 분석, MCP 프로토콜 타입 정의
- 커스텀 에러 클래스 구현
- Zod를 통한 런타임 타입 검증
```

## 예상 소요 시간
1시간

## 의존성
- zod (런타임 타입 검증)

## 검증 방법
- TypeScript 컴파일 에러 없음
- 타입 검증 테스트 통과