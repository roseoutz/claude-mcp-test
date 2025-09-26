#!/bin/bash

# aws-api 서버 재시작 스크립트
# Restart script for aws-api server

echo "🔄 Restarting AWS API Server..."
echo "==============================="

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 현재 스크립트의 디렉토리 경로
SCRIPT_DIR="$(dirname "$0")"

echo -e "${YELLOW}1️⃣  Stopping existing server...${NC}"
"$SCRIPT_DIR/stop-aws-api.sh" || echo -e "${YELLOW}⚠️  No running server to stop${NC}"

echo -e "\n${YELLOW}2️⃣  Waiting for cleanup...${NC}"
sleep 2

echo -e "\n${YELLOW}3️⃣  Starting server...${NC}"
"$SCRIPT_DIR/start-aws-api.sh"

echo -e "\n${GREEN}🎉 AWS API Server restarted successfully!${NC}"