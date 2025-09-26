#!/bin/bash

# local-mcp 서버 종료 스크립트
# Stop script for local-mcp server

echo "🛑 Stopping Local MCP Server..."
echo "==============================="

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PID_FILE="/tmp/local-mcp.pid"

if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}⚠️  No PID file found. Local MCP Server may not be running.${NC}"
    exit 1
fi

PID=$(cat "$PID_FILE")

if ! ps -p $PID > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Process with PID $PID is not running.${NC}"
    rm -f "$PID_FILE"
    echo -e "${GREEN}✅ Cleaned up stale PID file.${NC}"
    exit 0
fi

echo -e "${YELLOW}📴 Stopping Local MCP Server (PID: $PID)...${NC}"

# SIGTERM으로 정상 종료 시도
kill -TERM $PID

# 최대 10초 대기
for i in {1..10}; do
    if ! ps -p $PID > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Local MCP Server stopped gracefully.${NC}"
        rm -f "$PID_FILE"
        exit 0
    fi
    sleep 1
done

# 여전히 실행 중이면 강제 종료
echo -e "${RED}⚠️  Server didn't stop gracefully, forcing shutdown...${NC}"
kill -KILL $PID

# 강제 종료 확인
sleep 1
if ! ps -p $PID > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Local MCP Server forcefully stopped.${NC}"
    rm -f "$PID_FILE"
else
    echo -e "${RED}❌ Failed to stop Local MCP Server.${NC}"
    exit 1
fi