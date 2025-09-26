#!/bin/bash

# aws-api 서버 시작 스크립트
# Start script for aws-api server

set -e

echo "🚀 Starting AWS API Server..."
echo "============================="

cd "$(dirname "$0")/../packages/aws-api"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 환경 변수 체크
check_env() {
    local missing_vars=()
    
    [ -z "${OPENAI_API_KEY}" ] && missing_vars+=("OPENAI_API_KEY")
    [ -z "${AWS_REGION}" ] && missing_vars+=("AWS_REGION")
    [ -z "${S3_BUCKET}" ] && missing_vars+=("S3_BUCKET")
    [ -z "${DYNAMODB_TABLE}" ] && missing_vars+=("DYNAMODB_TABLE")
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing required environment variables:${NC}"
        for var in "${missing_vars[@]}"; do
            echo -e "   - ${var}"
        done
        echo -e "${YELLOW}💡 Please set these variables or create a .env file${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ All required environment variables are set${NC}"
    return 0
}

# PID 파일 관리
PID_FILE="/tmp/aws-api.pid"

# 실행 중인 서버 체크
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  AWS API Server is already running (PID: $PID)${NC}"
        echo "Use './sh/stop-aws-api.sh' to stop it first."
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
if ! check_env; then
    echo -e "${YELLOW}⚠️  Continuing with missing environment variables...${NC}"
    echo -e "${YELLOW}   Some features may not work correctly.${NC}"
fi

# 포트 설정
HTTP_PORT=${PORT:-3000}
GRPC_PORT=${GRPC_PORT:-50051}

echo -e "${BLUE}📡 Starting AWS API Server...${NC}"
echo -e "${YELLOW}💡 HTTP Server will run on: http://localhost:${HTTP_PORT}${NC}"
echo -e "${YELLOW}💡 gRPC Server will run on: localhost:${GRPC_PORT}${NC}"
echo ""
echo -e "${YELLOW}💡 To stop the server, use: ./sh/stop-aws-api.sh${NC}"
echo -e "${YELLOW}💡 To restart the server, use: ./sh/restart-aws-api.sh${NC}"
echo ""
echo -e "${GREEN}✅ Server starting...${NC}"

# 백그라운드에서 실행하고 PID 저장
npm start &
echo $! > "$PID_FILE"

# 서버 시작 대기
sleep 2

echo -e "${GREEN}🎉 AWS API Server started successfully!${NC}"
echo -e "PID: $(cat $PID_FILE)"
echo -e "${BLUE}📊 Health check: curl http://localhost:${HTTP_PORT}/health${NC}"