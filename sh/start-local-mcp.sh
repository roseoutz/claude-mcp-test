#!/bin/bash

# local-mcp 서버 시작 스크립트
# Start script for local-mcp server

set -e

echo "🚀 Starting Local MCP Server..."
echo "==============================="

cd "$(dirname "$0")/../packages/local-mcp"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 환경 변수 체크
check_env() {
    if [ -z "${OPENAI_API_KEY}" ]; then
        echo -e "${YELLOW}⚠️  OPENAI_API_KEY not set. Some features may not work.${NC}"
    fi
    
    if [ -z "${GITHUB_TOKEN}" ]; then
        echo -e "${YELLOW}⚠️  GITHUB_TOKEN not set. Some features may not work.${NC}"
    fi
}

# PID 파일 관리
PID_FILE="/tmp/local-mcp.pid"

# 실행 중인 서버 체크
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Local MCP Server is already running (PID: $PID)${NC}"
        echo "Use './sh/stop-local-mcp.sh' to stop it first."
        exit 1
    else
        # 스테일 PID 파일 제거
        rm -f "$PID_FILE"
    fi
fi

echo -e "${BLUE}🔧 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🏗️  Building project...${NC}"
npm run build

echo -e "${BLUE}🔍 Checking environment...${NC}"
check_env

echo -e "${BLUE}📡 Starting MCP Server...${NC}"
echo -e "${YELLOW}💡 Connect this server to Claude Code using path:${NC}"
echo -e "   $(pwd)/dist/index.js"
echo ""
echo -e "${YELLOW}💡 To stop the server, use: ./sh/stop-local-mcp.sh${NC}"
echo -e "${YELLOW}💡 To restart the server, use: ./sh/restart-local-mcp.sh${NC}"
echo ""
echo -e "${GREEN}✅ Server starting...${NC}"

# 백그라운드에서 실행하고 PID 저장
npm start &
echo $! > "$PID_FILE"

echo -e "${GREEN}🎉 Local MCP Server started successfully!${NC}"
echo -e "PID: $(cat $PID_FILE)"