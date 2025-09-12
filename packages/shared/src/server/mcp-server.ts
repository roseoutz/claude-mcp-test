/**
 * MCP Server Implementation
 * Model Context Protocol 서버 구현
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

import { ApplicationConfig } from '../config/app.config.js';
import { logger } from '../utils/logger.js';
import { createErrorResponse } from '../utils/mcp-formatter.js';
import { ConfigValidator } from '../utils/config-validator.js';

// Tool handlers
import {
  handleLearnCodebase,
  handleAnalyzeDiff,
  handleExplainFeature,
  handleAnalyzeImpact
} from '../tools/index.js';

/**
 * MCP 서버 클래스
 */
export class MCPServer {
  private server: Server;
  private serverLogger = logger.withContext('mcp-server');

  constructor() {
    // 서버 설정
    const mcpConfig = ApplicationConfig.getMCPServerConfig();
    const appConfig = ApplicationConfig.getAppConfig();

    this.server = new Server(
      {
        name: mcpConfig.name,
        version: mcpConfig.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        }
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
    
    this.serverLogger.info('MCP Server initialized', {
      name: mcpConfig.name,
      version: mcpConfig.version,
      environment: appConfig.env
    });
  }

  /**
   * 도구 핸들러 설정
   */
  private setupToolHandlers(): void {
    // 도구 목록 핸들러
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.serverLogger.debug('Listing available tools');
      
      const tools: Tool[] = [
        {
          name: 'learn_codebase',
          description: '코드베이스를 분석하고 벡터 스토어에 인덱싱합니다',
          inputSchema: {
            type: 'object',
            properties: {
              repoPath: { 
                type: 'string',
                description: '분석할 레포지토리의 절대 경로'
              },
              branch: { 
                type: 'string',
                description: '분석할 브랜치 이름 (기본값: main)',
                default: 'main'
              },
              includeTests: {
                type: 'boolean',
                description: '테스트 파일 포함 여부 (기본값: false)',
                default: false
              },
              maxFileSize: {
                type: 'number',
                description: '분석할 최대 파일 크기 (바이트, 기본값: 1MB)',
                default: 1048576
              },
              filePatterns: {
                type: 'array',
                items: { type: 'string' },
                description: '포함할 파일 패턴 (정규표현식)'
              },
              excludePatterns: {
                type: 'array',
                items: { type: 'string' },
                description: '제외할 파일 패턴 (정규표현식)'
              }
            },
            required: ['repoPath'],
          },
        },
        {
          name: 'analyze_branch_diff',
          description: '두 브랜치 간의 차이점을 분석하고 변경 사항을 요약합니다',
          inputSchema: {
            type: 'object',
            properties: {
              repoPath: { 
                type: 'string',
                description: 'Git 저장소의 절대 경로'
              },
              baseBranch: { 
                type: 'string',
                description: '비교 기준이 되는 브랜치'
              },
              targetBranch: { 
                type: 'string',
                description: '비교 대상 브랜치'
              },
              includeStats: {
                type: 'boolean',
                description: '통계 정보 포함 여부 (기본값: true)',
                default: true
              },
              contextLines: {
                type: 'number',
                description: '컨텍스트 라인 수 (기본값: 3)',
                default: 3,
                minimum: 0,
                maximum: 10
              }
            },
            required: ['repoPath', 'baseBranch', 'targetBranch'],
          },
        },
        {
          name: 'explain_feature',
          description: '특정 기능이나 컴포넌트에 대한 상세한 설명을 제공합니다',
          inputSchema: {
            type: 'object',
            properties: {
              featureId: { 
                type: 'string',
                description: '설명할 기능이나 컴포넌트의 이름 또는 식별자'
              },
              includeCodeExamples: {
                type: 'boolean',
                description: '코드 예제 포함 여부 (기본값: true)',
                default: true
              },
              depth: { 
                type: 'string',
                enum: ['basic', 'detailed', 'comprehensive'],
                description: '설명의 상세 수준 (기본값: basic)',
                default: 'basic'
              },
              format: {
                type: 'string',
                enum: ['markdown', 'plain', 'json'],
                description: '응답 형식 (기본값: markdown)',
                default: 'markdown'
              }
            },
            required: ['featureId'],
          },
        },
        {
          name: 'analyze_impact',
          description: '코드 변경이 시스템에 미치는 영향도를 분석합니다',
          inputSchema: {
            type: 'object',
            properties: {
              changeDescription: { 
                type: 'string',
                description: '변경 사항에 대한 설명'
              },
              affectedFiles: {
                type: 'array',
                items: { type: 'string' },
                description: '직접적으로 영향받는 파일들의 경로 목록'
              },
              analysisDepth: {
                type: 'string',
                enum: ['basic', 'deep', 'comprehensive'],
                description: '분석 깊이 (기본값: basic)',
                default: 'basic'
              },
              includeTests: {
                type: 'boolean',
                description: '테스트 파일 영향도 포함 여부 (기본값: true)',
                default: true
              },
              includeDependencies: {
                type: 'boolean',
                description: '의존성 분석 포함 여부 (기본값: true)',
                default: true
              }
            },
            required: ['changeDescription', 'affectedFiles'],
          },
        },
      ];

      return { tools };
    });

    // 도구 실행 핸들러
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      this.serverLogger.info(`Executing tool: ${name}`, { args });
      const timer = this.serverLogger.startTimer(`tool-${name}`);

      try {
        let result: CallToolResult;

        switch (name) {
          case 'learn_codebase':
            result = await handleLearnCodebase(args as any);
            break;
          
          case 'analyze_branch_diff':
            result = await handleAnalyzeDiff(args as any);
            break;
          
          case 'explain_feature':
            result = await handleExplainFeature(args as any);
            break;
          
          case 'analyze_impact':
            result = await handleAnalyzeImpact(args as any);
            break;
          
          default:
            this.serverLogger.warn(`Unknown tool requested: ${name}`);
            result = createErrorResponse(`Unknown tool: ${name}`);
        }

        timer();
        
        if (result.isError) {
          this.serverLogger.warn(`Tool execution failed: ${name}`, { result });
        } else {
          this.serverLogger.info(`Tool execution completed: ${name}`);
        }

        return result;

      } catch (error) {
        timer();
        this.serverLogger.error(`Tool execution error: ${name}`, error as Error, { args });
        return createErrorResponse(error as Error);
      }
    });
  }

  /**
   * 에러 핸들링 설정
   */
  private setupErrorHandling(): void {
    // 서버 레벨 에러 핸들링
    this.server.onerror = (error) => {
      this.serverLogger.error('MCP Server error', error);
    };

    // 프로세스 레벨 에러 핸들링
    process.on('unhandledRejection', (reason, promise) => {
      this.serverLogger.error('Unhandled Rejection', new Error(String(reason)), {
        promise: promise.toString()
      });
    });

    process.on('uncaughtException', (error) => {
      this.serverLogger.error('Uncaught Exception', error);
      // 치명적 에러인 경우 프로세스 종료
      process.exit(1);
    });

    // 정상 종료 처리
    process.on('SIGINT', () => {
      this.serverLogger.info('Received SIGINT, shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.serverLogger.info('Received SIGTERM, shutting down gracefully');
      process.exit(0);
    });
  }

  /**
   * 서버 시작
   */
  async start(): Promise<void> {
    try {
      // 설정 검증
      ConfigValidator.setLogger(this.serverLogger);
      ConfigValidator.validateStartup();
      
      // 서비스 상태 확인
      const serviceCheck = ConfigValidator.checkRequiredServices();
      if (serviceCheck.missing.length > 0) {
        this.serverLogger.warn('Some services are not available', {
          missing: serviceCheck.missing
        });
      }

      // STDIO 전송 계층으로 연결
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.serverLogger.info('MCP Server started successfully', {
        transport: 'stdio',
        pid: process.pid,
        nodeVersion: process.version
      });

      // 서버 준비 상태를 stderr에 출력 (Claude가 볼 수 있도록)
      console.error('🚀 Code AI MCP Server is ready');
      
    } catch (error) {
      this.serverLogger.error('Failed to start MCP server', error as Error);
      throw error;
    }
  }

  /**
   * 서버 중지
   */
  async stop(): Promise<void> {
    try {
      // 정리 작업이 필요하다면 여기서 수행
      this.serverLogger.info('MCP Server stopped');
    } catch (error) {
      this.serverLogger.error('Error stopping MCP server', error as Error);
    }
  }
}

/**
 * 서버 인스턴스 생성 및 시작 함수
 */
export async function startMCPServer(): Promise<MCPServer> {
  const server = new MCPServer();
  await server.start();
  return server;
}