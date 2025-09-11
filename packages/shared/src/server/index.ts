#!/usr/bin/env node

/**
 * MCP Server Entry Point
 * 서버를 시작하는 메인 진입점
 */

import { startMCPServer } from './mcp-server.js';
import { logger } from '../utils/logger.js';

/**
 * 메인 함수
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting Code AI MCP Server...');
    
    const server = await startMCPServer();
    
    // 프로세스가 종료되지 않도록 유지
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down...');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down...');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// 스크립트가 직접 실행된 경우에만 서버 시작
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { startMCPServer, MCPServer } from './mcp-server.js';