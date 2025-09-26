#!/bin/bash

# aws-api 개발 모드 실행 스크립트
# Development mode script for aws-api

echo "🚀 Starting AWS API Server in Development Mode..."
echo "================================================="

cd "$(dirname "$0")/../packages/aws-api"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📦 Package: @code-ai/aws-api${NC}"
echo -e "${BLUE}🔧 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🔍 Checking environment...${NC}"
missing_vars=()

[ -z "${OPENAI_API_KEY}" ] && missing_vars+=("OPENAI_API_KEY")
[ -z "${AWS_REGION}" ] && missing_vars+=("AWS_REGION") 
[ -z "${S3_BUCKET}" ] && missing_vars+=("S3_BUCKET")
[ -z "${DYNAMODB_TABLE}" ] && missing_vars+=("DYNAMODB_TABLE")

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
        echo -e "   - ${var}"
    done
    echo -e "${YELLOW}   Continuing with development defaults...${NC}"
fi

# 개발 환경 기본값 설정
export PORT=${PORT:-3000}
export GRPC_PORT=${GRPC_PORT:-50051}
export AWS_REGION=${AWS_REGION:-us-east-1}
export S3_BUCKET=${S3_BUCKET:-dev-code-ai-storage}
export DYNAMODB_TABLE=${DYNAMODB_TABLE:-dev-code-ai-metadata}

echo -e "${BLUE}🚀 Starting development server with hot reload...${NC}"
echo -e "${YELLOW}💡 HTTP Server: http://localhost:${PORT}${NC}"
echo -e "${YELLOW}💡 gRPC Server: localhost:${GRPC_PORT}${NC}"
echo -e "${YELLOW}💡 Health Check: curl http://localhost:${PORT}/health${NC}"
echo ""
echo -e "${YELLOW}💡 Press Ctrl+C to stop the development server${NC}"
echo ""

# tsx를 사용한 개발 모드 실행
npm run dev