#!/bin/bash

# local-mcp 개발 모드 실행 스크립트
# Development mode script for local-mcp

echo "🚀 Starting Local MCP Server in Development Mode..."
echo "=================================================="

cd "$(dirname "$0")/../packages/local-mcp"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}📦 Package: @code-ai/local-mcp${NC}"
echo -e "${BLUE}🔧 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🔍 Checking environment...${NC}"
if [ -z "${OPENAI_API_KEY}" ]; then
    echo -e "${YELLOW}⚠️  OPENAI_API_KEY not set. Some features may not work.${NC}"
fi

if [ -z "${GITHUB_TOKEN}" ]; then
    echo -e "${YELLOW}⚠️  GITHUB_TOKEN not set. Some features may not work.${NC}"
fi

echo -e "${BLUE}🚀 Starting development server with hot reload...${NC}"
echo -e "${YELLOW}💡 Connect this server to Claude Code using path:${NC}"
echo -e "   $(pwd)/src/index.ts (with tsx)"
echo ""
echo -e "${YELLOW}💡 Press Ctrl+C to stop the development server${NC}"
echo ""

# tsx를 사용한 개발 모드 실행
npm run dev