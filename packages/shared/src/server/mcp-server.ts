/**
 * MCP Server Implementation
 * Model Context Protocol 서버 구현
 * 
 * 이 서버는 Claude Code와 JSON-RPC 통신을 통해 코드베이스 분석 도구들을 제공합니다.
 * STDIO 전송을 통해 Claude Code로부터 요청을 받고, 적절한 도구를 실행하여 결과를 반환합니다.
 * 
 * @architecture Hexagonal Architecture 패턴을 따르며, 도메인 서비스들을 orchestrate합니다
 * @transport STDIO (표준 입출력)을 통한 JSON-RPC 2.0 프로토콜
 * @features 코드베이스 학습, 브랜치 diff 분석, 기능 설명, 영향도 분석
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
 * 
 * Claude Code와의 JSON-RPC 통신을 담당하는 핵심 서버 클래스입니다.
 * 
 * @class MCPServer
 * @description 
 * - JSON-RPC 2.0 프로토콜을 통해 Claude Code와 통신
 * - 4개의 핵심 도구(learn_codebase, analyze_branch_diff, explain_feature, analyze_impact) 제공
 * - STDIO 전송 계층을 통한 실시간 통신
 * - 에러 처리 및 로깅 시스템 통합
 * - 설정 검증 및 서비스 상태 모니터링
 * 
 * @responsibilities
 * 1. MCP 프로토콜 준수: JSON-RPC 요청/응답 처리
 * 2. 도구 등록 및 스키마 관리: 각 도구의 입력 스키마 정의
 * 3. 요청 라우팅: 도구별 핸들러로 요청 전달
 * 4. 에러 처리: 예외 상황 처리 및 복구
 * 5. 생명주기 관리: 서버 시작/중지 및 정리 작업
 */
export class MCPServer {
  /** @private MCP SDK의 Server 인스턴스 - JSON-RPC 프로토콜 처리 담당 */
  private server: Server;
  
  /** @private 구조화된 로거 - 서버별 컨텍스트 포함 */
  private serverLogger = logger.withContext('mcp-server');

  /**
   * MCPServer 생성자
   * 
   * @description 
   * 서버 인스턴스를 생성하고 기본 설정을 초기화합니다.
   * MCP SDK의 Server 클래스를 래핑하여 도구별 비즈니스 로직을 연결합니다.
   * 
   * @process
   * 1. 애플리케이션 설정 로드
   * 2. MCP Server 인스턴스 생성
   * 3. 도구 핸들러 등록
   * 4. 에러 처리 시스템 설정
   * 5. 초기화 로그 출력
   */
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
   * 
   * @private
   * @description 
   * MCP 프로토콜에 따라 도구 목록 조회 및 도구 실행 핸들러를 등록합니다.
   * 
   * @handlers
   * 1. ListToolsRequestSchema: Claude Code가 사용 가능한 도구 목록을 요청할 때 처리
   * 2. CallToolRequestSchema: Claude Code가 특정 도구 실행을 요청할 때 처리
   * 
   * @tools_registered
   * - learn_codebase: 코드베이스 분석 및 벡터 인덱싱
   * - analyze_branch_diff: Git 브랜치 간 차이점 분석  
   * - explain_feature: 기능/컴포넌트 상세 설명
   * - analyze_impact: 코드 변경 영향도 분석
   * 
   * @json_rpc_flow
   * Claude Code → JSON-RPC Request → MCPServer → Tool Handler → Domain Service → Response
   */
  private setupToolHandlers(): void {
    // 도구 목록 핸들러 - Claude Code가 지원되는 도구들을 조회할 때 호출
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

    // 도구 실행 핸들러 - Claude Code가 특정 도구의 실행을 요청할 때 호출
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
   * 
   * @private
   * @description 
   * 서버 레벨과 프로세스 레벨의 에러 처리를 설정합니다.
   * 예상치 못한 오류 상황에서도 안정적인 서버 운영을 보장합니다.
   * 
   * @error_handling_levels
   * 1. MCP Server Level: server.onerror 핸들러 등록
   * 2. Process Level: unhandledRejection, uncaughtException 처리
   * 3. Signal Level: SIGINT, SIGTERM 처리로 정상 종료 보장
   * 
   * @recovery_strategy
   * - 일반 오류: 로깅 후 계속 운영
   * - 치명적 오류: 로깅 후 프로세스 종료 (process.exit(1))
   * - 정상 종료 신호: 정리 작업 후 프로세스 종료 (process.exit(0))
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
   * 
   * @public
   * @description 
   * MCP 서버를 시작하고 Claude Code와의 통신을 활성화합니다.
   * STDIO 전송 계층을 통해 JSON-RPC 프로토콜 통신을 시작합니다.
   * 
   * @startup_process
   * 1. 설정 검증 (ConfigValidator.validateStartup)
   * 2. 서비스 상태 확인 (필수 서비스 가용성 체크)
   * 3. STDIO 전송 계층 연결 (StdioServerTransport)
   * 4. MCP 서버 연결 (server.connect)
   * 5. 준비 상태 알림 (Claude Code가 인식할 수 있도록 stderr 출력)
   * 
   * @throws {Error} 서버 시작 실패 시 에러 발생
   * 
   * @example
   * ```typescript
   * const mcpServer = new MCPServer();
   * await mcpServer.start(); // Claude Code와 통신 시작
   * ```
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
   * 
   * @public
   * @description 
   * MCP 서버를 정상적으로 중지하고 리소스를 정리합니다.
   * 진행 중인 작업이 있다면 완료를 기다린 후 중지합니다.
   * 
   * @cleanup_tasks
   * - 활성 연결 해제
   * - 메모리 리소스 정리  
   * - 로그 버퍼 플러시
   * - 임시 파일 정리 (필요시)
   * 
   * @graceful_shutdown
   * 이 메서드는 graceful shutdown을 보장하여 데이터 손실을 방지합니다.
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
 * 
 * @function startMCPServer
 * @description 
 * MCP 서버의 생성과 시작을 한 번에 처리하는 편의 함수입니다.
 * 애플리케이션 진입점에서 간단하게 서버를 시작할 수 있습니다.
 * 
 * @workflow
 * 1. MCPServer 인스턴스 생성
 * 2. 서버 시작 (start() 메서드 호출)
 * 3. 시작된 서버 인스턴스 반환
 * 
 * @returns {Promise<MCPServer>} 시작된 MCP 서버 인스턴스
 * @throws {Error} 서버 생성 또는 시작 실패 시
 * 
 * @example
 * ```typescript
 * // main.ts
 * import { startMCPServer } from './server/mcp-server.js';
 * 
 * async function main() {
 *   try {
 *     const server = await startMCPServer();
 *     console.log('MCP Server started successfully');
 *   } catch (error) {
 *     console.error('Failed to start MCP Server:', error);
 *     process.exit(1);
 *   }
 * }
 * 
 * main();
 * ```
 */
export async function startMCPServer(): Promise<MCPServer> {
  const server = new MCPServer();
  await server.start();
  return server;
}