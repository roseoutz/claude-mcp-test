#!/usr/bin/env node

/**
 * Local MCP Server Entry Point
 * 
 * Claude Code에 연결할 로컬 MCP 서버의 실행 진입점입니다.
 * @code-ai/shared 패키지의 MCP 서버를 단순히 실행하는 wrapper 역할을 합니다.
 * 
 * 사용법:
 * - Claude Code에서 MCP 서버로 연결: 이 파일을 직접 실행
 * - 개발 모드: npm run dev
 * - 프로덕션: npm run build && npm start
 */

import { startMCPServer } from '@code-ai/shared/server/mcp-server.js';

/**
 * 메인 함수
 * MCP 서버를 시작하고 에러 처리를 담당합니다.
 */
async function main(): Promise<void> {
  try {
    // @code-ai/shared에서 MCP 서버 시작
    const server = await startMCPServer();
    
    // 서버 시작 로그를 stderr에 출력 (Claude Code가 인식)
    console.error('🚀 Local MCP Server started successfully');
    console.error('📡 Ready to receive commands from Claude Code');

    // 프로세스 종료 신호 처리
    process.on('SIGINT', async () => {
      console.error('📴 Shutting down Local MCP Server...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('📴 Shutting down Local MCP Server...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start Local MCP Server:', error);
    process.exit(1);
  }
}

// 메인 함수 실행
main().catch((error) => {
  console.error('💥 Unhandled error in Local MCP Server:', error);
  process.exit(1);
});