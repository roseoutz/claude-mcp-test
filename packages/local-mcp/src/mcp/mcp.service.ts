import { Injectable } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GrpcClientService } from '../grpc/grpc-client.service';
import simpleGit from 'simple-git';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class McpService {
  private server: Server;
  private git = simpleGit();

  constructor(private readonly grpcClient: GrpcClientService) {
    this.initializeMcpServer();
  }

  private initializeMcpServer() {
    this.server = new Server(
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

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'learn-codebase',
          description: 'Learn and analyze a Git repository codebase',
          inputSchema: {
            type: 'object',
            properties: {
              repository: {
                type: 'string',
                description: 'Path to the Git repository',
              },
              branch: {
                type: 'string',
                description: 'Git branch to analyze',
              },
              patterns: {
                type: 'array',
                items: { type: 'string' },
                description: 'File patterns to include',
              },
            },
            required: ['repository'],
          },
        },
        {
          name: 'search-code',
          description: 'Search code with semantic understanding',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              semantic: {
                type: 'boolean',
                description: 'Use AI-powered semantic search',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'analyze-diff',
          description: 'Analyze differences between branches',
          inputSchema: {
            type: 'object',
            properties: {
              baseBranch: {
                type: 'string',
                description: 'Base branch for comparison',
              },
              targetBranch: {
                type: 'string',
                description: 'Target branch to compare',
              },
              includeImpact: {
                type: 'boolean',
                description: 'Include impact analysis',
              },
            },
            required: ['baseBranch', 'targetBranch'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'learn-codebase':
          return await this.handleLearnCodebase(args);
        case 'search-code':
          return await this.handleSearchCode(args);
        case 'analyze-diff':
          return await this.handleAnalyzeDiff(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async handleLearnCodebase(args: any) {
    try {
      const { repository, branch = 'main', patterns = ['**/*.{js,ts,jsx,tsx}'] } = args;

      // 로컬에서 파일 정보 수집
      const files = await glob(patterns, {
        cwd: repository,
        ignore: ['node_modules/**', 'dist/**', '.git/**'],
      });

      const fileStats = await Promise.all(
        files.slice(0, 100).map(async (file) => {
          const filePath = path.join(repository, file);
          const stats = await fs.stat(filePath);
          return {
            path: file,
            size: stats.size,
          };
        })
      );

      // gRPC를 통해 AWS 서버에 학습 요청
      const response = await this.grpcClient.learnCodebase(repository, branch, patterns);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sessionId: response.session_id,
              localFiles: fileStats.length,
              totalSize: fileStats.reduce((sum, f) => sum + f.size, 0),
              message: response.message,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleSearchCode(args: any) {
    try {
      const { query, semantic = false } = args;
      
      // 임시 세션 ID 생성
      const sessionId = `search_${Date.now()}`;
      
      const results: any[] = [];
      
      // gRPC 스트리밍으로 검색 결과 받기
      return new Promise((resolve) => {
        const subscription = this.grpcClient
          .searchCode(sessionId, query, semantic)
          .subscribe({
            next: (result) => {
              results.push(result);
            },
            error: (error) => {
              resolve({
                content: [
                  {
                    type: 'text',
                    text: `Error: ${error.message}`,
                  },
                ],
              });
            },
            complete: () => {
              resolve({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      query,
                      semantic,
                      results,
                      totalResults: results.length,
                    }, null, 2),
                  },
                ],
              });
            },
          });
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleAnalyzeDiff(args: any) {
    try {
      const { baseBranch, targetBranch, includeImpact = false } = args;
      
      // 임시 세션 ID 생성
      const sessionId = `diff_${Date.now()}`;
      
      const diffResults: any[] = [];
      
      // gRPC 스트리밍으로 diff 분석 결과 받기
      return new Promise((resolve) => {
        const subscription = this.grpcClient
          .analyzeDiff(sessionId, baseBranch, targetBranch, includeImpact)
          .subscribe({
            next: (result) => {
              diffResults.push(result);
            },
            error: (error) => {
              resolve({
                content: [
                  {
                    type: 'text',
                    text: `Error: ${error.message}`,
                  },
                ],
              });
            },
            complete: () => {
              resolve({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      baseBranch,
                      targetBranch,
                      includeImpact,
                      changes: diffResults,
                      totalFiles: diffResults.length,
                    }, null, 2),
                  },
                ],
              });
            },
          });
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  async startMcpServer() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('MCP Server started on stdio');
  }
}