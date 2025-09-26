#!/bin/bash

# aws-api 패키지 의존성 설치 스크립트
# Dependency installation script for aws-api package

set -e

echo "📦 Installing aws-api package dependencies..."
echo "==========================================="

cd "$(dirname "$0")/../packages/aws-api"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📦 Package: @code-ai/aws-api${NC}"

# 패키지 정보 표시
if [ -f "package.json" ]; then
    local package_version=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
    echo -e "Version: ${package_version}"
    echo -e "Type: ES Module (HTTP + gRPC Server)"
    
    # 의존성 정보
    local deps_count=$(node -p "Object.keys(require('./package.json').dependencies || {}).length" 2>/dev/null || echo "0")
    local dev_deps_count=$(node -p "Object.keys(require('./package.json').devDependencies || {}).length" 2>/dev/null || echo "0")
    echo -e "Dependencies: ${deps_count} production, ${dev_deps_count} development"
else
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

# shared 패키지 의존성 확인
echo -e "${BLUE}🔍 Checking shared package dependency...${NC}"
if [ ! -d "../shared/dist" ]; then
    echo -e "${YELLOW}⚠️  shared package not built. Building shared first...${NC}"
    cd ../shared && npm install && npm run build
    cd ../aws-api
fi

# 기존 node_modules 정리 (선택적)
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}🗑️  Existing node_modules found${NC}"
    echo -e "${YELLOW}💡 Clean install? [y/N]${NC}"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🧹 Cleaning node_modules...${NC}"
        rm -rf node_modules package-lock.json
    fi
fi

echo -e "${BLUE}🔧 Installing dependencies...${NC}"
npm install

# TypeScript 컴파일 확인
echo -e "${BLUE}🔍 Checking TypeScript compilation...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
    
    # 빌드 아티팩트 확인
    if [ -f "dist/index.js" ]; then
        echo -e "${GREEN}📦 Server binary created: dist/index.js${NC}"
    fi
    
    # gRPC proto 파일 확인
    if [ -f "../shared/proto/analysis.proto" ]; then
        echo -e "${GREEN}🔗 gRPC proto file found${NC}"
    else
        echo -e "${YELLOW}⚠️  gRPC proto file not found in shared package${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  TypeScript compilation had issues${NC}"
fi

# 설치 완료 정보
if [ -d "node_modules" ]; then
    local installed_count=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo -e "${GREEN}📊 Installed packages: $((installed_count - 1))${NC}"
fi

echo -e "${GREEN}✅ aws-api package dependencies installed successfully!${NC}"

# 서버 설정 안내
echo -e "\n${YELLOW}📋 Server Configuration:${NC}"
echo -e "   HTTP Port: ${BLUE}${PORT:-3000}${NC}"
echo -e "   gRPC Port: ${BLUE}${GRPC_PORT:-50051}${NC}"
echo -e "   Development: ${BLUE}./sh/dev-aws-api.sh${NC}"
echo -e "   Production: ${BLUE}./sh/start-aws-api.sh${NC}"
echo -e "   Test: ${BLUE}./sh/test-aws-api.sh${NC}"

# 환경 변수 확인
echo -e "\n${YELLOW}🔑 Environment Variables:${NC}"
[ ! -z "$OPENAI_API_KEY" ] && echo -e "   OPENAI_API_KEY: ${GREEN}✅ SET${NC}" || echo -e "   OPENAI_API_KEY: ${RED}❌ NOT SET${NC}"
[ ! -z "$AWS_REGION" ] && echo -e "   AWS_REGION: ${GREEN}✅ SET${NC}" || echo -e "   AWS_REGION: ${RED}❌ NOT SET${NC}"
[ ! -z "$S3_BUCKET" ] && echo -e "   S3_BUCKET: ${GREEN}✅ SET${NC}" || echo -e "   S3_BUCKET: ${RED}❌ NOT SET${NC}"
[ ! -z "$DYNAMODB_TABLE" ] && echo -e "   DYNAMODB_TABLE: ${GREEN}✅ SET${NC}" || echo -e "   DYNAMODB_TABLE: ${RED}❌ NOT SET${NC}"

if [ -z "$OPENAI_API_KEY" ] || [ -z "$AWS_REGION" ] || [ -z "$S3_BUCKET" ] || [ -z "$DYNAMODB_TABLE" ]; then
    echo -e "\n${YELLOW}💡 Missing environment variables. Create a .env file:${NC}"
    echo -e "${BLUE}   cp .env.example .env${NC}"
    echo -e "${BLUE}   # Edit .env with your values${NC}"
fi

# AWS CLI 확인
echo -e "\n${YELLOW}☁️  AWS Configuration:${NC}"
if command -v aws >/dev/null 2>&1; then
    if aws sts get-caller-identity >/dev/null 2>&1; then
        echo -e "   AWS CLI: ${GREEN}✅ CONFIGURED${NC}"
    else
        echo -e "   AWS CLI: ${YELLOW}⚠️  NOT CONFIGURED${NC}"
        echo -e "   Run: ${BLUE}aws configure${NC}"
    fi
else
    echo -e "   AWS CLI: ${YELLOW}⚠️  NOT INSTALLED${NC}"
fi