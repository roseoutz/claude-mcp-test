# Task 06: MCP 서버 구현

## 목표
Model Context Protocol 서버 구현 및 도구 등록

## 작업 내용

### 1. MCP 서버 초기화 (`src/server.ts`)
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handleLearnCodebase } from './tools/learn-codebase.js';
import { handleAnalyzeDiff } from './tools/analyze-diff.js';
import { handleExplainFeature } from './tools/explain-feature.js';
import { handleAnalyzeImpact } from './tools/analyze-impact.js';

async function main() {
  const server = new Server(
    {
      name: 'code-ai-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 도구 목록 등록
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'learn_codebase',
        description: '코드베이스를 학습하고 인덱싱합니다',
        inputSchema: {
          type: 'object',
          properties: {
            repoPath: { 
              type: 'string',
              description: '분석할 레포지토리 경로'
            },
            branch: { 
              type: 'string',
              description: '분석할 브랜치 (기본값: main)'
            },
            includeTests: {
              type: 'boolean',
              description: '테스트 파일 포함 여부'
            },
            maxFileSize: {
              type: 'number',
              description: '최대 파일 크기 (바이트)'
            }
          },
          required: ['repoPath'],
        },
      },
      {
        name: 'analyze_branch_diff',
        description: '브랜치 간 차이점을 분석합니다',
        inputSchema: {
          type: 'object',
          properties: {
            repoPath: { type: 'string' },
            baseBranch: { type: 'string' },
            targetBranch: { type: 'string' },
          },
          required: ['repoPath', 'baseBranch', 'targetBranch'],
        },
      },
      {
        name: 'explain_feature',
        description: '특정 기능에 대한 설명을 제공합니다',
        inputSchema: {
          type: 'object',
          properties: {
            featureId: { type: 'string' },
            includeCodeExamples: { type: 'boolean' },
            depth: { 
              type: 'string',
              enum: ['basic', 'detailed']
            },
          },
          required: ['featureId'],
        },
      },
      {
        name: 'analyze_impact',
        description: '코드 변경의 영향도를 분석합니다',
        inputSchema: {
          type: 'object',
          properties: {
            changeDescription: { type: 'string' },
            affectedFiles: {
              type: 'array',
              items: { type: 'string' }
            },
            analysisDepth: {
              type: 'string',
              enum: ['basic', 'deep']
            },
          },
          required: ['changeDescription', 'affectedFiles'],
        },
      },
    ],
  }));

  // 도구 실행 핸들러
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'learn_codebase':
          return await handleLearnCodebase(args);
        
        case 'analyze_branch_diff':
          return await handleAnalyzeDiff(args);
        
        case 'explain_feature':
          return await handleExplainFeature(args);
        
        case 'analyze_impact':
          return await handleAnalyzeImpact(args);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // 서버 시작
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('MCP server started successfully');
}

// 에러 핸들링
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

### 2. 도구 응답 포맷터 (`src/utils/formatter.ts`)
```typescript
import { ToolOutput } from '../types/mcp.js';

export function formatToolResponse<T>(
  data: T,
  type: 'text' | 'json' = 'json'
): ToolOutput<T> {
  if (type === 'text') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  return {
    content: [data],
  };
}

export function formatErrorResponse(error: Error): ToolOutput {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${error.message}`,
      },
    ],
    isError: true,
  };
}
```

### 3. 로깅 미들웨어 (`src/utils/logger.ts`)
```typescript
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  debug(message: string, data?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      console.error('[DEBUG]', message, data ? JSON.stringify(data) : '');
    }
  }

  info(message: string, data?: any): void {
    if (this.level <= LogLevel.INFO) {
      console.error('[INFO]', message, data ? JSON.stringify(data) : '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.level <= LogLevel.WARN) {
      console.error('[WARN]', message, data ? JSON.stringify(data) : '');
    }
  }

  error(message: string, error?: Error): void {
    if (this.level <= LogLevel.ERROR) {
      console.error('[ERROR]', message, error?.stack || error?.message || '');
    }
  }
}

export const logger = new Logger(
  process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO
);
```

### 4. 테스트 작성

#### MCP 서버 통합 테스트 (`src/__tests__/integration/mcp-server.test.ts`)
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('MCP Server Integration', () => {
  let serverProcess: ChildProcess;

  beforeAll(async () => {
    const serverPath = path.join(__dirname, '../../server.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  });

  afterAll(() => {
    serverProcess.kill();
  });

  it('should respond to initialize request', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    };

    serverProcess.stdin?.write(JSON.stringify(request) + '\n');

    const response = await new Promise((resolve) => {
      serverProcess.stdout?.once('data', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('protocolVersion');
  });

  it('should list available tools', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    };

    serverProcess.stdin?.write(JSON.stringify(request) + '\n');

    const response = await new Promise((resolve) => {
      serverProcess.stdout?.once('data', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(response.result.tools).toHaveLength(4);
    expect(response.result.tools[0].name).toBe('learn_codebase');
  });
});
```

## 체크리스트
- [ ] MCP 서버 초기화 구현
- [ ] 도구 등록 핸들러 구현
- [ ] 도구 실행 핸들러 구현
- [ ] 응답 포맷터 구현
- [ ] 로깅 시스템 구현
- [ ] 에러 핸들링 구현
- [ ] 통합 테스트 작성
- [ ] Claude Desktop 연동 테스트

## 커밋 메시지
```
feat: MCP 서버 구현 및 도구 등록

- @modelcontextprotocol/sdk 기반 서버 구현
- 4개 도구 등록 및 핸들러 설정
- STDIO transport 통신 구현
- 로깅 및 에러 핸들링 추가
```

## 예상 소요 시간
2시간

## 의존성
- @modelcontextprotocol/sdk

## 검증 방법
- 서버 시작 성공
- tools/list 요청 응답 확인
- Claude Desktop 연동 테스트
- 통합 테스트 통과