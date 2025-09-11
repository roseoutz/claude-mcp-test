#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ToolDefinition, ToolResult, ServerInfo, ServerCapabilities } from './types/mcp.js';
import { handleLearnCodebase } from './tools/learn-codebase.js';
import { handleAnalyzeBranchDiff } from './tools/analyze-branch-diff.js';
import { handleExplainFeature } from './tools/explain-feature.js';
import { handleAnalyzeImpact } from './tools/analyze-impact.js';

// 서버 정보 설정
const SERVER_INFO: ServerInfo = {
  name: 'code-ai-mcp-node',
  version: '1.0.0',
};

const SERVER_CAPABILITIES: ServerCapabilities = {
  tools: {},
};

// 도구 정의
const TOOLS: ToolDefinition[] = [
  {
    name: 'learn_codebase',
    description: '코드베이스를 학습하고 인덱싱합니다',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: {
          type: 'string',
          description: '분석할 Git 레포지토리의 절대 경로',
        },
        branch: {
          type: 'string',
          description: '분석할 브랜치명',
          default: 'main',
        },
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
        repoPath: {
          type: 'string',
          description: 'Git 레포지토리의 절대 경로',
        },
        baseBranch: {
          type: 'string',
          description: '기준이 되는 브랜치명',
        },
        targetBranch: {
          type: 'string',
          description: '비교할 대상 브랜치명',
        },
      },
      required: ['repoPath', 'baseBranch', 'targetBranch'],
    },
  },
  {
    name: 'explain_feature',
    description: '특정 기능에 대한 상세한 설명을 제공합니다',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: '설명할 기능의 식별자',
        },
        includeCodeExamples: {
          type: 'boolean',
          description: '코드 예시 포함 여부',
          default: false,
        },
      },
      required: ['featureId'],
    },
  },
  {
    name: 'analyze_impact',
    description: '코드 변경이 시스템에 미치는 영향을 분석합니다',
    inputSchema: {
      type: 'object',
      properties: {
        changeDescription: {
          type: 'string',
          description: '변경사항에 대한 설명',
        },
        affectedFiles: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: '영향받는 파일 경로 목록',
        },
        analysisDepth: {
          type: 'string',
          enum: ['basic', 'deep'],
          description: '분석 깊이',
          default: 'basic',
        },
      },
      required: ['changeDescription', 'affectedFiles'],
    },
  },
];

class MCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(SERVER_INFO, SERVER_CAPABILITIES);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 도구 목록 조회 핸들러
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS };
    });

    // 도구 실행 핸들러
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        let result: ToolResult;

        switch (name) {
          case 'learn_codebase':
            result = await handleLearnCodebase(args);
            break;

          case 'analyze_branch_diff':
            result = await handleAnalyzeBranchDiff(args);
            break;

          case 'explain_feature':
            result = await handleExplainFeature(args);
            break;

          case 'analyze_impact':
            result = await handleAnalyzeImpact(args);
            break;

          default:
            throw new Error(`알 수 없는 도구: ${name}`);
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
        
        // 에러를 stderr에 로깅 (STDIO 통신에 영향 주지 않음)
        console.error(`[ERROR] Tool ${name} failed:`, errorMessage);
        
        return {
          content: [
            {
              type: 'text',
              text: `오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    
    // 에러 핸들링
    process.on('uncaughtException', (error) => {
      console.error('[FATAL] Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('[FATAL] Unhandled rejection:', reason);
      process.exit(1);
    });

    // 서버 시작
    try {
      await this.server.connect(transport);
      console.error('[INFO] MCP Server started successfully'); // stderr에 로깅
    } catch (error) {
      console.error('[FATAL] Failed to start MCP server:', error);
      process.exit(1);
    }
  }
}

// 서버 실행
const server = new MCPServer();
server.run().catch((error) => {
  console.error('[FATAL] Server startup failed:', error);
  process.exit(1);
});